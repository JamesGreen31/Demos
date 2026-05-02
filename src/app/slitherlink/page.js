'use client';

import { useMemo, useState } from 'react';

const SIZE = 9;
const DEFAULT_HINT_DENSITY = 45;

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function buildLoopFromPath(path) {
  const horizontal = Array.from({ length: SIZE + 1 }, () => Array.from({ length: SIZE }, () => false));
  const vertical = Array.from({ length: SIZE }, () => Array.from({ length: SIZE + 1 }, () => false));

  for (let index = 0; index < path.length - 1; index += 1) {
    const current = path[index];
    const next = path[index + 1];

    if (current.row === next.row) {
      const row = current.row;
      const col = Math.min(current.col, next.col);
      if (row >= 0 && row <= SIZE && col >= 0 && col < SIZE) {
        horizontal[row][col] = true;
      }
    } else {
      const row = Math.min(current.row, next.row);
      const col = current.col;
      if (row >= 0 && row < SIZE && col >= 0 && col <= SIZE) {
        vertical[row][col] = true;
      }
    }
  }

  return { horizontal, vertical };
}

function tryBuildWalkLoop() {
  const start = { row: 1 + randomInt(SIZE - 1), col: 1 + randomInt(SIZE - 1) };
  const path = [start];
  const seen = new Set([`${start.row},${start.col}`]);
  const minLength = 18;
  const maxLength = 120;
  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  for (let step = 0; step < maxLength; step += 1) {
    const current = path[path.length - 1];
    const nextOptions = [];

    directions.forEach((direction) => {
      const candidate = { row: current.row + direction.row, col: current.col + direction.col };
      if (candidate.row < 0 || candidate.row > SIZE || candidate.col < 0 || candidate.col > SIZE) {
        return;
      }
      const key = `${candidate.row},${candidate.col}`;
      if (candidate.row === start.row && candidate.col === start.col) {
        if (path.length >= minLength) nextOptions.push(candidate);
        return;
      }
      if (!seen.has(key)) {
        nextOptions.push(candidate);
      }
    });

    if (nextOptions.length === 0) return null;
    const choice = nextOptions[randomInt(nextOptions.length)];
    path.push(choice);
    if (choice.row === start.row && choice.col === start.col) {
      return buildLoopFromPath(path);
    }
    seen.add(`${choice.row},${choice.col}`);
  }

  return null;
}

function buildRectangleLoop() {
  const minSpan = 3;
  const maxStart = SIZE - minSpan;
  const top = randomInt(maxStart);
  const left = randomInt(maxStart);
  const bottom = top + minSpan + randomInt(SIZE - top - minSpan + 1);
  const right = left + minSpan + randomInt(SIZE - left - minSpan + 1);
  const horizontal = Array.from({ length: SIZE + 1 }, () => Array.from({ length: SIZE }, () => false));
  const vertical = Array.from({ length: SIZE }, () => Array.from({ length: SIZE + 1 }, () => false));

  for (let col = left; col < right; col += 1) {
    horizontal[top][col] = true;
    horizontal[bottom][col] = true;
  }

  for (let row = top; row < bottom; row += 1) {
    vertical[row][left] = true;
    vertical[row][right] = true;
  }

  return { horizontal, vertical };
}

function countCellEdges(edges, row, col) {
  let count = 0;
  if (edges.horizontal[row][col]) count += 1;
  if (edges.horizontal[row + 1][col]) count += 1;
  if (edges.vertical[row][col]) count += 1;
  if (edges.vertical[row][col + 1]) count += 1;
  return count;
}

function createPuzzleFromSolution(solutionEdges, hintDensityPercent) {
  const clues = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => ''));
  const hintChance = hintDensityPercent / 100;

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const count = countCellEdges(solutionEdges, row, col);
      if (Math.random() < hintChance) clues[row][col] = String(count);
    }
  }

  return clues;
}

function createEmptyEdges() {
  return {
    horizontal: Array.from({ length: SIZE + 1 }, () => Array.from({ length: SIZE }, () => false)),
    vertical: Array.from({ length: SIZE }, () => Array.from({ length: SIZE + 1 }, () => false)),
  };
}

function createPuzzleState(hintDensityPercent) {
  let solution = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = tryBuildWalkLoop();
    if (candidate) {
      solution = candidate;
      break;
    }
  }
  if (!solution) solution = buildRectangleLoop();

  return {
    clues: createPuzzleFromSolution(solution, hintDensityPercent),
    edges: createEmptyEdges(),
    solutionEdges: solution,
    revealSolution: false,
  };
}

function getVertexDegrees(edges) {
  const degrees = Array.from({ length: SIZE + 1 }, () => Array.from({ length: SIZE + 1 }, () => 0));

  for (let row = 0; row < SIZE + 1; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (edges.horizontal[row][col]) {
        degrees[row][col] += 1;
        degrees[row][col + 1] += 1;
      }
    }
  }

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE + 1; col += 1) {
      if (edges.vertical[row][col]) {
        degrees[row][col] += 1;
        degrees[row + 1][col] += 1;
      }
    }
  }

  return degrees;
}

