import { newId } from '../utils/id.js';
import { openDB, STORES } from '../db/dbCore';
import { assetCache } from '../db/assetCache';
import { logCache } from '../db/logCache';
import { fetchFromFarmOS } from './apiService';
import { getActiveTenantId } from './tenantContext';
import { syncManager } from './syncManager';
import { requestBackgroundSync } from './syncRequest';
import { LOT_MARKER, EVENT_MARKER, PRODUCT_MARKER, SPECIES, HOUSING, EVENTS, recordNotes, readRecord, animalCount, validateCount, validateMovement, farmTimestamp } from './animalLotModel';

const changed = () => window.dispatchEvent(new Event('animalLotsChanged'));
const assetRef = (asset) => ({ type: asset.type, id: asset.id });
function makeEvent(lot, kind, count) {
  return {
    id: newId(), type: kind === 'birth' ? 'log--birth' : 'log--activity',
    attributes: { name: `${EVENTS[kind]}: ${lot.attributes.name}`, timestamp: farmTimestamp(), status: 'done', notes: recordNotes(EVENT_MARKER, { lotId: lot.id, kind, count }) },
    relationships: { asset: { data: [assetRef(lot)] } },
  };
}

// A single IDB transaction persists assets, logs and their outbox together.
async function commit(records) {
  const tenant = getActiveTenantId();
  if (!tenant) throw new Error('Entre a su cuenta antes de guardar el lote.');
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.ASSETS, STORES.LOGS, STORES.TAXONOMY, STORES.PENDING_TX], 'readwrite');
    tx.oncomplete = () => resolve(undefined);
    tx.onabort = tx.onerror = () => reject(tx.error);
    records.forEach((record, i) => {
      const [entity, bundle] = record.type.split('--');
      const cached = { ...record, _tenant_id: tenant, _pending: true, cached_at: Date.now() };
      if (entity === 'asset') tx.objectStore(STORES.ASSETS).put({ ...cached, asset_type: bundle });
      else if (entity === 'taxonomy_term') tx.objectStore(STORES.TAXONOMY).put(cached);
      else tx.objectStore(STORES.LOGS).put({ ...cached, asset_id: record.relationships.asset.data[0].id, timestamp: record.attributes.timestamp, name: record.attributes.name, status: 'done' });
      tx.objectStore(STORES.PENDING_TX).put({ id: record.id, type: `animal_lot_${bundle}`, endpoint: `/api/${entity}/${bundle}`, method: 'POST', payload: { data: record }, _dependsOn: Object.values(record.relationships || {}).flatMap(rel => Array.isArray(rel.data) ? rel.data.map(ref => ref.id) : [rel.data.id]), _tenant_id: tenant, timestamp: Date.now() + i, retries: 0, synced: false });
    });
  });
  changed();
  requestBackgroundSync();
  if (navigator.onLine) void syncManager.syncAll();
}

export async function createAnimalLot({ name, species, housing, count }) {
  if (!name?.trim()) throw new Error('Póngale un nombre al lote.');
  const hasHousing = housing !== '' && housing !== null && housing !== undefined;
  if (!SPECIES.includes(species) || (hasHousing && !HOUSING.includes(housing))) throw new Error('Elija la especie y cómo viven.');
  const amount = validateCount(count);
  const lot = { id: newId(), type: 'asset--group', attributes: { name: name.trim(), status: 'active', notes: recordNotes(LOT_MARKER, { species, housing: hasHousing ? housing : null }) } };
  await commit([lot, makeEvent(lot, 'initial', amount)]);
  return lot;
}

export async function recordAnimalMovement(lotId, kind, value) {
  const lot = await assetCache.getAsset(lotId);
  if (!lot || lot._tenant_id !== getActiveTenantId() || !readRecord(lot, LOT_MARKER)) throw new Error('No se encontró el lote en su cuenta.');
  const count = validateMovement(kind, value, animalCount(lotId, await logCache.getAll()));
  await commit([makeEvent(lot, kind, count)]);
}

