'use client';

import { useEffect, useMemo, useState } from 'react';

const SUITS = ['♠', '♥', '♦', '♣'];
const ZOMBIE_RING = [
  { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
  { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 },
  { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 1, y: 4 },
  { x: 0, y: 3 }, { x: 0, y: 2 }, { x: 0, y: 1 },
];

function shuffle(cards) {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function getColor(suit) {
  return suit === '♥' || suit === '♦' ? 'red' : 'black';
}

function createCard(rank, suit, id) {
  if (rank === 'Joker') {
    return {
      id,
      rank,
      suit: null,
      color: 'wild',
      value: 0,
      isJoker: true,
    };
  }

  const valueMap = { A: 1, J: 11, Q: 12, K: 13 };
  const value = valueMap[rank] ?? Number(rank);
  return {
    id,
    rank,
    suit,
    color: getColor(suit),
    value,
    isJoker: false,
  };
}

function createInitialState(jokerCount = 2) {
  let id = 0;
  const zombies = [];
  const drawDeckBase = [];

  for (const suit of SUITS) {
    drawDeckBase.push(createCard('A', suit, ++id));
    for (let value = 2; value <= 10; value += 1) {
      drawDeckBase.push(createCard(String(value), suit, ++id));
    }
    zombies.push(createCard('J', suit, ++id));
    zombies.push(createCard('Q', suit, ++id));
    zombies.push(createCard('K', suit, ++id));
  }

  for (let joker = 0; joker < jokerCount; joker += 1) {
    drawDeckBase.push(createCard('Joker', null, ++id));
  }

  const shuffledDraw = shuffle(drawDeckBase);
  const cabinCards = shuffledDraw.slice(0, 9).map((card) => [{ ...card }]);
  const deck = shuffledDraw.slice(9).map((card) => ({ ...card }));
  const zombieDeck = shuffle(zombies).map((card, index) => ({
    id: card.id,
    card,
    ...ZOMBIE_RING[index],
    revealed: false,
    dead: false,
  }));

  return {
    cabinCards,
    deck,
    zombies: zombieDeck,
    phase: 'reveal',
    turn: 1,
    drawnCard: null,
    validPiles: [],
    killableTargets: [],
    gameState: 'playing',
    message: 'Reveal one facedown zombie to begin turn 1.',
  };
}

function cloneGameState(state) {
  return {
    cabinCards: state.cabinCards.map((pile) => pile.map((card) => ({ ...card }))),
    deck: state.deck.map((card) => ({ ...card })),
    zombies: state.zombies.map((zombie) => ({ ...zombie, card: { ...zombie.card } })),
    phase: state.phase,
    turn: state.turn,
    drawnCard: state.drawnCard ? { ...state.drawnCard } : null,
    validPiles: [...state.validPiles],
    killableTargets: [...state.killableTargets],
    gameState: state.gameState,
    message: state.message,
  };
}

function cardText(card) {
  if (!card) return '';
  if (card.isJoker) return '🃏';
  return `${card.rank}${card.suit}`;
}

function isPlayableOn(topCard, playedCard) {
  if (playedCard.isJoker || topCard.isJoker) return true;
  if (playedCard.value === topCard.value) return true;
  if (playedCard.color === topCard.color && topCard.value > playedCard.value) return true;
  if (playedCard.color !== topCard.color && topCard.value < playedCard.value) return true;
  return false;
}

function getPileTop(cabinCards, index) {
  const pile = cabinCards[index];
  return pile[pile.length - 1];
}

function pileIndexFromCoord(x, y) {
  return (y - 1) * 3 + (x - 1);
}

function getAdjacentZombieIds(zombies, pileIndex) {
  const x = (pileIndex % 3) + 1;
  const y = Math.floor(pileIndex / 3) + 1;
  return zombies
    .filter((zombie) => Math.abs(zombie.x - x) + Math.abs(zombie.y - y) === 1)
    .map((zombie) => zombie.id);
}

function getSupportCards(cabinCards, pileIndex, zombie) {
  const playedX = (pileIndex % 3) + 1;
  const playedY = Math.floor(pileIndex / 3) + 1;

  if (zombie.y === 0 || zombie.y === 4) {
    const rowY = zombie.y === 0 ? 1 : 3;
    const cards = [];
    for (let x = 1; x <= 3; x += 1) {
      if (x === playedX) continue;
      cards.push(getPileTop(cabinCards, pileIndexFromCoord(x, rowY)));
    }
    return cards;
  }

  if (zombie.x === 0 || zombie.x === 4) {
    const colX = zombie.x === 0 ? 1 : 3;
    const cards = [];
    for (let y = 1; y <= 3; y += 1) {
      if (y === playedY) continue;
      cards.push(getPileTop(cabinCards, pileIndexFromCoord(colX, y)));
    }
    return cards;
  }

  return [];
}

function supportMatchesZombie(support, zombieCard) {
  if (zombieCard.rank === 'J') return true;
  if (zombieCard.rank === 'Q') {
    return support.every((card) => card.isJoker || card.color === zombieCard.color);
  }
  if (zombieCard.rank === 'K') {
    return support.every((card) => card.isJoker || card.suit === zombieCard.suit);
  }
  return false;
}

function canKillZombie(cabinCards, pileIndex, zombie) {
  const support = getSupportCards(cabinCards, pileIndex, zombie);
  const sum = support.reduce((total, card) => total + (card.isJoker ? 0 : card.value), 0);
  if (sum < 10) return false;
  return supportMatchesZombie(support, zombie.card);
}

function getCellClasses(card) {
  if (!card) return 'border-dashed border-slate-200 bg-slate-50';
  if (card.isJoker) return 'border-violet-300 bg-violet-50';
  if (card.color === 'red') return 'border-rose-300 bg-rose-50 text-rose-800';
  return 'border-slate-300 bg-white text-slate-900';
}

export default function DeadCenterPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [jokerCount, setJokerCount] = useState(2);
  const [state, setState] = useState(() => createInitialState(2));
  const [undoState, setUndoState] = useState(null);

  const aliveZombieCount = useMemo(
    () => state.zombies.filter((zombie) => !zombie.dead).length,
    [state.zombies]
  );
  const killedCount = 12 - aliveZombieCount;

  useEffect(() => {
    document.title = 'Dead Center';
  }, []);

  function restartGame() {
    setState(createInitialState(jokerCount));
    setUndoState(null);
  }

  function restartGameWithJokers(nextJokerCount) {
    setState(createInitialState(nextJokerCount));
    setUndoState(null);
  }

  function undoMove() {
    if (!undoState) return;
    setState(cloneGameState(undoState));
    setUndoState(null);
  }

  function startDrawStep(nextState) {
    if (nextState.deck.length === 0) {
      setUndoState(null);
      nextState.gameState = 'lost';
      nextState.phase = 'ended';
      nextState.message = 'You need to draw, but the deck is empty. You lose.';
      return;
    }

    const drawnCard = nextState.deck[0];
    const remainingDeck = nextState.deck.slice(1);
    const validPiles = nextState.cabinCards
      .map((_, index) => index)
      .filter((index) => isPlayableOn(getPileTop(nextState.cabinCards, index), drawnCard));

    if (validPiles.length === 0) {
      setUndoState(null);
      nextState.deck = remainingDeck;
      nextState.drawnCard = drawnCard;
      nextState.gameState = 'lost';
      nextState.phase = 'ended';
      nextState.message = `Drew ${cardText(drawnCard)} but it has no legal pile. You lose.`;
      return;
    }

    nextState.deck = remainingDeck;
    nextState.drawnCard = drawnCard;
    nextState.validPiles = validPiles;
    nextState.phase = 'play';
    nextState.message = `Turn ${nextState.turn}: play ${cardText(drawnCard)} on a highlighted pile.`;
  }

  function beginNextTurn(nextState) {
    const remaining = nextState.zombies.filter((zombie) => !zombie.dead).length;
    if (remaining === 0) {
      nextState.gameState = 'won';
      nextState.phase = 'ended';
      nextState.message = `All zombies are dead. You win with ${nextState.deck.length} cards left in deck.`;
      return;
    }

    const hasFacedown = nextState.zombies.some((zombie) => !zombie.revealed && !zombie.dead);
    nextState.drawnCard = null;
    nextState.validPiles = [];
    nextState.killableTargets = [];

    if (hasFacedown) {
      setUndoState(null);
      nextState.phase = 'reveal';
      nextState.message = `Turn ${nextState.turn}: reveal one facedown zombie.`;
      return;
    }

    nextState.phase = 'draw';
    nextState.message = `Turn ${nextState.turn}: draw a card.`;
  }

  function revealZombie(zombieId) {
    setState((prev) => {
      if (prev.gameState !== 'playing' || prev.phase !== 'reveal') return prev;
      const zombie = prev.zombies.find((entry) => entry.id === zombieId);
      if (!zombie || zombie.revealed || zombie.dead) return prev;

      const next = {
        ...prev,
        zombies: prev.zombies.map((entry) => (entry.id === zombieId ? { ...entry, revealed: true } : entry)),
      };
      setUndoState(null);
      next.phase = 'draw';
      next.message = `Turn ${next.turn}: draw a card.`;
      return next;
    });
  }


  function drawCard() {
    setState((prev) => {
      if (prev.gameState !== 'playing' || prev.phase !== 'draw') return prev;
      const next = { ...prev };
      startDrawStep(next);
      return next;
    });
  }

  function playOnPile(pileIndex) {
    setState((prev) => {
      if (prev.gameState !== 'playing' || prev.phase !== 'play') return prev;
      if (!prev.validPiles.includes(pileIndex)) return prev;

      const nextCabin = prev.cabinCards.map((pile) => pile.map((card) => ({ ...card })));
      nextCabin[pileIndex].push({ ...prev.drawnCard });

      const adjacentIds = getAdjacentZombieIds(prev.zombies, pileIndex);
      const killableTargets = adjacentIds.filter((zombieId) => {
        const zombie = prev.zombies.find((entry) => entry.id === zombieId);
        if (!zombie || zombie.dead || !zombie.revealed) return false;
        return canKillZombie(nextCabin, pileIndex, zombie);
      });

      const next = {
        ...prev,
        cabinCards: nextCabin,
        phase: killableTargets.length > 0 ? 'attack' : 'resolve',
        killableTargets,
        validPiles: [],
        message: killableTargets.length > 0
          ? 'Attack phase: choose one adjacent zombie to kill, or skip.'
          : 'No kill available from this play.',
      };

      if (killableTargets.length === 0) {
        setUndoState(cloneGameState(prev));
        next.turn += 1;
        beginNextTurn(next);
      } else {
        setUndoState(cloneGameState(prev));
      }

      return next;
    });
  }

  function resolveAttack(zombieId = null) {
    setState((prev) => {
      if (prev.gameState !== 'playing' || prev.phase !== 'attack') return prev;

      const next = {
        ...prev,
        zombies: prev.zombies.map((zombie) => {
          if (zombieId && zombie.id === zombieId && prev.killableTargets.includes(zombieId)) {
            return { ...zombie, dead: true };
          }
          return zombie;
        }),
      };

      if (zombieId && prev.killableTargets.includes(zombieId)) {
        const killedZombie = prev.zombies.find((zombie) => zombie.id === zombieId);
        next.message = `You killed ${cardText(killedZombie.card)}.`;
      } else {
        next.message = 'You skipped the attack.';
      }

      next.turn += 1;
      beginNextTurn(next);
      setUndoState(cloneGameState(prev));
      return next;
    });
  }

  const zombieByCell = useMemo(() => {
    const map = new Map();
    for (const zombie of state.zombies) {
      map.set(`${zombie.x}-${zombie.y}`, zombie);
    }
    return map;
  }, [state.zombies]);

  return (
    <main className="min-h-screen p-6 md:p-8 flex flex-col items-center gap-5">
      <div className="w-full max-w-6xl flex items-center justify-start">
        <button
          type="button"
          onClick={() => window.location.assign(demosHref)}
          className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800"
        >
          ← Back
        </button>
      </div>

      <h1 className="text-3xl font-bold text-center">Dead Center</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">What is Dead Center?</h2>
        <p className="text-slate-700 mb-2">
          Dead Center is a solo card-defense puzzle where your 3×3 cabin is surrounded by 12 zombies.
          Each turn you reveal threats, play a drawn card on a valid cabin pile, then try to kill an
          adjacent zombie using support cards on the same line.
        </p>
        <p className="text-slate-700">
          This demo follows the Isaludo rules and uses the Loot-The-Loop visual style so it reads as a
          consistent demo package.
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to play</h2>
        <ul className="list-disc pl-5 space-y-1 text-slate-700">
          <li>Placement: equal value, same-color onto higher value, or opposite-color onto lower value.</li>
          <li>Aces are 1. Jokers are wild for placement and can be played on or under any card.</li>
          <li>Attack strength is the sum of the two support cards on the matching line; it must be 10+.</li>
          <li>Jack: no suit restriction. Queen: both support cards match zombie color. King: both match suit.</li>
          <li>Joker support cards count as all suits/colors, but add 0 value.</li>
        </ul>
      </section>

      <section className="w-full max-w-6xl grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xl font-semibold mb-3">Cabin and zombie ring</h2>
          <div className="grid grid-cols-5 gap-2 max-w-xl">
            {Array.from({ length: 25 }, (_, index) => {
              const x = index % 5;
              const y = Math.floor(index / 5);
              const isCabin = x >= 1 && x <= 3 && y >= 1 && y <= 3;
              const zombie = zombieByCell.get(`${x}-${y}`);

              if (isCabin) {
                const pileIndex = pileIndexFromCoord(x, y);
                const topCard = getPileTop(state.cabinCards, pileIndex);
                const isPlayable = state.phase === 'play' && state.validPiles.includes(pileIndex);
                return (
                  <button
                    key={`${x}-${y}`}
                    type="button"
                    onClick={() => playOnPile(pileIndex)}
                    disabled={!isPlayable}
                    className={`h-20 rounded border p-1 text-sm ${getCellClasses(topCard)} ${isPlayable ? 'ring-2 ring-blue-400' : ''}`}
                    title={`Pile ${pileIndex + 1} (${state.cabinCards[pileIndex].length} cards)`}
                  >
                    <div className="font-semibold">{cardText(topCard)}</div>
                    <div className="text-xs text-slate-500">pile {pileIndex + 1}</div>
                  </button>
                );
              }

              if (zombie) {
                const canReveal = state.phase === 'reveal' && !zombie.revealed && !zombie.dead;
                const canAttack = state.phase === 'attack' && state.killableTargets.includes(zombie.id);
                return (
                  <button
                    key={`${x}-${y}`}
                    type="button"
                    onClick={() => {
                      if (canReveal) revealZombie(zombie.id);
                      if (canAttack) resolveAttack(zombie.id);
                    }}
                    disabled={!canReveal && !canAttack}
                    className={`h-20 rounded border p-1 text-sm ${zombie.dead ? 'bg-emerald-100 border-emerald-300' : 'bg-slate-100 border-slate-300'} ${canReveal || canAttack ? 'ring-2 ring-slate-400' : ''}`}
                  >
                    {!zombie.revealed && !zombie.dead && <span className="text-xl">🂠</span>}
                    {zombie.revealed && !zombie.dead && (
                      <span className={`text-lg font-semibold ${zombie.card.color === 'red' ? 'text-rose-700' : ''}`}>
                        {cardText(zombie.card)}
                      </span>
                    )}
                    {zombie.dead && <span className="text-xs font-semibold text-emerald-700">dead</span>}
                  </button>
                );
              }

              return <div key={`${x}-${y}`} className="h-20 rounded border border-dashed border-slate-200 bg-slate-50" />;
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2 flex flex-col">
          <h2 className="text-xl font-semibold">Status</h2>
          <p>Game: <strong>{state.gameState}</strong></p>
          <p>Phase: <strong>{state.phase}</strong></p>
          <p>Turn: <strong>{state.turn}</strong></p>
          <p>Zombies killed: <strong>{killedCount}/12</strong></p>
          <p>Deck remaining: <strong>{state.deck.length}</strong></p>
          <label htmlFor="joker-count" className="text-sm text-slate-700">
            Jokers in deck: <strong>{jokerCount}</strong>
          </label>
          <input
            id="joker-count"
            type="range"
            min={0}
            max={2}
            step={1}
            value={jokerCount}
            onChange={(event) => {
              const nextJokerCount = Number(event.target.value);
              setJokerCount(nextJokerCount);
              restartGameWithJokers(nextJokerCount);
            }}
            className="w-full accent-blue-600"
          />
          <p>Current draw: <strong>{state.drawnCard ? cardText(state.drawnCard) : '—'}</strong></p>
          <p className="text-sm text-slate-700">{state.message}</p>
          {state.phase === 'draw' && (
            <button
              type="button"
              onClick={drawCard}
              className="w-full rounded bg-blue-700 px-3 py-2 font-semibold text-white hover:bg-blue-600"
            >
              Draw card
            </button>
          )}
          {state.phase === 'attack' && (
            <button
              type="button"
              onClick={() => resolveAttack(null)}
              className="w-full rounded bg-slate-700 px-3 py-2 font-semibold text-white hover:bg-slate-600"
            >
              Skip attack
            </button>
          )}
          {undoState && state.gameState === 'playing' && (
            <button
              type="button"
              onClick={undoMove}
              className="w-full rounded bg-slate-700 px-3 py-2 font-semibold text-white hover:bg-slate-600"
            >
              Undo
            </button>
          )}
          <div className="mt-auto" />
          <button
            type="button"
            onClick={restartGame}
            className="w-full rounded bg-slate-900 px-3 py-2 font-semibold text-white hover:bg-slate-700"
          >
            New game
          </button>
        </div>
      </section>

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
