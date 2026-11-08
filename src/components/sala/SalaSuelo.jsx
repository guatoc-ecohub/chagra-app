/* eslint-disable chagra-i18n/no-hardcoded-spanish */
import { useEffect, useMemo, useState } from 'react';
import { Camera, Check, ImagePlus } from 'lucide-react';
import { LECTURAS_CAMPO } from '../../data/lecturaSuelo';
import SOIL_DATA from '../../data/soil-diagnostics.json';
import { newId } from '../../utils/id';
import { mediaCache } from '../../db/mediaCache';
import useAssetStore from '../../store/useAssetStore';
import { logCache } from '../../db/logCache';
import { guardarObservacionSuelo } from './guardarObservacionSuelo';
import { HojaHomeA } from '../esquema/HojaHomeA';
import SalaCurso from './SalaCurso';
import DescensoLaunch from '../DescensoLaunch.jsx';

const encalado = SOIL_DATA.enmiendas.find((item) => item.id === 'cal_dolomitica');
const fechaRegistro = (timestamp) => {
  const value = Number(timestamp);
  const date = new Date(Number.isFinite(value) && value > 0 ? (value < 1e12 ? value * 1000 : value) : timestamp);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleDateString('es-CO');
};
const esDiagnosticoSuelo = (log) => log.type === 'log--observation'
  && log.attributes?.name === 'Diagnóstico del suelo';
const palabrasLectura = [
  [['Calicata', 'Pequeña excavación que deja ver las capas del suelo.'], ['Estructura', 'Forma en que se agrupan las partículas del suelo.']],
  [['Color del suelo', 'Pista que puede relacionarse con materia orgánica, humedad y minerales.'], ['Hojarasca', 'Capa de hojas y otros restos vegetales sobre el suelo.']],
  [['Olor terroso', 'Aroma habitual de un suelo húmedo con actividad biológica.'], ['Poros', 'Espacios por donde circulan aire y agua en el suelo.']],
  [['Infiltración', 'Paso del agua desde la superficie hacia el suelo.'], ['Escorrentía', 'Agua que corre por la superficie cuando no alcanza a infiltrarse.']],
];
/** @type {Array<{ title: string, body: string, good: string, caution: string, detail?: string, words: Array<Array<string>>, quiz: Array<{ question: string, answer: string }>, sources: Array<string> }> } */
const estaciones = [
  ...LECTURAS_CAMPO.map((item, index) => ({
    title: item.titulo,
    body: item.como,
    good: item.buena,
    caution: item.alerta,
    words: palabrasLectura[index] || [['Suelo', 'Capa viva donde crecen las raíces.']],
    quiz: [{ question: '¿Qué observa en esta estación?', answer: `${item.buena} También compare con la señal de alerta: ${item.alerta}` }],
    sources: ['Lectura de suelo de Chagra (src/data/lecturaSuelo.js). Referencias recopiladas: IGAC, AGROSAVIA, CIPAV, FAO, SENA, USDA-NRCS, Cenicafé y Jaramillo 2002.'],
  })),
  {
    title: 'Lombrices y vida', body: 'Observe la vida que aparece en la palada. Si desea usar el test de mostaza, siga el protocolo y tenga en cuenta la humedad del suelo.',
    good: 'Las lombrices son una señal de actividad biológica.', caution: 'La sequía extrema o la inundación pueden hacer que bajen y no salgan.',
    words: [['Macrofauna', 'Animales pequeños que viven en el suelo y pueden verse a simple vista.']],
    quiz: [{ question: '¿No encontrar lombrices demuestra que no hay vida?', answer: 'No. La humedad influye y la prueba puede dar un falso negativo.' }],
    sources: ['AGROSAVIA, protocolo estándar de macrofauna del suelo, según soil-diagnostics.json.'],
  },
  {
    title: 'Acidez y encalado', body: 'La acidez se confirma con una medición de pH. La observación de plantas o una prueba casera no define por sí sola una dosis de cal.',
    good: 'Anote el resultado de una prueba confiable o del análisis que tenga.', caution: encalado.precaucion, detail: encalado.dosis_orientativa,
    words: [['pH', 'Medida de acidez o alcalinidad.'], ['Encalado', 'Aplicación de materiales calcáreos según diagnóstico y recomendación.']],
    quiz: [{ question: '¿Una observación visual basta para calcular cal?', answer: 'No. Revise un análisis de suelo y una recomendación sustentada.' }],
    sources: ['AGROSAVIA, protocolo estándar de laboratorio de suelos; AGROSAVIA y CENICAFÉ para materiales de encalado, según soil-diagnostics.json.'],
  },
];

