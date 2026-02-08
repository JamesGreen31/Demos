'use client';

import { useEffect, useMemo, useState } from 'react';

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = {
  '♠': 'text-slate-900',
  '♣': 'text-slate-900',
  '♥': 'text-rose-700',
  '♦': 'text-rose-700',
};

function buildDeck() {
  const deck = [];
  let id = 1;
  for (const suit of SUITS) {
    for (let value = 1; value <= 9; value += 1) {
      deck.push({ id: id += 1, suit, value });
    }
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function drawStacks(deck, count = 3, depth = 5) {
  const nextDeck = [...deck];
  const stacks = Array.from({ length: count }, () => nextDeck.splice(0, depth));
  return { nextDeck, stacks };
}

function createInitialState() {
  const baseDeck = buildDeck();
  const { nextDeck, stacks } = drawStacks(baseDeck, 3, 5);
  return {
    deck: nextDeck,
    discard: [],
    marketStacks: stacks,
    grid: Array.from({ length: 9 }, () => []),
    round: 1,
    marker: 'Planning',
  };
}

function getCellValid(topCard, selectedCard) {
  if (!selectedCard) return false;
  if (!topCard) return true;
  return topCard.suit === selectedCard.suit && selectedCard.value === topCard.value + 1;
}

function formatCard(card) {
  if (!card) return '';
  return `${card.value}${card.suit}`;
}

function computeSuitProgress(grid) {
  const bySuit = {
    '♠': new Set(),
    '♥': new Set(),
    '♦': new Set(),
    '♣': new Set(),
  };

  for (const pile of grid) {
    for (const card of pile) {
      bySuit[card.suit].add(card.value);
    }
  }

  return SUITS.map((suit) => {
    let streak = 0;
    for (let value = 1; value <= 9; value += 1) {
      if (bySuit[suit].has(value)) streak += 1;
      else break;
    }
    return { suit, streak, passed: streak >= 5 };
  });
}

export default function SkywayPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [state, setState] = useState(() => createInitialState());
  const [selectedStackIndex, setSelectedStackIndex] = useState(null);
  const [history, setHistory] = useState([]);

  const selectedStack = selectedStackIndex !== null ? state.marketStacks[selectedStackIndex] : null;
  const selectedTopCard = selectedStack?.[selectedStack.length - 1] ?? null;

  const validCells = useMemo(() => {
    if (!selectedTopCard) return [];
    return state.grid
      .map((pile, index) => ({ pile, index }))
      .filter(({ pile }) => getCellValid(pile[pile.length - 1], selectedTopCard))
      .map(({ index }) => index);
  }, [selectedTopCard, state.grid]);

  const suitProgress = useMemo(() => computeSuitProgress(state.grid), [state.grid]);

  const turnPrompt = selectedTopCard
    ? `Selected ${formatCard(selectedTopCard)}. Choose a glowing cell in the play area.`
    : 'Choose a blueprint stack from market to begin your move.';

  useEffect(() => {
    document.title = 'Skyway';
  }, []);

  function pushHistorySnapshot(nextState) {
    setHistory((prev) => [...prev, {
      state: {
        ...nextState,
        deck: nextState.deck.map((card) => ({ ...card })),
        discard: nextState.discard.map((card) => ({ ...card })),
        marketStacks: nextState.marketStacks.map((stack) => stack.map((card) => ({ ...card }))),
        grid: nextState.grid.map((stack) => stack.map((card) => ({ ...card }))),
      },
      selectedStackIndex,
    }]);
  }

  function resetMarket() {
    const mergedDeck = [
      ...state.deck,
      ...state.discard,
      ...state.marketStacks.flat(),
    ];
    const { nextDeck, stacks } = drawStacks(mergedDeck.sort(() => Math.random() - 0.5), 3, 5);
    const nextState = {
      ...state,
      deck: nextDeck,
      discard: [],
      marketStacks: stacks,
      marker: 'Market Reset',
    };
    pushHistorySnapshot(state);
    setState(nextState);
    setSelectedStackIndex(null);
  }

  function chooseNextStack() {
    const nonEmpty = state.marketStacks
      .map((stack, index) => ({ stack, index }))
      .filter(({ stack }) => stack.length > 0)
      .map(({ index }) => index);
    if (nonEmpty.length === 0) return;
    if (selectedStackIndex === null) {
      setSelectedStackIndex(nonEmpty[0]);
      return;
    }
    const currentIndex = nonEmpty.indexOf(selectedStackIndex);
    const nextIndex = nonEmpty[(currentIndex + 1) % nonEmpty.length];
    setSelectedStackIndex(nextIndex);
  }

  function placeCardInCell(cellIndex) {
    if (!selectedTopCard) return;
    if (!validCells.includes(cellIndex)) return;

    pushHistorySnapshot(state);

    const nextMarket = state.marketStacks.map((stack, idx) => (
      idx === selectedStackIndex ? stack.slice(0, -1) : [...stack]
    ));
    const nextGrid = state.grid.map((pile, idx) => (
      idx === cellIndex ? [...pile, selectedTopCard] : [...pile]
    ));

    let nextDeck = [...state.deck];
    const nextDiscard = [...state.discard, selectedTopCard];

    if (nextMarket[selectedStackIndex].length === 0 && nextDeck.length > 0) {
      nextMarket[selectedStackIndex] = nextDeck.splice(0, 3);
    }

    setState({
      ...state,
      marketStacks: nextMarket,
      grid: nextGrid,
      deck: nextDeck,
      discard: nextDiscard,
      marker: 'Placement',
      round: state.round + 1,
    });

    if (nextMarket[selectedStackIndex].length === 0) {
      setSelectedStackIndex(null);
    }
  }

  function autoPlaceInFirstValidCell() {
    if (validCells.length === 0) return;
    placeCardInCell(validCells[0]);
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
        <p className="mt-2 text-center text-sm text-slate-600">Market drafting + grid stacking prototype with blueprint routing.</p>
      </div>

      <div className="w-full max-w-6xl grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_280px]">
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Status Controls</h2>
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold text-slate-700">Round marker:</span> {state.marker}</p>
              <p><span className="font-semibold text-slate-700">Deck count:</span> {state.deck.length}</p>
              <p><span className="font-semibold text-slate-700">Discard count:</span> {state.discard.length}</p>
              <p><span className="font-semibold text-slate-700">Round #:</span> {state.round}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{turnPrompt}</div>
            <div className="grid gap-2">
              <button type="button" onClick={resetMarket} className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500">Reset market</button>
              <button type="button" onClick={chooseNextStack} className="rounded bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600">Choose stack</button>
              <button type="button" onClick={autoPlaceInFirstValidCell} disabled={validCells.length === 0} className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-40">Place in cell</button>
              <button type="button" onClick={undoMove} disabled={history.length === 0} className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40">Undo</button>
              <button type="button" onClick={startNewGame} className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">New game</button>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Market Panel</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {state.marketStacks.map((stack, stackIndex) => {
                  const isSelected = selectedStackIndex === stackIndex;
                  return (
                    <button
                      type="button"
                      key={`stack-${stackIndex}`}
                      onClick={() => setSelectedStackIndex(stackIndex)}
                      className={`min-h-36 rounded-md border p-2 text-left transition ${isSelected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                    >
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Blueprint {stackIndex + 1}</p>
                      <div className="relative h-20">
                        {stack.map((card, cardIndex) => (
                          <div
                            key={card.id}
                            className={`absolute left-0 top-0 flex h-16 w-12 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-bold shadow-sm ${SUIT_COLORS[card.suit]}`}
                            style={{ transform: `translate(${cardIndex * 11}px, ${cardIndex * 2}px)` }}
                          >
                            {formatCard(card)}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Play Area Panel</h2>
              <div className="grid grid-cols-3 gap-3">
                {state.grid.map((pile, cellIndex) => {
                  const topCard = pile[pile.length - 1];
                  const isValidDrop = validCells.includes(cellIndex);
                  return (
                    <button
                      type="button"
                      key={`cell-${cellIndex}`}
                      onClick={() => placeCardInCell(cellIndex)}
                      className={`relative min-h-28 rounded-md border p-2 text-left transition ${isValidDrop ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
                    >
                      <p className="text-xs font-semibold text-slate-500">Cell {cellIndex + 1}</p>
                      <div className="relative mt-2 h-16">
                        {pile.slice(-3).map((card, idx) => (
                          <div
                            key={`${card.id}-${idx}`}
                            className={`absolute left-0 top-0 flex h-14 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-xs font-bold shadow-sm ${SUIT_COLORS[card.suit]}`}
                            style={{ transform: `translateX(${idx * 14}px)` }}
                          >
                            {formatCard(card)}
                          </div>
                        ))}
                        {!topCard && <span className="text-xs text-slate-400">Drop zone</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Endgame Panel</h2>
            <p className="mb-4 text-sm text-slate-600">Build each suit from 1 upward. Streak 5+ passes the skyway check.</p>
            <div className="space-y-2">
              {suitProgress.map((item) => (
                <div key={item.suit} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className={`font-semibold ${SUIT_COLORS[item.suit]}`}>{item.suit} sequence</span>
                  <span className="text-slate-600">len {item.streak}</span>
                  <span className={item.passed ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>{item.passed ? 'PASS' : 'FAIL'}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
    </main>
  );
}
