'use client';

import { useMemo, useState } from 'react';
import rawData from './arc-compression-data.json';

const VALUE_THRESHOLDS = [0, 10, 25, 50, 100];

function toNumber(value) {
  const normalized = `${value ?? ''}`.replace(/,/g, '');
  const result = Number(normalized);
  return Number.isFinite(result) ? result : 0;
}

function normalizeName(name) {
  return `${name ?? ''}`.trim().toLowerCase();
}

function parseCsv(input) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const [item, qtyRaw] = line.split(',').map((part) => part.trim());
      const quantity = Number(qtyRaw ?? 1);
      if (!item) return null;
      return {
        item,
        quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
      };
    })
    .filter(Boolean);
}

function getTotalStacks(inventory, stackByItem) {
  return [...inventory.entries()].reduce((sum, [key, qty]) => {
    if (qty <= 0) return sum;
    const stackSize = Math.max(stackByItem.get(key) ?? 1, 1);
    return sum + Math.ceil(qty / stackSize);
  }, 0);
}

function buildArdbActionModel() {
  const stackByItem = new Map();
  const displayNameByKey = new Map();

  for (const item of rawData.items) {
    const key = normalizeName(item.name);
    stackByItem.set(key, item.stackSize || 1);
    displayNameByKey.set(key, item.name);
  }

  const recyclingByItem = new Map();
  for (const row of rawData.recycling) {
    const key = normalizeName(row.name);
    const inputValue = toNumber(row.inputValue);
    const outputValue = toNumber(row.outputValue);
    const cost = Math.max(0, inputValue - outputValue);

    recyclingByItem.set(key, {
      key,
      name: row.name,
      outputs: row.outputs,
      inputValue,
      outputValue,
      cost,
      valueLossPercent: inputValue > 0 ? (cost / inputValue) * 100 : 0,
    });
  }

  const craftActions = rawData.crafting
    .map((row) => {
      const inputValue = toNumber(row.inputValue);
      const outputValue = toNumber(row.outputValue);
      const outputKey = normalizeName(row.name);
      const cost = Math.max(0, inputValue - outputValue);

      return {
        type: 'craft',
        id: `craft:${outputKey}`,
        label: `Craft ${row.name}`,
        output: row.name,
        outputKey,
        inputs: row.resources,
        inputValue,
        outputValue,
        valueDelta: outputValue - inputValue,
        cost,
        valueLossPercent: inputValue > 0 ? (cost / inputValue) * 100 : 0,
      };
    })
    .filter((recipe) => recipe.inputs.length > 0);

  const recycleActions = [...recyclingByItem.values()].map((row) => ({
    type: 'recycle',
    id: `recycle:${row.key}`,
    label: `Recycle ${row.name}`,
    itemKey: row.key,
    itemName: row.name,
    outputs: row.outputs,
    inputValue: row.inputValue,
    outputValue: row.outputValue,
    valueDelta: row.outputValue - row.inputValue,
    cost: row.cost,
    valueLossPercent: row.valueLossPercent,
  }));

  return {
    label: 'ARDB default dataset',
    stackByItem,
    displayNameByKey,
    craftActions,
    recycleActions,
  };
}

function parseCustomDatasetText(rawText) {
  const parsed = JSON.parse(rawText);
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Custom dataset must include an items array.');
  }

  return items.map((item) => {
    const name = `${item.name ?? ''}`.trim();
    const stackSize = Number(item.stackSize);
    const cost = Number(item.cost);
    const recipe = Array.isArray(item.recipe) ? item.recipe : [];

    if (!name) {
      throw new Error('Each custom item must include a name.');
    }
    if (!Number.isFinite(stackSize) || stackSize <= 0) {
      throw new Error(`Item "${name}" must include a positive stackSize.`);
    }
    if (!Number.isFinite(cost) || cost < 0) {
      throw new Error(`Item "${name}" must include a non-negative cost.`);
    }

    const normalizedRecipe = recipe.map((ingredient) => {
      const ingredientName = `${ingredient.name ?? ''}`.trim();
      const qty = Number(ingredient.qty);
      if (!ingredientName || !Number.isFinite(qty) || qty <= 0) {
        throw new Error(`Item "${name}" has an invalid recipe ingredient.`);
      }
      return { name: ingredientName, qty: Math.floor(qty) };
    });

    return {
      name,
      stackSize: Math.floor(stackSize),
      cost,
      recipe: normalizedRecipe,
    };
  });
}

