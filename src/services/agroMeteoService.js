import { PRONOSTICO_TTL_MS } from './vigenciaPronostico.js';
/**
 * agroMeteoService.js — la CAPA DE DATOS CRUDOS agrometeorológicos de la Página
 * del Tiempo (Fase 0 del DOSSIER-PAGINA-TIEMPO-AGROCLIMA, en cliente).
 * ============================================================================
 * QUÉ ES: un fetcher offline-first de Open-Meteo que trae TODA la
 * agrometeorología que una página de agroclima world-class necesita —ETo FAO-56,
 * UV, radiación, punto de rocío, humedad relativa, humedad de suelo, probabilidad
 * de lluvia, weathercode, 16 días— además de las NORMALES climáticas del archivo
 * histórico para la ANOMALÍA ("hoy vs. lo normal").
 *
 * POR QUÉ EN CLIENTE (y no en el sidecar todavía):
 *   El DOSSIER (decisión operador #2) fija arquitectura HÍBRIDA: datos crudos en
 *   el sidecar, índices derivados en cliente puro. La Fase 0 del sidecar (ampliar
 *   `openmeteo-alerts.ts` de 4 → 16 variables + `/v1/archive`) AÚN NO está en
 *   `main` de módulos opcionales (verificado 2026-08-23: el snapshot solo trae
 *   temp_max/min + precip + viento). Open-Meteo es gratis, sin API key y CORS `*`
 *   (`Access-Control-Allow-Origin: *`), así que el cliente puede pedirle
 *   directamente sin romper el lockdown de CORS.
 *
 *   Este módulo es EL COSTURÓN (seam): cuando la Fase 0 aterrice en el sidecar,
 *   `fetchAgroMeteo` cambia su `fetch` interno por el snapshot del sidecar y NADA
 *   más cambia — la Página del Tiempo consume esta forma normalizada, no la API.
 *
 * REGLAS (idénticas a climaService):
 *   - NUNCA throw. El caller espera `T | null`.
 *   - Offline / falla → cache stale si existe, si no `null` (la UI degrada a
 *     SlotPendiente, nunca inventa un número).
 *   - Todo lo que devuelve es DATO OBSERVADO/PRONOSTICADO de Open-Meteo. Los
 *     ÍNDICES DERIVADOS (ETc, balance, VPD, presión de enfermedad) NO viven aquí:
 *     son funciones puras en agroIndices.js (testeable, offline, auditable).
 *
 * FUENTE: Open-Meteo forecast API (ECMWF/GFS/ICON blend) y archive API
 * (ERA5/ERA5-Land). Gratis, sin key. `et0_fao_evapotranspiration` lo calcula
 * Open-Meteo con FAO-56 Penman-Monteith nativo.
 */

import { horasFrio, etcMm, balanceHidricoDia } from './agroIndices.js';
import { deriveFrostRisk as deriveFrostRiskImpl, deriveFrostNight, frostPisoForElevation } from './frostRisk.js';

export function deriveFrostRisk(...args) {
    return deriveFrostRiskImpl(...args);
}

export { deriveFrostNight };

function deriveTemperature24h(hourly, now, utcOffsetSeconds) {
    if (!Array.isArray(hourly?.time) || !Array.isArray(hourly?.temperature_2m)
        || !Number.isFinite(utcOffsetSeconds)) return null;
    const offset = utcOffsetSeconds;
    const localNow = new Date(now.getTime() + offset * 1000);
    // Desde el primer sello que aún no pasa: con piso, a las 6:30 la serie
    // empezaba en las 6:00 (ya pasada) y la curva, al recortarla, perdía las
    // 6:00 de mañana, justo la mínima de la madrugada que viene.
    const start = Math.ceil(localNow.getTime() / 3_600_000) * 3_600_000;
    return hourly.time.map((hora, index) => {
        const timestamp = Date.parse(`${hora}:00Z`);
        return Number.isFinite(timestamp) && timestamp >= start && timestamp < start + 24 * 3_600_000
            ? { hora, t_c: finiteOrNull(hourly.temperature_2m[index]) }
            : null;
    }).filter(Boolean);
}

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

const FORECAST_TTL_MS = PRONOSTICO_TTL_MS;
const NORMALS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días — la climatología no cambia
const FETCH_TIMEOUT_MS = 12_000;
const AGROMETEO_PAST_DAYS = 7;
export const DRY_STREAK_RAIN_THRESHOLD_MM = 0;

// v3 amplía la ventana del pronóstico de 3 a 7 días pasados para el balance
// por lote. No reutilizar una caché v2 que carece de las fechas necesarias.
const LS_FORECAST = 'chagra:agrometeo:forecast-v3';
const LS_NORMALS = 'chagra:agrometeo:normals-v3';

// Diferencia que ya no debe presentarse como si la celda representara la
// finca. 300 m es una regla de comunicación prudente para relieve andino:
// supera varios pisos locales y no pretende ser una validación topográfica.
export const ALTITUDE_MISMATCH_THRESHOLD_M = 300;

const DAILY_VARS = [
    'weathercode',
    'temperature_2m_max',
    'temperature_2m_min',
    'apparent_temperature_max',
    'precipitation_sum',
    'precipitation_probability_max',
    'et0_fao_evapotranspiration',
    'uv_index_max',
    'shortwave_radiation_sum',
    'sunshine_duration',
    'sunrise',
    'sunset',
    'windspeed_10m_max',
    'windgusts_10m_max',
    'winddirection_10m_dominant',
];

