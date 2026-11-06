import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Footprints,
  LocateFixed,
  MapPin,
  MousePointer2,
  Save,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { MSG } from '../../config/messages.js';
import useLoteStore from '../../store/useLoteStore';
import {
  geometryAreaHectares,
  geometryFromDraft,
  loteCentroid,
  summarizeLote,
  LAND_TYPES,
} from '../../services/loteService';
import {
  acceptGpsFix,
  buildWalkPolygon,
  GPS_ACCURACY_THRESHOLD_M,
  polygonHasSelfIntersection,
} from '../../utils/geo';
import './lote-croquis.css';

const DEFAULT_CENTER = [4.5306, -73.9247];
const DEFAULT_ZOOM = 16;

const readSavedMapCenter = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('chagra:v1:map_state') || 'null');
    if (Number.isFinite(saved?.lat) && Number.isFinite(saved?.lng)) {
      return [saved.lat, saved.lng];
    }
  } catch {
    // La posición guardada es opcional.
  }
  return DEFAULT_CENTER;
};

const gpsErrorMessage = (error) => {
  if (error?.code === 1) return 'No diste permiso de ubicación. Actívalo en los ajustes del navegador.';
  if (error?.code === 2) return 'El GPS no encuentra la ubicación. Sal al aire libre y vuelve a intentar.';
  if (error?.code === 3) return 'El GPS tardó demasiado. Intenta de nuevo al aire libre.';
  return 'No fue posible iniciar el GPS en este teléfono.';
};

