/**
 * cosechaService.js — CAPA DE DATOS de "Mi cosecha" (producción / rendimiento).
 *
 * FEATURE "Mi cosecha": registrar y VER cuánto produce la finca por cultivo y
 * por lote, y cómo cambia en el tiempo. Esta capa NO registra cosechas (eso ya
 * lo hace HarvestLog.jsx → savePayload('harvest') / useAssetStore.addHarvestLog):
 * solo AGREGA los `log--harvest` existentes y calcula rendimiento. Es pura y
 * determinista — la vista (dirección de arte) solo pinta los números que salen de aquí.
 *
 * ── Fuente de datos (grounded en farmOS, offline-first) ─────────────────────
 * Un registro de cosecha ES un `log--harvest`:
 *   - relationships.asset → el asset--plant (o asset--land) cosechado.
 *   - relationships.quantity / attributes.quantity → { value, unit, measure }.
 *   - attributes.timestamp → fecha (unix segundos o ISO).
 *   - attributes.name → "Cosecha de Fresa Monterrey" (de ahí sale el cultivo).
 *
 * `logCache.getByType('log--harvest')` entrega estos logs offline. El shape de
 * `quantity` varía según el origen (array JSON:API crudo, objeto aplanado, o
 * `{ value: { decimal } }`), así que `readHarvestQuantity` los normaliza todos.
 *
 * ── Rendimiento ─────────────────────────────────────────────────────────────
 *   - kg/planta  = total kg cosechado / nº de plantas del cultivo o lote.
 *   - kg/era (lote) = total kg de las plantas cuyo parent es el lote / área.
 *   - tendencia temporal = kg agregados por mes + pendiente (subiendo/bajando).
 */

import { TEMPORADA_POR_MES } from './temporadaFincaService';
import { farmosTimestamp } from './farmosLogContract';

export const HARVEST_LOG_TYPE = 'log--harvest';

// ── Normalización de unidades a kilogramos ──────────────────────────────────
// Incluye unidades campesinas colombianas (arroba = 12.5 kg, bulto, libra).
// Las unidades de CONTEO (unidades, manojos, racimos, …) NO son peso: se
// cuentan aparte, nunca se convierten a kg.

/** Factores unidad→kg. Claves normalizadas (lowercase, sin tilde, sin plural). */
const WEIGHT_TO_KG = {
  kg: 1,
  kilo: 1,
  kilogramo: 1,
  g: 0.001,
  gr: 0.001,
  gramo: 0.001,
  mg: 0.000001,
  t: 1000,
  tonelada: 1000,
  lb: 0.45359237,
  libra: 0.45359237,
  'kg (de arrobas)': 1, // registros históricos de voz ya guardados en kg
  '@': 12.5, // arroba colombiana (agrícola) = 12.5 kg
  arroba: 12.5,
  quintal: 50, // quintal colombiano ≈ 50 kg (4 arrobas)
  bulto: 50, // bulto/costal típico de café/grano ≈ 50 kg (aprox; varía)
  carga: 125, // carga = 10 arrobas = 125 kg (café pergamino)
};

/** Tabla visible de equivalencias usadas por el cálculo de rendimiento. */
export const HARVEST_UNIT_CONVERSIONS = Object.freeze([
  { unit: 'kg', label: 'Kilogramo', factorKg: 1 },
  { unit: 'g', label: 'Gramo', factorKg: 0.001 },
  { unit: 't', label: 'Tonelada', factorKg: 1000 },
  { unit: 'lb', label: 'Libra', factorKg: 0.45359237 },
  { unit: 'arroba', label: 'Arroba', factorKg: 12.5 },
  { unit: 'quintal', label: 'Quintal', factorKg: 50, approximate: true },
  { unit: 'bulto', label: 'Bulto', factorKg: 50, approximate: true },
  { unit: 'carga', label: 'Carga', factorKg: 125, approximate: true },
]);

/** Unidades de conteo conocidas (no son peso). */
const COUNT_UNITS = new Set([
  'unidad', 'und', 'u', 'manojo', 'atado', 'racimo', 'docena', 'ciento',
  'caja', 'canasta', 'balde', 'guacal', 'mata', 'planta', 'penca', 'cabeza',
]);

/**
 * Normaliza el string de una unidad: lowercase, sin tildes, singular simple.
 * @param {string} unit
 * @returns {string}
 */
