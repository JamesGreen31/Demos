'use client';

import { useMemo, useState } from 'react';

const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function checkWinner(cells) {
  for (const [a, b, c] of WINNING_LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return cells[a];
    }
  }

  if (cells.every(Boolean)) {
    return 'draw';
  }

  return null;
}

function createEmptyBoards() {
  return Array.from({ length: 9 }, () => Array(9).fill(null));
}

function createInitialState() {
  return {
    boards: createEmptyBoards(),
    boardResults: Array(9).fill(null),
    currentPlayer: 'X',
    forcedBoard: null,
    winner: null,
  };
}

function boardIsOpen(result) {
  return result === null;
}

function getActiveBoards(forcedBoard, boardResults, winner) {
  if (winner) return [];

  if (forcedBoard !== null && boardIsOpen(boardResults[forcedBoard])) {
    return [forcedBoard];
  }

  return boardResults
    .map((result, idx) => ({ result, idx }))
    .filter(({ result }) => boardIsOpen(result))
    .map(({ idx }) => idx);
}

export default function MetaTicTacToePage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [state, setState] = useState(createInitialState);

  const activeBoards = useMemo(
    () => getActiveBoards(state.forcedBoard, state.boardResults, state.winner),
    [state]
  );

  function resetGame() {
    setState(createInitialState());
  }

  function handleCellClick(boardIndex, cellIndex) {
    setState((prev) => {
      const playableBoards = getActiveBoards(prev.forcedBoard, prev.boardResults, prev.winner);

      if (prev.winner) return prev;
      if (!playableBoards.includes(boardIndex)) return prev;
      if (prev.boards[boardIndex][cellIndex]) return prev;

      const boards = prev.boards.map((board) => [...board]);
      const boardResults = [...prev.boardResults];

      boards[boardIndex][cellIndex] = prev.currentPlayer;

      const updatedLocalResult = checkWinner(boards[boardIndex]);
      boardResults[boardIndex] = updatedLocalResult;

      const globalWinner = checkWinner(boardResults.map((result) => (result === 'draw' ? null : result)));
      const hasOpenBoards = boardResults.some((result) => boardIsOpen(result));

      let forcedBoard = cellIndex;
      if (!boardIsOpen(boardResults[forcedBoard])) {
        forcedBoard = null;
      }

      let winner = null;
      if (globalWinner) {
        winner = globalWinner;
      } else if (!hasOpenBoards) {
        winner = 'draw';
      }

      return {
        boards,
        boardResults,
        currentPlayer: prev.currentPlayer === 'X' ? 'O' : 'X',
        forcedBoard,
        winner,
      };
    });
  }

  const statusMessage = state.winner
    ? state.winner === 'draw'
      ? 'The meta board is a draw.'
      : `Player ${state.winner} wins the game!`
    : state.forcedBoard === null
    ? `Player ${state.currentPlayer}'s turn — play in any highlighted board.`
    : `Player ${state.currentPlayer}'s turn — play in board ${state.forcedBoard + 1}.`;

  return (
    <main className="min-h-screen p-6 md:p-8 flex flex-col items-center gap-6">
      <div className="w-full max-w-5xl flex items-center justify-between">
        <button
          type="button"
          onClick={() => window.location.assign(demosHref)}
          className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800"
        >
          ← Back
        </button>
      </div>

      <h1 className="text-3xl font-bold">Meta Tic-Tac-Toe</h1>

      <section className="w-full max-w-5xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>
            The game has a 3×3 grid of tic-tac-toe boards. You still place X and O on individual
            cells, but each small board can be won independently.
          </li>
          <li>
            Your move decides where your opponent must play next: if you play in cell #5 of a small
            board, your opponent must play in small board #5 (center board).
          </li>
          <li>
            If the destination board is already won or full, your opponent may play in any open board.
          </li>
          <li>
            Win three small boards in a row on the large board to win the overall game.
          </li>
          <li>
            Visual feedback: highlighted boards are playable now, grayed boards are locked, and won
            boards display their winner.
          </li>
        </ul>
      </section>

      <section className="w-full max-w-5xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col items-center gap-4">
        <p className="font-semibold text-center">{statusMessage}</p>

        <div className="grid grid-cols-3 gap-3 bg-slate-900 p-3 rounded-xl">
          {state.boards.map((board, boardIndex) => {
            const boardResult = state.boardResults[boardIndex];
            const isActive = activeBoards.includes(boardIndex);
            const isClosed = boardResult !== null;

            return (
              <div
                key={boardIndex}
                className={`relative grid grid-cols-3 gap-[2px] rounded-md p-1 transition-all ${
                  isActive ? 'bg-emerald-300 ring-4 ring-emerald-200' : 'bg-slate-300'
                } ${isClosed ? 'opacity-75' : ''}`}
              >
                {board.map((cell, cellIndex) => (
                  <button
                    key={`${boardIndex}-${cellIndex}`}
                    type="button"
                    onClick={() => handleCellClick(boardIndex, cellIndex)}
                    disabled={Boolean(state.winner) || !isActive || Boolean(cell) || isClosed}
                    className={`h-12 w-12 md:h-14 md:w-14 text-2xl md:text-3xl font-bold rounded-sm flex items-center justify-center ${
                      Boolean(cell)
                        ? 'bg-white text-slate-900'
                        : isActive
                        ? 'bg-white hover:bg-emerald-50'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                    aria-label={`Board ${boardIndex + 1}, cell ${cellIndex + 1}`}
                  >
                    {cell}
                  </button>
                ))}

                {boardResult && (
                  <div className="absolute inset-0 rounded-md flex items-center justify-center bg-slate-900/25 pointer-events-none">
                    <span className="text-4xl md:text-5xl font-black text-white drop-shadow">
                      {boardResult === 'draw' ? '—' : boardResult}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={resetGame}
          className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-700"
        >
          Reset Game
        </button>
      </section>
    </main>
  );
}
