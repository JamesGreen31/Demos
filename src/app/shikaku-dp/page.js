'use client';

import { useEffect, useMemo, useState } from 'react';

const PRESET_PUZZLES = {
  quickstart: {
    name: 'Quickstart 4×4',
    rows: 4,
    cols: 4,
    clues: [
      { row: 0, col: 0, area: 4 },
      { row: 0, col: 2, area: 2 },
      { row: 1, col: 2, area: 4 },
      { row: 2, col: 0, area: 4 },
      { row: 3, col: 2, area: 2 },
    ],
  },
  classroom: {
    name: 'Classroom 5×5',
    rows: 5,
    cols: 5,
    clues: [
      { row: 1, col: 1, area: 4 },
      { row: 0, col: 3, area: 3 },
      { row: 2, col: 2, area: 4 },
      { row: 3, col: 4, area: 4 },
      { row: 4, col: 0, area: 6 },
      { row: 4, col: 2, area: 4 },
    ],
  },
};

const PALETTE = ['#fecaca', '#fde68a', '#bfdbfe', '#bbf7d0', '#ddd6fe', '#fbcfe8', '#c7d2fe', '#fdba74'];
const MIN_RECTANGLE_AREA = 2;
const MAX_RECTANGLE_EDGE = 4;

function cellIndex(row, col, cols) {
  return row * cols + col;
}

function bitAt(index) {
  return 1n << BigInt(index);
}

function factorPairs(value) {
  const pairs = [];
  for (let height = 1; height <= value; height += 1) {
    if (value % height === 0) {
      pairs.push([height, value / height]);
    }
  }
  return pairs;
}

function buildRectangleMask(top, left, height, width, cols) {
  let mask = 0n;
  for (let row = top; row < top + height; row += 1) {
    for (let col = left; col < left + width; col += 1) {
      mask |= bitAt(cellIndex(row, col, cols));
    }
  }
  return mask;
}

function countCluesInside(top, left, bottom, right, clues) {
  return clues.reduce(
    (total, clue) =>
      clue.row >= top && clue.row <= bottom && clue.col >= left && clue.col <= right ? total + 1 : total,
    0,
  );
}

function buildCandidates(rows, cols, clues) {
  return clues.map((clue, clueIndex) => {
    const candidates = [];

    for (const [height, width] of factorPairs(clue.area)) {
      const minTop = Math.max(0, clue.row - height + 1);
      const maxTop = Math.min(clue.row, rows - height);
      const minLeft = Math.max(0, clue.col - width + 1);
      const maxLeft = Math.min(clue.col, cols - width);

      for (let top = minTop; top <= maxTop; top += 1) {
        for (let left = minLeft; left <= maxLeft; left += 1) {
          const bottom = top + height - 1;
          const right = left + width - 1;
          if (countCluesInside(top, left, bottom, right, clues) !== 1) {
            continue;
          }

          candidates.push({
            clueIndex,
            top,
            left,
            bottom,
            right,
            mask: buildRectangleMask(top, left, height, width, cols),
          });
        }
      }
    }

    return candidates;
  });
}

function solveShikakuDP(rows, cols, clues) {
  const totalCells = rows * cols;
  const fullMask = (1n << BigInt(totalCells)) - 1n;
  const candidatesByClue = buildCandidates(rows, cols, clues);
  const candidatesByCell = Array.from({ length: totalCells }, () => []);

  candidatesByClue.forEach((candidateList, clueIndex) => {
    candidateList.forEach((candidate) => {
      for (let row = candidate.top; row <= candidate.bottom; row += 1) {
        for (let col = candidate.left; col <= candidate.right; col += 1) {
          candidatesByCell[cellIndex(row, col, cols)].push({ ...candidate, clueIndex });
        }
      }
    });
  });

  const memo = new Map();
  let statesVisited = 0;
  const allCluesUsedMask = (1n << BigInt(clues.length)) - 1n;

  function dfs(coveredMask, usedCluesMask) {
    statesVisited += 1;
    const key = `${coveredMask.toString()}|${usedCluesMask.toString()}`;
    if (memo.has(key)) {
      return memo.get(key);
    }

    if (coveredMask === fullMask) {
      const solved = usedCluesMask === allCluesUsedMask;
      const result = solved ? [] : null;
      memo.set(key, result);
      return result;
    }

    let firstOpenCell = -1;
    for (let index = 0; index < totalCells; index += 1) {
      if ((coveredMask & bitAt(index)) === 0n) {
        firstOpenCell = index;
        break;
      }
    }

    if (firstOpenCell === -1) {
      memo.set(key, null);
      return null;
    }

    for (const candidate of candidatesByCell[firstOpenCell]) {
      const clueBit = bitAt(candidate.clueIndex);
      if ((usedCluesMask & clueBit) !== 0n || (coveredMask & candidate.mask) !== 0n) {
        continue;
      }

      const next = dfs(coveredMask | candidate.mask, usedCluesMask | clueBit);
      if (next !== null) {
        const result = [candidate, ...next];
        memo.set(key, result);
        return result;
      }
    }

    memo.set(key, null);
    return null;
  }

  const solution = dfs(0n, 0n);

  return {
    solution,
    statesVisited,
    candidateCounts: candidatesByClue.map((list) => list.length),
  };
}

