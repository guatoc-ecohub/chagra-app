/**
 * Balance climático de riego por lote y cultivo.
 *
 * No muta Assets ni Logs. Proyecta lotes, plantas y logs de siembra/cosecha
 * en memoria y devuelve estados para la UI y el motor de alertas.
 *
 * Kc: FAO Irrigation and Drainage Paper 56, capítulo 6, tablas 11 y 12.
 * Tabla 12: https://www.fao.org/4/x0490e/x0490e0b.htm
 * Tabla 11 aporta duraciones de referencia, no fenología validada para una
 * variedad andina. Solo se calcula papa y fríjol seco arbustivo explícito.
 * Los demás cultivos quedan en «sin cálculo» hasta contar con Kc y etapa
 * inequívocos respaldados por fuente.
 */

import { MSG } from '../config/messages.js';

export const IRRIGATION_WINDOW_DAYS = 7;
export const IRRIGATION_ALERT_TYPE = 'RIEGO_POR_LOTE';
export const IRRIGATION_ALERT_KEY_PREFIX = 'riego-lote:';
export const FAO56_KC_SOURCE_URL = 'https://www.fao.org/4/x0490e/x0490e0b.htm';

const DAY_MS = 24 * 60 * 60 * 1000;

// Kc ini, Kc mid y Kc end provienen de FAO-56, tabla 12. Las etapas provienen
// de tabla 11 y son aproximaciones generales para clima continental, no datos
// fenológicos observados en Colombia. FAO-56, ec. 66, interpola desarrollo y
// etapa final en línea recta.
const FAO56_CROPS = Object.freeze({
    potato: Object.freeze({
        key: 'potato',
        label: 'Papa',
        kc: Object.freeze({ initial: 0.5, mid: 1.15, end: 0.75 }),
        stageDays: Object.freeze({ initial: 25, development: 30, mid: 45, late: 30 }),
        sourceLabel: 'FAO-56, tabla 12, raíces y tubérculos',
    }),
    dryBushBean: Object.freeze({
        key: 'dry-bush-bean',
        label: 'Fríjol seco arbustivo',
        kc: Object.freeze({ initial: 0.4, mid: 1.15, end: 0.35 }),
        stageDays: Object.freeze({ initial: 20, development: 30, mid: 40, late: 20 }),
        sourceLabel: 'FAO-56, tabla 12, leguminosas',
    }),
});

const NO_CALCULATION_LABELS = Object.freeze({
    no_crop: MSG.riego.balance.noCrop,
    no_sowing_date: MSG.riego.balance.noSowingDate,
    unsupported_crop: MSG.riego.balance.unsupportedCrop,
    incomplete_weather: MSG.riego.balance.incompleteWeather,
    stale_weather: MSG.riego.balance.staleWeather,
    invalid_today: MSG.riego.balance.invalidToday,
    outside_crop_cycle: MSG.riego.balance.outsideCropCycle,
    invalid_crop_date: MSG.riego.balance.invalidCropDate,
});

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cropFromName(value) {
    const name = normalizeText(value);
    if (!name) return null;

    // Papa criolla (Solanum phureja) no se equipara automáticamente con la
    // categoría general de papa de FAO-56.
    if (/\b(criolla|phureja|yema de huevo)\b/.test(name)) return null;
    if (/^(solanum tuberosum|potato|papa)(?:\s|$)/.test(name)) return FAO56_CROPS.potato;

    // La tabla distingue fríjol verde y seco. Solo aceptar la forma arbustiva
    // seca evita asignar el Kc de grano a una variedad trepadora o de vaina.
    if (/^(phaseolus vulgaris|frijol|habichuela)(?:\s|$)/.test(name)
        && /\b(seco|arbustivo)\b/.test(name)
        && !/\b(trepador|enredadera|verde|vaina)\b/.test(name)) {
        return FAO56_CROPS.dryBushBean;
    }
    return null;
}

function relationRefs(value) {
    const data = value?.data;
    if (!data) return [];
    return (Array.isArray(data) ? data : [data]).filter((item) => item && typeof item.id === 'string');
}

