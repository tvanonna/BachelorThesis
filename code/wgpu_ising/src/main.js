import {generateMortonIndices, toMortonIndex, toRowMajor} from './memory.js'

if (isDeno() && Deno.args.length < 5) {
  console.error('ERROR: Five arguments expected, but less given.');
  Deno.exit(1);
}

const GameOptions = {
  width: isDeno() ? Number(Deno.args[0]) : 1024,//2050,//514, // 1026, // 2048, // 512, //1024,
  height: isDeno() ? Number(Deno.args[1]) : 1024,//514,//258, // 1026, // 2048, // 512, // 1024,
  workgroupSize: 32,
  mcsPerIteration: 200,
  mcsTotal: 10000,//800,
  seed: isDeno() ? Number(Deno.args[2]) : 18,
  temperature: isDeno() ? Number(Deno.args[3]) : 10000000,// 268435456, //increase in temperature leads to more 'change' within a system
  coalescing: isDeno() ? (Deno.args[4] === 'true') : false, //should memory coalescing take place on the GPU?
  benchmarking: true,
  Z_Order: isDeno() ? (Deno.args[5] === 'true') : true, //enables storing data in z-order on the gpu
};

function isDeno() {
  return typeof Deno !== "undefined"
}

const adapter = await navigator.gpu.requestAdapter({
  featureLevel: 'compatibility',
  powerPreference: "high-performance"
});
const canTimestamp = adapter.features.has('timestamp-query');

if (GameOptions.benchmarking && isDeno()) {
  console.log(GameOptions);
  console.log(adapter);
}

const device = await adapter?.requestDevice({
  // requiredFeatures: [
  //   ...(canTimestamp ? ['timestamp-query'] : []),
  //  ],
});
device.addEventListener('uncapturederror', event => console.error(event.error.message)); //prints WGSL errors to stderr

let MersenneTwister, computeWGSL, vertWGSL, fragWGSL, encode, canvas, context;

import { makeBindGroupLayoutCompute, makeBindGroupLayoutRender } from './gpu-layouts.js';


if (!isDeno()) { // running in browser
  const mod1 = await import('./compute.wgsl?raw');
  const mod1a = await import('./vert.wgsl?raw');
  const mod1b = await import('./frag.wgsl?raw');
  const mod2 = await import('mersenne-twister');
  computeWGSL = mod1.default;
  vertWGSL = mod1a.default;
  fragWGSL = mod1b.default;
  MersenneTwister = mod2.default;
  canvas = document.querySelector('canvas');
  context = canvas.getContext('webgpu');
  const devicePixelRatio = window.devicePixelRatio;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });
} else {
  const mod1 = await import('./compute.wgsl', { with: { type: "text" } });
  const mod2 = await import('mersenne-twister');
  const mod3 = await import("https://deno.land/x/pngs/mod.ts");
  computeWGSL = mod1.default;
  MersenneTwister = mod2.default;
  encode = mod3.encode;
}

/*** CODE FOR SHADER VIZ **/
//const squareVertices = new Uint32Array([0, 0, 0, 1, 1, 0, 1, 1]);

const squareVertices = new Uint32Array([0, 0, 0, 1, 1, 0, 1, 1]);

const squareBuffer = device.createBuffer({
  size: squareVertices.byteLength,
  usage: GPUBufferUsage.VERTEX,
  mappedAtCreation: true,
});
new Uint32Array(squareBuffer.getMappedRange()).set(squareVertices);
squareBuffer.unmap();
const squareStride = {
  arrayStride: 2 * squareVertices.BYTES_PER_ELEMENT,
  stepMode: 'vertex',
  attributes: [
    {
      shaderLocation: 2,
      offset: 0,
      format: 'uint32x2',
    },
  ],
};
const bindGroupLayoutRender = makeBindGroupLayoutRender(device);
const vertexShader = device.createShaderModule({ code: vertWGSL });
const fragmentShader = device.createShaderModule({ code: fragWGSL });
const cellsStride = {
  arrayStride: Uint32Array.BYTES_PER_ELEMENT,
  stepMode: 'instance',
  attributes: [
    {
      shaderLocation: 0,
      offset: 0,
      format: 'uint32',
    },
  ],
};

