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


function formatPosition(position) {
  if (position === null) {
    return null;
  }

  return position.toLocaleString();
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
  const [jsTimedPosition, setJsTimedPosition] = useState(null);
  const [wasmTimedPosition, setWasmTimedPosition] = useState(null);
  const [timedBatchSize, setTimedBatchSize] = useState(10_000);
  const [timedUiUpdateMs, setTimedUiUpdateMs] = useState(100);
  const [jsTimedElapsedMs, setJsTimedElapsedMs] = useState(null);
  const [wasmTimedElapsedMs, setWasmTimedElapsedMs] = useState(null);
  const [jsTimedDone, setJsTimedDone] = useState(false);
  const [wasmTimedDone, setWasmTimedDone] = useState(false);
  const [timedRaceStartedAt, setTimedRaceStartedAt] = useState(null);
  const [timedRaceRemainingMs, setTimedRaceRemainingMs] = useState(TIMED_RACE_DURATION_MS);

  const jsWorkerRef = useRef(null);
  const wasmWorkerRef = useRef(null);
  const jsTimedWorkerRef = useRef(null);
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

  const timedWinnerMessage = useMemo(() => {
    if (!isTimedDone || jsTimedPosition === null || wasmTimedPosition === null) {
      return '';
    }

    if (jsTimedPosition === wasmTimedPosition) {
      return 'Timed race tie! Both implementations reached the same Fibonacci position.';
    }

    return jsTimedPosition > wasmTimedPosition
      ? 'JavaScript reached a farther Fibonacci position in 30 seconds.'
      : 'WASM reached a farther Fibonacci position in 30 seconds.';
  }, [isTimedDone, jsTimedPosition, wasmTimedPosition]);

  const timedPercentDiffMessage = useMemo(() => {
    if (!isTimedDone || jsTimedPosition === null || wasmTimedPosition === null) {
      return '';
    }

    return buildPercentDiffMessage(jsTimedPosition, wasmTimedPosition, 'JavaScript', 'WASM', 'position', false);
  }, [isTimedDone, jsTimedPosition, wasmTimedPosition]);

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
    if (jsTimedWorkerRef.current) {
      jsTimedWorkerRef.current.terminate();
      jsTimedWorkerRef.current = null;
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
    setJsTimedPosition(null);
    setWasmTimedPosition(null);
    setJsTimedElapsedMs(null);
    setWasmTimedElapsedMs(null);
    setTimedErrorMessage('');
    setJsTimedDone(false);
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
    if (jsTimedDone && wasmTimedDone) {
      setTimedRaceStatus('done');
    }
  }, [jsTimedDone, wasmTimedDone]);

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

    const jsWorker = new Worker(new URL('./jsWorker.js', import.meta.url));
    const wasmWorker = new Worker(new URL('./wasmWorker.js', import.meta.url));

    jsTimedWorkerRef.current = jsWorker;
    wasmTimedWorkerRef.current = wasmWorker;

    jsWorker.onmessage = (event) => {
      const data = event.data || {};

      if (data.type === 'timedProgress') {
        setJsTimedPosition(data.position);
        setJsTimedElapsedMs(data.elapsedMs);
      }

      if (data.type === 'timedDone') {
        setJsTimedPosition(data.position);
        setJsTimedElapsedMs(data.elapsedMs);
        setJsTimedDone(true);
      }
    };

    wasmWorker.onmessage = (event) => {
      const data = event.data || {};

      if (data.type === 'timedProgress') {
        setWasmTimedPosition(data.position);
        setWasmTimedElapsedMs(data.elapsedMs);
      }

      if (data.type === 'timedDone') {
        setWasmTimedPosition(data.position);
        setWasmTimedElapsedMs(data.elapsedMs);
        setWasmTimedDone(true);
      }

      if (data.type === 'error') {
        setTimedErrorMessage(data.message || 'Unexpected WASM worker failure');
        setTimedRaceStatus('idle');
        stopTimedWorkers();
      }
    };

    jsWorker.postMessage({
      type: 'startTimed',
      durationMs: TIMED_RACE_DURATION_MS,
      batchSize: timedBatchSize,
      uiUpdateMs: timedUiUpdateMs,
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
        <p className="text-slate-700 mb-4">
          Runs 30 seconds of throughput-oriented Fibonacci progression in both JS and WASM. Each engine reports the Fibonacci index position reached, and updates batch many iterations before crossing thread/runtime boundaries.
        </p>

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
            <span className="font-semibold">Batch size (iterations per call)</span>
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
            <span className="text-sm text-slate-600">Small batches emphasize JS↔WASM call overhead; larger batches emphasize raw compute throughput.</span>
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-semibold">UI update frequency</span>
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
            <span className="text-sm text-slate-600">Current mode: {timedUiModeLabel}.</span>
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

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-lg font-semibold mb-1">JavaScript</h3>
            <p className="text-slate-700">Position reached: {formatPosition(jsTimedPosition) ?? (isTimedRunning ? 'Running...' : '-')}</p>
            <p className="text-slate-600 text-sm">Elapsed: {formatElapsed(jsTimedElapsedMs) ?? '-'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-lg font-semibold mb-1">WASM (Rust)</h3>
            <p className="text-slate-700">Position reached: {formatPosition(wasmTimedPosition) ?? (isTimedRunning ? 'Running...' : '-')}</p>
            <p className="text-slate-600 text-sm">Elapsed: {formatElapsed(wasmTimedElapsedMs) ?? '-'}</p>
          </div>
        </div>

        {timedWinnerMessage ? <p className="mt-4 font-semibold text-slate-800">{timedWinnerMessage}</p> : null}
        {timedPercentDiffMessage ? <p className="mt-2 text-slate-700">{timedPercentDiffMessage}</p> : null}
      </section>
    </main>
  );
}
