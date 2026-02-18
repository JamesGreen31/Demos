'use client';

import { useMemo, useState } from 'react';

const DEFAULT_NODE_COUNT = 12;
const DEFAULT_SEED = 7;
const DEFAULT_START_NODE = 0;

function buildFunctionalGraph(nodeCount, seed) {
  const safeCount = Math.max(5, nodeCount);
  const cycleLength = 2 + (seed % Math.max(2, safeCount - 2));
  const cycleStart = safeCount - cycleLength;

  const nextMap = Array.from({ length: safeCount }, (_, index) => {
    if (index < cycleStart - 1) {
      return index + 1;
    }

    if (index === cycleStart - 1) {
      return cycleStart;
    }

    if (index < safeCount - 1) {
      return index + 1;
    }

    return cycleStart;
  });

  return { nextMap, cycleStart, cycleLength };
}

function buildNodeLayout(nodeCount, cycleStart, cycleLength) {
  const tailLength = cycleStart;
  const tailSpacing = tailLength > 0 ? 34 / Math.max(1, tailLength) : 0;

  return Array.from({ length: nodeCount }, (_, index) => {
    if (index < cycleStart) {
      return {
        id: index,
        x: 10 + index * tailSpacing,
        y: 50,
      };
    }

    const cycleIndex = index - cycleStart;
    const angle = (-Math.PI / 2) + (cycleIndex * Math.PI * 2) / Math.max(2, cycleLength);
    return {
      id: index,
      x: 72 + 20 * Math.cos(angle),
      y: 50 + 20 * Math.sin(angle),
    };
  });
}

function runFloydCycleDetection(nextMap, startNode) {
  const timeline = [];

  let slow = startNode;
  let fast = startNode;
  let step = 0;

  timeline.push({
    phase: 'Initialize',
    step,
    slow,
    fast,
    note: 'Both pointers start at the selected node.',
  });

  do {
    slow = nextMap[slow];
    fast = nextMap[nextMap[fast]];
    step += 1;

    timeline.push({
      phase: 'Meet Search',
      step,
      slow,
      fast,
      note:
        slow === fast
          ? 'Pointers met inside a cycle.'
          : 'Advance slow by 1 and fast by 2 until they collide.',
    });
  } while (slow !== fast && step <= nextMap.length * 4);

  const meetingNode = slow;
  let finder = startNode;
  let mu = 0;

  while (finder !== slow && mu <= nextMap.length) {
    finder = nextMap[finder];
    slow = nextMap[slow];
    mu += 1;

    timeline.push({
      phase: 'Entry Search',
      step: step + mu,
      slow,
      fast: finder,
      note: 'Move both pointers one step: when they meet again, that node is cycle entry.',
    });
  }

  const cycleEntry = finder;
  let lambda = 1;
  let walker = nextMap[cycleEntry];

  timeline.push({
    phase: 'Length Count',
    step: step + mu + lambda,
    slow: cycleEntry,
    fast: walker,
    note: 'Count one full loop from the cycle entry to measure cycle length.',
  });

  while (walker !== cycleEntry && lambda <= nextMap.length + 1) {
    walker = nextMap[walker];
    lambda += 1;

    timeline.push({
      phase: 'Length Count',
      step: step + mu + lambda,
      slow: cycleEntry,
      fast: walker,
      note: 'Continue counting nodes in the cycle.',
    });
  }

  return {
    timeline,
    meetingNode,
    cycleEntry,
    cycleLength: lambda,
    mu,
  };
}

function buildWalkPath(nextMap, startNode, cycleEntry, cycleLength) {
  const nodes = [startNode];
  let cursor = startNode;

  for (let step = 0; step < nextMap.length + cycleLength + 1; step += 1) {
    cursor = nextMap[cursor];
    nodes.push(cursor);
    if (cursor === cycleEntry && step >= cycleLength) {
      break;
    }
  }

  return nodes;
}

