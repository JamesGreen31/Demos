'use client';

import { useMemo, useState } from 'react';

const DEFAULT_BUCKETS = 64;
const DEFAULT_KEYS = 1200;
const DEFAULT_SEED = 42;

function createGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function loadStats(loads) {
  const total = loads.reduce((sum, value) => sum + value, 0);
  const max = loads.reduce((current, value) => Math.max(current, value), 0);
  const min = loads.reduce((current, value) => Math.min(current, value), Number.POSITIVE_INFINITY);
  const used = loads.filter((value) => value > 0).length;

  return {
    max,
    min: Number.isFinite(min) ? min : 0,
    avg: total / loads.length,
    used,
  };
}

function runHashSim(bucketCount, keyCount, seed) {
  const random = createGenerator(seed);
  const classicLoads = Array(bucketCount).fill(0);
  const choiceLoads = Array(bucketCount).fill(0);

  for (let key = 0; key < keyCount; key += 1) {
    const classicBucket = Math.floor(random() * bucketCount);
    classicLoads[classicBucket] += 1;

    const first = Math.floor(random() * bucketCount);
    const second = Math.floor(random() * bucketCount);
    const pick = choiceLoads[first] <= choiceLoads[second] ? first : second;
    choiceLoads[pick] += 1;
  }

  return {
    classicLoads,
    choiceLoads,
    classicStats: loadStats(classicLoads),
    choiceStats: loadStats(choiceLoads),
  };
}

function BucketBars({ title, loads, colorClass }) {
  const peak = Math.max(...loads, 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="flex items-end gap-[2px] h-36">
        {loads.map((load, index) => (
          <div
            key={`${title}-${index}`}
            className={`flex-1 ${colorClass} rounded-t-sm`}
            style={{ height: `${(load / peak) * 100}%` }}
            title={`Bucket ${index}: ${load}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function LotteryHashDPPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [bucketCount, setBucketCount] = useState(DEFAULT_BUCKETS);
  const [keyCount, setKeyCount] = useState(DEFAULT_KEYS);
  const [seed, setSeed] = useState(DEFAULT_SEED);

  const { classicLoads, choiceLoads, classicStats, choiceStats } = useMemo(
    () => runHashSim(bucketCount, keyCount, seed),
    [bucketCount, keyCount, seed]
  );

  const resetAll = () => {
    setBucketCount(DEFAULT_BUCKETS);
    setKeyCount(DEFAULT_KEYS);
    setSeed(DEFAULT_SEED);
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

      <h1 className="text-3xl md:text-4xl font-bold text-center">Lottery Hash Demo</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">What is this called?</h2>
        <p className="text-slate-700 mb-3">
          The breakthrough idea is commonly called the <strong>Power of Two Choices</strong>. Instead of
          placing each key into one random bucket, we sample two random buckets and choose the less-loaded
          one.
        </p>
        <p className="text-slate-700">
          This demo names it <strong>Lottery Hashing</strong>: every key draws two lottery tickets (two random
          buckets), then keeps the better one. A tiny extra choice can dramatically reduce collisions and
          worst-case bucket spikes.
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to use</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Set how many buckets exist in the hash table.</li>
          <li>Set how many keys to insert.</li>
          <li>Change seed to rerun with a different random stream.</li>
          <li>Compare classic random hashing to Lottery Hashing side-by-side.</li>
        </ul>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Buckets: {bucketCount}</span>
            <input
              type="range"
              min="16"
              max="160"
              step="8"
              value={bucketCount}
              onChange={(event) => setBucketCount(Number.parseInt(event.target.value, 10))}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-semibold">Keys: {keyCount}</span>
            <input
              type="range"
              min="200"
              max="4000"
              step="100"
              value={keyCount}
              onChange={(event) => setKeyCount(Number.parseInt(event.target.value, 10))}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-semibold">Seed: {seed}</span>
            <input
              type="range"
              min="1"
              max="300"
              step="1"
              value={seed}
              onChange={(event) => setSeed(Number.parseInt(event.target.value, 10))}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={resetAll}
            className="px-4 py-2 rounded bg-slate-800 text-white hover:bg-slate-700"
          >
            Reset All
          </button>
        </div>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Game / Visualization</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <BucketBars title="Classic Random Hashing" loads={classicLoads} colorClass="bg-rose-400" />
          <BucketBars title="Lottery Hashing (2 Choices)" loads={choiceLoads} colorClass="bg-emerald-400" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-700">
          <div className="rounded-lg bg-rose-50 border border-rose-100 p-3">
            <h3 className="font-semibold">Classic stats</h3>
            <p>Max bucket load: {classicStats.max}</p>
            <p>Average load: {classicStats.avg.toFixed(2)}</p>
            <p>Used buckets: {classicStats.used}/{bucketCount}</p>
            <p>Min load: {classicStats.min}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
            <h3 className="font-semibold">Lottery stats</h3>
            <p>Max bucket load: {choiceStats.max}</p>
            <p>Average load: {choiceStats.avg.toFixed(2)}</p>
            <p>Used buckets: {choiceStats.used}/{bucketCount}</p>
            <p>Min load: {choiceStats.min}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