function buildCustomActionModel(customItems) {
  const stackByItem = new Map();
  const displayNameByKey = new Map();
  const costByItem = new Map();

  for (const item of customItems) {
    const key = normalizeName(item.name);
    stackByItem.set(key, item.stackSize);
    displayNameByKey.set(key, item.name);
    costByItem.set(key, item.cost);
  }

  for (const item of customItems) {
    for (const ingredient of item.recipe) {
      const ingredientKey = normalizeName(ingredient.name);
      if (!displayNameByKey.has(ingredientKey)) {
        displayNameByKey.set(ingredientKey, ingredient.name);
      }
      if (!stackByItem.has(ingredientKey)) {
        stackByItem.set(ingredientKey, 1);
      }
      if (!costByItem.has(ingredientKey)) {
        costByItem.set(ingredientKey, 0);
      }
    }
  }

  const craftActions = customItems
    .filter((item) => item.recipe.length > 0)
    .map((item) => {
      const outputKey = normalizeName(item.name);
      const inputValue = item.recipe.reduce((sum, ingredient) => sum + (costByItem.get(normalizeName(ingredient.name)) ?? 0) * ingredient.qty, 0);
      const outputValue = item.cost;
      const cost = Math.max(0, inputValue - outputValue);

      return {
        type: 'craft',
        id: `craft:${outputKey}`,
        label: `Craft ${item.name}`,
        output: item.name,
        outputKey,
        inputs: item.recipe,
        inputValue,
        outputValue,
        valueDelta: outputValue - inputValue,
        cost,
        valueLossPercent: inputValue > 0 ? (cost / inputValue) * 100 : 0,
      };
    });

  const recycleActions = customItems
    .filter((item) => item.recipe.length > 0)
    .map((item) => {
      const key = normalizeName(item.name);
      const inputValue = item.cost;
      const outputValue = item.recipe.reduce((sum, ingredient) => sum + (costByItem.get(normalizeName(ingredient.name)) ?? 0) * ingredient.qty, 0);
      const cost = Math.max(0, inputValue - outputValue);

      return {
        type: 'recycle',
        id: `recycle:${key}`,
        label: `Recycle ${item.name}`,
        itemKey: key,
        itemName: item.name,
        outputs: item.recipe,
        inputValue,
        outputValue,
        valueDelta: outputValue - inputValue,
        cost,
        valueLossPercent: inputValue > 0 ? (cost / inputValue) * 100 : 0,
      };
    });

  return {
    label: 'Custom uploaded dataset',
    stackByItem,
    displayNameByKey,
    craftActions,
    recycleActions,
  };
}

function canApplyAction(action, inventory) {
  if (action.type === 'craft') {
    return action.inputs.every((input) => (inventory.get(normalizeName(input.name)) ?? 0) >= input.qty);
  }

  if (action.type === 'recycle') {
    return (inventory.get(action.itemKey) ?? 0) >= 1;
  }

  return false;
}

function applyAction(action, inventory) {
  const next = new Map(inventory);

  if (action.type === 'craft') {
    for (const input of action.inputs) {
      const key = normalizeName(input.name);
      next.set(key, (next.get(key) ?? 0) - input.qty);
    }
    next.set(action.outputKey, (next.get(action.outputKey) ?? 0) + 1);
    return next;
  }

  const sourceKey = action.itemKey;
  next.set(sourceKey, (next.get(sourceKey) ?? 0) - 1);
  for (const output of action.outputs) {
    const outputKey = normalizeName(output.name);
    next.set(outputKey, (next.get(outputKey) ?? 0) + output.qty);
  }
  return next;
}

