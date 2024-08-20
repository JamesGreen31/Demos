'use client';
import { useState } from 'react';


export default function AStarPage() {
    const gridSize = 8;
    const totalCells = gridSize * gridSize;
    const [cellStates, setCellStates] = useState(Array(totalCells).fill(false));
    const [messages, setMessages] = useState('');
    const [cellWeights, setCellWeights] = useState(() => initializeCellWeights());
    const [solvedCells, setSolution] = useState([]);

    /* ***********************
    *  A STAR STUFF
    * ****************************** */
    function initializeCellWeights() {
        return Array(totalCells).fill().map((_, index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            const hWeight = Math.abs(0 - row) + Math.abs(7 - col); // Manhattan distance to (0, 7)
            return { gWeight: 1, hWeight }; //Math.floor(Math.random() * 10) + 1
        });
    }

    function randomizeCellWeights() {
        return Array(totalCells).fill().map((_, index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            const hWeight = Math.abs(0 - row) + Math.abs(7 - col); // Manhattan distance to (0, 7)
            return { gWeight: Math.floor(Math.random() * 10) + 1, hWeight };
        });
    }

    const handleRandomizeCellWeights = () => {
        setCellWeights(randomizeCellWeights());
        setSolution([]); // Clear the solution path
        setMessage('Cell distances randomized');
    }

    const solvePath = () => {
        const startCell = totalCells - gridSize; // Bottom-left corner
        const goalCell = gridSize - 1; // Top-right corner
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
        return [left, right, up, down].filter(neighbor => neighbor !== undefined);
    };

    /* ***********************
    *  UI HANDLERS
    * ****************************** */
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

    const setMessage = (message) =>{
        setMessages(message);
    }

    const resetCells = () => {
        setCellStates(Array(totalCells).fill(false));
        setCellWeights(initializeCellWeights());
        setSolution([]); // Clear the solution path
        setMessage('Reset Cells');
    }

    const renderGridCells = () => {
        return (
<div className={`grid grid-cols-8 gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-4 border-2 sm:border-4`}>                {Array.from({ length: totalCells }, (_, index) => {
                    const row = Math.floor(index / gridSize);
                    const col = index % gridSize;
                    const cellWeight = cellWeights[index];
                    const isInPath = solvedCells.includes(index);

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
        <h1 className="text-4xl font-bold m-4">A* Algorithm Demo</h1>
        <div id="game" className="flex flex-col md:flex-row items-center md:items-start justify-center w-full">
            <div className="flex flex-col m-4 p-4 w-full md:w-64">
                <h2 className="font-bold rounded-lg text-xl w-full p-4">Directions</h2>
                <ol className="list-decimal">
                    <li className="p-2">Choose cells to avoid</li>
                    <li className="p-2">Click reset when finished</li>
                </ol>
                <button className="font-bold rounded-lg text-lg w-full h-16 bg-[#2e7a34] text-[#ffffff] justify-center hover:bg-[#89c48e] hover:text-[#ffffff] active:bg-[#616c7e] mt-4"
                        onClick={solvePath}>Solve</button>
                <button className="font-bold rounded-lg text-lg w-full h-16 bg-[#3380fb] text-[#ffffff] justify-center hover:bg-[#6da5ff] hover:text-[#ffffff] active:bg-[#616c7e] mt-4"
                        onClick={resetCells}>Reset</button>
                <button className="font-bold rounded-lg text-lg w-full h-16 bg-[#3380fb] text-[#ffffff] justify-center hover:bg-[#6da5ff] hover:text-[#ffffff] active:bg-[#616c7e] mt-4"
                        onClick={handleRandomizeCellWeights}>Randomize Cell Distances</button>
                <div className="mt-4 w-full">
                    <p className="text-red-500 text-left break-words">{messages}</p>
                </div>
            </div>
            {renderGridCells()}
        </div>
      </main>
    )
}