export const normalizeUnit = (unit) => {
  if (!unit) return '';
  let u = String(unit).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (u === '@') return '@';
  // Plural español → singular. El caso "-es" va primero para que
  // "unidades"→"unidad" y "quintales"→"quintal" (no "unidade"/"quintale").
  if (u.endsWith('es') && u.length > 4) u = u.slice(0, -2);
  else if (u.endsWith('s') && u.length > 2) u = u.slice(0, -1);
  return u;
};

/**
 * Convierte (value, unit) a kilogramos.
 * @param {number} value
 * @param {string} unit
 * @returns {{ kg: number|null, isWeight: boolean }} kg=null si es unidad de conteo.
 */
export const toKilograms = (value, unit) => {
  const v = Number(value);
  if (!Number.isFinite(v)) return { kg: null, isWeight: false };
  const u = normalizeUnit(unit);
  if (Object.prototype.hasOwnProperty.call(WEIGHT_TO_KG, u)) {
    return { kg: v * WEIGHT_TO_KG[u], isWeight: true };
  }
  if (COUNT_UNITS.has(u)) return { kg: null, isWeight: false };
  // Sin unidad reconocida: asumimos que ya viene en kg si measure='weight' lo
  // dirá el caller; por defecto lo tratamos como conteo (no peso) para no
  // inventar kilos que no existen.
  return { kg: null, isWeight: false };
};

const relationshipIds = (relationship) => {
  const data = relationship?.data;
  if (Array.isArray(data)) return data.map((item) => item?.id).filter(Boolean);
  return data?.id ? [data.id] : [];
};

const firstRelationshipId = (relationship) => relationshipIds(relationship)[0] || null;

