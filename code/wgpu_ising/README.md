# 2025 webgpu deno vite


In this repo there is some experimental code for running a simple Potts simulation on WebGPU and having a single codebase that runs in both the Browser and the deno runtime.

To run the Vite runtime:
```
npm install
npm run dev
```

To run the deno runtime:

```
deno --unstable-raw-imports src/main.js
```

Or

```
deno --allow-all --unstable-raw-imports src/main.js
```
