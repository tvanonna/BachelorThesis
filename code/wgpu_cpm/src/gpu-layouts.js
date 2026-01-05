
export function makeBindGroupLayoutCompute( device ){ 
  return device.createBindGroupLayout({
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: 'read-only-storage',
      },
    },
    {
      binding: 1,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: 'read-only-storage',
      },
    },
    {
      binding: 2,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: 'storage',
      },
    },
    {
      binding: 3,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: 'storage',
      },
    },
    {
      binding: 4,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: 'storage',
      },
    },
     {
      binding: 5,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: 'storage',
      }
    },
    {
      binding: 6,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: 'uniform',
      }
    },
    {
      binding: 7,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {
        type: 'uniform',
      }
    },
     {
      binding: 8,
      visibility: GPUShaderStage.COMPUTE,
      buffer:{
        type: 'uniform'
      }
    }, 
  ],
});
}


export function makeBindGroupLayoutRender( device ){
	return device.createBindGroupLayout({
	  entries: [
	    {
	      binding: 0,
	      visibility: GPUShaderStage.VERTEX,
	      buffer: {
	        type: 'uniform',
	      },
	    },
      {
	      binding: 1,
	      visibility: GPUShaderStage.VERTEX,
	      buffer: {
	        type: 'uniform',
	      },
	    },
	  ],}
);

}