function getMaxRepeats(action, inventory) {
  if (action.type === 'craft') {
    return action.inputs.reduce((minRepeats, input) => {
      const available = inventory.get(normalizeName(input.name)) ?? 0;
      return Math.min(minRepeats, Math.floor(available / input.qty));
    }, Number.POSITIVE_INFINITY);
  }

  if (action.type === 'recycle') {
    return inventory.get(action.itemKey) ?? 0;
  }

  return 0;
}

function applyActionMultiple(action, inventory, repeatCount) {
  let next = new Map(inventory);
  for (let index = 0; index < repeatCount; index += 1) {
    next = applyAction(action, next);
  }
  return next;
}

function runCompression(initialInventory, stackByItem, actions, options = {}) {
  const {
    maxCost = Number.POSITIVE_INFINITY,
    valueLossPercentCap = Number.POSITIVE_INFINITY,
    prioritizeValueLoss = false,
    avoidUndoPairs = false,
    allowRecycling = true,
  } = options;

  const inventory = new Map(initialInventory);
  const operations = [];
  const seenStates = new Set();
  let totalCost = 0;
  let iterationGuard = 0;
  let setupCraftStreak = 0;
  let previousAction = null;

  while (iterationGuard < 3000) {
    iterationGuard += 1;

    const stateKey = [...inventory.entries()]
      .filter(([, qty]) => qty > 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, qty]) => `${key}:${qty}`)
      .join('|');

    if (seenStates.has(stateKey)) {
      break;
    }
    seenStates.add(stateKey);

    const currentStacks = getTotalStacks(inventory, stackByItem);
    const candidates = actions
      .filter((action) => allowRecycling || action.type !== 'recycle')
      .filter((action) => {
        if (!avoidUndoPairs || !previousAction) return true;
        const previousKey = previousAction.type === 'craft' ? previousAction.outputKey : previousAction.itemKey;
        const currentKey = action.type === 'craft' ? action.outputKey : action.itemKey;
        const reversesPrevious = previousAction.type !== action.type && previousKey === currentKey;
        return !reversesPrevious;
      })
      .filter((action) => action.valueLossPercent <= valueLossPercentCap)
      .filter((action) => totalCost + action.cost <= maxCost)
      .filter((action) => canApplyAction(action, inventory))
      .map((action) => {
        const maxRepeats = Math.min(getMaxRepeats(action, inventory), 250);
        if (!Number.isFinite(maxRepeats) || maxRepeats <= 0) return null;

        let bestCandidate = null;

        for (let repeatCount = 1; repeatCount <= maxRepeats; repeatCount += 1) {
          const totalActionCost = action.cost * repeatCount;
          if (totalCost + totalActionCost > maxCost) break;

          const nextInventory = applyActionMultiple(action, inventory, repeatCount);
          const nextStacks = getTotalStacks(nextInventory, stackByItem);
          const stackDelta = nextStacks - currentStacks;

          if (stackDelta > 0 && action.type !== 'craft') continue;

          if (!bestCandidate || stackDelta < bestCandidate.stackDelta || (stackDelta === bestCandidate.stackDelta && totalActionCost < bestCandidate.totalActionCost)) {
            bestCandidate = {
              ...action,
              stackDelta,
              repeatCount,
              totalActionCost,
            };
          }
        }

        return bestCandidate;
      })
      .filter(Boolean)
      .filter((action) => action.stackDelta < 0 || action.type === 'craft');

    if (!candidates.length) {
      break;
    }

    const hasReducingCandidate = candidates.some((action) => action.stackDelta < 0);
    const eligibleCandidates = hasReducingCandidate ? candidates.filter((action) => action.stackDelta < 0) : candidates;

    const sorted = [...eligibleCandidates].sort((a, b) => {
      if (prioritizeValueLoss) {
        if (a.stackDelta !== b.stackDelta) return a.stackDelta - b.stackDelta;
        if (a.valueDelta !== b.valueDelta) return b.valueDelta - a.valueDelta;
        if (a.valueLossPercent !== b.valueLossPercent) return a.valueLossPercent - b.valueLossPercent;
        if (a.totalActionCost !== b.totalActionCost) return a.totalActionCost - b.totalActionCost;
        return 0;
      }

      if (a.stackDelta !== b.stackDelta) return a.stackDelta - b.stackDelta;
      if (a.totalActionCost !== b.totalActionCost) return a.totalActionCost - b.totalActionCost;
      return a.valueLossPercent - b.valueLossPercent;
    });

    const chosen = sorted[0];

    if (chosen.type === 'craft' && chosen.stackDelta >= 0) {
      setupCraftStreak += 1;
      if (setupCraftStreak > 18) {
        break;
      }
    } else {
      setupCraftStreak = 0;
    }

    operations.push(chosen);
    totalCost += chosen.totalActionCost;
    previousAction = chosen;

    const next = applyActionMultiple(chosen, inventory, chosen.repeatCount);
    inventory.clear();
    for (const [key, value] of next.entries()) {
      inventory.set(key, value);
    }
  }

  return { inventory, operations, totalCost };
}


