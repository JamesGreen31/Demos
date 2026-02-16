'use client';

import { useEffect, useMemo, useState } from 'react';

const FACE_COUNT = 6;

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

function createFace(height, players, index) {
  return {
    index,
    board: createBoard(height),
    nextValues: Object.fromEntries(players.map((player) => [player.key, 1])),
    turnIndex: 0,
    selected: null,
    hovered: null,
    completed: false,
    blackHole: null,
    connectedCells: [],
    scores: Object.fromEntries(players.map((player) => [player.key, 0])),
    winnerKeys: [],
  };
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

function initialState(playerCount) {
  const players = PLAYER_CONFIGS[playerCount];
  const height = playerCount === 2 ? 6 : 7;

  return {
    playerCount,
    players,
    height,
    activeFaceIndex: 0,
    viewedFaceIndex: 0,
    allFacesComplete: false,
    faces: Array.from({ length: FACE_COUNT }, (_, index) => createFace(height, players, index)),
  };
}

function renderBoardFace({
  face,
  isActiveFace,
  state,
  currentFace,
  currentPlayer,
  blackHolePreview,
  boardWidth,
  boardHeight,
  connectedLineSegments,
  onCellClick,
  onCellHover,
  onCellLeave,
}) {
  return (
    <div className="relative flex flex-col gap-2 items-center" style={{ width: `${boardWidth}px`, minHeight: `${boardHeight}px` }}>
      {connectedLineSegments.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 z-0" width={boardWidth} height={boardHeight}>
          {connectedLineSegments.map((line) => (
            <line
              key={`${face.index}-${line.id}`}
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

      {face.board.map((row) => (
        <div key={`row-${face.index}-${row[0].row}`} className="relative z-10 flex justify-center gap-3">
          {row.map((cell) => {
            const isSelected = isActiveFace && currentFace.selected?.id === cell.id;
            const isHovered = isActiveFace && currentFace.hovered?.id === cell.id;
            const previewActive = !cell.move && isActiveFace && (isSelected || (!currentFace.selected && isHovered));
            const previewColor = currentPlayer ? COLOR_STYLES[currentPlayer.key] : null;
            const showBlackHolePreview = isActiveFace && blackHolePreview?.id === cell.id;
            const isBlackHole = face.blackHole?.id === cell.id;
            const isConnected = face.connectedCells.some((connected) => connected.id === cell.id);
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
              if (!state.allFacesComplete && isActiveFace && !currentFace.completed) {
                circleClass += ' hover:border-slate-400';
              }
            }

            if (previewActive && previewColor) {
              circleClass += ` ring-2 ${previewColor.ring} border-transparent`;
              numberClass = `relative z-10 ${previewColor.number} opacity-30`;
              shownNumber = currentFace.nextValues[currentPlayer.key];
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

            if ((face.completed || state.allFacesComplete) && !isConnected && !isBlackHole) {
              circleClass += ' opacity-45';
            }

            return (
              <button
                key={`${face.index}-${cell.id}`}
                type="button"
                onClick={() => onCellClick(cell)}
                onMouseEnter={() => onCellHover(cell)}
                onMouseLeave={onCellLeave}
                className={circleClass}
                disabled={!isActiveFace || state.allFacesComplete}
              >
                <span className={innerClass} />
                <span className={numberClass}>{shownNumber}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function BlackHolePage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [playerCount, setPlayerCount] = useState(2);
  const [displayMode, setDisplayMode] = useState('2d');
  const [started, setStarted] = useState(false);
  const [state, setState] = useState(() => initialState(2));

  useEffect(() => {
    document.title = 'Black Hole';
  }, []);

  const currentFace = state.faces[state.activeFaceIndex];
  const viewedFace = state.faces[state.viewedFaceIndex];
  const currentPlayer = state.players[currentFace.turnIndex];

  const openCells = useMemo(() => currentFace.board.flat().filter((cell) => !cell.move), [currentFace.board]);

  const blackHolePreview = useMemo(() => {
    if (!started || currentFace.completed || !currentFace.selected || openCells.length !== 2) return null;
    return openCells.find((cell) => cell.id !== currentFace.selected.id) ?? null;
  }, [currentFace.completed, currentFace.selected, openCells, started]);

  const totalScores = useMemo(() => {
    const totals = Object.fromEntries(state.players.map((player) => [player.key, 0]));
    state.faces.forEach((face) => {
      if (!face.completed) return;
      state.players.forEach((player) => {
        totals[player.key] += face.scores[player.key] || 0;
      });
    });
    return totals;
  }, [state.faces, state.players]);

  const overallWinnerKeys = useMemo(() => {
    if (!state.allFacesComplete) return [];
    const lowest = Math.min(...Object.values(totalScores));
    return state.players.map((player) => player.key).filter((key) => totalScores[key] === lowest);
  }, [state.allFacesComplete, state.players, totalScores]);

  const statusText = useMemo(() => {
    if (!started) return 'Choose your player count and start the game.';

    if (state.allFacesComplete) {
      if (overallWinnerKeys.length > 1) {
        return `All 6 faces complete! Tie: ${overallWinnerKeys.join(' + ')} at ${totalScores[overallWinnerKeys[0]]}.`;
      }
      return `All 6 faces complete! ${overallWinnerKeys[0]} wins with ${totalScores[overallWinnerKeys[0]]}.`;
    }

    const faceNumber = state.activeFaceIndex + 1;
    const value = currentFace.nextValues[currentPlayer.key];
    return `Face ${faceNumber}/6 — ${currentPlayer.label} turn, place ${value}.`;
  }, [currentFace.nextValues, currentPlayer, overallWinnerKeys, started, state.activeFaceIndex, state.allFacesComplete, totalScores]);

  const cellPitch = 64;
  const cellRadius = 28;
  const boardWidth = state.height * cellPitch;
  const boardHeight = state.height * cellPitch - 8;
  const objectRadius = Math.max(320, Math.round(boardWidth * 0.95));
  const stageWidth = boardWidth + objectRadius * 2 + 40;
  const stageHeight = boardHeight + 260;

  const viewedFaceConnections = useMemo(() => {
    if (!viewedFace.blackHole || !viewedFace.completed) return [];

    const getCellCenter = (cell) => ({
      x: ((state.height - (cell.row + 1)) * cellPitch) / 2 + cell.col * cellPitch + cellRadius,
      y: cell.row * cellPitch + cellRadius,
    });

    const blackHoleCenter = getCellCenter(viewedFace.blackHole);

    return viewedFace.connectedCells.map((cell) => {
      const center = getCellCenter(cell);
      return {
        id: cell.id,
        x1: center.x,
        y1: center.y,
        x2: blackHoleCenter.x,
        y2: blackHoleCenter.y,
      };
    });
  }, [state.height, viewedFace]);

  function startGame() {
    setState(initialState(playerCount));
    setStarted(true);
  }

  function resetGame() {
    if (!window.confirm('Are you sure you want to start a new game?')) return;
    setState(initialState(playerCount));
    setStarted(false);
  }

  function updateActiveFace(updater) {
    setState((prev) => {
      const nextFaces = prev.faces.map((face, index) => {
        if (index !== prev.activeFaceIndex) return face;
        return updater(face, prev);
      });
      return { ...prev, faces: nextFaces };
    });
  }

  function rotateView(direction) {
    setState((prev) => {
      const nextIndex = (prev.viewedFaceIndex + direction + FACE_COUNT) % FACE_COUNT;
      return { ...prev, viewedFaceIndex: nextIndex };
    });
  }

  function handleWheelRotate(event) {
    if (!started || displayMode !== '3d') return;
    if (Math.abs(event.deltaY) < 12) return;
    rotateView(event.deltaY > 0 ? 1 : -1);
  }

  function handleCellClick(cell) {
    if (!started || state.allFacesComplete || currentFace.completed || cell.move) return;

    updateActiveFace((face) => {
      if (face.selected?.id === cell.id) {
        return { ...face, selected: null };
      }
      return { ...face, selected: { row: cell.row, col: cell.col, id: cell.id } };
    });
  }

  function commitMove() {
    if (!started || state.allFacesComplete || currentFace.completed || !currentFace.selected) return;

    setState((prev) => {
      const face = prev.faces[prev.activeFaceIndex];
      const player = prev.players[face.turnIndex];
      const placement = face.nextValues[player.key];

      const nextBoard = face.board.map((row) =>
        row.map((cell) => {
          if (cell.id !== face.selected.id) return cell;
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
        ...face.nextValues,
        [player.key]: placement + 1,
      };

      const nextOpen = nextBoard.flat().filter((cell) => !cell.move);
      let nextFace = {
        ...face,
        board: nextBoard,
        nextValues,
        turnIndex: (face.turnIndex + 1) % prev.playerCount,
        selected: null,
        hovered: null,
      };

      let activeFaceIndex = prev.activeFaceIndex;
      let viewedFaceIndex = prev.viewedFaceIndex;
      let allFacesComplete = prev.allFacesComplete;

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
        const winnerKeys = prev.players.map((entry) => entry.key).filter((key) => scores[key] === lowest);

        nextFace = {
          ...nextFace,
          completed: true,
          blackHole,
          connectedCells,
          scores,
          winnerKeys,
        };

        const isFinalFace = prev.activeFaceIndex === FACE_COUNT - 1;
        if (isFinalFace) {
          allFacesComplete = true;
          viewedFaceIndex = prev.activeFaceIndex;
        } else {
          activeFaceIndex = prev.activeFaceIndex + 1;
          viewedFaceIndex = activeFaceIndex;
        }
      }

      const nextFaces = prev.faces.map((entry, index) => (index === prev.activeFaceIndex ? nextFace : entry));

      return {
        ...prev,
        faces: nextFaces,
        activeFaceIndex,
        viewedFaceIndex,
        allFacesComplete,
      };
    });
  }

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
          You can play with a classic 2D board view or switch to a 3D rotatable six-face object while keeping the
          same face-by-face progression and summed totals.
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to Play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Choose 2 players (height 6) or 3 players (height 7), then start.</li>
          <li>Choose display mode: 2D (classic) or 3D (rotatable object).</li>
          <li>Play one face at a time using normal Black Hole rules.</li>
          <li>When one circle remains, that face is scored and play moves to the next face.</li>
          <li>Use rotate controls (and mouse wheel in 3D mode) to inspect different faces.</li>
          <li>After six faces, summed totals across faces decide the winner (lowest total).</li>
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

          <label className="font-medium text-slate-700" htmlFor="displayMode">Display mode</label>
          <select
            id="displayMode"
            value={displayMode}
            onChange={(event) => setDisplayMode(event.target.value)}
            className="rounded border border-slate-300 px-3 py-2"
          >
            <option value="2d">2D (classic)</option>
            <option value="3d">3D (rotatable)</option>
          </select>

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

        {started && !state.allFacesComplete && !currentFace.completed && (
          <button
            type="button"
            onClick={commitMove}
            disabled={!currentFace.selected}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Confirm Move
          </button>
        )}

        {started && (
          <>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => rotateView(-1)}
                className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300"
              >
                ← Rotate
              </button>
              <span className="text-sm font-medium text-slate-700">
                Viewing face {state.viewedFaceIndex + 1} of 6{displayMode === '3d' ? ' (scroll wheel also rotates)' : ''}
              </span>
              <button
                type="button"
                onClick={() => rotateView(1)}
                className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300"
              >
                Rotate →
              </button>
            </div>

            {displayMode === '2d' && (
              <div className="w-full overflow-x-auto py-2">
                <div className="mx-auto" style={{ width: `${boardWidth}px` }}>
                  {renderBoardFace({
                    face: viewedFace,
                    isActiveFace: viewedFace.index === state.activeFaceIndex,
                    state: { ...state, allFacesComplete: state.allFacesComplete },
                    currentFace,
                    currentPlayer,
                    blackHolePreview,
                    boardWidth,
                    boardHeight,
                    connectedLineSegments: viewedFaceConnections,
                    onCellClick: handleCellClick,
                    onCellHover: (cell) => {
                      if (!cell.move && !state.allFacesComplete && viewedFace.index === state.activeFaceIndex && !currentFace.completed) {
                        updateActiveFace((entry) => ({ ...entry, hovered: { id: cell.id } }));
                      }
                    },
                    onCellLeave: () => {
                      if (!state.allFacesComplete && viewedFace.index === state.activeFaceIndex && !currentFace.completed) {
                        updateActiveFace((entry) => ({ ...entry, hovered: null }));
                      }
                    },
                  })}
                </div>
              </div>
            )}

            {displayMode === '3d' && (
              <div className="w-full overflow-x-auto py-4">
                <div
                  className="mx-auto relative"
                  style={{
                    width: `${stageWidth}px`,
                    height: `${stageHeight}px`,
                    perspective: '1800px',
                  }}
                  onWheel={handleWheelRotate}
                >
                  <div
                    className="absolute left-1/2 top-1/2"
                    style={{
                      transformStyle: 'preserve-3d',
                      transition: 'transform 500ms ease',
                      transform: `translate(-50%, -50%) rotateX(16deg) rotateY(${-state.viewedFaceIndex * 60}deg)`,
                    }}
                  >
                    {state.faces.map((face) => (
                      <div
                        key={`face-3d-${face.index}`}
                        className="absolute left-1/2 top-1/2"
                        style={{
                          transformStyle: 'preserve-3d',
                          backfaceVisibility: 'hidden',
                          transform: `translate(-50%, -50%) rotateY(${face.index * 60}deg) translateZ(${objectRadius}px)`,
                          opacity: face.index === state.viewedFaceIndex ? 1 : 0.2,
                        }}
                      >
                        <div className="relative flex flex-col gap-2 items-center" style={{ width: `${boardWidth}px` }}>
                          <div className="text-sm font-medium text-slate-600 mb-2">Face {face.index + 1}</div>
                          {renderBoardFace({
                            face,
                            isActiveFace: face.index === state.activeFaceIndex,
                            state: { ...state, allFacesComplete: state.allFacesComplete },
                            currentFace,
                            currentPlayer,
                            blackHolePreview,
                            boardWidth,
                            boardHeight,
                            connectedLineSegments: face.index === state.viewedFaceIndex ? viewedFaceConnections : [],
                            onCellClick: handleCellClick,
                            onCellHover: (cell) => {
                              if (!cell.move && !state.allFacesComplete && face.index === state.activeFaceIndex && !currentFace.completed) {
                                updateActiveFace((entry) => ({ ...entry, hovered: { id: cell.id } }));
                              }
                            },
                            onCellLeave: () => {
                              if (!state.allFacesComplete && face.index === state.activeFaceIndex && !currentFace.completed) {
                                updateActiveFace((entry) => ({ ...entry, hovered: null }));
                              }
                            },
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {started && !state.allFacesComplete && !currentFace.completed && (
          <p className="text-sm text-slate-600">Open circles left on face {state.activeFaceIndex + 1}: {openCells.length}.</p>
        )}

        {started && (
          <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xl font-semibold mb-3">Total Scoreboard (lowest wins)</h3>
            <ul className="space-y-2">
              {state.players.map((player) => (
                <li key={player.key} className="flex items-center justify-between rounded bg-white px-3 py-2 border border-slate-200">
                  <span className="font-medium">{player.label}</span>
                  <span className="font-bold">{totalScores[player.key]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
