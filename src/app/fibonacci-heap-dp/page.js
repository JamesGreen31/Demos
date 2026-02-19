'use client';

import { useEffect, useMemo, useState } from 'react';

const DEFAULT_NODE_COUNT = 9;
const DEFAULT_EDGE_SPAN = 3;

function createGraph(nodeCount, edgeSpan, seed) {
  const nodes = Array.from({ length: nodeCount }, (_, index) => {
    const angle = (Math.PI * 2 * index) / nodeCount;
    return {
      id: index,
      label: String.fromCharCode(65 + index),
      x: 50 + 38 * Math.cos(angle),
      y: 50 + 38 * Math.sin(angle),
    };
  });

  const edges = [];

  for (let from = 0; from < nodeCount; from += 1) {
    for (let jump = 1; jump <= edgeSpan; jump += 1) {
      const to = (from + jump) % nodeCount;
      if (from === to) continue;

      const baseWeight = 2 + ((from * 3 + jump * 5 + seed * 7) % 9);
      const weight = (from + jump) % 4 === 0 ? Math.max(1, baseWeight - 3) : baseWeight;
      edges.push({ from, to, weight });

      if ((from + jump) % 2 === 0) {
        const backTo = (from - jump + nodeCount) % nodeCount;
        const backWeight = 3 + ((to * 5 + jump + seed * 3) % 8);
        edges.push({ from: to, to: backTo, weight: backWeight });
      }
    }
  }

  return { nodes, edges };
}

function createHeapNode(id, value, key) {
  return {
    id,
    value,
    key,
    parentId: null,
    children: [],
    mark: false,
  };
}

function createHeap() {
  return {
    nodes: new Map(),
    rootIds: new Set(),
    minId: null,
  };
}

function updateMinId(heap) {
  let minId = null;
  let minKey = Number.POSITIVE_INFINITY;

  for (const rootId of heap.rootIds) {
    const node = heap.nodes.get(rootId);
    if (node && node.key < minKey) {
      minKey = node.key;
      minId = rootId;
    }
  }

  heap.minId = minId;
}

function heapInsert(heap, id, value, key) {
  const node = createHeapNode(id, value, key);
  heap.nodes.set(id, node);
  heap.rootIds.add(id);

  if (heap.minId === null || key < heap.nodes.get(heap.minId).key) {
    heap.minId = id;
  }
}

function linkTrees(heap, parentId, childId) {
  const parent = heap.nodes.get(parentId);
  const child = heap.nodes.get(childId);
  if (!parent || !child) return;

  heap.rootIds.delete(childId);
  child.parentId = parentId;
  child.mark = false;
  parent.children.push(childId);
}

function consolidate(heap) {
  const degreeTable = new Map();

  for (const rootId of [...heap.rootIds]) {
    let currentId = rootId;

    while (true) {
      const currentNode = heap.nodes.get(currentId);
      if (!currentNode) break;

      const degree = currentNode.children.length;
      const partnerId = degreeTable.get(degree);

      if (partnerId === undefined || partnerId === currentId) {
        degreeTable.set(degree, currentId);
        break;
      }

      const partnerNode = heap.nodes.get(partnerId);
      if (!partnerNode) {
        degreeTable.delete(degree);
        continue;
      }

      if (currentNode.key <= partnerNode.key) {
        linkTrees(heap, currentId, partnerId);
        degreeTable.delete(degree);
      } else {
        linkTrees(heap, partnerId, currentId);
        degreeTable.delete(degree);
        currentId = partnerId;
      }
    }
  }

  heap.rootIds = new Set(degreeTable.values());
  updateMinId(heap);
}

function heapExtractMin(heap) {
  if (heap.minId === null) return null;

  const minNode = heap.nodes.get(heap.minId);
  if (!minNode) return null;

  for (const childId of minNode.children) {
    const child = heap.nodes.get(childId);
    if (!child) continue;
    child.parentId = null;
    child.mark = false;
    heap.rootIds.add(childId);
  }

  heap.rootIds.delete(minNode.id);
  heap.nodes.delete(minNode.id);

  if (heap.rootIds.size === 0) {
    heap.minId = null;
  } else {
    consolidate(heap);
  }

  return minNode;
}

