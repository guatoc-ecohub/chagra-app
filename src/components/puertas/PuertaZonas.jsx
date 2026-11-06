/* eslint-disable chagra-i18n/no-hardcoded-spanish -- copy aprobado de las puertas campesinas. */
import { useState } from 'react';
import { ZonasArt } from './PuertaArt';
import { DataNotice, LogEntries, ObservationButton, PuertaShell } from './PuertaShared';
import usePuertaData from './usePuertaData';
import { dateLabel, isRecorded, logReferences, nameOf, plantsInZone, secondsOf, unplacedPlants } from './puertaData';

export default function PuertaZonas({ onNavigate }) {
  const data = usePuertaData();
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(0);
  const [showUnplaced, setShowUnplaced] = useState(false);
  const pageCount = Math.max(1, Math.ceil(data.lands.length / 3));
  const currentPage = Math.min(page, pageCount - 1);
  const shown = data.lands.slice(currentPage * 3, currentPage * 3 + 3);
  const zone = shown.find((land) => land.id === selected) || shown[0];
  const linked = zone ? plantsInZone(data.plants, zone.id) : [];
  const logs = zone ? data.logs.filter((log) => logReferences(log, zone.id)) : [];
  const latest = logs.find((log) => isRecorded(log, data.now.getTime() / 1000));
  const unplaced = unplacedPlants(data.plants, data.lands);
  const known = data.hydrated && !data.assetError;
  const choose = (land) => { setSelected(land.id); setShowUnplaced(false); };
  return <PuertaShell door="zonas" onNavigate={onNavigate} eyebrow="Mis zonas / el territorio"
    title={<>Un lugar para<br /><em>cada mirada.</em></>} intro={<>La finca se entiende de un vistazo.<br />Entre por el lugar que quiere recorrer.</>}
    honesty={<><strong>Croquis ilustrativo, sin escala</strong><span>Los nombres y vínculos son suyos. Posiciones, linderos y superficies no se representan aquí.</span></>}>
    <DataNotice data={data} />
    <div className="spread"><section className="visual" aria-label="Croquis interactivo">
      <div className="map-frame" data-zone={shown.findIndex((land) => land.id === zone?.id)}><ZonasArt /><div className="map-compass" aria-hidden="true">↑<small>Arriba del croquis</small></div>
        {shown.map((land, i) => <button key={land.id} className={`map-pin pin${i + 1}`} aria-label={`Ver zona ${nameOf(land)}`} aria-pressed={land.id === zone?.id} onClick={() => choose(land)}>{currentPage * 3 + i + 1}</button>)}
        {!zone && <div className="map-blank"><h2>{known ? 'Aún no hay zonas registradas.' : 'Falta leer sus zonas.'}</h2><p>Los dibujos no demuestran que estos lugares existan en su finca.</p></div>}
      </div>
      <nav className="zone-list" aria-label="Elegir una zona">{shown.map((land, i) => <button key={land.id} aria-pressed={land.id === zone?.id} onClick={() => choose(land)}><b>{currentPage * 3 + i + 1}</b>{nameOf(land)}</button>)}</nav>
      {pageCount > 1 && <div className="row"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anteriores</button><span>{currentPage + 1} / {pageCount}</span><button disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Siguientes</button></div>}
      <p className="small muted">Cada número permite elegir una zona. Su posición en este dibujo no indica dónde queda en la finca.</p><button onClick={() => onNavigate('mapa')}>Abrir el mapa de mi finca</button>
    </section><section className="sheet" aria-label="Detalle de la zona">
      <div className="eyebrow">Su territorio</div><h2>{zone ? nameOf(zone) : 'Falta registrar una zona'}</h2>
      <div className="metric"><strong>{known ? linked.length : '—'}</strong><span>registros de plantas vinculados</span></div>
      <div className="fact"><span>Superficie</span><strong>Consultar en el mapa</strong></div><div className="fact"><span>Último apunte realizado</span><strong>{data.loading ? 'Leyendo…' : data.error ? 'No se pudo leer' : latest ? dateLabel(secondsOf(latest)) : 'Sin registro'}</strong></div>
      <div className="note"><strong>El mapa no cuenta toda la finca.</strong><p>Una planta puede existir sin zona. Un apunte no cambia su ubicación ni demuestra su salud.</p></div>
      <ObservationButton key={zone?.id || 'empty'} assets={zone ? [zone] : []} context={zone ? nameOf(zone) : ''} disabled={!zone || !known} label="Anotar algo de este lugar →" />
      <LogEntries now={data.now.getTime() / 1000} logs={logs} loading={data.loading} failed={data.error} />
      <div className="unplaced"><b>{known ? unplaced.length : '—'}</b><strong>registros de plantas sin zona reconocida</strong><p>También son parte de la finca. Se incluyen referencias a zonas que ya no están disponibles.</p><button disabled={!known} onClick={() => setShowUnplaced(!showUnplaced)} aria-expanded={showUnplaced}>Ver plantas sin zona</button>
        {showUnplaced && <ul>{unplaced.map((plant) => <li key={plant.id}>{nameOf(plant)}</li>)}</ul>}
      </div>
    </section></div>
  </PuertaShell>;
}
