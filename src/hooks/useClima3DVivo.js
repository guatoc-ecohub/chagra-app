import { MSG } from '../config/messages.js';
import { riesgoSanitarioDesdeAgrometeo } from '../services/riesgoSanitarioPiso.js';
import { vigenciaPronostico, PRONOSTICO_TTL_MS } from '../services/vigenciaPronostico.js';
/*
 * useClima3DVivo — puente reactivo entre climaService y la bóveda 3D.
 *
 * No pide una API nueva ni fabrica un valor de respaldo: lee el snapshot que
 * ya comparte la Página del Tiempo, escucha su evento y solo traduce datos
 * existentes a señales visuales. La vitrina sí inicia el fetch del servicio
 * cuando se visita directamente, porque en esa ruta no siempre está montado
 * el dashboard que normalmente lo dispara.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchClimaSnapshot,
  getCachedClimaSnapshot,
  resolveClimaLocation,
  CLIMA_UPDATED_EVENT,
} from '../services/climaService.js';
import * as agroMeteoService from '../services/agroMeteoService.js';
import { deriveAtmosphere } from '../services/atmosphereService.js';
import { fincaDateISO, FINCA_UTC_OFFSET_SECONDS } from '../utils/farmDate.js';
import { pisoPorAltitud } from '../visual/mundo3d/pisosTermicos.js';

const REEVAL_MS = 10 * 60 * 1000;
const buildAltitudeWarning = agroMeteoService.buildAltitudeWarning || (() => null);
const { fetchAgroMeteo } = agroMeteoService;

function numero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Primer número real de un conjunto de nombres que conviven en el contrato.
 * El sidecar normalizado usa `temp`/`rh`/`viento`; el payload nativo de
 * Open-Meteo usa `temperature_2m`/`relative_humidity_2m`/`wind_speed_10m`.
 * La vitrina recibe ambos durante la transición, sin fabricar un respaldo. */
function lectura(source, ...names) {
  for (const name of names) {
    const value = numero(source?.[name]);
    if (value != null) return value;
  }
  return null;
}

