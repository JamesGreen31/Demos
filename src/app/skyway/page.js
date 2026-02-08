'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  SUITS,
  scoreSkywayGrid,
  shouldTriggerEndgame,
} from './logic';

const GRID_SIZE = 4;
const PASS_LIMIT = 3;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createCard() {
  const suit = SUITS[randomInt(0, SUITS.length - 1)];
  return {
    suit,
    value: randomInt(1, 13),
  };
}

function buildInitialGrid() {
  return Array.from({ length: GRID_SIZE }, () => (
    Array.from({ length: GRID_SIZE }, () => (
      Array.from({ length: randomInt(1, 3) }, () => createCard())
    ))
  ));
}

function cardLabel(card) {
  const faces = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  return `${faces[card.value] ?? card.value}${card.suit}`;
}

function randomizeCellStack(cell) {
  const next = [...cell];
  if (Math.random() > 0.5 && next.length < 4) next.push(createCard());
  if (Math.random() > 0.5 && next.length > 1) next.shift();
  if (Math.random() > 0.3 && next.length > 0) {
    next[next.length - 1] = createCard();
  }
  return next;
}

export default function SkywayPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [gridStacks, setGridStacks] = useState(() => buildInitialGrid());
  const [passCount, setPassCount] = useState(0);
  const [endgameTriggered, setEndgameTriggered] = useState(false);

  useEffect(() => {
    document.title = 'Skyway';
  }, []);

  const score = useMemo(
    () => scoreSkywayGrid(gridStacks, { allowCellRevisit: false }),
    [gridStacks]
  );

  function startNewRun() {
    setGridStacks(buildInitialGrid());
    setPassCount(0);
    setEndgameTriggered(false);
  }

  function resolveFullPass() {
    if (endgameTriggered) return;

    const nextPassCount = passCount + 1;
    setGridStacks((previousGrid) => previousGrid.map((row) => row.map((cell) => randomizeCellStack(cell))));
    setPassCount(nextPassCount);

    if (shouldTriggerEndgame(nextPassCount, PASS_LIMIT)) {
      setEndgameTriggered(true);
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <a href={demosHref} className="text-sm text-slate-500 hover:text-slate-900">← Back to demos</a>

      <h1 className="text-3xl font-bold mt-2">Skyway</h1>
      <p className="text-slate-600 mt-2 max-w-3xl">
        Build strictly increasing suit paths across orthogonally adjacent cells. Scoring ignores stack height:
        card presence per cell is what matters. Endgame triggers right after the third full pass.
      </p>

      <section className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={resolveFullPass}
          disabled={endgameTriggered}
          className="rounded-lg px-4 py-2 bg-sky-600 text-white disabled:bg-slate-300"
        >
          Resolve full pass ({passCount}/{PASS_LIMIT})
        </button>
        <button
          type="button"
          onClick={startNewRun}
          className="rounded-lg px-4 py-2 bg-slate-200 text-slate-900"
        >
          New run
        </button>
      </section>

      <section className="mt-6 grid gap-2" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}>
        {gridStacks.map((row, rowIndex) => row.map((cell, colIndex) => (
          <div key={`${rowIndex}-${colIndex}`} className="rounded-lg border border-slate-200 bg-white p-3 min-h-24">
            <div className="text-xs text-slate-400 mb-1">({rowIndex}, {colIndex})</div>
            <div className="flex flex-wrap gap-1">
              {cell.map((card, index) => (
                <span key={`${rowIndex}-${colIndex}-${index}`} className="text-xs px-2 py-1 rounded bg-slate-100 border border-slate-200">
                  {cardLabel(card)}
                </span>
              ))}
            </div>
          </div>
        )))}
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-xl font-semibold">Scoring details</h2>
        <p className="text-sm text-slate-600 mt-1">Total score = sum of best path lengths for ♠ ♥ ♦ ♣.</p>
        <ul className="mt-3 space-y-2">
          {score.perSuit.map((entry) => (
            <li key={entry.suit} className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="font-medium">{entry.suit} longest path: {entry.length}</div>
              <div className="text-xs text-slate-500 mt-1">
                {entry.path.length === 0
                  ? 'No legal increasing path found.'
                  : entry.path.map((step) => `(${step.row},${step.col})=${step.value}${step.suit}`).join(' → ')}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {endgameTriggered && (
        <section className={`mt-6 rounded-xl p-4 border ${score.isWin ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
          <h2 className="text-2xl font-bold">{score.isWin ? 'You Win 🎉' : 'You Lose'}</h2>
          <p className="mt-1">Passes completed: {passCount}</p>
          <p>Total score: <strong>{score.totalScore}</strong></p>
          <p className="text-sm mt-1">
            Win condition: every suit path length must be at least 5.
          </p>
        </section>
      )}
    </main>
  );
}
