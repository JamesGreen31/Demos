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
    const direction = zombie.y === 0 ? 1 : -1;
    return [1, 2].map((step) => {
      const y = playedY + (direction * step);
      return getPileTop(cabinCards, pileIndexFromCoord(playedX, y));
    });
  }

  if (zombie.x === 0 || zombie.x === 4) {
    const direction = zombie.x === 0 ? 1 : -1;
    return [1, 2].map((step) => {
      const x = playedX + (direction * step);
      return getPileTop(cabinCards, pileIndexFromCoord(x, playedY));
    });
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

function getAttackCheck(cabinCards, pileIndex, zombie) {
  const support = getSupportCards(cabinCards, pileIndex, zombie);
  const sum = support.reduce((total, card) => total + (card.isJoker ? 0 : card.value), 0);
  const rankMatch = supportMatchesZombie(support, zombie.card);
  return {
    support,
    sum,
    rankMatch,
    canKill: sum >= 10 && rankMatch,
  };
}

function getAttackReason(check, zombieCard) {
  if (check.canKill) return '✅ legal kill';
  if (check.sum < 10) return '❌ support sum below 10';
  if (zombieCard.rank === 'Q') return '❌ queen needs both support cards to match color';
  if (zombieCard.rank === 'K') return '❌ king needs both support cards to match suit';
  return '❌ not killable';
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
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [undoState, setUndoState] = useState(null);
  const [attackInsights, setAttackInsights] = useState([]);

  const aliveZombieCount = useMemo(
    () => state.zombies.filter((zombie) => !zombie.dead).length,
    [state.zombies]
  );
  const killedCount = 12 - aliveZombieCount;
  const hasStartedGame = useMemo(() => {
    if (!isGameStarted) return false;
    return (
      state.turn > 1
      || state.phase !== 'reveal'
      || state.zombies.some((zombie) => zombie.revealed || zombie.dead)
    );
  }, [isGameStarted, state]);

  useEffect(() => {
    document.title = 'Dead Center';
  }, []);

  function startConfiguredGame() {
    setState(createInitialState(jokerCount));
    setUndoState(null);
    setAttackInsights([]);
    setIsGameStarted(true);
  }

  function restartGame() {
    if (hasStartedGame) {
      const confirmed = window.confirm('Are you sure you want to start a new game?');
      if (!confirmed) return;
    }
    setState(createInitialState(jokerCount));
    setUndoState(null);
    setAttackInsights([]);
    setIsGameStarted(false);
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

  function beginNextTurn(nextState, actionMessage = '') {
    const remaining = nextState.zombies.filter((zombie) => !zombie.dead).length;
    if (remaining === 0) {
      nextState.gameState = 'won';
      nextState.phase = 'ended';
      nextState.message = `${actionMessage}${actionMessage ? ' ' : ''}All zombies are dead. You win with ${nextState.deck.length} cards left in deck.`;
      return;
    }

    const hasFacedown = nextState.zombies.some((zombie) => !zombie.revealed && !zombie.dead);
    nextState.drawnCard = null;
    nextState.validPiles = [];
    nextState.killableTargets = [];

    if (hasFacedown) {
      setUndoState(null);
      nextState.phase = 'reveal';
      nextState.message = `${actionMessage}${actionMessage ? ' ' : ''}Turn ${nextState.turn}: reveal one facedown zombie.`;
      return;
    }

    nextState.phase = 'draw';
    nextState.message = `${actionMessage}${actionMessage ? ' ' : ''}Turn ${nextState.turn}: draw a card.`;
  }

  function revealZombie(zombieId) {
    setState((prev) => {
      if (!isGameStarted || prev.gameState !== 'playing' || prev.phase !== 'reveal') return prev;
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
      if (!isGameStarted || prev.gameState !== 'playing' || prev.phase !== 'draw') return prev;
      const next = { ...prev };
      startDrawStep(next);
      return next;
    });
  }

  function playOnPile(pileIndex) {
    setState((prev) => {
      if (!isGameStarted || prev.gameState !== 'playing' || prev.phase !== 'play') return prev;
      if (!prev.validPiles.includes(pileIndex)) return prev;

      const nextCabin = prev.cabinCards.map((pile) => pile.map((card) => ({ ...card })));
      nextCabin[pileIndex].push({ ...prev.drawnCard });

      const adjacentIds = getAdjacentZombieIds(prev.zombies, pileIndex);
      const attackChecks = adjacentIds.map((zombieId) => {
        const zombie = prev.zombies.find((entry) => entry.id === zombieId);
        if (!zombie || zombie.dead || !zombie.revealed) return null;
        return { zombie, check: getAttackCheck(nextCabin, pileIndex, zombie) };
      }).filter(Boolean);

      const killableTargets = attackChecks
        .filter(({ check }) => check.canKill)
        .map(({ zombie }) => zombie.id);

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

      setAttackInsights(attackChecks.map(({ zombie, check }) => ({
        id: zombie.id,
        zombie: cardText(zombie.card),
        support: check.support.map(cardText),
        sum: check.sum,
        reason: getAttackReason(check, zombie.card),
      })));

      if (killableTargets.length === 0) {
        setUndoState(cloneGameState(prev));
        next.turn += 1;
        beginNextTurn(next, 'No kill available from this play.');
      } else {
        setUndoState(cloneGameState(prev));
      }

      return next;
    });
  }

  function resolveAttack(zombieId = null) {
    setState((prev) => {
      if (!isGameStarted || prev.gameState !== 'playing' || prev.phase !== 'attack') return prev;

      const next = {
        ...prev,
        zombies: prev.zombies.map((zombie) => {
          if (zombieId && zombie.id === zombieId && prev.killableTargets.includes(zombieId)) {
            return { ...zombie, dead: true };
          }
          return zombie;
        }),
      };

      let actionMessage = 'You skipped the attack.';
      if (zombieId && prev.killableTargets.includes(zombieId)) {
        const killedZombie = prev.zombies.find((zombie) => zombie.id === zombieId);
        actionMessage = `You killed ${cardText(killedZombie.card)}.`;
      }

      next.turn += 1;
      beginNextTurn(next, actionMessage);
      setAttackInsights([]);
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
          <li>Aces are 1. Jokers are wild for placement and can be played on any top card.</li>
          <li>Attack strength is the sum of the two cards behind your play on that same zombie line; it must be 10+.</li>
          <li>Jack: no suit restriction. Queen: both support cards match zombie color. King: both match suit.</li>
          <li>Joker support cards count as all suits/colors, but add 0 value.</li>
        </ul>
        <details className="mt-4 rounded-lg border border-blue-300 bg-white/70 p-3">
          <summary className="cursor-pointer font-semibold text-slate-800">Show kill-direction diagram & examples</summary>
          <p className="mt-2 text-sm text-slate-700">
            Support cards must be directly behind your play, extending inward from the zombie side. Use one of these two layouts:
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-blue-200 bg-white p-3">
              <p className="font-semibold text-slate-800 text-sm mb-2">Vertical support link</p>
              <div className="mx-auto w-28 space-y-1 text-center text-xs">
                <div className="rounded border border-slate-400 bg-slate-100 p-2">zombie</div>
                <div className="rounded border border-blue-500 bg-blue-100 p-2 font-semibold">play</div>
                <div className="rounded border border-emerald-500 bg-emerald-100 p-2">sum</div>
                <div className="rounded border border-emerald-500 bg-emerald-100 p-2">sum</div>
              </div>
            </div>

            <div className="rounded-md border border-blue-200 bg-white p-3">
              <p className="font-semibold text-slate-800 text-sm mb-2">Horizontal support link</p>
              <div className="grid grid-cols-4 gap-1 text-center text-xs">
                <div className="rounded border border-slate-400 bg-slate-100 p-2">zombie</div>
                <div className="rounded border border-blue-500 bg-blue-100 p-2 font-semibold">play</div>
                <div className="rounded border border-emerald-500 bg-emerald-100 p-2">sum</div>
                <div className="rounded border border-emerald-500 bg-emerald-100 p-2">sum</div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-blue-200 bg-white p-3 text-xs text-slate-700">
            <p className="font-semibold text-slate-800 mb-1">Rank examples on that support link</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Jack</strong>: sum must be 10+; no color/suit restriction.</li>
              <li><strong>Queen</strong>: sum must be 10+ and both support cards match zombie color (joker counts as matching color).</li>
              <li><strong>King</strong>: sum must be 10+ and both support cards match zombie suit (joker counts as matching suit).</li>
              <li><strong>Joker support</strong>: counts as matching color/suit, but contributes 0 toward the sum.</li>
            </ul>
          </div>
        </details>
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
                const isPlayable = isGameStarted && state.phase === 'play' && state.validPiles.includes(pileIndex);
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
                const canReveal = isGameStarted && state.phase === 'reveal' && !zombie.revealed && !zombie.dead;
                const canAttack = isGameStarted && state.phase === 'attack' && state.killableTargets.includes(zombie.id);
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
          {!isGameStarted && (
            <>
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
                  setJokerCount(Number(event.target.value));
                }}
                className="w-full accent-blue-600"
              />
              <button
                type="button"
                onClick={startConfiguredGame}
                className="w-full rounded bg-blue-700 px-3 py-2 font-semibold text-white hover:bg-blue-600"
              >
                Start game
              </button>
            </>
          )}
          <p>Current draw: <strong>{state.drawnCard ? cardText(state.drawnCard) : '—'}</strong></p>
          <p className="text-sm text-slate-700">
            {isGameStarted
              ? state.message
              : 'Set jokers, then press Start game to begin a new run.'}
          </p>
          {attackInsights.length > 0 && (
            <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
              <p className="font-semibold text-slate-700 mb-1">Last attack check</p>
              <ul className="space-y-1">
                {attackInsights.map((insight) => (
                  <li key={insight.id}>
                    <span className="font-semibold">{insight.zombie}</span> • support [{insight.support.join(', ')}] • sum {insight.sum} • {insight.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {isGameStarted && state.phase === 'draw' && (
            <button
              type="button"
              onClick={drawCard}
              className="w-full rounded bg-blue-700 px-3 py-2 font-semibold text-white hover:bg-blue-600"
            >
              Draw card
            </button>
          )}
          {isGameStarted && state.phase === 'attack' && (
            <button
              type="button"
              onClick={() => resolveAttack(null)}
              className="w-full rounded bg-slate-700 px-3 py-2 font-semibold text-white hover:bg-slate-600"
            >
              Skip attack
            </button>
          )}
          {isGameStarted && undoState && state.gameState === 'playing' && (
            <button
              type="button"
              onClick={undoMove}
              className="w-full rounded bg-slate-700 px-3 py-2 font-semibold text-white hover:bg-slate-600"
            >
              Undo
            </button>
          )}
          <div className="mt-auto" />
          {isGameStarted && (
            <button
              type="button"
              onClick={restartGame}
              className="w-full rounded bg-slate-900 px-3 py-2 font-semibold text-white hover:bg-slate-700"
            >
              New game
            </button>
          )}
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
