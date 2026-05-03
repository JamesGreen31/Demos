'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const PLAYER_CONFIGS = {
  2: [
    { key: 'red', label: 'Red' },
    { key: 'blue', label: 'Blue' },
  ],
  3: [
    { key: 'red', label: 'Red' },
    { key: 'blue', label: 'Blue' },
    { key: 'green', label: 'Green' },
  ],
};

const COLOR_STYLES = {
  red: {
    ring: 'ring-red-500',
    number: 'text-red-700',
    fill: 'bg-red-100',
    winnerRing: 'ring-red-500/95',
    winnerGlow: 'shadow-[0_0_26px_rgba(239,68,68,0.75)]',
  },
  blue: {
    ring: 'ring-blue-500',
    number: 'text-blue-700',
    fill: 'bg-blue-100',
    winnerRing: 'ring-blue-500/95',
    winnerGlow: 'shadow-[0_0_26px_rgba(59,130,246,0.75)]',
  },
  gold: {
    ring: 'ring-amber-500',
    number: 'text-amber-700',
    fill: 'bg-amber-100',
    winnerRing: 'ring-amber-500/95',
    winnerGlow: 'shadow-[0_0_26px_rgba(245,158,11,0.75)]',
  },
  green: {
    ring: 'ring-emerald-500',
    number: 'text-emerald-700',
    fill: 'bg-emerald-100',
    winnerRing: 'ring-emerald-500/95',
    winnerGlow: 'shadow-[0_0_26px_rgba(16,185,129,0.75)]',
  },
};

function createBoard(height) {
  return Array.from({ length: height }, (_, row) =>
    Array.from({ length: row + 1 }, (_, col) => ({
      id: `${row}-${col}`,
      row,
      col,
      move: null,
    })),
  );
}

function getNeighbors(row, col, height) {
  const candidates = [
    [row, col - 1],
    [row, col + 1],
    [row - 1, col - 1],
    [row - 1, col],
    [row + 1, col],
    [row + 1, col + 1],
  ];

  return candidates.filter(([r, c]) => r >= 0 && r < height && c >= 0 && c <= r);
}

function initialState(playerCount, aiEnabled = false) {
  const players = aiEnabled
    ? (playerCount === 2
      ? [{ key: 'red', label: 'Red' }, { key: 'gold', label: 'Gold (AI)' }]
      : [{ key: 'red', label: 'Red' }, { key: 'blue', label: 'Blue' }, { key: 'gold', label: 'Gold (AI)' }])
    : PLAYER_CONFIGS[playerCount];
  const effectivePlayerCount = players.length;
  const height = effectivePlayerCount === 2 ? 6 : 7;
  const nextValues = Object.fromEntries(players.map((player) => [player.key, 1]));

  return {
    playerCount: effectivePlayerCount,
    players,
    board: createBoard(height),
    height,
    turnIndex: 0,
    nextValues,
    selected: null,
    hovered: null,
    gameOver: false,
    blackHole: null,
    connectedCells: [],
    scores: Object.fromEntries(players.map((player) => [player.key, 0])),
    winnerKeys: [],
    aiCandidateIds: [],
    aiThinking: false,
    aiEnabled,
  };
}

