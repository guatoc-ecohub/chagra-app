import { fetchWithAuthRetry } from './apiService.js';
import { buildSidecarHeaders } from './tierService.js';
import { isSidecarEnabled } from './sidecarClient.js';

/** @typedef {'synced' | 'estimated'} IotTimeQuality */
/**
 * @typedef {Object} IotReading
 * @property {number} soil_moisture_pct
 * @property {number} air_temperature_c
 * @property {number} air_humidity_pct
 * @property {number} light_lux
 * @property {string} sampled_at
 * @property {IotTimeQuality} time_quality
 */
/**
 * @typedef {{ status: 'unavailable' }} IotTelemetryUnavailable
 * @typedef {{ status: 'empty', stale_after_hours: number }} IotTelemetryEmpty
 * @typedef {{ status: 'stale', stale_after_hours: number, last_reading_at: string, time_quality: IotTimeQuality, reading: null }} IotTelemetryStale
 * @typedef {{ status: 'fresh', stale_after_hours: number, reading: IotReading }} IotTelemetryFresh
 * @typedef {IotTelemetryUnavailable | IotTelemetryEmpty | IotTelemetryStale | IotTelemetryFresh} IotTelemetryResult
 */
/**
 * @typedef {Object} IotTelemetryOptions
 * @property {typeof fetchWithAuthRetry} [fetchFn]
 * @property {boolean} [enabled]
 * @property {boolean} [online]
 * @property {AbortSignal} [signal]
 */

function getBaseUrl() {
  try {
    const value = import.meta.env?.VITE_SIDECAR_URL;
    if (typeof value === 'string' && value.trim()) return value.trim().replace(/\/+$/, '');
  } catch (_) { /* entorno sin Vite */ }
  return '/api/mcp/agro';
}

/** @param {unknown} value @returns {value is string} */
function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} raw
 * @returns {IotTelemetryResult}
 */
function normalizeResponse(raw) {
  if (!isRecord(raw)) return { status: 'unavailable' };
  const staleAfter = Number(raw.stale_after_hours);
  if (!Number.isInteger(staleAfter) || staleAfter < 1 || staleAfter > 168) return { status: 'unavailable' };
  if (raw.status === 'empty') return { status: 'empty', stale_after_hours: staleAfter };
  if (raw.status === 'stale' && validDate(raw.last_reading_at)) {
    return {
      status: 'stale',
      stale_after_hours: staleAfter,
      last_reading_at: raw.last_reading_at,
      time_quality: raw.last_reading_time_quality === 'synced' ? 'synced' : 'estimated',
      reading: null,
    };
  }
  const reading = raw.reading;
  if (raw.status !== 'fresh' || !isRecord(reading) || !validDate(reading.sampled_at)) return { status: 'unavailable' };
  const soilMoisture = reading.soil_moisture_pct;
  const airTemperature = reading.air_temperature_c;
  const airHumidity = reading.air_humidity_pct;
  const light = reading.light_lux;
  if (typeof soilMoisture !== 'number' || !Number.isFinite(soilMoisture) || soilMoisture < 0 || soilMoisture > 100
    || typeof airTemperature !== 'number' || !Number.isFinite(airTemperature) || airTemperature < -40 || airTemperature > 85
    || typeof airHumidity !== 'number' || !Number.isFinite(airHumidity) || airHumidity < 0 || airHumidity > 100
    || typeof light !== 'number' || !Number.isFinite(light) || light < 0 || light > 200_000) return { status: 'unavailable' };
  return {
    status: 'fresh',
    stale_after_hours: staleAfter,
    reading: {
      soil_moisture_pct: soilMoisture,
      air_temperature_c: airTemperature,
      air_humidity_pct: airHumidity,
      light_lux: light,
      sampled_at: reading.sampled_at,
      time_quality: reading.time_quality === 'synced' ? 'synced' : 'estimated',
    },
  };
}

/** Lee la tarjeta IoT sin almacenar ni reutilizar valores entre lotes. */
/**
 * @param {string} lotId
 * @param {IotTelemetryOptions} [options]
 * @returns {Promise<IotTelemetryResult>}
 */
export async function getLatestIotReadingForLot(lotId, {
  fetchFn = fetchWithAuthRetry,
  enabled = isSidecarEnabled(),
  online = typeof navigator === 'undefined' || navigator.onLine !== false,
  signal,
} = {}) {
  if (!lotId || typeof lotId !== 'string') return { status: 'unavailable' };
  if (!enabled || !online) return { status: 'unavailable' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  try {
    const response = await fetchFn(`${getBaseUrl()}/iot/lots/${encodeURIComponent(lotId)}/latest`, {
      method: 'GET',
      headers: buildSidecarHeaders(),
      signal: controller.signal,
    });
    if (!response.ok) return { status: 'unavailable' };
    return normalizeResponse(await response.json());
  } catch (_) {
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export { normalizeResponse as normalizeIotReadingResponse };