const HOURLY_VARS = [
    'wind_speed_10m',
    'wind_gusts_10m',
    'wind_direction_10m',
    'temperature_2m',
    'apparent_temperature',
    'relative_humidity_2m',
    'dew_point_2m',
    'precipitation',
    // Probabilidad de la hora anterior al sello, como `precipitation`: la de
    // «¿Llueve?» es la máxima de la misma ventana que la lluvia.
    'precipitation_probability',
    'cloud_cover',
    'uv_index',
    // Radiación INSTANTÁNEA en W/m², que es la unidad que rotula el panel de
    // Sierra. El acumulado diario ya viene por `shortwave_radiation_sum`, pero
    // en MJ/m²/día: no son intercambiables.
    'shortwave_radiation',
    'weathercode',
    'is_day',
    // Evaporación de referencia de cada hora (mm): el balance de «¿Riego?»
    // cuenta solo la que falta del día, no la que ya pasó.
    'et0_fao_evapotranspiration',
    'soil_moisture_0_to_1cm',
    'soil_moisture_1_to_3cm',
    'soil_moisture_3_to_9cm',
];

const finiteOrNull = (value) => value == null ? null
    : (Number.isFinite(Number(value)) ? Number(value) : null);

/** Cuenta días sin lluvia solo cuando la serie acredita el inicio de la racha. */
export function deriveDryStreak(daily, endIndex = daily?.length - 1) {
    if (!Array.isArray(daily) || !Number.isInteger(endIndex) || endIndex < 0 || endIndex >= daily.length) return null;
    let streak = 0;
    for (let i = endIndex; i >= 0; i -= 1) {
        const precipitation = finiteOrNull(daily[i]?.precip_mm);
        if (precipitation == null || precipitation < 0) return null;
        if (i < endIndex && daily[i]?.date && daily[i + 1]?.date
            && Date.parse(daily[i + 1].date) - Date.parse(daily[i].date) !== 86400000) return null;
        if (precipitation > DRY_STREAK_RAIN_THRESHOLD_MM) return streak;
        streak += 1;
    }
    return null;
}

/**
 * Deriva riesgo de granizo solo de los códigos WMO que lo identifican
 * explícitamente. Los códigos de nieve, aguanieve y tormenta no permiten
 * distinguir granizo, así que no se usan como sustituto.
 *
 * @returns {'alto'|'medio'|null} null cuando no hay señal explícita de granizo
 */
export function deriveHailRisk(raw, dailyDigest = [], ahoraMs = Date.now()) {
    const today = localIsoDate(ahoraMs, raw?.utc_offset_seconds);
    if (!today) return null;
    const codes = [
        raw?.current?.time?.startsWith(today) ? raw.current.weathercode : null,
        ...(raw?.hourly?.time || []).flatMap((time, i) => time.startsWith(today) ? [raw.hourly.weathercode?.[i]] : []),
        ...dailyDigest.filter((day) => day?.date === today).map((day) => day.weathercode),
    ].filter((value) => value != null).map(Number).filter(Number.isFinite);
    if (codes.length === 0) return null;
    if (codes.includes(99)) return 'alto';
    if (codes.includes(96)) return 'medio';
    // Open-Meteo no modela la ausencia de granizo. Un código distinto de 96/99
    // solo dice que no hay una señal explícita, no que el riesgo sea bajo.
    return null;
}