function assetNames(plant) {
    const plantTypes = relationRefs(plant?.relationships?.plant_type)
        .map((ref) => ref.attributes?.name)
        .filter(Boolean);
    return [...plantTypes, plant?.attributes?.name, plant?.name].filter(Boolean);
}

function resolvePlantCrop(plant, seedingLog) {
    const seedName = seedingLog?.attributes?.name || seedingLog?.name || '';
    const seedCropName = String(seedName).replace(/^\s*siembra(?:\s+de)?\s*/i, '').trim();
    const names = [...assetNames(plant), seedCropName];
    for (const name of names) {
        const crop = cropFromName(name);
        if (crop) return { crop, label: String(name).trim() };
    }
    return { crop: null, label: names[0] ? String(names[0]).trim() : 'Cultivo sin nombre' };
}

function dateOnly(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        const millis = value > 1e12 ? value : value * 1000;
        return new Date(millis).toISOString().slice(0, 10);
    }
    if (typeof value !== 'string' || !value.trim()) return null;
    const input = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10);
    if (/^\d{9,13}$/.test(input)) return dateOnly(Number(input));
    const parsed = Date.parse(input);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

function logDate(log) {
    return dateOnly(log?.attributes?.timestamp ?? log?.timestamp);
}

function relatedAssetIds(log) {
    const refs = relationRefs(log?.relationships?.asset);
    if (refs.length) return refs.map((ref) => ref.id);
    return typeof log?.asset_id === 'string' ? [log.asset_id] : [];
}

function relatedLandIds(plant) {
    const refs = [
        ...relationRefs(plant?.relationships?.parent),
        ...relationRefs(plant?.relationships?.location),
    ];
    return [...new Set(refs
        .filter((ref) => !ref.type || ref.type === 'asset--land')
        .map((ref) => ref.id))];
}

function landIdsFromLog(log) {
    return relationRefs(log?.relationships?.location)
        .filter((ref) => !ref.type || ref.type === 'asset--land')
        .map((ref) => ref.id);
}

function validIsoDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function shiftIsoDate(date, offset) {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
}

function asDailyRows(dailyWeather) {
    if (Array.isArray(dailyWeather)) return dailyWeather;
    if (!Array.isArray(dailyWeather?.time)) return [];
    return dailyWeather.time.map((date, index) => ({
        date,
        precip_mm: dailyWeather.precipitation_sum?.[index] ?? null,
        eto_mm: dailyWeather.et0_fao_evapotranspiration?.[index] ?? null,
    }));
}

function weatherWindow(dailyWeather, today, windowDays) {
    if (!validIsoDate(today)) return null;
    const rows = asDailyRows(dailyWeather);
    const byDate = new Map(rows.map((day) => [day?.date, day]));
    const expected = Array.from({ length: windowDays }, (_, index) => shiftIsoDate(today, index - windowDays));
    const window = expected.map((date) => byDate.get(date));
    if (window.some((day) => !day
        || !Number.isFinite(day.eto_mm) || day.eto_mm < 0
        || !Number.isFinite(day.precip_mm) || day.precip_mm < 0)) return null;
    return window;
}

function kcAt(crop, sowingDate, weatherDate) {
    if (!validIsoDate(sowingDate) || !validIsoDate(weatherDate)) return null;
    const ageDays = Math.floor((Date.parse(`${weatherDate}T00:00:00Z`) - Date.parse(`${sowingDate}T00:00:00Z`)) / DAY_MS);
    if (ageDays < 0) return null;
    const dayOfCycle = ageDays + 1;
    const { initial, development, mid, late } = crop.stageDays;
    const { initial: kcInitial, mid: kcMid, end: kcEnd } = crop.kc;
    if (dayOfCycle <= initial) return { value: kcInitial, stage: 'inicial' };
    if (dayOfCycle <= initial + development) {
        const progress = (dayOfCycle - initial) / development;
        return { value: kcInitial + progress * (kcMid - kcInitial), stage: 'desarrollo' };
    }
    if (dayOfCycle <= initial + development + mid) return { value: kcMid, stage: 'media' };
    if (dayOfCycle <= initial + development + mid + late) {
        const progress = (dayOfCycle - initial - development - mid) / late;
        return { value: kcMid + progress * (kcEnd - kcMid), stage: 'final' };
    }
    return null;
}

