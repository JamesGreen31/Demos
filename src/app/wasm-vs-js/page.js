'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const MIN_ITERATIONS = 10;
const MAX_ITERATIONS = 30;
const DEFAULT_ITERATIONS = 22;

function buildProgressList(iterations) {
  return Array.from({ length: iterations }, () => false);
}

function StatusBar({ label, colorClassName, progress, elapsedMs, running }) {
  const completedCount = progress.filter(Boolean).length;

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap justify-between gap-2 mb-3">
        <h3 className="text-lg font-semibold">{label}</h3>
        <span className="text-sm text-slate-700">
          {completedCount}/{progress.length} complete
          {elapsedMs !== null ? ` • ${elapsedMs.toFixed(1)} ms` : running ? ' • Running...' : ''}
        </span>
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${progress.length}, minmax(0, 1fr))` }}
        aria-label={`${label} progress grid`}
      >
        {progress.map((done, index) => (
          <div
            key={`${label}-${index + 1}`}
            className={`h-7 rounded-sm border ${done ? `${colorClassName} border-transparent` : 'bg-white border-slate-200'}`}
            title={`Fibonacci ${index + 1}${done ? ' complete' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function WasmVsJsPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const wasmUrl = process.env.NODE_ENV === 'production' ? '/Demos/wasm/fib.wasm' : '/wasm/fib.wasm';

  const [iterations, setIterations] = useState(DEFAULT_ITERATIONS);
  const [jsProgress, setJsProgress] = useState(() => buildProgressList(DEFAULT_ITERATIONS));
  const [wasmProgress, setWasmProgress] = useState(() => buildProgressList(DEFAULT_ITERATIONS));
  const [jsElapsedMs, setJsElapsedMs] = useState(null);
  const [wasmElapsedMs, setWasmElapsedMs] = useState(null);
  const [raceStatus, setRaceStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const jsWorkerRef = useRef(null);
  const wasmWorkerRef = useRef(null);

  const isRunning = raceStatus === 'running';
  const isDone = raceStatus === 'done';

  const winnerMessage = useMemo(() => {
    if (!isDone || jsElapsedMs === null || wasmElapsedMs === null) {
      return '';
    }

    if (jsElapsedMs === wasmElapsedMs) {
      return 'Tie race! Both implementations finished at the same time.';
    }

    return jsElapsedMs < wasmElapsedMs
      ? 'JavaScript finished first in this run.'
      : 'WASM finished first in this run.';
  }, [isDone, jsElapsedMs, wasmElapsedMs]);

  const stopWorkers = () => {
    if (jsWorkerRef.current) {
      jsWorkerRef.current.terminate();
      jsWorkerRef.current = null;
    }

    if (wasmWorkerRef.current) {
      wasmWorkerRef.current.terminate();
      wasmWorkerRef.current = null;
    }
  };

  const resetProgress = (nextIterations = iterations) => {
    setJsProgress(buildProgressList(nextIterations));
    setWasmProgress(buildProgressList(nextIterations));
    setJsElapsedMs(null);
    setWasmElapsedMs(null);
    setErrorMessage('');
  };

  useEffect(() => {
    return () => stopWorkers();
  }, []);

  useEffect(() => {
    if (jsElapsedMs !== null && wasmElapsedMs !== null) {
      setRaceStatus('done');
    }
  }, [jsElapsedMs, wasmElapsedMs]);

  const beginRace = () => {
    stopWorkers();
    resetProgress(iterations);
    setRaceStatus('running');

    const jsWorker = new Worker(new URL('./jsWorker.js', import.meta.url));
    const wasmWorker = new Worker(new URL('./wasmWorker.js', import.meta.url));

    jsWorkerRef.current = jsWorker;
    wasmWorkerRef.current = wasmWorker;

    jsWorker.onmessage = (event) => {
      const data = event.data || {};

      if (data.type === 'progress') {
        setJsProgress((previous) => previous.map((value, index) => (index < data.step ? true : value)));
      }

      if (data.type === 'done') {
        setJsElapsedMs(data.elapsedMs);
      }
    };

    wasmWorker.onmessage = (event) => {
      const data = event.data || {};

      if (data.type === 'progress') {
        setWasmProgress((previous) => previous.map((value, index) => (index < data.step ? true : value)));
      }

      if (data.type === 'done') {
        setWasmElapsedMs(data.elapsedMs);
      }

      if (data.type === 'error') {
        setErrorMessage(data.message || 'Unexpected WASM worker failure');
        setRaceStatus('idle');
        stopWorkers();
      }
    };

    jsWorker.postMessage({ type: 'start', iterations });
    wasmWorker.postMessage({ type: 'start', iterations, wasmUrl });
  };

  const cancelRace = () => {
    stopWorkers();
    setRaceStatus('idle');
  };

  const resetRace = () => {
    stopWorkers();
    setRaceStatus('idle');
    resetProgress(iterations);
  };

  return (
    <main className="min-h-screen p-6 md:p-8 flex flex-col items-center gap-5">
      <div className="w-full max-w-6xl flex items-center justify-between">
        <button
          type="button"
          onClick={() => window.location.assign(demosHref)}
          className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800"
        >
          ← Back
        </button>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-center">WASM vs JS</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">What is this demo?</h2>
        <p className="text-slate-700 mb-3">
          This module visualizes the speed difference between a traditional JavaScript recursion and the
          same recursive Fibonacci logic compiled to WebAssembly from Rust.
        </p>
        <p className="text-slate-700">
          Both engines compute Fibonacci numbers from 1 through your selected iteration count.
          As each value is completed, another block is filled in that engine&apos;s progress bar.
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Use the slider to pick iteration count X between 10 and 30.</li>
          <li>Press <strong>Begin Race!</strong> to start JavaScript and WASM at the same time.</li>
          <li>Each progress strip has X sub-bars, one per Fibonacci number completed.</li>
          <li>Use <strong>Cancel</strong> to stop an active race, or <strong>Reset</strong> to clear the board.</li>
        </ul>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Game / Visualization</h2>

        <label className="flex flex-col gap-2 mb-4">
          <span className="font-semibold">Iterations (X): {iterations}</span>
          <input
            type="range"
            min={MIN_ITERATIONS}
            max={MAX_ITERATIONS}
            value={iterations}
            onChange={(event) => {
              const nextIterations = Number.parseInt(event.target.value, 10);
              setIterations(nextIterations);
              if (!isRunning) {
                resetProgress(nextIterations);
              }
            }}
            className="w-full"
            aria-label="Iteration count slider"
            disabled={isRunning}
          />
          <span className="text-sm text-slate-600">Higher values make recursion cost grow quickly.</span>
        </label>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            type="button"
            onClick={beginRace}
            disabled={isRunning}
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-emerald-300"
          >
            Begin Race!
          </button>
          <button
            type="button"
            onClick={cancelRace}
            disabled={!isRunning}
            className="px-4 py-2 rounded bg-red-700 text-white hover:bg-red-600 disabled:bg-red-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={resetRace}
            className="px-4 py-2 rounded bg-slate-800 text-white hover:bg-slate-700"
          >
            Reset
          </button>
        </div>

        {errorMessage ? <p className="mb-3 text-red-600">{errorMessage}</p> : null}

        <div className="grid grid-cols-1 gap-4">
          <StatusBar
            label="JavaScript"
            colorClassName="bg-orange-300"
            progress={jsProgress}
            elapsedMs={jsElapsedMs}
            running={isRunning}
          />
          <StatusBar
            label="WASM (Rust)"
            colorClassName="bg-cyan-400"
            progress={wasmProgress}
            elapsedMs={wasmElapsedMs}
            running={isRunning}
          />
        </div>

        {winnerMessage ? <p className="mt-4 font-semibold text-slate-800">{winnerMessage}</p> : null}
      </section>
    </main>
  );
}
