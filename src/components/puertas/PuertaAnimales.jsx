/* eslint-disable chagra-i18n/no-hardcoded-spanish -- copy aprobado de las puertas campesinas. */
import { useEffect, useState } from 'react';
import { listFarmProcesses } from '../../db/farmProcessCache';
import { AnimalesArt } from './PuertaArt';
import { ObservationButton, PuertaShell } from './PuertaShared';

const groups = ['Gallinas', 'Cerdos', 'Colmenas'];
export default function PuertaAnimales({ onNavigate }) {
  const [group, setGroup] = useState(0);
  const [processes, setProcesses] = useState({ loading: true, error: false, list: [] });
  useEffect(() => {
    let alive = true;
    let revision = 0;
    const refresh = async () => {
      const current = ++revision;
      try {
        const list = await listFarmProcesses({ process_type: 'pigs', status: 'active' });
        if (alive && current === revision) setProcesses({ loading: false, error: false, list });
      } catch {
        if (alive && current === revision) setProcesses({ loading: false, error: true, list: [] });
      }
    };
    refresh();
    const events = ['farmProcessChanged', 'syncCompleted', 'focus', 'tenantChanged'];
    events.forEach((event) => window.addEventListener(event, refresh));
    return () => { alive = false; events.forEach((event) => window.removeEventListener(event, refresh)); };
  }, []);
  return <PuertaShell door="animales" onNavigate={onNavigate} eyebrow="Animales / la presencia"
    title={<>El patio también<br /><em>tiene voz.</em></>} intro={<>Primero, volver a verlos.<br />Después, dejar escrito qué cambió.</>}
    honesty={<><strong>Inventario animal incompleto</strong><span>Seguimientos de cerdos disponibles. Sin conteo conectado de gallinas ni colmenas.</span></>}>
    <div className="spread"><section className="visual" aria-label="Patio ilustrado de animales">
      <div className="patio" data-group={group}><AnimalesArt /><span className="patio-caption">Ilustración. No demuestra presencia ni estado de salud.</span></div>
      <nav className="animal-tabs" aria-label="Elegir grupo">{groups.map((name, i) => <button key={name} aria-pressed={group === i} onClick={() => setGroup(i)}><strong>—</strong>{name}</button>)}</nav>
      <p className="inventory-note">Sin un conteo actual no mostramos cantidades. Un seguimiento porcino no equivale a un animal y una colmena no equivale a una abeja.</p>
    </section><section className="sheet" aria-label="Observación del grupo">
      <span className="eyebrow">A quién va a mirar</span><h2>{groups[group]}</h2><div className="ledger-count">— <span>sin inventario actual conectado</span></div>
      <div className="animal-state"><strong>Falta una observación con contexto.</strong><p>La ilustración no demuestra que haya animales en su finca. Sin registros no sabemos cómo están.</p></div>
      {group === 1 && <div className="animal-entry" role="status">{processes.loading ? 'Leyendo seguimientos…' : processes.error ? 'No se pudieron leer los seguimientos porcinos.' : <><strong>{processes.list.length} seguimientos porcinos activos</strong><ul>{processes.list.map((p) => <li key={p.id}>{p.attributes?.subject_label || 'Seguimiento sin nombre'}</li>)}</ul><p>Son ciclos registrados, no un censo ni una evaluación sanitaria.</p></>}</div>}
      <p className="care-question">¿Qué vio al volver?</p>
      <ObservationButton key={group} context={`Patio: ${groups[group]}`} label="Dejar una observación →" />
      <p className="small muted">Apunte general en la bitácora. Todavía no se vincula a un animal o colmena individual.</p>
      <div className="note"><strong>Sin datos nunca significa sin problemas.</strong><p>Faltan identificación, movimientos y contexto sanitario. Observar y anotar no equivale a diagnosticar.</p></div>
      <button onClick={() => onNavigate(group === 1 ? 'seguimiento_cerdos' : group === 0 ? 'animales_gallinas' : 'animales_abejas')}>{group === 1 ? 'Abrir seguimiento de cerdos' : 'Abrir módulo existente'}</button>
    </section></div>
  </PuertaShell>;
}
