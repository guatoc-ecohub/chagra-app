import { FORECAST_THRESHOLDS } from '../constants/alertThresholds.js';

export const FROST_THRESHOLDS = FORECAST_THRESHOLDS.HELADA_MIN_C;

/**
 * Regla P de la noche: mínima ≤ 7 °C con madrugada despejada (nube media
 * 00–07 ≤ 30 %) y en calma (viento máximo ≤ 8 km/h) = riesgo alto. Es el
 * único umbral de helada de «El tiempo».
 */
export const REGLA_P = { minima_c: 7, nube_pct: 30, viento_kmh: 8 };

/**
 * Corte del nivel medio («noche fría, vigile»): mínima ≤ 8 °C con madrugada
 * poco nublada (≤ 60 %) y poco ventosa (≤ 12 km/h), sin llegar a la regla P.
 * El texto de la tarjeta lo nombra leyendo esta misma constante.
 */
export const REGLA_VIGILAR = { minima_c: 8, nube_pct: 60, viento_kmh: 12 };

/**
 * Sesgo medido (estación menos modelo) en noches que el modelo prevé
 * despejadas y en calma: media −1,88 °C y p10 −5,90 °C (n = 115, validación
 * X2 contra estaciones de tierra fría). En noches observadas con mínima ≤ 0 °C,
 * la media fue −6,92 °C (n = 10). En esas noches el modelo SOBREESTIMA la mínima:
 * la madrugada real llega más fría. En noches cubiertas el sesgo es ~0 y no
 * se avisa.
 */
export const SESGO_NOCHE_DESPEJADA_C = 1.9;
export const SESGO_NOCHE_DESPEJADA_P10_C = -5.9;
export const SESGO_NOCHES_HELADA_C = -6.92;

export function frostPisoForElevation(elevation) {
    const m = Number(elevation);
    if (!Number.isFinite(m)) return 'frio';
    if (m < 1000) return 'calido';
    if (m < 2000) return 'templado';
    if (m < 3000) return 'frio';
    return 'paramo';
}

const finiteOrNull = (value) => value == null ? null
    : (Number.isFinite(Number(value)) ? Number(value) : null);

