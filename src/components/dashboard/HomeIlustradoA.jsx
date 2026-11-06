/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Copy de búsqueda y ubicación de la portada. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { getProfile } from '../../services/userProfileService';
import useAssetStore from '../../store/useAssetStore';
import useAgentAvatarType, { AVATAR_NOMBRE } from '../../hooks/useAgentAvatarType';
import { syncManager } from '../../services/syncManager';
import { logCache } from '../../db/logCache';
import { searchHomeTools } from './home-a/search';
import { hasConfirmedHomeLocation } from './home-a/location';
import { CLIMA_UPDATED_EVENT, fetchClimaSnapshot, getCachedClimaSnapshot } from '../../services/climaService';
import useFincaActiveStore from '../../services/fincaActiveStore';
import { profileForFincaLocation } from '../../services/farmLocationFields';
import b from './home-a/b.html?raw';
import { createHomeDataMessage } from './home-a/bridge';
import { homeData } from './home-a/data';
import { HOME_VIEWS } from './home-a/views';
import './home-ilustrado-a.css';
import { DescensoOverlay } from '../DescensoLaunch.jsx';
import HomeAHeader from './HomeAHeader';
import HomeAActions from './HomeAActions';
import GuiaInicioHomeA from './GuiaInicioHomeA';
import { recorridoHomeActivo } from '../../config/recorridoHomeFlag';

const makeDocumentB = (companionName) => b
  .replaceAll('Angelita', companionName)
  .replace('<head>', `<head><meta name="home-companion-title" content="${companionName.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')} en la huerta">`)
  .replace('</head>', '<style>.cielo{display:none!important}.hoy{margin-top:0}.buscador{display:none!important}#pendientes [data-v="ubicacion-detectada"]{display:none!important}</style></head>')
  .replace('</body>', '<script src="/home-frames/bridge.js"></script><script src="/home-frames/size.js"></script></body>');

const GROUPS = { aprender: 8, animales: 2, tiempo: 1, vender: 6, finca: 2 };
const PLACES = { matas: 'plantas-v2', sembrar: 'sembrar', semilleros: 'germinacion', cosechar: 'cosechar', abonos: 'insumos', labores: 'mantenimiento', bitacora: 'bitacora', hoy: 'hoy_finca', agente: 'agente', ubicar: 'ubicacion-detectada', avisos: 'hoy_finca', ayuda: 'ayuda', perfil: 'perfil', faq: 'faq', jugar: 'juegos', cola: 'historial', ciclo: 'ciclo_vivo' };