const cells2Stride = {
  arrayStride: Uint32Array.BYTES_PER_ELEMENT,
  stepMode: 'instance',
  attributes: [
    {
      shaderLocation: 1,
      offset: 0,
      format: 'uint32',
    },
  ],
};

// const indicesStride = {
//   arrayStride: Uint32Array.BYTES_PER_ELEMENT,
//   stepMode: 'instance',
//   attributes: [
//     {
//       shaderLocation: 3,
//       offset: 0,
//       format: 'uint32',
//     },
//   ]
// }
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
const renderPipeline = device.createRenderPipeline({
  layout: device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayoutRender],
  }),
  primitive: {
    topology: 'triangle-strip',
  },
  vertex: {
    module: vertexShader,
    buffers: [cellsStride, cells2Stride, squareStride], //indicesStride
  },
  fragment: {
    module: fragmentShader,
    targets: [
      {
        format: presentationFormat,
      },
    ],
  },
});
const sizeBuffer = device.createBuffer({
  size: 2 * Uint32Array.BYTES_PER_ELEMENT,
  usage:
    GPUBufferUsage.STORAGE |
    GPUBufferUsage.UNIFORM |
    GPUBufferUsage.COPY_DST |
    GPUBufferUsage.VERTEX,
  mappedAtCreation: true,
});
new Uint32Array(sizeBuffer.getMappedRange()).set([
  GameOptions.width,
  GameOptions.height,
]);
sizeBuffer.unmap();

const buffer_enable_morton = device.createBuffer({
  size: Uint32Array.BYTES_PER_ELEMENT,
  usage: GPUBufferUsage.UNIFORM |
    GPUBufferUsage.COPY_DST,
  mappedAtCreation: true
});

new Uint32Array(buffer_enable_morton.getMappedRange()).set([GameOptions.Z_Order ? 1 : 0]);
buffer_enable_morton.unmap();

const uniformBindGroup = device.createBindGroup({
  layout: renderPipeline.getBindGroupLayout(0),
  entries: [
    {
      binding: 0,
      resource: {
        buffer: sizeBuffer,
        offset: 0,
        size: 2 * Uint32Array.BYTES_PER_ELEMENT,
      },
    },
    {
      binding: 1,
      resource: {
        buffer: buffer_enable_morton,
        offset: 0,
        size: Uint32Array.BYTES_PER_ELEMENT,
      }
    }
  ],
});
/*** END CODE FOR SHADER VIZ **/



const generator = new MersenneTwister(GameOptions.seed);

const computeShader = device.createShaderModule({ code: computeWGSL });

const bindGroupLayoutCompute = makeBindGroupLayoutCompute(device);

let commandEncoder;

let wholeTime = 0,
  loopTimes = 0,
  buffer0, buffer1, bufferResult,
  buffer_rand, lastid, buffer_energy, buffer_energyResult,
  buffer_T, buffer_coal;

//These buffers are for testing. I have disabled them for now.
// let buffer_morton, buffer_x, buffer_y, buffer_revert,
// bufferTempX, bufferTempY, bufferTempRevert;

// let querySet, resolveBuffer, timeResult; //used for timing on the GPU
// let gpuTime = 0;

