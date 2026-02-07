'use client';

import { useState } from 'react';

export default function AStarPage() {
  const gridSize = 8;
  const totalCells = gridSize * gridSize;
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [cellStates, setCellStates] = useState(Array(totalCells).fill(false));
  const [messages, setMessages] = useState('');
  const [cellWeights, setCellWeights] = useState(() => initializeCellWeights());
  const [solvedCells, setSolution] = useState([]);

  function initializeCellWeights() {
    return Array(totalCells)
      .fill(null)
      .map((_, index) => {
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        const hWeight = Math.abs(0 - row) + Math.abs(7 - col);
        return { gWeight: 1, hWeight };
      });
  }

  function randomizeCellWeights() {
    return Array(totalCells)
      .fill(null)
      .map((_, index) => {
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        const hWeight = Math.abs(0 - row) + Math.abs(7 - col);
        return { gWeight: Math.floor(Math.random() * 10) + 1, hWeight };
      });
  }

  const handleRandomizeCellWeights = () => {
    setCellWeights(randomizeCellWeights());
    setSolution([]);
    setMessage('Cell distances randomized');
  };

  const solvePath = () => {
    const startCell = totalCells - gridSize;
    const goalCell = gridSize - 1;
    const openSet = new Set([startCell]);
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    gScore.set(startCell, 0);
    fScore.set(startCell, cellWeights[startCell].hWeight);

    while (openSet.size > 0) {
      const current = getLowestFScore(openSet, fScore);

      if (current === goalCell) {
        const path = reconstructPath(cameFrom, current);
        setSolution(path);
        setMessage('Path found!');
        return;
      }

      openSet.delete(current);
      closedSet.add(current);

      for (const neighbor of getNeighbors(current)) {
        if (closedSet.has(neighbor)) {
          continue;
        }

        const tentativeGScore = gScore.get(current) + cellWeights[neighbor].gWeight;

        if (!openSet.has(neighbor)) {
          openSet.add(neighbor);
        } else if (tentativeGScore >= gScore.get(neighbor)) {
          continue;
        }

        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeGScore);
        fScore.set(neighbor, gScore.get(neighbor) + cellWeights[neighbor].hWeight);
      }
    }

    setMessage('No path found');
  };

  const getLowestFScore = (openSet, fScore) => {
    return Array.from(openSet).reduce((lowest, cell) =>
      fScore.get(cell) < fScore.get(lowest) ? cell : lowest
    );
  };

  const reconstructPath = (cameFrom, current) => {
    const path = [current];
    while (cameFrom.has(current)) {
      current = cameFrom.get(current);
      path.unshift(current);
    }
    return path;
  };

  const getNeighbors = (index) => {
    const left = index % gridSize === 0 ? undefined : index - 1;
    const right = index % gridSize === gridSize - 1 ? undefined : index + 1;
    const up = index < gridSize ? undefined : index - gridSize;
    const down = index >= totalCells - gridSize ? undefined : index + gridSize;
    return [left, right, up, down].filter((neighbor) => neighbor !== undefined);
  };

  const toggleCell = (index) => {
    setCellStates((prevStates) => {
      const newStates = [...prevStates];
      const nextIsBlocked = !newStates[index];
      newStates[index] = nextIsBlocked;

      setCellWeights((prevWeights) => {
        const updated = [...prevWeights];
        const defaultH = Math.abs(0 - Math.floor(index / gridSize)) + Math.abs(7 - (index % gridSize));
        updated[index] = {
          ...updated[index],
          hWeight: nextIsBlocked ? 999 : defaultH,
        };
        return updated;
      });

      return newStates;
    });
  };

  const setMessage = (message) => {
    setMessages(message);
  };

  const resetCells = () => {
    setCellStates(Array(totalCells).fill(false));
    setCellWeights(initializeCellWeights());
    setSolution([]);
    setMessage('Reset cells');
  };

  const renderGridCells = () => {
    return (
      <div className="grid grid-cols-8 gap-1 p-2 border-2 rounded-lg bg-slate-100 shadow-sm">
        {Array.from({ length: totalCells }, (_, index) => {
          const row = Math.floor(index / gridSize);
          const col = index % gridSize;
          const cellWeight = cellWeights[index];
          const isInPath = solvedCells.includes(index);

          const cellClassName =
            'w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-md flex flex-col items-center justify-center text-[9px] sm:text-[10px] md:text-xs font-semibold';

          if (row === gridSize - 1 && col === 0) {
            return (
              <div key={index} className={`${cellClassName} bg-[#2e7a34] text-white`}>
                START
              </div>
            );
          }

          if (row === 0 && col === gridSize - 1) {
            return (
              <div key={index} className={`${cellClassName} bg-[#a4832f] text-white`}>
                GOAL
              </div>
            );
          }

          return (
            <button
              key={index}
              type="button"
              className={`${cellClassName} ${
                isInPath ? 'bg-blue-500 text-white' : cellStates[index] ? 'bg-red-500 text-white' : 'bg-gray-300'
              }`}
              onClick={() => toggleCell(index)}
            >
              <span>{`(${row},${col})`}</span>
              <span>{`g:${cellWeight?.gWeight ?? 0}`}</span>
              <span>{`h:${cellWeight?.hWeight ?? 0}`}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 gap-4">
      <div className="w-full max-w-6xl flex items-center justify-between">
        <button
          type="button"
          onClick={() => window.location.assign(demosHref)}
          className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800"
        >
          ← Back
        </button>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-center">A* Algorithm Demo</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">Instructions</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Tap/click cells to mark blocked terrain (red).</li>
          <li>Press <strong>Solve</strong> to compute the shortest path from START to GOAL.</li>
          <li>Use <strong>Reset</strong> to clear blockers and path, or randomize weights to vary traversal cost.</li>
          <li>Highlighted blue cells indicate the currently solved path.</li>
        </ul>
      </section>

      <div className="flex flex-col lg:flex-row items-start justify-center w-full max-w-6xl gap-4">
        <div className="flex flex-col p-4 rounded-xl border border-slate-200 bg-white w-full lg:w-72 gap-3 shadow-sm">
          <button
            className="font-bold rounded-lg text-lg w-full h-12 bg-[#2e7a34] text-white hover:bg-[#89c48e]"
            onClick={solvePath}
          >
            Solve
          </button>
          <button
            className="font-bold rounded-lg text-lg w-full h-12 bg-[#3380fb] text-white hover:bg-[#6da5ff]"
            onClick={resetCells}
          >
            Reset
          </button>
          <button
            className="font-bold rounded-lg text-base w-full h-12 bg-[#3380fb] text-white hover:bg-[#6da5ff]"
            onClick={handleRandomizeCellWeights}
          >
            Randomize Cell Distances
          </button>
          <p className="text-red-500 text-left break-words min-h-6">{messages}</p>
        </div>

        <div className="w-full overflow-x-auto pb-2">
          <div className="w-max mx-auto">{renderGridCells()}</div>
        </div>
      </div>
    </main>
  );
}
