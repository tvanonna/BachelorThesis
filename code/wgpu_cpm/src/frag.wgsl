@fragment
fn main(@location(0) cell: f32, @location(1) cell2: f32) -> @location(0) vec4f {
  /*if( cell > 0 ){
	if( cell2 % 2 == 0 && cell % 2 == 0 ){
	 	return vec4f(1., .3, .3, 1.);
	} else if( cell2 % 2 != cell % 2 ){
		return vec4f(1., .7, .7, 1.);
	}  
  }*/

  // if( cell + cell2 > 0 ){
  // if( cell % 2 != cell2 % 2 ){
	// return vec4f(1., .2, .2, 1.);
  // } else {
	// return select( vec4f(.8, .8, .8, 1.), vec4f(.2, .2, .2, 1.), cell % 2 == 0 );
  // }
  // }
  // return vec4f(1., 1., 1., 1.);

  if(cell > 0){
    return select( vec4f(.8, .8, .8, 1.), vec4f(.2, .2, .2, 1.), cell % 2 == 0 );
  }
  return vec4f(1., 1., 1., 1.);
}

