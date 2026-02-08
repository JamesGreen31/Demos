'use client';

import { useEffect, useMemo, useState } from 'react';

const SUITS = ['♠', '♥', '♦', '♣'];
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

function formatCard(card) {
  if (!card) return '';
  const rank = card.value === 1 ? 'A' : String(card.value);
  return `${rank}${card.suit}`;
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
  let usedFinalTopUpThisMarket = false;

  for (let drawIndex = 0; drawIndex < DEAL_ORDER.length; drawIndex += 1) {
    const slot = DEAL_ORDER[drawIndex];
    const result = drawOne(working, {
      allowFinalTopUp,
      cardsDealtThisMarket: drawIndex,
    });
    if (!working.finalTopUpUsed && result.finalTopUpUsed) {
      usedFinalTopUpThisMarket = true;
    }
    if (!result.card) {
      return {
        complete: false,
        marketStacks: stacks,
        deck: result.deck,
        discard: result.discard,
        passesCompleted: result.passesCompleted,
        finalTopUpUsed: result.finalTopUpUsed,
        isLastMarket: false,
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
    isLastMarket: usedFinalTopUpThisMarket,
  };
}

function createInitialState() {
  const seed = {
    deck: buildDeck(),
    discard: [],
    marketStacks: [[], [], []],
    grid: Array.from({ length: 9 }, () => []),
    passesCompleted: 0,
    finalTopUpUsed: false,
    turn: 0,
    gameOver: false,
    isLastMarket: false,
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

  useEffect(() => {
    document.title = 'Skyway';
  }, []);

  const suitSummary = useMemo(() => summarizeSuits(state.grid), [state.grid]);
  const allSuitsPassed = suitSummary.every((item) => item.passed);
  const totalScore = suitSummary.reduce((acc, item) => acc + item.length, 0);

  const canPlace = !state.gameOver && selectedStackIndex !== null && state.marketStacks[selectedStackIndex]?.length > 0;

  function placeBlueprint(cellIndex) {
    if (!canPlace) return;

    const chosen = state.marketStacks[selectedStackIndex];
    if (!chosen || chosen.length === 0) return;

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

    if (state.isLastMarket) {
      setState({
        ...afterPlacement,
        gameOver: true,
        isLastMarket: false,
      });
      setSelectedStackIndex(null);
      return;
    }

    const nextMarket = dealMarket(afterPlacement, true);

    setState({
      ...afterPlacement,
      ...nextMarket,
      gameOver: !nextMarket.complete,
    });

    setSelectedStackIndex(null);
  }

  function startNewGame() {
    const confirmed = window.confirm('Are you sure you want to start a new game?');
    if (!confirmed) return;

    setState(createInitialState());
    setSelectedStackIndex(null);
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

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">Description</h2>
        <p className="text-slate-700">
          Arranging tiles to create maps is a cornerstone of many great city-building games like Suburbia and Sprawlopolis. However,
          most games of this genre require more information on each card than a simple rank-and-suit system can provide. Skyway takes
          its cue from the Decktet game Aucteraden. By allowing a single space to have more than one suit on it, the paths can
          intersect and weave around each other to create a small, tight puzzle.
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to Play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li><strong>Overview:</strong> Over three passes through the deck, draft stacks of cards from the market and place them in your 3x3 grid. Each cell may stack only three cards high; overflow cards are discarded from the bottom.</li>
          <li><strong>Components:</strong> A standard 52-card deck with no jokers.</li>
          <li><strong>Setup:</strong> Remove all twelve face cards, then shuffle the remaining 40-card deck and set space for discard, a 3-space market, and a 3x3 play area.</li>
          <li><strong>Turn structure:</strong> (1) Reset the market by dealing five cards into three stacks in a fixed 2-2-1 pattern. (2) Draft one stack and discard the other two. Place the drafted stack into one grid cell without reordering cards.</li>
          <li><strong>Stack limit:</strong> If a cell exceeds three cards after placement, discard bottom cards until only three remain in that cell.</li>
          <li><strong>Second and third round:</strong> When the deck runs out, shuffle discard to form a new deck and continue. During the third pass, if the deck runs out while dealing a market, shuffle once more only to finish that final market.</li>
          <li><strong>Game end and scoring:</strong> After three passes, for each suit find the longest increasing sequence along orthogonally adjacent grid cells. You must move to a new cell each step. You win if all suits have a sequence of at least length 5. Score is the sum of all four suit lengths.</li>
        </ul>
      </section>

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
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {state.gameOver
              ? 'Game over: no cards remain to fully reset the market.'
              : canPlace
                ? `Blueprint ${selectedStackIndex + 1} selected. Click a play-area cell to place the stack.`
                : 'Select one blueprint stack, then choose a grid cell for placement.'}
          </div>
          <div className="grid gap-2">
            <button type="button" onClick={startNewGame} className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">New game</button>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Market (2-2-1)</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {state.marketStacks.map((stack, stackIndex) => {
                const isSelected = selectedStackIndex === stackIndex;
                const hasSelection = selectedStackIndex !== null;
                const isEmpty = stack.length === 0;
                const marketColorClasses = isSelected
                  ? 'border-emerald-500 bg-emerald-100 shadow-sm'
                  : hasSelection
                    ? 'border-rose-500 bg-rose-100'
                    : 'border-slate-200 bg-slate-50 hover:border-sky-400 hover:ring-2 hover:ring-sky-200';
                return (
                  <button
                    type="button"
                    key={`stack-${stackIndex}`}
                    onClick={() => !state.gameOver && !isEmpty && setSelectedStackIndex(stackIndex)}
                    disabled={state.gameOver || isEmpty}
                    className={`min-h-36 rounded-md border p-2 text-left transition disabled:opacity-50 ${marketColorClasses}`}
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
                  className={`relative min-h-28 rounded-md border p-2 text-left transition ${canPlace ? 'border-blue-400 bg-blue-50 hover:border-amber-400 hover:ring-2 hover:ring-amber-200' : 'border-slate-200 bg-slate-50'}`}
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

      <p className="w-full max-w-6xl text-center text-sm text-slate-600">
        Credit for this game goes to Isaludo. Rule book for this and other games available at
        {' '}
        <a className="text-blue-700 underline" href="https://drive.google.com/file/d/1DB2YF46s0oVFUSIpR9vxoGIbhpTKz2jw/view" target="_blank" rel="noreferrer">
          https://drive.google.com/file/d/1DB2YF46s0oVFUSIpR9vxoGIbhpTKz2jw/view
        </a>
      </p>
    </main>
  );
}
