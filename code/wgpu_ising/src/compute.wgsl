//ask Textor how indexing works (and other memory tricks used here)!
override blockSize = 8u;

const pad = 1u; //padding makes sure that all indexing falls inside the array?

var<workgroup> workgroup_win: array<u32, (blockSize+2)*(blockSize+2)>;

@binding(0) @group(0) var<storage, read> size: vec2u; 
@binding(1) @group(0) var<storage, read> current: array<u32>;
@binding(2) @group(0) var<storage, read_write> next: array<u32>;
@binding(3) @group(0) var<storage, read_write> rng_arr: array<u32>;
@binding(4) @group(0) var<storage, read_write> energy: atomic<u32>;
@binding(5) @group(0) var<uniform> T: u32;
@binding(6) @group(0) var<uniform> coal: u32;
@binding(7) @group(0) var<uniform> morton: u32; 
// @binding(7) @group(0) var<uniform> test_x: u32;
// @binding(8) @group(0) var<uniform> test_y: u32;
// @binding(9) @group(0) var<uniform> revert_bool: u32;

const J = array( //this value is never used anywhere
	0, 16, 16, 
        16, 2, 11, 
        16, 11, 14 
);

fn interleave(x :u32) -> u32{
  var xPos : u32 = u32(x) & 0x0000FFFFu; //we only look at the first 16 bits, so grid width/height is limited to 2^16 - 1
    xPos = (xPos | (xPos << 8)) & 0x00FF00FFu;
    xPos = (xPos | (xPos << 4)) & 0x0F0F0F0Fu;
    xPos = (xPos | (xPos << 2)) & 0x33333333u;
    xPos = (xPos | (xPos << 1)) & 0x55555555u;

  return xPos;
}

//https://lemire.me/blog/2018/01/09/how-fast-can-you-bit-interleave-32-bit-integers-simd-edition/
//https://graphics.stanford.edu/%7Eseander/bithacks.html <- original source
fn toMortonIndex(x:u32, y: u32) -> u32{
  return (interleave(x) | (interleave(y) << 1));
}

fn revert(x : u32) -> u32{
  var xVal: u32 = x & 0x55555555u;
  xVal = (xVal ^ (xVal >> 1)) & 0x33333333u;
  xVal = (xVal ^ (xVal >> 2)) & 0x0F0F0F0Fu;
  xVal = (xVal ^ (xVal >> 4)) & 0x00FF00FFu;
  xVal = (xVal ^ (xVal >> 8)) & 0x0000FFFFu;
  return xVal;
}

fn toRowMajor(z : u32, size: vec2u) -> u32{ //todo: convert morton index z to row-major index i
  var xPos : u32 = revert(z);
  var yPos: u32 = revert(z >> 1);

  if(xPos >= size.x){
    xPos = size.x - 1u;
  } else if (yPos >= size.y){
    yPos = size.y - 1u;
  }

  return yPos * size.x + xPos;
}

/* The state must be initialized to non-zero */
/* Algorithm "xor" from p. 4 of Marsaglia, "Xorshift RNGs" */
fn xorshift32(state: u32) -> u32 {
    var r : u32 = state;
    r ^= r << 13;
    r ^= r >> 17;
    r ^= r << 5;
    return r;
}

fn getIndexWorkgroup(x: u32, y: u32) -> u32 {
  return y*(blockSize+2) + x;
}

fn getIndex(x: u32, y: u32) -> u32 {
  if(morton == 0){
    // let h = size.y;
    let w = size.x;
    return y * w + x;
  } else {
     return toMortonIndex(x,y);
  }
}

fn getCellG(x: u32, y: u32) -> u32 {
  return current[getIndex(x, y)];
}

fn getCell(x: u32, y: u32) -> u32 {
  return workgroup_win[getIndexWorkgroup(x, y )];
}

fn neighHist( x: u32, y: u32 ) -> vec2u {
  var r = vec2u( 0, 0 );
  for (var ky: u32 = 0; ky <= 2; ky++) {
    for (var kx: u32 = 0; kx <= 2; kx++) {
	let t_n = getCell( x+kx-1, y+ky-1 );
	r[t_n % 2] += 1;
    }
  }
  return r;
}

fn neighHistG( x: u32, y: u32 ) -> vec2u {
  var r = vec2u( 0, 0 );
  for (var ky: u32 = 0; ky <= 2; ky++) {
    for (var kx: u32 = 0; kx <= 2; kx++) {
	let t_n = getCellG( x+kx-1, y+ky-1 );
	r[t_n % 2] += 1;
    }
  }
  return r;
}