function rectangleFromCorners(start, end, cols) {
  const top = Math.min(start.row, end.row);
  const left = Math.min(start.col, end.col);
  const bottom = Math.max(start.row, end.row);
  const right = Math.max(start.col, end.col);
  const height = bottom - top + 1;
  const width = right - left + 1;

  return {
    top,
    left,
    bottom,
    right,
    mask: buildRectangleMask(top, left, height, width, cols),
    area: height * width,
  };
}

function getBoardCompletion(rectanglesByClue, rows, cols) {
  const fullMask = (1n << BigInt(rows * cols)) - 1n;
  const mergedMask = rectanglesByClue.reduce((mask, rectangle) => (rectangle ? mask | rectangle.mask : mask), 0n);
  const placedCount = rectanglesByClue.filter(Boolean).length;

  return {
    placedCount,
    allCellsCovered: mergedMask === fullMask,
  };
}

function getRectangleIndexAtCell(row, col, assignments, cols) {
  const index = cellIndex(row, col, cols);
  const cellBit = bitAt(index);
  return assignments.findIndex((rectangle) => rectangle && (rectangle.mask & cellBit) !== 0n);
}

function getCellStyle({ row, col, assignments, cols, selectedClue, clueAtCell, startCell, endCell }) {
  const rectangleIndex = getRectangleIndexAtCell(row, col, assignments, cols);

  const isSelectedClue = selectedClue && selectedClue.row === row && selectedClue.col === col;
  const isStartCell = startCell && startCell.row === row && startCell.col === col;
  const isEndCell = endCell && endCell.row === row && endCell.col === col;
  const borderColor = isSelectedClue ? '#16a34a' : isStartCell ? '#2563eb' : isEndCell ? '#ca8a04' : '#334155';
  const isHighlighted = isSelectedClue || isStartCell || isEndCell;

  if (rectangleIndex === -1) {
    return {
      backgroundColor: clueAtCell ? '#dbeafe' : '#f8fafc',
      borderColor,
      borderWidth: isHighlighted ? '3px' : '1px',
      boxShadow: isStartCell
        ? 'inset 0 0 0 2px rgba(37,99,235,0.35)'
        : isEndCell
          ? 'inset 0 0 0 2px rgba(202,138,4,0.35)'
          : 'none',
    };
  }

  return {
    backgroundColor: PALETTE[rectangleIndex % PALETTE.length],
    borderColor,
    borderWidth: isHighlighted ? '3px' : '1px',
    boxShadow: isStartCell
      ? 'inset 0 0 0 2px rgba(37,99,235,0.35)'
      : isEndCell
        ? 'inset 0 0 0 2px rgba(202,138,4,0.35)'
        : 'none',
  };
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function generateRandomPartition(rows, cols) {
  const occupied = Array.from({ length: rows }, () => Array(cols).fill(false));
  const rectangles = [];

  function firstUnoccupied() {
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (!occupied[row][col]) {
          return { row, col };
        }
      }
    }
    return null;
  }

  function canPlace(top, left, height, width) {
    if (top + height > rows || left + width > cols) {
      return false;
    }
    for (let row = top; row < top + height; row += 1) {
      for (let col = left; col < left + width; col += 1) {
        if (occupied[row][col]) {
          return false;
        }
      }
    }
    return true;
  }

  function mark(top, left, height, width, value) {
    for (let row = top; row < top + height; row += 1) {
      for (let col = left; col < left + width; col += 1) {
        occupied[row][col] = value;
      }
    }
  }

  function backtrack() {
    const nextCell = firstUnoccupied();
    if (!nextCell) {
      return true;
    }

    const { row, col } = nextCell;
    const options = [];
    for (let height = 1; height <= Math.min(MAX_RECTANGLE_EDGE, rows - row); height += 1) {
      for (let width = 1; width <= Math.min(MAX_RECTANGLE_EDGE, cols - col); width += 1) {
        const area = height * width;
        if (area >= MIN_RECTANGLE_AREA && canPlace(row, col, height, width)) {
          options.push({ top: row, left: col, height, width, area: height * width });
        }
      }
    }

    const prioritized = shuffle(options);

    for (const option of prioritized) {
      mark(option.top, option.left, option.height, option.width, true);
      rectangles.push(option);
      if (backtrack()) {
        return true;
      }
      rectangles.pop();
      mark(option.top, option.left, option.height, option.width, false);
    }

    return false;
  }

  if (!backtrack()) {
    throw new Error('Failed to generate random puzzle partition.');
  }

  return rectangles;
}

