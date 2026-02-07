'use client';

import { useMemo, useState } from 'react';

const SUITS = ['♠', '♥', '♦', '♣'];

function shuffle(cards) {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function createTempleDeck() {
  let id = 0;
  const deck = [];

  for (const suit of SUITS) {
    deck.push({ id: id += 1, rank: 'A', suit, type: 'jewel', faceUp: false });
    for (let value = 2; value <= 10; value += 1) {
      deck.push({ id: id += 1, rank: String(value), suit, type: 'path', value, faceUp: false });
    }
    deck.push({ id: id += 1, rank: 'J', suit, type: 'trap', faceUp: false });
    deck.push({ id: id += 1, rank: 'Q', suit, type: 'trap', faceUp: false });
    deck.push({ id: id += 1, rank: 'K', suit, type: 'trap', faceUp: false });
  }

  deck.push({ id: id += 1, rank: 'Joker', suit: '', type: 'exit', faceUp: false });
  return shuffle(deck);
}

function cloneStateSnapshot(state) {
  return {
    deck: state.deck.map((card) => ({ ...card })),
    notes: state.notes.map((card) => ({ ...card })),
    score: state.score.map((card) => ({ ...card })),
    gameState: state.gameState,
    message: state.message,
  };
}

function cardLabel(card, canEscape) {
  if (!card.faceUp) return '❓';
  if (card.type === 'trap') return '💀';
  if (card.type === 'jewel') return '💎';
  if (card.type === 'exit') return canEscape ? '🪜' : '🪨';
  return card.value;
}

function describeCard(card) {
  if (!card.faceUp) return 'Hidden';
  if (card.type === 'trap') return `Trap ${card.rank}${card.suit}`;
  if (card.type === 'jewel') return `Jewel ${card.rank}${card.suit}`;
  if (card.type === 'exit') return 'Temple exit';
  return `Path ${card.rank}${card.suit}`;
}

function availableExploreValues(deck) {
  const topTwo = deck.slice(0, 2);
  return [...new Set(topTwo.filter((card) => card?.faceUp && card.type === 'path').map((card) => card.value))];
}

function computeStuck(deck, notes) {
  const canLookAround = deck[0] && !deck[0].faceUp;
  const canMark = deck[0]?.faceUp && deck[0].type === 'path' && notes.length < 3;
  const canExplore = availableExploreValues(deck).length > 0;
  const canReturn = notes.length > 0;
  return !canLookAround && !canMark && !canExplore && !canReturn;
}

export default function LootTheLoopPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [deck, setDeck] = useState(() => createTempleDeck());
  const [notes, setNotes] = useState([]);
  const [score, setScore] = useState([]);
  const [gameState, setGameState] = useState('playing');
  const [message, setMessage] = useState('Look around to reveal the first two rooms.');
  const [undoSnapshot, setUndoSnapshot] = useState(null);

  const jewelsCollected = useMemo(
    () => score.filter((card) => card.type === 'jewel').length,
    [score]
  );
  const canEscape = jewelsCollected === 4;
  const exploreValues = useMemo(() => availableExploreValues(deck), [deck]);

  function resetGame() {
    setDeck(createTempleDeck());
    setNotes([]);
    setScore([]);
    setGameState('playing');
    setMessage('Look around to reveal the first two rooms.');
    setUndoSnapshot(null);
  }

  function applyAndCheck(nextDeck, nextNotes, nextScore, nextMessage) {
    if (gameState !== 'playing') return;

    if (computeStuck(nextDeck, nextNotes)) {
      setDeck(nextDeck);
      setNotes(nextNotes);
      setScore(nextScore);
      setMessage('No legal actions remain. You are trapped in the temple.');
      setGameState('lost');
      setUndoSnapshot(null);
      return;
    }

    setDeck(nextDeck);
    setNotes(nextNotes);
    setScore(nextScore);
    setMessage(nextMessage);
    setUndoSnapshot(null);
  }

  function handleLookAround() {
    if (gameState !== 'playing') return;
    if (!deck[0] || deck[0].faceUp) return;

    const nextDeck = deck.map((card) => ({ ...card }));
    nextDeck[0].faceUp = true;
    if (nextDeck[1] && !nextDeck[1].faceUp) {
      nextDeck[1].faceUp = true;
    }

    applyAndCheck(nextDeck, notes, score, 'You scan ahead and map more of the temple loop.');
  }

  function handleMarkPath() {
    if (gameState !== 'playing') return;
    if (!deck[0]?.faceUp || deck[0].type !== 'path' || notes.length >= 3) return;

    const nextDeck = deck.slice(1).map((card) => ({ ...card }));
    const nextNotes = [...notes.map((card) => ({ ...card })), { ...deck[0], faceUp: true }];
    applyAndCheck(nextDeck, nextNotes, score.map((card) => ({ ...card })), 'Path marked in your notes.');
  }

  function handleReturnPath(index) {
    if (gameState !== 'playing') return;
    if (index < 0 || index >= notes.length) return;

    const restored = { ...notes[index], faceUp: true };
    const nextNotes = notes.filter((_, i) => i !== index).map((card) => ({ ...card }));
    const nextDeck = [restored, ...deck.map((card) => ({ ...card }))];
    applyAndCheck(nextDeck, nextNotes, score.map((card) => ({ ...card })), `Returned ${restored.rank}${restored.suit} to the top.`);
  }

  function handleExplore(value) {
    if (gameState !== 'playing') return;
    if (!exploreValues.includes(value) || value > deck.length) return;

    const snapshot = cloneStateSnapshot({ deck, notes, score, gameState, message });

    const moved = deck.slice(0, value).map((card) => ({ ...card }));
    const nextDeck = [...deck.slice(value).map((card) => ({ ...card })), ...moved];
    const nextScore = score.map((card) => ({ ...card }));

    const landed = nextDeck[0];
    let nextMessage = `Explored ${value} rooms.`;

    if (landed?.faceUp && landed.type === 'trap') {
      setDeck(nextDeck);
      setNotes(notes.map((card) => ({ ...card })));
      setScore(nextScore);
      setGameState('lost');
      setMessage('💀 You landed on a trap. Undo is available because no new information was revealed.');
      setUndoSnapshot(snapshot);
      return;
    }

    if (landed?.faceUp && (landed.type === 'jewel' || landed.type === 'path')) {
      const collected = nextDeck.shift();
      nextScore.push(collected);
      nextMessage = collected.type === 'jewel' ? '💎 You secured a royal jewel!' : `Collected path trinket ${collected.rank}${collected.suit}.`;
    }

    if (landed?.faceUp && landed.type === 'exit') {
      const jewels = nextScore.filter((card) => card.type === 'jewel').length;
      if (jewels === 4) {
        setDeck(nextDeck);
        setNotes(notes.map((card) => ({ ...card })));
        setScore(nextScore);
        setGameState('won');
        setMessage('🪜 You found the exit with all four jewels and escaped!');
        setUndoSnapshot(null);
        return;
      }
      nextMessage = 'You found the exit, but it is still sealed without all four jewels.';
    }

    applyAndCheck(nextDeck, notes.map((card) => ({ ...card })), nextScore, nextMessage);
  }

  function handleUndoFatalMove() {
    if (!undoSnapshot) return;
    setDeck(undoSnapshot.deck.map((card) => ({ ...card })));
    setNotes(undoSnapshot.notes.map((card) => ({ ...card })));
    setScore(undoSnapshot.score.map((card) => ({ ...card })));
    setGameState('playing');
    setMessage('Fatal move rewound. Choose a safer action.');
    setUndoSnapshot(null);
  }

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

      <h1 className="text-3xl font-bold text-center">Loot the Loop</h1>

      <section className="w-full max-w-6xl grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xl font-semibold mb-3">Temple Loop (top first)</h2>
          <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {deck.slice(0, 20).map((card, index) => (
              <div
                key={card.id}
                className={`rounded-md border p-2 text-center text-sm ${
                  index === 0 ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-50'
                }`}
                title={describeCard(card)}
              >
                <div className="font-semibold">{index === 0 ? 'You' : `+${index}`}</div>
                <div className="text-lg">{cardLabel(card, canEscape)}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Showing first 20 rooms of {deck.length} remaining in the loop.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-xl font-semibold">Status</h2>
          <p>State: <strong>{gameState}</strong></p>
          <p>Jewels: <strong>{jewelsCollected}/4</strong></p>
          <p>Looted cards: <strong>{score.length}</strong></p>
          <p className="text-sm text-slate-700">{message}</p>
          {gameState === 'lost' && undoSnapshot && (
            <button
              type="button"
              onClick={handleUndoFatalMove}
              className="w-full rounded bg-amber-500 px-3 py-2 font-semibold text-white hover:bg-amber-600"
            >
              Undo fatal move
            </button>
          )}
        </div>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-xl font-semibold">Actions</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleLookAround}
            disabled={gameState !== 'playing' || !deck[0] || deck[0].faceUp}
            className="rounded bg-sky-600 px-3 py-2 text-white disabled:opacity-40"
          >
            Look Around
          </button>

          <button
            type="button"
            onClick={handleMarkPath}
            disabled={
              gameState !== 'playing' || !deck[0]?.faceUp || deck[0].type !== 'path' || notes.length >= 3
            }
            className="rounded bg-emerald-600 px-3 py-2 text-white disabled:opacity-40"
          >
            Mark Path
          </button>

          {exploreValues.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleExplore(value)}
              disabled={gameState !== 'playing'}
              className="rounded bg-violet-600 px-3 py-2 text-white disabled:opacity-40"
            >
              Explore {value}
            </button>
          ))}

          <button
            type="button"
            className="ml-auto rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
            onClick={resetGame}
          >
            New Game
          </button>
        </div>
      </section>

      <section className="w-full max-w-6xl grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xl font-semibold mb-3">Marked paths ({notes.length}/3)</h2>
          <div className="flex flex-wrap gap-2">
            {notes.length === 0 && <p className="text-sm text-slate-500">No saved paths yet.</p>}
            {notes.map((card, index) => (
              <button
                key={card.id}
                type="button"
                onClick={() => handleReturnPath(index)}
                disabled={gameState !== 'playing'}
                className="rounded border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50 disabled:opacity-40"
                title="Return this path to top"
              >
                Return {card.rank}
                {card.suit}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xl font-semibold mb-3">Score pile</h2>
          <div className="flex flex-wrap gap-2">
            {score.length === 0 && <p className="text-sm text-slate-500">No loot collected yet.</p>}
            {score.map((card) => (
              <span key={card.id} className="rounded bg-amber-100 px-2 py-1 text-sm">
                {cardLabel({ ...card, faceUp: true }, canEscape)} {card.rank}
                {card.suit}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
