'use client';

import { useEffect, useState } from 'react';

export default function SkywayPage() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const [status, setStatus] = useState('Ready for takeoff.');
  const [energy, setEnergy] = useState(3);

  useEffect(() => {
    document.title = 'Skyway';
  }, []);

  function handleBoost() {
    if (energy <= 0) {
      setStatus('No energy left. Recharge before boosting again.');
      return;
    }

    setEnergy((prev) => prev - 1);
    setStatus('Boost engaged. You climbed to the next lane.');
  }

  function handleRecharge() {
    setEnergy(3);
    setStatus('Systems recharged. Flight controls are stable.');
  }

  return (
    <main className="min-h-screen p-6 md:p-8 flex flex-col items-center gap-5">
      <div className="w-full max-w-6xl flex items-center justify-start">
        <button
          type="button"
          onClick={() => window.location.assign(demosHref)}
          className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800"
        >
          ← Back
        </button>
      </div>

      <h1 className="text-3xl font-bold text-center">Skyway</h1>

      <section className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">What is Skyway?</h2>
        <p className="text-slate-700">
          Skyway is a lightweight lane-planning demo package where you steer a shuttle through a floating
          route. This page follows the same visual structure used by the other game DPs.
        </p>
      </section>

      <section className="w-full max-w-6xl rounded-xl border border-blue-200 bg-[#eef6ff] p-5 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">How to play</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Use <strong>Boost</strong> to spend 1 energy and climb to a safer lane.</li>
          <li>Use <strong>Recharge</strong> to reset your energy and stabilize the shuttle.</li>
          <li>Track mission feedback in the status panel while you practice route timing.</li>
        </ul>
      </section>

      <section className="w-full max-w-6xl grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xl font-semibold mb-3">Main play UI</h2>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
            <p className="text-slate-700">Flight deck controls</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleBoost}
                className="rounded bg-blue-700 px-3 py-2 text-white hover:bg-blue-600"
              >
                Boost
              </button>
              <button
                type="button"
                onClick={handleRecharge}
                className="rounded bg-slate-700 px-3 py-2 text-white hover:bg-slate-600"
              >
                Recharge
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
          <h2 className="text-xl font-semibold">Status panel</h2>
          <p>
            Energy: <strong>{energy}</strong>/3
          </p>
          <p className="text-sm text-slate-700">{status}</p>
        </div>
      </section>
    </main>
  );
}