/** Evalúa la serie nocturna completa. Un campo ausente invalida el resultado. */
function localDateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function addDays(dateKey, days) {
    const date = new Date(`${dateKey}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function localNowParts(now, utcOffsetSeconds) {
    if (!Number.isFinite(Number(utcOffsetSeconds))) {
        return { date: localDateKey(now), hour: now.getHours() };
    }
    const shifted = new Date(now.getTime() + Number(utcOffsetSeconds) * 1000);
    return { date: shifted.toISOString().slice(0, 10), hour: shifted.getUTCHours() };
}

/** Hora del último sello de la madrugada: desde ella se evalúa la noche siguiente. */
export const HORA_FIN_MADRUGADA = 6;

function nextNightDates(now, utcOffsetSeconds) {
    const { date, hour } = localNowParts(now, utcOffsetSeconds);
    // Antes de las 07:00 seguimos evaluando la noche que comenzó ayer.
    const startDate = hour < 7 ? addDays(date, -1) : date;
    return { evening: startDate, morning: addDays(startDate, 1) };
}

/**
 * Evalúa únicamente la próxima ventana nocturna local, no toda la serie.
 * `utcOffsetSeconds` es el offset entregado por Open-Meteo para interpretar
 * `now` en el mismo calendario que sus timestamps horarios sin zona.
 */
export function deriveFrostNight(hourly, now = new Date(), piso = 'frio', utcOffsetSeconds = null) {
    const times = hourly?.time;
    if (!Array.isArray(times) || !Array.isArray(hourly?.temperature_2m)
        || !Array.isArray(hourly?.cloud_cover) || !Array.isArray(hourly?.wind_speed_10m)) return null;
    let { evening, morning } = nextNightDates(now, utcOffsetSeconds);
    let { hour: currentHour } = localNowParts(now, utcOffsetSeconds);
    const epochDe = (time) => (Number.isFinite(Number(utcOffsetSeconds))
        ? Date.parse(`${time}:00Z`) - Number(utcOffsetSeconds) * 1000
        : new Date(`${time}:00`).getTime());
    // Pasada la medianoche se evalúa la madrugada ENTERA (00:00 a 06:00),
    // también las horas que ya pasaron: a las 5:30 la mínima de las 5 cuenta
    // para el riesgo y se dice en pasado. Desde las 6:00 el último sello de la
    // madrugada ya llegó y no queda madrugada útil: lo que viene es la noche
    // de hoy, sin hueco hasta las 7.
    const madrugadaEntera = currentHour < HORA_FIN_MADRUGADA;
    if (currentHour < 7 && !madrugadaEntera) {
        evening = morning;
        morning = addDays(morning, 1);
        currentHour = 7;
    }
    const startHour = madrugadaEntera ? 0 : (currentHour >= 18 ? currentHour : 18);
    const startDate = madrugadaEntera ? morning : evening;
    const night = times.map((time, index) => {
        const match = typeof time === 'string' ? time.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):/) : null;
        const date = match?.[1] || null;
        const hour = match ? Number(match[2]) : null;
        if (date == null || hour == null) return null;
        if (madrugadaEntera) return date === morning && hour < 7 ? index : null;
        const isNight = ((date === evening && hour >= startHour) || (date === morning && hour < 7))
            && epochDe(time) >= now.getTime();
        return isNight ? index : null;
    }).filter((index) => index != null);
    if (night.length === 0) return null;
    const earlyHours = night.filter((index) => Number(times[index].slice(11, 13)) < 7);
    const nightTemps = night.map((i) => finiteOrNull(hourly.temperature_2m[i]));
    const morningReadings = earlyHours.map((i) => [
        finiteOrNull(hourly.cloud_cover[i]), finiteOrNull(hourly.wind_speed_10m[i]),
    ]);
    if (nightTemps.some((value) => value == null)
        || earlyHours.length === 0 || morningReadings.some((reading) => reading.some((value) => value == null))) return null;
    const minTemp = Math.min(...nightTemps);
    const cloudMean = morningReadings.reduce((sum, [cloud]) => sum + cloud, 0) / morningReadings.length;
    const windMax = Math.max(...morningReadings.map(([, wind]) => wind));
    const despejadaYCalma = cloudMean <= REGLA_P.nube_pct && windMax <= REGLA_P.viento_kmh;
    let nivel = 'bajo';
    if (minTemp <= REGLA_P.minima_c && despejadaYCalma) nivel = 'alto';
    else if (minTemp <= REGLA_VIGILAR.minima_c && cloudMean <= REGLA_VIGILAR.nube_pct && windMax <= REGLA_VIGILAR.viento_kmh) nivel = 'medio';
    // La primera hora con la mínima; si esa cifra aún vuelve en una hora por
    // venir, la mínima no ha pasado y se dice esa hora.
    const conMinima = night.filter((index) => finiteOrNull(hourly.temperature_2m[index]) === minTemp);
    const minIndex = conMinima.find((index) => epochDe(times[index]) >= now.getTime()) ?? conMinima[0];
    const result = {
        nivel,
        minima_c: minTemp,
        horaMinima: times[minIndex],
        minimaPasada: epochDe(times[minIndex]) < now.getTime(),
        desde: `${startDate}T${String(startHour).padStart(2, '0')}:00`,
        hasta: `${morning}T07:00`,
        nubeMadrugada_pct: Math.round(cloudMean),
        vientoMadrugada_kmh: windMax,
    };
    // Solo la noche despejada y en calma de tierra fría lleva salvedad: es la
    // única condición donde se midió que el modelo deja la mínima más alta.
    if ((piso === 'frio' || piso === 'paramo') && despejadaYCalma) {
        result.confianza = 'baja';
        result.sesgo = { condicion: 'despejada-calma', grados_c: SESGO_NOCHE_DESPEJADA_C };
        result.nota = 'En tierra fría, con noche despejada y en calma, el pronóstico suele quedarse de 2 a 6 °C más caliente, y más en las noches que hiela: es lo que Chagra ha medido en estaciones de tierra fría. X2: p10 −5,90 °C y media −1,88 °C (n=115); media −6,92 °C en noches observadas ≤0 °C (n=10).';
    }
    return result;
}

/** Mantiene el contrato previo consumido por Sierra. */
export function deriveFrostRisk(...args) {
    return deriveFrostNight(...args)?.nivel ?? null;
}
