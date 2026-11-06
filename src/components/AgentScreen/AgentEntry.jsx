import { useEffect, useMemo, useState } from 'react';
import useChatDraft from './useChatDraft';
import usePrefsStore from '../../store/usePrefsStore';

/** @param {Parameters<typeof import('./AgentScreen').default>[0]} props */
export default function AgentEntry({ initialContext, ...props }) {
  /** @type {[typeof import('./AgentScreen').default | null, import('react').Dispatch<import('react').SetStateAction<typeof import('./AgentScreen').default | null>>]} */
  const [Screen, setScreen] = useState(null);
  const operatorId = usePrefsStore(state => state.operatorId) || 'default-operator';
  const [draft, setDraft] = useChatDraft('', operatorId);
  const [hadFocus, setHadFocus] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const context = useMemo(() => hadFocus ? { ...initialContext, focusInput: true } : initialContext, [hadFocus, initialContext]);

  useEffect(() => {
    let active = true;
    import('./AgentScreen').then(module => {
      if (active) setScreen(() => module.default);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [attempt]);

  if (Screen) return <Screen {...props} initialContext={context} initialDraft={draft} />;

  return (
    <section data-agent-entry-loading className="flex h-full min-h-0 flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-700 p-3">
        <button type="button" aria-label="Volver" onClick={props.onBack}
          className="min-h-[44px] rounded-xl border border-slate-600 px-4">← Volver</button>
        <strong>Chagra</strong>
      </header>
      <div className="flex flex-1 flex-col justify-end gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p role="status" className="text-sm text-slate-300">
          {failed ? 'La conversación no abrió. Puede seguir escribiendo y reintentar.' : 'Abriendo la conversación. Puede ir escribiendo su pregunta.'}
        </p>
        {failed && <button type="button" className="min-h-[44px] rounded-xl border border-slate-600 px-4"
          onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Reintentar</button>}
        <label className="font-semibold" htmlFor="agent-entry-draft">Su pregunta</label>
        <textarea id="agent-entry-draft" aria-label="Escriba su mensaje para Chagra" rows={4}
          autoFocus={initialContext?.focusInput === true} value={draft}
          onFocus={() => setHadFocus(true)} onChange={event => setDraft(event.target.value)}
          className="min-h-[100px] resize-y rounded-2xl border border-slate-600 bg-slate-900 p-4 text-base text-slate-100 focus:outline-2 focus:outline-emerald-400" />
      </div>
    </section>
  );
}
