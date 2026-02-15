'use client';

import { useMemo, useRef, useState } from 'react';

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

const EASY_DIRECTIONS = [
  [0, 1],
  [1, 0],
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

function canPlaceWord(grid, cells, word, mode) {
  const size = grid.length;
  const candidateSet = new Set(cells.map(([row, col]) => cellKey(row, col)));

  for (let index = 0; index < cells.length; index += 1) {
    const [row, col] = cells[index];
    const letter = grid[row][col];

    if (mode === 'hard') {
      if (letter !== '' && letter !== word[index]) {
        return false;
      }
      continue;
    }

    if (letter !== '') {
      return false;
    }

    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
        const nextRow = row + rowOffset;
        const nextCol = col + colOffset;
        if (!inBounds(nextRow, nextCol, size)) continue;
        if (grid[nextRow][nextCol] === '') continue;
        if (candidateSet.has(cellKey(nextRow, nextCol))) continue;
        return false;
      }
    }
  }

  return true;
}

function buildPuzzle(size, requestedCount, mode = 'hard') {
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const availableWords = shuffle(WORD_BANK.filter((word) => word.length <= size));
  const placements = [];
  const targetWordCount = Math.min(requestedCount, availableWords.length);
  const directions = mode === 'easy' ? EASY_DIRECTIONS : DIRECTIONS;

  availableWords.some((word) => {
    if (placements.length >= targetWordCount) {
      return true;
    }

    let placed = false;

    for (let attempt = 0; attempt < 500 && !placed; attempt += 1) {
      const [dx, dy] = directions[randomInt(directions.length)];
      const startRow = randomInt(size);
      const startCol = randomInt(size);
      const cells = cellsForPlacement(startRow, startCol, dx, dy, word.length);

      const inRange = cells.every(([row, col]) => inBounds(row, col, size));
      if (!inRange) continue;

      const valid = canPlaceWord(grid, cells, word, mode);
      if (!valid) continue;

      cells.forEach(([row, col], offset) => {
        grid[row][col] = word[offset];
      });

      placements.push({ word, cells });
      placed = true;
    }

    return false;
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

function directionStep(delta) {
  if (delta === 0) return 0;
  return delta > 0 ? 1 : -1;
}

function selectedLine(start, end) {
  const rowDelta = end[0] - start[0];
  const colDelta = end[1] - start[1];
  const absRow = Math.abs(rowDelta);
  const absCol = Math.abs(colDelta);
  const sameRow = rowDelta === 0;
  const sameCol = colDelta === 0;
  const diagonal = absRow === absCol;

  if (!sameRow && !sameCol && !diagonal) {
    return null;
  }

  const length = Math.max(absRow, absCol) + 1;
  const stepRow = directionStep(rowDelta);
  const stepCol = directionStep(colDelta);

  return Array.from({ length }, (_, offset) => [
    start[0] + (stepRow * offset),
    start[1] + (stepCol * offset),
  ]);
}

export default function CrosswordPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [size, setSize] = useState(12);
  const [wordCount, setWordCount] = useState(8);
  const [mode, setMode] = useState('hard');
  const [game, setGame] = useState(() => buildPuzzle(12, 8, 'hard'));
  const [foundWords, setFoundWords] = useState([]);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const draggedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const gridRef = useRef(null);
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

  function newGame(nextSize = size, nextWordCount = wordCount, nextMode = mode) {
    const puzzle = buildPuzzle(nextSize, nextWordCount, nextMode);
    setGame(puzzle);
    setFoundWords([]);
    setSelectionStart(null);
    setSelectionEnd(null);
    setStatus(`New ${nextMode} puzzle generated. Start searching!`);
  }

  function applySelection(start, end) {
    const line = selectedLine(start, end);
    if (!line) {
      setStatus('Selections must be horizontal, vertical, or diagonal.');
      return;
    }

    const sameRow = start[0] === end[0];
    const sameCol = start[1] === end[1];
    if (mode === 'easy' && !sameRow && !sameCol) {
      setStatus('Easy mode words are only horizontal or vertical.');
      return;
    }

    const matched = game.placements.find((placement) => {
      if (foundSet.has(placement.word)) return false;
      const sameLength = placement.cells.length === line.length;
      if (!sameLength) return false;

      const forward = placement.cells.every(([row, col], index) => row === line[index][0] && col === line[index][1]);
      if (forward) return true;

      return placement.cells.every(([row, col], index) => {
        const reversedIndex = line.length - 1 - index;
        return row === line[reversedIndex][0] && col === line[reversedIndex][1];
      });
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

  function handleSelect(row, col) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (selectionStart?.[0] === row && selectionStart?.[1] === col) {
      return;
    }

    if (!selectionStart) {
      setSelectionStart([row, col]);
      setSelectionEnd([row, col]);
      return;
    }

    applySelection(selectionStart, [row, col]);
  }

  function handlePointerDown(event, row, col) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    draggedRef.current = false;
    setIsDragging(true);
    setSelectionStart([row, col]);
    setSelectionEnd([row, col]);
  }

  function updateDragSelection(target) {
    if (!target || !selectionStart) return;

    const row = Number(target.dataset.row);
    const col = Number(target.dataset.col);
    if (Number.isNaN(row) || Number.isNaN(col)) return;

    if (selectionEnd?.[0] !== row || selectionEnd?.[1] !== col) {
      draggedRef.current = true;
    }
    setSelectionEnd([row, col]);
  }

  function findCellButtonFromPoint(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    if (!element) return null;

    const button = element.closest('button[data-cell="true"]');
    if (!button || !gridRef.current?.contains(button)) return null;
    return button;
  }

  function handleGridPointerMove(event) {
    if (!isDragging || !selectionStart) return;

    const button = findCellButtonFromPoint(event.clientX, event.clientY);
    updateDragSelection(button);
  }

  function handlePointerEnter(row, col) {
    if (!isDragging) return;
    const button = gridRef.current?.querySelector(`button[data-row="${row}"][data-col="${col}"]`);
    updateDragSelection(button);
  }

  function finalizeDragSelection() {
    if (!isDragging || !selectionStart || !selectionEnd) return;
    setIsDragging(false);

    if (!draggedRef.current) {
      return;
    }

    suppressClickRef.current = true;
    applySelection(selectionStart, selectionEnd);
  }

  function solveGame() {
    setFoundWords(game.words);
    setSelectionStart(null);
    setSelectionEnd(null);
    setStatus('Solved automatically. Use New Game to play another puzzle.');
  }

  const boardCellSize = size <= 10 ? '36px' : size <= 14 ? '32px' : '28px';

  const currentSelection = new Set();
  if (selectionStart && selectionEnd) {
    const line = selectedLine(selectionStart, selectionEnd);
    if (line) {
      line.forEach(([row, col]) => currentSelection.add(cellKey(row, col)));
    }
  } else if (selectionStart) {
    currentSelection.add(cellKey(selectionStart[0], selectionStart[1]));
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

      <h1 className="text-3xl md:text-4xl font-bold text-center">Word Search Game</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">About the game</h2>
        <p className="text-slate-700">
          This CKPLACE word-search demo now includes two modes.
          Easy mode places words left-to-right or top-to-bottom with at least one-cell padding between words.
          Hard mode allows touching words in any direction.
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Choose a board size and number of hidden words, then start a new game.</li>
          <li>Easy mode: words are only left-to-right or top-to-bottom and do not touch.</li>
          <li>Hard mode: words can touch and can appear in any direction.</li>
          <li>Click or drag from a start cell to an end cell to select an entire line.</li>
          <li>If your line matches a hidden word, it is marked as solved.</li>
          <li>Use <strong>Solve</strong> for automated completion at any time.</li>
        </ul>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Controls</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-2">
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

          <label className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-2">
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

          <label className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-2">
            <span className="font-semibold">Mode</span>
            <select
              value={mode}
              onChange={(event) => {
                const nextMode = event.target.value;
                setMode(nextMode);
                newGame(size, wordCount, nextMode);
              }}
              className="border border-slate-300 rounded px-3 py-2"
            >
              <option value="easy">Easy</option>
              <option value="hard">Hard</option>
            </select>
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
            Mode: <strong>{mode === 'easy' ? 'Easy' : 'Hard'}</strong>
          </p>
          <p className="text-slate-700 mt-1">
            Solved words: <strong>{foundWords.length}</strong> / <strong>{game.words.length}</strong>
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-5 items-start">
          <div className="w-full overflow-auto rounded-lg border border-slate-200 p-2">
            <div
              ref={gridRef}
              className="grid gap-1 touch-none select-none"
              style={{ gridTemplateColumns: `repeat(${game.size}, minmax(0, ${boardCellSize}))` }}
              onPointerMove={handleGridPointerMove}
              onPointerUp={finalizeDragSelection}
              onPointerLeave={() => setIsDragging(false)}
              onPointerCancel={() => setIsDragging(false)}
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
                  onPointerDown={(event) => handlePointerDown(event, rowIndex, colIndex)}
                  onPointerEnter={() => handlePointerEnter(rowIndex, colIndex)}
                  data-cell="true"
                  data-row={rowIndex}
                  data-col={colIndex}
                  className="h-8 w-8 sm:h-9 sm:w-9 border rounded font-semibold text-slate-800 touch-none"
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
