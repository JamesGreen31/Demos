'use client';

import { useMemo, useState } from 'react';

const BOARD_SIZE = 11;

function createBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function getNeighbors(row, col, size) {
  return [
    [row - 1, col - 1],
    [row - 1, col],
    [row, col - 1],
    [row, col + 1],
    [row + 1, col],
    [row + 1, col + 1],
  ].filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size);
}

function findWinningPath(board, player) {
  const size = board.length;
  const stack = [];
  const visited = new Set();
  const parent = new Map();

  if (player === 'Blue') {
    for (let col = 0; col < size; col += 1) {
      if (board[0][col] === player) {
        const key = `0:${col}`;
        stack.push([0, col]);
        parent.set(key, null);
      }
    }
  } else {
    for (let row = 0; row < size; row += 1) {
      if (board[row][0] === player) {
        const key = `${row}:0`;
        stack.push([row, 0]);
        parent.set(key, null);
      }
    }
  }

  while (stack.length > 0) {
    const [row, col] = stack.pop();
    const key = `${row}:${col}`;

    if (visited.has(key)) continue;
    visited.add(key);

    if ((player === 'Blue' && row === size - 1) || (player === 'Red' && col === size - 1)) {
      const path = new Set();
      let current = key;
      while (current) {
        path.add(current);
        current = parent.get(current);
      }
      return path;
    }

    getNeighbors(row, col, size).forEach(([nextRow, nextCol]) => {
      if (board[nextRow][nextCol] !== player) return;
      const nextKey = `${nextRow}:${nextCol}`;
      if (visited.has(nextKey) || parent.has(nextKey)) return;
      parent.set(nextKey, key);
      stack.push([nextRow, nextCol]);
    });
  }

  return null;
}

function buildInitialGame() {
  return {
    board: createBoard(BOARD_SIZE),
    currentPlayer: 'Blue',
    winner: null,
    winningPath: new Set(),
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

      const winningPath = findWinningPath(board, prev.currentPlayer);
      const winner = winningPath ? prev.currentPlayer : null;

      return {
        board,
        winner,
        winningPath: winningPath ?? new Set(),
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
        <h2 className="text-2xl font-semibold mb-3">About the game</h2>
        <p className="text-slate-700 mb-3">
          Hex is a classic two-player connection board game invented by Piet Hein and independently rediscovered by
          John Nash. Players place stones on a hexagonal grid and race to connect their assigned opposite sides.
        </p>
        <p className="text-slate-700">
          Unlike many abstract board games, Hex cannot end in a draw, so every complete game has exactly one winner.
        </p>
      </section>

      <section className="w-full max-w-5xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
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

        <div className="relative flex flex-col items-start pt-3 pb-3" aria-label="Hex board">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-full pointer-events-none" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full pointer-events-none" aria-hidden="true" />
          {game.board.map((row, rowIndex) => (
            <div key={rowIndex} className="flex -mt-3" style={{ marginLeft: `${rowIndex * 20}px` }}>
              {row.map((cell, colIndex) => {
                const isBlue = cell === 'Blue';
                const isRed = cell === 'Red';
                const isTop = rowIndex === 0;
                const isBottom = rowIndex === BOARD_SIZE - 1;
                const isLeft = colIndex === 0;
                const isRight = colIndex === BOARD_SIZE - 1;
                const isWinningCell = game.winningPath.has(`${rowIndex}:${colIndex}`);

                const borderStyle = {
                  borderTopColor: isTop ? '#2563EB' : undefined,
                  borderBottomColor: isBottom ? '#2563EB' : undefined,
                  borderLeftColor: isLeft ? '#E11D48' : undefined,
                  borderRightColor: isRight ? '#E11D48' : undefined,
                  borderTopWidth: isTop ? '3px' : undefined,
                  borderBottomWidth: isBottom ? '3px' : undefined,
                  borderLeftWidth: isLeft ? '3px' : undefined,
                  borderRightWidth: isRight ? '3px' : undefined,
                };

                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    type="button"
                    onClick={() => handleMove(rowIndex, colIndex)}
                    disabled={Boolean(cell) || Boolean(game.winner)}
                    className={`hex-cell border border-slate-400 mx-[2px] transition-all ${
                      isBlue
                        ? 'bg-blue-500 border-blue-600'
                        : isRed
                        ? 'bg-rose-500 border-rose-600'
                        : 'bg-slate-100 hover:bg-slate-200'
                    } ${isWinningCell ? 'ring-4 ring-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.8)]' : ''} ${game.winner ? 'cursor-default' : ''}`}
                    style={borderStyle}
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
        .hex-cell {
          width: 40px;
          height: 46px;
          clip-path: polygon(50% 2%, 95% 25%, 95% 75%, 50% 98%, 5% 75%, 5% 25%);
        }

        @media (min-width: 768px) {
          .hex-cell {
            width: 44px;
            height: 50px;
          }
        }
      `}</style>
    </main>
  );
}
