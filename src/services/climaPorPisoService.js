/**
 * Contrato de clima operativo para un piso térmico.
 *
 * Este módulo consume el snapshot ya compartido por climaService. No convierte
 * un piso en una coordenada: sin una finca localizada, el clima local es
 * desconocido y se declara como tal.
 */
import { fetchClimaSnapshot, resolveClimaLocation } from './climaService.js';
import { PISOS_TERMICOS } from '../visual/mundo3d/pisosTermicos.js';

import { PRONOSTICO_TTL_MS, vigenciaPronostico } from './vigenciaPronostico.js';

export const CLIMA_PISO_MAX_AGE_MS = PRONOSTICO_TTL_MS;

const PISOS = new Map(PISOS_TERMICOS.map((piso) => [piso.id, piso]));

function numero(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function lectura(source, names) {
    for (const name of names) {
        const value = numero(source?.[name]);
        if (value != null) return value;
    }
    return null;
}

function fecha(value) {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? new Date(time) : null;
}

function iso(value) {
    return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

function pisoCanonico(piso) {
    const id = typeof piso === 'string' ? piso : piso?.id;
    return PISOS.get(id) || null;
}

function fincaLocalizada(finca) {
    if (!finca || typeof finca !== 'object') return null;
    return resolveClimaLocation({
        profile: finca.profile || finca,
        lat: finca.lat ?? finca.latitude,
        lng: finca.lng ?? finca.longitude,
        elevation: finca.elevation ?? finca.altitud ?? finca.finca_altitud,
        municipio: finca.municipio,
        departamento: finca.departamento,
        vereda: finca.vereda,
    });
}

function campo(valor, fuente, emitido, validoHasta) {
    return Object.freeze({
        valor: valor ?? null,
        fuente: fuente || null,
        emitidoEn: iso(emitido),
        validoDesde: iso(emitido),
        validoHasta: iso(validoHasta),
    });
}

function fechaLocal(date) {
    return date instanceof Date && Number.isFinite(date.getTime())
        ? date.toISOString().slice(0, 10)
        : null;
}

function dias(snapshot, now) {
    const forecast = snapshot?.openmeteo?.forecast_7d;
    if (!Array.isArray(forecast)) return [];
    const hoy = fechaLocal(now);
    const index = forecast.findIndex((day) => day?.date === hoy);
    return index < 0 ? forecast.slice(0, 2) : forecast.slice(index, index + 2);
}

function lluviaPorFranjas(snapshot, emitido) {
    const hourly = snapshot?.openmeteo?.hourly;
    const hourlyRows = hourly && !Array.isArray(hourly) && Array.isArray(hourly.time)
        ? hourly.time.slice(0, 48).map((time, index) => ({
            time,
            precip_prob: hourly.precipitation_probability?.[index] ?? hourly.precip_prob?.[index],
            precip_mm: hourly.precipitation?.[index] ?? hourly.precip_mm?.[index] ?? hourly.rain?.[index],
        }))
        : hourly;
    if (Array.isArray(hourlyRows)) {
        return hourlyRows.slice(0, 48).map((franja) => {
            const inicio = fecha(franja?.time || franja?.inicio);
            const fin = fecha(franja?.end || franja?.fin) || (inicio ? new Date(inicio.getTime() + 60 * 60 * 1000) : null);
            return Object.freeze({
                desde: iso(inicio),
                hasta: iso(fin),
                probabilidad: campo(lectura(franja, ['precip_prob', 'precipitation_probability']), 'Open-Meteo', emitido, fin || emitido),
                cantidadMm: campo(lectura(franja, ['precip_mm', 'precipitation', 'rain']), 'Open-Meteo', emitido, fin || emitido),
            });
        }).filter((franja) => franja.desde);
    }
    if (Array.isArray(snapshot?.openmeteo?.rain_by_period)) {
        return snapshot.openmeteo.rain_by_period.slice(0, 48).map((franja) => {
            const fin = fecha(franja?.hasta) || emitido;
            return Object.freeze({
                desde: franja?.desde || null,
                hasta: franja?.hasta || null,
                probabilidad: campo(lectura(franja, ['probabilidad', 'precip_prob']), 'Open-Meteo', emitido, fin),
                cantidadMm: campo(lectura(franja, ['cantidadMm', 'precip_mm']), 'Open-Meteo', emitido, fin),
            });
        });
    }
    return [];
}

// El contrato JSON del proveedor es abierto; se conserva el tipo flexible para no estrechar payloads en runtime.
/**
 * @param {{ snapshot?: any, piso?: string | { id?: string } | null, finca?: any, now?: Date }} options
 */
export function normalizarClimaPorPiso({ snapshot = null, piso, finca = null, now = new Date() } = {}) {
    const pisoInfo = pisoCanonico(piso);
    const location = fincaLocalizada(finca) || snapshot?.location_context || null;
    if (!location) {
        return Object.freeze({ estado: 'sin_finca', piso: pisoInfo?.id || null, finca: null, datos: null });
    }

    const emitido = fecha(snapshot?.fetched_at);
    const estado = vigenciaPronostico(snapshot, now.getTime()).estado === 'fresco'
        ? 'fresco' : snapshot ? 'viejo' : 'ausente';
    if (!snapshot) return Object.freeze({ estado, piso: pisoInfo?.id || null, finca: location, datos: null });

    const fuente = snapshot.source || snapshot.openmeteo?.source || 'climaService';
    if (!emitido) return Object.freeze({ estado: 'viejo', piso: pisoInfo?.id || null, finca: location, datos: null });
    const hasta = new Date(emitido.getTime() + CLIMA_PISO_MAX_AGE_MS);
    const current = snapshot.openmeteo?.now || snapshot.openmeteo?.current || {};
    const [hoy, manana] = dias(snapshot, now);
    const dato = (day, names) => campo(lectura(day, names), fuente, emitido, hasta);
    const actual = {
        temperatura: campo(lectura(current, ['temp', 'temperature', 'temperature_2m']), fuente, emitido, new Date(emitido.getTime() + 60 * 60 * 1000)),
        viento: campo(lectura(current, ['viento', 'wind', 'wind_speed_10m']), fuente, emitido, new Date(emitido.getTime() + 60 * 60 * 1000)),
    };
    const mananaDatos = manana ? {
        temperaturaMinimaMadrugada: dato(manana, ['temp_min', 'temp_min_c', 'temperature_2m_min']),
        lluviaTotalMm: dato(manana, ['precip_mm', 'precipitation_sum']),
    } : null;

    return Object.freeze({
        estado,
        piso: pisoInfo?.id || null,
        finca: Object.freeze({ lat: location.lat ?? null, lng: location.lng ?? null, elevation: location.elevation ?? null, precision: location.precision || null }),
        emitidoEn: iso(emitido),
        validoHasta: iso(hasta),
        datos: Object.freeze({
            actual: Object.freeze(actual),
            minimaMadrugada: dato(hoy, ['temp_min', 'temp_min_c', 'temperature_2m_min']),
            lluviaPorFranjas: lluviaPorFranjas(snapshot, emitido),
            lluviaHoyMm: dato(hoy, ['precip_mm', 'precipitation_sum']),
            manana: mananaDatos ? Object.freeze(mananaDatos) : null,
        }),
    });
}

/**
 * @param {{ piso?: string | { id?: string } | null, finca?: any, now?: Date, forceRefresh?: boolean }} options
 */
export async function fetchClimaPorPiso({ piso, finca = null, now = new Date(), forceRefresh = false } = {}) {
    const location = fincaLocalizada(finca);
    if (!location) return normalizarClimaPorPiso({ piso, finca, now });
    const snapshot = await fetchClimaSnapshot({ ...location, forceRefresh });
    return normalizarClimaPorPiso({ snapshot, piso, finca: location, now });
}

export default fetchClimaPorPiso;
