/* eslint-disable chagra-i18n/no-hardcoded-spanish */
import { newId } from '../utils/id.js';
import { useEffect, useReducer, useRef, useState } from 'react';
import Angelita from '../visual/agente/Angelita.jsx';
import { factoryReducer, initialFactoryState, STAGES, STAGE_MESSAGES, SAMPLE_TRANSCRIPT, formatDuration, summarize } from './applicationFactoryMock.js';
import './fabricaAplicacionesVoz.css';

const REST_MESSAGES = {
  borrador: 'Cuéntame esa aplicación que tienes en la cabeza. Podemos empezar con tu idea escrita o una voz de ejemplo.',
  listo: 'Esto es lo que entendí en la simulación. Puedes corregirlo antes de lanzar.',
  confirmacion: 'Tú decides. Solo al confirmar se descuenta un shot de demostración.',
  resultado: 'Aquí está el ejemplo. Es una vista preparada para explorar cómo sería la entrega.',
  cancelado: 'Cancelado. Puedes volver a preparar tu idea.',
  error: 'Algo falló en la simulación. Conservé tu texto para que puedas intentarlo de nuevo.',
  agotado: 'No quedan shots de demostración. Reinicia la demo para volver a explorar.',
};
const avatarState = (phase) => phase === 'escuchando' ? 'escuchando'
  : ['transcribiendo', 'entendiendo', 'planeando', 'construyendo', 'probando'].includes(phase) ? 'pensando'
  : ['error', 'agotado'].includes(phase) ? 'preocupada'
  : ['listo', 'resultado', 'entregando', 'confirmacion'].includes(phase) ? 'respondiendo' : 'acompana';

