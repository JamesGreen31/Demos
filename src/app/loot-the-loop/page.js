'use client';

import { useEffect, useMemo, useState } from 'react';

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
  const [undoStack, setUndoStack] = useState([]);
  const [hoveredExploreValue, setHoveredExploreValue] = useState(null);
  const [isMarkHovered, setIsMarkHovered] = useState(false);
  const [returnLocked, setReturnLocked] = useState(false);
  const [visibleRooms, setVisibleRooms] = useState(16);

  const jewelsCollected = useMemo(
    () => score.filter((card) => card.type === 'jewel').length,
    [score]
  );
  const canEscape = jewelsCollected === 4;
  const exploreValues = useMemo(() => availableExploreValues(deck), [deck]);

  useEffect(() => {
    document.title = 'Loot-The-Loop';
  }, []);

  useEffect(() => {
    setVisibleRooms((prev) => {
      const minimum = Math.min(6, deck.length);
      if (prev < minimum) return minimum;
      if (prev > deck.length) return deck.length;
      return prev;
    });
  }, [deck.length]);

  function resetGame() {
    setDeck(createTempleDeck());
    setNotes([]);
    setScore([]);
    setGameState('playing');
    setMessage('Look around to reveal the first two rooms.');
    setUndoStack([]);
    setHoveredExploreValue(null);
    setIsMarkHovered(false);
    setReturnLocked(false);
  }

  function pushUndoSnapshot() {
    const snapshot = cloneStateSnapshot({ deck, notes, score, gameState, message });
    setUndoStack((prev) => [...prev, snapshot]);
  }

  function applyAndCheck(nextDeck, nextNotes, nextScore, nextMessage) {
    if (gameState !== 'playing') return;

    if (computeStuck(nextDeck, nextNotes)) {
      setDeck(nextDeck);
      setNotes(nextNotes);
      setScore(nextScore);
      setMessage('No legal actions remain. You are trapped in the temple.');
      setGameState('lost');
      return;
    }

    setDeck(nextDeck);
    setNotes(nextNotes);
    setScore(nextScore);
    setMessage(nextMessage);
  }

  function handleLookAround() {
    if (gameState !== 'playing') return;
    if (!deck[0] || deck[0].faceUp) return;

    const nextDeck = deck.map((card) => ({ ...card }));
    nextDeck[0].faceUp = true;
    if (nextDeck[1] && !nextDeck[1].faceUp) {
      nextDeck[1].faceUp = true;
    }

    setUndoStack([]);
    setReturnLocked(false);
    applyAndCheck(nextDeck, notes, score, 'You scan ahead and map more of the temple loop.');
  }

  function handleMarkPath() {
    if (gameState !== 'playing') return;
    if (!deck[0]?.faceUp || deck[0].type !== 'path' || notes.length >= 3) return;

    pushUndoSnapshot();
    const nextDeck = deck.slice(1).map((card) => ({ ...card }));
    const nextNotes = [...notes.map((card) => ({ ...card })), { ...deck[0], faceUp: true }];
    applyAndCheck(nextDeck, nextNotes, score.map((card) => ({ ...card })), 'Path marked in your notes.');
  }

  function handleReturnPath(index) {
    if (gameState !== 'playing') return;
    if (returnLocked) return;
    if (index < 0 || index >= notes.length) return;

    pushUndoSnapshot();
    const restored = { ...notes[index], faceUp: true };
    const nextNotes = notes.filter((_, i) => i !== index).map((card) => ({ ...card }));
    const nextDeck = [restored, ...deck.map((card) => ({ ...card }))];
    setReturnLocked(true);
    applyAndCheck(nextDeck, nextNotes, score.map((card) => ({ ...card })), `Returned ${restored.rank}${restored.suit} to the top.`);
  }

  function handleExplore(value) {
    if (gameState !== 'playing') return;
    if (!exploreValues.includes(value) || value > deck.length) return;

    pushUndoSnapshot();
    setReturnLocked(false);

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
      setMessage('💀 You landed on a trap. Undo is available.');
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
        return;
      }
      nextMessage = 'You found the exit, but it is still sealed without all four jewels.';
    }

    applyAndCheck(nextDeck, notes.map((card) => ({ ...card })), nextScore, nextMessage);
  }

  function getExplorePreviewState(value) {
    if (!exploreValues.includes(value) || value > deck.length) return { kind: null, index: null };

    const moved = deck.slice(0, value).map((card) => ({ ...card }));
    const previewDeck = [...deck.slice(value).map((card) => ({ ...card })), ...moved];
    const previewScore = score.map((card) => ({ ...card }));

    const landed = previewDeck[0];
    if (landed?.faceUp && landed.type === 'trap') {
      return { kind: 'death', index: value % deck.length };
    }

    if (landed?.faceUp && landed.type === 'jewel') {
      return { kind: 'quest', index: value % deck.length };
    }

    if (landed?.faceUp && landed.type === 'path') {
      return { kind: 'capture', index: value % deck.length };
    }

    if (landed?.faceUp && landed.type === 'exit') {
      return { kind: canEscape ? 'quest' : 'landing', index: value % deck.length };
    }

    if (landed?.faceUp && (landed.type === 'jewel' || landed.type === 'path')) {
      previewScore.push(previewDeck.shift());
    }

    if (computeStuck(previewDeck, notes)) {
      return { kind: 'death', index: value % deck.length };
    }

    return { kind: 'landing', index: value % deck.length };
  }

  function handleUndoMove() {
    const snapshot = undoStack[undoStack.length - 1];
    if (!snapshot) return;
    setDeck(snapshot.deck.map((card) => ({ ...card })));
    setNotes(snapshot.notes.map((card) => ({ ...card })));
    setScore(snapshot.score.map((card) => ({ ...card })));
    setGameState(snapshot.gameState);
    setMessage(snapshot.message);
    setUndoStack((prev) => prev.slice(0, -1));
    setHoveredExploreValue(null);
    setIsMarkHovered(false);
    setReturnLocked(false);
  }

  const hoveredExplorePreview = hoveredExploreValue ? getExplorePreviewState(hoveredExploreValue) : { kind: null, index: null };
  const hoveredExploreLandingIndex = hoveredExplorePreview.index;
  const markCaptureIndex = isMarkHovered && deck[0]?.faceUp && deck[0].type === 'path' && notes.length < 3 && !returnLocked ? 0 : null;

  function getHighlightClass(index) {
    if (index === hoveredExploreLandingIndex) {
      if (hoveredExplorePreview.kind === 'death') return 'bg-red-200 border-red-400';
      if (hoveredExplorePreview.kind === 'quest') return 'bg-emerald-200 border-emerald-400';
      if (hoveredExplorePreview.kind === 'capture') return 'bg-yellow-100 border-yellow-400';
      if (hoveredExplorePreview.kind === 'landing') return 'bg-sky-200 border-sky-400';
    }

    if (index === markCaptureIndex) {
      return 'bg-yellow-100 border-yellow-400';
    }

    return '';
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

      <h1 className="text-3xl font-bold text-center">Loot-The-Loop</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">What is Loot the Loop?</h2>
        <p className="text-slate-700 mb-3">
          Loot the Loop is a solo route-planning puzzle. You move through a circular temple deck,
          reveal information gradually, and try to collect all four jewels before escaping.
        </p>
        <p className="text-slate-700">
          The deck&apos;s top card is your current room. Movement always wraps around the loop, so each
          action changes what you can safely reach next.
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>
            Start with <strong>Look Around</strong> to flip the top two rooms. This is the only action that
            reveals new hidden information.
          </li>
          <li>
            Use <strong>Explore X</strong> where X comes from visible number rooms in the top two cards.
            Movement counts from the top card.
          </li>
          <li>
            Use <strong>Mark Path</strong> to save the current top number room (up to 3), then
            <strong> Return</strong> a saved path to the top when you need to adjust timing.
          </li>
          <li>
            Use the <strong>Rooms shown</strong> slider above the board to limit how many cards are rendered,
            which makes planning easier on smaller screens.
          </li>
          <li>
            Collect 💎 jewels and other face-up loot by landing on them. Avoid 💀 traps. Reach the exit
            after collecting all four jewels to win.
          </li>
          <li>
            The exit appears as a <strong>stone (🪨)</strong> until all four jewels are collected. Once you
            have all jewels, it changes to <strong>stairs (🪜)</strong> and you can escape by landing on it.
          </li>
          <li>
            <strong>Undo</strong> is available for actions after the latest reveal, and is reset when you use
            <strong> Look Around</strong>.
          </li>
        </ul>
      </section>

      <section className="w-full max-w-6xl grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xl font-semibold mb-3">Temple Loop (top first)</h2>
          <label className="mb-3 block text-sm text-slate-700" htmlFor="rooms-visible-slider">
            Rooms shown: <strong>{Math.min(visibleRooms, deck.length)}</strong>
          </label>
          <input
            id="rooms-visible-slider"
            type="range"
            min={Math.min(6, deck.length)}
            max={deck.length}
            value={Math.min(visibleRooms, deck.length)}
            onChange={(event) => setVisibleRooms(Number(event.target.value))}
            className="mb-4 w-full accent-blue-600"
          />
          <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-13 gap-2">
            {deck.slice(0, visibleRooms).map((card, index) => (
              <div
                key={card.id}
                className={`rounded-md border p-2 text-center text-sm ${
                  index === 0 ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-50'
                } ${getHighlightClass(index)}`}
                title={describeCard(card)}
              >
                <div className="font-semibold">{index === 0 ? 'You' : `+${index}`}</div>
                <div className="text-lg">{cardLabel(card, canEscape)}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Showing {Math.min(visibleRooms, deck.length)} of {deck.length} rooms currently remaining in the loop.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-xl font-semibold">Status</h2>
          <p>State: <strong>{gameState}</strong></p>
          <p>Jewels: <strong>{jewelsCollected}/4</strong></p>
          <p>Looted cards: <strong>{score.length}</strong></p>
          <p className="text-sm text-slate-700">{message}</p>
          {undoStack.length > 0 && (
            <button
              type="button"
              onClick={handleUndoMove}
              className="w-full rounded bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-500"
            >
              Undo move
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
            className="rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-500 disabled:opacity-40"
          >
            Look Around
          </button>

          <button
            type="button"
            onClick={handleMarkPath}
            onMouseEnter={() => setIsMarkHovered(true)}
            onMouseLeave={() => setIsMarkHovered(false)}
            disabled={
              gameState !== 'playing' || !deck[0]?.faceUp || deck[0].type !== 'path' || notes.length >= 3 || returnLocked
            }
            className="rounded bg-slate-700 px-3 py-2 text-white hover:bg-slate-600 disabled:opacity-40"
          >
            Mark Path
          </button>

          {exploreValues.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleExplore(value)}
              onMouseEnter={() => setHoveredExploreValue(value)}
              onMouseLeave={() => setHoveredExploreValue(null)}
              disabled={gameState !== 'playing'}
              className="rounded bg-blue-700 px-3 py-2 text-white hover:bg-blue-600 disabled:opacity-40"
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
                disabled={gameState !== 'playing' || returnLocked}
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
              </span>
            ))}
          </div>
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