/** Derivaciones que alimentan el contrato de clima de la Sierra. `ahoraMs` es el reloj de la lectura. */
export function deriveSierraClimate(raw, dailyDigest, today = dailyDigest?.[1] || dailyDigest?.[0] || null, elevation = null, ahoraMs = Date.now()) {
    const hourly = raw?.hourly;
    const soilDay = localIsoDate(ahoraMs, raw?.utc_offset_seconds);
    const soilValues = [hourly?.soil_moisture_0_to_1cm, hourly?.soil_moisture_1_to_3cm,
        hourly?.soil_moisture_3_to_9cm].flatMap((layer) => (layer || []).filter((_, i) => soilDay && hourly?.time?.[i]?.startsWith(soilDay))).map(finiteOrNull).filter((value) => value != null);
    const soil = soilValues.length ? soilValues.reduce((sum, value) => sum + value, 0) / soilValues.length : null;
    // Hora vigente para las variables que el panel de Sierra muestra "de ahora"
    // (rocío, humedad relativa, UV, radiación). `nowHourIndex` devuelve -1 cuando
    // falta serie u offset, y entonces `serie?.[-1]` es undefined -> null: el
    // panel dice "No disponible", que es lo correcto. No se inventa dato.
    const nHour = nowHourIndex(hourly?.time, raw?.utc_offset_seconds, ahoraMs);
    const horaria = (serie) => finiteOrNull(serie?.[nHour]);
    const percentVolumetrico = (serie) => {
        const value = horaria(serie);
        return value == null ? null : Math.round(value * 1000) / 10;
    };
    const humedadSueloCapas = {
        '0_1cm': percentVolumetrico(hourly?.soil_moisture_0_to_1cm),
        '1_3cm': percentVolumetrico(hourly?.soil_moisture_1_to_3cm),
        '3_9cm': percentVolumetrico(hourly?.soil_moisture_3_to_9cm),
        unidad: '% vol.',
    };
    const precipitacionHoy = deriveHourlyPrecipitationState(hourly, raw?.utc_offset_seconds, ahoraMs);
    const temperaturas = Array.isArray(hourly?.temperature_2m) ? hourly.temperature_2m : null;
    const demandaReferencia = etcMm(finiteOrNull(today?.eto_mm), 1);
    const balanceReferencia = balanceHidricoDia(finiteOrNull(today?.precip_mm), demandaReferencia);
    return {
        // El panel de Sierra consume estas dos lecturas desde el contrato
        // derivado que el hook mezcla con el snapshot del sidecar.
        temp: finiteOrNull(raw?.current?.temperature_2m ?? temperaturas?.[nHour]),
        tempMax: finiteOrNull(today?.temp_max),
        minimaNocturna_c: finiteOrNull(today?.temp_min),
        heladaRiesgo: deriveFrostRisk(hourly, new Date(ahoraMs), frostPisoForElevation(elevation), raw?.utc_offset_seconds),
        lluviaProb_pct: finiteOrNull(today?.precip_prob),
        lluviaCantidad_mm: finiteOrNull(today?.precip_mm),
        vientoHorario: Array.isArray(hourly?.wind_speed_10m) ? {
            fuente: 'Open-Meteo (viento horario)',
            frescura_iso: new Date(ahoraMs).toISOString(),
            utcOffsetSeconds: raw?.utc_offset_seconds,
            horas: (hourly?.time || []).map((time, i) => ({
                time, velocidad: Number.isFinite(hourly.wind_speed_10m?.[i]) ? hourly.wind_speed_10m[i] : null,
                racha: finiteOrNull(hourly.wind_gusts_10m?.[i]),
                lluviaMm: finiteOrNull(hourly.precipitation?.[i]),
                probPct: finiteOrNull(hourly.precipitation_probability?.[i]),
                direccion: finiteOrNull(hourly.wind_direction_10m?.[i]),
                humedadPct: finiteOrNull(hourly.relative_humidity_2m?.[i]),
                puntoRocioC: finiteOrNull(hourly.dew_point_2m?.[i]),
                temperaturaC: finiteOrNull(hourly.temperature_2m?.[i]),
                // Código WMO de la hora: el aviso de tormenta mira si queda una
                // hora con tormenta, no solo el código del día.
                codigo: finiteOrNull(hourly.weathercode?.[i]),
                radiacion: finiteOrNull(hourly.shortwave_radiation?.[i]),
                esDia: hourly.is_day?.[i] == null ? null : hourly.is_day[i] !== 0,
                etoMm: finiteOrNull(hourly.et0_fao_evapotranspiration?.[i]),
            })),
        } : null,
        vientoRacha_kmh: finiteOrNull(today?.racha_max),
        vientoDireccion: finiteOrNull(today?.viento_dir) == null ? null : `${today.viento_dir}° (dominante diaria)`,
        humedadSuelo_pct: soil == null ? null : Math.round(soil * 1000) / 10,
        humedadSueloCapas,
        precipitacionHoy,
        eto_mm: finiteOrNull(today?.eto_mm),
        // El acumulado diario de hoy es pronóstico. La racha solo cuenta días
        // completos anteriores a hoy, para que una lluvia futura de 0.1 mm no
        // borre la sequía que ya ocurrió.
        rachaDiasSecos: deriveDryStreak(dailyDigest, dailyDigest?.indexOf(today) - 1),
        granizoRiesgo: deriveHailRisk(raw, dailyDigest, ahoraMs),
        horasFrio_h: temperaturas == null ? null : horasFrio(temperaturas),
        // Sin cultivo seleccionado, Kc=1 es la demanda de referencia ya usada
        // por este servicio. Si falta ETo, el déficit queda sin dato.
        deficitHidricoNeto_mm: balanceReferencia?.faltaMm ?? null,
        // Las cinco que el panel promete y ningún productor emitía. Unidades
        // atadas a lo que el panel PINTA: rocío en °C, humedad en %, brillo en
        // horas, UV sin unidad y radiación en W/m² (la instantánea horaria).
        // El acumulado diario `radiacion_mj` NO sirve aquí: son MJ/m²/día y el
        // panel rotula W/m², así que meterlo sería un número falso.
        puntoRocio_c: horaria(hourly?.dew_point_2m),
        humedadRelativa_pct: horaria(hourly?.relative_humidity_2m),
        radiacion_wm2: horaria(hourly?.shortwave_radiation),
        brilloSolar_h: finiteOrNull(today?.sol_horas),
        uv: horaria(hourly?.uv_index) ?? finiteOrNull(today?.uv_max),
        enso: { fase: null },
        frescura_iso: typeof raw?.current?.time === 'string' ? raw.current.time : null,
    };
}