export default function LoteCroquisPlaceholder({ onBack }) {
  const lotes = useLoteStore((s) => s.lotes);
  const drawMode = useLoteStore((s) => s.drawMode);
  const draftLatLngs = useLoteStore((s) => s.draftLatLngs);
  const isSaving = useLoteStore((s) => s.isSaving);
  const storeError = useLoteStore((s) => s.error);
  const hydrate = useLoteStore((s) => s.hydrate);
  const setDrawMode = useLoteStore((s) => s.setDrawMode);
  const removeDraftVertex = useLoteStore((s) => s.removeDraftVertex);
  const saveDraftAsLote = useLoteStore((s) => s.saveDraftAsLote);

  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const drawingLayerRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastAcceptedFixRef = useRef(null);
  const latestInputRef = useRef({ drawMode, toolMode: null, isWalking: false, isClosed: false });
  const [toolMode, setToolMode] = useState(null);
  const [isWalking, setIsWalking] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [gpsMessage, setGpsMessage] = useState('');
  const [rejectedFixes, setRejectedFixes] = useState(0);
  const [name, setName] = useState('Lote nuevo');
  const [landType, setLandType] = useState('field');
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  let firstLoteCenter = null;
  for (const lote of lotes) {
    const center = loteCentroid(lote);
    if (center) {
      firstLoteCenter = [center.lat, center.lng];
      break;
    }
  }
  const firstLoteCenterKey = firstLoteCenter ? `${firstLoteCenter[0]}|${firstLoteCenter[1]}` : '';
  const [initialMapCenter] = useState(() => firstLoteCenter || readSavedMapCenter());

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return undefined;

    const map = L.map(mapElementRef.current, {
      center: initialMapCenter,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      subdomains: ['a', 'b', 'c'],
      maxZoom: 19,
      minZoom: 10,
      attribution: '© OpenStreetMap',
      errorTileUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect fill="%230f172a" width="256" height="256"/><text x="50%" y="50%" fill="%23475569" font-family="monospace" font-size="10" text-anchor="middle">tile offline</text></svg>',
    }).addTo(map);
    L.control.attribution({ prefix: false }).addAttribution('© OpenStreetMap').addTo(map);
    const drawingLayer = L.layerGroup().addTo(map);

    map.on('click', (event) => {
      const current = latestInputRef.current;
      if (current.drawMode !== 'polygon' || current.toolMode !== 'tap' || current.isWalking || current.isClosed) return;
      useLoteStore.getState().addDraftVertex({ lat: event.latlng.lat, lng: event.latlng.lng });
    });

    mapRef.current = map;
    drawingLayerRef.current = drawingLayer;
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      drawingLayerRef.current = null;
    };
  }, [initialMapCenter]);

  useEffect(() => {
    latestInputRef.current = { drawMode, toolMode, isWalking, isClosed };
  }, [drawMode, toolMode, isWalking, isClosed]);

  useEffect(() => {
    if (!mapRef.current || !firstLoteCenterKey || draftLatLngs.length > 0) return;
    const [lat, lng] = firstLoteCenterKey.split('|').map(Number);
    mapRef.current.setView([lat, lng], DEFAULT_ZOOM);
  }, [firstLoteCenterKey, draftLatLngs.length]);

  const hasIntersection = useMemo(
    () => polygonHasSelfIntersection(draftLatLngs),
    [draftLatLngs],
  );
  const previewGeometry = useMemo(() => (
    draftLatLngs.length >= 3 ? geometryFromDraft({ mode: 'polygon', latlngs: draftLatLngs }) : null
  ), [draftLatLngs]);
  const areaHa = previewGeometry ? geometryAreaHectares(previewGeometry) : 0;

  useEffect(() => {
    const drawingLayer = drawingLayerRef.current;
    if (!drawingLayer) return;
    drawingLayer.clearLayers();

    if (draftLatLngs.length >= 2) {
      const positions = draftLatLngs.map((point) => [point.lat, point.lng]);
      if (draftLatLngs.length >= 3 && isClosed && !hasIntersection) {
        L.polygon(positions, {
          color: '#c8e77a',
          weight: 3,
          fillColor: '#95bd4e',
          fillOpacity: 0.25,
        }).addTo(drawingLayer);
      } else {
        L.polyline(positions, { color: hasIntersection ? '#fb7185' : '#c8e77a', weight: 3 }).addTo(drawingLayer);
      }
    }

    draftLatLngs.forEach((point, index) => {
      const marker = L.marker([point.lat, point.lng], {
        draggable: !isWalking,
        keyboard: true,
        title: `Vértice ${index + 1}. Arrastra para moverlo.`,
        icon: L.divIcon({
          className: 'lote-vertex-icon',
          html: `<span>${index + 1}</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
      }).addTo(drawingLayer);
      marker.bindTooltip(`Vértice ${index + 1}`);
      marker.on('dragend', (event) => {
        const position = event.target.getLatLng();
        useLoteStore.getState().updateDraftVertex(index, { lat: position.lat, lng: position.lng });
      });
    });
  }, [draftLatLngs, hasIntersection, isWalking, isClosed]);

  const stopWalking = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWalking(false);
    latestInputRef.current.isWalking = false;
    const current = useLoteStore.getState().draftLatLngs;
    const cleaned = buildWalkPolygon(current);
    const store = useLoteStore.getState();
    store.setDrawMode('polygon');
    cleaned.forEach((point) => store.addDraftVertex(point));
    setGpsStatus('stopped');
    setGpsMessage(cleaned.length >= 3
      ? 'Recorrido detenido. Revisa los puntos y ajusta el lindero.'
      : 'Recorrido detenido. Añade al menos tres puntos para cerrar el lote.');
  };

  const startWalking = () => {
    if (!navigator.geolocation) {
      setGpsStatus('failed');
      setGpsMessage('Este navegador no ofrece ubicación GPS. Puedes tocar el mapa para dibujar.');
      return;
    }
    if (drawMode !== 'polygon') setDrawMode('polygon');
    setToolMode('walk');
    setIsClosed(false);
    setGpsStatus('searching');
    setGpsMessage('Buscando una ubicación con precisión de 25 m o mejor.');
    setGpsAccuracy(null);
    setRejectedFixes(0);
    lastAcceptedFixRef.current = null;
    setIsWalking(true);
    latestInputRef.current = { drawMode: 'polygon', toolMode: 'walk', isWalking: true, isClosed: false };

    const beginWatch = (highAccuracy) => {
      if (!latestInputRef.current.isWalking) return;
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
        const fix = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        setGpsAccuracy(Number.isFinite(fix.accuracy) ? fix.accuracy : null);

        if (!Number.isFinite(fix.accuracy)) {
          setRejectedFixes((count) => count + 1);
          setGpsStatus('rejected');
          setGpsMessage('El teléfono no informó la precisión. No añadimos este punto.');
          return;
        }

        const verdict = acceptGpsFix(fix, lastAcceptedFixRef.current);
        if (!verdict.accepted) {
          setRejectedFixes((count) => count + 1);
          setGpsStatus('rejected');
          setGpsMessage(verdict.reason === 'accuracy'
            ? `Punto descartado: precisión de ${Math.round(fix.accuracy)} m. Se acepta hasta ${GPS_ACCURACY_THRESHOLD_M} m.`
            : 'Punto descartado por un salto del GPS. Camina despacio y espera la siguiente lectura.');
          return;
        }

        lastAcceptedFixRef.current = fix;
        setIsClosed(false);
        useLoteStore.getState().addDraftVertex({ lat: fix.lat, lng: fix.lng });
        mapRef.current?.panTo([fix.lat, fix.lng]);
        setGpsStatus('recording');
        setGpsMessage('Punto guardado. Sigue el lindero y detén el recorrido al volver al inicio.');
        },
        (error) => {
          if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
          setIsWalking(false);
          latestInputRef.current.isWalking = false;
          setGpsStatus('failed');
          setGpsMessage(gpsErrorMessage(error));
        },
        { enableHighAccuracy: highAccuracy, maximumAge: 0, timeout: 30000 },
      );
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!latestInputRef.current.isWalking) return;
        setGpsAccuracy(Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null);
        mapRef.current?.setView([position.coords.latitude, position.coords.longitude], 17);
        setGpsStatus('located');
        setGpsMessage('GPS listo. Empieza a caminar por el lindero.');
        beginWatch(true);
      },
      (error) => {
        if (!latestInputRef.current.isWalking) return;
        if (error.code === 3) {
          setGpsMessage('El GPS tarda en fijar la posición. Seguimos buscando con el teléfono.');
          beginWatch(false);
          return;
        }
        setIsWalking(false);
        latestInputRef.current.isWalking = false;
        setGpsStatus('failed');
        setGpsMessage(gpsErrorMessage(error));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  };

  const activateMapTapping = () => {
    if (isWalking) stopWalking();
    if (drawMode !== 'polygon') setDrawMode('polygon');
    setToolMode('tap');
    setGpsMessage('Toca el mapa para agregar cada esquina del lote.');
    setNotice('');
  };

  const centerOnLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('failed');
      setGpsMessage('Este navegador no ofrece ubicación GPS.');
      return;
    }
    setGpsStatus('searching');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setGpsAccuracy(Number.isFinite(accuracy) ? accuracy : null);
        mapRef.current?.setView([latitude, longitude], 17);
        setGpsStatus('located');
        setGpsMessage(Number.isFinite(accuracy)
          ? `Ubicación centrada. Precisión actual: ${Math.round(accuracy)} m.`
        : MSG.loteCroquis.mapaCentradoSinPrecision);
      },
      (error) => {
        setGpsStatus('failed');
        setGpsMessage(gpsErrorMessage(error));
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 30000 },
    );
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (draftLatLngs.length < 3 || hasIntersection || !isClosed || isWalking || !name.trim()) return;
    const saved = await saveDraftAsLote({ name: name.trim(), landType });
    if (saved) {
      setNotice('Lote guardado en este teléfono y en la cola de sincronización con FarmOS.');
      setName('Lote nuevo');
      setGpsMessage('');
      setToolMode(null);
      setIsClosed(false);
    }
  };

  const canSave = draftLatLngs.length >= 3
    && isClosed
    && !hasIntersection
    && !isWalking
    && Boolean(name.trim())
    && !isSaving;

  return (
    <section className="lote-croquis min-h-full px-3 py-3 text-stone-100 sm:px-5 sm:py-5">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        <header className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-900 bg-emerald-950 text-emerald-100 active:bg-emerald-900"
              aria-label="Volver al mapa de la finca"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime-300">Mi finca · linderos</p>
            <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">Dibuja tu lote</h1>
          </div>
          <span className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-bold ${online ? 'border-emerald-700/70 bg-emerald-950/70 text-emerald-200' : 'border-amber-700/70 bg-amber-950/70 text-amber-200'}`}>
            {online ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
            {online ? 'Con señal' : 'Sin señal'}
          </span>
        </header>

        <p className="max-w-3xl text-sm leading-relaxed text-emerald-100/75">
          Elige cómo recorrer el lindero. Toca cada esquina o camina el borde con el GPS.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={activateMapTapping}
            aria-pressed={toolMode === 'tap'}
            className={`flex min-h-[58px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-extrabold transition-colors ${toolMode === 'tap' ? 'border-lime-300 bg-lime-300 text-emerald-950' : 'border-emerald-800 bg-[#12241b] text-emerald-50 active:bg-emerald-900'}`}
          >
            <MousePointer2 size={19} aria-hidden="true" />
            Tocar el mapa
          </button>
          <button
            type="button"
            onClick={isWalking ? stopWalking : startWalking}
            aria-pressed={isWalking}
            className={`flex min-h-[58px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-extrabold transition-colors ${isWalking ? 'border-rose-400 bg-rose-950 text-rose-100' : toolMode === 'walk' ? 'border-lime-300 bg-[#29432b] text-lime-100' : 'border-emerald-800 bg-[#12241b] text-emerald-50 active:bg-emerald-900'}`}
          >
            <Footprints size={20} aria-hidden="true" />
            {isWalking ? 'Detener recorrido' : 'Caminar el lindero'}
          </button>
        </div>

        <div className="lote-croquis__map-wrap relative overflow-hidden rounded-2xl border border-emerald-900 bg-[#0b1711] shadow-xl shadow-black/20">
          <div ref={mapElementRef} className="lote-croquis__map" aria-label={MSG.loteCroquis.mapaLabel} />
          <button
            type="button"
            onClick={centerOnLocation}
            className="absolute right-3 top-3 z-[500] flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-900 bg-[#0b1711]/95 px-3 text-xs font-bold text-emerald-50 shadow-lg backdrop-blur active:bg-emerald-950"
            aria-label="Centrar mapa en mi ubicación"
          >
            <LocateFixed size={16} aria-hidden="true" />
            Mi ubicación
          </button>
          <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg bg-[#0b1711]/90 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-100 shadow backdrop-blur">
            © OpenStreetMap
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-emerald-900 bg-[#102019] px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-50">
              <MapPin size={16} className="shrink-0 text-lime-300" aria-hidden="true" />
              {draftLatLngs.length} {draftLatLngs.length === 1 ? 'punto' : 'puntos'} del lindero
            </div>
            <p className="mt-1 text-xs leading-relaxed text-emerald-100/65">
              {isClosed
                ? 'Lindero cerrado. Puedes mover o quitar puntos antes de guardar.'
                : isWalking
                ? `GPS: ${gpsAccuracy === null ? 'precisión sin dato' : `±${Math.round(gpsAccuracy)} m`}. Se aceptan puntos hasta ${GPS_ACCURACY_THRESHOLD_M} m.`
                : 'Arrastra un punto para moverlo. Usa la lista para quitar esquinas.'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/55">Área estimada</p>
            <p className="font-mono text-xl font-black text-lime-200">{areaHa.toFixed(3)} <span className="text-xs font-bold">ha</span></p>
          </div>
          {draftLatLngs.length >= 3 && (
            <button
              type="button"
              onClick={() => setIsClosed((closed) => !closed)}
              disabled={hasIntersection || isWalking}
              className={`col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 ${isClosed ? 'bg-emerald-800 text-emerald-50' : 'bg-lime-300 text-emerald-950'}`}
            >
              {isClosed ? 'Seguir ajustando el lindero' : 'Cerrar lindero y revisar área'}
            </button>
          )}
        </div>

        {gpsMessage && (
          <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${gpsStatus === 'failed' || gpsStatus === 'rejected' ? 'border-amber-700/70 bg-amber-950/50 text-amber-100' : 'border-emerald-800 bg-emerald-950/60 text-emerald-100'}`} role="status" aria-live="polite">
            {gpsStatus === 'failed' || gpsStatus === 'rejected'
              ? <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              : <Check size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
            <span>{gpsMessage}{rejectedFixes > 0 && ` Puntos descartados: ${rejectedFixes}.`}</span>
          </div>
        )}

        {!online && (
          <p className="rounded-lg border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-xs leading-relaxed text-amber-100/85">
            Sin señal puedes caminar con el GPS y guardar el lote. El fondo del mapa puede quedar vacío si no cargó antes.
          </p>
        )}

        {draftLatLngs.length > 0 && (
          <section aria-label="Puntos del lindero" className="rounded-xl border border-emerald-900 bg-[#102019] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-emerald-100/75">Ajustar esquinas</h2>
              <span className="text-[10px] text-emerald-100/55">Arrastra los círculos del mapa</span>
            </div>
            <ol className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
              {draftLatLngs.map((point, index) => (
                <li key={`${point.lat}-${point.lng}-${index}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsClosed(false);
                      removeDraftVertex(index);
                    }}
                    className="flex min-h-10 items-center gap-1.5 rounded-lg border border-emerald-800 bg-[#0b1711] px-2.5 text-xs font-bold text-emerald-100 active:bg-rose-950"
                    aria-label={`Quitar punto ${index + 1}`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lime-300 text-[10px] font-black text-emerald-950">{index + 1}</span>
                    <span>Punto {index + 1}</span>
                    <Trash2 size={13} aria-hidden="true" className="text-rose-300" />
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        {hasIntersection && (
          <p className="flex items-start gap-2 rounded-xl border border-rose-700 bg-rose-950/70 px-3 py-2.5 text-sm font-semibold text-rose-100" role="alert">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            El lindero se cruza. Mueve o quita un punto antes de guardar.
          </p>
        )}

        <form onSubmit={handleSave} className="grid gap-2 rounded-2xl border border-emerald-900 bg-[#102019] p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-xs font-bold text-emerald-100/75">
            Nombre del lote
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              className="min-h-11 w-full rounded-lg border border-emerald-800 bg-[#0b1711] px-3 text-sm font-semibold text-white outline-none focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
              aria-label="Nombre del lote"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-emerald-100/75">
            Tipo
            <select
              value={landType}
              onChange={(event) => setLandType(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-emerald-800 bg-[#0b1711] px-3 text-sm font-semibold text-white outline-none focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
              aria-label="Tipo de lote"
            >
              {LAND_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <button
            type="submit"
            disabled={!canSave}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime-300 px-5 text-sm font-black text-emerald-950 shadow-lg shadow-lime-950/20 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-emerald-900 disabled:text-emerald-300/50 disabled:shadow-none"
          >
            <Save size={17} aria-hidden="true" />
            {isSaving ? 'Guardando…' : MSG.loteCroquis.guardar}
          </button>
          {storeError && <p className="text-xs font-semibold text-rose-200 sm:col-span-3" role="alert">{storeError}</p>}
        </form>

        {notice && <p className="flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-950/60 px-3 py-2.5 text-sm text-emerald-100" role="status"><Check size={16} aria-hidden="true" />{notice}</p>}

        <section className="pb-4" aria-labelledby="lotes-guardados-titulo">
          <h2 id="lotes-guardados-titulo" className="mb-2 text-sm font-black text-emerald-50">Lotes de la finca <span className="text-emerald-200/60">({lotes.length})</span></h2>
          {lotes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-emerald-900 px-3 py-4 text-sm text-emerald-100/60">Este es el primer croquis. Al guardarlo aparecerá aquí.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {lotes.map((lote) => {
                const summary = summarizeLote(lote, { plants: [], animals: [] });
                return (
                  <li key={lote.id} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-950 bg-[#0d1a13] px-3 py-2.5">
                    <span className="min-w-0 truncate text-sm font-bold text-stone-100">{summary.name}</span>
                    <span className="shrink-0 text-xs text-emerald-100/60">
                      {summary.hasGeometry ? `${summary.areaHa.toFixed(3)} ha` : 'Sin polígono'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
