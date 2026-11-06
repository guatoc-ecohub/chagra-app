/* eslint-disable chagra-i18n/no-hardcoded-spanish -- selector existente trasladado sin cambios de copy. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Search } from 'lucide-react';
import { filterVeredaOptions } from '../services/veredaLookupService';

/** Selector inline que reutiliza el catálogo DANE y admite texto libre sin datos locales. */
export default function VeredaPicker({ vereda, opciones, onSelect, onFreeText }) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const filtradas = useMemo(() => filterVeredaOptions(opciones, query), [opciones, query]);
  const hasDataset = Array.isArray(opciones) && opciones.length > 0;

  useEffect(() => {
    if (editing) inputRef.current?.focus?.();
  }, [editing]);

  if (!editing) {
    return (
      <button type="button" onClick={() => { setQuery(''); setEditing(true); }} className="w-full flex items-center justify-between gap-2 text-left" data-testid="onb2-vereda-editar" aria-label={vereda ? `Vereda ${vereda}. Tocar para corregir` : 'Escoger vereda'}>
        <span className="text-base font-bold text-slate-100 truncate">{vereda || 'Sin vereda — tóquela para escogerla'}</span>
        <span className="shrink-0 w-9 h-9 rounded-lg grid place-items-center bg-slate-800 text-slate-300"><Pencil size={16} aria-hidden="true" /></span>
      </button>
    );
  }

  return (
    <div className="w-full">
      <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={hasDataset ? 'Busque su vereda…' : 'Escriba su vereda'} aria-label="Vereda de su finca" className="w-full pl-9 pr-3 py-2.5 text-base rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60" data-testid="onb2-vereda-input" />
      </div>
      {hasDataset ? <ul className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-700 divide-y divide-slate-800 bg-slate-900" data-testid="onb2-vereda-opciones">
        {filtradas.map((opcion) => <li key={opcion.codigo}><button type="button" onClick={() => { onSelect(opcion); setEditing(false); }} className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors" data-testid={`onb2-vereda-opcion-${opcion.codigo}`}>{opcion.nombre}</button></li>)}
        {filtradas.length === 0 && <li className="px-3 py-2.5 text-sm text-slate-500">Ninguna vereda coincide. Revise la escritura o toque abajo.</li>}
      </ul> : <p className="mt-1.5 text-xs text-slate-500">Aún no tenemos el mapa de veredas de este municipio. Escríbala como la conoce.</p>}
      <div className="mt-2 flex items-center gap-2">
        {!hasDataset && <button type="button" onClick={() => { if (query.trim()) onFreeText(query.trim()); setEditing(false); }} className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm font-bold text-white" data-testid="onb2-vereda-guardar-texto">Guardar</button>}
        <button type="button" onClick={() => setEditing(false)} className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200">Cancelar</button>
      </div>
    </div>
  );
}
