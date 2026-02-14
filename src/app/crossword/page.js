'use client';

import { useMemo, useState } from 'react';

const MIN_SIZE = 8;
const MAX_SIZE = 18;
const MIN_WORDS = 4;
const MAX_WORDS = 14;

const WORD_BANK = [
  'ALGORITHM', 'BROWSER', 'CACHE', 'CODING', 'COMPILER', 'CONTAINER', 'CRYPTIC', 'DEBUG', 'DEPLOY',
  'DIAGONAL', 'FUNCTION', 'FRONTEND', 'GAMEPLAY', 'GRID', 'HOOKS', 'JAVASCRIPT', 'KEYBOARD', 'LOGIC',
  'MODULE', 'NETWORK', 'NEXTJS', 'PACKAGE', 'PATTERN', 'PUZZLE', 'RANDOM', 'REACT', 'RENDER', 'ROUTER',
  'SEARCH', 'SELECTION', 'SERVER', 'SOLVER', 'STACK', 'STATE', 'STYLING', 'SYNTAX', 'TAILWIND', 'TOKEN',
  'TOOLING', 'TYPES', 'VARIABLE', 'VECTOR', 'VERTICAL', 'WEBPACK', 'WEBSITE', 'WORD', 'HORIZONTAL',
  'CHALLENGE', 'SCRIPT', 'MATRIX', 'INDEX', 'OBJECT', 'STRING', 'BUTTON', 'LAYOUT', 'SECTION', 'PLAYER',
  'CROSSWORD', 'DIRECTION', 'RESOLVE', 'RESET', 'NEWGAME', 'CONFIG', 'BOARD', 'HIGHLIGHT', 'DISCOVER',
];

const DIRECTIONS = [
  [0, 1], [1, 0], [0, -1], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function inBounds(row, col, size) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

function cellsForPlacement(startRow, startCol, dx, dy, length) {
  return Array.from({ length }, (_, offset) => [startRow + (dx * offset), startCol + (dy * offset)]);
}

function buildPuzzle(size, requestedCount) {
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const availableWords = shuffle(WORD_BANK.filter((word) => word.length <= size));
  const selectedWords = availableWords.slice(0, Math.min(requestedCount, availableWords.length));
  const placements = [];

  selectedWords.forEach((word) => {
    let placed = false;

    for (let attempt = 0; attempt < 300 && !placed; attempt += 1) {
      const [dx, dy] = DIRECTIONS[randomInt(DIRECTIONS.length)];
      const startRow = randomInt(size);
      const startCol = randomInt(size);
      const cells = cellsForPlacement(startRow, startCol, dx, dy, word.length);

      const valid = cells.every(([row, col], offset) => (
        inBounds(row, col, size) && (grid[row][col] === '' || grid[row][col] === word[offset])
      ));

      if (!valid) continue;

      cells.forEach(([row, col], offset) => {
        grid[row][col] = word[offset];
      });

      placements.push({ word, cells });
      placed = true;
    }
  });

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!grid[row][col]) {
        grid[row][col] = String.fromCharCode(65 + randomInt(26));
      }
    }
  }

  return {
    size,
    grid,
    placements,
    words: placements.map((item) => item.word),
  };
}

function cellKey(row, col) {
  return `${row}-${col}`;
}

