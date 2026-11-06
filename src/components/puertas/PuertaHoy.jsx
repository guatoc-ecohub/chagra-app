/* eslint-disable chagra-i18n/no-hardcoded-spanish -- copy aprobado de las puertas campesinas. */
import { useState } from 'react';
import { HoyArt } from './PuertaArt';
import { DataNotice, LogEntries, ObservationButton, PuertaShell } from './PuertaShared';
import usePuertaData from './usePuertaData';
import { isRecorded, nameOf, needsReview, pendingTasks, refs } from './puertaData';

export default function PuertaHoy({ onNavigate }) {
  const data = usePuertaData();
  const [stop, setStop] = useState(0);
  const tasks = pendingTasks(data.logs, data.now.getTime() / 1000);
  const suggestions = data.logs.filter(needsReview);
  const recent = data.logs.filter((log) => isRecorded(log, data.now.getTime() / 1000)).slice(0, 5);
  const task = tasks[0];
  const linked = task ? [...data.plants, ...data.lands].filter((asset) => refs(task, 'asset').some((ref) => ref.id === asset.id)) : [];
  return <PuertaShell door="hoy" onNavigate={onNavigate} eyebrow="Hoy en finca / el recorrido"
    title={<>El día empieza<br /><em>mirando.</em></>}
    intro={<>Tres paradas para volver a su finca.<br />Una cosa a la vez, con espacio para lo que encuentre.</>}
    honesty={<><strong>Recorrido con sus apuntes</strong><span>El sol es ilustrativo. Consulte el clima y las alertas en la agenda.</span></>}>
    <DataNotice data={data} />
    <div className="spread" data-stop={stop}><section className="visual" aria-label="Recorrido ilustrado de la finca">
      <div className="day-art"><HoyArt /></div>
      <div className="day-caption"><div><span className="eyebrow">{data.now.toLocaleDateString('es-CO')}</span><br /><strong>Su próxima parada</strong></div><span className="stamp">Mirar<br />antes de actuar</span></div>
      <nav className="stepper" aria-label="Paradas del recorrido">{['Huerta', 'Patio', 'Cuaderno'].map((label, i) => <button key={label} aria-pressed={stop === i} onClick={() => setStop(i)}><b>0{i + 1}</b>{label}</button>)}</nav>
      <p className="small muted">El dibujo orienta el recorrido. No representa ubicación, clima ni hora reales.</p>
    </section><section className="sheet" aria-label="Detalle de la parada">
      <div className="label-row"><span className="eyebrow">Lo que toca revisar</span><span className="small">{!data.loading && !data.error ? `${tasks.length} tareas con fecha hasta esta semana` : 'Tareas sin confirmar'}</span></div>
      <span className="task-index">0{stop + 1}</span>
      <h2 className="task-title">{stop === 0 ? task ? nameOf(task) : 'Volver a mirar la huerta.' : stop === 1 ? 'Pasar por el patio.' : 'Cerrar el cuaderno.'}</h2>
      {stop === 0 ? <>
        <p>{data.hydrated && !data.assetError ? `${data.plants.length} registros de plantas para orientar la visita.` : 'Falta leer el inventario de plantas.'} Las tareas se ordenan por fecha registrada, sin calcular un diagnóstico.</p>
        <LogEntries now={data.now.getTime() / 1000} logs={tasks} loading={data.loading} failed={data.error} empty="No hay tareas pendientes con fecha hasta esta semana en los registros disponibles. Esto no significa que no haya labores por hacer." />
        {suggestions.length > 0 && <div className="note"><strong>{suggestions.length} sugerencias de IA por revisar</strong><p>No cuentan como labores realizadas ni como estado de sus plantas.</p></div>}
        <button className="wide" onClick={() => onNavigate('activos')}>Ver mis plantas</button>
      </> : stop === 1 ? <><p>Revise qué cambió desde la última visita. La ausencia de un apunte no indica que estén bien ni que estén mal.</p><a className="puerta-link" href="#/puertas/animales">Abrir el patio →</a></> : <LogEntries now={data.now.getTime() / 1000} logs={recent} loading={data.loading} failed={data.error} />}
      <div className="note"><strong>Mirar no resuelve una señal.</strong><p>Una visita puede dejar dudas. Regístrelas sin convertirlas en diagnósticos.</p></div>
      <ObservationButton assets={stop === 0 ? linked : []} context={stop === 0 && task ? nameOf(task) : ['Recorrido por la huerta', 'Recorrido por el patio', 'Cierre del recorrido'][stop]} label="Anotar esta visita →" />
    </section></div>
    <div className="bottom"><article><div className="eyebrow">Lo urgente no se adivina</div><h3>Las alertas necesitan contexto.</h3><p>La agenda existente reúne clima, alertas y labores del ciclo. Aquí se muestran las tareas que ya quedaron anotadas.</p><button onClick={() => onNavigate('hoy_finca')}>Consultar clima y agenda</button></article><article><div className="eyebrow">El cierre del día</div><h3>Que lo visto no se pierda.</h3><p>Sus observaciones quedan en la bitácora. Guardar una visita no marca una tarea como terminada.</p><a className="puerta-link" href="#/puertas/bitacora">Leer la bitácora →</a></article></div>
  </PuertaShell>;
}
