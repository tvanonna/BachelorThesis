import { toMortonIndex } from './helper.js'

if (isDeno() && Deno.args.length < 5) {
  console.error('ERROR: Five arguments expected, but less given.');
  Deno.exit(1);
}

const GameOptions = {
  width: isDeno() ? Number(Deno.args[0]) : 1024,//1026, // 2048, // 512, //1024,
  height: isDeno() ? Number(Deno.args[1]) : 1024,//1026, // 2048, // 512, // 1024,
  ncells: 20000, // 80000, // 5000, // 20000,
  workgroupSize: 32,
  mcsPerIteration: 200,//50,//200,
  mcsTotal: 10000,//500,//100000,//40000,//40000,//10000,
  seed: 18,
  temperature: isDeno() ? Number(Deno.args[2]) : 10,
  coalescing: isDeno() ? (Deno.args[3] === 'true') : false, //should memory coalescing take place on the GPU?
  benchmarking: true,
  Z_Order: isDeno() ? (Deno.args[4] === 'true') : false, //enables storing data in z-order on the gpu
};

function isDeno() {
  return typeof Deno !== "undefined"
}

const adapter = await navigator.gpu.requestAdapter({
  featureLevel: 'compatibility',
  powerPreference: "high-performance",
});
const device = await adapter.requestDevice();
device.addEventListener('uncapturederror', event => console.error(event.error.message)); //prints WGSL errors to stderr

if (GameOptions.benchmarking && isDeno()) {
  console.log(GameOptions);
  console.log(adapter);
}

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
    buffers: [cellsStride, cells2Stride, squareStride],
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
    },
  ],
});
/*** END CODE FOR SHADER VIZ **/



const generator = new MersenneTwister(GameOptions.seed);

const computeShader = device.createShaderModule({ code: computeWGSL });


const bindGroupLayoutCompute = makeBindGroupLayoutCompute(device);

let commandEncoder;

