import { useEffect, useMemo } from 'react';
import { ArrowRight, Check, LockKeyhole, Sprout } from 'lucide-react';
import { HojaHomeA } from '../esquema/HojaHomeA';
import useAssetStore from '../../store/useAssetStore';
import { useLogStore } from '../../store/useLogStore';
import { getProfile } from '../../services/userProfileService';
import { evaluarEvolucionFinca, getGliessmanLabel } from '../../services/fincaEvolutionService';
import indicatorsData from '../../data/agroecology-indicators.json';
import { calcularTramosCamino } from './caminoTransicionModel';
import './CaminoTransicion.css';

function Indicadores({ plants, logs }) {
  const processes = useMemo(() => plants.map((plant) => ({ process_id: plant.id, process_type: 'plant', status: 'active', current_stage: plant.attributes?.status })), [plants]);
  const observations = useMemo(() => logs.filter((log) => log.type === 'log--observation').map((log) => ({ observation_id: log.id, text: log.attributes?.notes || '', created_at: log.timestamp })), [logs]);
  const result = useMemo(() => evaluarEvolucionFinca({ processes, observations }), [processes, observations]);
  const groups = [indicatorsData.mesmis_5_atributos, indicatorsData.tape_10_elementos];
  const hasIndicatorData = result.metadata.mesmis_non_null_count + result.metadata.tape_non_null_count > 0;
  return <section className="camino-indicadores" aria-label="Indicadores de evolución">
    <div className="camino-indicadores__intro"><span>MEDICIÓN DE LA FINCA</span><strong>{hasIndicatorData ? `Nivel estimado · ${getGliessmanLabel(result.nivelGliessman)}` : 'Aún no hay datos'}</strong></div>
    {groups.map((items, index) => <div key={index} className="camino-indicadores__grupo"><h3>{index === 0 ? 'Sustentabilidad · MESMIS' : 'Agroecología · FAO'}</h3>{items.map((item) => {
      const score = index === 0 ? result.mesmis[item.id] : result.tape[item.id];
      return <div className="camino-indicador" key={item.id}><span>{item.nombre}</span><b>{score == null ? 'Sin datos aún' : `${score}/4`}</b></div>;
    })}</div>)}
  </section>;
}

/** @param {{ onNavigate?: (view: string) => void, onBack?: () => void, standalone?: boolean }} props */
export default function CaminoTransicion({ onNavigate, onBack, standalone = false }) {
  const plants = useAssetStore((state) => state.plants);
  const lands = useAssetStore((state) => state.lands);
  const structures = useAssetStore((state) => state.structures);
  const equipment = useAssetStore((state) => state.equipment);
  const materials = useAssetStore((state) => state.materials);
  const hydrate = useAssetStore((state) => state.hydrate);
  const logsByAsset = useLogStore((state) => state.logsByAsset);
  const loadLogsForAsset = useLogStore((state) => state.loadLogsForAsset);
  const profile = useMemo(() => getProfile(), []);
  useEffect(() => { hydrate(); }, [hydrate]);
  const assets = useMemo(() => [...plants, ...lands, ...structures, ...equipment, ...materials], [plants, lands, structures, equipment, materials]);
  useEffect(() => { assets.forEach((asset) => { if (!logsByAsset[asset.id]) loadLogsForAsset(asset.id); }); }, [assets, logsByAsset, loadLogsForAsset]);
  const logs = useMemo(() => Object.values(logsByAsset).flat(), [logsByAsset]);
  const data = { profile, plants, lands, logs };
  const stages = calcularTramosCamino(data);
  const content = <div className="camino-page" data-testid="camino-transicion">
    <header className="camino-cabecera">
      <div><p className="camino-kicker">SU FINCA, SU PROCESO</p><h2>Un camino que se abre con lo que usted registra</h2><p>Cada paso se confirma con datos de su finca.</p></div>
    </header>
    <ol className="camino-tramos">{stages.map((stage, index) => <li key={stage.id} className={`camino-tramo ${stage.done ? 'is-done' : ''} ${stage.locked ? 'is-locked' : ''}`}>
      <div className="camino-tramo__marca" aria-hidden="true">{stage.done ? <Check size={19} /> : stage.locked ? <LockKeyhole size={17} /> : <Sprout size={19} />}</div>
      <article><div className="camino-tramo__meta"><span>TRAMO {index + 1} DE 6</span><span>{stage.done ? `Hecho · ${stage.date}` : stage.locked ? 'Se abre al completar el anterior' : 'Abierto'}</span></div><h3>{stage.nombre}</h3><p className="camino-tramo__registro"><b>Se abre con:</b> {stage.registro}</p>
      {!stage.locked && <button type="button" onClick={() => onNavigate?.(stage.view)} aria-label={`Ir a registrar: ${stage.registro}`}>Ir a registrar <ArrowRight size={17} aria-hidden="true" /></button>}
      </article>
    </li>)}</ol>
    <details><summary>¿Qué es esto? Cómo va mejorando su finca</summary><p>Puede consultar las medidas de salud de su finca y su explicación.</p><Indicadores plants={plants} logs={logs} /></details>
  </div>;
  return standalone ? <HojaHomeA title="Camino de su finca" eyebrow="SU FINCA, SU PROCESO" onBack={onBack}>{content}</HojaHomeA> : content;
}
