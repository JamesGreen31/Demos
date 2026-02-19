'use client';

import { useEffect, useMemo, useState } from 'react';

const DEFAULT_CONFIG = {
  buckets: 96,
  slotsPerBucket: 2,
  choices: 3,
  keysToInsert: 170,
  seed: 42,
  strategy: 'bubble',
  showAnimation: true,
};

const MAX_RELOCATION_STEPS = 80;

function mix32(value) {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function createGenerator(seed) {
  let state = mix32(seed || 1);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 2 ** 32;
  };
}

function hashCandidate(key, i, seed, bucketCount) {
  return mix32((key + 1) * 0x9e3779b1 ^ (i + 1) * 0x85ebca6b ^ seed * 0xc2b2ae35) % bucketCount;
}

function uniqueCandidates(key, choiceCount, seed, bucketCount) {
  const seen = new Set();
  const result = [];
  let salt = 0;
  while (result.length < choiceCount && salt < choiceCount * 4 + 16) {
    const bucket = hashCandidate(key, result.length + salt, seed, bucketCount);
    if (!seen.has(bucket)) {
      seen.add(bucket);
      result.push(bucket);
    }
    salt += 1;
  }
  if (result.length === 0) {
    result.push(0);
  }
  return result;
}

function createTable(bucketCount, slotsPerBucket) {
  return Array.from({ length: bucketCount }, () => Array(slotsPerBucket).fill(null));
}

function hasFreeSlot(table, bucket) {
  return table[bucket].some((slot) => slot === null);
}

function placeInBucket(table, bucket, key) {
  const slotIndex = table[bucket].indexOf(null);
  if (slotIndex === -1) {
    return false;
  }
  table[bucket][slotIndex] = key;
  return true;
}

function occupancy(table) {
  return table.map((bucket) => bucket.filter((slot) => slot !== null).length);
}

function findBubblingPath(table, startBuckets, choiceCount, seed, bucketCount) {
  const queue = [...startBuckets];
  const visited = new Set(startBuckets);
  const parent = new Map();
  const visitedOrder = [...startBuckets];

  while (queue.length > 0 && visitedOrder.length <= MAX_RELOCATION_STEPS * 4) {
    const bucket = queue.shift();

    if (hasFreeSlot(table, bucket)) {
      return { freeBucket: bucket, parent, visitedOrder };
    }

    for (const key of table[bucket]) {
      const candidates = uniqueCandidates(key, choiceCount, seed, bucketCount);
      for (const altBucket of candidates) {
        if (altBucket === bucket || visited.has(altBucket)) {
          continue;
        }
        visited.add(altBucket);
        visitedOrder.push(altBucket);
        parent.set(altBucket, { from: bucket, key });
        queue.push(altBucket);
      }
    }
  }

  return null;
}