export default function BlackHolePage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [playerCount, setPlayerCount] = useState(2);
  const [started, setStarted] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [state, setState] = useState(() => initialState(2, true));
  const aiTimerRef = useRef(null);

  useEffect(() => {
    document.title = 'Black Hole';
  }, []);

  const currentPlayer = state.players[state.turnIndex];

  const openCells = useMemo(
    () => state.board.flat().filter((cell) => !cell.move),
    [state.board],
  );

  const blackHolePreview = useMemo(() => {
    if (state.gameOver || !state.selected || openCells.length !== 2) return null;
    return openCells.find((cell) => cell.id !== state.selected.id) ?? null;
  }, [openCells, state.gameOver, state.selected]);

  const statusText = useMemo(() => {
    if (!started) return 'Choose your player count and start the game.';
    if (state.gameOver) {
      if (state.winnerKeys.length > 1) {
        return `Game over! Tie: ${state.winnerKeys.join(' + ')} at ${state.scores[state.winnerKeys[0]]}.`;
      }
      return `Game over! ${state.winnerKeys[0]} wins with ${state.scores[state.winnerKeys[0]]}.`;
    }

    const value = state.nextValues[currentPlayer.key];
    return `${currentPlayer.label} turn — place ${value}.`;
  }, [currentPlayer, started, state]);

  const cellPitch = 64;
  const cellRadius = 28;
  const boardWidth = state.height * cellPitch;
  const boardHeight = state.height * cellPitch - 8;

  const connectedLineSegments = useMemo(() => {
    if (!state.blackHole || !state.gameOver) return [];

    const getCellCenter = (cell) => ({
      x: ((state.height - (cell.row + 1)) * cellPitch) / 2 + cell.col * cellPitch + cellRadius,
      y: cell.row * cellPitch + cellRadius,
    });

    const blackHoleCenter = getCellCenter(state.blackHole);

    return state.connectedCells.map((cell) => {
      const center = getCellCenter(cell);
      return {
        id: cell.id,
        x1: center.x,
        y1: center.y,
        x2: blackHoleCenter.x,
        y2: blackHoleCenter.y,
      };
    });
  }, [state.blackHole, state.connectedCells, state.gameOver, state.height]);

  function startGame() {
    setState(initialState(playerCount, aiEnabled));
    setStarted(true);
  }

  function resetGame() {
    if (!window.confirm('Are you sure you want to start a new game?')) return;
    setState(initialState(playerCount, aiEnabled));
    setStarted(false);
  }

  function handleCellClick(cell) {
    if (!started || state.gameOver || cell.move || (state.aiEnabled && currentPlayer.key === 'gold')) return;

    setState((prev) => {
      if (prev.selected?.id === cell.id) {
        return { ...prev, selected: null };
      }
      return { ...prev, selected: { row: cell.row, col: cell.col, id: cell.id } };
    });
  }

  function commitMove() {
    if (!started || state.gameOver || !state.selected) return;

    setState((prev) => {
      const player = prev.players[prev.turnIndex];
      const placement = prev.nextValues[player.key];

      const nextBoard = prev.board.map((row) =>
        row.map((cell) => {
          if (cell.id !== prev.selected.id) return cell;
          return {
            ...cell,
            move: {
              playerKey: player.key,
              playerLabel: player.label,
              value: placement,
            },
          };
        }),
      );

      const nextValues = {
        ...prev.nextValues,
        [player.key]: placement + 1,
      };

      const nextOpen = nextBoard.flat().filter((cell) => !cell.move);
      if (nextOpen.length === 1) {
        const blackHole = nextOpen[0];
        const connectedCells = getNeighbors(blackHole.row, blackHole.col, prev.height)
          .map(([row, col]) => nextBoard[row][col])
          .filter((cell) => cell.move);

        const scores = Object.fromEntries(prev.players.map((entry) => [entry.key, 0]));
        for (const connected of connectedCells) {
          scores[connected.move.playerKey] += connected.move.value;
        }

        const lowest = Math.min(...Object.values(scores));
        const winnerKeys = prev.players
          .map((entry) => entry.key)
          .filter((key) => scores[key] === lowest);

        return {
          ...prev,
          board: nextBoard,
          nextValues,
          selected: null,
          hovered: null,
          gameOver: true,
          blackHole,
          connectedCells,
          scores,
          winnerKeys,
        };
      }

      return {
        ...prev,
        board: nextBoard,
        nextValues,
        turnIndex: (prev.turnIndex + 1) % prev.playerCount,
        selected: null,
        hovered: null,
        aiCandidateIds: [],
        aiThinking: false,
      };
    });
  }



  useEffect(() => {
    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }

    if (!started || state.gameOver || !state.aiEnabled || currentPlayer.key !== 'gold') return;

    const open = state.board.flat().filter((cell) => !cell.move);
    if (open.length === 0) return;

    const scored = open
      .map((cell) => {
        const neighbors = getNeighbors(cell.row, cell.col, state.height).map(([r, c]) => state.board[r][c]);
        const occupied = neighbors.filter((neighbor) => neighbor.move);
        const score = occupied.reduce((sum, entry) => sum + entry.move.value, 0) + occupied.length * 0.8 + Math.random() * 0.01;
        return { cell, score };
      })
      .sort((a, b) => a.score - b.score);

    const topThree = scored.slice(0, 3).map((entry) => entry.cell.id);
    const choice = scored[0].cell;

    setState((prev) => ({ ...prev, aiCandidateIds: topThree, aiThinking: true }));

    aiTimerRef.current = setTimeout(() => {
      setState((prev) => {
        if (prev.gameOver) return prev;
        const player = prev.players[prev.turnIndex];
        const placement = prev.nextValues[player.key];
        const nextBoard = prev.board.map((row) =>
          row.map((cell) => (cell.id === choice.id
            ? { ...cell, move: { playerKey: player.key, playerLabel: player.label, value: placement } }
            : cell)),
        );
        const nextValues = { ...prev.nextValues, [player.key]: placement + 1 };
        const nextOpen = nextBoard.flat().filter((cell) => !cell.move);
        if (nextOpen.length === 1) {
          const blackHole = nextOpen[0];
          const connectedCells = getNeighbors(blackHole.row, blackHole.col, prev.height)
            .map(([row, col]) => nextBoard[row][col])
            .filter((cell) => cell.move);
          const scores = Object.fromEntries(prev.players.map((entry) => [entry.key, 0]));
          for (const connected of connectedCells) scores[connected.move.playerKey] += connected.move.value;
          const lowest = Math.min(...Object.values(scores));
          const winnerKeys = prev.players.map((entry) => entry.key).filter((key) => scores[key] === lowest);
          return { ...prev, board: nextBoard, nextValues, selected: null, hovered: null, aiCandidateIds: [], aiThinking: false, gameOver: true, blackHole, connectedCells, scores, winnerKeys };
        }
        return { ...prev, board: nextBoard, nextValues, turnIndex: (prev.turnIndex + 1) % prev.playerCount, selected: null, hovered: null, aiCandidateIds: [], aiThinking: false };
      });
    }, 1500);

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [started, state.board, state.gameOver, state.aiEnabled, currentPlayer.key, state.height]);

  return (
    <main className="min-h-screen p-6 md:p-8 flex flex-col items-center gap-6">
      <div className="w-full max-w-6xl flex items-center justify-between">
        <button
          type="button"
          onClick={() => window.location.assign(demosHref)}
          className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800"
        >
          ← Back
        </button>
      </div>

      <h1 className="text-3xl font-bold text-center">Black Hole</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-2">Description</h2>
        <p className="text-slate-700">
          Black Hole is a positional-number strategy game played on an upside-down triangular pyramid of circles.
          Players take turns claiming exactly one open circle and place their own rising number sequence
          (1, 2, 3, and so on for that player). Once a circle is confirmed, it is permanently locked.
          When one circle remains, it becomes the black hole. Each player totals only the numbers in circles
          directly connected to that black hole, and the lowest total wins.
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to Play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Choose 2 players (height 6) or 3 players (height 7), then start.</li>
          <li>Enable AI to replace the last seat with Gold (AI), with Gold always moving last.</li>
          <li>On each turn, pick one open circle and confirm the move.</li>
          <li>Each player places increasing numbers: 1, 2, 3, and so on for their own turns.</li>
          <li>Placed circles lock immediately. No undo moves are allowed.</li>
          <li>When one circle remains, it becomes the black hole.</li>
          <li>Add the numbers in circles touching the black hole. Lowest total wins.</li>
        </ul>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">Configuration</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <label className="font-medium text-slate-700" htmlFor="playerCount">Player count</label>
          <select
            id="playerCount"
            value={playerCount}
            onChange={(event) => setPlayerCount(Number(event.target.value))}
            className="rounded border border-slate-300 px-3 py-2"
            disabled={started}
          >
            <option value={2}>2 players</option>
            <option value={3}>3 players</option>
          </select>

          {!started && (
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={aiEnabled} onChange={(event) => setAiEnabled(event.target.checked)} />
              Play vs AI (Gold)
            </label>
          )}

          {!started && (
            <button
              type="button"
              onClick={startGame}
              className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Start Game
            </button>
          )}

          {started && (
            <button
              type="button"
              onClick={resetGame}
              className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-700"
            >
              Reset Game
            </button>
          )}
        </div>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col items-center gap-4">
        <p className="text-lg font-semibold text-slate-800">{statusText}</p>
        {started && state.aiEnabled && currentPlayer.key === 'gold' && (
          <p className="text-sm text-amber-700 font-medium">Gold AI is thinking... showing top 3 candidate moves.</p>
        )}

        {started && !state.gameOver && (
          <button
            type="button"
            onClick={commitMove}
            disabled={!state.selected}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Confirm Move
          </button>
        )}

        {started && (
          <div
            className="relative flex flex-col gap-2 items-center"
            style={{ width: `${boardWidth}px`, minHeight: `${boardHeight}px` }}
            onMouseLeave={() => setState((prev) => ({ ...prev, hovered: null }))}
          >
            {connectedLineSegments.length > 0 && (
              <svg className="pointer-events-none absolute inset-0 z-0" width={boardWidth} height={boardHeight}>
                {connectedLineSegments.map((line) => (
                  <line
                    key={line.id}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    className="stroke-black/65"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                ))}
              </svg>
            )}

            {state.board.map((row) => (
              <div key={`row-${row[0].row}`} className="relative z-10 flex justify-center gap-3">
                {row.map((cell) => {
                  const isSelected = state.selected?.id === cell.id;
                  const isHovered = state.hovered?.id === cell.id;
                  const aiCandidateRank = state.aiCandidateIds.indexOf(cell.id);
                  const previewActive = !cell.move && (isSelected || (!state.selected && isHovered) || aiCandidateRank >= 0);
                  const previewColor = currentPlayer ? COLOR_STYLES[currentPlayer.key] : null;
                  const showBlackHolePreview = blackHolePreview?.id === cell.id;
                  const isBlackHole = state.blackHole?.id === cell.id;
                  const isConnected = state.connectedCells.some((connected) => connected.id === cell.id);
                  const connectedTone = isConnected && cell.move ? COLOR_STYLES[cell.move.playerKey] : null;

                  let circleClass = 'relative h-14 w-14 rounded-full border-2 transition-all duration-150 flex items-center justify-center font-bold text-lg select-none';
                  let innerClass = 'absolute inset-0 rounded-full';
                  let numberClass = 'relative z-10 text-slate-700';
                  let shownNumber = '';

                  if (cell.move) {
                    const tone = COLOR_STYLES[cell.move.playerKey];
                    circleClass += ` border-black ${tone.fill}`;
                    numberClass = `relative z-10 ${tone.number}`;
                    shownNumber = cell.move.value;
                  } else {
                    circleClass += ' border-slate-300 bg-slate-50';
                    if (!state.gameOver) {
                      circleClass += ' hover:border-slate-400';
                    }
                  }

                  if (previewActive && previewColor) {
                    circleClass += ` ring-2 ${previewColor.ring} border-transparent`;
                    numberClass = `relative z-10 ${previewColor.number} opacity-30`;
                    shownNumber = state.nextValues[currentPlayer.key];
                  }

                  if (aiCandidateRank >= 0) {
                    circleClass += ' ring-4 ring-amber-300';
                    shownNumber = state.nextValues[currentPlayer.key];
                  }

                  if (showBlackHolePreview) {
                    innerClass += ' bg-slate-900/20';
                  }

                  if (isBlackHole) {
                    innerClass += ' bg-black';
                    numberClass = 'relative z-10 text-white text-xs tracking-wide';
                    shownNumber = '';
                  }

                  if (isConnected && connectedTone) {
                    circleClass += ` ring-4 ${connectedTone.winnerRing} ${connectedTone.winnerGlow}`;
                  }

                  if (state.gameOver && !isConnected && !isBlackHole) {
                    circleClass += ' opacity-45';
                  }

                  return (
                    <button
                      key={cell.id}
                      type="button"
                      onClick={() => handleCellClick(cell)}
                      onMouseEnter={() => {
                        if (!cell.move && started && !state.gameOver) {
                          setState((prev) => ({ ...prev, hovered: { id: cell.id } }));
                        }
                      }}
                      className={circleClass}
                    >
                      <span className={innerClass} />
                      <span className={numberClass}>{shownNumber}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {started && !state.gameOver && (
          <p className="text-sm text-slate-600">Open circles left: {openCells.length}.</p>
        )}

        {state.gameOver && (
          <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xl font-semibold mb-3">Scoreboard (lowest wins)</h3>
            <ul className="space-y-2">
              {state.players.map((player) => (
                <li key={player.key} className="flex items-center justify-between rounded bg-white px-3 py-2 border border-slate-200">
                  <span className="font-medium">{player.label}</span>
                  <span className="font-bold">{state.scores[player.key]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