export default function SlitherlinkPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [hintDensity, setHintDensity] = useState(DEFAULT_HINT_DENSITY);
  const [state, setState] = useState(() => createPuzzleState(DEFAULT_HINT_DENSITY));

  const clueStatus = useMemo(() => {
    let satisfied = 0;
    let clueCount = 0;

    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const clue = state.clues[row][col];
        if (clue === '') continue;
        clueCount += 1;
        if (countCellEdges(state.edges, row, col) === Number(clue)) satisfied += 1;
      }
    }

    return { satisfied, clueCount };
  }, [state]);

  const loopStatus = useMemo(() => {
    const degrees = getVertexDegrees(state.edges);
    let openVertices = 0;
    let usedVertices = 0;

    for (let row = 0; row < SIZE + 1; row += 1) {
      for (let col = 0; col < SIZE + 1; col += 1) {
        const degree = degrees[row][col];
        if (degree === 1 || degree > 2) openVertices += 1;
        if (degree > 0) usedVertices += 1;
      }
    }

    if (usedVertices === 0) return 'Start drawing a loop.';
    if (openVertices > 0) return `Loop has ${openVertices} invalid vertex${openVertices === 1 ? '' : 'es'}.`;
    return 'All active vertices have degree 2 (loop-like shape).';
  }, [state]);

  function toggleHorizontal(row, col) {
    setState((prev) => {
      const horizontal = prev.edges.horizontal.map((line) => [...line]);
      horizontal[row][col] = !horizontal[row][col];
      return { ...prev, edges: { ...prev.edges, horizontal } };
    });
  }

  function toggleVertical(row, col) {
    setState((prev) => {
      const vertical = prev.edges.vertical.map((line) => [...line]);
      vertical[row][col] = !vertical[row][col];
      return { ...prev, edges: { ...prev.edges, vertical } };
    });
  }

  function newPuzzle() {
    setState(createPuzzleState(hintDensity));
  }

  function toggleRevealSolution() {
    setState((prev) => ({ ...prev, revealSolution: !prev.revealSolution }));
  }

  return (
    <main className="min-h-screen p-6 md:p-8 flex flex-col items-center gap-5">
      <div className="w-full max-w-5xl flex items-center justify-between">
        <button type="button" onClick={() => window.location.assign(demosHref)} className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800">← Back</button>
      </div>
      <h1 className="text-3xl font-bold text-center">Slitherlink Demo</h1>

      <section className="w-full max-w-5xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to Play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Click line segments to draw your loop.</li>
          <li>Each clue says exactly how many sides of that cell are in the loop.</li>
          <li>Loops cannot branch or end; every used dot should have degree 2.</li>
        </ul>
      </section>

      <section className="w-full max-w-5xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Controls</h2>
        <div className="space-y-4">
          <label htmlFor="hint-density" className="block font-medium text-slate-700">
            Hint density: {hintDensity}%
          </label>
          <input
            id="hint-density"
            type="range"
            min="20"
            max="80"
            value={hintDensity}
            onChange={(event) => setHintDensity(Number(event.target.value))}
            className="w-full"
          />
          <p className="text-sm text-slate-600">Lower density gives fewer clues and a harder puzzle. Puzzle numbers are still generator-driven.</p>
          <div className="flex gap-3">
            <button type="button" className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-700" onClick={newPuzzle}>New Puzzle</button>
            <button type="button" className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500" onClick={toggleRevealSolution}>
              {state.revealSolution ? 'Hide Solution' : 'Reveal Solution'}
            </button>
          </div>
        </div>
      </section>

      <div className="rounded-xl bg-slate-50 p-4 shadow-inner overflow-auto">
        <div className="relative" style={{ width: SIZE * 44 + 1, height: SIZE * 44 + 1 }}>
          {Array.from({ length: SIZE + 1 }).map((_, row) =>
            Array.from({ length: SIZE }).map((__, col) => (
              <button key={`h-${row}-${col}`} type="button" onClick={() => toggleHorizontal(row, col)} className={`absolute h-2 rounded-full ${state.edges.horizontal[row][col] ? 'bg-sky-600' : state.revealSolution && state.solutionEdges.horizontal[row][col] ? 'bg-emerald-400/80' : 'bg-slate-200 hover:bg-slate-400'}`} style={{ top: row * 44 - 4, left: col * 44 + 4, width: 36 }} />
            ))
          )}

          {Array.from({ length: SIZE }).map((_, row) =>
            Array.from({ length: SIZE + 1 }).map((__, col) => (
              <button key={`v-${row}-${col}`} type="button" onClick={() => toggleVertical(row, col)} className={`absolute w-2 rounded-full ${state.edges.vertical[row][col] ? 'bg-sky-600' : state.revealSolution && state.solutionEdges.vertical[row][col] ? 'bg-emerald-400/80' : 'bg-slate-200 hover:bg-slate-400'}`} style={{ top: row * 44 + 4, left: col * 44 - 4, height: 36 }} />
            ))
          )}

          {Array.from({ length: SIZE + 1 }).map((_, row) =>
            Array.from({ length: SIZE + 1 }).map((__, col) => (
              <div key={`d-${row}-${col}`} className="absolute h-3 w-3 rounded-full bg-slate-800" style={{ top: row * 44 - 6, left: col * 44 - 6 }} />
            ))
          )}

          {state.clues.map((row, rowIndex) =>
            row.map((clue, colIndex) => {
              if (clue === '') return null;
              const isSatisfied = countCellEdges(state.edges, rowIndex, colIndex) === Number(clue);
              return <div key={`c-${rowIndex}-${colIndex}`} className={`absolute text-lg font-semibold ${isSatisfied ? 'text-emerald-600' : 'text-slate-700'}`} style={{ top: rowIndex * 44 + 10, left: colIndex * 44 + 16 }}>{clue}</div>;
            })
          )}
        </div>
      </div>

      <section className="w-full max-w-5xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Status</h2>
        <p className="font-medium mt-2">Satisfied clues: {clueStatus.satisfied}/{clueStatus.clueCount}</p>
        <p className="text-slate-700 mt-1">{loopStatus}</p>
      </section>
    </main>
  );
}