function formatOperationStep(action, index) {
  const typeLabel = action.type === 'craft' ? 'Craft' : 'Recycle';
  return `${index + 1}. ${typeLabel} · ${action.label.replace(/^Craft\s|^Recycle\s/, '')} ×${action.repeatCount} (stack Δ ${action.stackDelta}, cost ${action.totalActionCost.toFixed(0)}, value loss ${action.valueLossPercent.toFixed(1)}%)`;
}

function inventoryToRows(inventory, displayNameByKey, stackByItem) {
  return [...inventory.entries()]
    .filter(([, qty]) => qty > 0)
    .map(([key, qty]) => ({
      name: displayNameByKey.get(key) ?? key,
      quantity: qty,
      stackSize: stackByItem.get(key) ?? 1,
      stacksUsed: Math.ceil(qty / Math.max(stackByItem.get(key) ?? 1, 1)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function CkplaceToolsPage() {
  const [csvText, setCsvText] = useState('Fabric,200\nPlastic Parts,120\nMechanical Components,80\nDuct Tape,40\nChemicals,60');
  const [costBudgetText, setCostBudgetText] = useState('1000');
  const [parsedRows, setParsedRows] = useState([]);
  const [costBudget, setCostBudget] = useState(1000);
  const [error, setError] = useState('');
  const [datasetMessage, setDatasetMessage] = useState('Using ARDB default dataset.');

  const defaultModel = useMemo(() => buildArdbActionModel(), []);
  const [customModel, setCustomModel] = useState(null);
  const model = customModel ?? defaultModel;

  const result = useMemo(() => {
    if (!parsedRows.length) return null;

    const initialInventory = new Map();
    for (const row of parsedRows) {
      const key = normalizeName(row.item);
      if (!model.displayNameByKey.has(key)) continue;
      initialInventory.set(key, (initialInventory.get(key) ?? 0) + row.quantity);
    }

    const baselineRows = inventoryToRows(initialInventory, model.displayNameByKey, model.stackByItem);
    const baselineSlots = getTotalStacks(initialInventory, model.stackByItem);

    const aggressive = runCompression(initialInventory, model.stackByItem, [...model.craftActions, ...model.recycleActions], {
      maxCost: Number.POSITIVE_INFINITY,
      prioritizeValueLoss: true,
      avoidUndoPairs: true,
      allowRecycling: false,
    });

    const aggressiveRows = inventoryToRows(aggressive.inventory, model.displayNameByKey, model.stackByItem);
    const aggressiveSlots = getTotalStacks(aggressive.inventory, model.stackByItem);

    const byThreshold = VALUE_THRESHOLDS.map((threshold) => {
      const run = runCompression(initialInventory, model.stackByItem, [...model.craftActions, ...model.recycleActions], {
        maxCost: Math.max(0, costBudget),
        valueLossPercentCap: threshold,
        prioritizeValueLoss: true,
      });

      const finalRows = inventoryToRows(run.inventory, model.displayNameByKey, model.stackByItem);
      const finalSlots = getTotalStacks(run.inventory, model.stackByItem);

      return {
        threshold,
        operations: run.operations,
        finalRows,
        finalSlots,
        totalCost: run.totalCost,
      };
    });

    return {
      baselineRows,
      baselineSlots,
      aggressiveRows,
      aggressiveSlots,
      aggressiveOps: aggressive.operations,
      aggressiveCost: aggressive.totalCost,
      byThreshold,
    };
  }, [parsedRows, costBudget, model]);

  async function handleDatasetUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const customItems = parseCustomDatasetText(text);
      const nextModel = buildCustomActionModel(customItems);
      setCustomModel(nextModel);
      setDatasetMessage(`Using custom dataset: ${file.name} (${customItems.length} items).`);
      setError('');
    } catch (datasetError) {
      setError(`Invalid custom dataset: ${datasetError.message}`);
    }
  }

  function handleResetDataset() {
    setCustomModel(null);
    setDatasetMessage('Using ARDB default dataset.');
    setError('');
  }

  function handleAnalyze() {
    const parsed = parseCsv(csvText);
    if (!parsed.length) {
      setError('Please provide CSV rows in this format: Item Name,Quantity');
      setParsedRows([]);
      return;
    }

    const parsedBudget = Number(costBudgetText);
    if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
      setError('Please provide a valid non-negative recycling/crafting cost budget.');
      return;
    }

    setError('');
    setCostBudget(parsedBudget);
    setParsedRows(parsed);
  }

  return (
    <main className="min-h-screen p-6 md:p-10 bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Ckplace Tools · ARC Item Compression</h1>
          <p className="text-sm text-slate-600">Compress inventory from CSV input using the active crafting/recycling dataset.</p>
        </header>

        <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold">Dataset configuration</h2>
          <p className="text-sm text-slate-700">{datasetMessage}</p>
          <label className="block text-sm font-semibold" htmlFor="dataset-upload">
            Upload custom JSON dataset
          </label>
          <input id="dataset-upload" type="file" accept="application/json" className="block w-full text-sm" onChange={handleDatasetUpload} />
          <p className="text-xs text-slate-600">
            Required per item: <code>name</code>, <code>stackSize</code>, <code>cost</code>, and <code>recipe</code> (array of ingredients with{' '}
            <code>name</code> + <code>qty</code>). Example root: <code>{'{"items":[{"name":"Bandage","stackSize":5,"cost":250,"recipe":[{"name":"Fabric","qty":5}]}]}'}</code>
          </p>
          <button type="button" className="px-3 py-2 rounded-md bg-slate-200 text-slate-900 text-sm font-semibold hover:bg-slate-300" onClick={handleResetDataset}>
            Reset to ARDB Dataset
          </button>
        </section>

        <section className="rounded-xl border border-blue-200 bg-[#eef6ff] p-4 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold">How to use</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700">
            <li>Paste your inventory in <strong>Item,Quantity</strong> CSV format and click <strong>Analyze Compression</strong>.</li>
            <li>Stack counts are always rounded up per item because every partial stack consumes a full inventory slot.</li>
            <li>
              The optimizer prefers stack-reducing actions first. If none are available, it can use setup craft steps that temporarily hold or increase stacks to unlock better later compression.
            </li>
            <li>
              In value-prioritized runs, actions are chosen by <strong>lowest value loss first</strong>, then <strong>lowest cost</strong>, and then best stack reduction.
            </li>
            <li>Use the value-loss thresholds to compare safer vs. aggressive plans and pick the run that fits your stack goal and budget.</li>
            <li>&ldquo;Value&rdquo; means item-price value from the dataset. <strong>Cost</strong> is value lost in a conversion: <code>input value - output value</code> (never below 0).
              <strong>Value loss %</strong> is <code>cost / input value × 100</code>.</li>
          </ul>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <label className="block text-sm font-semibold" htmlFor="csv-input">
            Item list CSV (Item,Quantity)
          </label>
          <textarea
            id="csv-input"
            className="w-full min-h-40 border border-slate-300 rounded-md p-3 text-sm font-mono"
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
          />

          <label className="block text-sm font-semibold" htmlFor="cost-budget-input">
            Max allowed cost for value-prioritized runs
          </label>
          <input
            id="cost-budget-input"
            type="number"
            min="0"
            step="1"
            className="w-full md:w-64 border border-slate-300 rounded-md p-2 text-sm"
            value={costBudgetText}
            onChange={(event) => setCostBudgetText(event.target.value)}
          />

          <button
            type="button"
            className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700"
            onClick={handleAnalyze}
          >
            Analyze Compression
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </section>

        {result && (
          <>
            <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
              <h2 className="text-xl font-semibold">1) Most aggressive compression (ignores cost)</h2>
              <p className="text-sm text-slate-700">
                Baseline slots: <strong>{result.baselineSlots}</strong> → Compressed slots: <strong>{result.aggressiveSlots}</strong>
              </p>
              <p className="text-sm text-slate-700">Strategy: craft-up only (no recycling), with anti-undo protection and value-aware ranking.</p>
              <p className="text-sm text-slate-700">Operations used: {result.aggressiveOps.length}</p>
              <p className="text-sm text-slate-700">Total incurred cost: {result.aggressiveCost.toFixed(0)}</p>
              <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                <h3 className="text-sm font-semibold mb-1">Crafting / recycling steps</h3>
                {result.aggressiveOps.length ? (
                  <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-700">
                    {result.aggressiveOps.map((action, index) => (
                      <li key={`${action.id}-${index}`}>{formatOperationStep(action, index)}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-slate-600">No operations were needed.</p>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left border-b border-slate-200">
                      <th className="py-2">Item</th>
                      <th className="py-2">Qty</th>
                      <th className="py-2">Stack Size</th>
                      <th className="py-2">Stacks Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.aggressiveRows.map((row) => (
                      <tr key={row.name} className="border-b border-slate-100">
                        <td className="py-1.5">{row.name}</td>
                        <td className="py-1.5">{row.quantity}</td>
                        <td className="py-1.5">{row.stackSize}</td>
                        <td className="py-1.5">{row.stacksUsed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <h2 className="text-xl font-semibold">2) Value-prioritized compression with cost budget</h2>
              <p className="text-sm text-slate-700">Configured max cost: {costBudget.toFixed(0)}</p>
              <p className="text-sm text-slate-700">
                Value-prioritized mode protects item value before stack count: within each threshold, it prefers the lowest-loss action first, then the lowest cost action,
                and only then stronger stack reduction.
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {result.byThreshold.map((bucket) => (
                  <article key={bucket.threshold} className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
                    <h3 className="font-semibold">Loss ≤ {bucket.threshold}%</h3>
                    <p className="text-sm text-slate-700">Operations: {bucket.operations.length}</p>
                    <p className="text-sm text-slate-700">Final stacks used: {bucket.finalSlots}</p>
                    <p className="text-sm text-slate-700">Total cost used: {bucket.totalCost.toFixed(0)}</p>
                    {bucket.operations.length ? (
                      <ol className="list-decimal pl-5 space-y-1 text-xs text-slate-700">
                        {bucket.operations.slice(0, 8).map((action, index) => (
                          <li key={`${bucket.threshold}-${action.id}-${index}`}>{formatOperationStep(action, index)}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-xs text-slate-600">No operations under this value-loss cap.</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