fn prefetch( grid:vec3u, wg: vec3u ) -> u32{
  /** Prefetch neighbour pixels (at most 1 per thread!!) */
  if( wg.x == 0 ){
  	let ii = getIndex( grid.x+pad-1, grid.y+pad );
	let iiw = getIndexWorkgroup( 0, wg.y+1 );
  	workgroup_win[iiw] = current[ii];
  } else if( wg.x == 1 ){ 
  	let ii = getIndex( grid.x+pad-2+blockSize+1, grid.y+pad );
	let iiw = getIndexWorkgroup( blockSize+1, wg.y+1 );
  	workgroup_win[iiw] = current[ii];	
  } else if( wg.x == 2 ){
  	let ii = getIndex( grid.x-wg.x+wg.y+pad, grid.y-wg.y+pad-1 );
	let iiw = getIndexWorkgroup( wg.y+1, 0 );
  	workgroup_win[iiw] = current[ii];
  } else if( wg.x == 3 ){
  	let ii = getIndex( grid.x-wg.x+wg.y+pad, grid.y-wg.y+pad+blockSize );
	let iiw = getIndexWorkgroup( wg.y+1, blockSize+1 );
  	workgroup_win[iiw] = current[ii];
  } else if( wg.x == 4 ){ // corner pixels
	if( wg.y == 0 ){
		let ii = getIndex( grid.x+pad-5, grid.y+pad-1 );
		let iiw = getIndexWorkgroup( 0, 0 );
	  	workgroup_win[iiw] = current[ii];	
	} else if( wg.y == blockSize-1 ){
		let ii = getIndex( grid.x+pad-5, grid.y+pad+1 );
		let iiw = getIndexWorkgroup( 0, blockSize+1 );
	  	workgroup_win[iiw] = current[ii];
	}
  } else if( wg.x == 5 ){ // corner pixels
	if( wg.y == 0 ){
		let ii = getIndex( grid.x+pad-6+blockSize+1, grid.y+pad-1 );
		let iiw = getIndexWorkgroup( blockSize+1, 0 );
	  	workgroup_win[iiw] = current[ii];	
	} else if( wg.y == blockSize-1 ){
		let ii = getIndex( grid.x+pad-6+blockSize+1, grid.y+pad+1 );
		let iiw = getIndexWorkgroup( blockSize+1, blockSize+1 );
	  	workgroup_win[iiw] = current[ii];
	}
  } 
  /** Prefetch your own pixel */
  let ii = getIndex( grid.x+pad, grid.y+pad );
  let iiw = getIndexWorkgroup( wg.x+1, wg.y+1 );
  workgroup_win[iiw] = current[ii];
  return( workgroup_win[iiw] );
}


@compute @workgroup_size(blockSize, blockSize)
fn main(@builtin(global_invocation_id) grid: vec3u, 
	@builtin(local_invocation_id) wg: vec3u) {
  let ii = getIndex( grid.x+pad, grid.y+pad );

  let coalescing = (coal == 1);

  var nh: vec2u;
  var tgt_i: u32;

  if( coalescing == false ){
    tgt_i = current[ii];
    nh = neighHistG( grid.x+pad, grid.y+pad );
  } else {
    tgt_i = prefetch( grid, wg );
    workgroupBarrier();
    nh = neighHist( wg.x+1, wg.y+1 );
  }

  if(grid.x > size.x || grid.y > size.y){
    return;
  }
  
  let state = xorshift32(rng_arr[ii]);


  let src_i = state % 2; //randNeighbour( i32(x), i32(y), state )
  if( ( src_i == 0 && nh[0] > nh[1] ) || (src_i == 1 && nh[1] > nh[0] ) || (state >> 1 < T ) ){
	next[ii] = src_i;
  } else {
	next[ii] = tgt_i;
  }

  //for now, the energy solely consists of the amount of edges between two cells
  //of different colors. (this is the standard potts model)

//  if(tgt_i == 0){
//    atomicAdd(&energy, nh[1]); 
//  } else {
//    atomicAdd(&energy, nh[0]); 
//  }


  //TODO: expand this so we can check if the value is correct for all inputs
  // if(grid.x == 0 && grid.y == 0){
  //   if(revert_bool == 0){
  //     atomicStore(&energy, toMortonIndex(test_x,test_y));
  //   } else {
  //    atomicStore(&energy, toRowMajor(test_x, size));
  //   }
  // }

  rng_arr[ii] = state;
}