function insertKey(table, key, config, rng) {
  const { buckets, choices, seed, strategy } = config;
  const candidates = uniqueCandidates(key, choices, seed, buckets);

  for (const bucket of candidates) {
    if (placeInBucket(table, bucket, key)) {
      return { success: true, chainLength: 0, visited: [bucket], candidates };
    }
  }

  if (strategy === 'bubble') {
    const pathData = findBubblingPath(table, candidates, choices, seed, buckets);
    if (!pathData) {
      return { success: false, chainLength: MAX_RELOCATION_STEPS, visited: candidates, candidates };
    }

    const path = [];
    let cursor = pathData.freeBucket;
    while (pathData.parent.has(cursor)) {
      const edge = pathData.parent.get(cursor);
      path.push({ from: edge.from, to: cursor, key: edge.key });
      cursor = edge.from;
    }

    const root = cursor;
    for (let i = path.length - 1; i >= 0; i -= 1) {
      const { from, to, key: movingKey } = path[i];
      const slotIndex = table[from].indexOf(movingKey);
      table[from][slotIndex] = null;
      placeInBucket(table, to, movingKey);
    }
    placeInBucket(table, root, key);

    return {
      success: true,
      chainLength: path.length,
      visited: pathData.visitedOrder,
      candidates,
    };
  }

  let currentKey = key;
  let currentBucket = candidates[Math.floor(rng() * candidates.length)];
  const visited = [currentBucket];

  for (let step = 1; step <= MAX_RELOCATION_STEPS; step += 1) {
    const victimSlot = Math.floor(rng() * table[currentBucket].length);
    const victim = table[currentBucket][victimSlot];
    table[currentBucket][victimSlot] = currentKey;
    currentKey = victim;

    const nextCandidates = uniqueCandidates(currentKey, choices, seed, buckets).filter((bucket) => bucket !== currentBucket);
    if (nextCandidates.length === 0) {
      return { success: false, chainLength: step, visited, candidates };
    }

    currentBucket = nextCandidates[Math.floor(rng() * nextCandidates.length)];
    visited.push(currentBucket);

    if (placeInBucket(table, currentBucket, currentKey)) {
      return { success: true, chainLength: step, visited, candidates };
    }
  }

  return { success: false, chainLength: MAX_RELOCATION_STEPS, visited, candidates };
}

function runSimulation(config) {
  const rng = createGenerator(config.seed);
  const table = createTable(config.buckets, config.slotsPerBucket);
  const traces = [];
  const start = performance.now();

  let failures = 0;
  let chainTotal = 0;
  let chainMax = 0;
  let inserted = 0;

  for (let key = 0; key < config.keysToInsert; key += 1) {
    const result = insertKey(table, key, config, rng);
    traces.push({ ...result, key });
    chainTotal += result.chainLength;
    chainMax = Math.max(chainMax, result.chainLength);

    if (!result.success) {
      failures += 1;
      continue;
    }
    inserted += 1;
  }

  const durationMs = performance.now() - start;
  return {
    occupancy: occupancy(table),
    traces,
    inserted,
    failures,
    avgChain: config.keysToInsert === 0 ? 0 : chainTotal / config.keysToInsert,
    maxChain: chainMax,
    load: inserted / (config.buckets * config.slotsPerBucket),
    insertionsPerSecond: durationMs > 0 ? (config.keysToInsert / durationMs) * 1000 : 0,
  };
}


