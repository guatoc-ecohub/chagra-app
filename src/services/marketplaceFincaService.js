/**
 * Derivaciones de finca que alimentan el mercado.
 *
 * La planta y el log de cosecha siguen siendo la fuente de verdad. Esta
 * función solo construye propuestas en memoria; no escribe campos derivados
 * en el asset ni en el log.
 */

import { FENOLOGY_CATALOG } from '../data/fenologySpecies';

const UNIT_MAP = Object.freeze({
  kg: 'kg',
  kilogramo: 'kg',
  kilogramos: 'kg',
  g: 'kg',
  gramo: 'kg',
  gramos: 'kg',
  lb: 'libra',
  libra: 'libra',
  libras: 'libra',
  unidades: 'unidad',
  unidad: 'unidad',
});

function numberFromQuantity(log) {
  const quantity = log?.quantity || log?.attributes?.quantity;
  const item = Array.isArray(quantity) ? quantity[0] : quantity;
  const raw = item?.value?.decimal ?? item?.value ?? item?.attributes?.value?.decimal ?? item?.attributes?.value;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function unitFromQuantity(log) {
  const quantity = log?.quantity || log?.attributes?.quantity;
  const item = Array.isArray(quantity) ? quantity[0] : quantity;
  return String(item?.unit || item?.label || item?.attributes?.unit || item?.attributes?.label || '').toLowerCase();
}

function assetName(plant) {
  return String(plant?.attributes?.name || plant?.name || '').replace(/\s+#\d+$/, '').trim();
}

function speciesName(plant) {
  const slug = plant?.attributes?._speciesSlug || plant?.attributes?.species_slug || plant?.speciesSlug;
  return FENOLOGY_CATALOG.find((species) => species.id === slug)?.nombre_comun || '';
}

function isGenericPlantName(name) {
  return /^(?:la\s+)?planta(?:\s+sin\s+nombre)?$/i.test(name.trim());
}

function categoryFor(name) {
  const value = name.toLowerCase();
  if (/mora|fresa|uchuva|tomate de arbol|maracuya|frut/.test(value)) return 'fruta';
  if (/papa|yuca|cebolla|zanahoria|remolacha/.test(value)) return 'tuberculo';
  if (/maiz|quinua|trigo|arroz/.test(value)) return 'grano';
  return 'hortaliza';
}

/**
 * @param {Array<object>} plants
 * @param {Array<object>} harvestLogs
 * @param {Array<object>} publishedOffers
 * @returns {Array<object>} propuestas sin persistir, una por cosecha.
 */
export function deriveHarvestOffers(plants = [], harvestLogs = [], publishedOffers = []) {
  const publishedHarvestIds = new Set(
    publishedOffers.map((offer) => offer.sourceHarvestLogId).filter(Boolean),
  );
  const plantsById = new Map(plants.filter(Boolean).map((plant) => [plant.id, plant]));

  const seenHarvestIds = new Set();

  return harvestLogs
    .filter((log) => {
      if (!log?.id || seenHarvestIds.has(log.id)) return false;
      seenHarvestIds.add(log.id);
      return log.type === 'log--harvest' && !publishedHarvestIds.has(log.id);
    })
    .map((log) => {
      const plantId = log.asset_id || log.relationships?.asset?.data?.[0]?.id;
      const plant = plantsById.get(plantId);
      const nombreAsset = assetName(plant);
      const nombreLog = String(log.name || '').replace(/^Cosecha:\s*/i, '').replace(/\s+-\s+\d{4}-\d{2}-\d{2}$/, '').trim();
      const producto = (nombreAsset && !isGenericPlantName(nombreAsset) ? nombreAsset : '')
        || (nombreLog && !isGenericPlantName(nombreLog) ? nombreLog : '')
        || speciesName(plant);
      const cantidad = numberFromQuantity(log);
      const unidad = UNIT_MAP[unitFromQuantity(log)] || 'kg';
      if (!producto || !cantidad) return null;
      return {
        sourcePlantId: plantId || null,
        sourceHarvestLogId: log.id,
        producto,
        categoria: categoryFor(producto),
        cantidad,
        unidad,
        precio: '',
        finca: '',
        vereda: '',
        municipio: '',
        contactoTel: '',
        nota: 'Propuesta desde la cosecha registrada. Revise la cantidad y publique cuando esté lista.',
      };
    })
    .filter(Boolean);
}
