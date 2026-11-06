/** @param {{ onNavigate: (view: string, data?: { focusInput: boolean }) => void }} props */
export default function DashboardEntryActions({ onNavigate }) {
  return (
    <nav aria-label="Escribir en la finca" className="flex shrink-0 flex-wrap gap-2 p-3 bg-slate-950 text-slate-100">
      <button type="button" onClick={() => onNavigate('agente', { focusInput: true })} className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 border border-slate-600">Preguntar por escrito</button>
      <button type="button" onClick={() => onNavigate('sembrar', { focusInput: true })} className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 border border-slate-600">Anotar una siembra</button>
      <button type="button" onClick={() => onNavigate('cosechar')} className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 border border-slate-600">Anotar una cosecha</button>
    </nav>
  );
}
