export const SUITS = ['♠', '♥', '♦', '♣'];

const ORTHOGONAL_DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function inBounds(row, col, rowCount, colCount) {
  return row >= 0 && row < rowCount && col >= 0 && col < colCount;
}

export function buildCellPresenceGrid(gridStacks) {
  return gridStacks.map((row) => row.map((cell) => {
    const valuesBySuit = {
      '♠': new Set(),
      '♥': new Set(),
      '♦': new Set(),
      '♣': new Set(),
    };

    cell.forEach((card) => {
      if (!card || !SUITS.includes(card.suit) || typeof card.value !== 'number') return;
      valuesBySuit[card.suit].add(card.value);
    });

    return valuesBySuit;
  }));
}

export function findLongestIncreasingSuitPath(cellPresenceGrid, suit, options = {}) {
  const { allowCellRevisit = false } = options;
  const rowCount = cellPresenceGrid.length;
  const colCount = rowCount > 0 ? cellPresenceGrid[0].length : 0;

  let bestLength = 0;
  let bestPath = [];

  function dfs(row, col, previousValue, visited, currentPath) {
    const candidateValues = [...cellPresenceGrid[row][col][suit]].filter((value) => value > previousValue);

    if (candidateValues.length === 0) {
      if (currentPath.length > bestLength) {
        bestLength = currentPath.length;
        bestPath = [...currentPath];
      }
      return;
    }

    for (const value of candidateValues) {
      currentPath.push({ row, col, value, suit });
      if (currentPath.length > bestLength) {
        bestLength = currentPath.length;
        bestPath = [...currentPath];
      }

      for (const [dRow, dCol] of ORTHOGONAL_DIRECTIONS) {
        const nextRow = row + dRow;
        const nextCol = col + dCol;

        if (!inBounds(nextRow, nextCol, rowCount, colCount)) continue;

        const nextKey = `${nextRow},${nextCol}`;
        const alreadyVisited = visited.has(nextKey);

        // Rule codification:
        // - A move must change grid cells every step (orthogonal neighbor enforced above).
        // - By default, revisiting earlier cells is NOT allowed.
        // - If allowCellRevisit is true, revisits are allowed as long as each step still moves.
        if (!allowCellRevisit && alreadyVisited) continue;

        if (!allowCellRevisit) visited.add(nextKey);
        dfs(nextRow, nextCol, value, visited, currentPath);
        if (!allowCellRevisit) visited.delete(nextKey);
      }

      currentPath.pop();
    }
  }

  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < colCount; col += 1) {
      const startValues = cellPresenceGrid[row][col][suit];
      if (startValues.size === 0) continue;

      const visited = new Set([`${row},${col}`]);
      dfs(row, col, 0, visited, []);
    }
  }

  return {
    suit,
    length: bestLength,
    path: bestPath,
    allowCellRevisit,
  };
}

export function scoreSkywayGrid(gridStacks, options = {}) {
  const cellPresenceGrid = buildCellPresenceGrid(gridStacks);
  const perSuit = SUITS.map((suit) => findLongestIncreasingSuitPath(cellPresenceGrid, suit, options));
  const totalScore = perSuit.reduce((total, suitScore) => total + suitScore.length, 0);
  const isWin = perSuit.every((suitScore) => suitScore.length >= 5);

  return {
    cellPresenceGrid,
    perSuit,
    totalScore,
    isWin,
  };
}

export function shouldTriggerEndgame(passCount, endAfterPasses = 3) {
  return passCount >= endAfterPasses;
}
