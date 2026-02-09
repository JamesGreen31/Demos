'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const MIN_ITERATIONS = 30;
const MAX_ITERATIONS = 45;
const DEFAULT_ITERATIONS = 36;
const TIMED_RACE_DURATION_MS = 30_000;
const TIMED_BATCH_SIZE_OPTIONS = [1, 100, 10_000, 1_000_000];
const TIMED_UI_UPDATE_OPTIONS = [16, 100, 250];

function buildProgressList(iterations) {
  return Array.from({ length: iterations }, () => false);
}

function formatElapsed(elapsedMs) {
  if (elapsedMs === null) {
    return null;
  }

  if (elapsedMs >= 1000) {
    return `${(elapsedMs / 1000).toFixed(2)} s`;
  }

  return `${elapsedMs.toFixed(1)} ms`;
}


function formatSteps(stepsCompleted) {
  if (stepsCompleted === null) {
    return null;
  }

  return stepsCompleted.toLocaleString();
}

function buildPercentDiffMessage(firstValue, secondValue, firstLabel, secondLabel, metricName, lowerWins = true) {
  if (firstValue === null || secondValue === null || firstValue === secondValue) {
    return `No % difference for ${metricName}; both results are tied.`;
  }

  const winner = lowerWins
    ? firstValue < secondValue
      ? firstLabel
      : secondLabel
    : firstValue > secondValue
      ? firstLabel
      : secondLabel;

  if (typeof firstValue === 'bigint' || typeof secondValue === 'bigint') {
    const firstBig = BigInt(firstValue);
    const secondBig = BigInt(secondValue);
    const difference = firstBig > secondBig ? firstBig - secondBig : secondBig - firstBig;
    const base = firstBig > secondBig ? firstBig : secondBig;
    const scaledPercent = Number((difference * 10_000n) / base) / 100;
    return `${winner} leads by ${scaledPercent.toFixed(2)}% in ${metricName}.`;
  }

  const percentDiff = (Math.abs(firstValue - secondValue) / Math.max(firstValue, secondValue)) * 100;
  return `${winner} leads by ${percentDiff.toFixed(2)}% in ${metricName}.`;
}

