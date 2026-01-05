override blockSize = 8u;
const pad = 1u;

var<workgroup> workgroup_win: array<u32, (blockSize+2)*(blockSize+2)>;

@binding(0) @group(0) var<storage, read> size: vec2u; //stores the size of the grid as a vector with 2 elems
@binding(1) @group(0) var<storage, read> current: array<u32>; //
@binding(2) @group(0) var<storage, read_write> next: array<u32>;
@binding(3) @group(0) var<storage, read_write> rng_arr: array<u32>;
@binding(4) @group(0) var<storage, read_write> V_arr: array<atomic<u32>>; //stores the volumes (#pixels) of each cell for all cells
@binding(5) @group(0) var<storage, read_write> energy: atomic<u32>;
@binding(6) @group(0) var<uniform> T: f32;
@binding(7) @group(0) var<uniform> coal: u32;
@binding(8) @group(0) var<uniform> morton: u32; 

const V : f32 = 40.;
//const T : f32 = 10.;
const lambda_V : f32 = 1.;//2.;
const e: f32 = 2.71828;

const rate : f32 = 1;

//adhesion penalty constants per combination of cell types

const J = array( //would take up less space in memory with packing?
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

fn modulo(a: i32, b: i32) -> i32 {
    let rem = a % b; //modulo is an expensive operation
    return select( rem, rem+b, rem < 0 );
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

fn getIndex(x: u32, y: u32) -> u32 {
  if(morton == 0){
    // let h = size.y;
    let w = size.x;
    return y * w + x;
  } else {
     return toMortonIndex(x,y);
  }
}

fn getIndexWorkgroup(x: u32, y: u32) -> u32 {
  return y*(blockSize+2) + x;
}

fn getCell(x: u32, y: u32) -> u32 {
	return workgroup_win[getIndexWorkgroup(x,y)];
}

fn getCellG(x: u32, y: u32) -> u32 {
  return current[getIndex(x, y)];
}


fn neighHist( x: u32, y: u32, t : u32 ) -> vec3u {//returns amount of neighbour cells which are different or the same as t respectively
  var r = vec3u( 0u, 0u, 0u );
  for (var ky: u32 = 0; ky <= 2; ky++) {
    for (var kx: u32 = 0; kx <= 2; kx++) { //for loops are good for memory coalescing, right?
	let t_n = getCell( x+kx-1, y+ky-1 );
	if( t_n > 0 ){
		if( t_n != t ){
			r[1+(t_n % 2)] += 1;
		}
	} else {
		r[0] += 1;
	}
    }
  }
  return r;
}

fn neighHistG( x: u32, y: u32, t : u32 ) -> vec3u {//returns amount of neighbour cells which are different or the same as t respectively
  var r = vec3u( 0u, 0u, 0u );
  for (var ky: u32 = 0; ky <= 2; ky++) {
    for (var kx: u32 = 0; kx <= 2; kx++) { //for loops are good for memory coalescing, right?
	let t_n = getCellG( x+kx-1, y+ky-1 );
	if( t_n > 0 ){
		if( t_n != t ){
			r[1+(t_n % 2)] += 1;
		}
	} else {
		r[0] += 1;
	}
    }
  }
  return r;
}


fn neighHistEnergy( x: u32, y: u32 ) -> vec2u {
  //var r = vec3u( 0, 0, 0 );
  var r = vec2u( 0, 0);
  for (var ky: u32 = 0; ky <= 2; ky++) {
    for (var kx: u32 = 0; kx <= 2; kx++) {
	let t_n = getCellG( x+kx-1, y+ky-1 );
	r[t_n % 2] += 1;
	// if(t_n == 0){
	// 	r[0] += 1;
	// } else {
	// 	r[(t_n % 2) + 1] += 1;
	// }
    }
  }
  return r;
}

fn randNeighbour(x: u32, y: u32, s:u32) -> u32 { //random access of global memory is very slow, since less memory coalescing
  let w : i32 = i32( ( s >> 12 ) % 8 );
  switch( w ){
	case 5: {
		return getCell( x - 1 , y + 1 );
	}
	case 2: {
		return getCell( x , y + 1 ); 
	}
	case 6: {
		return getCell( x + 1 , y + 1 ); 
	}
	case 3: {
		return getCell( x - 1 , y ); 
	}
	case 4: {
	

	return getCell( x + 1 , y ); 
	}
	case 0: {
		return getCell( x - 1 , y - 1 ); 
	}
	case 1: {
		return getCell( x , y - 1 ); 
	} 
	default: {
		return getCell( x + 1 , y - 1 ); 
	}
  }
}

fn randNeighbourG(x: u32, y: u32, s:u32) -> u32 { //random access of global memory is very slow, since less memory coalescing
  let w : i32 = i32( ( s >> 12 ) % 8 );
  switch( w ){
	case 5: {
		return getCellG( x - 1 , y + 1 );
	}
	case 2: {
		return getCellG( x , y + 1 ); 
	}
	case 6: {
		return getCellG( x + 1 , y + 1 ); 
	}
	case 3: {
		return getCellG( x - 1 , y ); 
	}
	case 4: {
	

	return getCellG( x + 1 , y ); 
	}
	case 0: {
		return getCellG( x - 1 , y - 1 ); 
	}
	case 1: {
		return getCellG( x , y - 1 ); 
	} 
	default: {
		return getCellG( x + 1 , y - 1 ); 
	}
  }
}

fn adhesion(x: u32, y: u32, t: u32 ) -> i32 { //computes the sum of the adhesion constraint, based on the neighbouring cell types
  var r : i32 = 0;
  let t1 = select( 0u, 1+(t % 2), t > 0 );
  for (var ky: u32 = 0; ky <= 2; ky++) { //for loops are good for coalescing, right?
    for (var kx: u32 = 0; kx <= 2; kx++) {
	if( kx != 1 || ky != 1 ){
		let t_n = getCell( x+kx-1, y+ky-1 );
		if( t != t_n ){
			let t2 = select( 0u, 1+(t_n % 2), t_n > 0 );
			r += J[ t1 + 3*t2 ]; //fancier way of looking at the correct array entry I think
		}
	}
    }
  }
  return r;
}

fn adhesionG(x: u32, y: u32, t: u32 ) -> i32 { //computes the sum of the adhesion constraint, based on the neighbouring cell types
  var r : i32 = 0;
  let t1 = select( 0u, 1+(t % 2), t > 0 );
  for (var ky: u32 = 0; ky <= 2; ky++) { //for loops are good for coalescing, right?
    for (var kx: u32 = 0; kx <= 2; kx++) {
	if( kx != 1 || ky != 1 ){
		let t_n = getCellG( x+kx-1, y+ky-1 );
		if( t != t_n ){
			let t2 = select( 0u, 1+(t_n % 2), t_n > 0 );
			r += J[ t1 + 3*t2 ]; //fancier way of looking at the correct array entry I think
		}
	}
    }
  }
  return r;
}

fn neighboursOfType(x: u32, y: u32, t: u32) -> u32 {
  return u32(getCell(x - 1, y - 1) == t) + //how is memory coalescing here?
	 u32(getCell(x, y - 1) == t ) + 
	 u32(getCell(x + 1, y - 1) == t ) + 
         u32(getCell(x - 1, y) == t )+ 
	 u32(getCell(x + 1, y) == t )+ 
         u32(getCell(x - 1, y + 1) == t )+ 
	 u32(getCell(x, y + 1) == t )+ 
	 u32(getCell(x + 1, y + 1) == t);
}

fn neighboursOfTypeG(x: u32, y: u32, t: u32) -> u32 {
  return u32(getCellG(x - 1, y - 1) == t) + //how is memory coalescing here?
	 u32(getCellG(x, y - 1) == t ) + 
	 u32(getCellG(x + 1, y - 1) == t ) + 
         u32(getCellG(x - 1, y) == t )+ 
	 u32(getCellG(x + 1, y) == t )+ 
         u32(getCellG(x - 1, y + 1) == t )+ 
	 u32(getCellG(x, y + 1) == t )+ 
	 u32(getCellG(x + 1, y + 1) == t);
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

  //looks like this function loads grid data from current into workgroup_win, which I assume 
  //is only visible to each workgroup and is thus stored in shared memory?
  //best to ask textor about this.
}

@compute @workgroup_size(blockSize, blockSize)
fn collect(@builtin(global_invocation_id) grid: vec3u) { //fills the V_arr array with how much cells exist of each type
  let x = grid.x + pad;
  let y = grid.y + pad;
  let ii = getIndex( x, y );
  let src_i = current[ii];
  let tgt_i = next[ii];
  if( src_i != tgt_i ){
	if( src_i > 0 ){
        	atomicSub( &V_arr[src_i], 1u ); // += 1; //atomic operations are very slow!
	}
	if( tgt_i > 0 ){
		atomicAdd( &V_arr[tgt_i], 1u ); //
	}
  }
}

@compute @workgroup_size(blockSize, blockSize)
fn main(@builtin(global_invocation_id) grid: vec3u,
	@builtin(local_invocation_id) wg: vec3u) {

  let coalescing = (coal == 1);
  var tgt_i: u32;

  let x = grid.x;
  let y = grid.y;
  let xw = wg.x;
  let yw = wg.y;

  let ii = getIndex( x+pad, y+pad );

  let state = xorshift32(rng_arr[ii]);

  //what functions in the main body uses workgroup win
  //instead of current? all these functions will need
  //new counterparts that do use current, which should
  //reduce memory coalescing.

  var src_i : u32;

  if(coalescing == true){
	tgt_i = prefetch( grid, wg );
  	workgroupBarrier();
	src_i = randNeighbour( xw+1, yw+1, state ); //>>8) );
  } else {
	tgt_i = getCellG(x+pad, y+pad);
	src_i = randNeighbourG( x+1, y+1, state ); //>>8) );
  }  

  //var src_i = 0;
//   let src_i = randNeighbour( xw+1, yw+1, state ); //>>8) );
  let src_t = src_i % 2; //modulo is expensive (but maybe not for small values)
  let tgt_t = tgt_i % 2;

  var next_ii = tgt_i;

  if( src_i != tgt_i ){
		if(coalescing){
			// Adhesion constraint
			let neigh_h = neighHist( xw+1, yw+1, tgt_i ); //returns the types of the neighbouring cells
			let ttt = select( 3*(1+(tgt_i%2)), 0u, tgt_i == 0 );
			var H_before = f32( i32(neigh_h[ 0 ]) * J[ttt] + i32(neigh_h[ 1 ]) * J[ttt + 1] + 
				i32(neigh_h[ 2 ]) * J[ttt + 2] ); //returns the adhesion penalty for all neighbouring cells
			//  var H_before = f32(adhesion( xw+1, yw+1, tgt_i )); //why is this commented?
			var H_after = f32(adhesion( xw+1, yw+1, src_i )); //computes the adhesion penalty for 
			
			// Volume constraint
			if( tgt_i > 0 && tgt_i != src_i ){
				let V_ci = f32(atomicLoad(&V_arr[tgt_i])); //retrieve how many cells of type tgt_i are currently on our grid
					let V_before = f32(V_ci-V); //what is the purpose of V in this context?
					let V_after = f32(V_ci-1-V); //if tgt_i != src_i, V will be 1 less (since one cell of type src_i has now changed)
				H_before = H_before + lambda_V*V_before*V_before; //computes volume penalty for current iter
				H_after = H_after + lambda_V*V_after*V_after; //computes volume penalty for after 
			}
			if( src_i > 0 && tgt_i != src_i ){
				let V_rn = f32(atomicLoad(&V_arr[src_i])); //slow, but there is no other way prolly
					let V_before = f32(V_rn-V);
					let V_after = f32(V_rn+1-V);
				H_before = H_before + lambda_V*V_before*V_before;
				H_after = H_after + lambda_V*V_after*V_after;
			}
			
			let delta_H  = H_after - H_before;
			
			let urand : f32 = f32( state >> 16 )/0xFFFFf;
			if( urand < rate && ( delta_H < 0  || urand/rate < pow( e, -delta_H/T ) ) ){ //probability of copy successful attempt in CPM 
				next_ii = src_i;
			} 
		} else {
			// Adhesion constraint
			let neigh_h = neighHistG( x+1, y+1, tgt_i ); //returns the types of the neighbouring cells
			let ttt = select( 3*(1+(tgt_i%2)), 0u, tgt_i == 0 );
			var H_before = f32( i32(neigh_h[ 0 ]) * J[ttt] + i32(neigh_h[ 1 ]) * J[ttt + 1] + 
				i32(neigh_h[ 2 ]) * J[ttt + 2] ); //returns the adhesion penalty for all neighbouring cells
			//  var H_before = f32(adhesion( xw+1, yw+1, tgt_i )); //why is this commented?
			var H_after = f32(adhesionG( x+1, y+1, src_i )); //computes the adhesion penalty for 
			
			// Volume constraint
			if( tgt_i > 0 && tgt_i != src_i ){
				let V_ci = f32(atomicLoad(&V_arr[tgt_i])); //retrieve how many cells of type tgt_i are currently on our grid
					let V_before = f32(V_ci-V); 
					let V_after = f32(V_ci-1-V); //if tgt_i != src_i, V will be 1 less (since one cell of type src_i has now changed)
				H_before = H_before + lambda_V*V_before*V_before; //computes volume penalty for current iter
				H_after = H_after + lambda_V*V_after*V_after; //computes volume penalty for after 
			}
			if( src_i > 0 && tgt_i != src_i ){
				let V_rn = f32(atomicLoad(&V_arr[src_i])); //slow, but there is no other way prolly
					let V_before = f32(V_rn-V);
					let V_after = f32(V_rn+1-V);
				H_before = H_before + lambda_V*V_before*V_before;
				H_after = H_after + lambda_V*V_after*V_after;
			}
			
			let delta_H  = H_after - H_before;
			
			let urand : f32 = f32( state >> 16 )/0xFFFFf;
			if( urand < rate && ( delta_H < 0  || urand/rate < pow( e, -delta_H/T ) ) ){ //probability of copy successful attempt in CPM 
				next_ii = src_i;
			} 
		}
	  
  } 
  next[ii] = next_ii;
  rng_arr[ii] = state;

  let nh = neighHistG(x+pad, y+pad, tgt_i);

// to calculate dark gray - light gray boundary lengths
//   if(tgt_i > 0){
// 	atomicAdd( &energy, nh[((1 + tgt_i) % 2) + 1]);
//   } 

// to calculate light gray - light gray boundary lengths
//   if(tgt_i > 0 && tgt_i % 2 == 1){
// 	atomicAdd( &energy, nh[2]);
//   } 
  
// to calculate dark gray - dark gray boundary lengths
//   if(tgt_i > 0 && tgt_i % 2 == 0){
// 	atomicAdd( &energy, nh[1]);
//   } 
	
//to calculate dark gray - edge boundary lengths
//   if(!(tgt_i > 0)){
// 	atomicAdd( &energy, nh[1]);
//   } 

//to calculate light gray - edge boundary lengths
//   if(!(tgt_i > 0)){
// 	atomicAdd( &energy, nh[2]);
//   } 
  
  
}