/** Separa lluvia horaria vigente de lluvia que todavía está prevista. */
function deriveHourlyPrecipitationState(hourly, utcOffsetSeconds, now = Date.now()) {
    const today = localIsoDate(now, utcOffsetSeconds);
    if (!today || !Array.isArray(hourly?.time) || !Array.isArray(hourly?.precipitation)) return null;
    const items = hourly.time.map((time, index) => {
        if (!String(time).startsWith(today)) return null;
        const timestamp = Date.parse(`${time}Z`) - utcOffsetSeconds * 1000;
        const mm = finiteOrNull(hourly.precipitation[index]);
        if (!Number.isFinite(timestamp) || mm == null || mm < 0) return null;
        const hour = Number(String(time).slice(11, 13));
        return { timestamp, mm, hour: Number.isFinite(hour) ? hour : null };
    }).filter(Boolean);
    if (items.length === 0) return null;
    const vigente = items.reduce((closest, item) => (
        Math.abs(item.timestamp - now) < Math.abs(closest.timestamp - now) ? item : closest
    ));
    const prevista = items.filter((item) => item.timestamp > now).reduce((sum, item) => sum + item.mm, 0);
    const ocurrida = items.filter((item) => item.timestamp < now).reduce((sum, item) => sum + item.mm, 0);
    const franjas = [
        { id: 'madrugada', label: 'Madrugada', desde: 0, hasta: 5 },
        { id: 'mañana', label: 'Mañana', desde: 6, hasta: 11 },
        { id: 'tarde', label: 'Tarde', desde: 12, hasta: 17 },
        { id: 'noche', label: 'Noche', desde: 18, hasta: 23 },
    ].map((franja) => ({
        ...franja,
        mm: Math.round(items.filter((item) => item.hour >= franja.desde && item.hour <= franja.hasta)
            .reduce((sum, item) => sum + item.mm, 0) * 10) / 10,
    }));
    return {
        vigente_mm: vigente?.mm ?? null,
        ocurrida_mm: Math.round(ocurrida * 10) / 10,
        prevista_mm: Math.round(prevista * 10) / 10,
        franjas,
        serie_horaria_disponible: true,
    };
}

function coordKey(lat, lng, elevation) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'none';
    const base = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    return Number.isFinite(elevation) ? `${base}@${Math.round(elevation)}` : base;
}

export function altitudeMismatch(farmElevation, gridElevation, threshold = ALTITUDE_MISMATCH_THRESHOLD_M) {
    if (farmElevation == null || gridElevation == null
        || !Number.isFinite(Number(farmElevation)) || !Number.isFinite(Number(gridElevation))) return null;
    const difference = Math.abs(Number(farmElevation) - Number(gridElevation));
    return { difference, warning: difference >= threshold, threshold };
}

/** Decide si la UI debe explicar que la celda no representa bien el relieve. */
export function buildAltitudeWarning(farmElevation, gridElevation) {
    const check = altitudeMismatch(farmElevation, gridElevation);
    return check?.warning ? check : null;
}

function readLS(key, ttl) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.ts || !parsed?.key) return null;
        const fresh = Date.now() - parsed.ts < ttl;
        return { ...parsed, fresh };
    } catch {
        return null;
    }
}

function writeLS(key, entry) {
    try {
        localStorage.setItem(key, JSON.stringify(entry));
    } catch {
        /* cuota / privacy mode — ignorar */
    }
}

async function timedFetchJson(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    } finally {
        clearTimeout(t);
    }
}

/** Traduce el weathercode WMO a un ícono HONESTO (nada de "soleado" bajo nube). */
export function describeWeathercode(code, isDay = true) {
    const c = Number(code);
    // Grupos WMO (open-meteo docs). Familia sirve para colorear el cielo.
    if (c === 0) return { label: isDay ? 'Despejado' : 'Cielo despejado', emoji: isDay ? '☀️' : '🌙', family: 'sol' };
    if (c === 1) return { label: 'Casi despejado', emoji: isDay ? '🌤️' : '🌙', family: 'sol' };
    if (c === 2) return { label: 'Parcialmente nublado', emoji: '⛅', family: 'nubes' };
    if (c === 3) return { label: 'Nublado', emoji: '☁️', family: 'nubes' };
    if (c === 45 || c === 48) return { label: 'Neblina', emoji: '🌫️', family: 'nubes' };
    if (c >= 51 && c <= 57) return { label: 'Llovizna', emoji: '🌦️', family: 'lluvia' };
    if (c >= 61 && c <= 67) return { label: 'Lluvia', emoji: '🌧️', family: 'lluvia' };
    if (c >= 71 && c <= 77) return { label: 'Nieve', emoji: '🌨️', family: 'lluvia' };
    if (c >= 80 && c <= 82) return { label: 'Aguaceros', emoji: '🌧️', family: 'lluvia' };
    if (c >= 85 && c <= 86) return { label: 'Aguanieve', emoji: '🌨️', family: 'lluvia' };
    if (c >= 95) return { label: 'Tormenta', emoji: '⛈️', family: 'tormenta' };
    return { label: 'Sin dato', emoji: '❓', family: 'nubes' };
}

