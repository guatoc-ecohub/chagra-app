/* eslint-disable chagra-i18n/no-hardcoded-spanish -- copy aprobado de las puertas campesinas. */
import { useRef, useState } from 'react';
import { savePuertaObservation } from '../../services/puertaObservation';
import { dateLabel, logTypeLabel, nameOf, needsReview, secondsOf, statusOf, textOf } from './puertaData';
import './puertas.css';

const doors = [['hoy', 'Hoy'], ['animales', 'Animales'], ['zonas', 'Mis zonas'], ['bitacora', 'Cuaderno']];
export function PuertaShell({ door, title, eyebrow, intro, honesty, children, onNavigate }) {
  return <div className={`puerta puerta-${door}`} data-testid={`puerta-${door}`}>
    <a className="skip" href="#puerta-main" onClick={(event) => { event.preventDefault(); document.getElementById('puerta-main')?.focus(); }}>Saltar al contenido</a>
    <header><span className="brand">chagra</span><span className="crumb">Mi finca / {eyebrow}</span><button onClick={() => onNavigate('dashboard')}>Volver a mi finca</button></header>
    <main id="puerta-main" tabIndex={-1}>
      <div className="intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div><p>{intro}</p></div>
      <div className="honesty">{honesty}</div>
      {children}
    </main>
    <footer><span>Registros disponibles en este dispositivo.<br />Una señal invita a mirar, no es un diagnóstico.</span><nav className="footer-links" aria-label="Otras puertas">
      {doors.map(([id, label]) => <a key={id} href={`#/puertas/${id}`} aria-current={door === id ? 'page' : undefined}>{label}</a>)}
    </nav></footer>
  </div>;
}

export function DataNotice({ data }) {
  if (data.loading || (!data.hydrated && !data.assetError)) return <p role="status">Leyendo los registros de su finca…</p>;
  if (data.error || data.assetError) return <p role="alert">No se pudieron leer todos los registros. Los datos que faltan no cuentan como cero. Intente abrir de nuevo.</p>;
  return null;
}

function logStateLabel(log, now) {
  if (needsReview(log)) return 'Sugerencia de IA, pendiente de revisión humana';
  if (secondsOf(log) <= 0) return 'Fecha faltante, por revisar';
  if (secondsOf(log) > now) return 'Fecha futura, por revisar';
  return { done: 'Registro realizado', pending: 'Actividad pendiente', urgent: 'Actividad pendiente',
    in_progress: 'Actividad en curso', blocked: 'Actividad bloqueada', cancelled: 'Actividad cancelada' }[statusOf(log)] || 'Estado por revisar';
}

export function LogEntries({ logs, now, loading = false, failed = false, empty = 'No hay apuntes en esta selección. El silencio no demuestra falta de actividad.' }) {
  // DataNotice comunica las lecturas pendientes o fallidas. Solo una lectura
  // confirmada puede producir el estado vacío de esta lista.
  if (loading || failed) return null;
  return <div className="puerta-entries">{logs.length ? logs.map((log) => <article key={log.id} className="log recorded" data-log-id={log.id}>
    <small>{dateLabel(secondsOf(log))} · {logTypeLabel(log)} · {logStateLabel(log, now)}{log._pending ? ' · Pendiente de sincronización' : ''}</small>
    <h3>{nameOf(log)}</h3><p>{textOf(log)}</p>
  </article>) : <p className="log-empty">{empty}</p>}</div>;
}

/** @param {{assets?: object[], context?: string, label?: string, disabled?: boolean, onSaved?: () => void}} props */
export function ObservationButton({ assets = [], context = '', label = 'Anotar lo que vi →', disabled = false, onSaved }) {
  const dialog = useRef(null);
  const textarea = useRef(null);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const save = async (event) => {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await savePuertaObservation({ text: textarea.current.value, assets, context });
      setStatus('Apunte guardado en este dispositivo. Pendiente de sincronización. Las señales siguen pendientes de revisión.');
      dialog.current.close();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar. Su texto sigue aquí para reintentar.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return <>
    <button className="primary wide" disabled={disabled} onClick={() => { textarea.current.value = ''; setError(''); dialog.current.showModal(); }}>{label}</button>
    <p className="status" role="status">{status}</p>
    <dialog ref={dialog} aria-label={`Anotar: ${context || 'su finca'}`} onCancel={(event) => { if (busy) event.preventDefault(); }}>
      <div className="dialog-head"><span className="eyebrow">Cuaderno de finca</span><button disabled={busy} onClick={() => dialog.current.close()}>Cerrar ×</button></div>
      <h2>¿Qué encontró?</h2><p>{context || 'Puede anotar aunque no tenga una zona.'}</p>
      <form onSubmit={save}><label>Escriba lo que observó<textarea ref={textarea} required maxLength={2000} placeholder="Describa lo que vio, sin adivinar la causa." /></label>
        <p className="small">Se guarda como una observación de hoy. Anotar no cierra tareas ni confirma sugerencias de IA.</p>
        {error && <p role="alert">{error}</p>}<button className="primary wide" disabled={busy} type="submit">{busy ? 'Guardando…' : 'Guardar apunte'}</button>
      </form>
    </dialog>
  </>;
}
