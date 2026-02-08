'use client';

import { useEffect, useMemo, useState } from 'react';

const SUITS = ['♠', '♥', '♦', '♣'];
const FACE_RANKS = ['J', 'Q', 'K'];
const SUIT_COLORS = {
  '♠': 'text-slate-900',
  '♣': 'text-slate-900',
  '♥': 'text-rose-700',
  '♦': 'text-rose-700',
};
const DEAL_ORDER = [0, 1, 2, 0, 1];

function shuffle(cards) {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildDeck() {
  const deck = [];
  let id = 1;

  for (const suit of SUITS) {
    for (let value = 1; value <= 10; value += 1) {
      deck.push({ id, suit, value });
      id += 1;
    }
  }

  return shuffle(deck);
}

function createRoundMarkers() {
  const markers = [];
  let id = 1000;

  for (const suit of SUITS) {
    for (const rank of FACE_RANKS) {
      markers.push({ id, rank, suit });
      id += 1;
    }
  }

  return shuffle(markers).slice(0, 3);
}

function formatCard(card) {
  if (!card) return '';
  const rank = card.value === 1 ? 'A' : String(card.value);
  return `${rank}${card.suit}`;
}

function cloneStateSnapshot(snapshot) {
  return {
    ...snapshot,
    deck: snapshot.deck.map((card) => ({ ...card })),
    discard: snapshot.discard.map((card) => ({ ...card })),
    marketStacks: snapshot.marketStacks.map((stack) => stack.map((card) => ({ ...card }))),
    grid: snapshot.grid.map((stack) => stack.map((card) => ({ ...card }))),
    roundMarkers: snapshot.roundMarkers.map((marker) => ({ ...marker })),
  };
}

function drawOne(state, options) {
  const { allowFinalTopUp, cardsDealtThisMarket } = options;
  let deck = [...state.deck];
  let discard = [...state.discard];
  let passesCompleted = state.passesCompleted;
  let finalTopUpUsed = state.finalTopUpUsed;

  if (deck.length === 0) {
    if (discard.length === 0) {
      return { card: null, deck, discard, passesCompleted, finalTopUpUsed };
    }

    if (passesCompleted < 2) {
      deck = shuffle(discard);
      discard = [];
      passesCompleted += 1;
    } else if (
      passesCompleted === 2
      && allowFinalTopUp
      && !finalTopUpUsed
      && cardsDealtThisMarket > 0
    ) {
      deck = shuffle(discard);
      discard = [];
      finalTopUpUsed = true;
    } else {
      return { card: null, deck, discard, passesCompleted, finalTopUpUsed };
    }
  }

  const [card, ...rest] = deck;
  return { card, deck: rest, discard, passesCompleted, finalTopUpUsed };
}

function dealMarket(state, allowFinalTopUp) {
  let working = {
    deck: [...state.deck],
    discard: [...state.discard],
    passesCompleted: state.passesCompleted,
    finalTopUpUsed: state.finalTopUpUsed,
  };

  const stacks = [[], [], []];

  for (let drawIndex = 0; drawIndex < DEAL_ORDER.length; drawIndex += 1) {
    const slot = DEAL_ORDER[drawIndex];
    const result = drawOne(working, {
      allowFinalTopUp,
      cardsDealtThisMarket: drawIndex,
    });
    if (!result.card) {
      return {
        complete: false,
        marketStacks: stacks,
        deck: result.deck,
        discard: result.discard,
        passesCompleted: result.passesCompleted,
        finalTopUpUsed: result.finalTopUpUsed,
      };
    }

    stacks[slot].push(result.card);
    working = result;
  }

  return {
    complete: true,
    marketStacks: stacks,
    deck: working.deck,
    discard: working.discard,
    passesCompleted: working.passesCompleted,
    finalTopUpUsed: working.finalTopUpUsed,
  };
}

function createInitialState() {
  const roundMarkers = createRoundMarkers();
  const seed = {
    deck: buildDeck(),
    discard: [],
    marketStacks: [[], [], []],
    grid: Array.from({ length: 9 }, () => []),
    roundMarkers,
    passesCompleted: 0,
    finalTopUpUsed: false,
    turn: 0,
    gameOver: false,
  };

  const firstDeal = dealMarket(seed, false);

  return {
    ...seed,
    ...firstDeal,
    turn: firstDeal.complete ? 1 : 0,
    gameOver: !firstDeal.complete,
  };
}

function getAdjacencies(cell) {
  const row = Math.floor(cell / 3);
  const col = cell % 3;
  const positions = [];

  if (row > 0) positions.push(cell - 3);
  if (row < 2) positions.push(cell + 3);
  if (col > 0) positions.push(cell - 1);
  if (col < 2) positions.push(cell + 1);

  return positions;
}

function getSuitValuesByCell(grid, suit) {
  return grid.map((pile) => new Set(pile.filter((card) => card.suit === suit).map((card) => card.value)));
}

function getLongestSuitPath(grid, suit) {
  const valuesByCell = getSuitValuesByCell(grid, suit);
  const memo = new Map();

  function key(cell, value) {
    return `${cell}:${value}`;
  }

  function dfs(cell, value) {
    const cacheKey = key(cell, value);
    if (memo.has(cacheKey)) return memo.get(cacheKey);

    let bestLen = 1;
    let bestPath = [{ cell, value }];

    const neighbors = getAdjacencies(cell);
    for (const nextCell of neighbors) {
      for (const nextValue of valuesByCell[nextCell]) {
        if (nextValue <= value) continue;
        const candidate = dfs(nextCell, nextValue);
        const candidateLen = 1 + candidate.length;
        if (candidateLen > bestLen) {
          bestLen = candidateLen;
          bestPath = [{ cell, value }, ...candidate.path];
        }
      }
    }

    const result = { length: bestLen, path: bestPath };
    memo.set(cacheKey, result);
    return result;
  }

  let longest = { length: 0, path: [] };

  for (let cell = 0; cell < valuesByCell.length; cell += 1) {
    for (const value of valuesByCell[cell]) {
      const candidate = dfs(cell, value);
      if (candidate.length > longest.length) {
        longest = candidate;
      }
    }
  }

  return longest;
}

function summarizeSuits(grid) {
  return SUITS.map((suit) => {
    const longest = getLongestSuitPath(grid, suit);
    return {
      suit,
      length: longest.length,
      passed: longest.length >= 5,
      path: longest.path,
    };
  });
}

export default function SkywayPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [state, setState] = useState(() => createInitialState());
  const [selectedStackIndex, setSelectedStackIndex] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    document.title = 'Skyway';
  }, []);

  const suitSummary = useMemo(() => summarizeSuits(state.grid), [state.grid]);
  const allSuitsPassed = suitSummary.every((item) => item.passed);
  const totalScore = suitSummary.reduce((acc, item) => acc + item.length, 0);

  const canPlace = !state.gameOver && selectedStackIndex !== null && state.marketStacks[selectedStackIndex]?.length > 0;

  function pushHistorySnapshot(nextState, nextSelectedStackIndex) {
    setHistory((prev) => [...prev, {
      state: cloneStateSnapshot(nextState),
      selectedStackIndex: nextSelectedStackIndex,
    }]);
  }

  function placeBlueprint(cellIndex) {
    if (!canPlace) return;

    const chosen = state.marketStacks[selectedStackIndex];
    if (!chosen || chosen.length === 0) return;

    pushHistorySnapshot(state, selectedStackIndex);

    const undrafted = state.marketStacks
      .filter((_, index) => index !== selectedStackIndex)
      .flat();

    const nextGrid = state.grid.map((pile, index) => {
      if (index !== cellIndex) return [...pile];
      const expanded = [...pile, ...chosen];
      if (expanded.length <= 3) return expanded;
      return expanded.slice(expanded.length - 3);
    });

    const overflowDiscard = state.grid[cellIndex].length + chosen.length > 3
      ? [...state.grid[cellIndex], ...chosen].slice(0, state.grid[cellIndex].length + chosen.length - 3)
      : [];

    const afterPlacement = {
      ...state,
      grid: nextGrid,
      discard: [...state.discard, ...undrafted, ...overflowDiscard],
      marketStacks: [[], [], []],
      turn: state.turn + 1,
    };

    const nextMarket = dealMarket(afterPlacement, true);

    setState({
      ...afterPlacement,
      ...nextMarket,
      gameOver: !nextMarket.complete,
    });

    setSelectedStackIndex(null);
  }

  function undoMove() {
    const snapshot = history[history.length - 1];
    if (!snapshot) return;

    setState(snapshot.state);
    setSelectedStackIndex(snapshot.selectedStackIndex ?? null);
    setHistory((prev) => prev.slice(0, -1));
  }

  function startNewGame() {
    setState(createInitialState());
    setSelectedStackIndex(null);
    setHistory([]);
  }

  return (
    <main className="min-h-screen p-6 md:p-8 flex flex-col items-center gap-5 text-slate-900">
      <div className="w-full max-w-6xl flex items-center justify-start">
        <button
          type="button"
          onClick={() => window.location.assign(demosHref)}
          className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800"
        >
          ← Back
        </button>
      </div>

      <div className="w-full max-w-6xl">
        <h1 className="text-3xl font-bold text-center">Skyway</h1>
        <p className="mt-2 text-center text-sm text-slate-600">Draft one blueprint stack each turn, cap each grid cell at three cards, and score longest increasing paths by suit.</p>
      </div>

      <div className="w-full max-w-6xl grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Status</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold text-slate-700">Turn:</span> {state.turn}</p>
            <p><span className="font-semibold text-slate-700">Deck:</span> {state.deck.length}</p>
            <p><span className="font-semibold text-slate-700">Discard:</span> {state.discard.length}</p>
            <p><span className="font-semibold text-slate-700">Round:</span> {Math.min(state.passesCompleted + 1, 3)} / 3</p>
            <p><span className="font-semibold text-slate-700">Final top-up used:</span> {state.finalTopUpUsed ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Round markers</p>
            <div className="flex gap-2">
              {state.roundMarkers.map((marker, index) => {
                const turnedDown = index < state.passesCompleted;
                return (
                  <div
                    key={marker.id}
                    className={`flex h-10 w-8 items-center justify-center rounded border text-xs font-bold ${turnedDown ? 'border-slate-300 bg-slate-200 text-slate-500' : `border-slate-300 bg-white ${SUIT_COLORS[marker.suit]}`}`}
                  >
                    {turnedDown ? '🂠' : `${marker.rank}${marker.suit}`}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {state.gameOver
              ? 'Game over: no cards remain to fully reset the market.'
              : canPlace
                ? `Blueprint ${selectedStackIndex + 1} selected. Click a play-area cell to place the stack.`
                : 'Select one blueprint stack, then choose a grid cell for placement.'}
          </div>
          <div className="grid gap-2">
            <button type="button" onClick={undoMove} disabled={history.length === 0} className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40">Undo</button>
            <button type="button" onClick={startNewGame} className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600">New game</button>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Market (2-2-1)</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {state.marketStacks.map((stack, stackIndex) => {
                const isSelected = selectedStackIndex === stackIndex;
                const isEmpty = stack.length === 0;
                return (
                  <button
                    type="button"
                    key={`stack-${stackIndex}`}
                    onClick={() => !state.gameOver && !isEmpty && setSelectedStackIndex(stackIndex)}
                    disabled={state.gameOver || isEmpty}
                    className={`min-h-36 rounded-md border p-2 text-left transition disabled:opacity-50 ${isSelected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                  >
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Blueprint {stackIndex + 1}</p>
                    <div className="mt-1 flex min-h-20 flex-wrap gap-2">
                      {stack.map((card) => (
                        <div
                          key={card.id}
                          className={`flex h-16 w-12 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-bold shadow-sm ${SUIT_COLORS[card.suit]}`}
                        >
                          {formatCard(card)}
                        </div>
                      ))}
                      {isEmpty && <span className="text-xs text-slate-400">Empty</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Play Area (3x3)</h2>
            <div className="grid grid-cols-3 gap-3">
              {state.grid.map((pile, cellIndex) => (
                <button
                  type="button"
                  key={`cell-${cellIndex}`}
                  onClick={() => placeBlueprint(cellIndex)}
                  disabled={!canPlace}
                  className={`relative min-h-28 rounded-md border p-2 text-left transition ${canPlace ? 'border-emerald-300 bg-emerald-50 hover:border-emerald-500' : 'border-slate-200 bg-slate-50'}`}
                >
                  <p className="text-xs font-semibold text-slate-500">Cell {cellIndex + 1}</p>
                  <div className="mt-2 flex min-h-16 flex-wrap gap-2">
                    {pile.map((card, idx) => (
                      <div
                        key={`${card.id}-${idx}`}
                        className={`flex h-14 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-xs font-bold shadow-sm ${SUIT_COLORS[card.suit]}`}
                      >
                        {formatCard(card)}
                      </div>
                    ))}
                    {pile.length === 0 && <span className="text-xs text-slate-400">Drop zone</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Endgame</h2>
          <p className="mb-3 text-sm text-slate-600">Find the longest increasing route per suit using orthogonal movement between grid cells.</p>
          <div className="space-y-2">
            {suitSummary.map((item) => (
              <div key={item.suit} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span className={`font-semibold ${SUIT_COLORS[item.suit]}`}>{item.suit}</span>
                  <span className="text-slate-600">len {item.length}</span>
                  <span className={item.passed ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>{item.passed ? 'PASS' : 'FAIL'}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {item.path.length > 0
                    ? item.path.map((step) => `${step.value === 1 ? 'A' : step.value}${item.suit}@${step.cell + 1}`).join(' → ')
                    : 'No sequence yet.'}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <p><span className="font-semibold">Total score:</span> {totalScore}</p>
            <p><span className="font-semibold">Result:</span> {allSuitsPassed ? 'Win (all suits reached 5+)' : 'Not yet winning'}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