/** Normalización conservadora para comparar un cultivo con sus plantas. */
const normalizeCropName = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const cropNamesMatch = (left, right) => {
  const a = normalizeCropName(left);
  const b = normalizeCropName(right);
  return Boolean(a && b && (a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `)));
};

/**
 * Sugiere los lotes que sí contienen el cultivo. Un resultado único se puede
 * precargar; varios requieren elección humana y ninguno deja el log sin lote.
 * @param {string} cropName
 * @param {object[]} plants
 * @param {object[]} lands
 * @param {string|null} [cropSlug]
 * @returns {{status:'single'|'multiple'|'none', candidates:object[], loteId:string|null}}
 */
export const resolveHarvestLote = (cropName, plants = [], lands = [], cropSlug = null) => {
  const landById = new Map(lands.filter((land) => land?.id).map((land) => [land.id, land]));
  const matches = new Set();
  for (const plant of plants) {
    const relationship = plant?.relationships?.parent?.data ?? plant?.relationships?.location?.data;
    const loteId = Array.isArray(relationship) ? relationship[0]?.id : relationship?.id;
    if (!loteId || !landById.has(loteId)) continue;
    const attributes = plant?.attributes || {};
    const sameSlug = cropSlug && attributes._speciesSlug === cropSlug;
    const sameName = cropNamesMatch(cropName, attributes.name || plant?.name);
    if (sameSlug || sameName) matches.add(loteId);
  }
  const candidates = lands.filter((land) => matches.has(land.id)).map((land) => ({
    id: land.id,
    name: land.attributes?.name || land.name || 'Lote',
  }));
  return {
    status: candidates.length === 1 ? 'single' : candidates.length > 1 ? 'multiple' : 'none',
    candidates,
    loteId: candidates.length === 1 ? candidates[0].id : null,
  };
};

const assignmentNotes = (log) => {
  const notes = log?.attributes?.notes ?? log?.notes;
  return typeof notes === 'string' ? notes : notes?.value || '';
};

const harvestAssignmentTargets = (log) => {
  const notes = String(assignmentNotes(log));
  const single = notes.match(/^\[chagra:harvest-lote:v1\] cosecha=(.+)$/);
  if (single) return [single[1].trim()].filter(Boolean);
  const batch = notes.match(/^\[chagra:harvest-lote:v2\] cosechas=(.+)$/);
  return batch ? batch[1].split(',').map((id) => id.trim()).filter(Boolean) : [];
};

/** Convierte eventos de confirmación manual en un mapa en memoria. */
export const harvestLoteAssignments = (logs = []) => {
  const map = new Map();
  const timestampOf = (log) => {
    const raw = log.timestamp ?? log.attributes?.timestamp ?? 0;
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return numeric < 1e12 ? numeric * 1000 : numeric;
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const ordered = [...logs].sort((a, b) => timestampOf(a) - timestampOf(b));
  for (const log of ordered) {
    const harvestIds = harvestAssignmentTargets(log);
    const loteId = firstRelationshipId(log?.relationships?.asset)
      || firstRelationshipId(log?.relationships?.location);
    if (loteId) for (const harvestId of harvestIds) map.set(harvestId, loteId);
  }
  return map;
};

/** Construye un evento append-only que deja auditable una asignación, individual o por lote. */
export const buildHarvestLoteAssignment = (harvestIds, loteId, timestamp = Date.now()) => {
  const ids = [...new Set((Array.isArray(harvestIds) ? harvestIds : [harvestIds]).filter(Boolean))];
  const reference = ids.length === 1
    ? `[chagra:harvest-lote:v1] cosecha=${ids[0]}`
    : `[chagra:harvest-lote:v2] cosechas=${ids.join(',')}`;
  return {
    data: {
      type: 'log--observation',
      attributes: {
        name: 'Asignación manual de lote a cosecha',
        timestamp: farmosTimestamp(timestamp),
        status: 'done',
        notes: {
          value: reference,
          format: 'plain_text',
        },
      },
      relationships: {
        asset: { data: [{ type: 'asset--land', id: loteId }] },
      },
    },
  };
};

// ── Lectura robusta de la cantidad de un log--harvest ───────────────────────

/**
 * Extrae { value, unit, measure } de un log--harvest sin importar el shape.
 * Soporta: quantity aplanado {value,unit}, array [{...}], y {value:{decimal}}.
 * @param {object} log
 * @returns {{ value:number, unit:string|null, measure:string|null }}
 */
export const readHarvestQuantity = (log) => {
  let q = log?.quantity ?? log?.attributes?.quantity ?? null;
  if (Array.isArray(q)) q = q[0] || null;
  if (!q) return { value: 0, unit: null, measure: null };

  // El valor puede estar en q.value (número o {decimal}) o en q.attributes.value.
  const attrs = q.attributes || q;
  let raw = attrs.value;
  if (raw && typeof raw === 'object') raw = raw.decimal ?? raw.value ?? 0;
  const value = Number.parseFloat(raw);

  return {
    value: Number.isFinite(value) ? value : 0,
    unit: attrs.unit || attrs.label || null,
    measure: attrs.measure || null,
  };
};

/**
 * Deriva el nombre del cultivo desde el nombre del log de cosecha.
 * "Cosecha de Fresa Monterrey" → "Fresa Monterrey"
 * "Cosecha: Mora - 2026-07-01" → "Mora"
 * @param {string} name
 * @returns {string}
 */
export const cropLabelFromName = (name) => {
  if (!name) return 'Sin cultivo';
  let s = String(name).trim();
  s = s.replace(/^cosecha\s+de\s+/i, '');
  s = s.replace(/^cosecha\s*:\s*/i, '');
  s = s.replace(/^cosecha\s+/i, '');
  // Quitar sufijo " - fecha" (ISO o d/m/a).
  s = s.replace(/\s*[-–]\s*\d{1,4}[-/]\d{1,2}([-/]\d{1,4})?\s*$/, '');
  return s.trim() || 'Sin cultivo';
};

/** Clave normalizada de cultivo para agrupar (lowercase, sin tildes). */
const cropKey = (label) =>
  String(label || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Convierte un timestamp de log (unix seg o ISO) a milisegundos. */
const toMillis = (timestamp) => {
  if (timestamp == null) return null;
  if (typeof timestamp === 'number') {
    // Heurística: < 1e12 se asume en segundos.
    return timestamp < 1e12 ? timestamp * 1000 : timestamp;
  }
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : null;
};

/** 'YYYY-MM' de un timestamp en ms (UTC). */
const monthBucket = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/**
 * Normaliza un log--harvest a un registro plano de cosecha.
 * @param {object} log
 * @returns {object|null} null si no tiene cantidad utilizable.
 */
export const normalizeHarvestLog = (log) => {
  if (!log) return null;
  const { value, unit, measure } = readHarvestQuantity(log);
  if (!(value > 0)) return null;
  const { kg, isWeight } = toKilograms(value, unit);
  const ms = toMillis(log.timestamp ?? log.attributes?.timestamp);
  const label = cropLabelFromName(log.name || log.attributes?.name);
  const locationId = firstRelationshipId(log.relationships?.location)
    || log.location_id
    || log.attributes?.location_land_asset_id
    || null;
  return {
    id: log.id,
    assetId: log.asset_id ?? firstRelationshipId(log.relationships?.asset),
    assetIds: [...new Set([log.asset_id, ...relationshipIds(log.relationships?.asset)].filter(Boolean))],
    locationId,
    crop: label,
    cropKey: cropKey(label),
    value,
    unit: unit || null,
    measure: measure || null,
    kg: isWeight ? kg : null,
    isWeight,
    timestampMs: ms,
    month: ms != null ? monthBucket(ms) : null,
    status: log.status || log.attributes?.status || 'done',
  };
};

/**
 * Normaliza y filtra una lista de log--harvest.
 * @param {object[]} logs
 * @returns {object[]} registros de cosecha válidos.
 */
export const normalizeHarvests = (logs = []) =>
  logs.map(normalizeHarvestLog).filter(Boolean);

// ── Agregaciones ────────────────────────────────────────────────────────────

const emptyBucket = () => ({
  totalKg: 0,
  totalCount: 0, // suma de cantidades de unidades NO-peso (unidades, manojos…)
  harvestCount: 0, // nº de registros de cosecha
  weightHarvestCount: 0,
  countByUnit: {},
  unconvertedByUnit: {},
  firstMs: null,
  lastMs: null,
});

const foldInto = (bucket, h) => {
  bucket.harvestCount += 1;
  if (h.isWeight && h.kg != null) {
    bucket.totalKg += h.kg;
    bucket.weightHarvestCount += 1;
  }
  else if (COUNT_UNITS.has(normalizeUnit(h.unit))) {
    bucket.totalCount += h.value;
    const unit = h.unit || 'unidad';
    const count = bucket.countByUnit[unit] || { quantity: 0, records: 0 };
    count.quantity += h.value;
    count.records += 1;
    bucket.countByUnit[unit] = count;
  }
  else {
    const unit = h.unit || 'sin unidad';
    const unconverted = bucket.unconvertedByUnit[unit] || { quantity: 0, records: 0 };
    unconverted.quantity += h.value;
    unconverted.records += 1;
    bucket.unconvertedByUnit[unit] = unconverted;
  }
  if (h.timestampMs != null) {
    if (bucket.firstMs == null || h.timestampMs < bucket.firstMs) bucket.firstMs = h.timestampMs;
    if (bucket.lastMs == null || h.timestampMs > bucket.lastMs) bucket.lastMs = h.timestampMs;
  }
};

/**
 * Agrega por cultivo.
 * @param {object[]} norm - salida de normalizeHarvests.
 * @returns {Array<{crop:string, cropKey:string, totalKg:number, totalCount:number, harvestCount:number, firstMs:number|null, lastMs:number|null}>}
 *   ordenado por totalKg desc.
 */
export const aggregateByCrop = (norm = []) => {
  const map = new Map();
  for (const h of norm) {
    if (!map.has(h.cropKey)) map.set(h.cropKey, { crop: h.crop, cropKey: h.cropKey, ...emptyBucket() });
    foldInto(map.get(h.cropKey), h);
  }
  return Array.from(map.values()).sort((a, b) => b.totalKg - a.totalKg || b.totalCount - a.totalCount);
};

/**
 * Agrega por asset cosechado (planta individual o land).
 * @param {object[]} norm
 * @returns {Array<{assetId:string, totalKg:number, totalCount:number, harvestCount:number, firstMs:number|null, lastMs:number|null}>}
 */
export const aggregateByAsset = (norm = []) => {
  const map = new Map();
  for (const h of norm) {
    if (h.assetId == null) continue;
    if (!map.has(h.assetId)) map.set(h.assetId, { assetId: h.assetId, ...emptyBucket() });
    foldInto(map.get(h.assetId), h);
  }
  return Array.from(map.values()).sort((a, b) => b.totalKg - a.totalKg);
};

/**
 * Mapa assetId → loteId, resolviendo parent/location de cada planta.
 * @param {object[]} plants
 * @returns {Map<string,string>}
 */
const buildPlantLoteMap = (plants = []) => {
  const map = new Map();
  for (const p of plants) {
    const rel = p.relationships?.parent?.data ?? p.relationships?.location?.data;
    const loteId = Array.isArray(rel) ? rel[0]?.id : rel?.id;
    if (p.id && loteId) map.set(p.id, loteId);
  }
  return map;
};

const relatedHarvestLoteIds = (harvest, landIds, plantLote) => {
  const assetIds = harvest.assetIds?.length ? harvest.assetIds : [harvest.assetId].filter(Boolean);
  if (!assetIds.length) return [];
  return assetIds.map((assetId) => plantLote.get(assetId)
    || (landIds.has(assetId) ? assetId : null));
};

const harvestLoteId = (harvest, ctx, landIds, plantLote) => {
  const assigned = ctx.assignmentByHarvest?.get(harvest.id);
  if (assigned && landIds.has(assigned)) return assigned;
  const explicitLocation = landIds.has(harvest.locationId) ? harvest.locationId : null;
  if (explicitLocation) return explicitLocation;
  const lotIds = relatedHarvestLoteIds(harvest, landIds, plantLote);
  if (!lotIds.length) return null;
  if (lotIds.some((loteId) => !loteId)) return null;
  const uniqueLots = new Set(lotIds);
  return uniqueLots.size === 1 ? [...uniqueLots][0] : null;
};

const seasonForHarvest = (timestampMs) => {
  if (!Number.isFinite(timestampMs)) return null;
  const date = new Date(timestampMs);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const seasonId = TEMPORADA_POR_MES[month - 1]?.temporadaId;
  if (seasonId === 'aguas1') return { key: `${year}-aguas1`, label: `Aguas abr–may ${year}`, order: Date.UTC(year, 3, 1) };
  if (seasonId === 'secas1') return { key: `${year}-secas1`, label: `Secas jun–ago ${year}`, order: Date.UTC(year, 5, 1) };
  if (seasonId === 'aguas2') return { key: `${year}-aguas2`, label: `Aguas oct–nov ${year}`, order: Date.UTC(year, 9, 1) };
  if (seasonId === 'secas2') {
    const seasonYear = month === 12 ? year : year - 1;
    return {
      key: `${seasonYear}-secas2`,
      label: `Secas dic–feb ${seasonYear}/${seasonYear + 1}`,
      order: Date.UTC(seasonYear, 11, 1),
    };
  }
  const monthName = month === 3 ? 'mar' : 'sep';
  return { key: `${year}-transicion-${month}`, label: `Transición ${monthName} ${year}`, order: Date.UTC(year, month - 1, 1) };
};

/**
 * Agrega por lote (era/potrero) + calcula rendimiento espacial.
 * Suma las cosechas de las plantas cuyo parent es el lote, MÁS las cosechas
 * cuyo asset_id es el lote directamente. Rinde kg/planta y kg/ha con el área
 * del polígono del lote (si la tiene) y el nº de plantas asignadas.
 *
 * @param {object[]} norm - registros normalizados.
 * @param {{plants?:object[], lands?:object[], areaOf?:(lote:object)=>number}} ctx
 *   - areaOf: función para calcular área (m²) de un lote; se inyecta desde
 *     loteService.loteAreaSqMeters para evitar acoplar este módulo a geo.
 * @returns {Array<object>} por lote: { loteId, name, totalKg, totalCount, harvestCount, plantCount, areaM2, kgPerPlant, kgPerHa, kgPerM2 }
 */
export const aggregateByLote = (norm = [], ctx = {}) => {
  const plants = ctx.plants || [];
  const lands = ctx.lands || [];
  const areaOf = ctx.areaOf || (() => 0);

  const plantLote = buildPlantLoteMap(plants);
  const landIds = new Set(lands.map((l) => l.id));
  const plantCountByLote = new Map();
  for (const loteId of plantLote.values()) {
    plantCountByLote.set(loteId, (plantCountByLote.get(loteId) || 0) + 1);
  }

  const map = new Map();
  const ensure = (loteId) => {
    if (!map.has(loteId)) map.set(loteId, { loteId, ...emptyBucket() });
    return map.get(loteId);
  };

  for (const h of norm) {
    if (h.assetId == null) continue;
    // La cosecha puede colgar de una planta (→ su lote) o del lote directo.
    const loteId = harvestLoteId(h, ctx, landIds, plantLote);
    if (!loteId) continue;
    foldInto(ensure(loteId), h);
  }

  for (const h of norm) {
    if (h.assetId != null) continue;
    const loteId = harvestLoteId(h, ctx, landIds, plantLote);
    if (!loteId) continue;
    foldInto(ensure(loteId), h);
  }

  const landById = new Map(lands.map((l) => [l.id, l]));
  return Array.from(map.values()).map((b) => {
    const lote = landById.get(b.loteId) || null;
    const areaM2 = lote ? areaOf(lote) : 0;
    const plantCount = plantCountByLote.get(b.loteId) || 0;
    return {
      ...b,
      name: lote?.attributes?.name || lote?.name || 'Lote',
      plantCount,
      areaM2,
      kgPerPlant: plantCount > 0 ? b.totalKg / plantCount : null,
      kgPerHa: areaM2 > 0 ? b.totalKg / (areaM2 / 10000) : null,
      kgPerM2: areaM2 > 0 ? b.totalKg / areaM2 : null,
    };
  }).sort((a, b) => b.totalKg - a.totalKg);
};

/** Rendimiento por lote, cultivo y temporada campesina con respaldo de registros. */
export const aggregateByLoteSeasonCrop = (norm = [], ctx = {}) => {
  const plants = ctx.plants || [];
  const lands = ctx.lands || [];
  const areaOf = ctx.areaOf || (() => 0);
  const landIds = new Set(lands.map((land) => land.id));
  const plantLote = buildPlantLoteMap(plants);
  const landById = new Map(lands.map((land) => [land.id, land]));
  const buckets = new Map();

  for (const harvest of norm) {
    const loteId = harvestLoteId(harvest, ctx, landIds, plantLote);
    const season = seasonForHarvest(harvest.timestampMs);
    if (!loteId || !season) continue;
    const key = `${loteId}|${season.key}|${harvest.cropKey}`;
    if (!buckets.has(key)) {
      const land = landById.get(loteId);
      const areaM2 = land ? areaOf(land) : 0;
      buckets.set(key, {
        loteId,
        lote: land?.attributes?.name || land?.name || 'Lote',
        seasonKey: season.key,
        season: season.label,
        seasonOrder: season.order,
        crop: harvest.crop,
        cropKey: harvest.cropKey,
        areaM2,
        ...emptyBucket(),
      });
    }
    foldInto(buckets.get(key), harvest);
  }

  const rows = [...buckets.values()].map((bucket) => ({
    ...bucket,
    kgPerHa: bucket.areaM2 > 0 && bucket.totalKg > 0
      ? bucket.totalKg / (bucket.areaM2 / 10000)
      : null,
  }));
  const rowsByLotCrop = new Map();
  for (const row of rows) {
    const key = `${row.loteId}|${row.cropKey}`;
    if (!rowsByLotCrop.has(key)) rowsByLotCrop.set(key, []);
    rowsByLotCrop.get(key).push(row);
  }
  for (const group of rowsByLotCrop.values()) {
    const chronological = group.sort((a, b) => a.seasonOrder - b.seasonOrder);
    let previousComparable = null;
    for (const row of chronological) {
      row.previousSeason = previousComparable?.season || null;
      row.previousWeightHarvestCount = previousComparable?.weightHarvestCount || 0;
      row.deltaKgPerHa = row.kgPerHa != null && previousComparable?.kgPerHa != null
        ? row.kgPerHa - previousComparable.kgPerHa
        : null;
      row.deltaPct = row.deltaKgPerHa != null && previousComparable.kgPerHa > 0
        ? (row.deltaKgPerHa / previousComparable.kgPerHa) * 100
        : null;
      row.direction = row.deltaKgPerHa == null
        ? null
        : row.deltaKgPerHa > 0 ? 'subiendo' : row.deltaKgPerHa < 0 ? 'bajando' : 'estable';
      if (row.kgPerHa != null) previousComparable = row;
    }
  }
  return rows.sort((a, b) => b.seasonOrder - a.seasonOrder
    || a.lote.localeCompare(b.lote)
    || a.crop.localeCompare(b.crop));
};

/** Mejor rendimiento por cultivo en la temporada más reciente con peso convertible. */
export const bestLotByCrop = (seasonalYields = []) => {
  const latestOrderByCrop = new Map();
  for (const row of seasonalYields) {
    const previous = latestOrderByCrop.get(row.cropKey);
    if (row.kgPerHa != null && (previous == null || row.seasonOrder > previous)) {
      latestOrderByCrop.set(row.cropKey, row.seasonOrder);
    }
  }
  const bestByCrop = new Map();
  for (const row of seasonalYields) {
    if (row.kgPerHa == null || row.seasonOrder !== latestOrderByCrop.get(row.cropKey)) continue;
    const previous = bestByCrop.get(row.cropKey);
    if (!previous || row.kgPerHa > previous.kgPerHa) bestByCrop.set(row.cropKey, row);
  }
  return [...bestByCrop.values()].sort((a, b) => a.crop.localeCompare(b.crop));
};

/**
 * Rendimiento kg/planta por cultivo (total kg del cultivo / nº de plantas de
 * ese cultivo). Empareja por nombre de especie del asset con el cultivo del log.
 *
 * @param {object[]} norm
 * @param {object[]} plants
 * @returns {Array<{crop:string, totalKg:number, plantCount:number, kgPerPlant:number|null}>}
 */
export const yieldPerPlantByCrop = (norm = [], plants = []) => {
  const byCrop = aggregateByCrop(norm);
  // Contar plantas por cultivo (clave normalizada del nombre del asset).
  const plantCountByCrop = new Map();
  for (const p of plants) {
    const k = cropKey(p.attributes?.name || p.name);
    if (!k) continue;
    plantCountByCrop.set(k, (plantCountByCrop.get(k) || 0) + 1);
  }
  return byCrop.map((c) => {
    // match laxo: el cultivo del log incluye o coincide con el nombre de la planta.
    let plantCount = plantCountByCrop.get(c.cropKey) || 0;
    if (plantCount === 0) {
      for (const [pk, count] of plantCountByCrop) {
        if (pk.includes(c.cropKey) || c.cropKey.includes(pk)) { plantCount += count; }
      }
    }
    return {
      crop: c.crop,
      totalKg: c.totalKg,
      plantCount,
      kgPerPlant: plantCount > 0 ? c.totalKg / plantCount : null,
    };
  });
};

// ── Tendencia temporal ──────────────────────────────────────────────────────

/** Pendiente de mínimos cuadrados de una serie y[] (x = índice). */
const leastSquaresSlope = (ys) => {
  const n = ys.length;
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sx += i; sy += ys[i]; sxy += i * ys[i]; sxx += i * i;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  return (n * sxy - sx * sy) / denom;
};

/**
 * Serie temporal de cosecha por mes + dirección de la tendencia.
 * @param {object[]} norm
 * @returns {{ series: Array<{period:string, totalKg:number, totalCount:number, harvestCount:number}>, slope:number, direction:'subiendo'|'bajando'|'estable' }}
 */
export const temporalTrend = (norm = []) => {
  const map = new Map();
  for (const h of norm) {
    if (!h.month) continue;
    if (!map.has(h.month)) map.set(h.month, { period: h.month, ...emptyBucket() });
    foldInto(map.get(h.month), h);
  }
  const series = Array.from(map.values())
    .map(({ period, totalKg, totalCount, harvestCount }) => ({ period, totalKg, totalCount, harvestCount }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const useKg = series.some((s) => s.totalKg > 0);
  const ys = series.map((s) => (useKg ? s.totalKg : s.totalCount));
  const slope = leastSquaresSlope(ys);
  const magnitude = ys.length ? Math.max(...ys) : 0;
  // Umbral relativo para no marcar tendencia por ruido mínimo.
  const eps = magnitude * 0.05;
  /** @type {'subiendo'|'bajando'|'estable'} */
  let direction = 'estable';
  if (slope > eps) direction = 'subiendo';
  else if (slope < -eps) direction = 'bajando';
  return { series, slope, direction };
};

/**
 * Totales de la TEMPORADA (año calendario en curso) + comparación simple del
 * último mes con datos contra el mes anterior con datos. Derivado 100% de la
 * serie mensual de temporalTrend — no toca los logs.
 *
 * @param {Array<{period:string,totalKg:number,totalCount:number,harvestCount:number}>} series
 *   serie mensual ORDENADA ascendente (salida de temporalTrend).
 * @param {Date} [now] - inyectable para tests; default hoy.
 * @returns {{
 *   year:string, seasonKg:number, seasonCount:number, seasonHarvests:number,
 *   monthsWithData:number, usesKg:boolean,
 *   lastMonth:object|null, prevMonth:object|null,
 *   deltaKg:number|null, deltaPct:number|null
 * }}
 */
export const seasonStats = (series = [], now = new Date()) => {
  const year = String(now.getUTCFullYear());
  const inYear = series.filter((s) => s.period.startsWith(`${year}-`));
  const sum = (arr, key) => arr.reduce((acc, s) => acc + (s[key] || 0), 0);

  // Comparación: último mes con datos vs el anterior CON datos (la vista
  // muestra ambos periodos para que la comparación sea honesta aunque haya
  // meses vacíos en medio).
  const lastMonth = series.length ? series[series.length - 1] : null;
  const prevMonth = series.length > 1 ? series[series.length - 2] : null;
  const usesKg = series.some((s) => s.totalKg > 0);
  const valueOf = (s) => (usesKg ? s.totalKg : s.totalCount);

  let deltaKg = null;
  let deltaPct = null;
  if (lastMonth && prevMonth) {
    deltaKg = valueOf(lastMonth) - valueOf(prevMonth);
    const base = valueOf(prevMonth);
    deltaPct = base > 0 ? (deltaKg / base) * 100 : null;
  }

  return {
    year,
    seasonKg: sum(inYear, 'totalKg'),
    seasonCount: sum(inYear, 'totalCount'),
    seasonHarvests: sum(inYear, 'harvestCount'),
    monthsWithData: inYear.length,
    usesKg,
    lastMonth,
    prevMonth,
    deltaKg,
    deltaPct,
  };
};

// ── Resumen compuesto (lo que la vista pinta) ───────────────────────────────

/**
 * Resumen completo de "Mi cosecha" a partir de los log--harvest.
 * @param {object[]} logs - log--harvest crudos (de logCache.getByType).
 * @param {{plants?:object[], lands?:object[], areaOf?:(lote:object)=>number, assignmentLogs?:object[], now?:Date}} ctx
 *   - now: inyectable para tests de temporada; default hoy.
 * @returns {object} { totalKg, totalHarvests, cropCount, byCrop, byLote, yieldPerPlant, trend, season, topCrop, dateRange }
 */
export const harvestSummary = (logs = [], ctx = {}) => {
  const norm = normalizeHarvests(logs);
  const assignmentByHarvest = harvestLoteAssignments(ctx.assignmentLogs || []);
  const context = { ...ctx, assignmentByHarvest };
  const byCrop = aggregateByCrop(norm);
  const byLote = aggregateByLote(norm, context);
  const byLoteSeasonCrop = aggregateByLoteSeasonCrop(norm, context);
  const bestByCrop = bestLotByCrop(byLoteSeasonCrop);
  const plants = ctx.plants || [];
  const lands = ctx.lands || [];
  const landIds = new Set(lands.map((land) => land.id));
  const plantLote = buildPlantLoteMap(plants);
  const unassignedHarvests = norm.filter((harvest) => !harvestLoteId(harvest, context, landIds, plantLote))
    .map((harvest) => {
      const relatedLotes = new Set(relatedHarvestLoteIds(harvest, landIds, plantLote).filter(Boolean));
      return {
        ...harvest,
        allocationAmbiguous: !harvest.locationId && relatedLotes.size > 1,
        suggestedLotes: resolveHarvestLote(harvest.crop, plants, lands).candidates,
      };
    });
  const yieldPerPlant = yieldPerPlantByCrop(norm, ctx.plants || []);
  const trend = temporalTrend(norm);
  const season = seasonStats(trend.series, ctx.now);

  const totalKg = norm.reduce((acc, h) => acc + (h.kg || 0), 0);
  const allMs = norm.map((h) => h.timestampMs).filter((m) => m != null);

  return {
    totalKg,
    totalHarvests: norm.length,
    cropCount: byCrop.length,
    byCrop,
    byLote,
    byLoteSeasonCrop,
    bestByCrop,
    unassignedHarvests,
    yieldPerPlant,
    trend,
    season,
    topCrop: byCrop[0] || null,
    dateRange: allMs.length
      ? { firstMs: Math.min(...allMs), lastMs: Math.max(...allMs) }
      : { firstMs: null, lastMs: null },
  };
};

export default {
  HARVEST_LOG_TYPE,
  normalizeUnit,
  HARVEST_UNIT_CONVERSIONS,
  toKilograms,
  resolveHarvestLote,
  harvestLoteAssignments,
  buildHarvestLoteAssignment,
  readHarvestQuantity,
  cropLabelFromName,
  normalizeHarvestLog,
  normalizeHarvests,
  aggregateByCrop,
  aggregateByAsset,
  aggregateByLote,
  aggregateByLoteSeasonCrop,
  bestLotByCrop,
  yieldPerPlantByCrop,
  temporalTrend,
  seasonStats,
  harvestSummary,
};
