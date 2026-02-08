'use client';

import { useEffect, useMemo, useState } from 'react';

const DEFAULT_TARGET = 23;
const DEFAULT_COINS = '1, 4, 6, 9';

function parseCoinInput(value) {
  return value
    .split(',')
    .map((coin) => Number.parseInt(coin.trim(), 10))
    .filter((coin) => Number.isFinite(coin) && coin > 0)
    .filter((coin, index, arr) => arr.indexOf(coin) === index)
    .sort((a, b) => a - b);
}

function buildCoinChangeTable(coins, targetAmount) {
  const dp = Array(targetAmount + 1).fill(Number.POSITIVE_INFINITY);
  const fromCoin = Array(targetAmount + 1).fill(null);
  dp[0] = 0;

  for (let amount = 1; amount <= targetAmount; amount += 1) {
    for (const coin of coins) {
      if (coin <= amount && dp[amount - coin] + 1 < dp[amount]) {
        dp[amount] = dp[amount - coin] + 1;
        fromCoin[amount] = coin;
      }
    }
  }

  const choices = [];
  if (Number.isFinite(dp[targetAmount])) {
    let amount = targetAmount;
    while (amount > 0 && fromCoin[amount] !== null) {
      const coin = fromCoin[amount];
      choices.push(coin);
      amount -= coin;
    }
  }

  return { dp, fromCoin, choices };
}

function buildPathAmounts(choices, targetAmount) {
  const path = new Set([0, targetAmount]);
  let remaining = targetAmount;

  for (const coin of choices) {
    remaining -= coin;
    path.add(remaining);
  }

  return path;
}

