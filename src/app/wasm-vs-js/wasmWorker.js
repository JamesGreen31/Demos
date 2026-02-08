let wasmFib = null;
let wasmFibNext = null;

async function loadFibFunctions(wasmUrl) {
  if (wasmFib && wasmFibNext) {
    return { fib: wasmFib, fibNext: wasmFibNext };
  }

  const response = await fetch(wasmUrl);
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes);

  wasmFib = instance.exports.fib;
  wasmFibNext = instance.exports.fib_next;
  return { fib: wasmFib, fibNext: wasmFibNext };
}

self.onmessage = async (event) => {
  const { type, iterations, wasmUrl, durationMs } = event.data || {};

  if (type === 'cancel') {
    self.close();
    return;
  }

  if (type !== 'start' && type !== 'startTimed') {
    return;
  }

  try {
    const { fib, fibNext } = await loadFibFunctions(wasmUrl);

    if (type === 'startTimed') {
      if (typeof fibNext !== 'function') {
        throw new Error('WASM timed mode requires efficient fib_next export');
      }

      const start = performance.now();
      let score = 0;
      let prev = 0;
      let curr = 1;

      while (performance.now() - start < durationMs) {
        const next = fibNext(prev, curr);
        prev = curr;
        curr = next;
        score += 1;
      }

      self.postMessage({ type: 'timedDone', elapsedMs: performance.now() - start, score });
      return;
    }

    if (type !== 'start') {
      return;
    }

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
