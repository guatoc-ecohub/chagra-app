/* eslint-disable chagra-i18n/no-hardcoded-spanish -- copy aprobado de las puertas campesinas. */
import { useState } from 'react';
import { BitacoraArt } from './PuertaArt';
import { DataNotice, LogEntries, ObservationButton, PuertaShell } from './PuertaShared';
import usePuertaData from './usePuertaData';
import { dayKey, kindOf, nameOf, normalizeSearch, recentDays, secondsOf, textOf } from './puertaData';

const kinds = [['all', 'Todo'], ['siembra', 'Siembras'], ['observacion', 'Observaciones'], ['labor', 'Labores y otros']];
const colors = { siembra: '#496c46', observacion: '#a2683f', labor: '#627d78' };
const heights = { siembra: 80, observacion: 158, labor: 235 };

export default function PuertaBitacora({ onNavigate }) {
  const data = usePuertaData();
  const [day, setDay] = useState(null);
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const [allHistory, setAllHistory] = useState(false);
  const days = recentDays(data.now);
  const dayOf = (log) => secondsOf(log) > 0 ? dayKey(new Date(secondsOf(log) * 1000)) : '';
  const week = data.logs.filter((log) => days.some((d) => d.key === dayOf(log)));
  const list = (allHistory ? data.logs : week).filter((log) => (day === null || dayOf(log) === days[day].key)
    && (kind === 'all' || kindOf(log) === kind)
    && normalizeSearch(`${nameOf(log)} ${textOf(log)} ${log.type}`).includes(normalizeSearch(query)));
  // Una marca por tipo y día evita superponer eventos: el número conserva el total.
  const marks = days.flatMap((d, i) => kinds.slice(1).flatMap(([id]) => {
    const matches = week.filter((log) => dayOf(log) === d.key && kindOf(log) === id);
    return matches.length ? [{ day: i, kind: id, count: matches.length, visible: matches.some((log) => list.includes(log)) }] : [];
  }));
  const reset = () => { setDay(null); setKind('all'); setQuery(''); setAllHistory(false); };
  return <PuertaShell door="bitacora" onNavigate={onNavigate} eyebrow="Cuaderno de labores / las huellas"
    title={<>Lo que hizo<br /><em>va dejando trama.</em></>} intro={<>Sembrar, mirar, cuidar.<br />Los apuntes se juntan sin borrar sus diferencias.</>}
    honesty={<><strong>Últimos siete días, hasta hoy</strong><span>Historial local. Cada apunte indica si aún espera sincronización o revisión.</span></>}>
    <DataNotice data={data} />
    <div className="spread"><section className="visual" aria-label="Trama de apuntes de la semana">
      <div className="book"><div className="book-head"><span>CUADERNO DE FINCA</span><span>{days[0].date.toLocaleDateString('es-CO')} / {days[6].date.toLocaleDateString('es-CO')}</span></div>
        <h2 className="book-title">Cada punto,<br />algo que quedó escrito.</h2><p className="small muted">Tres hilos. Siete días. Ningún silencio se rellena.</p>
        <BitacoraArt day={day}>{marks.map((mark) => <g key={`${mark.day}-${mark.kind}`} data-event-count={mark.count} opacity={mark.visible ? 1 : 0.16}><circle className="dot-event" cx={45 + mark.day * 90} cy={heights[mark.kind]} r="18" fill={colors[mark.kind]} /><text x={45 + mark.day * 90} y={heights[mark.kind] + 5} textAnchor="middle" fill="#fffdf6" fontSize="15">{mark.count}</text></g>)}</BitacoraArt>
        <div className="thread-key"><span>Siembra</span><span>Observación</span><span>Labores y otros</span></div>
        <nav className="day-tabs" aria-label="Leer un día">{days.map((d, i) => <button key={d.key} aria-label={d.date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })} aria-pressed={day === i} onClick={() => { setDay(i); setAllHistory(false); }}><span>{d.date.toLocaleDateString('es-CO', { weekday: 'short' })}</span>{d.date.getDate()}</button>)}</nav>
        <div className="gap-note"><span className="gap-icon" aria-hidden="true" /><span><strong>Un hueco es un hueco.</strong><br />Sin apuntes no significa que no pasó nada.</span></div>
      </div>
      <div className="book-actions"><div className="tally">{data.loading || data.error ? '—' : week.length}<small>apuntes esta semana</small></div><button onClick={reset}>Leer toda la semana →</button></div>
      <p className="small muted">Una marca agrupa los apuntes de un tipo y día. Su número indica cuántos. La curva no mide productividad ni salud.</p>
    </section><section className="sheet" aria-label="Lectura de los apuntes">
      <span className="eyebrow">{allHistory ? 'Todo el historial disponible' : day === null ? 'Toda la semana' : days[day].date.toLocaleDateString('es-CO')}</span><h2>Detrás de cada punto,<br />una historia.</h2>
      <div className="switch log-filters" aria-label="Filtrar por tipo">{kinds.map(([id, label]) => <button key={id} aria-pressed={kind === id} onClick={() => setKind(id)}>{label}</button>)}</div>
      <label htmlFor="puerta-log-search">Buscar en los apuntes</label><input id="puerta-log-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Por nombre o palabras del apunte" />
      <p className="week-stats" role="status">{data.loading || data.error ? 'Conteo no disponible' : `${list.length} apuntes visibles`}</p>
      <LogEntries now={data.now.getTime() / 1000} logs={list} loading={data.loading} failed={data.error} />
      <ObservationButton label="+ Escribir un apunte" onSaved={reset} />
      <button aria-pressed={allHistory} onClick={() => { setAllHistory(true); setDay(null); }}>Leer también los apuntes anteriores</button>
      <div className="note"><strong>Escrito no significa verificado.</strong><p>Una sugerencia de IA sigue pendiente hasta la revisión humana. Una tarea planeada no se presenta como realizada.</p></div>
      <button onClick={() => onNavigate('historial')}>Abrir historial y adjuntos</button>
    </section></div>
  </PuertaShell>;
}