function noCalculation(candidate, reason, extra = {}) {
    return {
        key: candidate.key,
        lotId: candidate.lot.id,
        lotName: candidate.lot.attributes?.name || candidate.lot.name || 'Lote sin nombre',
        cropLabel: candidate.cropLabel || 'Cultivo sin nombre',
        cropKey: candidate.crop?.key || null,
        sowingDate: candidate.sowingDate || null,
        status: 'no_calculation',
        reason,
        reasonLabel: NO_CALCULATION_LABELS[reason],
        shouldAlert: false,
        sourceUrl: FAO56_KC_SOURCE_URL,
        ...extra,
    };
}

function round1(value) {
    return Math.round((value + Number.EPSILON) * 10) / 10;
}

function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function evaluateCandidate(candidate, {
    dailyWeather,
    today,
    windowDays,
    weatherSource,
    weatherStale,
}) {
    if (weatherStale) return noCalculation(candidate, 'stale_weather');
    if (!validIsoDate(today)) return noCalculation(candidate, 'invalid_today');
    if (!candidate.sowingDate) return noCalculation(candidate, 'no_sowing_date');
    if (!candidate.crop) return noCalculation(candidate, 'unsupported_crop');

    const window = weatherWindow(dailyWeather, today, windowDays);
    if (!window) return noCalculation(candidate, 'incomplete_weather');

    const daily = [];
    for (const day of window) {
        const kc = kcAt(candidate.crop, candidate.sowingDate, day.date);
        if (!kc) return noCalculation(candidate, 'outside_crop_cycle');
        if (kc.value <= 0) return noCalculation(candidate, 'invalid_crop_date');
        const etcMm = day.eto_mm * kc.value;
        // Aproximación prudente sin datos de suelo: la lluvia efectiva de cada
        // día no supera la demanda ETc de ese día. El excedente no se guarda
        // como reserva porque no hay capacidad de almacenamiento medida.
        const effectiveRainMm = Math.min(day.precip_mm, etcMm);
        daily.push({
            date: day.date,
            etoMm: day.eto_mm,
            kc: kc.value,
            stage: kc.stage,
            etcMm,
            precipMm: day.precip_mm,
            effectiveRainMm,
            deficitMm: etcMm - effectiveRainMm,
        });
    }

    const etoMm = daily.reduce((sum, day) => sum + day.etoMm, 0);
    const etcMm = daily.reduce((sum, day) => sum + day.etcMm, 0);
    const precipMm = daily.reduce((sum, day) => sum + day.precipMm, 0);
    const effectiveRainMm = daily.reduce((sum, day) => sum + day.effectiveRainMm, 0);
    const deficitMm = daily.reduce((sum, day) => sum + day.deficitMm, 0);
    // Umbral de revisión: un día de la demanda media diaria estimada del mismo
    // cultivo y ventana. Sin TAW/textura/raíces no se inventa un umbral de
    // agotamiento del suelo ni una lámina de aplicación.
    const thresholdMm = etcMm / windowDays;
    const shouldAlert = thresholdMm > 0 && deficitMm >= thresholdMm;
    const status = shouldAlert
        ? 'needs_water'
        : deficitMm <= 0.01
            ? 'rain_sufficient'
            : 'below_threshold';
    const stages = [...new Set(daily.map((day) => day.stage))];
    const kcByStage = stages.map((stage) => {
        const values = daily.filter((day) => day.stage === stage).map((day) => day.kc);
        return {
            stage,
            minimum: round2(Math.min(...values)),
            maximum: round2(Math.max(...values)),
        };
    });

    return {
        key: candidate.key,
        lotId: candidate.lot.id,
        lotName: candidate.lot.attributes?.name || candidate.lot.name || 'Lote sin nombre',
        cropLabel: candidate.cropLabel || candidate.crop.label,
        cropKey: candidate.crop.key,
        sowingDate: candidate.sowingDate,
        status,
        reason: null,
        shouldAlert,
        windowDays,
        windowStart: daily[0].date,
        windowEnd: daily.at(-1).date,
        daily,
        stages,
        kcByStage,
        metrics: {
            etoMm: round1(etoMm),
            kcMean: round1(etcMm / etoMm),
            etcMm: round1(etcMm),
            precipMm: round1(precipMm),
            effectiveRainMm: round1(effectiveRainMm),
            deficitMm: round1(deficitMm),
            thresholdMm: round1(thresholdMm),
        },
        formula: 'ETc = ET₀ × Kc; déficit = suma diaria de max(0, ETc - lluvia efectiva).',
        rainMethod: 'Lluvia efectiva diaria = min(lluvia, ETc); el excedente no se guarda como reserva de suelo.',
        weatherSource: weatherSource || 'Open-Meteo: ET₀ FAO-56 y precipitación diaria',
        kcSource: candidate.crop.sourceLabel,
        sourceUrl: FAO56_KC_SOURCE_URL,
        thresholdMethod: 'Umbral de revisión = una ETc media diaria de la ventana.',
    };
}