function cutNode(heap, nodeId, parentId) {
  const node = heap.nodes.get(nodeId);
  const parent = heap.nodes.get(parentId);
  if (!node || !parent) return;

  parent.children = parent.children.filter((childId) => childId !== nodeId);
  node.parentId = null;
  node.mark = false;
  heap.rootIds.add(nodeId);
}

function cascadingCut(heap, nodeId) {
  const node = heap.nodes.get(nodeId);
  if (!node || node.parentId === null) return;

  const parent = heap.nodes.get(node.parentId);
  if (!parent) return;

  if (!node.mark) {
    node.mark = true;
  } else {
    cutNode(heap, nodeId, parent.id);
    cascadingCut(heap, parent.id);
  }
}

function heapDecreaseKey(heap, nodeId, newKey) {
  const node = heap.nodes.get(nodeId);
  if (!node || newKey > node.key) return false;

  node.key = newKey;
  const { parentId } = node;

  if (parentId !== null) {
    const parent = heap.nodes.get(parentId);
    if (parent && node.key < parent.key) {
      cutNode(heap, nodeId, parentId);
      cascadingCut(heap, parentId);
    }
  }

  if (heap.minId === null || node.key < heap.nodes.get(heap.minId).key) {
    heap.minId = nodeId;
  }

  return true;
}

function serializeHeap(heap) {
  return {
    minId: heap.minId,
    roots: [...heap.rootIds].sort((a, b) => a - b),
    nodes: [...heap.nodes.values()].map((node) => ({
      id: node.id,
      value: node.value,
      key: node.key,
      parentId: node.parentId,
      children: [...node.children],
      mark: node.mark,
    })),
  };
}

function buildFibonacciDPTimeline(graph, source = 0) {
  const distances = Object.fromEntries(graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const previous = Object.fromEntries(graph.nodes.map((node) => [node.id, null]));
  const heap = createHeap();
  const timeline = [];

  function pushStep(action, details, focusNodeId = null, activeEdge = null) {
    timeline.push({
      action,
      details,
      focusNodeId,
      activeEdge,
      distances: { ...distances },
      previous: { ...previous },
      heap: serializeHeap(heap),
    });
  }

  for (const node of graph.nodes) {
    const initialDistance = node.id === source ? 0 : Number.POSITIVE_INFINITY;
    distances[node.id] = initialDistance;
    heapInsert(heap, node.id, node.label, initialDistance);
  }

  pushStep(
    'Initialize',
    'All DP subproblems start at ∞ except the source state. Every state is inserted once, setting up future decrease-key updates.'
  );

  while (heap.minId !== null) {
    const minNode = heapExtractMin(heap);
    if (!minNode) break;

    pushStep(
      'Extract Min',
      `Choose the next finalized subproblem: ${minNode.value} with cost ${
        Number.isFinite(minNode.key) ? minNode.key : '∞'
      }.`,
      minNode.id
    );

    if (!Number.isFinite(minNode.key)) {
      pushStep('Stop', 'Remaining states are unreachable from the source, so DP relaxation is complete.');
      break;
    }

    for (const edge of graph.edges.filter((candidate) => candidate.from === minNode.id)) {
      const candidateDistance = distances[minNode.id] + edge.weight;

      if (candidateDistance < distances[edge.to]) {
        distances[edge.to] = candidateDistance;
        previous[edge.to] = minNode.id;
        heapDecreaseKey(heap, edge.to, candidateDistance);

        pushStep(
          'Decrease Key',
          `Relax edge ${graph.nodes[edge.from].label} → ${graph.nodes[edge.to].label}. New best cost for ${
            graph.nodes[edge.to].label
          } is ${candidateDistance}.`,
          edge.to,
          edge
        );
      } else {
        pushStep(
          'Relax (No Change)',
          `Checked edge ${graph.nodes[edge.from].label} → ${graph.nodes[edge.to].label}; existing value stays optimal.`,
          edge.to,
          edge
        );
      }
    }
  }

  return timeline;
}

function buildHeapRows(snapshot) {
  if (!snapshot) return [];

  const nodeMap = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const rows = [];
  const queue = snapshot.roots.map((rootId) => ({ id: rootId, depth: 0 }));

  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    const node = nodeMap.get(id);
    if (!node) continue;

    if (!rows[depth]) rows[depth] = [];
    rows[depth].push(node);

    for (const childId of node.children) {
      queue.push({ id: childId, depth: depth + 1 });
    }
  }

  return rows;
}