export default function SalaSuelo({ onBack }) {
  const lands = useAssetStore((state) => state.lands);
  const addLog = useAssetStore((state) => state.addLog);
  const [index, setIndex] = useState(-1);
  const [answers, setAnswers] = useState({});
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prior, setPrior] = useState([]);
  const land = lands[0];
  const choices = useMemo(() => ['Sí lo vi', 'No lo vi', 'No estoy seguro'], []);

  useEffect(() => {
    let active = true;
    logCache.getAll().then((logs) => {
      if (active) setPrior(logs.filter(esDiagnosticoSuelo).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const begin = async () => {
    const logs = await logCache.getAll().catch(() => []);
    setPrior(logs.filter(esDiagnosticoSuelo).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))));
    setIndex(0);
  };

  const persist = async () => {
    if (saving) return;
    setSaving(true);
    const id = newId('log--observation');
    try {
      if (photo) await mediaCache.save(id, photo, { assetId: land?.id || null, mimeType: photo.type || 'image/*' });
      await guardarObservacionSuelo({ addLog, id, land, answers });
      setSaved(true);
      setPrior((existing) => [{ id, type: 'log--observation', timestamp: new Date().toISOString(), attributes: { name: 'Diagnóstico del suelo', notes: Object.entries(answers).map(([station, answer]) => `${station}: ${answer}`).join('\n') } }, ...existing]);
    } finally { setSaving(false); }
  };

  if (index < 0) return <HojaHomeA title="Las pruebas de su suelo" eyebrow="SALA DE CAMPO" onBack={onBack}><div className="sala sala--entry">
    <div className="sala__scene sala__scene--large" role="img" aria-label="Corte ilustrado del suelo con hojarasca, capa oscura, raíces y una lombriz"><svg viewBox="0 0 720 330" aria-hidden="true"><rect width="720" height="330" rx="18" fill="var(--ha-papel-2)"/><path d="M0 92 Q140 68 270 86 T520 78 T720 84 V330 H0Z" fill="var(--ha-suelo-superficie)"/><path d="M0 112 Q180 96 360 110 T720 101 V330 H0Z" fill="var(--ha-suelo-capa)"/><path d="M0 210 Q190 191 390 207 T720 198 V330 H0Z" fill="var(--ha-suelo-profundo)"/><path d="M0 282 Q170 264 350 282 T720 270 V330 H0Z" fill="var(--ha-suelo-roca)"/><path d="M170 102l-30-17 25 7 17-23 4 25 33-8-26 18 17 16-29-7-13 20-1-25-29 3zM244 103l-22-13 18 4 12-17 4 19 24-6-19 14 11 13-20-5-9 16-1-18-21 2z" fill="var(--ha-suelo-hojarasca)"/><path d="M360 110V53m0 30q-34-28-57-14m57-3q31-32 58-17M360 108v139m0-91q-33 16-49 48m48-26q32 12 45 48m-44-9q-18 22-18 48m25-44q22 20 24 42m-54-88q-28 6-42 25" fill="none" stroke="var(--ha-suelo-raiz)" strokeWidth="7" strokeLinecap="round"/><path d="M503 232c11-16 22 15 34-1s21 14 32-2" fill="none" stroke="var(--ha-suelo-lombriz)" strokeWidth="9" strokeLinecap="round"/><g fontFamily="sans-serif" fontSize="18" fontWeight="700" fill="var(--ha-suelo-etiqueta)"><rect x="20" y="22" width="128" height="32" rx="12" fill="var(--ha-suelo-rotulo)"/><text x="32" y="44">Hojarasca</text><rect x="20" y="127" width="138" height="32" rx="12" fill="var(--ha-suelo-rotulo)"/><text x="32" y="149">Capa oscura</text><rect x="425" y="35" width="112" height="32" rx="12" fill="var(--ha-suelo-rotulo)"/><text x="437" y="57">Raíces</text><rect x="565" y="229" width="105" height="32" rx="12" fill="var(--ha-suelo-rotulo)"/><text x="577" y="251">Lombriz</text></g></svg><span>Una vuelta por el suelo de su finca</span></div>
    <p className="sala__eyebrow">OBSERVE · COMPARE · ANOTE</p><p>Recorra las lecturas de campo, paso a paso. Puede hacerlo sin señal y guardar lo que observó en su finca.</p>
    <DescensoLaunch slug="suelo" />
    <DescensoLaunch slug="arvenses" />
    <DescensoLaunch slug="micorrizas" />
    <DescensoLaunch slug="erosion-ladera" />
    <div className="sala__prior"><b>Diagnósticos anteriores</b>{prior.length ? prior.map((entry) => <p key={entry.id}>{fechaRegistro(entry.timestamp)} · {entry.attributes?.name || 'Diagnóstico del suelo'}</p>) : <p>Al volver verá aquí sus registros anteriores.</p>}</div>
    <button className="sala__primary sala__start" onClick={begin}>Empezar la sala</button>
  </div></HojaHomeA>;

  if (index >= estaciones.length) return <HojaHomeA title="Hágalo en su finca" eyebrow="ÚLTIMA ESTACIÓN" onBack={onBack}><div className="sala sala--entry"><DescensoLaunch slug="suelo" /><p>Marque lo que vio hoy. La observación queda como un registro, no cambia los datos de su lote.</p>
    {estaciones.map((station) => <label className="sala__answer" key={station.title}><span>{station.title}</span><select value={answers[station.title] || ''} onChange={(event) => setAnswers({ ...answers, [station.title]: event.target.value })}><option value="">Elija una respuesta</option>{choices.map((choice) => <option key={choice}>{choice}</option>)}</select></label>)}
    <label className="sala__photo"><Camera size={21}/><span>{photo ? photo.name : 'Tomar o elegir una foto'}</span><input type="file" accept="image/*" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] || null)}/><ImagePlus size={20}/></label>
    {!land && <p className="sala__notice">No hay zonas creadas. El registro se guardará en la finca activa.</p>}
    {saved && <p className="sala__success"><Check size={18}/>Guardado en la bitácora de su finca.</p>}
    <div className="sala__pager"><button className="sala__secondary" onClick={() => setIndex(estaciones.length - 1)}>Anterior</button><button className="sala__primary" disabled={saving || saved} onClick={persist}>{saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar en mi finca'}</button></div>
    <section className="sala__prior"><h3>Diagnósticos anteriores</h3>{prior.map((entry) => <p key={entry.id}>{fechaRegistro(entry.timestamp)} · {entry.attributes?.name || 'Diagnóstico del suelo'}</p>)}</section>
  </div></HojaHomeA>;

  const station = estaciones[index];
  return <SalaCurso title="Las pruebas de su suelo" onBack={onBack} station={station} index={index} total={estaciones.length + 1} last={index === estaciones.length - 1} onPrevious={() => setIndex(index - 1)} onNext={() => setIndex(index === estaciones.length - 1 ? estaciones.length : index + 1)} words={station.words} quiz={station.quiz} sources={station.sources}>
    <article className="sala__card"><p className="sala__eyebrow">MIRE EN SU LOTE</p><h2>{station.title}</h2><p>{station.body}</p>{station.detail && <><h3>Orientación del catálogo</h3><p>{station.detail}</p></>}<h3>Buena señal</h3><p>{station.good}</p><h3>Señal para mirar con cuidado</h3><p>{station.caution}</p></article>
  </SalaCurso>;
}