function OverlayOccupancyComparison({ withoutTechnique, withTechnique, slotsPerBucket }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold mb-2">Overlay occupancy comparison (same settings)</h3>
      <p className="text-sm text-slate-600 mb-3">
        Red = without technique (naive random-walk). Green = with technique (bubble-up-inspired).
      </p>
      <div className="rounded border border-slate-100 bg-slate-50 p-2">
        <div className="flex items-end gap-[2px] h-44">
          {withTechnique.map((withValue, index) => {
            const withoutValue = withoutTechnique[index] ?? 0;
            return (
              <div key={`overlay-${index}`} className="relative flex-1 h-full">
                <div
                  className="absolute bottom-0 inset-x-0 rounded-t-sm bg-rose-400/80"
                  style={{ height: `${(withoutValue / Math.max(slotsPerBucket, 1)) * 100}%` }}
                  title={`Bucket ${index} without technique: ${withoutValue}/${slotsPerBucket}`}
                />
                <div
                  className="absolute bottom-0 inset-x-0 rounded-t-sm bg-emerald-500/70"
                  style={{ height: `${(withValue / Math.max(slotsPerBucket, 1)) * 100}%` }}
                  title={`Bucket ${index} with technique: ${withValue}/${slotsPerBucket}`}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-700">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-rose-400" />Without technique</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-500" />With technique</span>
      </div>
    </div>
  );
}

function OccupancyBars({ loads, slotsPerBucket, highlighted }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold mb-3">Occupancy histogram (per bucket)</h3>
      <div className="flex items-end gap-[2px] h-44">
        {loads.map((value, index) => (
          <div
            key={`bucket-${index}`}
            className={`flex-1 rounded-t-sm ${highlighted.has(index) ? 'bg-indigo-500' : 'bg-emerald-400'}`}
            style={{ height: `${(value / Math.max(slotsPerBucket, 1)) * 100}%` }}
            title={`Bucket ${index}: ${value}/${slotsPerBucket}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function LotteryHashDPPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [traceIndex, setTraceIndex] = useState(0);
  const [animationStep, setAnimationStep] = useState(0);

  const sim = useMemo(() => runSimulation(config), [config]);
  const comparison = useMemo(() => {
    const shared = {
      buckets: config.buckets,
      slotsPerBucket: config.slotsPerBucket,
      choices: config.choices,
      keysToInsert: config.keysToInsert,
      seed: config.seed,
      showAnimation: false,
    };

    return {
      random: runSimulation({ ...shared, strategy: 'random' }),
      bubble: runSimulation({ ...shared, strategy: 'bubble' }),
    };
  }, [config.buckets, config.slotsPerBucket, config.choices, config.keysToInsert, config.seed]);

  const trace = useMemo(
    () => sim.traces[Math.min(traceIndex, sim.traces.length - 1)] || { visited: [], chainLength: 0, candidates: [] },
    [sim.traces, traceIndex]
  );

  const highlighted = useMemo(() => {
    if (!config.showAnimation) {
      return new Set(trace.visited);
    }
    return new Set(trace.visited.slice(0, Math.max(animationStep, 1)));
  }, [trace, animationStep, config.showAnimation]);

  useEffect(() => {
    setAnimationStep(0);
  }, [traceIndex, config.showAnimation, config.seed, config.strategy, config.keysToInsert]);

  useEffect(() => {
    if (!config.showAnimation || trace.visited.length <= 1) {
      return undefined;
    }

    const timer = setInterval(() => {
      setAnimationStep((previous) => {
        if (previous >= trace.visited.length) {
          return previous;
        }
        return previous + 1;
      });
    }, 220);

    return () => clearInterval(timer);
  }, [trace, config.showAnimation]);

  const resetAll = () => {
    setConfig(DEFAULT_CONFIG);
    setTraceIndex(0);
    setAnimationStep(0);
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

      <h1 className="text-3xl md:text-4xl font-bold text-center">High-Load d-ary Cuckoo Hashing Demo</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">What this demo shows</h2>
        <p className="text-slate-700 mb-3">
          This hash table has a fixed number of buckets, and each bucket has only a few slots. Every key gets a small
          list of candidate buckets. If all candidates are full, the table tries moving other keys to make room.
          Near full load, those moves get longer and some inserts fail.
        </p>
        <p className="text-slate-700 mb-3">
          This is different from balls-into-bins load balancing, where bins are treated like unbounded counters.
          Here we model finite-capacity hash-table placement and relocation behavior as load approaches <strong>1 − ε</strong>.
        </p>
        <p className="text-slate-700 mb-3">
          Key takeaway: simple random placement (or weak random eviction) starts failing earlier at high load, while
          structured relocation keeps inserts working longer. That is the practical point behind the 2025 high-load
          cuckoo hashing breakthrough.
        </p>

        <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer font-semibold text-slate-800">Technical explanation + key terms</summary>
          <div className="mt-3 text-slate-700 space-y-3">
            <p>
              We simulate d-ary cuckoo hashing with two insertion policies: a naive random-walk eviction chain and a
              bubble-up-inspired augmenting-path search. The structured search usually finds shorter chains and keeps
              failure lower at high load.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>N</strong>: number of buckets.</li>
              <li><strong>b</strong>: slots per bucket.</li>
              <li><strong>d</strong>: candidate buckets per key.</li>
              <li><strong>Load factor</strong>: inserted keys / (N × b).</li>
              <li><strong>Eviction chain</strong>: sequence of relocations needed to insert one key.</li>
              <li><strong>Failure</strong>: insertion that exceeds relocation step limit.</li>
              <li><strong>1 − ε high load</strong>: operating very close to full capacity.</li>
            </ul>
            <p>
              Reference: William Kuszmaul and Michael Mitzenmacher (2025),{' '}
              <a
                href="https://arxiv.org/abs/2501.02312"
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline"
              >
                Efficient d-ary Cuckoo Hashing at High Load Factors by Bubbling Up (arXiv:2501.02312)
              </a>
              .
            </p>
          </div>
        </details>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">What the visualization game is showing</h2>
        <p className="text-slate-700 mb-3">
          Think of each insertion as a small puzzle: can we place one more key using only its <strong>d</strong> candidate
          buckets? The chart and trace viewer show how hard that puzzle gets as the table fills.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-slate-700">
          <li>Green/indigo bars show per-bucket occupancy from 0 to <strong>b</strong> slots.</li>
          <li>The metrics show whether we are still inserting smoothly or hitting failures.</li>
          <li>
            The eviction-chain viewer shows the bucket path visited during one insertion attempt (a short chain is good,
            long chains signal high pressure).
          </li>
        </ul>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">How to play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Set <strong>N</strong>, <strong>b</strong>, <strong>d</strong>, and <strong>K</strong> to choose table pressure.</li>
          <li>
            Use <strong>Strategy</strong> to switch between naive random-walk eviction and bubble-up-inspired relocation.
          </li>
          <li>
            Check the <strong>Strategy snapshot</strong> card to see both strategies compared on the same settings.
          </li>
          <li>
            In <strong>Simulation Output</strong>, move the insertion trace slider to inspect a specific eviction chain.
          </li>
          <li>
            Push <strong>K</strong> toward <strong>N × b</strong> (or slightly above) to observe longer chains and failures.
          </li>
        </ul>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Strategy snapshot (same settings)</h2>
        <p className="text-slate-700 mb-3">
          This quick comparison uses the current N, b, d, K, and seed for both strategies so you can see why structured
          relocation matters more than random behavior near full load.
        </p>
        <OverlayOccupancyComparison
          withoutTechnique={comparison.random.occupancy}
          withTechnique={comparison.bubble.occupancy}
          slotsPerBucket={config.slotsPerBucket}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded border border-rose-200 bg-rose-50 p-4 text-slate-700">
            <h3 className="font-semibold mb-2">Naive random-walk eviction</h3>
            <p>Load: {comparison.random.load.toFixed(3)}</p>
            <p>Failures: {comparison.random.failures}</p>
            <p>Avg chain: {comparison.random.avgChain.toFixed(2)}</p>
            <p>Max chain: {comparison.random.maxChain}</p>
          </div>
          <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-slate-700">
            <h3 className="font-semibold mb-2">Bubble-up-inspired</h3>
            <p>Load: {comparison.bubble.load.toFixed(3)}</p>
            <p>Failures: {comparison.bubble.failures}</p>
            <p>Avg chain: {comparison.bubble.avgChain.toFixed(2)}</p>
            <p>Max chain: {comparison.bubble.maxChain}</p>
          </div>
        </div>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Buckets N: {config.buckets}</span>
            <input
              type="range"
              min="16"
              max="512"
              step="16"
              value={config.buckets}
              onChange={(event) => setConfig((value) => ({ ...value, buckets: Number.parseInt(event.target.value, 10) }))}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Slots per bucket b: {config.slotsPerBucket}</span>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={config.slotsPerBucket}
              onChange={(event) => setConfig((value) => ({ ...value, slotsPerBucket: Number.parseInt(event.target.value, 10) }))}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Choices per key d: {config.choices}</span>
            <input
              type="range"
              min="2"
              max="16"
              step="1"
              value={config.choices}
              onChange={(event) => setConfig((value) => ({ ...value, choices: Number.parseInt(event.target.value, 10) }))}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Keys to insert K: {config.keysToInsert}</span>
            <input
              type="range"
              min="32"
              max={Math.floor(config.buckets * config.slotsPerBucket * 1.1)}
              step="1"
              value={Math.min(config.keysToInsert, Math.floor(config.buckets * config.slotsPerBucket * 1.1))}
              onChange={(event) => setConfig((value) => ({ ...value, keysToInsert: Number.parseInt(event.target.value, 10) }))}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Seed: {config.seed}</span>
            <input
              type="range"
              min="1"
              max="300"
              step="1"
              value={config.seed}
              onChange={(event) => setConfig((value) => ({ ...value, seed: Number.parseInt(event.target.value, 10) }))}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Strategy</span>
            <select
              className="rounded border border-slate-300 px-2 py-2"
              value={config.strategy}
              onChange={(event) => setConfig((value) => ({ ...value, strategy: event.target.value }))}
            >
              <option value="random">Naive random-walk eviction</option>
              <option value="bubble">Bubble-up-inspired augmenting path</option>
            </select>
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-slate-700">
          <input
            type="checkbox"
            checked={config.showAnimation}
            onChange={(event) => setConfig((value) => ({ ...value, showAnimation: event.target.checked }))}
          />
          Show eviction animation
        </label>

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
        <h2 className="text-2xl font-semibold mb-4">Simulation Output</h2>
        <OccupancyBars loads={sim.occupancy} slotsPerBucket={config.slotsPerBucket} highlighted={highlighted} />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-slate-700 mt-4">
          <div className="rounded bg-emerald-50 border border-emerald-100 p-3">
            <p className="font-semibold">Load factor</p>
            <p>{sim.load.toFixed(3)}</p>
          </div>
          <div className="rounded bg-rose-50 border border-rose-100 p-3">
            <p className="font-semibold">Failures</p>
            <p>{sim.failures}</p>
          </div>
          <div className="rounded bg-indigo-50 border border-indigo-100 p-3">
            <p className="font-semibold">Avg chain</p>
            <p>{sim.avgChain.toFixed(2)}</p>
          </div>
          <div className="rounded bg-indigo-50 border border-indigo-100 p-3">
            <p className="font-semibold">Max chain</p>
            <p>{sim.maxChain}</p>
          </div>
          <div className="rounded bg-slate-50 border border-slate-200 p-3">
            <p className="font-semibold">Insertions/s</p>
            <p>{sim.insertionsPerSecond.toFixed(0)}</p>
          </div>
        </div>

        <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-semibold mb-2">Eviction chain viewer</h3>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-slate-700">Insertion trace index: {traceIndex}</span>
            <input
              type="range"
              min="0"
              max={Math.max(sim.traces.length - 1, 0)}
              value={Math.min(traceIndex, Math.max(sim.traces.length - 1, 0))}
              onChange={(event) => setTraceIndex(Number.parseInt(event.target.value, 10))}
            />
          </label>
          <p className="text-slate-700 mt-2">
            Key #{trace.key ?? 0} · success: {trace.success ? 'yes' : 'no'} · chain length: {trace.chainLength}
          </p>
          <p className="text-sm text-slate-600 mt-1">
            Candidates: {trace.candidates?.join(', ') || 'n/a'} · visited buckets: {trace.visited?.join(' → ') || 'n/a'}
          </p>
        </div>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to implement</h2>
        <ul className="list-disc pl-6 text-slate-700 space-y-1">
          <li>Store a table as <code>buckets[N][b]</code>, where each slot is empty or contains a key id.</li>
          <li>For each key, compute <code>d</code> candidate buckets with seeded hash functions and mod by <code>N</code>.</li>
          <li>
            Insertion: place directly if any candidate has free space; otherwise run relocation (random walk or
            augmenting-path search) with a max-step cutoff.
          </li>
          <li>Track and display load factor, failures, average/max chain length, and throughput.</li>
          <li>Use a seeded PRNG so changing only strategy keeps runs reproducible.</li>
        </ul>
      </section>
    </main>
  );
}
