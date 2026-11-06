import React, { useState } from 'react';
import { ArrowRight, Sprout } from 'lucide-react';

/** Choose the farm group that scopes this authenticated session. */
export default function FincaGroupSelector({ groups, onSelect, loading = false }) {
  const [selectedId, setSelectedId] = useState('');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/85 px-4 py-8 backdrop-blur-md">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="finca-selector-title"
        aria-describedby="finca-selector-description"
        className="w-full max-w-lg rounded-[2rem] border border-emerald-300/20 bg-slate-900 p-6 text-slate-100 shadow-[0_24px_100px_rgba(0,0,0,0.55)] sm:p-8"
      >
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
          <Sprout aria-hidden="true" size={24} />
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Su espacio de trabajo</p>
        <h1 id="finca-selector-title" className="text-2xl font-black tracking-tight sm:text-3xl">¿En cuál finca va a trabajar?</h1>
        <p id="finca-selector-description" className="mt-3 text-sm leading-6 text-slate-300">
          Su elección define los datos que verá en esta sesión.
        </p>
        <div className="mt-6 space-y-3" role="radiogroup" aria-label="Fincas disponibles">
          {groups.map((group) => {
            const checked = selectedId === group.id;
            return (
              <button
                key={group.id}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setSelectedId(group.id)}
                className={`flex min-h-16 w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${checked ? 'border-emerald-300/70 bg-emerald-300/10' : 'border-slate-700 bg-slate-950/50 hover:border-slate-500'}`}
              >
                <span>
                  <span className="block font-bold text-slate-50">{group.name}</span>
                  <span className="mt-1 block text-xs text-slate-400">{group.members.length} {group.members.length === 1 ? 'miembro' : 'miembros'}</span>
                </span>
                <span aria-hidden="true" className={`h-4 w-4 rounded-full border ${checked ? 'border-[5px] border-emerald-300' : 'border-slate-500'}`} />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!selectedId || loading}
          onClick={() => onSelect(selectedId)}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 font-bold text-slate-950 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? 'Abriendo su finca…' : 'Continuar'}
          {!loading && <ArrowRight aria-hidden="true" size={18} />}
        </button>
      </section>
    </div>
  );
}
