'use client';

import { useMemo, useState } from 'react';

const BOARD_SIZE = 11;

function createBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function getNeighbors(row, col, size) {
  return [
    [row - 1, col],
    [row - 1, col + 1],
    [row, col - 1],
    [row, col + 1],
    [row + 1, col - 1],
    [row + 1, col],
  ].filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size);
}

function playerHasConnection(board, player) {
  const size = board.length;
  const stack = [];
  const visited = new Set();

  if (player === 'Blue') {
    for (let col = 0; col < size; col += 1) {
      if (board[0][col] === player) {
        stack.push([0, col]);
      }
    }
  } else {
    for (let row = 0; row < size; row += 1) {
      if (board[row][0] === player) {
        stack.push([row, 0]);
      }
    }
  }

  while (stack.length > 0) {
    const [row, col] = stack.pop();
    const key = `${row}:${col}`;

    if (visited.has(key)) continue;
    visited.add(key);

    if (player === 'Blue' && row === size - 1) {
      return true;
    }

    if (player === 'Red' && col === size - 1) {
      return true;
    }

    getNeighbors(row, col, size).forEach(([nextRow, nextCol]) => {
      if (board[nextRow][nextCol] === player) {
        stack.push([nextRow, nextCol]);
      }
    });
  }

  return false;
}

function buildInitialGame() {
  return {
    board: createBoard(BOARD_SIZE),
    currentPlayer: 'Blue',
    winner: null,
    moves: 0,
  };
}

export default function HexPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [game, setGame] = useState(buildInitialGame);

  const statusMessage = useMemo(() => {
    if (game.winner) {
      return `${game.winner} wins by connecting opposite sides.`;
    }

    return `${game.currentPlayer}'s turn. ${game.currentPlayer === 'Blue' ? 'Connect top to bottom.' : 'Connect left to right.'}`;
  }, [game.currentPlayer, game.winner]);

  function resetGame() {
    setGame(buildInitialGame());
  }

  function handleMove(row, col) {
    setGame((prev) => {
      if (prev.winner) return prev;
      if (prev.board[row][col]) return prev;

      const board = prev.board.map((line) => [...line]);
      board[row][col] = prev.currentPlayer;

      const winner = playerHasConnection(board, prev.currentPlayer) ? prev.currentPlayer : null;

      return {
        board,
        winner,
        currentPlayer: winner ? prev.currentPlayer : prev.currentPlayer === 'Blue' ? 'Red' : 'Blue',
        moves: prev.moves + 1,
      };
    });
  }

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

      <h1 className="text-3xl font-bold">Hex</h1>

      <section className="w-full max-w-5xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Blue tries to connect the top edge to the bottom edge.</li>
          <li>Red tries to connect the left edge to the right edge.</li>
          <li>Players alternate placing one stone on an empty hex.</li>
          <li>Hex has no draws: one player must eventually connect their sides.</li>
        </ul>
      </section>

      <section className="w-full max-w-5xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col items-center gap-4 overflow-x-auto">
        <p className="font-semibold text-center">{statusMessage}</p>
        <p className="text-sm text-slate-600">Moves played: {game.moves}</p>

        <div className="flex flex-col items-start" aria-label="Hex board">
          {game.board.map((row, rowIndex) => (
            <div key={rowIndex} className="flex -mt-1" style={{ marginLeft: `${rowIndex * 18}px` }}>
              {row.map((cell, colIndex) => {
                const isBlue = cell === 'Blue';
                const isRed = cell === 'Red';
                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    type="button"
                    onClick={() => handleMove(rowIndex, colIndex)}
                    disabled={Boolean(cell) || Boolean(game.winner)}
                    className={`w-9 h-9 md:w-10 md:h-10 border border-slate-400 mx-[2px] clip-hex transition-colors ${
                      isBlue
                        ? 'bg-blue-500 border-blue-600'
                        : isRed
                        ? 'bg-rose-500 border-rose-600'
                        : 'bg-slate-100 hover:bg-slate-200'
                    } ${game.winner ? 'cursor-default' : ''}`}
                    aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}`}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex gap-2 text-sm">
          <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded bg-blue-500" /> Blue (top → bottom)</span>
          <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded bg-rose-500" /> Red (left → right)</span>
        </div>

        <button
          type="button"
          onClick={resetGame}
          className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-700"
        >
          Reset Game
        </button>
      </section>

      <style jsx>{`
        .clip-hex {
          clip-path: polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%);
        }
      `}</style>
    </main>
  );
}