function buildCandidates(land, plants, seedingLogs, plantingLogs, harvestLogs, today) {
    const candidates = new Map();
    const plantingEvents = [...seedingLogs, ...plantingLogs]
        .filter((log) => ['log--seeding', 'log--planting'].includes(log?.type));
    const plantIds = new Set(plants.map((plant) => plant?.id).filter(Boolean));

    const add = ({ plant = null, log = null, sowingDate = null, crop = null, cropLabel = null, reason = null }) => {
        const groupKey = [
            land.id,
            crop?.key || normalizeText(cropLabel) || 'cultivo-sin-nombre',
            sowingDate || 'sin-fecha',
            reason || '',
        ].join(':');
        const existing = candidates.get(groupKey);
        if (existing) {
            if (plant?.id) existing.plantIds.add(plant.id);
            return;
        }
        candidates.set(groupKey, {
            key: `${IRRIGATION_ALERT_KEY_PREFIX}${groupKey}`,
            lot: land,
            plantIds: new Set(plant?.id ? [plant.id] : []),
            crop,
            cropLabel,
            sowingDate,
            sourceLogId: log?.id || null,
            reason,
        });
    };

    const plantsLinkedToLand = plants.filter((plant) => relatedLandIds(plant).includes(land.id));
    for (const plant of plantsLinkedToLand) {
        const ids = new Set([plant.id]);
        const plantSeedings = plantingEvents
            .filter((log) => relatedAssetIds(log).some((id) => ids.has(id)))
            .map((log) => ({ log, date: logDate(log) }))
            .filter((entry) => entry.date && entry.date <= today)
            .sort((a, b) => b.date.localeCompare(a.date));
        const latest = plantSeedings[0] || null;
        if (!latest) {
            const resolved = resolvePlantCrop(plant, null);
            add({ plant, crop: resolved.crop, cropLabel: resolved.label, reason: 'no_sowing_date' });
            continue;
        }

        const isHarvested = harvestLogs.some((log) => {
            if (log?.type !== 'log--harvest' || !relatedAssetIds(log).includes(plant.id)) return false;
            const harvestedAt = logDate(log);
            return harvestedAt && harvestedAt >= latest.date && harvestedAt <= today;
        });
        if (isHarvested) continue;

        const resolved = resolvePlantCrop(plant, latest.log);
        add({
            plant,
            log: latest.log,
            sowingDate: latest.date,
            crop: resolved.crop,
            cropLabel: resolved.label,
            reason: resolved.crop ? null : 'unsupported_crop',
        });
    }

    // También se admiten logs de siembra ubicados directamente en el lote,
    // siempre que no repitan un log ya atribuido a una planta del store.
    for (const log of plantingEvents) {
        if (!landIdsFromLog(log).includes(land.id)) continue;
        const linkedPlantIds = relatedAssetIds(log).filter((id) => plantIds.has(id));
        if (linkedPlantIds.length > 0) continue;
        const sowingDate = logDate(log);
        if (!sowingDate || sowingDate > today) continue;
        const resolved = resolvePlantCrop(null, log);
        add({
            log,
            sowingDate,
            crop: resolved.crop,
            cropLabel: resolved.label,
            reason: resolved.crop ? null : 'unsupported_crop',
        });
    }

    if (candidates.size === 0 && plantsLinkedToLand.length === 0) {
        add({ cropLabel: 'Sin cultivo registrado', reason: 'no_crop' });
    }
    return [...candidates.values()];
}