function formatDistance(value) {
  return Number.isFinite(value) ? value : '∞';
}

export default function FibonacciHeapDPPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [nodeCount, setNodeCount] = useState(DEFAULT_NODE_COUNT);
  const [edgeSpan, setEdgeSpan] = useState(DEFAULT_EDGE_SPAN);
  const [seed, setSeed] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const graph = useMemo(() => createGraph(nodeCount, edgeSpan, seed), [nodeCount, edgeSpan, seed]);
  const timeline = useMemo(() => buildFibonacciDPTimeline(graph, 0), [graph]);

  useEffect(() => {
    setStepIndex(0);
  }, [nodeCount, edgeSpan, seed]);

  const currentStep = timeline[Math.min(stepIndex, Math.max(timeline.length - 1, 0))];
  const heapRows = buildHeapRows(currentStep?.heap);

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

      <h1 className="text-3xl md:text-4xl font-bold text-center">Fibonacci Heap Demo</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">Traditional description</h2>
        <p className="text-slate-700 mb-3">
          Think of this as a smart trip planner: each circle is a stop, each line has a travel cost,
          and the demo keeps updating the cheapest known route as new shortcuts appear.
        </p>
        <p className="text-slate-700 mb-3">
          The Fibonacci heap helps this stay fast when many route costs improve repeatedly, so you can
          watch the plan evolve smoothly step by step.
        </p>

        <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer font-semibold text-slate-800">Show technical explanation</summary>
          <div className="mt-3 space-y-3 text-slate-700">
            <p>
              A <strong>Fibonacci heap</strong> is a collection of min-heap-ordered trees designed so that
              <strong> insert</strong> and <strong>decrease-key</strong> are amortized O(1), while
              <strong> extract-min</strong> is amortized O(log n).
            </p>
            <p>
              This demo applies it to a shortest-path dynamic programming process: each node is a
              subproblem, each edge is a transition cost, and relaxation updates are decrease-key events.
            </p>
            <p>
              The unique advantage appears when many states get improved repeatedly. Instead of rebuilding
              a priority queue, Fibonacci heaps cut and move nodes lazily with cascading cuts.
            </p>
          </div>
        </details>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to use</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Set graph size and transition span with the sliders, then click <strong>Regenerate Subset</strong>.</li>
          <li>Use <strong>Prev</strong>, <strong>Next</strong>, or the timeline slider to step through DP updates.</li>
          <li>Watch the graph: amber edge = currently relaxed transition, blue node = focus state.</li>
          <li>
            Watch the heap: root list and child levels shift as <strong>extract-min</strong> and
            <strong> decrease-key</strong> trigger linking, cuts, and cascading cuts.
          </li>
        </ul>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-semibold">State count: {nodeCount}</span>
            <input
              type="range"
              min="6"
              max="14"
              value={nodeCount}
              onChange={(event) => setNodeCount(Number.parseInt(event.target.value, 10))}
              className="w-full"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-semibold">Transition span: {edgeSpan}</span>
            <input
              type="range"
              min="2"
              max="5"
              value={edgeSpan}
              onChange={(event) => setEdgeSpan(Number.parseInt(event.target.value, 10))}
              className="w-full"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setSeed((value) => value + 1)}
            className="px-4 py-2 rounded bg-slate-800 text-white hover:bg-slate-700"
          >
            Regenerate Subset
          </button>
          <button
            type="button"
            onClick={() => {
              setNodeCount(DEFAULT_NODE_COUNT);
              setEdgeSpan(DEFAULT_EDGE_SPAN);
              setSeed((value) => value + 1);
            }}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500"
          >
            Load Example
          </button>
        </div>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Interactive visualization</h2>

        <div className="mb-4 rounded-lg bg-slate-100 p-4 space-y-2">
          <p className="text-slate-800">
            <strong>Step {Math.min(stepIndex + 1, timeline.length)}</strong> / {timeline.length} —{' '}
            {currentStep?.action || 'No simulation data'}
          </p>
          <p className="text-slate-700">{currentStep?.details}</p>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
            <h3 className="font-semibold mb-3">State transition graph (DP relaxations)</h3>
            <svg viewBox="0 0 100 100" className="w-full max-w-xl mx-auto bg-white rounded border border-slate-200">
              {graph.edges.map((edge, index) => {
                const from = graph.nodes[edge.from];
                const to = graph.nodes[edge.to];
                const active =
                  currentStep?.activeEdge &&
                  currentStep.activeEdge.from === edge.from &&
                  currentStep.activeEdge.to === edge.to &&
                  currentStep.activeEdge.weight === edge.weight;

                return (
                  <g key={`${edge.from}-${edge.to}-${index}`}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={active ? '#f59e0b' : '#94a3b8'}
                      strokeWidth={active ? 1.5 : 0.7}
                      opacity={active ? 1 : 0.6}
                    />
                    <text
                      x={(from.x + to.x) / 2}
                      y={(from.y + to.y) / 2}
                      fontSize="2.7"
                      fill={active ? '#b45309' : '#475569'}
                    >
                      {edge.weight}
                    </text>
                  </g>
                );
              })}

              {graph.nodes.map((node) => {
                const isFocus = currentStep?.focusNodeId === node.id;
                const distance = currentStep?.distances?.[node.id];

                return (
                  <g key={node.id}>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="4"
                      fill={isFocus ? '#2563eb' : '#ffffff'}
                      stroke={isFocus ? '#1d4ed8' : '#334155'}
                      strokeWidth="0.9"
                    />
                    <text x={node.x} y={node.y + 0.7} textAnchor="middle" fontSize="3" fill={isFocus ? '#fff' : '#0f172a'}>
                      {node.label}
                    </text>
                    <text x={node.x} y={node.y + 7} textAnchor="middle" fontSize="2.6" fill="#334155">
                      {formatDistance(distance)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
            <h3 className="font-semibold mb-3">Fibonacci heap forest</h3>
            <p className="text-sm text-slate-600 mb-3">
              Min pointer: {currentStep?.heap?.minId !== null ? graph.nodes[currentStep.heap.minId]?.label : 'None'}
            </p>

            <div className="space-y-3">
              {heapRows.length === 0 ? (
                <p className="text-slate-600">Heap is empty.</p>
              ) : (
                heapRows.map((row, depth) => (
                  <div key={depth} className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs uppercase tracking-wide text-slate-500 w-14">Level {depth}</span>
                    {row.map((node) => {
                      const isMin = currentStep?.heap?.minId === node.id;
                      return (
                        <div
                          key={node.id}
                          className={`rounded border px-2 py-1 text-sm ${
                            isMin ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white'
                          }`}
                        >
                          <span className="font-semibold">{node.value}</span>
                          <span className="text-slate-600"> : {formatDistance(node.key)}</span>
                          {node.mark ? <span className="ml-1 text-amber-600">●</span> : null}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold mb-2">Current DP table (best-known cost by state)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {graph.nodes.map((node) => (
              <div key={node.id} className="rounded border border-slate-200 bg-white p-2">
                <p className="text-xs text-slate-500">State {node.label}</p>
                <p className="text-lg font-bold text-slate-800">{formatDistance(currentStep?.distances?.[node.id])}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
