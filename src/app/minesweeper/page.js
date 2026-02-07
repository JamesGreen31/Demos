'use client';

import { useMemo, useState } from 'react';

const ROWS = 8;
const COLS = 8;
const MINE_COUNT = 10;

function createBoard() {
  const board = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      isMine: false,
      isRevealed: false,
      adjacentMines: 0,
    }))
  );

  let placed = 0;
  while (placed < MINE_COUNT) {
    const row = Math.floor(Math.random() * ROWS);
    const col = Math.floor(Math.random() * COLS);

    if (!board[row][col].isMine) {
      board[row][col].isMine = true;
      placed += 1;
    }
  }

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (board[row][col].isMine) continue;

      let count = 0;
      for (let r = -1; r <= 1; r += 1) {
        for (let c = -1; c <= 1; c += 1) {
          const nr = row + r;
          const nc = col + c;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].isMine) {
            count += 1;
          }
        }
      }
      board[row][col].adjacentMines = count;
    }
  }

  return board;
}

function revealNeighbors(board, row, col) {
  const stack = [[row, col]];

  while (stack.length) {
    const [r, c] = stack.pop();
    const cell = board[r][c];

    if (cell.isRevealed) continue;
    cell.isRevealed = true;

    if (cell.adjacentMines !== 0) continue;

    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const nr = r + dr;
        const nc = c + dc;

        if (
          (dr !== 0 || dc !== 0) &&
          nr >= 0 &&
          nr < ROWS &&
          nc >= 0 &&
          nc < COLS &&
          !board[nr][nc].isRevealed &&
          !board[nr][nc].isMine
        ) {
          stack.push([nr, nc]);
        }
      }
    }
  }
}

export default function MinesweeperPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [board, setBoard] = useState(() => createBoard());
  const [gameState, setGameState] = useState('playing');

  const revealedSafeCells = useMemo(
    () => board.flat().filter((cell) => cell.isRevealed && !cell.isMine).length,
    [board]
  );

  function resetGame() {
    setBoard(createBoard());
    setGameState('playing');
  }

  function revealAllMines(nextBoard) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (nextBoard[row][col].isMine) {
          nextBoard[row][col].isRevealed = true;
        }
      }
    }
  }

  function handleCellClick(row, col) {
    if (gameState !== 'playing') return;

    setBoard((prevBoard) => {
      const nextBoard = prevBoard.map((boardRow) => boardRow.map((cell) => ({ ...cell })));
      const cell = nextBoard[row][col];

      if (cell.isRevealed) return prevBoard;

      if (cell.isMine) {
        revealAllMines(nextBoard);
        setGameState('lost');
        return nextBoard;
      }

      revealNeighbors(nextBoard, row, col);

      const newRevealedSafeCells = nextBoard
        .flat()
        .filter((nextCell) => nextCell.isRevealed && !nextCell.isMine).length;

      if (newRevealedSafeCells === ROWS * COLS - MINE_COUNT) {
        setGameState('won');
      }

      return nextBoard;
    });
  }

  return (
    <main className="min-h-screen p-6 md:p-8 flex flex-col items-center gap-5">
      <div className="w-full max-w-4xl flex items-center justify-between">
        <button
          type="button"
          onClick={() => window.location.assign(demosHref)}
          className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800"
        >
          ← Back
        </button>
      </div>

      <h1 className="text-3xl font-bold text-center">Minesweeper Demo</h1>

      <section className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">Instructions</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Click a tile to reveal it.</li>
          <li>Numbers tell you how many mines touch that tile.</li>
          <li>Reveal all non-mine tiles to win.</li>
          <li>If you reveal a mine, the game ends and all mines are shown.</li>
        </ul>
      </section>

      <div className="grid grid-cols-8 gap-1 bg-gray-300 p-2 rounded-lg shadow">
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <button
              key={`${rowIndex}-${colIndex}`}
              type="button"
              onClick={() => handleCellClick(rowIndex, colIndex)}
              className={`h-9 w-9 rounded text-sm font-semibold flex items-center justify-center ${
                cell.isRevealed ? 'bg-white' : 'bg-sky-200 hover:bg-sky-300'
              } ${gameState !== 'playing' ? 'cursor-default' : ''}`}
            >
              {cell.isRevealed
                ? cell.isMine
                  ? '💣'
                  : cell.adjacentMines > 0
                  ? cell.adjacentMines
                  : ''
                : ''}
            </button>
          ))
        )}
      </div>

      <p className="font-medium text-center">
        {gameState === 'playing' && `Safe cells revealed: ${revealedSafeCells}/${ROWS * COLS - MINE_COUNT}`}
        {gameState === 'won' && '🎉 You won!'}
        {gameState === 'lost' && '💥 You hit a mine!'}
      </p>

      <button
        type="button"
        className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-700"
        onClick={resetGame}
      >
        New Game
      </button>
    </main>
  );
}
