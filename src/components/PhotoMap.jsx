import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bug, Camera, Compass, ImageOff, Layers, Map as MapIcon, X } from 'lucide-react';
import { openDB, STORES } from '../db/dbCore';
import { listLotes, loteGeoJson } from '../services/loteService';
import { buildPestMapData, extractPhotoGps } from '../services/photoMapService';
import { MSG } from '../config/messages';
import './photo-map.css';

const DEFAULT_CENTER = [4.5306, -73.9247];
const DEFAULT_ZOOM = 15;

function formatDate(value) {
  if (!value) return 'Fecha no disponible';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Fecha no disponible' : parsed.toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function photoDate(photo) {
  return formatDate(photo?.capturedAt || photo?.createdAt);
}

async function readLocalPhotos() {
  const db = await openDB();
  const tx = db.transaction(STORES.MEDIA_CACHE, 'readonly');
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(STORES.MEDIA_CACHE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function markerIcon(photo, selected) {
  return L.divIcon({
    className: 'photo-map-marker-wrap',
    html: `<span class="photo-map-marker${selected ? ' is-selected' : ''}" aria-hidden="true"><span>${photo.count || 1}</span></span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });
}

function colorForPest(name = '') {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 68% 38%)`;
}

function groupNearbyPhotos(photos) {
  const buckets = new Map();
  for (const photo of photos) {
    const [lat, lng] = photo.coords;
    const key = `${Math.round(lat * 10000)}:${Math.round(lng * 10000)}`;
    const existing = buckets.get(key);
    if (existing) existing.items.push(photo);
    else buckets.set(key, { ...photo, count: 1, items: [photo] });
  }
  return [...buckets.values()];
}

export default function PhotoMap() {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);
  const pestLayerRef = useRef(null);
  const objectUrlsRef = useRef([]);
  const [photos, setPhotos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [layer, setLayer] = useState('photos');
  const [days, setDays] = useState(30);
  const [pestFilter, setPestFilter] = useState('all');

  useEffect(() => {
    let alive = true;
    Promise.all([
      readLocalPhotos(),
      listLotes().catch(() => []),
    ]).then(([records, landAssets]) => {
      if (!alive) return;
      const withBlobs = records.filter((record) => record?.blob).map((record) => {
        const coords = extractPhotoGps(record);
        const url = coords ? URL.createObjectURL(record.blob) : null;
        if (url) objectUrlsRef.current.push(url);
        return { ...record, coords, url };
      }).sort((a, b) => String(b.capturedAt || b.createdAt).localeCompare(String(a.capturedAt || a.createdAt)));
      setPhotos(withBlobs);
      setLotes(landAssets);
      setIsLoading(false);
    }).catch(() => {
      if (!alive) return;
      setLoadError(true);
      setIsLoading(false);
    });
    return () => {
      alive = false;
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  const photosWithGps = useMemo(() => photos.filter((photo) => photo.coords), [photos]);
  const groupedPhotos = useMemo(() => groupNearbyPhotos(photosWithGps), [photosWithGps]);
  const pestOptions = useMemo(() => buildPestMapData(photos, lotes, { days }).availablePests, [photos, lotes, days]);
  const selectedPest = pestFilter === 'all' || pestOptions.includes(pestFilter) ? pestFilter : 'all';
  const pestMapData = useMemo(() => buildPestMapData(photos, lotes, { days, pest: selectedPest }), [photos, lotes, days, selectedPest]);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return undefined;
    const map = L.map(mapNodeRef.current, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, zoomControl: false, attributionControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('/tiles/{z}/{x}/{y}.png', {
      minZoom: 10, maxZoom: 19, tileSize: 256,
      attribution: 'Cartografía local',
      errorTileUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect fill="%23e4dfc9" width="256" height="256"/><path stroke="%23d2ceb9" d="M0 128h256M128 0v256"/><text x="50%" y="53%" fill="%23717a5c" font-family="sans-serif" font-size="11" text-anchor="middle">mapa local</text></svg>',
    }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    pestLayerRef.current = L.featureGroup();
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      pestLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const photoLayer = markerLayerRef.current;
    const pestLayer = pestLayerRef.current;
    if (!photoLayer || !pestLayer) return;
    photoLayer.clearLayers();
    groupedPhotos.forEach((photo) => {
      const marker = L.marker(photo.coords, { icon: markerIcon(photo, selected?.id === photo.id) });
      marker.on('click', () => setSelected({ ...photo, kind: 'photo' }));
      marker.addTo(photoLayer);
    });
    pestLayer.clearLayers();
    lotes.forEach((lote) => {
      const geometry = loteGeoJson(lote);
      if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return;
      const boundary = L.geoJSON(geometry, {
        style: { color: '#53672b', weight: 2, fillColor: '#a9b77e', fillOpacity: 0.12 },
      });
      boundary.bindTooltip(lote?.attributes?.name || lote?.name || 'Lote');
      boundary.addTo(pestLayer);
    });
    pestMapData.points.forEach((point) => {
      const marker = L.circleMarker(point.coords, {
        radius: 9,
        color: '#fff8e7',
        weight: 2,
        fillColor: colorForPest(point.diagnosis.name),
        fillOpacity: 0.96,
      });
      marker.bindTooltip(point.diagnosis.name, { direction: 'top', offset: [0, -8] });
      marker.on('click', () => setSelected({
        ...point.photo,
        coords: point.coords,
        kind: 'pest',
        pestDiagnosis: point.diagnosis,
        lotName: point.lotName,
      }));
      marker.addTo(pestLayer);
    });
  }, [groupedPhotos, pestMapData, selected?.id, lotes]);

  useEffect(() => {
    const map = mapRef.current;
    const photoLayer = markerLayerRef.current;
    const pestLayer = pestLayerRef.current;
    if (!map || !photoLayer || !pestLayer) return;
    if (layer === 'pests') {
      map.removeLayer(photoLayer);
      map.addLayer(pestLayer);
      const bounds = pestLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [42, 42], maxZoom: 17 });
      }
    } else {
      map.removeLayer(pestLayer);
      map.addLayer(photoLayer);
      if (groupedPhotos.length) {
        map.fitBounds(L.latLngBounds(groupedPhotos.map((photo) => photo.coords)), { padding: [42, 42], maxZoom: 17 });
      }
    }
  }, [layer, pestMapData.points, groupedPhotos]);

  const activeCount = layer === 'pests' ? pestMapData.points.length : groupedPhotos.length;
  const activeCountLabel = layer === 'pests' ? 'puntos con plaga' : 'lugares con fotos';

  return (
    <div className="photo-map">
      <section className="photo-map-intro">
        <div>
          <p className="photo-map-kicker"><Compass size={15} /> EXIF · GPS · RECORRIDO</p>
          <h2>El mapa de lo que ha visto</h2>
          <p className="photo-map-lede">Cada punto es una foto de su finca. Los espacios sin puntos son lugares para volver a mirar.</p>
        </div>
        <div className="photo-map-stat" aria-label={`${activeCount} ${activeCountLabel}`}>
          <strong>{activeCount}</strong><span>{layer === 'pests' ? <>puntos<br />con plaga</> : <>lugares<br />con fotos</>}</span>
        </div>
      </section>
      <div className="photo-map-toolbar">
        <div className="photo-map-layer-switch" role="group" aria-label="Capas del mapa">
          <button type="button" aria-pressed={layer === 'photos'} onClick={() => { setLayer('photos'); setSelected(null); }}>
            <Camera size={15} /> Fotos
          </button>
          <button type="button" data-testid="photo-map-layer-pests" aria-pressed={layer === 'pests'} onClick={() => { setLayer('pests'); setSelected(null); }}>
            <Bug size={15} /> Plagas
          </button>
        </div>
        <span className="photo-map-toolbar-status"><Layers size={16} /> {MSG.photoMap.localAvailable}</span>
        <span className="photo-map-toolbar-count"><Camera size={15} /> {photosWithGps.length} {photosWithGps.length === 1 ? 'foto ubicada' : 'fotos ubicadas'}</span>
      </div>
      {layer === 'pests' && <section className="photo-map-filters" aria-label="Filtros de plagas">
        <label>
          <span>Plaga</span>
          <select aria-label="Filtrar por plaga" value={selectedPest} onChange={(event) => setPestFilter(event.target.value)}>
            <option value="all">Todas las plagas</option>
            {pestOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label>
          <span>Últimos días</span>
          <select aria-label="Ventana de días" value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
          </select>
        </label>
        <p className="photo-map-unlocated" role="status" aria-live="polite">
          {pestMapData.noGpsCount} {pestMapData.noGpsCount === 1 ? 'diagnóstico sin ubicación' : 'diagnósticos sin ubicación'}
        </p>
        {pestOptions.length > 0 && <div className="photo-map-legend" aria-label="Colores por plaga">
          {pestOptions.map((name) => <span key={name}><i aria-hidden="true" style={{ backgroundColor: colorForPest(name) }} />{name}</span>)}
        </div>}
      </section>}
      <div className="photo-map-canvas" aria-label={MSG.photoMap.mapAriaLabel} role="application">
        <div ref={mapNodeRef} className="photo-map-leaflet" />
        {isLoading && <div className="photo-map-state"><Camera className="photo-map-state-icon" size={24} /><strong>Buscando fotos con ubicación</strong><span>Solo leemos la copia local de este teléfono.</span></div>}
        {!isLoading && loadError && <div className="photo-map-state"><ImageOff className="photo-map-state-icon" size={24} /><strong>No pude leer las fotos locales</strong><span>Intente volver a abrir el mapa.</span></div>}
        {!isLoading && !loadError && layer === 'photos' && groupedPhotos.length === 0 && <div className="photo-map-state"><MapIcon className="photo-map-state-icon" size={24} /><strong>Aún no hay fotos ubicadas</strong><span>Las fotos sin EXIF GPS quedan fuera del mapa.</span></div>}
        {!isLoading && !loadError && layer === 'pests' && pestMapData.points.length === 0 && <div className="photo-map-state"><Bug className="photo-map-state-icon" size={24} /><strong>No hay puntos de plaga en esta ventana</strong><span>Los diagnósticos de baja confianza se omiten. La confianza no informada queda visible en el detalle.</span></div>}
        <div className="photo-map-local-badge">◌ tiles locales</div>
      </div>
      {layer === 'pests' && <>
        <section className="photo-map-lot-counts" aria-label="Conteo de diagnósticos por lote">
          <div><h3>Por lote</h3><span>{pestMapData.totalDiagnoses} diagnósticos en {days} días</span></div>
          {pestMapData.countsByLot.length ? <ul>
            {pestMapData.countsByLot.map((item) => <li key={item.id}><div><span>{item.name}</span><small>Desde {formatDate(item.firstSeen)}</small></div><strong>{item.count}</strong></li>)}
          </ul> : <p>Aún no hay diagnósticos ubicados para este filtro.</p>}
        </section>
        <p className="photo-map-note">Los puntos son sugerencias de IA pendientes de revisión humana. Los registros sin GPS no se ubican ni se asignan a un lote cercano.</p>
      </>}
      {selected && <aside className="photo-map-detail" aria-label="Detalle de foto">
        <button type="button" className="photo-map-close" onClick={() => setSelected(null)} aria-label="Cerrar detalle"><X size={18} /></button>
        {selected.url && <img src={selected.url} alt={selected.speciesSlug ? `Foto de ${selected.speciesSlug}` : 'Foto de la finca'} />}
        <div>
          <p className="photo-map-detail-label">{selected.pestDiagnosis?.name || selected.speciesSlug || 'Foto de la finca'}</p>
          {selected.pestDiagnosis && <span>Diagnóstico: {formatDate(selected.pestDiagnosis.diagnosedAt)}</span>}
          <strong>{photoDate(selected)}</strong>
          {selected.pestDiagnosis && <span>Confianza: {selected.pestDiagnosis.confidence === null ? 'sin dato' : `${Math.round(selected.pestDiagnosis.confidence * 100)} %`}</span>}
          {selected.pestDiagnosis && <span>Segunda mirada: {selected.pestDiagnosis.secondOpinionDisagreed === null ? 'sin resultado' : selected.pestDiagnosis.secondOpinionDisagreed ? 'discrepó' : 'coincidió'}</span>}
          {selected.kind === 'pest' && <span>{selected.lotName || 'Sin lote'}</span>}
          <span>{selected.coords[0].toFixed(5)}, {selected.coords[1].toFixed(5)}</span>
        </div>
      </aside>}
      {layer === 'photos' && <p className="photo-map-note">Se muestran {photosWithGps.length} fotos locales con coordenadas. Las que no traen GPS quedan fuera del mapa.</p>}
    </div>
  );
}