export default function FloydCycleDPPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';

  const [nodeCount, setNodeCount] = useState(DEFAULT_NODE_COUNT);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [startNode, setStartNode] = useState(DEFAULT_START_NODE);
  const [stepIndex, setStepIndex] = useState(0);

  const graph = useMemo(() => buildFunctionalGraph(nodeCount, seed), [nodeCount, seed]);
  const { nextMap, cycleStart: generatedCycleStart, cycleLength: generatedCycleLength } = graph;

  const layout = useMemo(
    () => buildNodeLayout(nodeCount, generatedCycleStart, generatedCycleLength),
    [generatedCycleLength, generatedCycleStart, nodeCount]
  );

  const { timeline, meetingNode, cycleEntry, cycleLength, mu } = useMemo(
    () => runFloydCycleDetection(nextMap, Math.min(startNode, nodeCount - 1)),
    [nextMap, nodeCount, startNode]
  );

  const currentStep = timeline[Math.min(stepIndex, Math.max(timeline.length - 1, 0))];

  const cycleNodes = useMemo(() => {
    const nodes = new Set([cycleEntry]);
    let current = nextMap[cycleEntry];

    while (current !== cycleEntry) {
      nodes.add(current);
      current = nextMap[current];
    }

    return nodes;
  }, [cycleEntry, nextMap]);

  const startToCyclePath = useMemo(
    () => buildWalkPath(nextMap, Math.min(startNode, nodeCount - 1), cycleEntry, cycleLength),
    [cycleEntry, cycleLength, nextMap, nodeCount, startNode]
  );

  const resetAll = () => {
    setNodeCount(DEFAULT_NODE_COUNT);
    setSeed(DEFAULT_SEED);
    setStartNode(DEFAULT_START_NODE);
    setStepIndex(0);
  };

  return (
    <main className="min-h-screen p-6 md:p-8 flex flex-col items-center gap-5">
      <div className="w-full max-w-6xl flex items-center justify-between">
        <button
          type="button"
          onClick={() => window.location.assign(demosHref)}
          className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800"
        >
          ← Back
        </button>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-center">Floyd Cycle Detection DP Demo</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">Traditional description</h2>
        <p className="text-slate-700 mb-3">
          Think of each node as a room with exactly one door to another room. If you keep walking,
          eventually you either loop forever or repeat the same rooms.
        </p>
        <p className="text-slate-700 mb-3">
          Floyd&apos;s tortoise-and-hare algorithm sends two walkers at different speeds. Their collision
          proves a loop exists, then a second pass finds the loop entry and measures its size.
        </p>

        <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer font-semibold text-slate-800">Show technical explanation</summary>
          <div className="mt-3 space-y-3 text-slate-700">
            <p>
              The algorithm uses constant memory by storing only pointer states. At each logical time
              <strong> t</strong>, the state is the tuple <strong>(slow(t), fast(t))</strong>.
            </p>
            <p>
              Once the pointers meet, resetting one pointer to the start and moving both by one finds the
              cycle entry after <strong>μ</strong> steps. Traversing the cycle once yields <strong>λ</strong>.
            </p>
            <p>
              This demo frames those updates as a DP-like transition process over reusable pointer states.
            </p>
          </div>
        </details>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to use</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Set node count, then change the seed to regenerate a readable tail-then-cycle graph.</li>
          <li>Choose a start node and use <strong>Prev</strong>/<strong>Next</strong> or the slider to replay updates.</li>
          <li>In the graph, blue highlights cycle nodes, green marks slow, amber marks fast/finder/walker.</li>
          <li>Read the timeline details to connect each visual state to a Floyd phase.</li>
        </ul>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Controls</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Node Count: {nodeCount}</span>
            <input
              type="range"
              min="5"
              max="28"
              value={nodeCount}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                setNodeCount(value);
                setStartNode((previousStart) => Math.min(previousStart, value - 1));
                setStepIndex(0);
              }}
              className="w-full"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-semibold">Seed: {seed}</span>
            <input
              type="range"
              min="1"
              max="50"
              value={seed}
              onChange={(event) => {
                setSeed(Number.parseInt(event.target.value, 10));
                setStepIndex(0);
              }}
              className="w-full"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-semibold">Start Node: {startNode}</span>
            <input
              type="range"
              min="0"
              max={nodeCount - 1}
              value={startNode}
              onChange={(event) => {
                setStartNode(Number.parseInt(event.target.value, 10));
                setStepIndex(0);
              }}
              className="w-full"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={resetAll}
            className="px-4 py-2 rounded bg-slate-800 text-white hover:bg-slate-700"
          >
            Reset All
          </button>
          <button
            type="button"
            onClick={() => {
              setNodeCount(DEFAULT_NODE_COUNT);
              setSeed((value) => Math.min(50, value + 1));
              setStartNode(DEFAULT_START_NODE);
              setStepIndex(0);
            }}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500"
          >
            Load Example
          </button>
        </div>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Interactive visualization</h2>

        <div className="mb-4 rounded-lg bg-slate-100 p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <p className="text-slate-800">
            Meeting node: <strong>{meetingNode}</strong>
          </p>
          <p className="text-slate-800">
            Cycle entry: <strong>{cycleEntry}</strong> (μ = {mu})
          </p>
          <p className="text-slate-800">
            Cycle length: <strong>{cycleLength}</strong> (λ)
          </p>
        </div>

        <p className="mb-4 text-sm text-slate-600">
          Graph shape: nodes <strong>0..{Math.max(generatedCycleStart - 1, 0)}</strong> form the tail and nodes{' '}
          <strong>{generatedCycleStart}..{nodeCount - 1}</strong> form the cycle (length {generatedCycleLength}).
        </p>

        <div className="mb-4 rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold mb-2">State timeline</h3>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
              className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setStepIndex((value) => Math.min(timeline.length - 1, value + 1))}
              className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300"
            >
              Next
            </button>
            <input
              type="range"
              min="0"
              max={Math.max(timeline.length - 1, 0)}
              value={Math.min(stepIndex, Math.max(timeline.length - 1, 0))}
              onChange={(event) => setStepIndex(Number.parseInt(event.target.value, 10))}
              className="flex-1 min-w-56"
              aria-label="Timeline slider"
            />
          </div>

          <p className="text-slate-700 mb-2">
            <strong>Step {Math.min(stepIndex + 1, timeline.length)}</strong> / {timeline.length} ·{' '}
            <strong>Phase:</strong> {currentStep?.phase} · <strong>Logical step:</strong> {currentStep?.step}
          </p>
          <p className="text-slate-700">
            <strong>slow</strong> = {currentStep?.slow}, <strong>fast/finder/walker</strong> = {currentStep?.fast}.
            {' '}
            {currentStep?.note}
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
            <h3 className="font-semibold mb-3">Functional graph (one outgoing edge per node)</h3>
            <svg
              viewBox="0 0 100 100"
              className="w-full max-w-xl mx-auto bg-white rounded border border-slate-200"
              role="img"
              aria-label="Graph of pointer transitions"
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                </marker>
                <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
                </marker>
              </defs>

              {nextMap.map((toNode, fromNode) => {
                const from = layout[fromNode];
                const to = layout[toNode];
                const activeEdge = fromNode === currentStep?.slow || fromNode === currentStep?.fast;
                const stroke = activeEdge ? '#f59e0b' : cycleNodes.has(fromNode) && cycleNodes.has(toNode) ? '#3b82f6' : '#94a3b8';

                return (
                  <g key={`edge-${fromNode}`}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={stroke}
                      strokeWidth={activeEdge ? 1.2 : 0.7}
                      opacity={activeEdge ? 1 : 0.75}
                      markerEnd={activeEdge ? 'url(#arrow-active)' : 'url(#arrow)'}
                    />
                  </g>
                );
              })}

              {layout.map((node) => {
                const isSlow = node.id === currentStep?.slow;
                const isFast = node.id === currentStep?.fast;
                const isCycle = cycleNodes.has(node.id);
                const isStart = node.id === startNode;

                const fill = isSlow ? '#dcfce7' : isFast ? '#fef3c7' : isCycle ? '#dbeafe' : '#ffffff';
                const stroke = isSlow ? '#16a34a' : isFast ? '#d97706' : isCycle ? '#2563eb' : '#334155';

                return (
                  <g key={node.id}>
                    <circle cx={node.x} cy={node.y} r="3.9" fill={fill} stroke={stroke} strokeWidth="0.8" />
                    <text x={node.x} y={node.y + 0.8} textAnchor="middle" fontSize="2.8" fill="#0f172a">
                      {node.id}
                    </text>
                    {isStart ? (
                      <text x={node.x} y={node.y - 5.4} textAnchor="middle" fontSize="2.2" fill="#334155">
                        start
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
            <h3 className="font-semibold mb-3">Derived state summary</h3>

            <div className="mb-4 rounded border border-slate-200 bg-white p-3">
              <p className="text-sm text-slate-700 mb-2">Path sketch from start toward cycle:</p>
              <p className="text-slate-800 text-sm break-words">{startToCyclePath.join(' → ')}</p>
            </div>

            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="inline-block h-3 w-3 rounded border border-green-600 bg-green-100 mr-2" />
                Current slow pointer
              </p>
              <p>
                <span className="inline-block h-3 w-3 rounded border border-amber-600 bg-amber-100 mr-2" />
                Current fast/finder/walker pointer
              </p>
              <p>
                <span className="inline-block h-3 w-3 rounded border border-blue-600 bg-blue-100 mr-2" />
                Node in detected cycle
              </p>
              <p>
                <span className="inline-block h-3 w-3 rounded border border-slate-500 bg-white mr-2" />
                Non-cycle node
              </p>
            </div>

            <div className="mt-4 rounded border border-slate-200 bg-white p-3">
              <h4 className="font-semibold mb-2">Transition table</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {nextMap.map((toNode, fromNode) => (
                  <div key={`map-${fromNode}`} className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="text-slate-500">Node {fromNode}</p>
                    <p className="font-semibold text-slate-900">next → {toNode}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