export default function DynamicProgrammingPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [targetAmount, setTargetAmount] = useState(DEFAULT_TARGET);
  const [coinInput, setCoinInput] = useState(DEFAULT_COINS);
  const [currentStep, setCurrentStep] = useState(1);

  const parsedCoins = useMemo(() => parseCoinInput(coinInput), [coinInput]);

  const { dp, fromCoin, choices } = useMemo(() => {
    if (parsedCoins.length === 0 || targetAmount < 1) {
      return {
        dp: [0],
        fromCoin: [null],
        choices: [],
      };
    }

    return buildCoinChangeTable(parsedCoins, targetAmount);
  }, [parsedCoins, targetAmount]);

  useEffect(() => {
    setCurrentStep((previousStep) => Math.min(Math.max(previousStep, 1), targetAmount));
  }, [targetAmount]);

  const hasSolution = Number.isFinite(dp[targetAmount]);
  const pathAmounts = hasSolution ? buildPathAmounts(choices, targetAmount) : new Set();

  const selectedCoinCounts = choices.reduce((counts, coin) => {
    counts[coin] = (counts[coin] || 0) + 1;
    return counts;
  }, {});

  const activeStepCoin = fromCoin[currentStep];
  const activeStepPrevAmount = activeStepCoin === null ? null : currentStep - activeStepCoin;

  const resetAll = () => {
    setCoinInput('');
    setTargetAmount(1);
    setCurrentStep(1);
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

      <h1 className="text-3xl md:text-4xl font-bold text-center">Dynamic Programming</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">What is dynamic programming?</h2>
        <p className="text-slate-700 mb-3">
          Dynamic programming (DP) solves complex tasks by breaking them into smaller subproblems and
          reusing those answers instead of recomputing everything.
        </p>
        <p className="text-slate-700 mb-3">
          In this activity, the task is the <strong>minimum coin change problem</strong>: given a target
          amount and available coin values, find the fewest coins needed to exactly make that amount.
        </p>
        <p className="text-slate-700">
          DP builds a table from amount 0 up to your target. Each cell stores the best answer seen so
          far, making it easy to trace an optimal solution and compare how different coin sets affect
          performance and outcomes.
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Enter coin values in the <strong>Coin Set</strong> box using commas (example: 1, 4, 6).</li>
          <li>Adjust the <strong>Target Amount</strong> slider to choose the goal value.</li>
          <li>
            Use the <strong>Step Through DP Build</strong> controls to inspect how each amount is computed
            from a smaller amount.
          </li>
          <li>
            The table shows all subproblem values. Green highlights the reconstructed optimal path,
            and yellow marks the amount currently being explained.
          </li>
        </ul>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Coin Set</span>
            <input
              type="text"
              value={coinInput}
              onChange={(event) => setCoinInput(event.target.value)}
              className="border border-slate-300 rounded px-3 py-2"
              aria-label="Coin set input"
            />
            <span className="text-sm text-slate-600">
              Parsed coins: {parsedCoins.length > 0 ? parsedCoins.join(', ') : 'No valid coin values yet'}
            </span>
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-semibold">Target Amount: {targetAmount}</span>
            <input
              type="range"
              min="1"
              max="60"
              value={targetAmount}
              onChange={(event) => setTargetAmount(Number.parseInt(event.target.value, 10))}
              className="w-full"
              aria-label="Target amount slider"
            />
            <span className="text-sm text-slate-600">Slide to change the dynamic programming table size.</span>
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
            onClick={() => {
              setCoinInput(DEFAULT_COINS);
              setTargetAmount(DEFAULT_TARGET);
              setCurrentStep(DEFAULT_TARGET);
            }}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500"
          >
            Load Example
          </button>
        </div>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Game / Visualization</h2>

        <div className="mb-4 rounded-lg bg-slate-100 p-4">
          {parsedCoins.length === 0 ? (
            <p className="text-slate-700">Add at least one valid coin value to start the simulation.</p>
          ) : hasSolution ? (
            <div className="space-y-2">
              <p className="text-slate-800">
                Minimum coins needed for <strong>{targetAmount}</strong>: <strong>{dp[targetAmount]}</strong>
              </p>
              <p className="text-slate-700">
                One optimal combination:{' '}
                <strong>
                  {Object.entries(selectedCoinCounts)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([coin, count]) => `${count}×${coin}`)
                    .join(', ')}
                </strong>
              </p>
            </div>
          ) : (
            <p className="text-red-600">No exact solution with the current coin set.</p>
          )}
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold mb-2">Step Through DP Build</h3>
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <button
              type="button"
              onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}
              className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep((step) => Math.min(targetAmount, step + 1))}
              className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300"
            >
              Next
            </button>
            <span className="font-medium">Current amount: {currentStep}</span>
          </div>

          {parsedCoins.length === 0 ? (
            <p className="text-slate-600">Enter coins to see step-by-step details.</p>
          ) : Number.isFinite(dp[currentStep]) ? (
            <p className="text-slate-700">
              Best for amount <strong>{currentStep}</strong> uses coin <strong>{activeStepCoin}</strong>, so
              dp[{currentStep}] = dp[{activeStepPrevAmount}] + 1 = {dp[activeStepPrevAmount]} + 1 ={' '}
              <strong>{dp[currentStep]}</strong>.
            </p>
          ) : (
            <p className="text-slate-700">
              Amount <strong>{currentStep}</strong> is currently unreachable with this coin set.
            </p>
          )}
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-semibold mb-2">Legend</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded border border-amber-400 bg-amber-50" aria-hidden="true" />
              <span>Current step being explained</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded border border-emerald-400 bg-emerald-50" aria-hidden="true" />
              <span>Amounts that form a minimum-coin route from the target back to 0</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded border border-blue-500 bg-blue-50" aria-hidden="true" />
              <span>Target amount</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded border border-slate-200 bg-white" aria-hidden="true" />
              <span>Other computed amounts</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {Array.from({ length: targetAmount + 1 }, (_, amount) => {
            const stateClassName =
              amount === currentStep
                ? 'border-amber-400 bg-amber-50'
                : amount === targetAmount
                ? 'border-blue-500 bg-blue-50'
                : pathAmounts.has(amount)
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-slate-200 bg-white';

            return (
              <div key={amount} className={`rounded border p-2 ${stateClassName}`}>
                <p className="text-xs text-slate-500">Amount {amount}</p>
                <p className="text-lg font-bold text-slate-800">
                  {Number.isFinite(dp[amount]) ? dp[amount] : '∞'}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
