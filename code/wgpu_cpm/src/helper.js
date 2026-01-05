//This function converts a set of x,y coordinates
//from a grid to a morton index corresponding to
//where that coordinate will be stored in memory
// export function toMortonIndex(x,y){
//     let x_bin = x.toString(2),
//         y_bin = y.toString(2);

//     //first we make sure that the binary representations
//     //of x and y are the same length (i.e. use the same
//     //amount of bits)
//     if(x_bin.length < y_bin.length){
//         var tmp = '';
//         for(var j = 0; j < (y_bin.length - x_bin.length); j ++){
//             tmp += '0';
//         }
//         x_bin = tmp.concat(x_bin);
//     } else if(y_bin.length < x_bin.length){
//         var tmp = '';
//         for(var j = 0; j < (x_bin.length - y_bin.length); j ++){
//             tmp += '0';
//         }
//         y_bin = tmp.concat(y_bin);
//     }

//     var result = '';

//     let len = x_bin.length;

//     for(var i = len - 1; i >= 0; i --){
//         let tmp = y_bin[i] + x_bin[i];
//         result = tmp.concat(result);
//     }

//     result = parseInt(result, 2);

//     return result;
// }

export function interleave(x){
    var xPos = x & 0x0000FFFF; //we only look at the first 16 bits, so grid width/height is limited to 2^16 - 1
    xPos = (xPos | (xPos << 8)) & 0x00FF00FF;
    xPos = (xPos | (xPos << 4)) & 0x0F0F0F0F;
    xPos = (xPos | (xPos << 2)) & 0x33333333;
    xPos = (xPos | (xPos << 1)) & 0x55555555;

  return xPos;
}

export function toMortonIndex(x,y){
    return (interleave(x) | (interleave(y) << 1));
}

export function revert(x){
  x = x & 0x55555555;
  x = (x ^ (x >> 1)) & 0x33333333;
  x = (x ^ (x >> 2)) & 0x0F0F0F0F;
  x = (x ^ (x >> 4)) & 0x00FF00FF;
  x = (x ^ (x >> 8)) & 0x0000FFFF;
  return x;
}

export function toRowMajor(z,size_x){
  var xPos = revert(z);
  var yPos = revert(z >> 1);

  return yPos * size_x + xPos;
}

// export function generateMortonIndices(size_x, size_y){
//     let size = size_x * size_y;

//     let indices = new Uint32Array(size_x * size_y);

//     for(var x = 0; x < size; x ++){
//         let temp = toRowMajor(x,size_x);

//         indices[x] = temp;

//         if(temp > size || temp < 0){
//             console.log(temp, x);
//         }
//     }

//     console.log(indices);

//     return indices;
// }

//https://en.wikipedia.org/wiki/Moser%E2%80%93de_Bruijn_sequence
export function generateMortonIndices(size_x, size_y){
    let size = size_x * size_y;

    let indices_x = new Uint32Array(size_x);
    let indices_y = new Uint32Array(size_y);
    let indices = new Uint32Array(size_x * size_y);

    indices_x[0] = 0x00000000;
    indices_y[0] = 0x00000000;

    for(var i = 1; i < size_x; i ++){
        indices_x[i] = (indices_x[i - 1] + 0xaaaaaaab) & 0x55555555;
    }

    for(var j = 1; j < size_y; j ++){
        indices_y[j] = (indices_y[j - 1] + 0xaaaaaaab) & 0x55555555;
    }

    for(var i = 0; i < size_x; i ++){
        for(var j = 0; j < size_y; j ++){
            let temp = indices_x[i] + indices_y[j] + indices_y[j];
            indices[j * size_x + i] = temp;
        }
    }

    return indices
}

export function nextPowerofTwo(x){
    const power = Math.ceil(Math.log2(x));
    return 2 ** power;
}