/**
 * ISO de calendario (YYYY-MM-DD) de un instante, en la zona horaria dada por
 * su offset en segundos respecto a UTC — BUG-DIA-UTC-20260904.
 *
 * Por qué existe: `new Date().toISOString().slice(0,10)` da el día EN UTC.
 * Colombia es UTC-5 (fijo, sin horario de verano): a las 19:00 hora local el
 * reloj del sistema ya marca las 00:00 UTC del día siguiente, así que entre
 * las 19:00 y medianoche esa expresión devuelve MAÑANA, no hoy — justo la
 * ventana en la que se avisa una helada (que ocurre de madrugada y el aviso
 * debe darse la noche anterior).
 *
 * El offset SIEMPRE viene de la respuesta de Open-Meteo (`utc_offset_seconds`,
 * presente cuando se pide `timezone=auto` o un nombre de zona explícito).
 * NUNCA una constante regional escrita a mano: Colombia no tiene horario de
 * verano hoy, pero una constante sería una bomba dormida para cualquier otra
 * región que use este mismo módulo.
 *
 * Sin offset (dato ausente) devuelve `null` — el caller degrada a un
 * fallback ya declarado, nunca inventa el día.
 *
 * @param {number} nowMs epoch ms (inyectable en tests vía reloj falseado)
 * @param {number|null|undefined} utcOffsetSeconds
 * @returns {string|null}
 */
