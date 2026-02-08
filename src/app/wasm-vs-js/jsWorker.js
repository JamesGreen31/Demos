function fib(n) {
  if (n <= 1) {
    return n;
  }

  return fib(n - 1) + fib(n - 2);
}

function runTimedRace({ durationMs, batchSize, uiUpdateMs }) {
  const start = performance.now();
  let score = 0;
  let prev = 0;
  let curr = 1;
  let nextUiUpdateAt = start + uiUpdateMs;

  while (performance.now() - start < durationMs) {
    for (let index = 0; index < batchSize; index += 1) {
      const next = (prev + curr) >>> 0;
      prev = curr;
      curr = next;
      score += 1;
    }

    const now = performance.now();
    if (now >= nextUiUpdateAt) {
      self.postMessage({ type: 'timedProgress', score, elapsedMs: now - start });
      nextUiUpdateAt = now + uiUpdateMs;
    }
  }

  self.postMessage({ type: 'timedDone', elapsedMs: performance.now() - start, score });
}

self.onmessage = (event) => {
  const { type, iterations, durationMs, batchSize = 1, uiUpdateMs = 100 } = event.data || {};

  if (type === 'cancel') {
    self.close();
    return;
  }

  if (type !== 'start' && type !== 'startTimed') {
    return;
  }

  if (type === 'startTimed') {
    runTimedRace({ durationMs, batchSize, uiUpdateMs });
    return;
  }

  const start = performance.now();

  for (let step = 1; step <= iterations; step += 1) {
    const value = fib(step);
    self.postMessage({ type: 'progress', step, value });
  }

  self.postMessage({ type: 'done', elapsedMs: performance.now() - start });
};
