'use client';

import { useMemo, useState } from 'react';

const DEFAULT_BUCKETS = 64;
const DEFAULT_KEYS = 1200;
const DEFAULT_SEED = 42;
const DEFAULT_GAME_ROUNDS = 20;

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

function pickHumanRandom(random, bucketCount, previousPick, keyIndex) {
  let pick = Math.floor(random() * bucketCount);

  if (pick === previousPick) {
    pick = (pick + Math.floor(bucketCount / 3)) % bucketCount;
  }

  if (keyIndex % 4 === 0) {
    pick = Math.floor((pick + Math.floor(bucketCount * 0.11)) % bucketCount);
  }

  if (pick % 2 === 1 && random() > 0.5) {
    pick -= 1;
  }

  return Math.max(0, Math.min(bucketCount - 1, pick));
}

function runHashSim(bucketCount, keyCount, seed) {
  const random = createGenerator(seed);
  const classicLoads = Array(bucketCount).fill(0);
  const humanLoads = Array(bucketCount).fill(0);
  const choiceLoads = Array(bucketCount).fill(0);
  let previousHumanPick = -1;

  for (let key = 0; key < keyCount; key += 1) {
    const classicBucket = Math.floor(random() * bucketCount);
    classicLoads[classicBucket] += 1;

    const humanBucket = pickHumanRandom(random, bucketCount, previousHumanPick, key);
    humanLoads[humanBucket] += 1;
    previousHumanPick = humanBucket;

    const luckyA = Math.floor(random() * bucketCount);
    const luckyB = Math.floor(random() * bucketCount);
    const luckyPick = choiceLoads[luckyA] <= choiceLoads[luckyB] ? luckyA : luckyB;
    choiceLoads[luckyPick] += 1;
  }

  return {
    classicLoads,
    humanLoads,
    choiceLoads,
    classicStats: loadStats(classicLoads),
    humanStats: loadStats(humanLoads),
    choiceStats: loadStats(choiceLoads),
  };
}

