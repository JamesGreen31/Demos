function fib(n) {
  if (n <= 1) {
    return n;
  }

  return fib(n - 1) + fib(n - 2);
}

self.onmessage = (event) => {
  const { type, iterations, durationMs } = event.data || {};

  if (type === 'cancel') {
    self.close();
    return;
  }

  if (type !== 'start') {
    if (type !== 'startTimed') {
      return;
    }
  }

  if (type === 'startTimed') {
    const start = performance.now();
    let points = 0;

    while (performance.now() - start < durationMs) {
      for (let step = 1; step <= iterations; step += 1) {
        fib(step);
        points += 1;

        if (performance.now() - start >= durationMs) {
          break;
        }
      }
    }

    self.postMessage({ type: 'timedDone', elapsedMs: performance.now() - start, points });
    return;
  }

  const start = performance.now();

  for (let step = 1; step <= iterations; step += 1) {
    const value = fib(step);
    self.postMessage({ type: 'progress', step, value });
  }

  self.postMessage({ type: 'done', elapsedMs: performance.now() - start });
};