export async function createAnimalProduct({ lotId, date, weight, batch }) {
  const lot = await assetCache.getAsset(lotId);
  if (!lot || lot._tenant_id !== getActiveTenantId() || !readRecord(lot, LOT_MARKER)) throw new Error('Elija el lote de animales del que salió.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Escriba la fecha de elaboración.');
  if (!Number.isFinite(Number(weight)) || Number(weight) <= 0) throw new Error('Escriba un peso mayor que cero, en kilos.');
  if (!batch?.trim()) throw new Error('Escriba el número de lote del producto.');
  const terms = await assetCache.getAllTaxonomyTerms();
  const existingTerm = terms.find(term => term.type === 'taxonomy_term--material_type' && term.attributes?.name === 'Carne curada');
  const term = existingTerm || { id: newId(), type: 'taxonomy_term--material_type', attributes: { name: 'Carne curada' } };
  const product = { id: newId(), type: 'asset--material', attributes: { name: `Carne curada: ${batch.trim()}`, status: 'active', notes: recordNotes(PRODUCT_MARKER, { date, weight: Number(weight), batch: batch.trim(), sourceLotId: lotId }) }, relationships: { material_type: { data: assetRef(term) }, parent: { data: [assetRef(lot)] } } };
  const log = { id: newId(), type: 'log--harvest', attributes: { name: product.attributes.name, timestamp: farmTimestamp(new Date(`${date}T12:00:00Z`)), lot_number: batch.trim(), status: 'done', notes: recordNotes(PRODUCT_MARKER, { productId: product.id, sourceLotId: lotId, date, weight: Number(weight), batch: batch.trim() }) }, relationships: { asset: { data: [assetRef(lot), assetRef(product)] } } };
  await commit([...(existingTerm ? [] : [term]), product, log]);
  return product;
}

export async function loadAnimalLots() {
  // Legacy internal products remain readable; new inventory uses material only.
  const [lots, materials, legacyProducts, logs] = await Promise.all([assetCache.getByType('group'), assetCache.getByType('material'), assetCache.getByType('product'), logCache.getAll()]);
  const products = [...materials, ...legacyProducts];
  return { lots: lots.filter(lot => readRecord(lot, LOT_MARKER)), products: products.filter(product => readRecord(product, PRODUCT_MARKER)), logs };
}

async function fetchAll(endpoint) {
  const records = [];
  let next = endpoint + '?page[limit]=50';
  while (next) {
    const result = await fetchFromFarmOS(next);
    records.push(...(result.data || []));
    const href = result.links?.next?.href;
    if (!href) break;
    const url = new URL(href, window.location.origin);
    if (!url.pathname.startsWith(endpoint)) throw new Error('La página siguiente no corresponde al lote.');
    next = url.pathname + url.search;
  }
  return records;
}

export async function pullAnimalLots() {
  if (!navigator.onLine) return;
  const tenant = getActiveTenantId();
  const [groups, materials, products, activities, births, harvests, terms] = await Promise.all(['asset/group', 'asset/material', 'asset/product', 'log/activity', 'log/birth', 'log/harvest', 'taxonomy_term/material_type'].map(path => fetchAll('/api/' + path)));
  if (tenant !== getActiveTenantId()) return;
  await Promise.all([assetCache.bulkPut('group', groups), assetCache.bulkPut('material', materials), assetCache.bulkPut('product', products), logCache.bulkPut('log--activity', activities), logCache.bulkPut('log--birth', births), logCache.bulkPut('log--harvest', harvests)]);
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TAXONOMY, 'readwrite');
    terms.forEach(term => tx.objectStore(STORES.TAXONOMY).put(term));
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
  });
  changed();
}

if (typeof window !== 'undefined') {
  window.addEventListener('syncCompleted', async (event) => {
    const detail = /** @type {CustomEvent} */ (event).detail;
    if (!detail?.type?.startsWith('animal_lot_')) return;
    const db = await openDB();
    const tx = db.transaction([STORES.ASSETS, STORES.LOGS, STORES.TAXONOMY], 'readwrite');
    for (const storeName of [STORES.ASSETS, STORES.LOGS, STORES.TAXONOMY]) {
      const store = tx.objectStore(storeName);
      const req = store.get(detail.id);
      req.onsuccess = () => { if (req.result) store.put({ ...req.result, _pending: false }); };
    }
    tx.oncomplete = changed;
  });
}