let wholeTime = 0,
  loopTimes = 0,
  buffer0, buffer1, bufferV, bufferVstage, bufferResult,
  buffer_rand, lastid, buffer_energy, buffer_energyResult,
  buffer_T, buffer_coal;

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
  const computePipelineCollect = device.createComputePipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayoutCompute],
    }),
    compute: {
      module: computeShader,
      entryPoint: "collect",
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

  const cellVolumes = [0]; lastid = 1

  let n = GameOptions.ncells;
  let r = Math.round(GameOptions.width / 3) * 0.6;

  if (!GameOptions.Z_Order) {
    while (n > 0) {
      let x = Math.round(generator.random() * GameOptions.width),
        y = Math.round(generator.random() * GameOptions.height);

      if (Math.pow(x - GameOptions.width / 2, 2) + Math.pow(y - GameOptions.height / 2, 2) < r * r) {

        let index = y * GameOptions.width + x;

        if (cells[index] == 0) {
          cells[index] = lastid;
          lastid++;
          cellVolumes.push(1);
          n--;
        }
      }
    }
  } else {
    while (n > 0) {
      let x = Math.round(generator.random() * GameOptions.width),
        y = Math.round(generator.random() * GameOptions.height);

      if (Math.pow(x - GameOptions.width / 2, 2) + Math.pow(y - GameOptions.height / 2, 2) < r * r) {

        let index = toMortonIndex(x, y);

        if (cells[index] == 0) {
          cells[index] = lastid;
          lastid++;
          cellVolumes.push(1);
          n--;
        }
      }
    }
  }

  // initialize two buffers for the cells
  buffer0 = device.createBuffer({
    size: cells.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
    label: "buffer0"
  });
  new Uint32Array(buffer0.getMappedRange()).set(cells);
  buffer0.unmap();


  bufferV = device.createBuffer({
    size: 4 * lastid,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    mappedAtCreation: true
  })
  new Uint32Array(bufferV.getMappedRange()).set(cellVolumes)
  bufferV.unmap();

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
  buffer_rand.unmap()

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
    size: Float32Array.BYTES_PER_ELEMENT,
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

  new Float32Array(buffer_T.getMappedRange()).set([GameOptions.temperature]);
  buffer_T.unmap();

  new Uint32Array(buffer_coal.getMappedRange()).set([GameOptions.coalescing ? 1 : 0]);
  buffer_coal.unmap();

  const bindGroup0 = device.createBindGroup({
    layout: bindGroupLayoutCompute,
    entries: [
      { binding: 0, resource: { buffer: sizeBuffer } },
      { binding: 1, resource: { buffer: buffer0 } },
      { binding: 2, resource: { buffer: buffer1 } },
      { binding: 3, resource: { buffer: buffer_rand } },
      { binding: 4, resource: { buffer: bufferV } },
      { binding: 5, resource: { buffer: buffer_energy } },
      { binding: 6, resource: { buffer: buffer_T } },
      { binding: 7, resource: { buffer: buffer_coal } },
      { binding: 8, resource: { buffer: buffer_enable_morton } },
    ],
  });

  const bindGroup1 = device.createBindGroup({
    layout: bindGroupLayoutCompute,
    entries: [
      { binding: 0, resource: { buffer: sizeBuffer } },
      { binding: 1, resource: { buffer: buffer1 } },
      { binding: 2, resource: { buffer: buffer0 } },
      { binding: 3, resource: { buffer: buffer_rand } },
      { binding: 4, resource: { buffer: bufferV } },
      { binding: 5, resource: { buffer: buffer_energy } },
      { binding: 6, resource: { buffer: buffer_T } },
      { binding: 7, resource: { buffer: buffer_coal } },
      { binding: 8, resource: { buffer: buffer_enable_morton } },
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

      const passEncoderComputePingCollect = commandEncoder.beginComputePass();
      passEncoderComputePingCollect.setPipeline(computePipelineCollect);
      passEncoderComputePingCollect.setBindGroup(0, bindGroup0);
      passEncoderComputePingCollect.dispatchWorkgroups(
        GameOptions.width / GameOptions.workgroupSize,
        GameOptions.height / GameOptions.workgroupSize
      );
      passEncoderComputePingCollect.end();


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

      const passEncoderComputePongCollect = commandEncoder.beginComputePass();
      passEncoderComputePongCollect.setPipeline(computePipelineCollect);
      passEncoderComputePongCollect.setBindGroup(0, bindGroup1);
      passEncoderComputePongCollect.dispatchWorkgroups(
        GameOptions.width / GameOptions.workgroupSize,
        GameOptions.height / GameOptions.workgroupSize
      );
      passEncoderComputePongCollect.end();


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
    passEncoderRender.setBindGroup(0, uniformBindGroup);
    passEncoderRender.draw(4, GameOptions.width * GameOptions.height);
    passEncoderRender.end();
    device.queue.submit([commandEncoder.finish()]);
  }

  return [compute, render];
}

async function getFinalResult() {
  await bufferResult.mapAsync(GPUMapMode.READ);
  const arrayBuffer = bufferResult.getMappedRange();
  const data = new Uint32Array(arrayBuffer); // Adjust based on the data type in the buffer
  const rgbdata = new Uint8Array(GameOptions.width * GameOptions.height * 4)

  for (let i = 0; i < GameOptions.width * GameOptions.height; i++) {
    if (data[i] > 0) {
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


function nextAnimationFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

let [compute, render] = resetGameData();

for (let current_mcs = 0; current_mcs < GameOptions.mcsTotal;
  current_mcs += GameOptions.mcsPerIteration) {
  compute(GameOptions.mcsPerIteration);
  //await getEnergy();
  if (!isDeno()) {
    render();
    await device.queue.onSubmittedWorkDone();
  } else {
    //console.log( current_mcs )
  }
}

//console.log( "loop done" );

if (isDeno()) {
  Deno.exit();
}

/*
if( isDeno() ){
  await getFinalResult()
}
*/

