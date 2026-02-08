'use client';

import { useEffect, useMemo, useState } from 'react';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const RANK_LEVELS = [5, 4, 3, 2, 1];
const CANDIDATE_COUNTS = { 5: 9, 4: 7, 3: 5, 2: 3, 1: 1 };

function shuffle(cards) {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function getRuleValue(rank) {
  if (rank === 'A') return 1;
  if (rank === '10') return 0;
  return Number(rank);
}

function createDeck() {
  let id = 1;
  const cards = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id,
        rank,
        suit,
        value: getRuleValue(rank),
      });
      id += 1;
    }
  }

  return shuffle(cards);
}

function cardLabel(card) {
  if (!card) return '';
  return `${card.rank}${card.suit}`;
}

function cloneZones(zones) {
  return Object.fromEntries(
    Object.entries(zones).map(([rank, cards]) => [rank, cards.map((card) => ({ ...card }))]),
  );
}

function createInitialState() {
  const deck = createDeck();
  const candidates = { 5: [], 4: [], 3: [], 2: [], 1: [] };
  const members = { 5: [], 4: [], 3: [], 2: [], 1: [] };

  let cursor = 0;
  for (const rank of RANK_LEVELS) {
    const count = CANDIDATE_COUNTS[rank];
    candidates[rank] = deck.slice(cursor, cursor + count);
    cursor += count;
  }

  members[5] = deck.slice(cursor, cursor + 3);

  return {
    candidates,
    members,
    sacrificedCount: 0,
    gameState: 'playing',
    message: 'Pick a rank with exactly three members, then promote one card upward.',
    selectedSourceRank: null,
    selectedMemberIndex: null,
    replacementOptions: [],
    pendingPromotion: null,
    sacrificeRank: null,
  };
}

function getReplacementValues(a, b) {
  return [(a + b) % 10, (a * b) % 10];
}

function getReplacementOptions(state, rank, promotedIndex) {
  const rankMembers = state.members[rank];
  if (!rankMembers || rankMembers.length !== 3) return [];

  const survivors = rankMembers.filter((_, index) => index !== promotedIndex);
  if (survivors.length !== 2) return [];

  const allowedValues = getReplacementValues(survivors[0].value, survivors[1].value);
  return state.candidates[rank]
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => allowedValues.includes(card.value));
}

function hasAnyLegalMove(state) {
  if (state.gameState !== 'playing') return false;

  for (const rank of RANK_LEVELS) {
    if (state.members[rank].length !== 3) continue;
    if (rank === 1) return true;

    for (let memberIndex = 0; memberIndex < 3; memberIndex += 1) {
      if (getReplacementOptions(state, rank, memberIndex).length > 0) {
        return true;
      }
    }
  }

  return false;
}

function getCardTone(card) {
  if (!card) return '';
  return card.suit === '♥' || card.suit === '♦'
    ? 'border-rose-300 bg-rose-50 text-rose-800'
    : 'border-slate-300 bg-white text-slate-900';
}

function getRankShellTone(rank) {
  const tones = {
    5: 'border-sky-200 bg-sky-50/80',
    4: 'border-cyan-200 bg-cyan-50/80',
    3: 'border-emerald-200 bg-emerald-50/80',
    2: 'border-violet-200 bg-violet-50/80',
    1: 'border-amber-200 bg-amber-50/80',
  };
  return tones[rank] ?? 'border-slate-200 bg-slate-50';
}