export default function CrosswordPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [size, setSize] = useState(12);
  const [wordCount, setWordCount] = useState(8);
  const [game, setGame] = useState(() => buildPuzzle(12, 8));
  const [foundWords, setFoundWords] = useState([]);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [status, setStatus] = useState('Find the hidden words by selecting start and end letters.');

  const foundSet = useMemo(() => new Set(foundWords), [foundWords]);

  const solvedCellSet = useMemo(() => {
    const set = new Set();
    game.placements.forEach((placement) => {
      if (!foundSet.has(placement.word)) return;
      placement.cells.forEach(([row, col]) => set.add(cellKey(row, col)));
    });
    return set;
  }, [game.placements, foundSet]);

  function newGame(nextSize = size, nextWordCount = wordCount) {
    const puzzle = buildPuzzle(nextSize, nextWordCount);
    setGame(puzzle);
    setFoundWords([]);
    setSelectionStart(null);
    setSelectionEnd(null);
    setStatus('New puzzle generated. Start searching!');
  }

  function handleSelect(row, col) {
    if (!selectionStart) {
      setSelectionStart([row, col]);
      setSelectionEnd(null);
      return;
    }

    const start = selectionStart;
    const end = [row, col];
    setSelectionEnd(end);

    const matched = game.placements.find((placement) => {
      if (foundSet.has(placement.word)) return false;
      const first = placement.cells[0];
      const last = placement.cells[placement.cells.length - 1];
      const forward = start[0] === first[0] && start[1] === first[1] && end[0] === last[0] && end[1] === last[1];
      const backward = start[0] === last[0] && start[1] === last[1] && end[0] === first[0] && end[1] === first[1];
      return forward || backward;
    });

    if (matched) {
      const nextFound = [...foundWords, matched.word];
      setFoundWords(nextFound);
      if (nextFound.length === game.words.length) {
        setStatus('Great work! You found every word.');
      } else {
        setStatus(`Found: ${matched.word}`);
      }
    } else {
      setStatus('No word on that line. Try another pair of letters.');
    }

    setSelectionStart(null);
    setSelectionEnd(null);
  }

  function solveGame() {
    setFoundWords(game.words);
    setSelectionStart(null);
    setSelectionEnd(null);
    setStatus('Solved automatically. Use New Game to play another puzzle.');
  }

  const currentSelection = new Set();
  if (selectionStart) {
    currentSelection.add(cellKey(selectionStart[0], selectionStart[1]));
  }
  if (selectionEnd) {
    currentSelection.add(cellKey(selectionEnd[0], selectionEnd[1]));
  }

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

      <h1 className="text-3xl md:text-4xl font-bold text-center">Crossword Puzzle Game</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">About the game</h2>
        <p className="text-slate-700">
          This CKPLACE word-search style crossword hides words in horizontal, vertical, and diagonal lines.
          Pick a start letter, then the matching end letter of a word to claim it.
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Choose a board size and number of hidden words, then start a new game.</li>
          <li>Words can appear horizontally, vertically, and diagonally in either direction.</li>
          <li>Click a start cell and then an end cell to select an entire line.</li>
          <li>If your line matches a hidden word, it is marked as solved.</li>
          <li>Use <strong>Solve</strong> for automated completion at any time.</li>
        </ul>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Controls</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="font-semibold">Size</span>
            <input
              type="number"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={size}
              onChange={(event) => setSize(Math.max(MIN_SIZE, Math.min(MAX_SIZE, Number(event.target.value) || MIN_SIZE)))}
              className="border border-slate-300 rounded px-3 py-2 w-24"
            />
          </label>

          <label className="flex items-center gap-2">
            <span className="font-semibold">Words</span>
            <input
              type="number"
              min={MIN_WORDS}
              max={MAX_WORDS}
              value={wordCount}
              onChange={(event) => setWordCount(Math.max(MIN_WORDS, Math.min(MAX_WORDS, Number(event.target.value) || MIN_WORDS)))}
              className="border border-slate-300 rounded px-3 py-2 w-24"
            />
          </label>

          <button
            type="button"
            onClick={() => newGame()}
            className="px-4 py-2 rounded bg-slate-800 text-white hover:bg-slate-700"
          >
            New Game
          </button>
          <button
            type="button"
            onClick={solveGame}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500"
          >
            Solve
          </button>
        </div>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 rounded-lg bg-slate-100 p-4">
          <p className="text-slate-700">{status}</p>
          <p className="text-slate-700 mt-1">
            Solved words: <strong>{foundWords.length}</strong> / <strong>{game.words.length}</strong>
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-5 items-start">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${game.size}, minmax(0, 36px))` }}
          >
            {game.grid.map((row, rowIndex) => row.map((cell, colIndex) => {
              const key = cellKey(rowIndex, colIndex);
              const isSolved = solvedCellSet.has(key);
              const isSelected = currentSelection.has(key);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelect(rowIndex, colIndex)}
                  className="h-9 w-9 border rounded font-semibold text-slate-800"
                  style={{
                    backgroundColor: isSolved ? '#86efac' : (isSelected ? '#bfdbfe' : '#ffffff'),
                  }}
                  aria-label={`Cell ${rowIndex + 1}, ${colIndex + 1}: ${cell}`}
                >
                  {cell}
                </button>
              );
            }))}
          </div>

          <div className="min-w-56">
            <h3 className="font-semibold text-lg mb-2">Words to find</h3>
            <ul className="space-y-1 text-slate-700">
              {game.words.map((word) => (
                <li key={word} className={foundSet.has(word) ? 'line-through text-green-700 font-semibold' : ''}>
                  {word}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