function simulateRoundChoices(bucketCount, roundCount, seed) {
  const random = createGenerator(seed);
  const rounds = [];
  for (let round = 0; round < roundCount; round += 1) {
    rounds.push([
      Math.floor(random() * bucketCount),
      Math.floor(random() * bucketCount),
    ]);
  }
  return rounds;
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
            title={`Lucky bucket ${index}: ${load}`}
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
  const [gameRound, setGameRound] = useState(0);
  const [userLoads, setUserLoads] = useState(() => Array(DEFAULT_BUCKETS).fill(0));
  const [score, setScore] = useState(0);

  const { classicLoads, humanLoads, choiceLoads, classicStats, humanStats, choiceStats } = useMemo(
    () => runHashSim(bucketCount, keyCount, seed),
    [bucketCount, keyCount, seed]
  );

  const gameChoices = useMemo(
    () => simulateRoundChoices(bucketCount, DEFAULT_GAME_ROUNDS, seed + 777),
    [bucketCount, seed]
  );

  const currentChoices = gameChoices[Math.min(gameRound, DEFAULT_GAME_ROUNDS - 1)] ?? [0, 1];

  const resetGame = () => {
    setGameRound(0);
    setUserLoads(Array(bucketCount).fill(0));
    setScore(0);
  };

  const resetAll = () => {
    setBucketCount(DEFAULT_BUCKETS);
    setKeyCount(DEFAULT_KEYS);
    setSeed(DEFAULT_SEED);
    setGameRound(0);
    setUserLoads(Array(DEFAULT_BUCKETS).fill(0));
    setScore(0);
  };

  const chooseLuckyBucket = (bucketIndex) => {
    if (gameRound >= DEFAULT_GAME_ROUNDS) {
      return;
    }

    const [luckyA, luckyB] = currentChoices;

    setUserLoads((previousLoads) => {
      const nextLoads = [...previousLoads];
      const betterPick = previousLoads[luckyA] <= previousLoads[luckyB] ? luckyA : luckyB;
      if (bucketIndex === betterPick) {
        setScore((previousScore) => previousScore + 1);
      }
      nextLoads[bucketIndex] += 1;
      return nextLoads;
    });

    setGameRound((previousRound) => previousRound + 1);
  };

  const userStats = loadStats(userLoads);

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

      <h1 className="text-3xl md:text-4xl font-bold text-center">Power of Two Choicss Demo</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">Traditional description</h2>
        <p className="text-slate-700 mb-3">
          Think of each hash slot as a <strong>lucky bucket</strong>. Standard hashing tosses each key into one
          random bucket. Power-of-two hashing gives each key two random lucky buckets and picks the one with
          less traffic.
        </p>
        <p className="text-slate-700">
          That tiny decision makes heavy collision spikes far less likely. We keep the playful name
          <strong> Lucky Bucket Draw</strong> in this DP while using the formal computer science term too.
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Set how many lucky buckets exist in the hash table.</li>
          <li>Set how many keys to insert for the large simulation.</li>
          <li>Change seed to rerun with a different pseudo-random stream.</li>
          <li>Compare Standard Random, Human Random, and Lucky Bucket Draw (power of two choices).</li>
          <li>In the mini-game, pick between two lucky buckets and try to beat your own balancing score.</li>
        </ul>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">Technical explanation</h2>
        <p className="text-slate-700 mb-3">
          In classic balls-into-bins hashing, the heaviest bucket grows with about
          <strong> log n / log log n</strong>. With the power of two choices, the maximum load collapses to about
          <strong> log log n</strong> (plus a small constant), which is an exponential improvement in tail behavior.
          In practice this means fewer pathological hot buckets, lower lock contention, and tighter latency
          distributions under high throughput.
        </p>
        <p className="text-slate-700 mb-3">
          The intuition: each key gets two independent opportunities. Picking the less-loaded option applies
          negative feedback to hotspots, so overloaded buckets become less likely to receive additional keys.
          Over many inserts this creates a self-balancing effect that plain one-choice random placement cannot
          reproduce.
        </p>
        <p className="text-slate-700">
          APA source: Mitzenmacher, M. (2001). The power of two choices in randomized load balancing.
          <em> IEEE Transactions on Parallel and Distributed Systems, 12</em>(10), 1094-1104.
          {' '}
          <a
            href="https://www.eecs.harvard.edu/~michaelm/postscripts/tpds2001.pdf"
            target="_blank"
            rel="noreferrer"
            className="text-blue-700 underline"
          >
            https://www.eecs.harvard.edu/~michaelm/postscripts/tpds2001.pdf
          </a>
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Lucky Buckets: {bucketCount}</span>
            <input
              type="range"
              min="16"
              max="160"
              step="8"
              value={bucketCount}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                setBucketCount(next);
                setUserLoads(Array(next).fill(0));
                setGameRound(0);
                setScore(0);
              }}
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
              onChange={(event) => {
                setSeed(Number.parseInt(event.target.value, 10));
                setUserLoads(Array(bucketCount).fill(0));
                setGameRound(0);
                setScore(0);
              }}
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
          <button
            type="button"
            onClick={resetGame}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500"
          >
            Reset Mini-Game
          </button>
        </div>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Game / Visualization</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <BucketBars title="Standard Random Hash" loads={classicLoads} colorClass="bg-rose-400" />
          <BucketBars title="Human Random Hash" loads={humanLoads} colorClass="bg-amber-400" />
          <BucketBars title="Lucky Bucket Draw (Power of Two)" loads={choiceLoads} colorClass="bg-emerald-400" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-700 mb-4">
          <div className="rounded-lg bg-rose-50 border border-rose-100 p-3">
            <h3 className="font-semibold">Standard stats</h3>
            <p>Max load: {classicStats.max}</p>
            <p>Average: {classicStats.avg.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
            <h3 className="font-semibold">Human random stats</h3>
            <p>Max load: {humanStats.max}</p>
            <p>Average: {humanStats.avg.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
            <h3 className="font-semibold">Power of two stats</h3>
            <p>Max load: {choiceStats.max}</p>
            <p>Average: {choiceStats.avg.toFixed(2)}</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-semibold mb-2">Mini-game: pick the better lucky bucket</h3>
          <p className="text-slate-700 mb-3">
            Round {Math.min(gameRound + 1, DEFAULT_GAME_ROUNDS)} / {DEFAULT_GAME_ROUNDS} · Score: {score}
          </p>
          {gameRound >= DEFAULT_GAME_ROUNDS ? (
            <p className="text-slate-700">Game complete. Reset Mini-Game to play again with the same settings.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500"
                onClick={() => chooseLuckyBucket(currentChoices[0])}
              >
                Choose lucky bucket #{currentChoices[0]}
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500"
                onClick={() => chooseLuckyBucket(currentChoices[1])}
              >
                Choose lucky bucket #{currentChoices[1]}
              </button>
            </div>
          )}
          <p className="text-sm text-slate-600 mt-3">
            Tip: You gain a point when you pick the less-loaded bucket between the two offered choices.
          </p>
          <div className="mt-3 rounded bg-white border border-slate-200 p-3">
            <p className="font-semibold mb-2">Your mini-game bucket balance</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2 text-xs">
              {userLoads.slice(0, Math.min(bucketCount, 32)).map((value, index) => (
                <div key={`user-load-${index}`} className="rounded bg-slate-100 p-2 text-center">
                  #{index}: {value}
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-700 mt-2">Your max load so far: {userStats.max}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