export default function HomeIlustradoA({ onNavigate, showActions = true }) {
  const frame = useRef(null);
  const pendingGroup = useRef(null);
  const frameReady = useRef(false);
  const [height, setHeight] = useState(720);
  const [ready, setReady] = useState(false);
  const [activeDescenso, setActiveDescenso] = useState(null);
  const [tools, setTools] = useState([]);
  const [query, setQuery] = useState('');
  const searchInput = useRef(null);
  const results = useMemo(() => searchHomeTools(tools, query), [tools, query]);
  const openView = value => {
    if (!HOME_VIEWS.includes(value)) return;
    if (/^descenso_[a-z0-9-]+$/.test(value)) setActiveDescenso(value.slice('descenso_'.length));
    else if (value === 'agente') onNavigate?.(value, { focusInput: true });
    else onNavigate?.(value);
  };
  const assets = useAssetStore();
  const activeFinca = useFincaActiveStore((state) => state.fincas.find((finca) => finca.slug === state.activeFincaSlug) || null);
  const [companion] = useAgentAvatarType();
  const companionName = AVATAR_NOMBRE[companion] || AVATAR_NOMBRE.angelita;
  const documentB = useMemo(() => makeDocumentB(companionName), [companionName]);
  const [live, setLive] = useState(() => {
    const profile = getProfile();
    const hasLocation = hasConfirmedHomeLocation(profileForFincaLocation(profile, activeFinca));
    return {
      tasks: null,
      harvests: null,
      seedings: null,
      pending: null,
      snapshot: getCachedClimaSnapshot(),
      profile,
      weatherPending: Boolean(typeof navigator !== 'undefined' && navigator.onLine && hasLocation),
    };
  });

  useEffect(() => {
    let active = true;
    let climateRequest = 0;
    const refresh = async () => {
      const [tasks, harvests, seedings, stats] = await Promise.allSettled([syncManager.getPendingTasks(), logCache.getByType('log--harvest'), logCache.getByType('log--seeding'), syncManager.getSyncStats()]);
      if (active) setLive(current => ({
        ...current,
        tasks: tasks.status === 'fulfilled' ? tasks.value : null,
        harvests: harvests.status === 'fulfilled' ? harvests.value : null,
        seedings: seedings.status === 'fulfilled' ? seedings.value : null,
        pending: stats.status === 'fulfilled' ? stats.value.pendingCount : null,
        snapshot: getCachedClimaSnapshot(), profile: getProfile(),
      }));
    };
    const climate = () => {
      const activeProfile = profileForFincaLocation(getProfile(), activeFinca);
      if (navigator.onLine && hasConfirmedHomeLocation(activeProfile)) {
        const request = ++climateRequest;
        setLive(current => ({ ...current, profile: activeProfile, weatherPending: true }));
        fetchClimaSnapshot()
          .then(refresh)
          .catch(refresh)
          .finally(() => {
            if (active && request === climateRequest) {
              setLive(current => ({ ...current, weatherPending: false }));
            }
          });
      } else {
        climateRequest += 1;
        setLive(current => ({ ...current, weatherPending: false }));
        refresh();
      }
    };
    refresh();
    climate();
    const events = ['taskAdded', 'farmosLog', 'syncCompleted', 'syncComplete', 'chagra:profile-changed', CLIMA_UPDATED_EVENT];
    events.forEach(name => window.addEventListener(name, refresh));
    window.addEventListener('online', climate);
    const refreshForLocation = () => {
      refresh();
      climate();
    };
    window.addEventListener('chagra:location-updated', refreshForLocation);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
      events.forEach(name => window.removeEventListener(name, refresh));
      window.removeEventListener('online', climate);
      window.removeEventListener('chagra:location-updated', refreshForLocation);
    };
  }, [activeFinca]);

  const data = useMemo(() => ({ ...homeData({ assets, companion, finca: activeFinca, ...live }), views: HOME_VIEWS }), [assets, companion, live, activeFinca]);
  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage(createHomeDataMessage(data), '*');
  }, [data, ready]);
  useEffect(() => {
    if (!ready || pendingGroup.current == null) return;
    frame.current?.contentWindow?.postMessage({ channel: 'home-b-scroll', group: pendingGroup.current }, '*');
    pendingGroup.current = null;
  }, [ready]);

  useEffect(() => {
    const receive = event => {
      if (event.source !== frame.current?.contentWindow || event.data?.channel !== 'home-a') return;
      const { action, value } = event.data;
      if (action === 'directory' && Array.isArray(value)) {
        setTools(value.filter(tool => tool && HOME_VIEWS.includes(tool.view) && typeof tool.title === 'string' && typeof tool.description === 'string')
          .map(tool => ({ ...tool, keywords: typeof tool.keywords === 'string' ? tool.keywords : '',
            searchTerms: Array.isArray(tool.searchTerms) ? tool.searchTerms.filter(term => typeof term === 'string') : [] })));
      }
      if (action === 'search') searchInput.current?.focus();
      if (action === 'ready') {
        frameReady.current = true;
        setReady(true);
      }
      if (action === 'home') pendingGroup.current = null;
      if (action === 'place') {
        if (Object.hasOwn(GROUPS, value)) {
          const group = GROUPS[value];
          if (frameReady.current) frame.current?.contentWindow?.postMessage({ channel: 'home-b-scroll', group }, '*');
          else pendingGroup.current = group;
        } else if (PLACES[value]) onNavigate?.(PLACES[value]);
      }
      if (action === 'view' && /^descenso_[a-z0-9-]+$/.test(value || '') && HOME_VIEWS.includes(value)) {
        setActiveDescenso(value.slice('descenso_'.length));
        return;
      }
      if (action === 'view' && HOME_VIEWS.includes(value)) {
        if (value === 'agente') onNavigate?.(value, { focusInput: true });
        else onNavigate?.(value);
      }
    };
    const sizing = event => {
      if (event.source !== frame.current?.contentWindow || event.data?.channel !== 'home-b') return;
      if (event.data.action === 'height' && Number.isFinite(event.data.value)) setHeight(Math.max(1, Math.ceil(event.data.value)));
      if (event.data.action === 'target' && Number.isFinite(event.data.value)) {
        const top = frame.current.getBoundingClientRect().top + window.scrollY + event.data.value;
        const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
        window.scrollTo({ top: Math.max(0, top - 12), behavior });
      }
    };
    window.addEventListener('message', receive);
    window.addEventListener('message', sizing);
    return () => {
      window.removeEventListener('message', receive);
      window.removeEventListener('message', sizing);
    };
  }, [onNavigate]);

  const onHeaderPlace = value => {
    if (Object.hasOwn(GROUPS, value)) {
      const group = GROUPS[value];
      if (frameReady.current) frame.current?.contentWindow?.postMessage({ channel: 'home-b-scroll', group }, '*');
      else pendingGroup.current = group;
    } else if (PLACES[value]) onNavigate?.(PLACES[value]);
  };

  return (
    <main className="hia hia-composed">
      {showActions && <HomeAActions onNavigate={onNavigate} />}
      <section className="hia-tools" aria-label="Buscar y ubicar su finca">
        <div className="hia-search">
          <label htmlFor="home-tool-search">Buscar</label>
          <input ref={searchInput} id="home-tool-search" type="search" autoComplete="off"
            placeholder="Nombre de la herramienta" value={query} onChange={event => setQuery(event.target.value)} />
          {query.trim() && <div className="hia-search-results" aria-live="polite">
            {!tools.length ? <p>Cargando las herramientas…</p> : !results.length ? <p>No encontramos esa herramienta. Pruebe con otra palabra.</p> :
              <ul>{results.map(tool => <li key={tool.view}><button type="button" onClick={() => openView(tool.view)}>
                <strong>{tool.title}</strong><span>{tool.description}</span>
              </button></li>)}</ul>}
          </div>}
        </div>
        {!data.locationConfirmed && <button className="hia-location" type="button" onClick={() => onNavigate?.('ubicacion-detectada')}>
          <span className="hia-location-copy">
            <strong>Ubicación por confirmar</strong>
            <span>Indique municipio, vereda y altura para consultar el clima de su finca.</span>
          </span>
          <span className="hia-location-action">Confirmar ubicación
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </button>}
      </section>
      <HomeAHeader onPlace={onHeaderPlace} locationLabel={data.locationConfirmed ? data.location : null} />
      <iframe ref={frame} title="Un día en la finca, Home B" sandbox="allow-scripts" onLoad={() => {
        frameReady.current = true;
        setReady(true);
        frame.current?.contentWindow?.postMessage(createHomeDataMessage(data), '*');
      }} srcDoc={documentB} style={{ height }} />
      {activeDescenso && <DescensoOverlay slug={activeDescenso} onClose={() => setActiveDescenso(null)} />}
      {recorridoHomeActivo() && <GuiaInicioHomeA companionName={companionName} />}
    </main>
  );
}
