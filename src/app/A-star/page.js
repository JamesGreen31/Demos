
// This page runs entirely on the client so we enable React's client mode.
'use client';

// React hook for managing component state.
import { useState } from 'react';


// Main component implementing a very small visualisation of the A* algorithm.
export default function AStarPage() {
    // Dimension of the grid (gridSize x gridSize)
    const gridSize = 8;
    // Total number of cells in the grid
    const totalCells = gridSize * gridSize;

    // Boolean value for each cell representing whether it is blocked.  These
    // are toggled when the user clicks a cell.
    const [cellStates, setCellStates] = useState(Array(totalCells).fill(false));

    // Message string displayed to the user (for errors or success messages)
    const [messages, setMessages] = useState('');

    // Weight values for each cell: `gWeight` is the cost to enter the cell and
    // `hWeight` is the heuristic Manhattan distance to the goal.  They are
    // initialised when the component loads.
    const [cellWeights, setCellWeights] = useState(() => initializeCellWeights());

    // Array of cell indexes that comprise the solved path. Used to highlight the
    // path after solving.
    const [solvedCells, setSolution] = useState([]);

    /* *************************************************************
     *  Helper functions for generating and manipulating cell weights
     ************************************************************* */

    // Create the default weight object for every cell.  Each cell starts with a
    // movement cost (`gWeight`) of 1 and an `hWeight` equal to the Manhattan
    // distance from that cell to the goal (top‑right corner).  This function is
    // used both on initial load and when resetting the board.
    function initializeCellWeights() {
        return Array(totalCells).fill().map((_, index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            const hWeight = Math.abs(0 - row) + Math.abs(7 - col);
            return { gWeight: 1, hWeight };
        });
    }

    // Generate random movement costs for all cells while keeping the heuristic
    // distance the same.  Useful for demonstrating different pathfinding
    // outcomes.
    function randomizeCellWeights() {
        return Array(totalCells).fill().map((_, index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            const hWeight = Math.abs(0 - row) + Math.abs(7 - col);
            return { gWeight: Math.floor(Math.random() * 10) + 1, hWeight };
        });
    }

    // Event handler attached to the "Randomize Cell Distances" button. It
    // regenerates the cell weights and clears any previously solved path.
    const handleRandomizeCellWeights = () => {
        setCellWeights(randomizeCellWeights());
        setSolution([]); // Clear the solution path
        setMessage('Cell distances randomized');
    }

    // Execute the A* search algorithm on the grid using the current weights
    // and obstacles. When a valid path is found the indexes are stored in
    // `solvedCells`.
    const solvePath = () => {
        // Start position is the bottom-left cell; goal is the top-right
        const startCell = totalCells - gridSize;
        const goalCell = gridSize - 1;

        // Open set contains cells to be evaluated.  Closed set tracks already
        // evaluated cells.
        const openSet = new Set([startCell]);
        const closedSet = new Set();

        // Maps used for reconstructing the path and tracking scores.
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        // Initial scores for the start cell
        gScore.set(startCell, 0);
        fScore.set(startCell, cellWeights[startCell].hWeight);

        // Continue exploring while there are cells to evaluate
        while (openSet.size > 0) {
            // Cell with the lowest estimated total cost
            const current = getLowestFScore(openSet, fScore);

            if (current === goalCell) {
                const path = reconstructPath(cameFrom, current);
                setSolution(path);
                setMessage('Path found!');
                return;
            }

            // Move current cell from open to closed set
            openSet.delete(current);
            closedSet.add(current);

            // Evaluate all walkable neighbour cells
            for (const neighbor of getNeighbors(current)) {
                // Skip neighbours that have already been evaluated
                if (closedSet.has(neighbor)) {
                    continue;
                }

                // Cost of the path from the start cell to this neighbour
                const tentativeGScore = gScore.get(current) + cellWeights[neighbor].gWeight;

                // If the neighbour is new, add it to the open set. If we've
                // already discovered a cheaper path previously, skip it.
                if (!openSet.has(neighbor)) {
                    openSet.add(neighbor);
                } else if (tentativeGScore >= gScore.get(neighbor)) {
                    continue;
                }

                // Record the best path so far to this neighbour
                cameFrom.set(neighbor, current);
                gScore.set(neighbor, tentativeGScore);
                fScore.set(neighbor, gScore.get(neighbor) + cellWeights[neighbor].hWeight);
            }
        }

        // No valid path was found
        setMessage('No path found');
    };

    // Utility to pick the cell in the open set with the lowest `fScore`.
    // This represents the most promising next step in the search.
    const getLowestFScore = (openSet, fScore) => {
        return Array.from(openSet).reduce((lowest, cell) =>
            fScore.get(cell) < fScore.get(lowest) ? cell : lowest
        );
    };

    // Walk backwards through the `cameFrom` map to build the list of cell
    // indexes that form the final path from start to goal.
    const reconstructPath = (cameFrom, current) => {
        const path = [current];
        while (cameFrom.has(current)) {
            current = cameFrom.get(current);
            path.unshift(current);
        }
        return path;
    };

    // Return the indexes of the four orthogonal neighbours of a cell. Invalid
    // neighbours (those that fall off the grid) are filtered out.
    const getNeighbors = (index) => {
        const left = index % gridSize === 0 ? undefined : index - 1;
        const right = index % gridSize === gridSize - 1 ? undefined : index + 1;
        const up = index < gridSize ? undefined : index - gridSize;
        const down = index >= totalCells - gridSize ? undefined : index + gridSize;
        return [left, right, up, down].filter(neighbor => neighbor !== undefined);
    };

    /* ***********************
    *  UI HANDLERS
    * ****************************** */
    // Toggle whether a cell is blocked. Blocked cells have their heuristic set
    // to a very high value so the algorithm avoids them.
    const toggleCell = (index) => {
        setCellStates(prevStates => {
            const newStates = [...prevStates];
            newStates[index] = !newStates[index];
            if (newStates[index] == true){
                cellWeights[index].hWeight = 999;
            }
            else{
                cellWeights[index].hWeight = initializeCellWeights()[index].hWeight;
            }
            return newStates;
        });
    }

    // Helper to update the message string displayed under the controls
    const setMessage = (message) =>{
        setMessages(message);
    }

    // Clear all selections and return the grid to its initial state
    const resetCells = () => {
        setCellStates(Array(totalCells).fill(false));
        setCellWeights(initializeCellWeights());
        setSolution([]); // Clear the solution path
        setMessage('Reset Cells');
    }

    // Render the interactive grid of cells. Each button displays its
    // coordinates and current weight values.
    // Create the grid layout where each cell is represented by a button so the
    // user can toggle obstacles. The current path is highlighted in blue.
    const renderGridCells = () => {
        return (
<div className={`grid grid-cols-8 gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-4 border-2 sm:border-4`}>                {Array.from({ length: totalCells }, (_, index) => {
                    const row = Math.floor(index / gridSize);
                    const col = index % gridSize;
                    const cellWeight = cellWeights[index];
                    const isInPath = solvedCells.includes(index);

                    // Special rendering for the start and goal cells
                    if(row == gridSize -1 && col == 0){
                        return (
                            <div key={index} className="w-16 h-16 sm: w-10 sm: h-10 rounded-xl flex items-center justify-center bg-[#2e7a34]">
                                <span className="text-sm sm: text-[0.7rem] font-semibold text-white">{`START`}</span>
                            </div>
                        );
                    }
                    if(row == 0 && col == gridSize -1){
                        return (
                            <div key={index} className="w-16 h-16 sm: w-10 sm: h-10 rounded-xl flex items-center justify-center bg-[#a4832f]">
                                <span className="text-sm sm: text-[0.7rem] font-semibold text-white">{`GOAL`}</span>
                            </div>
                        );
                    }
                    return (
                        <button 
                            key={index} 
                            className={`w-16 h-16 sm: w-10 sm: h-10 ${
                                isInPath ? 'bg-blue-500' :
                                cellStates[index] ? 'bg-red-500' : 'bg-gray-300'
                            } rounded-xl flex flex-col items-center justify-center`}
                            onClick={() => toggleCell(index)}
                        >
                            <span className="sm: text-[0.6rem] h-1/3 text-xs font-semibold">{`(${row},${col})`}</span>
                            <span className="sm: text-[0.6rem] h-1/3 text-xs">{`g: ${cellWeight?.gWeight ?? 0}`}</span>
                            <span className="sm: text-[0.6rem] h-1/3 text-xs">{`h: ${cellWeight?.hWeight ?? 0}`}</span>
                        </button>
                    );
                })}
            </div>
        );
    }
    return (
        <main className="flex min-h-screen flex-col items-center m-8">
        {/* Page header */}
        <h1 className="text-4xl font-bold m-4">A* Algorithm Demo</h1>
        <div id="game" className="flex flex-col md:flex-row items-center md:items-start justify-center w-full">
            {/* Sidebar containing instructions and controls */}
            <div className="flex flex-col m-4 p-4 w-full md:w-64">
                <h2 className="font-bold rounded-lg text-xl w-full p-4">Directions</h2>
                <ol className="list-decimal">
                    <li className="p-2">Choose cells to avoid</li>
                    <li className="p-2">Click reset when finished</li>
                </ol>
                {/* Button triggers path solving */}
                <button className="font-bold rounded-lg text-lg w-full h-16 bg-[#2e7a34] text-[#ffffff] justify-center hover:bg-[#89c48e] hover:text-[#ffffff] active:bg-[#616c7e] mt-4"
                        onClick={solvePath}>Solve</button>
                {/* Button clears the board */}
                <button className="font-bold rounded-lg text-lg w-full h-16 bg-[#3380fb] text-[#ffffff] justify-center hover:bg-[#6da5ff] hover:text-[#ffffff] active:bg-[#616c7e] mt-4"
                        onClick={resetCells}>Reset</button>
                {/* Button randomises cell weights */}
                <button className="font-bold rounded-lg text-lg w-full h-16 bg-[#3380fb] text-[#ffffff] justify-center hover:bg-[#6da5ff] hover:text-[#ffffff] active:bg-[#616c7e] mt-4"
                        onClick={handleRandomizeCellWeights}>Randomize Cell Distances</button>
                <div className="mt-4 w-full">
                    <p className="text-red-500 text-left break-words">{messages}</p>
                </div>
            </div>
            {/* Render the grid on the right */}
            {renderGridCells()}
        </div>
      </main>
    )
}