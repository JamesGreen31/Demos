let wasmFib = null;

async function loadFibFunction(wasmUrl) {
  if (wasmFib) {
    return wasmFib;
  }

  const response = await fetch(wasmUrl);
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes);

  wasmFib = instance.exports.fib;
  return wasmFib;
}

self.onmessage = async (event) => {
  const { type, iterations, wasmUrl } = event.data || {};

  if (type === 'cancel') {
    self.close();
    return;
  }

  if (type !== 'start') {
    return;
  }

  try {
    const fib = await loadFibFunction(wasmUrl);
    const start = performance.now();

    for (let step = 1; step <= iterations; step += 1) {
      const value = fib(step);
      self.postMessage({ type: 'progress', step, value });
    }

    self.postMessage({ type: 'done', elapsedMs: performance.now() - start });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Failed to run WASM race' });
  }
};