function StatusBar({ label, colorClassName, progress, elapsedMs, running }) {
  const completedCount = progress.filter(Boolean).length;

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap justify-between gap-2 mb-3">
        <h3 className="text-lg font-semibold">{label}</h3>
        <span className="text-sm text-slate-700">
          {completedCount}/{progress.length} complete
          {elapsedMs !== null ? ` • ${formatElapsed(elapsedMs)}` : running ? ' • Running...' : ''}
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

  const [timedRaceStatus, setTimedRaceStatus] = useState('idle');
  const [timedErrorMessage, setTimedErrorMessage] = useState('');
  const [jsNativeTimedStepsCompleted, setJsNativeTimedStepsCompleted] = useState(null);
  const [jsOptimizedTimedStepsCompleted, setJsOptimizedTimedStepsCompleted] = useState(null);
  const [wasmTimedStepsCompleted, setWasmTimedStepsCompleted] = useState(null);
  const [timedBatchSize, setTimedBatchSize] = useState(10_000);
  const [timedUiUpdateMs, setTimedUiUpdateMs] = useState(100);
  const [jsNativeTimedElapsedMs, setJsNativeTimedElapsedMs] = useState(null);
  const [jsOptimizedTimedElapsedMs, setJsOptimizedTimedElapsedMs] = useState(null);
  const [wasmTimedElapsedMs, setWasmTimedElapsedMs] = useState(null);
  const [jsNativeTimedDone, setJsNativeTimedDone] = useState(false);
  const [jsOptimizedTimedDone, setJsOptimizedTimedDone] = useState(false);
  const [wasmTimedDone, setWasmTimedDone] = useState(false);
  const [timedRaceStartedAt, setTimedRaceStartedAt] = useState(null);
  const [timedRaceRemainingMs, setTimedRaceRemainingMs] = useState(TIMED_RACE_DURATION_MS);

  const jsWorkerRef = useRef(null);
  const wasmWorkerRef = useRef(null);
  const jsNativeTimedWorkerRef = useRef(null);
  const jsOptimizedTimedWorkerRef = useRef(null);
  const wasmTimedWorkerRef = useRef(null);

  const isRunning = raceStatus === 'running';
  const isDone = raceStatus === 'done';
  const isTimedRunning = timedRaceStatus === 'running';
  const isTimedDone = timedRaceStatus === 'done';

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

  const percentDiffMessage = useMemo(() => {
    if (!isDone || jsElapsedMs === null || wasmElapsedMs === null) {
      return '';
    }

    return buildPercentDiffMessage(jsElapsedMs, wasmElapsedMs, 'JavaScript', 'WASM', 'speed');
  }, [isDone, jsElapsedMs, wasmElapsedMs]);

  const timedResults = useMemo(() => {
    const racers = [
      { label: 'Native JS', stepsCompleted: jsNativeTimedStepsCompleted },
      { label: 'Optimized JS', stepsCompleted: jsOptimizedTimedStepsCompleted },
      { label: 'WebAssembly', stepsCompleted: wasmTimedStepsCompleted },
    ];

    return racers.filter((racer) => racer.stepsCompleted !== null);
  }, [jsNativeTimedStepsCompleted, jsOptimizedTimedStepsCompleted, wasmTimedStepsCompleted]);

  const timedWinnerMessage = useMemo(() => {
    if (!isTimedDone || timedResults.length !== 3) {
      return '';
    }

    const sorted = [...timedResults].sort((a, b) => Number(b.stepsCompleted - a.stepsCompleted));
    if (sorted[0].stepsCompleted === sorted[2].stepsCompleted) {
      return 'Timed race tie! All three implementations completed the same number of steps.';
    }

    return `${sorted[0].label} completed the most recurrence steps in 30 seconds.`;
  }, [isTimedDone, timedResults]);

  const timedInterpretationMessage = useMemo(() => {
    if (!isTimedDone || timedResults.length !== 3) {
      return '';
    }

    const sorted = [...timedResults].sort((a, b) => Number(b.stepsCompleted - a.stepsCompleted));
    if (sorted[0].stepsCompleted === sorted[2].stepsCompleted) {
      return 'All three implementations produced the same throughput in this run, so there is no runtime winner to interpret.';
    }

    return `${sorted[0].label} completed more recurrence steps because this workload is CPU-bound and consists of simple integer operations. WebAssembly executes compiled machine code, while JavaScript executes dynamically-typed operations with runtime checks.`;
  }, [isTimedDone, timedResults]);

  const timedPercentDiffMessage = useMemo(() => {
    if (!isTimedDone || timedResults.length !== 3) {
      return '';
    }

    const sorted = [...timedResults].sort((a, b) => Number(b.stepsCompleted - a.stepsCompleted));
    return buildPercentDiffMessage(sorted[0].stepsCompleted, sorted[1].stepsCompleted, sorted[0].label, sorted[1].label, 'steps completed', false);
  }, [isTimedDone, timedResults]);

  const timedRaceProgressPercent = useMemo(() => {
    const elapsedMs = TIMED_RACE_DURATION_MS - timedRaceRemainingMs;
    return Math.min(100, Math.max(0, (elapsedMs / TIMED_RACE_DURATION_MS) * 100));
  }, [timedRaceRemainingMs]);

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

  const stopTimedWorkers = () => {
    if (jsNativeTimedWorkerRef.current) {
      jsNativeTimedWorkerRef.current.terminate();
      jsNativeTimedWorkerRef.current = null;
    }

    if (jsOptimizedTimedWorkerRef.current) {
      jsOptimizedTimedWorkerRef.current.terminate();
      jsOptimizedTimedWorkerRef.current = null;
    }

    if (wasmTimedWorkerRef.current) {
      wasmTimedWorkerRef.current.terminate();
      wasmTimedWorkerRef.current = null;
    }
  };

  const resetProgress = (nextIterations = iterations) => {
    setJsProgress(buildProgressList(nextIterations));
    setWasmProgress(buildProgressList(nextIterations));
    setJsElapsedMs(null);
    setWasmElapsedMs(null);
    setErrorMessage('');
  };

  const resetTimedRace = () => {
    setJsNativeTimedStepsCompleted(null);
    setJsOptimizedTimedStepsCompleted(null);
    setWasmTimedStepsCompleted(null);
    setJsNativeTimedElapsedMs(null);
    setJsOptimizedTimedElapsedMs(null);
    setWasmTimedElapsedMs(null);
    setTimedErrorMessage('');
    setJsNativeTimedDone(false);
    setJsOptimizedTimedDone(false);
    setWasmTimedDone(false);
    setTimedRaceStartedAt(null);
    setTimedRaceRemainingMs(TIMED_RACE_DURATION_MS);
  };

  useEffect(() => {
    return () => {
      stopWorkers();
      stopTimedWorkers();
    };
  }, []);

  useEffect(() => {
    if (jsElapsedMs !== null && wasmElapsedMs !== null) {
      setRaceStatus('done');
    }
  }, [jsElapsedMs, wasmElapsedMs]);

  useEffect(() => {
    if (jsNativeTimedDone && jsOptimizedTimedDone && wasmTimedDone) {
      setTimedRaceStatus('done');
    }
  }, [jsNativeTimedDone, jsOptimizedTimedDone, wasmTimedDone]);

  useEffect(() => {
    if (!isTimedRunning || timedRaceStartedAt === null) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const elapsedMs = Date.now() - timedRaceStartedAt;
      const nextRemainingMs = Math.max(0, TIMED_RACE_DURATION_MS - elapsedMs);
      setTimedRaceRemainingMs(nextRemainingMs);

      if (nextRemainingMs === 0) {
        window.clearInterval(intervalId);
      }
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [isTimedRunning, timedRaceStartedAt]);

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

  const beginTimedRace = () => {
    stopTimedWorkers();
    resetTimedRace();
    setTimedRaceStatus('running');
    const startedAt = Date.now();
    setTimedRaceStartedAt(startedAt);
    setTimedRaceRemainingMs(TIMED_RACE_DURATION_MS);

    const jsNativeWorker = new Worker(new URL('./jsWorker.js', import.meta.url));
    const jsOptimizedWorker = new Worker(new URL('./jsWorker.js', import.meta.url));
    const wasmWorker = new Worker(new URL('./wasmWorker.js', import.meta.url));

    jsNativeTimedWorkerRef.current = jsNativeWorker;
    jsOptimizedTimedWorkerRef.current = jsOptimizedWorker;
    wasmTimedWorkerRef.current = wasmWorker;

    jsNativeWorker.onmessage = (event) => {
      const data = event.data || {};

      if (data.type === 'timedProgress') {
        setJsNativeTimedStepsCompleted(data.stepsCompleted);
        setJsNativeTimedElapsedMs(data.elapsedMs);
      }

      if (data.type === 'timedDone') {
        setJsNativeTimedStepsCompleted(data.stepsCompleted);
        setJsNativeTimedElapsedMs(data.elapsedMs);
        setJsNativeTimedDone(true);
      }
    };

    jsOptimizedWorker.onmessage = (event) => {
      const data = event.data || {};

      if (data.type === 'timedProgress') {
        setJsOptimizedTimedStepsCompleted(data.stepsCompleted);
        setJsOptimizedTimedElapsedMs(data.elapsedMs);
      }

      if (data.type === 'timedDone') {
        setJsOptimizedTimedStepsCompleted(data.stepsCompleted);
        setJsOptimizedTimedElapsedMs(data.elapsedMs);
        setJsOptimizedTimedDone(true);
      }
    };

    wasmWorker.onmessage = (event) => {
      const data = event.data || {};

      if (data.type === 'timedProgress') {
        setWasmTimedStepsCompleted(data.stepsCompleted);
        setWasmTimedElapsedMs(data.elapsedMs);
      }

      if (data.type === 'timedDone') {
        setWasmTimedStepsCompleted(data.stepsCompleted);
        setWasmTimedElapsedMs(data.elapsedMs);
        setWasmTimedDone(true);
      }

      if (data.type === 'error') {
        setTimedErrorMessage(data.message || 'Unexpected WASM worker failure');
        setTimedRaceStatus('idle');
        stopTimedWorkers();
      }
    };

    jsNativeWorker.postMessage({
      type: 'startTimed',
      durationMs: TIMED_RACE_DURATION_MS,
      batchSize: timedBatchSize,
      uiUpdateMs: timedUiUpdateMs,
      jsTimedMode: 'naive',
    });
    jsOptimizedWorker.postMessage({
      type: 'startTimed',
      durationMs: TIMED_RACE_DURATION_MS,
      batchSize: timedBatchSize,
      uiUpdateMs: timedUiUpdateMs,
      jsTimedMode: 'optimized',
    });
    wasmWorker.postMessage({
      type: 'startTimed',
      wasmUrl,
      durationMs: TIMED_RACE_DURATION_MS,
      batchSize: timedBatchSize,
      uiUpdateMs: timedUiUpdateMs,
    });
  };

  const timedUiModeLabel = timedUiUpdateMs === 16 ? 'Per ~16ms (animation frame)' : `Every ${timedUiUpdateMs}ms`;

  const cancelTimedRace = () => {
    stopTimedWorkers();
    setTimedRaceStatus('idle');
    setTimedRaceStartedAt(null);
  };

  const clearTimedRace = () => {
    stopTimedWorkers();
    setTimedRaceStatus('idle');
    resetTimedRace();
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
          <li>Use the slider to pick iteration count X between 30 and 45.</li>
          <li>Press <strong>Begin Race!</strong> to start JavaScript and WASM at the same time.</li>
          <li>Each progress strip has X sub-bars, one per Fibonacci number completed.</li>
          <li>Use <strong>Cancel</strong> to stop an active race, or <strong>Reset</strong> to clear the board.</li>
        </ul>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Part 1: Iteration Race</h2>

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
              if (!isRunning && !isTimedRunning) {
                resetProgress(nextIterations);
              }
            }}
            className="w-full"
            aria-label="Iteration count slider"
            disabled={isRunning || isTimedRunning}
          />
          <span className="text-sm text-slate-600">Higher values make recursion cost grow quickly.</span>
        </label>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            type="button"
            onClick={beginRace}
            disabled={isRunning || isTimedRunning}
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
        {percentDiffMessage ? <p className="mt-2 text-slate-700">{percentDiffMessage}</p> : null}
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Part 2: 30-Second Endurance Race</h2>
        <p className="text-slate-700 mb-3">
          <span className="font-semibold">What is Phase 2 measuring?</span> Phase 2 is not measuring the size of Fibonacci numbers.
          Instead, it measures how many times each runtime can execute a small, dependent computation in a fixed time window.
          Each &ldquo;step&rdquo; represents one update of the Fibonacci recurrence: <code className="rounded bg-slate-100 px-1">prev, curr &rarr; curr, prev + curr (mod 2&sup3;&sup2;)</code>.
          The values intentionally overflow 32-bit integers, so numeric correctness is irrelevant. The goal is to measure computational throughput &mdash; how many operations the runtime can perform per second.
          This is effectively a CPU-bound workload similar to physics simulation, cryptography, or numerical processing.
        </p>
        <p className="text-slate-700 mb-4">
          Runs 30 seconds of throughput-oriented Fibonacci progression for Native JS, Optimized JS, and WASM. Batch size controls how much computation happens before each worker reports progress, while UI update frequency controls how often those progress messages are surfaced to the page.
        </p>

        <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <p className="text-sm font-semibold text-slate-800 mb-2">What is a &ldquo;step&rdquo;?</p>
          <p className="text-sm text-slate-700 mb-2">
            A step is one update of the Fibonacci state: <code className="rounded bg-white px-1">(prev, curr) &rarr; (curr, prev + curr mod 2&sup3;&sup2;)</code>.
            We count how many updates can be performed in 30 seconds.
          </p>
          <details className="text-sm text-slate-700">
            <summary className="cursor-pointer font-semibold text-slate-800">More detail</summary>
            <p className="mt-2">
              We are not measuring the numeric value of Fibonacci numbers because they overflow quickly.
              Instead, we measure how many operations the runtime can execute.
              Think of a step as a single unit of computational work.
            </p>
          </details>
        </div>

        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm font-semibold text-slate-800 mb-1">What is Phase 2 measuring?</p>
          <p className="text-sm text-slate-700">Throughput over a fixed 30-second window, not Fibonacci number magnitude.</p>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            type="button"
            onClick={beginTimedRace}
            disabled={isTimedRunning || isRunning}
            className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-300"
          >
            Start 30s Race
          </button>
          <button
            type="button"
            onClick={cancelTimedRace}
            disabled={!isTimedRunning}
            className="px-4 py-2 rounded bg-red-700 text-white hover:bg-red-600 disabled:bg-red-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={clearTimedRace}
            className="px-4 py-2 rounded bg-slate-800 text-white hover:bg-slate-700"
          >
            Reset
          </button>
        </div>

        {timedErrorMessage ? <p className="mb-3 text-red-600">{timedErrorMessage}</p> : null}


        <div className="mb-4 grid md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-semibold" title="Controls how much work is done before the worker reports progress.

Small batches emphasize JavaScript↔WebAssembly call overhead.
Large batches emphasize raw computation speed.

This demonstrates an important property of WebAssembly:

• Small tasks → JavaScript competitive
• Large compute loops → WebAssembly faster">Batch size (iterations per call)</span>
            <select
              value={timedBatchSize}
              onChange={(event) => setTimedBatchSize(Number.parseInt(event.target.value, 10))}
              className="rounded border border-slate-300 px-3 py-2 bg-white"
              disabled={isTimedRunning || isRunning}
            >
              {TIMED_BATCH_SIZE_OPTIONS.map((batchSizeOption) => (
                <option key={batchSizeOption} value={batchSizeOption}>
                  {batchSizeOption.toLocaleString()}
                </option>
              ))}
            </select>
            <span className="text-sm text-slate-600">Hover the label for why batch sizing changes JS↔WASM behavior.</span>
          </label>


          <label className="flex flex-col gap-2">
            <span className="font-semibold" title="UI update frequency (worker progress reports)

Controls how often each racer posts progress back to the page.

Faster updates improve animation smoothness but add messaging overhead.
Slower updates reduce overhead and can slightly improve measured throughput.

Use this to see the trade-off between observability and benchmark purity.">UI update frequency</span>
            <select
              value={timedUiUpdateMs}
              onChange={(event) => setTimedUiUpdateMs(Number.parseInt(event.target.value, 10))}
              className="rounded border border-slate-300 px-3 py-2 bg-white"
              disabled={isTimedRunning || isRunning}
            >
              {TIMED_UI_UPDATE_OPTIONS.map((uiOption) => (
                <option key={uiOption} value={uiOption}>
                  {uiOption === 16 ? 'Per ~16ms' : `Every ${uiOption}ms`}
                </option>
              ))}
            </select>
            <span className="text-sm text-slate-600">Hover the label to understand the throughput vs responsiveness trade-off. Current mode: {timedUiModeLabel}.</span>
          </label>
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-100 p-3">
          <div className="mb-2 flex items-center justify-between text-sm text-slate-700">
            <span className="font-semibold">Race timer</span>
            <span>{(timedRaceRemainingMs / 1000).toFixed(1)}s left</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-500 transition-[width] duration-150 ease-linear"
              style={{ width: `${timedRaceProgressPercent}%` }}
              role="progressbar"
              aria-label="30-second race timer"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Number.parseFloat(timedRaceProgressPercent.toFixed(1))}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-lg font-semibold mb-1">Native JS</h3>
            <p className="text-slate-700">Steps completed: {formatSteps(jsNativeTimedStepsCompleted) ?? (isTimedRunning ? 'Running...' : '-')}</p>
            <p className="text-slate-600 text-sm">Elapsed: {formatElapsed(jsNativeTimedElapsedMs) ?? '-'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-lg font-semibold mb-1">Optimized JS</h3>
            <p className="text-slate-700">Steps completed: {formatSteps(jsOptimizedTimedStepsCompleted) ?? (isTimedRunning ? 'Running...' : '-')}</p>
            <p className="text-slate-600 text-sm">Elapsed: {formatElapsed(jsOptimizedTimedElapsedMs) ?? '-'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-lg font-semibold mb-1">WASM (Rust)</h3>
            <p className="text-slate-700">Steps completed: {formatSteps(wasmTimedStepsCompleted) ?? (isTimedRunning ? 'Running...' : '-')}</p>
            <p className="text-slate-600 text-sm">Elapsed: {formatElapsed(wasmTimedElapsedMs) ?? '-'}</p>
          </div>
        </div>

        {timedWinnerMessage ? <p className="mt-4 font-semibold text-slate-800">{timedWinnerMessage}</p> : null}
        {timedPercentDiffMessage ? <p className="mt-2 text-slate-700">{timedPercentDiffMessage}</p> : null}
        {timedInterpretationMessage ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-slate-800 mb-2">Interpretation</p>
            <p className="text-slate-700 mb-2">{timedInterpretationMessage}</p>
            <p className="text-slate-700 mb-2">
              This result does not mean WebAssembly is always faster. For UI logic, event handling, and small tasks JavaScript may perform similarly or better.
            </p>
            <p className="text-slate-700">
              WebAssembly shows its advantage when performing large amounts of numerical computation.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
