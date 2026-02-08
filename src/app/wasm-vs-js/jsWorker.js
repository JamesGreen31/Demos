function fib(n) {
  if (n <= 1) {
    return n;
  }

  return fib(n - 1) + fib(n - 2);
}

self.onmessage = (event) => {
  const { type, iterations } = event.data || {};

  if (type === 'cancel') {
    self.close();
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
};