function resetGameData() {
  // compute pipeline
  const computePipelineStep = device.createComputePipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayoutCompute],
    }),
    compute: {
      module: computeShader,
      entryPoint: "main",
      constants: {
        blockSize: GameOptions.workgroupSize,
      },
    },
  });
  const sizeBuffer = device.createBuffer({
    size: 2 * Uint32Array.BYTES_PER_ELEMENT,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.UNIFORM |
      GPUBufferUsage.COPY_DST |
      GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Uint32Array(sizeBuffer.getMappedRange()).set([
    GameOptions.width,
    GameOptions.height,
  ]);
  sizeBuffer.unmap();

  // initialize Array
  const length = GameOptions.width * GameOptions.height;

  const cells = new Uint32Array(length);

  for (let i = 0; i < GameOptions.height; i++) {
    for (let j = 0; j < GameOptions.width; j++) {
      cells[i * GameOptions.width + j] = (generator.random() < 0.5);
    }
  }

  // const indices = generateMortonIndices(GameOptions.width, GameOptions.height);

  // //Generate buffer for morton indices
  //  buffer_morton = device.createBuffer({
  //   size: indices.byteLength,
  //   usage: GPUBufferUsage.STORAGE |
  //   GPUBufferUsage.COPY_SRC |
  //   GPUBufferUsage.VERTEX,
  //   mappedAtCreation: true
  // });
  // new Uint32Array(buffer_morton.getMappedRange()).set(indices);
  // buffer_morton.unmap();


  // initialize two buffers for the cells
  buffer0 = device.createBuffer({
    size: cells.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
    label: "buffer0"
  });
  new Uint32Array(buffer0.getMappedRange()).set(cells);
  buffer0.unmap();

  bufferResult = device.createBuffer({
    size: cells.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  });

  buffer1 = device.createBuffer({
    size: cells.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
  });

  // initialize buffer with a bunch of random numbers (seedable)
  for (let i = 0; i < cells.length; i += 1) {
    cells[i] = generator.random_int();
  }
  buffer_rand = device.createBuffer({
    size: cells.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Uint32Array(buffer_rand.getMappedRange()).set(cells);
  buffer_rand.unmap();

  //initialize new buffer for storing the energy of our current system
  buffer_energy = device.createBuffer({
    size: Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });

  let val = new Uint32Array([0]);
  device.queue.writeBuffer(buffer_energy, 0, val.buffer, val.byteOffset, val.byteLength);

  buffer_energyResult = device.createBuffer({ //will store the energy of our system, 
    size: Uint32Array.BYTES_PER_ELEMENT * GameOptions.mcsPerIteration,
    usage: GPUBufferUsage.COPY_DST |
      GPUBufferUsage.MAP_READ,
  });

  buffer_T = device.createBuffer({ //will store the temperature of a system
    size: Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.UNIFORM |
      GPUBufferUsage.COPY_DST,
    mappedAtCreation: true
  });

  buffer_coal = device.createBuffer({
    size: Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.UNIFORM |
      GPUBufferUsage.COPY_DST,
    mappedAtCreation: true
  });

  new Uint32Array(buffer_T.getMappedRange()).set([GameOptions.temperature]);
  buffer_T.unmap();

  new Uint32Array(buffer_coal.getMappedRange()).set([GameOptions.coalescing ? 1 : 0]);
  buffer_coal.unmap();


  // querySet = device.createQuerySet({
  //      type: 'timestamp',
  //      count: 2 //* GameOptions.mcsPerIteration, //two values per MC step: one for the start and one for the end
  //   });

  // resolveBuffer = device.createBuffer({
  //     size: querySet.count * 8,
  //     usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  // });

  // timeResult = device.createBuffer({
  //     size: resolveBuffer.size,
  //     usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  // });

  // const computePassDescriptor = { 
  //         timestampWrites: {
  //           querySet,
  //           beginningOfPassWriteIndex: 0,//2 * i,
  //           endOfPassWriteIndex: 1// 2 * i + 1,
  //         },
  //     }



  // buffer_x = device.createBuffer({
  //   size: Uint32Array.BYTES_PER_ELEMENT,
  //   usage: GPUBufferUsage.COPY_SRC | 
  //   GPUBufferUsage.COPY_DST |
  //   GPUBufferUsage.UNIFORM,
  //   mappedAtCreation: true
  // });

  // new Uint32Array(buffer_x.getMappedRange()).set([1]);
  // buffer_x.unmap();

  //  buffer_y = device.createBuffer({
  //   size: Uint32Array.BYTES_PER_ELEMENT,
  //   usage: GPUBufferUsage.COPY_SRC | 
  //   GPUBufferUsage.COPY_DST |
  //   GPUBufferUsage.UNIFORM,
  //   mappedAtCreation: true
  // });

  // new Uint32Array(buffer_y.getMappedRange()).set([1]);
  // buffer_y.unmap();

  //  buffer_revert = device.createBuffer({
  //   size: Uint32Array.BYTES_PER_ELEMENT,
  //   usage: GPUBufferUsage.COPY_SRC | 
  //   GPUBufferUsage.COPY_DST |
  //   GPUBufferUsage.UNIFORM,
  //   mappedAtCreation: true
  // });

  // new Uint32Array(buffer_revert.getMappedRange()).set([0]);
  // buffer_revert.unmap();

  // bufferTempX = device.createBuffer({
  //   size: Uint32Array.BYTES_PER_ELEMENT,
  //   usage: GPUBufferUsage.COPY_SRC | 
  //   GPUBufferUsage.MAP_WRITE,
  //   mappedAtCreation: false
  // });


  //  bufferTempY = device.createBuffer({
  //   size: Uint32Array.BYTES_PER_ELEMENT,
  //   usage: GPUBufferUsage.COPY_SRC | 
  //   GPUBufferUsage.MAP_WRITE,
  //   mappedAtCreation: false
  // });

  //  bufferTempRevert = device.createBuffer({
  //   size: Uint32Array.BYTES_PER_ELEMENT,
  //   usage: GPUBufferUsage.COPY_SRC | 
  //   GPUBufferUsage.MAP_WRITE,
  //   mappedAtCreation: false
  // });

  //console.log('temperature ' + GameOptions.temperature.toString());

  const bindGroup0 = device.createBindGroup({
    layout: bindGroupLayoutCompute,
    entries: [
      { binding: 0, resource: { buffer: sizeBuffer } },
      { binding: 1, resource: { buffer: buffer0 } },
      { binding: 2, resource: { buffer: buffer1 } },
      { binding: 3, resource: { buffer: buffer_rand } },
      { binding: 4, resource: { buffer: buffer_energy } },
      { binding: 5, resource: { buffer: buffer_T } },
      { binding: 6, resource: { buffer: buffer_coal } },
      { binding: 7, resource: { buffer: buffer_enable_morton } },
      //{ binding: 7, resource: { buffer: buffer_x }},
      //{ binding: 8, resource: { buffer: buffer_y }},
      //{ binding: 9, resource: { buffer: buffer_revert }},
    ],
  });

  const bindGroup1 = device.createBindGroup({
    layout: bindGroupLayoutCompute,
    entries: [
      { binding: 0, resource: { buffer: sizeBuffer } },
      { binding: 1, resource: { buffer: buffer1 } },
      { binding: 2, resource: { buffer: buffer0 } },
      { binding: 3, resource: { buffer: buffer_rand } },
      { binding: 4, resource: { buffer: buffer_energy } },
      { binding: 5, resource: { buffer: buffer_T } },
      { binding: 6, resource: { buffer: buffer_coal } },
      { binding: 7, resource: { buffer: buffer_enable_morton } },
      //{ binding: 7, resource: { buffer: buffer_x }},
      //{ binding: 8, resource: { buffer: buffer_y }},
      //{ binding: 9, resource: { buffer: buffer_revert }},
    ],
  });

  const compute = (mcs_per_it) => {
    // compute

    commandEncoder = device.createCommandEncoder()
    for (let i = 0; i < mcs_per_it; i += 2) {
      const passEncoderComputePing = commandEncoder.beginComputePass();
      passEncoderComputePing.setPipeline(computePipelineStep);
      passEncoderComputePing.setBindGroup(0, bindGroup0);
      passEncoderComputePing.dispatchWorkgroups(
        GameOptions.width / GameOptions.workgroupSize,
        GameOptions.height / GameOptions.workgroupSize
      );
      passEncoderComputePing.end();

      commandEncoder.copyBufferToBuffer(buffer_energy, 0
        , buffer_energyResult, i * Uint32Array.BYTES_PER_ELEMENT, Uint32Array.BYTES_PER_ELEMENT);
      commandEncoder.clearBuffer(buffer_energy);

      const passEncoderComputePong = commandEncoder.beginComputePass();
      passEncoderComputePong.setPipeline(computePipelineStep);
      passEncoderComputePong.setBindGroup(0, bindGroup1);
      passEncoderComputePong.dispatchWorkgroups(
        GameOptions.width / GameOptions.workgroupSize,
        GameOptions.height / GameOptions.workgroupSize
      );
      passEncoderComputePong.end();

      commandEncoder.copyBufferToBuffer(buffer_energy, 0
        , buffer_energyResult, (i + 1) * Uint32Array.BYTES_PER_ELEMENT, Uint32Array.BYTES_PER_ELEMENT);
      commandEncoder.clearBuffer(buffer_energy);
    }

    commandEncoder.copyBufferToBuffer(buffer0, 0, bufferResult, 0, cells.byteLength);
    device.queue.submit([commandEncoder.finish()]);
  };

  const render = () => {
    /** Do a render pass */
    const view = context.getCurrentTexture().createView();
    const renderPass = {
      colorAttachments: [
        {
          view,
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };
    const commandEncoder = device.createCommandEncoder();
    const passEncoderRender = commandEncoder.beginRenderPass(renderPass);
    passEncoderRender.setPipeline(renderPipeline);
    passEncoderRender.setVertexBuffer(0, buffer0); //loopTimes ? buffer1 : buffer0);
    passEncoderRender.setVertexBuffer(1, buffer1);
    passEncoderRender.setVertexBuffer(2, squareBuffer);
    //passEncoderRender.setVertexBuffer(3, buffer_morton);
    passEncoderRender.setBindGroup(0, uniformBindGroup);
    passEncoderRender.draw(4, GameOptions.width * GameOptions.height);
    passEncoderRender.end();
    device.queue.submit([commandEncoder.finish()]);
  }

  // const computeBench = ( mcs_per_it ) => { 

  //   //this function computes a single iteration of the compute shader,
  //   //and does not retrieve any results. We are solely interested in
  //   //how much time it takes the GPU to compute the next iteration

  //   commandEncoder = device.createCommandEncoder();

  //   //for( let i = 0 ; i < mcs_per_it ; i ++ ){

  //     const passEncoderComputePing = commandEncoder.beginComputePass( computePassDescriptor );
  //         passEncoderComputePing.setPipeline(computePipelineStep);
  //         passEncoderComputePing.setBindGroup(0, bindGroup0);
  //         passEncoderComputePing.dispatchWorkgroups(
  //           GameOptions.width / GameOptions.workgroupSize,
  //           GameOptions.height / GameOptions.workgroupSize
  //       );
  //         passEncoderComputePing.end();

  //     commandEncoder.resolveQuerySet(querySet, 0, querySet.count, resolveBuffer, 0); //i * 2 * BigInt64Array.BYTES_PER_ELEMENT
  //   //}

  //   commandEncoder.copyBufferToBuffer(resolveBuffer, 0, timeResult, 0, resolveBuffer.size); 

  //   device.queue.submit([commandEncoder.finish()]);
  // }

  return [compute, render];//, computeBench];
}

async function getEnergy() {

  if (!isDeno()) { //this function is not properly implemented in Deno, so we can simply skip to get the same result 
    await device.queue.onSubmittedWorkDone(); //wait until GPU is finished
  }

  await buffer_energyResult.mapAsync(GPUMapMode.READ);

  try {
    const energy = buffer_energyResult.getMappedRange();
    const H = new Uint32Array(energy);
    for (let i = 0; i < GameOptions.mcsPerIteration; i++) {
      console.log(H[i]);
    }
  } finally {
    buffer_energyResult.unmap();
  }
}

async function getTime() {

  await timeResult.mapAsync(GPUMapMode.READ);

  try {
    const times = new BigInt64Array(timeResult.getMappedRange());
    for (let i = 0; i < times.length; i += 2) {
      gpuTime = Number(times[i + 1] - times[i]);
      //console.log((gpuTime / 1000).toFixed(1) +'µs');
      return gpuTime;
    }

  } finally {
    timeResult.unmap();
  }

}

async function testMorton(x, y, revert) {

  const indices = generateMortonIndices(GameOptions.width, GameOptions.height);
  const revert_int = revert ? 1 : 0;

  if (!isDeno()) { //this function is not properly implemented in Deno, so we can simply skip to get the same result 
    await device.queue.onSubmittedWorkDone(); //wait until GPU is finished
  }

  try {
    await bufferTempX.mapAsync(GPUMapMode.WRITE);
    await bufferTempY.mapAsync(GPUMapMode.WRITE);
    await bufferTempRevert.mapAsync(GPUMapMode.WRITE);

    new Uint32Array(bufferTempX.getMappedRange()).set([x]);
    new Uint32Array(bufferTempY.getMappedRange()).set([y]);
    new Uint32Array(bufferTempRevert.getMappedRange()).set([revert_int]);

  } finally {
    bufferTempX.unmap();
    bufferTempY.unmap();
    bufferTempRevert.unmap();
  }

  let ce = device.createCommandEncoder();

  ce.copyBufferToBuffer(bufferTempX, 0, buffer_x, 0, Uint32Array.BYTES_PER_ELEMENT);
  ce.copyBufferToBuffer(bufferTempY, 0, buffer_y, 0, Uint32Array.BYTES_PER_ELEMENT);
  ce.copyBufferToBuffer(bufferTempRevert, 0, buffer_revert, 0, Uint32Array.BYTES_PER_ELEMENT);

  device.queue.submit([ce.finish()]);

  compute(2);

  if (!isDeno()) { //this function is not properly implemented in Deno, so we can simply skip to get the same result 
    await device.queue.onSubmittedWorkDone(); //wait until GPU is finished
  }

  try {
    await buffer_energyResult.mapAsync(GPUMapMode.READ);

    let H = new Uint32Array(buffer_energyResult.getMappedRange());
    var index;

    if (revert) {
      index = toRowMajor(x, GameOptions.width);
    } else {
      index = toMortonIndex(x, y, indices);
    }

    if (H[0] != index) {
      var msg = revert ? "Test failed! Revert " + x.toString() + " should be " + index.toString() + " but is" + H[0].toString()
        : "Test failed! Index of " + x.toString() + " and " + y.toString() + " should be " + index.toString() + " but is" + H[0].toString();
      console.warn(msg);
    } else {
      var msg = revert ? "Test revert " + x.toString() + " passed: " + H[0].toString() + " = " + index.toString() :
        "Test morton index " + x.toString() + " and " + y.toString() + " passed: " + H[0].toString() + " = " + index.toString();

      console.log(msg);
    }
  } finally {
    buffer_energyResult.unmap();
  }

}

async function getFinalResult() {
  await bufferResult.mapAsync(GPUMapMode.READ); //wait until the result has been written into this buffer so we can read it
  const arrayBuffer = bufferResult.getMappedRange();
  const data = new Uint32Array(arrayBuffer); // Adjust based on the data type in the buffer
  const rgbdata = new Uint8Array(GameOptions.width * GameOptions.height * 4)
  bufferResult.unmap();

  for (let i = 0; i < GameOptions.width * GameOptions.height; i++) {
    if (data[i] > 0) { //what is the point of this if colors are already decided upon in the fragment shader?
      rgbdata[4 * i] = 255 * (data[i] % 2);
    } else {
      rgbdata[4 * i] = 255;
      rgbdata[4 * i + 1] = 255;
      rgbdata[4 * i + 2] = 255;
    }
    rgbdata[4 * i + 3] = 255;
  }

  const png = encode(rgbdata, GameOptions.width, GameOptions.height);
  await Deno.writeFile("output.png", png);
}


function nextAnimationFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

let [compute, render, computeBench] = resetGameData();

//console.log("loop initialised");

//runs tests
// for(var i = 0; i < GameOptions.width; i ++){
//     for(var j = 0; j < GameOptions.height; j ++){
//       await testMorton(i,j,false);
//     }
//   }

// for(var i = 63094; i < GameOptions.width * GameOptions.height; i++){
//   await testMorton(i,0,true);
// }

//normal execution
for (let current_mcs = 0; current_mcs < GameOptions.mcsTotal;
  current_mcs += GameOptions.mcsPerIteration) {
  compute(GameOptions.mcsPerIteration);
  //testMorton(123,456,false);
  //await getEnergy();
  //await getTime();
  if (!isDeno()) {
    render()
    await device.queue.onSubmittedWorkDone();
  } else {
    //console.log( current_mcs );
  }
}

//console.log( "loop done" )

if (isDeno()) {
  Deno.exit();
}