function textoOrNull(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function hoyISO() {
  // BUG TODAY-UTC-HELADA-20260905: hoy en el calendario de la FINCA, no en la
  // zona del runtime/UTC (los `date` del forecast son locales de la finca).
  return fincaDateISO();
}

function diaActual(snapshot) {
  const forecast = snapshot?.openmeteo?.forecast_7d;
  if (!Array.isArray(forecast) || forecast.length === 0) return null;
  return forecast.find((day) => day?.date === hoyISO()) || forecast[0];
}

function horaFincaISO(date, utcOffsetSeconds = FINCA_UTC_OFFSET_SECONDS) {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  if (!Number.isFinite(ms) || !Number.isFinite(utcOffsetSeconds)) return '';
  return new Date(ms + utcOffsetSeconds * 1000).toISOString().slice(0, 13);
}

function actualDesdeHorario(snapshot, now) {
  const hourly = snapshot?.openmeteo?.hourly;
  if (!Array.isArray(hourly)) return {};
  const offset = Number.isFinite(snapshot?.openmeteo?.utc_offset_seconds)
    ? snapshot.openmeteo.utc_offset_seconds
    : FINCA_UTC_OFFSET_SECONDS;
  const hora = hourly.find((entry) => entry?.time?.slice(0, 13) === horaFincaISO(now, offset));
  if (!hora) return {};
  return {
    temp_c: hora.temp_c,
    rh_pct: hora.rh_pct,
    precip_mm: hora.precip_mm,
    cloud_cover_pct: hora.cloud_cover_pct,
    wind_speed_10m: hora.wind_speed_10m,
    wind_direction_10m: hora.wind_direction_10m,
  };
}

function familiaEnso(phase) {
  if (typeof phase !== 'string') return 'neutral';
  if (phase.startsWith('nino')) return 'nino';
  if (phase.startsWith('nina')) return 'nina';
  return 'neutral';
}

function textoAlertas(snapshot) {
  const alertas = snapshot?.alertas_locales || snapshot?.openmeteo?.alertas || [];
  return alertas
    .map((alerta) => `${alerta?.tipo || ''} ${alerta?.mensaje || ''}`.toLowerCase())
    .join(' ');
}

/**
 * Traduce el snapshot compartido a una forma pequeña para DOM y R3F.
 * Los umbrales solo deciden la presencia de una capa visual. Las cifras que
 * se muestran en pantalla siempre son las que vienen del snapshot.
 */
export function derivarClima3D(snapshot, now = new Date()) {
  const location = snapshot?.location_context || resolveClimaLocation();
  const atmos = deriveAtmosphere({ snapshot, now, location });
  const piso = pisoPorAltitud(numero(location?.elevation));
  const day = diaActual(snapshot);
  const pronostico = Array.isArray(snapshot?.openmeteo?.forecast_7d)
    ? snapshot.openmeteo.forecast_7d
    : [];
  // El snapshot del sidecar puede conservar el bloque `current` nativo de
  // Open-Meteo. Antes solo se leía `now`, el alias interno, por lo que las
  // cuatro métricas del HUD quedaban vacías aunque la respuesta sí las traía.
  const current = snapshot?.openmeteo?.now
    || snapshot?.openmeteo?.current
    || snapshot?.now
    || snapshot?.current
    || actualDesdeHorario(snapshot, snapshot?.fetched_at ? new Date(snapshot.fetched_at) : now)
    || {};
  const enso = snapshot?.enso_status || null;
  const alertasTexto = textoAlertas(snapshot);
  const lluviaMm = lectura(day, 'precip_mm', 'precipitation_sum', 'precipitation')
    ?? lectura(current, 'precip', 'precipitation', 'rain', 'precip_mm');
  const nubosidad = lectura(current, 'cloud', 'cloud_cover', 'cloudcover', 'cloud_cover_pct')
    ?? lectura(day, 'cloud_mean', 'cloud_cover_mean_pct', 'cloud_cover');
  const tempMin = lectura(day, 'temp_min', 'temp_min_c', 'temperature_2m_min');
  const tieneOpenMeteo = snapshot?.openmeteo?.available === true && !!day;
  const tieneEnso = !!enso?.phase;
  const senal = tieneOpenMeteo || tieneEnso;
  // Algunos snapshots del sidecar llaman `now` al bloque actual, mientras que
  // atmosphereService acepta también `current`. Completar aquí la misma
  // lectura oportunista evita perder un fenómeno real por una variante de
  // contrato ya conocida.
  const condicion = atmos.condicion
    || (lluviaMm != null && lluviaMm >= 10 ? 'lluvia'
      : location?.elevation >= 2600 && nubosidad != null && nubosidad >= 80 ? 'niebla'
        : lluviaMm != null && lluviaMm >= 2 ? 'nublado'
          : nubosidad != null ? (nubosidad >= 60 ? 'nublado' : 'despejado') : null);
  const lluvia = condicion === 'lluvia' || (lluviaMm != null && lluviaMm >= 2);
  const niebla = condicion === 'niebla';
  const helada = /helad|escarch|frost/.test(alertasTexto)
    || (tempMin != null && tempMin <= 3 && condicion === 'despejado');
  // El sidecar conserva el contrato derivado dentro de `clima.clima`. Durante
  // la transición también circularon las formas plana y `derived`; se mezclan
  // aquí para que el panel de Sierra lea una sola forma, sin inventar datos.
  const derived = {
    ...(snapshot?.openmeteo || {}),
    ...(snapshot?.derived || {}),
    ...(snapshot?.clima || {}),
    ...(snapshot?.openmeteo?.derived || {}),
    ...(snapshot?.clima?.clima || {}),
  };
  const fechaDato = textoOrNull(
    current?.time
      || current?.observed_at
      || snapshot?.openmeteo?.observed_at
      || snapshot?.observed_at
      || derived.frescura_iso,
  );
  const fechaConsulta = textoOrNull(snapshot?.fetched_at || snapshot?.consulted_at);
  const ensoDerivado = derived.enso && typeof derived.enso === 'object' ? derived.enso : null;
  const faseEnso = familiaEnso(enso?.phase);
  const clima = Object.freeze({
    minimaNocturna_c: lectura(derived, 'minimaNocturna_c') ?? tempMin,
    heladaRiesgo: ['alto', 'medio', 'bajo'].includes(derived.heladaRiesgo) ? derived.heladaRiesgo : null,
    granizoRiesgo: ['alto', 'medio', 'bajo'].includes(derived.granizoRiesgo) ? derived.granizoRiesgo : null,
    lluviaProb_pct: lectura(derived, 'lluviaProb_pct') ?? lectura(day, 'precip_prob', 'precipitation_probability_max'),
    lluviaCantidad_mm: lectura(derived, 'lluviaCantidad_mm') ?? lluviaMm,
    vientoHorario: derived.vientoHorario ?? null,
    vientoRacha_kmh: lectura(derived, 'vientoRacha_kmh') ?? lectura(day, 'racha_max', 'windgusts_10m_max'),
    vientoDireccion: textoOrNull(derived.vientoDireccion)
      ?? (Number.isFinite(Number(current?.wind_direction_10m)) ? String(current.wind_direction_10m) : null)
      ?? (Number.isFinite(Number(day?.viento_dir)) ? String(day.viento_dir) : null)
      ?? (Number.isFinite(Number(day?.wind_direction_10m_dominant)) ? String(day.wind_direction_10m_dominant) : null),
    humedadSuelo_pct: lectura(derived, 'humedadSuelo_pct'),
    humedadSueloCapas: derived.humedadSueloCapas && typeof derived.humedadSueloCapas === 'object'
      ? derived.humedadSueloCapas
      : null,
    // La serie horaria ya calculada por agroMeteoService también alimenta el
    // panel de Sierra; se expone sin alterar ninguna decisión de la atmósfera.
    precipitacionHoy: derived.precipitacionHoy && typeof derived.precipitacionHoy === 'object'
      ? derived.precipitacionHoy
      : null,
    eto_mm: lectura(derived, 'eto_mm') ?? lectura(day, 'eto_mm', 'et0_fao_evapotranspiration'),
    rachaDiasSecos: lectura(derived, 'rachaDiasSecos'),
    puntoRocio_c: lectura(derived, 'puntoRocio_c', 'puntoRocio', 'dewPoint', 'dew'),
    humedadRelativa_pct: lectura(derived, 'humedadRelativa_pct', 'humedadRelativa', 'rh'),
    radiacion_wm2: lectura(derived, 'radiacion_wm2', 'radiacion'),
    brilloSolar_h: lectura(derived, 'brilloSolar_h', 'brilloSolar', 'sol'),
    uv: lectura(derived, 'uv', 'indiceUv', 'uv_max'),
    enso: ensoDerivado || { fase: tieneEnso ? faseEnso : null },
    frescura_iso: textoOrNull(derived.frescura_iso) || textoOrNull(snapshot?.fetched_at),
    fuente: textoOrNull(derived.fuente) || textoOrNull(snapshot?.openmeteo?.source) || 'Open-Meteo',
  });

  const vigenciaAgro = vigenciaPronostico(snapshot?.agrometeo, now.getTime());
  return Object.freeze({
    sanitario: riesgoSanitarioDesdeAgrometeo(snapshot?.agrometeo, piso?.id),
    sanitarioProcedencia: {
      fuente: 'Open-Meteo',
      emitidoEn: snapshot?.agrometeo?.fetched_at || null,
      validoHasta: vigenciaAgro.cuandoMs == null ? null : new Date(vigenciaAgro.cuandoMs + PRONOSTICO_TTL_MS).toISOString(),
    },
    vigenciaAgro,
    estado: vigenciaAgro.estado === 'fresco' ? 'fresco' : 'viejo',
    avisoAltitud: buildAltitudeWarning(derived.provenance?.farm_elevation, derived.provenance?.grid_elevation),
    senal,
    // Procedencia para los rótulos: no usar una condición atmosférica derivada
    // como si fuera una lectura actual ni un día de respaldo como hoy.
    actual: current,
    dia: day,
    fechaLocal: hoyISO(),
    coordenadasConfirmadas: location?.precision === 'exact'
      && typeof location?.lat === 'number' && Number.isFinite(location.lat)
      && typeof location?.lng === 'number' && Number.isFinite(location.lng),
    stale: snapshot?.agrometeo ? vigenciaAgro.estado !== 'fresco' : snapshot?.stale === true,
    fechaDato,
    fechaConsulta,
    tieneOpenMeteo,
    tieneEnso,
    condicion,
    luz: atmos.luz,
    lluvia,
    niebla,
    helada,
    lluviaMm,
    nubosidad,
    temp: lectura(current, 'temp', 'temperature', 'temperature_2m', 'temp_c')
      ?? lectura(derived, 'temp', 'temperature', 'temperature_2m', 'temp_c'),
    tempMin,
    tempMax: lectura(day, 'temp_max', 'temp_max_c', 'temperature_2m_max')
      ?? lectura(derived, 'tempMax', 'temp_max', 'temp_max_c', 'temperature_2m_max'),
    pronostico,
    humedad: lectura(current, 'rh', 'humidity', 'relative_humidity_2m', 'rh_pct'),
    viento: lectura(current, 'viento', 'wind', 'wind_speed_10m', 'windspeed_10m')
      ?? lectura(day, 'viento_max', 'wind_speed_10m_max', 'windspeed_10m_max'),
    ensoFamily: familiaEnso(enso?.phase),
    ensoPhase: enso?.phase || null,
    ensoLabel: enso?.label || null,
    oni: numero(enso?.oni_value),
    tendencia: enso?.trend || null,
    alertas: snapshot?.alertas_locales || snapshot?.openmeteo?.alertas || [],
    ubicacion: location?.municipio || location?.vereda || null,
    precision: location?.precision || null,
    pisoTermico: piso ? { id: piso.id, nombre: piso.nombre, min: piso.min, max: piso.max } : null,
    actualizado: snapshot?.fetched_at || null,
    clima,
    minimaNocturna_c: clima.minimaNocturna_c,
    heladaRiesgo: clima.heladaRiesgo,
    granizoRiesgo: clima.granizoRiesgo,
    lluviaProb_pct: clima.lluviaProb_pct,
    lluviaCantidad_mm: clima.lluviaCantidad_mm,
    vientoHorario: clima.vientoHorario,
    vientoRacha_kmh: clima.vientoRacha_kmh,
    vientoDireccion: clima.vientoDireccion,
    humedadSuelo_pct: clima.humedadSuelo_pct,
    eto_mm: clima.eto_mm,
    rachaDiasSecos: clima.rachaDiasSecos,
    puntoRocio_c: clima.puntoRocio_c,
    humedadRelativa_pct: clima.humedadRelativa_pct,
    radiacion_wm2: clima.radiacion_wm2,
    brilloSolar_h: clima.brilloSolar_h,
    uv: clima.uv,
    enso: clima.enso,
    fuente: clima.fuente,
    frescura_iso: clima.frescura_iso,
  });
}

/** Lee la misma cache/evento que el tema global y la Página del Tiempo. */
export function useClima3DVivo() {
  const [snapshot, setSnapshot] = useState(() => getCachedClimaSnapshot());
  // `agroMeteoService` ya deriva el contrato de clima de la Sierra —y es el
  // único sitio que pide rocío, humedad relativa, radiación, brillo solar y
  // UV— pero hasta ahora nadie en esta cadena lo leía: su único consumidor
  // era ClimaBoletinScreen. Medido en producción el 2026-09-18 con la finca
  // ubicada: el snapshot del sidecar no trae esas variables y 11 de los 13
  // bloques del panel decían "No disponible" con dato fresco.
  const [agro, setAgro] = useState(null);
  const [ahora, setAhora] = useState(() => new Date());
  const [intento, setIntento] = useState(0);
  const [adquisicion, setAdquisicion] = useState(() => ({
    estado: 'consultando',
    consultado_at: null,
    error: null,
  }));

  const reintentar = useCallback(() => setIntento((valor) => valor + 1), []);

  useEffect(() => {
    let alive = true;
    const consultadoAt = new Date().toISOString();
    queueMicrotask(() => {
      if (alive) setAdquisicion({ estado: 'consultando', consultado_at: consultadoAt, error: null });
    });
    const actualizar = (detail) => {
      if (alive) setSnapshot(detail || getCachedClimaSnapshot());
    };
    const onClima = (event) => actualizar(event?.detail);
    window.addEventListener(CLIMA_UPDATED_EVENT, onClima);

    const location = resolveClimaLocation();
    const climaRequest = fetchClimaSnapshot(location || undefined).then((next) => {
      if (alive && next) setSnapshot(next);
      return next;
    });
    const agroRequest = Number.isFinite(Number(location?.lat)) && Number.isFinite(Number(location?.lng))
      ? Promise.resolve(fetchAgroMeteo(location)).catch(() => null)
      : Promise.resolve(null);
    if (Number.isFinite(Number(location?.lat)) && Number.isFinite(Number(location?.lng))) {
      agroRequest.then((payload) => { if (alive && payload) setAgro(payload); });
    }
    Promise.all([climaRequest, agroRequest]).then(([climaNext, agroNext]) => {
      if (!alive) return;
      const huboDato = Boolean(climaNext || agroNext);
      setAdquisicion({
        estado: huboDato ? 'lista' : 'error',
        consultado_at: consultadoAt,
        error: huboDato ? null : MSG.clima.errorConsulta,
      });
    });
    const id = setInterval(() => { actualizar(); setAhora(new Date()); }, REEVAL_MS);

    return () => {
      alive = false;
      window.removeEventListener(CLIMA_UPDATED_EVENT, onClima);
      clearInterval(id);
    };
  }, [intento]);

  return useMemo(() => {
    if (!agro) return { ...derivarClima3D(snapshot, ahora), adquisicion, reintentar };
    // El sidecar MANDA donde tenga dato; esto sólo rellena lo que venía vacío.
    // Por eso `agro` va primero en la mezcla: no mueve ninguna cifra que ya
    // aterrizaba, y no toca `tieneOpenMeteo`, así que la atmósfera de la
    // escena sigue decidiéndose con la señal del sidecar y no con esta.
    return {
      ...derivarClima3D({
        ...(snapshot || {}),
        fetched_at: snapshot?.fetched_at || agro?.fetched_at || null,
        agro_stale: agro.stale === true,
        agrometeo: agro,
        derived: { ...agro, ...(snapshot?.derived || {}) },
      }, ahora),
      adquisicion,
      reintentar,
    };
  }, [snapshot, agro, adquisicion, reintentar, ahora]);
}

export default useClima3DVivo;