function buildRandomPuzzle(size) {
  const rows = size;
  const cols = size;
  const partition = generateRandomPartition(rows, cols);

  const clues = partition.map((rectangle) => {
    const clueRow = rectangle.top + Math.floor(Math.random() * rectangle.height);
    const clueCol = rectangle.left + Math.floor(Math.random() * rectangle.width);
    return { row: clueRow, col: clueCol, area: rectangle.area };
  });

  return {
    name: `Random ${rows}×${cols}`,
    rows,
    cols,
    clues: shuffle(clues),
  };
}

export default function ShikakuDpPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [selectedPuzzleKey, setSelectedPuzzleKey] = useState('quickstart');
  const [puzzle, setPuzzle] = useState(PRESET_PUZZLES.quickstart);
  const [showCandidates, setShowCandidates] = useState(true);
  const [selectedClueIndex, setSelectedClueIndex] = useState(null);
  const [startCell, setStartCell] = useState(null);
  const [endCell, setEndCell] = useState(null);
  const [playerRectangles, setPlayerRectangles] = useState([]);
  const [statusMessage, setStatusMessage] = useState('Click any clue to begin placing rectangles.');
  const [statesVisited, setStatesVisited] = useState(0);
  const [solveResult, setSolveResult] = useState(null);
  const [randomSize, setRandomSize] = useState(6);
  const [isRandomPuzzle, setIsRandomPuzzle] = useState(false);

  const { rows, cols, clues } = puzzle;

  const candidateCounts = useMemo(() => {
    const candidates = buildCandidates(rows, cols, clues);
    return candidates.map((list) => list.length);
  }, [rows, cols, clues]);

  useEffect(() => {
    setSelectedClueIndex(null);
    setStartCell(null);
    setEndCell(null);
    setPlayerRectangles(Array(clues.length).fill(null));
    setStatusMessage('Puzzle loaded. Select a clue, then choose a start square and an end square.');
    setStatesVisited(0);
    setSolveResult(null);
  }, [puzzle, clues.length]);

  const completion = getBoardCompletion(playerRectangles, rows, cols);
  const isWin = completion.placedCount === clues.length && completion.allCellsCovered;

  const resetSelectionState = () => {
    setSelectedClueIndex(null);
    setStartCell(null);
    setEndCell(null);
  };

  const tryPlaceRectangle = (endCorner) => {
    if (selectedClueIndex === null) {
      setStatusMessage('Select a clue first.');
      return;
    }

    if (!startCell) {
      setStatusMessage('Choose a start square first.');
      return;
    }

    const clue = clues[selectedClueIndex];
    const proposed = rectangleFromCorners(startCell, endCorner, cols);

    const clueInside =
      clue.row >= proposed.top && clue.row <= proposed.bottom && clue.col >= proposed.left && clue.col <= proposed.right;

    if (!clueInside) {
      setStatusMessage('The selected clue must be inside the rectangle.');
      resetSelectionState();
      return;
    }

    if (proposed.area !== clue.area) {
      setStatusMessage(`That rectangle has area ${proposed.area}. Clue ${clue.area} requires exactly ${clue.area}.`);
      resetSelectionState();
      return;
    }

    if (proposed.area < MIN_RECTANGLE_AREA) {
      setStatusMessage(`Rectangles must be at least area ${MIN_RECTANGLE_AREA}.`);
      resetSelectionState();
      return;
    }

    if (countCluesInside(proposed.top, proposed.left, proposed.bottom, proposed.right, clues) !== 1) {
      setStatusMessage('Rectangles must contain exactly one clue.');
      resetSelectionState();
      return;
    }

    const overlaps = playerRectangles.some((rectangle, index) => {
      if (!rectangle || index === selectedClueIndex) {
        return false;
      }
      return (rectangle.mask & proposed.mask) !== 0n;
    });

    if (overlaps) {
      setStatusMessage('That overlaps another rectangle.');
      resetSelectionState();
      return;
    }

    setPlayerRectangles((current) => {
      const next = [...current];
      next[selectedClueIndex] = {
        clueIndex: selectedClueIndex,
        ...proposed,
      };
      return next;
    });
    resetSelectionState();
    setStatusMessage(`Placed rectangle for clue ${clue.area} at (${clue.row + 1}, ${clue.col + 1}).`);
  };

  const handleCellClick = (row, col) => {
    const clueIndex = clues.findIndex((clue) => clue.row === row && clue.col === col);
    const rectangleIndex = getRectangleIndexAtCell(row, col, playerRectangles, cols);
    const isShaded = rectangleIndex !== -1;

    if (isShaded) {
      if (clueIndex !== -1 && playerRectangles[clueIndex]) {
        setPlayerRectangles((current) => {
          const next = [...current];
          next[clueIndex] = null;
          return next;
        });
        setSelectedClueIndex(clueIndex);
        setStartCell(null);
        setEndCell(null);
        setStatusMessage(
          `Removed rectangle for clue ${clues[clueIndex].area}. Pick a start corner, then an end corner to redraw.`,
        );
      }
      return;
    }

    if (selectedClueIndex === null) {
      if (clueIndex !== -1) {
        setSelectedClueIndex(clueIndex);
        setStartCell(null);
        setEndCell(null);
        setStatusMessage(
          `Clue ${clues[clueIndex].area} selected. Click one corner (start), then the opposite corner (end).`,
        );
        return;
      }

      setStatusMessage('Select a clue first.');
      return;
    }

    if (!startCell) {
      if (clueIndex !== -1 && clueIndex !== selectedClueIndex) {
        setSelectedClueIndex(clueIndex);
        setStartCell(null);
        setEndCell(null);
        setStatusMessage(`Clue ${clues[clueIndex].area} selected. Now choose the start corner.`);
        return;
      }

      setStartCell({ row, col });
      setEndCell(null);
      setStatusMessage(`Start square set at (${row + 1}, ${col + 1}). Now choose the end square.`);
      return;
    }

    setEndCell({ row, col });
    tryPlaceRectangle({ row, col });
  };

  const solveBoard = () => {
    const solved = solveShikakuDP(rows, cols, clues);
    setStatesVisited(solved.statesVisited);
    setSolveResult(solved.solution);

    if (!solved.solution) {
      setStatusMessage('No solution exists for this puzzle.');
      return;
    }

    const solvedByClue = Array(clues.length).fill(null);
    solved.solution.forEach((rectangle) => {
      solvedByClue[rectangle.clueIndex] = rectangle;
    });
    setPlayerRectangles(solvedByClue);
    resetSelectionState();
    setStatusMessage('Solved with DP. Try generating a new random puzzle or clearing to play again.');
  };

  const clearBoard = () => {
    setPlayerRectangles(Array(clues.length).fill(null));
    setSelectedClueIndex(null);
    setStartCell(null);
    setEndCell(null);
    setStatusMessage('Board cleared. Select a clue to continue.');
  };

  const loadPreset = (key) => {
    setSelectedPuzzleKey(key);
    setPuzzle(PRESET_PUZZLES[key]);
    setIsRandomPuzzle(false);
  };

  const loadRandomPuzzle = () => {
    const next = buildRandomPuzzle(randomSize);
    setPuzzle(next);
    setIsRandomPuzzle(true);
  };

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

      <h1 className="text-3xl md:text-4xl font-bold text-center">Shikaku Game (DP Solver)</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">What is dynamic programming doing?</h2>
        <p className="text-slate-700 mb-3">
          You play by placing rectangles so each clue cell belongs to one rectangle with matching area.
          The <strong>Solve</strong> button runs a memoized state-compression DP over covered cells + used clues.
        </p>
        <p className="text-slate-700">
          This keeps the game-like flow while still exposing DP ideas through candidate counts and visited states.
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Select a clue by clicking its numbered cell.</li>
          <li>Pick a start corner (blue), then pick an end corner (gold) to form a rectangle.</li>
          <li>The selected clue may be anywhere inside the rectangle (not only on a corner).</li>
          <li>Rectangles must match clue area, contain exactly one clue, and not overlap.</li>
          <li>If you click a completed clue, its rectangle is removed so you can redraw it.</li>
          <li>Use <strong>Solve</strong> for the DP answer, or <strong>Clear Board</strong> to retry.</li>
        </ul>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Controls</h2>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="flex items-center gap-2">
            <span className="font-semibold">Preset</span>
            <select
              value={selectedPuzzleKey}
              onChange={(event) => loadPreset(event.target.value)}
              className="border border-slate-300 rounded px-3 py-2"
              aria-label="Puzzle preset"
            >
              {Object.entries(PRESET_PUZZLES).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="font-semibold">Random size</span>
            <select
              value={randomSize}
              onChange={(event) => setRandomSize(Number(event.target.value))}
              className="border border-slate-300 rounded px-3 py-2"
              aria-label="Random puzzle size"
            >
              {Array.from({ length: 6 }, (_, index) => index + 4).map((size) => (
                <option key={size} value={size}>
                  {size}×{size}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={loadRandomPuzzle}
            className="px-4 py-2 rounded bg-purple-700 text-white hover:bg-purple-600"
          >
            Generate Random Puzzle
          </button>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCandidates}
              onChange={(event) => setShowCandidates(event.target.checked)}
            />
            <span>Show candidate counts</span>
          </label>
        </div>

        <p className="text-sm text-slate-600 mb-3">
          Current puzzle: <strong>{puzzle.name}</strong>
          {isRandomPuzzle && ` (${rows}×${cols})`}
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={clearBoard}
            className="px-4 py-2 rounded bg-slate-800 text-white hover:bg-slate-700"
          >
            Clear Board
          </button>
          <button
            type="button"
            onClick={solveBoard}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500"
          >
            Solve
          </button>
        </div>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Game / Visualization</h2>

        <div className="mb-4 rounded-lg bg-slate-100 p-4 text-slate-700 space-y-1">
          <p>{statusMessage}</p>
          <p>
            Rectangles placed: <strong>{completion.placedCount}</strong> / <strong>{clues.length}</strong>
          </p>
          <p>
            DP states visited: <strong>{statesVisited}</strong>
          </p>
          {solveResult === null && statesVisited > 0 && <p>No DP solution found for this puzzle.</p>}
          {isWin && <p className="text-green-700 font-semibold">You solved it. Great partition!</p>}
        </div>

        {showCandidates && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold mb-2">Candidate rectangles per clue</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm text-slate-700">
              {clues.map((clue, index) => (
                <div key={`${clue.row}-${clue.col}-${clue.area}`} className="rounded border border-slate-200 bg-white p-2">
                  Clue ({clue.row + 1}, {clue.col + 1}) = {clue.area}: <strong>{candidateCounts[index]}</strong>{' '}
                  candidates
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          className="grid gap-1 w-fit"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 56px))`,
          }}
        >
          {Array.from({ length: rows }, (_, row) =>
            Array.from({ length: cols }, (_, col) => {
              const clueIndex = clues.findIndex((item) => item.row === row && item.col === col);
              const clueAtCell = clueIndex !== -1 ? clues[clueIndex] : null;
              const selectedClue = selectedClueIndex === null ? null : clues[selectedClueIndex];
              const style = getCellStyle({
                row,
                col,
                assignments: playerRectangles,
                cols,
                selectedClue,
                clueAtCell,
                startCell,
                endCell,
              });

              return (
                <button
                  key={`${row}-${col}`}
                  type="button"
                  onClick={() => handleCellClick(row, col)}
                  data-row={row}
                  data-col={col}
                  className="h-14 w-14 border rounded flex items-center justify-center font-semibold text-slate-800"
                  style={style}
                  aria-label={`Cell ${row + 1}, ${col + 1}`}
                >
                  {clueAtCell ? clueAtCell.area : ''}
                </button>
              );
            }),
          )}
        </div>
      </section>
    </main>
  );
}
