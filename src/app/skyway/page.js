'use client';

import { useMemo, useState } from 'react';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const MARKET_DISTRIBUTION = [2, 2, 1];
const MARKET_DEAL_ORDER = [0, 1, 2, 0, 1];
const GRID_SIZE = 9;
const MAX_STACK_HEIGHT = 3;

function shuffleCards(cards) {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    [next[i], next[swapIndex]] = [next[swapIndex], next[i]];
  }
  return next;
}

function isFaceCard(card) {
  return card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
}

export function buildStandardDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ id: `${rank}${suit}`, rank, suit })));
}

export function setupDeckState() {
  const allCards = buildStandardDeck();
  const faceCards = allCards.filter(isFaceCard);
  const nonFaceCards = allCards.filter((card) => !isFaceCard(card));

  const shuffledFaceCards = shuffleCards(faceCards);
  const roundMarkers = shuffledFaceCards.slice(0, 3);

  return {
    roundMarkers,
    removedFaceCards: shuffledFaceCards.slice(3),
    deck: shuffleCards(nonFaceCards),
    discardPile: [],
    currentRoundIndex: 0,
  };
}

export function trimCellStack(cellStack, maxHeight = MAX_STACK_HEIGHT) {
  if (cellStack.length <= maxHeight) {
    return { keptCards: [...cellStack], discardedBottomCards: [] };
  }

  const overflowCount = cellStack.length - maxHeight;
  return {
    keptCards: cellStack.slice(overflowCount),
    discardedBottomCards: cellStack.slice(0, overflowCount),
  };
}

function drawFromDeck(deck, count) {
  return {
    drawnCards: deck.slice(0, count),
    remainingDeck: deck.slice(count),
  };
}

function refillDeckForNewRound(state) {
  if (state.discardPile.length === 0 || state.currentRoundIndex >= 2) {
    return state;
  }

  return {
    ...state,
    currentRoundIndex: state.currentRoundIndex + 1,
    deck: shuffleCards(state.discardPile),
    discardPile: [],
  };
}

export function dealBlueprintMarket(state) {
  let nextState = { ...state, deck: [...state.deck], discardPile: [...state.discardPile] };
  const blueprintStacks = [[], [], []];

  for (const stackIndex of MARKET_DEAL_ORDER) {
    if (nextState.deck.length === 0) {
      if (nextState.currentRoundIndex < 2) {
        nextState = refillDeckForNewRound(nextState);
      } else {
        const cardsNeeded = 5 - blueprintStacks.flat().length;
        const finalRoundTopUp = shuffleCards(nextState.discardPile).slice(0, cardsNeeded);
        nextState = { ...nextState, discardPile: [] };
        finalRoundTopUp.forEach((card) => {
          const targetStack = MARKET_DEAL_ORDER[blueprintStacks.flat().length];
          blueprintStacks[targetStack].push(card);
        });
        break;
      }
    }

    if (nextState.deck.length === 0) {
      break;
    }

    const { drawnCards, remainingDeck } = drawFromDeck(nextState.deck, 1);
    blueprintStacks[stackIndex].push(drawnCards[0]);
    nextState.deck = remainingDeck;
  }

  return {
    ...nextState,
    blueprintStacks,
  };
}

export function applyDraftPlay(state, chosenStackIndex, targetCellIndex) {
  const pickedStack = state.blueprintStacks[chosenStackIndex] ?? [];
  const undraftedCards = state.blueprintStacks
    .filter((_, index) => index !== chosenStackIndex)
    .flat();

  const nextGrid = state.grid.map((stack, index) => {
    if (index !== targetCellIndex) return [...stack];
    const appendedStack = [...stack, ...pickedStack];
    return trimCellStack(appendedStack).keptCards;
  });

  const overflowDiscard = trimCellStack([
    ...(state.grid[targetCellIndex] ?? []),
    ...pickedStack,
  ]).discardedBottomCards;

  return {
    ...state,
    grid: nextGrid,
    blueprintStacks: [[], [], []],
    discardPile: [...state.discardPile, ...undraftedCards, ...overflowDiscard],
  };
}

function createInitialSkywayState() {
  const deckState = setupDeckState();
  const stateWithMarket = dealBlueprintMarket({
    ...deckState,
    grid: Array.from({ length: GRID_SIZE }, () => []),
    blueprintStacks: [[], [], []],
  });

  return stateWithMarket;
}

function cardLabel(card) {
  if (!card) return '—';
  return `${card.rank}${card.suit}`;
}

export default function SkywayPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [state, setState] = useState(() => createInitialSkywayState());

  const currentRoundMarker = useMemo(
    () => state.roundMarkers[state.currentRoundIndex],
    [state.roundMarkers, state.currentRoundIndex]
  );

  function resetTurnMarket() {
    setState((prevState) => dealBlueprintMarket(prevState));
  }

  function playStack(stackIndex, cellIndex) {
    setState((prevState) => applyDraftPlay(prevState, stackIndex, cellIndex));
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <a href={demosHref} className="text-sm text-blue-600 underline">Back</a>
      <h1 className="mt-2 text-3xl font-bold">Skyway</h1>
      <p className="mt-2 text-slate-700">Current round marker: {cardLabel(currentRoundMarker)}</p>
      <p className="text-slate-700">Deck: {state.deck.length} | Discard: {state.discardPile.length}</p>
      <p className="text-slate-700">Market distribution: {MARKET_DISTRIBUTION.join('-')}</p>

      <div className="mt-4 flex gap-2">
        {state.blueprintStacks.map((stack, stackIndex) => (
          <button
            key={`stack-${stackIndex}`}
            type="button"
            onClick={() => playStack(stackIndex, stackIndex)}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-left"
          >
            <div className="font-semibold">Blueprint {stackIndex + 1}</div>
            <div className="text-sm text-slate-600">{stack.map(cardLabel).join(' , ') || 'Empty'}</div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={resetTurnMarket}
        className="mt-4 rounded bg-slate-900 px-4 py-2 text-white"
      >
        Reset market
      </button>
    </main>
  );
}
