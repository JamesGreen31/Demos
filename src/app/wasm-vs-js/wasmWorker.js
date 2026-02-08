let wasmFib = null;
let wasmFibNext = null;
let wasmTimedReset = null;
let wasmTimedStepMany = null;

async function loadFibFunctions(wasmUrl) {
  if (wasmFib && wasmFibNext && wasmTimedReset && wasmTimedStepMany) {
    return {
      fib: wasmFib,
      fibNext: wasmFibNext,
      fibTimedReset: wasmTimedReset,
      fibTimedStepMany: wasmTimedStepMany,
    };
  }

  const response = await fetch(wasmUrl);
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes);

  wasmFib = instance.exports.fib;
  wasmFibNext = instance.exports.fib_next;
  wasmTimedReset = instance.exports.fib_timed_reset;
  wasmTimedStepMany = instance.exports.fib_timed_step_many;

  return {
    fib: wasmFib,
    fibNext: wasmFibNext,
    fibTimedReset: wasmTimedReset,
    fibTimedStepMany: wasmTimedStepMany,
  };
}

function runTimedRace({ durationMs, batchSize, uiUpdateMs, fibTimedReset, fibTimedStepMany }) {
  fibTimedReset();
  const start = performance.now();
  let position = 0n;
  let nextUiUpdateAt = start + uiUpdateMs;

  while (performance.now() - start < durationMs) {
    fibTimedStepMany(batchSize);
    position += BigInt(batchSize);

    const now = performance.now();
    if (now >= nextUiUpdateAt) {
      self.postMessage({ type: 'timedProgress', position, elapsedMs: now - start });
      nextUiUpdateAt = now + uiUpdateMs;
    }
  }

  self.postMessage({ type: 'timedDone', elapsedMs: performance.now() - start, position });
}

self.onmessage = async (event) => {
  const { type, iterations, wasmUrl, durationMs, batchSize = 1, uiUpdateMs = 100 } = event.data || {};

  if (type === 'cancel') {
    self.close();
    return;
  }

  if (type !== 'start' && type !== 'startTimed') {
    return;
  }

  try {
    const { fib, fibNext, fibTimedReset, fibTimedStepMany } = await loadFibFunctions(wasmUrl);

    if (typeof fib !== 'function' || typeof fibNext !== 'function') {
      throw new Error('WASM module is missing Fibonacci exports');
    }

    if (type === 'startTimed') {
      if (typeof fibTimedReset !== 'function' || typeof fibTimedStepMany !== 'function') {
        throw new Error('WASM timed mode requires fib_timed_reset and fib_timed_step_many exports');
      }

      runTimedRace({ durationMs, batchSize, uiUpdateMs, fibTimedReset, fibTimedStepMany });
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
