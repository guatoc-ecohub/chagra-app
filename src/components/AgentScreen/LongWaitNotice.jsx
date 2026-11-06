// SPDX-License-Identifier: AGPL-3.0-only
import React, { useEffect, useState } from 'react';

/** The phase comes from the pipeline; elapsed time does not imply progress. */
export default function LongWaitNotice({ busy, phase, onNotify = undefined, prompt = '', onPhoto = undefined }) {
  if (busy) return <PendingTurnNotice phase={phase} onNotify={onNotify} prompt={prompt} onPhoto={onPhoto} />;
  // A fast failure must still leave a useful step, even without a live stream.
  return isPotatoQuestion(prompt) ? <div className="relative z-10 px-4 py-2 agent-bar-surface shrink-0"><FirstPhotoAction onPhoto={onPhoto} pending={false} /></div> : null;
}

function isPotatoQuestion(prompt) {
  return /\bgota\b/i.test(prompt) && /\bpapa\b/i.test(prompt);
}

function FirstPhotoAction({ onPhoto, pending }) {
  return <div className="mt-2 rounded-xl border border-amber-500/40 p-3 text-sm" data-testid="waiting-first-action">
    <p className="font-bold">{pending ? 'Primera acción mientras llega la respuesta' : 'Primera acción para revisar la planta'}</p>
    <p>Tome una foto nítida de la hoja afectada, por arriba y por debajo. Envíela para revisar qué está pasando antes de elegir qué aplicar.</p>
    {onPhoto && <button type="button" className="mt-2 min-h-[44px] rounded-lg bg-emerald-800 px-3 font-bold text-white" onClick={onPhoto}>Enviar una foto</button>}
  </div>;
}

function PendingTurnNotice({ phase, onNotify, prompt, onPhoto }) {
  const [visible, setVisible] = useState(false);
  const [actionVisible, setActionVisible] = useState(false);
  const [choice, setChoice] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 15000);
    const actionTimer = setTimeout(() => setActionVisible(true), 45000);
    return () => { clearTimeout(timer); clearTimeout(actionTimer); };
  }, []);
  if (!visible) return null;
  const activity = {
    transcribiendo: 'Estoy transcribiendo su audio.',
    entendiendo: 'Estoy preparando el contexto de su pregunta.',
    consultando: 'Estoy consultando el catálogo y las fuentes.',
    escribiendo: 'Estoy esperando o recibiendo la respuesta del modelo.',
  }[phase] || 'La consulta sigue en proceso.';
  return (
    <div className="relative z-10 px-4 py-2 text-xs agent-bar-surface shrink-0" data-testid="long-wait-notice">
      <p role="status">{activity} Su pregunta está guardada.</p>
      {actionVisible && isPotatoQuestion(prompt) && <FirstPhotoAction onPhoto={onPhoto} pending />}
      {choice === 'notify' ? (
        <p className="mt-1">Le avisaré al terminar. Mantenga Chagra abierta; el aviso también aparece aquí.</p>
      ) : (
        <div className="flex gap-2 mt-1">
          <button type="button" className="tap-target px-2 underline" onClick={() => setChoice('wait')}>Seguir esperando</button>
          <button type="button" className="tap-target px-2 underline" onClick={() => { setChoice('notify'); onNotify?.(); }}>Recibir aviso</button>
        </div>
      )}
      {choice === 'wait' && <p role="status">Sigo con la misma pregunta.</p>}
    </div>
  );
}
