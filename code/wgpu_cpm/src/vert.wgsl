@binding(0) @group(0) var<uniform> size: vec2u;
@group(0) @binding(1) var<uniform> morton: u32;

//https://fgiesen.wordpress.com/2009/12/13/decoding-morton-codes/ <- source
//https://fgiesen.wordpress.com/2022/09/09/morton-codes-addendum/ <- addendum, not used
fn revert(x : u32) -> u32{
  var xVal: u32 = x & 0x55555555u;
  xVal = (xVal | (xVal >> 1)) & 0x33333333u;
  xVal = (xVal | (xVal >> 2)) & 0x0F0F0F0Fu;
  xVal = (xVal | (xVal >> 4)) & 0x00FF00FFu;
  xVal = (xVal | (xVal >> 8)) & 0x0000FFFFu;
  return xVal;
}

fn toRowMajor(z : u32, size: vec2u) -> u32{ 
  var xPos : u32 = revert(z);
  var yPos: u32 = revert(z >> 1);

  if(xPos >= size.x){
    xPos = size.x - 1u;
  }
  
  // if (yPos >= size.y){
  //   yPos = size.y - 1u;
  // }

  return yPos * size.x + xPos;
}

struct Out {
  @builtin(position) pos: vec4f,
  @location(0) cell: f32,
  @location(1) cell2: f32,
}

@vertex
fn main(@builtin(instance_index) i: u32, 
	@location(0) cell: u32, 
	@location(1) cell2: u32, 
	@location(2) pos: vec2u) -> Out {

   var j: u32;

   if(morton == 1u){
    j = toRowMajor(i, size);
  } else {
    j = i;
  }

  let w = size.x;
  let h = size.y;
  let x = (f32(j % w + pos.x) / f32(w) - 0.5) * 2. * f32(w) / f32(max(w, h));
  let y = (f32((j - (j % w)) / w + pos.y) / f32(h) - 0.5) * 2. * f32(h) / f32(max(w, h));

  //let r = select( cell, cell2, w % 2 == 0 );
 
  return Out(vec4f(x, y, 0., 1.), f32(cell), f32(cell2));
}

