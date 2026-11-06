/* eslint-disable chagra-i18n/no-hardcoded-spanish */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, Check, CircleAlert, RefreshCw, Search, Sprout } from 'lucide-react';
import { getAllSpecies } from '../../db/catalogDB';
import { assetCache } from '../../db/assetCache';
import { logCache } from '../../db/logCache';
import { derivePhotoCoverage } from './campoMision';
import './mision-campo.css';

const EXPECTED_CATALOG_TOTAL = 742;
const DEFAULT_CATALOG_LIMIT = 24;
const loadCatalogSpecies = getAllSpecies;
const loadObservationLogs = () => logCache.getByType('log--observation');
const loadPlants = () => assetCache.getByType('plant');

const displayName = (species) => species.nombre_comun || species.nombre || species.id;
const scientificName = (species) => species.nombre_cientifico || species.scientific_name || 'Nombre científico en camino';

export default function MisionCampoScreen({
  onBack,
  speciesLoader = loadCatalogSpecies,
  observationLoader = loadObservationLogs,
  plantLoader = loadPlants,
  expectedCatalogTotal = EXPECTED_CATALOG_TOTAL,
}) {
  const [species, setSpecies] = useState([]);
  const [observations, setObservations] = useState([]);
  const [plants, setPlants] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadMission = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [catalog, logs, plantAssets] = await Promise.all([speciesLoader(), observationLoader(), plantLoader()]);
      setSpecies(Array.isArray(catalog) ? catalog : []);
      setObservations(Array.isArray(logs) ? logs : []);
      setPlants(Array.isArray(plantAssets) ? plantAssets : []);
    } catch (loadError) {
      console.warn('[MisionCampo] No se pudo cargar la misión:', loadError?.message || loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [observationLoader, plantLoader, speciesLoader]);

  useEffect(() => {
    const timer = setTimeout(() => loadMission(), 0);
    return () => clearTimeout(timer);
  }, [loadMission]);

  const coverage = useMemo(() => derivePhotoCoverage(species, observations, plants), [species, observations, plants]);
  const filteredMissing = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return coverage.missing;
    return coverage.missing.filter((item) => `${displayName(item)} ${scientificName(item)}`.toLocaleLowerCase().includes(normalized));
  }, [coverage.missing, query]);
  const countLabel = loading ? '...' : coverage.missing.length;
  const catalogMismatch = !loading && species.length > 0 && species.length !== expectedCatalogTotal;

  return (
    <main className="mission-shell">
      <div className="mission-grain" aria-hidden="true" />
      <header className="mission-header">
        <button type="button" className="mission-back" onClick={onBack} aria-label="Volver al inicio">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div className="mission-brand"><span className="mission-brand-mark"><Sprout size={17} /></span> Chagra</div>
        <span className="mission-header-note">Cuaderno de campo</span>
      </header>

      <section className="mission-intro" aria-labelledby="mission-title">
        <p className="mission-eyebrow"><span className="mission-dot" /> Próximo recorrido</p>
        <h1 id="mission-title">Lo que falta<br /><em>por mirar.</em></h1>
        <p className="mission-lede">Lleve la cámara a las especies que todavía no tienen una observación con foto en su finca.</p>
        <div className="mission-counter" aria-live="polite">
          <strong>{countLabel}</strong><span>especies pendientes</span>
        </div>
      </section>

      <section className="mission-board" aria-label="Misión de fotografías">
        <div className="mission-board-top">
          <div>
            <p className="mission-section-kicker">Lista de huecos</p>
            <h2>Para este recorrido</h2>
          </div>
          <div className="mission-progress" aria-label={`${coverage.photographed.size} especies con foto de ${coverage.total}`}>
            <span>{coverage.photographed.size}</span> / {coverage.total || '...'} <small>con foto</small>
          </div>
        </div>

        {catalogMismatch && (
          <div className="mission-warning" role="status">
            <CircleAlert size={18} aria-hidden="true" />
            <span>Control de catálogo: cargaron <strong>{species.length}</strong> especies, se esperaban <strong>{expectedCatalogTotal}</strong>. La lista no se presenta como completa.</span>
          </div>
        )}

        <label className="mission-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Buscar especie pendiente</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en la lista" />
        </label>

        {loading && <p className="mission-status">Revisando catálogo y observaciones locales...</p>}
        {error && <div className="mission-status mission-status-error"><p>No pude leer la misión guardada en este dispositivo.</p><button type="button" onClick={loadMission}><RefreshCw size={16} /> Intentar de nuevo</button></div>}
        {!loading && !error && filteredMissing.length === 0 && <div className="mission-empty"><Check size={28} /><h3>{query ? 'No hay coincidencias' : 'La misión está al día'}</h3><p>{query ? 'Pruebe con otro nombre.' : 'Cada especie del catálogo ya tiene una observación con foto registrada.'}</p></div>}

        {!loading && !error && filteredMissing.length > 0 && (
          <ul className="mission-list">
            {filteredMissing.slice(0, DEFAULT_CATALOG_LIMIT).map((item, index) => (
              <li key={item.id} className="mission-card" style={{ '--delay': `${index * 45}ms` }}>
                <span className="mission-card-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="mission-card-icon"><Camera size={19} aria-hidden="true" /></span>
                <span className="mission-card-copy"><strong>{displayName(item)}</strong><em>{scientificName(item)}</em></span>
                <span className="mission-card-state">Pendiente</span>
              </li>
            ))}
          </ul>
        )}
        {!loading && filteredMissing.length > DEFAULT_CATALOG_LIMIT && <p className="mission-more">+ {filteredMissing.length - DEFAULT_CATALOG_LIMIT} más. Use el buscador para preparar el recorrido.</p>}
      </section>
    </main>
  );
}