export default function FabricaAplicacionesVoz() {
  const [state, dispatch] = useReducer(factoryReducer, undefined, initialFactoryState);
  const [quiet, setQuiet] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [speechError, setSpeechError] = useState('');
  const dialog = useRef(null);
  const launch = useRef(null);
  const speechAvailable = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  const busy = STAGES.includes(state.phase);
  const message = STAGE_MESSAGES[state.phase] || REST_MESSAGES[state.phase];

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setQuiet(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (state.phase === 'escuchando') {
      const started = Date.now();
      const timer = setInterval(() => dispatch({ type: 'clock', seconds: Math.floor((Date.now() - started) / 1000) }), 250);
      return () => clearInterval(timer);
    }
    if (STAGES.includes(state.phase)) {
      const timer = setTimeout(() => dispatch({ type: 'advance' }), 1600);
      return () => clearTimeout(timer);
    }
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === 'confirmacion') dialog.current.showModal();
    else if (dialog.current.open) {
      dialog.current.close();
      launch.current?.focus();
    }
  }, [state.phase]);

  useEffect(() => () => window.speechSynthesis?.cancel(), [state.phase]);

  function speak() {
    setSpeechError('');
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(`Simulación. ${message} ${state.error || ''}`);
    utterance.lang = 'es-CO';
    utterance.onerror = () => setSpeechError('No se pudo leer el estado. Puedes leerlo en pantalla.');
    window.speechSynthesis.speak(utterance);
  }

  return (
    <main className="factory-voice" lang="es" data-phase={state.phase} data-reduced-motion={quiet}>
      <div className="fv-shell">
        <header className="fv-header">
          <div><p className="fv-eyebrow">CHAGRA / LABORATORIO DE IDEAS</p><h1>Crear aplicación</h1></div>
          <div className="fv-shots"><span aria-hidden="true">✳</span><strong aria-live="polite">{state.shots} {state.shots === 1 ? 'shot' : 'shots'}</strong><small>de demostración</small></div>
        </header>
        <div className="fv-notice"><span className="fv-dot" aria-hidden="true" /><strong>Mockup navegable</strong><span>Todo el recorrido es simulado. Tú tienes la última palabra.</span></div>

        <div className="fv-workspace">
          <section className="fv-companion" aria-labelledby="fv-companion-title">
            <p className="fv-eyebrow">01 / LA IDEA EMPIEZA CONTIGO</p>
            <h2 id="fv-companion-title">De tu voz<br />a algo <em>posible.</em></h2>
            <div className="fv-portrait">
              <span className="fv-orbit" aria-hidden="true" />
              <Angelita estado={avatarState(state.phase)} size={250} animated={!quiet} />
            </div>
            <div className="fv-signature"><strong>Angelita</strong><span>Tu compañera, en Tinta</span></div>
            <div className="fv-bubble"><p role="status" aria-live="polite" aria-atomic="true"><strong className="fv-state">{state.phase} · simulado</strong>{message}</p></div>
            <button className="fv-text-button" onClick={speak} disabled={!speechAvailable}><span aria-hidden="true">◖ </span>Oír estado actual</button>
            {!speechAvailable && <small>Lectura en voz no disponible en este navegador. Los estados se anuncian al lector de pantalla.</small>}
            {speechError && <p role="alert">{speechError}</p>}
          </section>

          <section className="fv-editor" aria-labelledby="fv-idea-title">
            <div className="fv-section-heading"><h2 id="fv-idea-title">Cuéntame qué quieres crear</h2><span>02 / TU ENCARGO</span></div>
            <p>Para quién es, qué necesita hacer y cómo te gustaría usarla.</p>
            <div className="fv-recorder">
              <div className="fv-record-top"><strong>Voz de ejemplo</strong><span className="fv-tag">SIMULADA</span></div>
              <div className="fv-record-center">
                <button className="fv-record-button" disabled={busy && state.phase !== 'escuchando' || state.phase === 'agotado'} onClick={() => dispatch({ type: state.phase === 'escuchando' ? 'stop' : 'record' })} aria-label={state.phase === 'escuchando' ? 'Terminar voz simulada' : 'Iniciar voz simulada'}>
                  <span aria-hidden="true">{state.phase === 'escuchando' ? '■' : '●'}</span>
                </button>
                <div><strong className="fv-clock" aria-label={`Duración simulada ${formatDuration(state.elapsed)}, máximo 4 minutos`}>{formatDuration(state.elapsed)} <span>/ 4:00</span></strong><p>{state.phase === 'escuchando' ? 'Escuchando en simulación…' : 'Pulsa para ensayar tu voz'}</p></div>
                <div className="fv-wave" aria-hidden="true">{[12, 22, 35, 18, 28, 42, 24, 16, 32, 20, 12].map((height, i) => <i key={i} style={{ height }} />)}</div>
              </div>
              <p className="fv-fine">No se usa el micrófono. Máximo visual: 4:00. El grabador productivo actual sigue limitado a 30 s.</p>
            </div>
            <div className="fv-label-row"><label htmlFor="fv-transcript">Transcripción editable</label><button className="fv-text-button" disabled={busy || state.phase === 'agotado'} onClick={() => dispatch({ type: 'edit', text: SAMPLE_TRANSCRIPT })}>Usar ejemplo</button></div>
            <textarea id="fv-transcript" value={state.transcript} disabled={busy || state.phase === 'agotado'} onChange={(e) => dispatch({ type: 'edit', text: e.target.value })} placeholder="Quiero una aplicación para…" rows={4} aria-describedby="fv-text-help" />
            <p id="fv-text-help" className="fv-fine">Puedes escribir directamente. La voz simulada carga un texto fijo.</p>
            <div className="fv-summary"><h3>Lo que entendí <span>· simulado</span></h3><p>{summarize(state.transcript) || 'Tu idea aparecerá aquí para que la revises.'}</p><small>Resumen literal del texto, sin interpretación de IA. La vista de entrega será un ejemplo fijo de pedidos.</small></div>
            {state.error && <p className="fv-error" role="alert">{state.error}</p>}
            {state.shots === 0 && !busy && !state.error && <p className="fv-error" role="status">Shots agotados. Reinicia la demo para volver a explorar.</p>}
            <button ref={launch} className="fv-launch" disabled={busy || !state.transcript.trim() || state.shots === 0} onClick={() => dispatch({ type: 'review' })}>Lanzar aplicación <span aria-hidden="true">↗</span></button>
            <p className="fv-launch-note">1 shot de demostración, solo al confirmar. Preparar tu idea no consume shots.</p>
            {busy && <button className="fv-cancel" onClick={() => dispatch({ type: 'cancel' })}>Cancelar simulación</button>}
          </section>
        </div>

        <section className="fv-journey" aria-labelledby="fv-journey-title">
          <div className="fv-section-heading"><h2 id="fv-journey-title">El recorrido de tu idea</h2><span>EVENTOS SIMULADOS</span></div>
          <ol>{STAGES.map((stage, index) => <li key={stage} aria-current={state.phase === stage ? 'step' : undefined} data-active={state.phase === stage}><span className="fv-step-number">{String(index + 1).padStart(2, '0')}</span><strong>{stage}</strong><small>simulado</small></li>)}</ol>
          <p className="fv-fine">La planeación empieza después de tu confirmación. Estos pasos no miden trabajo real.</p>
        </section>

        {state.result && <section className="fv-result" aria-labelledby="fv-result-title">
          <div><p className="fv-eyebrow">03 / ENTREGA SIMULADA</p><h2 id="fv-result-title">Una primera ventana<br />a tu aplicación.</h2><p>{state.result.limitations}</p><p className="fv-example-url">URL de ejemplo, no publicada:<br /><code>{state.result.exampleUrl}</code></p></div>
          <div className="fv-preview" role="region" aria-label="Preview local de ejemplo"><div className="fv-preview-bar">○ ○ ○ <span>PREVIEW SIMULADO</span></div><div className="fv-preview-content"><p className="fv-eyebrow">MI HUERTA</p><h3>Los pedidos de hoy</h3><p>Una muestra visual, sin datos reales.</p>{['Canasta de temporada', 'Hortalizas frescas', 'Hierbas de la huerta'].map((name, i) => <div className="fv-order" key={name}><span>{name}<small>Pedido de ejemplo 0{i + 1}</small></span><strong>{i === 0 ? 'Entregado' : 'Pendiente'}</strong></div>)}</div></div>
        </section>}

        <details className="fv-dev"><summary>Controles de demostración y contrato local</summary><div className="fv-dev-controls"><label><input type="checkbox" checked={state.fail} disabled={busy || state.phase === 'confirmacion'} onChange={(e) => dispatch({ type: 'scenario', fail: e.target.checked })} /> Simular error al construir</label><button disabled={busy} onClick={() => dispatch({ type: 'exhaust' })}>Simular shots agotados</button><button onClick={() => dispatch({ type: 'reset' })}>Reiniciar demo (3 shots)</button></div><p>Movimiento reducido: {quiet ? 'activo' : 'según preferencia del sistema'}. Eventos locales, todos marcados con simulated: true.</p><pre aria-label="Eventos del contrato local">{JSON.stringify(state.events, null, 2)}</pre></details>
        <footer className="fv-footer"><span>Una idea. Una conversación. Tu decisión.</span><span>PROTOTIPO / SIN FÁBRICA CONECTADA</span></footer>
      </div>
      <dialog ref={dialog} className="fv-dialog" aria-labelledby="fv-confirm-title" aria-describedby="fv-confirm-copy" onCancel={(e) => { e.preventDefault(); dispatch({ type: 'back' }); }}>
        <p className="fv-eyebrow">CONFIRMACIÓN / SIMULACIÓN</p><h2 id="fv-confirm-title">¿Lanzar esta aplicación?</h2><p id="fv-confirm-copy">Se descontará 1 shot de demostración. Quedarán {Math.max(0, state.shots - 1)}. Este recorrido no crea una aplicación real. Cancelar o fallar después de confirmar no devuelve el shot en esta demo.</p><blockquote>{summarize(state.transcript)}</blockquote><button autoFocus className="fv-cancel" onClick={() => dispatch({ type: 'back' })}>Volver a editar</button><button className="fv-launch" onClick={() => dispatch({ type: 'confirm', requestId: newId() })}>Confirmar y lanzar (1 shot)</button>
      </dialog>
    </main>
  );
}