/**
 * Calcula un estado por lote y cultivo usando relaciones Asset+Log.
 *
 * Los sensores de humedad de suelo pueden confirmar o refinar el umbral en el
 * futuro, leyendo su log de observación vinculado al mismo asset--land. Este
 * cálculo climático no depende del sensor y no persiste una proyección.
 */
export function evaluateIrrigationByLot({
    lands = [],
    plants = [],
    seedingLogs = [],
    plantingLogs = [],
    harvestLogs = [],
    dailyWeather = [],
    today = null,
    windowDays = IRRIGATION_WINDOW_DAYS,
    weatherSource = null,
    weatherStale = false,
} = {}) {
    if (!Number.isInteger(windowDays) || windowDays < 1) return [];
    return lands
        .filter((land) => land?.id && (land.type === 'asset--land' || land.asset_type === 'land'))
        .flatMap((land) => {
            const candidates = buildCandidates(
                land,
                plants,
                seedingLogs,
                plantingLogs,
                harvestLogs,
                validIsoDate(today) ? today : '9999-12-31',
            );
            return candidates.map((candidate) => {
                if (candidate.reason) return noCalculation(candidate, candidate.reason);
                if (!validIsoDate(today)) return noCalculation(candidate, 'invalid_today');
                return evaluateCandidate(candidate, {
                    dailyWeather,
                    today,
                    windowDays,
                    weatherSource,
                    weatherStale,
                });
            });
        });
}

/** Convierte un balance sobre umbral en una alerta identificable por lote. */
export function buildIrrigationAlert(assessment, now = Date.now()) {
    if (!assessment?.shouldAlert || assessment.status !== 'needs_water') return null;
    const { metrics } = assessment;
    return {
        key: assessment.key,
        type: IRRIGATION_ALERT_TYPE,
        severity: 'warning',
        title: `Revise el riego en ${assessment.lotName}`,
        message: `${assessment.cropLabel}: déficit estimado de ${metrics.deficitMm} mm en ${assessment.windowDays} días. ETc ${metrics.etcMm} mm; lluvia registrada ${metrics.precipMm} mm; lluvia efectiva estimada ${metrics.effectiveRainMm} mm. Umbral de revisión ${metrics.thresholdMm} mm.`,
        timestamp: now,
        source: 'irrigation_balance',
        source_label: `${assessment.weatherSource}; ${assessment.kcSource}`,
        data: {
            lot_id: assessment.lotId,
            lot_name: assessment.lotName,
            crop: assessment.cropLabel,
            crop_key: assessment.cropKey,
            sowing_date: assessment.sowingDate,
            window_days: assessment.windowDays,
            window_start: assessment.windowStart,
            window_end: assessment.windowEnd,
            eto_mm: metrics.etoMm,
            kc_mean: metrics.kcMean,
            etc_mm: metrics.etcMm,
            precipitation_mm: metrics.precipMm,
            effective_rain_mm: metrics.effectiveRainMm,
            deficit_mm: metrics.deficitMm,
            threshold_mm: metrics.thresholdMm,
            formula: assessment.formula,
            rain_method: assessment.rainMethod,
            threshold_method: assessment.thresholdMethod,
            kc_source: assessment.kcSource,
            kc_source_url: assessment.sourceUrl,
            stages: assessment.stages,
            kc_by_stage: assessment.kcByStage,
        },
    };
}