export default function SyndicatePage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [state, setState] = useState(() => createInitialState());

  useEffect(() => {
    document.title = 'Syndicate';
  }, []);

  const promotableRanks = useMemo(() => RANK_LEVELS.filter((rank) => state.members[rank].length === 3), [state.members]);

  function resetGame() {
    setState(createInitialState());
  }

  function setLossMessage(nextState, message) {
    if (hasAnyLegalMove(nextState)) return nextState;
    return {
      ...nextState,
      gameState: 'lost',
      message,
      selectedSourceRank: null,
      selectedMemberIndex: null,
      replacementOptions: [],
      pendingPromotion: null,
      sacrificeRank: null,
    };
  }

  function chooseSourceRank(rank) {
    if (state.gameState !== 'playing') return;
    if (state.sacrificeRank !== null) return;
    if (state.members[rank].length !== 3) return;

    setState((prev) => ({
      ...prev,
      selectedSourceRank: rank,
      selectedMemberIndex: null,
      replacementOptions: [],
      message: rank === 1
        ? 'Choose a Rank 1 member to promote for a win.'
        : `Choose one Rank ${rank} member to promote to Rank ${rank - 1}.`,
    }));
  }

  function chooseMember(rank, memberIndex) {
    if (state.gameState !== 'playing') return;
    if (state.selectedSourceRank !== rank) return;

    if (rank === 1) {
      const nextMembers = cloneZones(state.members);
      nextMembers[1] = nextMembers[1].filter((_, index) => index !== memberIndex);
      setState({
        ...state,
        members: nextMembers,
        gameState: 'won',
        message: `🎉 Rank 1 cleared. You promoted ${cardLabel(state.members[1][memberIndex])} to Rank 0 and won!`,
        selectedSourceRank: null,
        selectedMemberIndex: null,
        replacementOptions: [],
      });
      return;
    }

    const replacementOptions = getReplacementOptions(state, rank, memberIndex);
    if (replacementOptions.length === 0) {
      setState((prev) => ({
        ...prev,
        selectedMemberIndex: memberIndex,
        replacementOptions: [],
        message: 'That promotion is illegal: no candidate in this rank matches the last-digit replacement rule.',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      selectedMemberIndex: memberIndex,
      replacementOptions,
      message: 'Pick a highlighted candidate to refill the source rank using (a+b)%10 or (a*b)%10.',
    }));
  }

  function chooseReplacement(candidateIndex) {
    if (state.gameState !== 'playing') return;
    const rank = state.selectedSourceRank;
    if (!rank || rank === 1 || state.selectedMemberIndex === null) return;

    const replacement = state.replacementOptions.find((option) => option.index === candidateIndex);
    if (!replacement) return;

    const nextMembers = cloneZones(state.members);
    const nextCandidates = cloneZones(state.candidates);

    const promotedCard = nextMembers[rank][state.selectedMemberIndex];
    nextMembers[rank] = nextMembers[rank].filter((_, index) => index !== state.selectedMemberIndex);

    const pulledCandidate = nextCandidates[rank][candidateIndex];
    nextCandidates[rank] = nextCandidates[rank].filter((_, index) => index !== candidateIndex);
    nextMembers[rank].push(pulledCandidate);

    const targetRank = rank - 1;
    nextMembers[targetRank].push(promotedCard);

    if (nextMembers[targetRank].length > 3) {
      // Overflow is resolved by sacrificing exactly one member from the promoted-into rank.
      setState({
        ...state,
        members: nextMembers,
        candidates: nextCandidates,
        selectedSourceRank: null,
        selectedMemberIndex: null,
        replacementOptions: [],
        pendingPromotion: { from: rank, to: targetRank, card: promotedCard },
        sacrificeRank: targetRank,
        message: `Rank ${targetRank} overflowed to four members. Choose one card there to sacrifice.`,
      });
      return;
    }

    const baseNextState = {
      ...state,
      members: nextMembers,
      candidates: nextCandidates,
      selectedSourceRank: null,
      selectedMemberIndex: null,
      replacementOptions: [],
      pendingPromotion: null,
      message: `Promoted ${cardLabel(promotedCard)} to Rank ${targetRank}.`,
    };

    setState(setLossMessage(baseNextState, 'No legal promotions remain. You are stuck.'));
  }

  function chooseSacrifice(memberIndex) {
    if (state.gameState !== 'playing') return;
    if (state.sacrificeRank === null) return;

    const rank = state.sacrificeRank;
    const nextMembers = cloneZones(state.members);
    const sacrificedCard = nextMembers[rank][memberIndex];
    if (!sacrificedCard) return;

    // Sacrificed cards leave play permanently and increase score (lower is better).
    nextMembers[rank] = nextMembers[rank].filter((_, index) => index !== memberIndex);

    const baseNextState = {
      ...state,
      members: nextMembers,
      sacrificedCount: state.sacrificedCount + 1,
      sacrificeRank: null,
      pendingPromotion: null,
      message: `Sacrificed ${cardLabel(sacrificedCard)} from Rank ${rank}.`,
    };

    setState(setLossMessage(baseNextState, 'No legal promotions remain after the sacrifice.'));
  }

  function handleNewGame() {
    if (!window.confirm('Start a new game? Your current Syndicate run will be lost.')) return;
    resetGame();
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-5 p-6 bg-slate-50 text-slate-900">
      <div className="w-full max-w-6xl flex justify-between items-center">
        <button
          type="button"
          onClick={() => window.location.assign(demosHref)}
          className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800"
        >
          ← Back
        </button>
        <div className="text-right text-sm text-slate-700">
          <p>Score: <span className="font-semibold">{state.sacrificedCount}</span> sacrifices</p>
          <p className="text-xs">Lower is better.</p>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-center">Syndicate Demo</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-2">Description</h2>
        <p className="text-slate-700">
          Syndicate is a rank-climbing card DP where every promotion must preserve formation discipline.
          You push members upward from Rank 5 to Rank 1, refill from that rank&apos;s candidates by digit math,
          and absorb overflow with sacrifices. Score is the number of sacrificed cards, so lower is better.
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to Play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Select a rank that currently has exactly 3 members, then choose one member to promote.</li>
          <li>Promotions move up one step (R5→R4→R3→R2→R1), and promoting from Rank 1 wins instantly.</li>
          <li>Use New Game to reshuffle when you want to restart from a fresh deal.</li>
        </ul>
        <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <summary className="cursor-pointer font-semibold text-slate-800">Advanced rules (replacement + overflow)</summary>
          <ul className="list-disc pl-5 mt-3 space-y-2 text-slate-700">
            <li>
              After promoting from a rank, refill that same rank from its candidate column using the two remaining
              members&apos; values.
            </li>
            <li>
              A candidate is legal only when its value matches <code>(a+b)%10</code> or <code>(a*b)%10</code>.
            </li>
            <li>
              If the promoted-into rank reaches 4 members, it overflows. You must immediately sacrifice one card there.
            </li>
            <li>
              You lose if no legal promotion remains.
            </li>
          </ul>
        </details>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        {RANK_LEVELS.map((rank) => {
          const isSelectedRank = state.selectedSourceRank === rank;
          const canPromote = state.members[rank].length === 3;
          return (
            <div key={rank} className={`rounded-lg border p-4 ${getRankShellTone(rank)}`}>
              <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                <h3 className="text-lg font-semibold">Rank {rank}</h3>
                <button
                  type="button"
                  onClick={() => chooseSourceRank(rank)}
                  disabled={state.gameState !== 'playing' || state.sacrificeRank !== null || !canPromote}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    isSelectedRank ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {rank === 1 ? 'Promote to Win' : `Promote to Rank ${rank - 1}`}
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border border-slate-200 bg-white/80 p-3">
                  <p className="text-sm font-medium mb-2">Members ({state.members[rank].length}/3)</p>
                  <div className="flex flex-wrap gap-2 min-h-12">
                    {state.members[rank].length === 0 && (
                      <span className="text-sm text-slate-500">No members yet.</span>
                    )}
                    {state.members[rank].map((card, memberIndex) => {
                      const selectable = state.gameState === 'playing' && isSelectedRank;
                      const sacrificeSelectable = state.gameState === 'playing' && state.sacrificeRank === rank;
                      const isActive = state.selectedMemberIndex === memberIndex && isSelectedRank;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => (sacrificeSelectable ? chooseSacrifice(memberIndex) : chooseMember(rank, memberIndex))}
                          disabled={!selectable && !sacrificeSelectable}
                          className={`min-w-14 px-3 py-2 rounded border text-sm font-semibold ${getCardTone(card)} ${
                            isActive ? 'ring-2 ring-sky-500' : ''
                          } ${sacrificeSelectable ? 'ring-2 ring-amber-500' : ''} disabled:opacity-70`}
                        >
                          {cardLabel(card)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded border border-slate-200 bg-white/80 p-3">
                  <p className="text-sm font-medium mb-2">Candidates ({state.candidates[rank].length})</p>
                  <div className="flex flex-wrap gap-2 min-h-12">
                    {state.candidates[rank].length === 0 && (
                      <span className="text-sm text-slate-500">No candidates left.</span>
                    )}
                    {state.candidates[rank].map((card, candidateIndex) => {
                      const canUse = state.replacementOptions.some((option) => option.index === candidateIndex);
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => chooseReplacement(candidateIndex)}
                          disabled={!canUse}
                          className={`min-w-14 px-3 py-2 rounded border text-sm font-semibold ${getCardTone(card)} ${
                            canUse ? 'ring-2 ring-emerald-500' : ''
                          } disabled:opacity-40`}
                        >
                          {cardLabel(card)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium text-slate-800">
          {state.gameState === 'won' && '🎉 Victory!'}
          {state.gameState === 'lost' && '💥 Run ended.'}
          {state.gameState === 'playing' && state.message}
          {state.gameState !== 'playing' && ` ${state.message}`}
          {state.pendingPromotion && state.sacrificeRank !== null
            && ` Promoted ${cardLabel(state.pendingPromotion.card)} from Rank ${state.pendingPromotion.from} to Rank ${state.pendingPromotion.to}.`}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleNewGame}
            className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-700"
          >
            New Game
          </button>
        </div>
      </section>

      <p className="text-sm text-slate-600">
        Promotable ranks this turn: {promotableRanks.length > 0 ? promotableRanks.map((rank) => `R${rank}`).join(', ') : 'none'}
      </p>


      <p className="w-full max-w-6xl text-center text-sm text-slate-600">
        Credit for this game goes to Isaludo. Rule book for this and other games available at
        {' '}
        <a className="text-blue-700 underline" href="https://drive.google.com/file/d/1DB2YF46s0oVFUSIpR9vxoGIbhpTKz2jw/view" target="_blank" rel="noreferrer">
          https://drive.google.com/file/d/1DB2YF46s0oVFUSIpR9vxoGIbhpTKz2jw/view
        </a>
      </p>
    </main>
  );
}