export function localIsoDate(nowMs, utcOffsetSeconds) {
    if (!Number.isFinite(utcOffsetSeconds)) return null;
    return new Date(nowMs + utcOffsetSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Punto de rocío (°C) de una temperatura (°C) y una humedad relativa (%), con
 * la fórmula de Magnus y los coeficientes de Alduchov y Eskridge (1996):
 * a = 17,625 y b = 243,04 °C. Contra la serie horaria de Open-Meteo de los
 * fixtures del banco difiere a lo sumo 0,4 °C (la humedad llega redondeada),
 * salvo con 100 %, donde el modelo da rocío sobre la temperatura y esta da la
 * temperatura. Null si falta un dato o la humedad no es positiva.
 */
export function puntoDeRocio(temperaturaC, humedadPct) {
    if (!Number.isFinite(temperaturaC) || !Number.isFinite(humedadPct) || humedadPct <= 0) return null;
    const a = 17.625;
    const b = 243.04;
    const g = Math.log(Math.min(100, humedadPct) / 100) + (a * temperaturaC) / (b + temperaturaC);
    return Math.round(((b * g) / (a - g)) * 10) / 10;
}

/** Índice de la hora en curso; sin ella no se usa una hora futura ni antigua. */
export function nowHourIndex(times, utcOffsetSeconds, now = Date.now()) {
    if (!Array.isArray(times) || times.length === 0 || !Number.isFinite(utcOffsetSeconds)) return -1;
    let best = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < times.length; i += 1) {
        const t = Date.parse(`${times[i]}Z`) - utcOffsetSeconds * 1000;
        const diff = now - t;
        if (diff >= 0 && diff < 3600000 && diff < bestDiff) {
            bestDiff = diff;
            best = i;
        }
    }
    return best;
}

/** Agrega los valores horarios de un día ISO (YYYY-MM-DD) a mín/máx/promedio + horas de mojado. */
function aggregateHourly(hourly, dayIso) {
    const idxs = [];
    for (let i = 0; i < hourly.time.length; i += 1) {
        if (String(hourly.time[i]).startsWith(dayIso)) idxs.push(i);
    }
    if (idxs.length === 0) return null;
    const rh = idxs.map((i) => hourly.relative_humidity_2m?.[i]).filter((v) => Number.isFinite(v));
    const temps = idxs.map((i) => hourly.temperature_2m?.[i]).filter((v) => Number.isFinite(v));
    const cloud = idxs.map((i) => hourly.cloud_cover?.[i]).filter((v) => Number.isFinite(v));
    const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
    return {
        rh_max: rh.length ? Math.max(...rh) : null,
        rh_min: rh.length ? Math.min(...rh) : null,
        rh_mean: mean(rh),
        // Mojado foliar aproximado: horas con HR ≥ 90 % (rocío/agua libre sobre la hoja).
        horas_hr_alta: rh.filter((v) => v >= 90).length,
        // Horas-frío: horas con temperatura < 7 °C (base frutales caducifolios, FAO/UC-Davis).
        horas_frio: temps.length ? horasFrio(temps) : null,
        cloud_mean: mean(cloud),
    };
}

/**
 * NORMALIZA una respuesta cruda de Open-Meteo (la que pide `fetchAgroMeteo`)
 * al pronóstico agrometeorológico de la finca. Pura: no pide nada a la red ni
 * guarda nada; el reloj de la lectura entra en `ahoraMs`. Sin `daily` u
 * `hourly` devuelve null.
 *
 * @param {object} raw respuesta de `/v1/forecast`
 * @param {{lat:number,lng:number,elevation?:number,ahoraMs?:number,productUrl?:string|null,pastDays?:number}} opts
 * @returns {object|null}
 */
export function normalizarAgroMeteo(raw, { lat, lng, elevation = undefined, ahoraMs = Date.now(), productUrl = null, pastDays = 3 } = /** @type {any} */ ({})) {
    if (!raw || !raw.daily || !raw.hourly) return null;
    const d = raw.daily;
    const utcOffsetSeconds = Number.isFinite(raw.utc_offset_seconds) ? raw.utc_offset_seconds : null;
    const hoyFinca = localIsoDate(ahoraMs, utcOffsetSeconds);
    const nHour = nowHourIndex(raw.hourly.time, raw.utc_offset_seconds, ahoraMs);
    const current = raw.current ?? {};
    const nowCode = current.weather_code ?? current.weathercode ?? raw.hourly.weathercode?.[nHour];
    // El código va aparte: sin él, describeWeathercode lee null como 0 (despejado).
    const nowW = { ...describeWeathercode(nowCode, (current.is_day ?? raw.hourly.is_day?.[nHour]) !== 0), code: finiteOrNull(nowCode) };

    // Humedad y rocío del MISMO instante (W44, R3 de la v19). La humedad es la
    // del `current` (cada 15 min); el rocío, el del `current` si lo trae y, si
    // no, calculado de la temperatura y la humedad que se muestran. Antes salía
    // del sello horario anterior: «Humedad 64 % · Rocío a 10 °C» cuando con esa
    // humedad era de unos 11 °C. Sin `current`, los dos del mismo sello.
    const rhDew = Number.isFinite(current.relative_humidity_2m)
        ? {
            rh: current.relative_humidity_2m,
            dew: Number.isFinite(current.dew_point_2m) ? current.dew_point_2m
                : puntoDeRocio(current.temperature_2m, current.relative_humidity_2m),
        }
        : { rh: raw.hourly.relative_humidity_2m?.[nHour] ?? null, dew: raw.hourly.dew_point_2m?.[nHour] ?? null };

    const dailyDigest = (d.time || []).map((iso, i) => {
        const agg = aggregateHourly(raw.hourly, iso);
        return {
            date: iso,
            sunrise: d.sunrise?.[i] ?? null,
            sunset: d.sunset?.[i] ?? null,
            weathercode: d.weathercode?.[i] ?? null,
            temp_max: d.temperature_2m_max?.[i] ?? null,
            temp_min: d.temperature_2m_min?.[i] ?? null,
            apparent_max: d.apparent_temperature_max?.[i] ?? null,
            precip_mm: d.precipitation_sum?.[i] ?? null,
            precip_prob: d.precipitation_probability_max?.[i] ?? null,
            eto_mm: d.et0_fao_evapotranspiration?.[i] ?? null,
            uv_max: d.uv_index_max?.[i] ?? null,
            radiacion_mj: d.shortwave_radiation_sum?.[i] ?? null,
            sol_horas: Number.isFinite(d.sunshine_duration?.[i]) ? d.sunshine_duration[i] / 3600 : null,
            viento_max: d.windspeed_10m_max?.[i] ?? null,
            racha_max: d.windgusts_10m_max?.[i] ?? null,
            viento_dir: d.winddirection_10m_dominant?.[i] ?? null,
            rh_max: agg?.rh_max ?? null,
            rh_min: agg?.rh_min ?? null,
            rh_mean: agg?.rh_mean ?? null,
            horas_hr_alta: agg?.horas_hr_alta ?? null,
            horas_frio: agg?.horas_frio ?? null,
            cloud_mean: agg?.cloud_mean ?? null,
        };
    });

    const fetchedAt = new Date(ahoraMs).toISOString();
    const gridElevation = Number.isFinite(Number(raw.elevation)) ? Number(raw.elevation) : null;
    const provenance = {
        kind: 'modelo',
        product: 'Pronóstico meteorológico Open-Meteo',
        product_url: productUrl,
        provider_url: 'https://open-meteo.com',
        model: 'ECMWF/GFS/ICON blend',
        issued_at: null,
        fetched_at: fetchedAt,
        valid_from: dailyDigest[0]?.date || null,
        valid_until: dailyDigest.at(-1)?.date || null,
        territory: { lat, lng, precision: 'celda de modelo' },
        farm_elevation: elevation ?? null,
        grid_elevation: gridElevation,
        altitude_check: altitudeMismatch(elevation, gridElevation),
    };
    const today = (hoyFinca && dailyDigest.find((x) => x.date === hoyFinca))
        || dailyDigest[Math.min(Math.max(0, pastDays), dailyDigest.length - 1)]
        || dailyDigest[0]
        || null;
    const payload = {
        available: true,
        fetched_at: fetchedAt,
        source: 'Open-Meteo (ECMWF/GFS/ICON, ETo FAO-56)',
        source_url: 'https://open-meteo.com',
        provenance,
        lat,
        lng,
        elevation: gridElevation ?? elevation ?? null,
        requested_elevation: elevation ?? null,
        timezone: raw.timezone ?? null,
        utc_offset_seconds: Number.isFinite(raw.utc_offset_seconds) ? raw.utc_offset_seconds : null,
        now: {
            temp: current.temperature_2m ?? raw.hourly.temperature_2m?.[nHour] ?? null,
            aparente: current.apparent_temperature ?? raw.hourly.apparent_temperature?.[nHour] ?? null,
            rh: rhDew.rh,
            dew: rhDew.dew,
            precip: current.precipitation ?? raw.hourly.precipitation?.[nHour] ?? null,
            cloud: current.cloud_cover ?? raw.hourly.cloud_cover?.[nHour] ?? null,
            uv: raw.hourly.uv_index?.[nHour] ?? null,
            viento: current.wind_speed_10m ?? raw.hourly.wind_speed_10m?.[nHour] ?? null,
            is_day: (current.is_day ?? raw.hourly.is_day?.[nHour]) !== 0,
            racha: current.wind_gusts_10m ?? raw.hourly.wind_gusts_10m?.[nHour] ?? null,
            direccion: current.wind_direction_10m ?? raw.hourly.wind_direction_10m?.[nHour] ?? null,
            soil_moisture_0_1: raw.hourly.soil_moisture_0_to_1cm?.[nHour] ?? null,
            soil_moisture_1_3: raw.hourly.soil_moisture_1_to_3cm?.[nHour] ?? null,
            soil_moisture_3_9: raw.hourly.soil_moisture_3_to_9cm?.[nHour] ?? null,
            weather: nowW,
        },
        // El "hoy" agronómico = la entrada diaria de la fecha de hoy EN LA
        // ZONA HORARIA DE LA FINCA (BUG-DIA-UTC-20260904 — antes comparaba
        // contra el día en UTC, que desde las 19:00 hora Colombia ya es
        // mañana). Sin `utc_offset_seconds` en la respuesta (dato ausente),
        // `hoyFinca` es null y cae al fallback ya documentado (daily[pastDays],
        // posición de hoy según la ventana solicitada) — nunca se
        // inventa el offset.
        today,
        daily: dailyDigest,
        saved_at: ahoraMs,
    };
    const derived = deriveSierraClimate(raw, dailyDigest, today, elevation, ahoraMs);
    Object.assign(payload, derived, {
        heladaNoche: deriveFrostNight(raw.hourly, new Date(ahoraMs), frostPisoForElevation(elevation), utcOffsetSeconds),
        // La madrugada que termina hoy, entera (también las horas ya pasadas):
        // «¿Aplico?» no abre franja antes de que cierre si fue de helada alta.
        heladaMadrugada: hoyFinca && utcOffsetSeconds != null
            ? deriveFrostNight(raw.hourly, new Date(Date.parse(`${hoyFinca}T18:00:00Z`) - 86_400_000 - utcOffsetSeconds * 1000), frostPisoForElevation(elevation), utcOffsetSeconds)
            : null,
        temperatura24h: deriveTemperature24h(raw.hourly, new Date(ahoraMs), utcOffsetSeconds),
        frescura_iso: fetchedAt,
    });

    return payload;
}

/**
 * El pronóstico que ya quedó guardado en el teléfono para esa ubicación, sin
 * pedir nada a la red. Vencido sale marcado `stale:true` (con `saved_at`),
 * igual que cuando `fetchAgroMeteo` cae al guardado sin señal.
 *
 * @param {{lat:number,lng:number,elevation?:number}|null} loc
 * @returns {object|null}
 */
export function leerAgroMeteoGuardado(loc) {
    const lat = Number(loc?.lat);
    const lng = Number(loc?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const elevation = loc?.elevation != null && Number.isFinite(Number(loc.elevation)) ? Number(loc.elevation) : undefined;
    const cached = readLS(LS_FORECAST, FORECAST_TTL_MS);
    if (!cached || cached.key !== coordKey(lat, lng, elevation)) return null;
    return cached.fresh ? cached.payload : { ...cached.payload, stale: true, saved_at: cached.ts };
}

/**
 * Trae y NORMALIZA el pronóstico agrometeorológico completo para una finca.
 * Offline-first: cache 3 h; si el fetch falla devuelve la cache aunque esté
 * vencida (marcada `stale:true`), y si no hay nada, `null`.
 *
 * @param {{lat:number,lng:number,elevation?:number}} loc
 * @param {{forceRefresh?:boolean}} [opts]
 * @returns {Promise<object|null>}
 */
export async function fetchAgroMeteo(loc, opts = {}) {
    const lat = Number(loc?.lat);
    const lng = Number(loc?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const elevation = loc?.elevation != null && Number.isFinite(Number(loc.elevation)) ? Number(loc.elevation) : undefined;
    const key = coordKey(lat, lng, elevation);

    const cached = readLS(LS_FORECAST, FORECAST_TTL_MS);
    if (!opts.forceRefresh && cached && cached.key === key && cached.fresh) {
        return cached.payload;
    }

    const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        daily: DAILY_VARS.join(','),
        hourly: HOURLY_VARS.join(','),
        current: 'temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,is_day,precipitation,weathercode,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m',
        timezone: 'auto',
        wind_speed_unit: 'kmh',
        forecast_days: '16',
        past_days: String(AGROMETEO_PAST_DAYS),
    });
    if (Number.isFinite(elevation)) params.set('elevation', String(elevation));

    const raw = await timedFetchJson(`${FORECAST_URL}?${params.toString()}`);
    if (!raw || !raw.daily || !raw.hourly) {
        // Falla de red: devolver stale si lo hay (offline-first), nunca inventar.
        if (cached && cached.key === key) return { ...cached.payload, stale: true, saved_at: cached.ts };
        return null;
    }

    const payload = normalizarAgroMeteo(raw, {
        lat,
        lng,
        elevation,
        pastDays: AGROMETEO_PAST_DAYS,
        productUrl: `${FORECAST_URL}?${params.toString()}`,
    });
    const entry = { ts: Date.now(), key, payload };
    writeLS(LS_FORECAST, entry);
    return payload;
}

/**
 * Trae las NORMALES climáticas (media de ~12 años) para la ventana de ±10 días
 * alrededor de hoy, del archivo histórico Open-Meteo (ERA5). Base de la ANOMALÍA
 * "hoy está 3 °C sobre lo normal y 40 % más seco". Cache 30 días. Lazy: solo se
 * llama cuando la vista estacional necesita la anomalía. Nunca throw → null.
 *
 * @param {{lat:number,lng:number}} loc
 * @returns {Promise<{temp_media_normal?:number,precip_dia_normal?:number|null,precip_dia_desv?:number|null,balance_dia_normal?:number|null,balance_dia_desv?:number|null,years?:number,doy_window?:number,normals?:object,period?:string,source:string}|null>}
 *   Dos formas según el origen: reconstruida desde ERA5 (campos numéricos) o
 *   atajo desde la climatología WMO del snapshot (`normals` + `period`).
 */
export async function fetchNormales(loc, climatologia = null) {
    // El sidecar publica la climatología WMO 1991–2020. Si está disponible,
    // úsela como autoridad y no reconstruya una normal corta en el cliente.
    if (climatologia?.available && climatologia.normals) {
        return { normals: climatologia.normals, period: '1991–2020', source: climatologia.source || 'Climatología del snapshot (1991–2020)' };
    }
    const lat = Number(loc?.lat);
    const lng = Number(loc?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const key = coordKey(lat, lng);

    const cached = readLS(LS_NORMALS, NORMALS_TTL_MS);
    if (cached && cached.key === key && cached.fresh) return cached.payload;

    // Ventana histórica: 12 años completos que terminan el año pasado (ERA5 tiene
    // ~5 días de latencia; pedir sólo años cerrados evita huecos).
    const thisYear = new Date().getUTCFullYear();
    const endYear = thisYear - 1;
    const startYear = endYear - 11; // 12 años
    const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        start_date: `${startYear}-01-01`,
        end_date: `${endYear}-12-31`,
        daily: 'temperature_2m_mean,precipitation_sum,et0_fao_evapotranspiration',
        timezone: 'auto',
    });

    const raw = await timedFetchJson(`${ARCHIVE_URL}?${params.toString()}`);
    if (!raw?.daily?.time) {
        if (cached && cached.key === key) return cached.payload;
        return null;
    }

    // Día-del-año de hoy y ventana ±10 días. Mismo patrón BUG-DIA-UTC-20260904
    // que `today` en fetchAgroMeteo: `now` se corrige al día EN LA ZONA DE LA
    // FINCA con el offset que la propia respuesta trae (`utc_offset_seconds`),
    // no con el UTC crudo del reloj del sistema. Sin offset (dato ausente) se
    // usa el reloj del sistema tal cual — la ventana es de ±10 días, así que
    // un desfase de una fecha no cambia materialmente la media climatológica.
    const utcOffsetSecondsNormales = Number.isFinite(raw.utc_offset_seconds) ? raw.utc_offset_seconds : null;
    const now = utcOffsetSecondsNormales != null
        ? new Date(Date.now() + utcOffsetSecondsNormales * 1000)
        : new Date();
    const doy = (dt) => {
        const start = Date.UTC(dt.getUTCFullYear(), 0, 0);
        return Math.floor((Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()) - start) / 86400000);
    };
    const targetDoy = doy(now);
    const WINDOW = 10;
    const temps = [];
    const precs = [];
    const balances = [];
    const times = raw.daily.time;
    for (let i = 0; i < times.length; i += 1) {
        const dt = new Date(`${times[i]}T00:00:00Z`);
        const dd = doy(dt);
        // Distancia circular en el año (365).
        let dist = Math.abs(dd - targetDoy);
        dist = Math.min(dist, 365 - dist);
        if (dist <= WINDOW) {
            const tm = raw.daily.temperature_2m_mean?.[i];
            const pr = raw.daily.precipitation_sum?.[i];
            const eto = raw.daily.et0_fao_evapotranspiration?.[i];
            if (Number.isFinite(tm)) temps.push(tm);
            if (Number.isFinite(pr)) precs.push(pr);
            if (Number.isFinite(pr) && Number.isFinite(eto)) {
                // SPEI de referencia: ETc = ETo × Kc con Kc 1.0.
                const etc = etcMm(eto, 1);
                const balance = balanceHidricoDia(pr, etc);
                if (balance) balances.push(balance.netoMm);
            }
        }
    }
    if (temps.length < 30) {
        if (cached && cached.key === key) return cached.payload;
        return null;
    }
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const precipMean = precs.length ? mean(precs) : null;
    const precipVariance = precs.length
        ? precs.reduce((sum, value) => sum + ((value - precipMean) ** 2), 0) / precs.length
        : null;
    const balanceMean = balances.length
        ? balances.reduce((sum, value) => sum + value, 0) / balances.length
        : null;
    const balanceVariance = balances.length
        ? balances.reduce((sum, value) => sum + ((value - balanceMean) ** 2), 0) / balances.length
        : null;
    const payload = {
        temp_media_normal: Math.round(mean(temps) * 10) / 10,
        precip_dia_normal: precipMean == null ? null : Math.round(precipMean * 10) / 10,
        precip_dia_desv: precipVariance == null ? null : Math.round(Math.sqrt(precipVariance) * 100) / 100,
        balance_dia_normal: balanceMean == null ? null : Math.round(balanceMean * 10) / 10,
        balance_dia_desv: balanceVariance == null ? null : Math.round(Math.sqrt(balanceVariance) * 100) / 100,
        years: endYear - startYear + 1,
        doy_window: WINDOW,
        source: `Open-Meteo archive (ERA5), media ${startYear}–${endYear} · ventana ±${WINDOW} d · balance de referencia Kc 1.0`,
    };
    writeLS(LS_NORMALS, { ts: Date.now(), key, payload });
    return payload;
}
