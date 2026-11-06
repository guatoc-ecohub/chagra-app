import { newId } from '../utils/id.js';
import { getProfile } from '../services/userProfileService';
import { normalizeSeals } from '../services/farmSealService';
/** Offline offer cache + atomic outbox. farmOS asset--product is the durable
 * public listing; this store never persists a derived inventory (ADR-019).
 */
import { openDB, STORES } from './dbCore';
import { getActiveTenantId } from '../services/tenantContext';
import { useFincaActiveStore } from '../services/fincaActiveStore';
import { OFFER_TYPE, offerPayload } from '../services/marketplaceOfferContract';

/**
 * @typedef {object} OfferRecord
 * @property {Array<object>} [sellos]
 * @property {string} id
 * @property {string} [remoteId]
 * @property {string} [productTypeId]
 * @property {number} [revision]
 * @property {number} [createdAt]
 * @property {{owner: string|null, endpoint: string}} [marketContext]
 * @property {string|null} [owner]
 * @property {boolean} [shared]
 * @property {boolean} [withdrawn]
 * @property {boolean} [pending]
 * @property {boolean} [published]
 * @property {boolean} [syncError]
 * @property {string} [producto]
 * @property {number} [cantidad]
 * @property {string} [unidad]
 * @property {string} [categoria]
 * @property {number|null} [precio]
 * @property {string} [moneda]
 * @property {string} [finca]
 * @property {string} [vereda]
 * @property {string} [municipio]
 * @property {string} [contactoTel]
 * @property {string} [nota]
 * @property {string|null} [fotoDataUrl]
 * @property {boolean} [demo]
 * @property {string|null} [sourcePlantId]
 * @property {string|null} [sourceHarvestLogId]
 */

export function nuevaOfertaId() {
  return `oferta-${newId()}`;
}
const contextNow = () => ({ owner: getActiveTenantId(), endpoint: useFincaActiveStore.getState().getActiveEndpoint() });
const sameContext = (a, b) => a?.owner === b.owner && a?.endpoint === b.endpoint;
const visible = (record, context) => record.shared
  ? sameContext(record.marketContext, context)
  : (record.marketContext ? sameContext(record.marketContext, context) : !context.owner);

/** @returns {Promise<OfferRecord[]>} */
async function allRecords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORES.MARKETPLACE_OFERTAS, 'readonly').objectStore(STORES.MARKETPLACE_OFERTAS).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export const marketplaceOfertas = {
  /** @returns {Promise<OfferRecord>} */
  async save(oferta) {
    const context = contextNow();
    const previous = oferta.id ? await this.get(oferta.id) : null;
    if ((previous?.shared && previous.owner !== context.owner) || (previous?.marketContext && !sameContext(previous.marketContext, context))) {
      throw new Error('Solo puede cambiar sus propias ofertas.');
    }
    const record = {
      moneda: 'COP', ...oferta, sellos: normalizeSeals(getProfile().sellos),
      id: previous?.shared ? nuevaOfertaId() : (oferta.id || nuevaOfertaId()),
      remoteId: previous?.remoteId || newId(),
      productTypeId: previous?.productTypeId || newId(),
      revision: (previous?.revision || 0) + 1,
      createdAt: previous?.createdAt || oferta.createdAt || Date.now(),
      marketContext: context, owner: context.owner,
      pending: !!context.owner, shared: false, demo: false, syncError: false,
    };
    const db = await openDB();
    if (!sameContext(context, contextNow())) throw new Error('La cuenta del mercado cambió.');
    return new Promise((resolve, reject) => {
      const stores = [STORES.MARKETPLACE_OFERTAS, ...(context.owner ? [STORES.PENDING_TX] : [])];
      const tx = db.transaction(stores, 'readwrite');
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      try {
        tx.objectStore(STORES.MARKETPLACE_OFERTAS).put(record);
        if (context.owner) tx.objectStore(STORES.PENDING_TX).add({
          type: OFFER_TYPE, endpoint: '/api/asset/product', payload: offerPayload(record),
          marketContext: context, localOfferId: record.id, remoteId: record.remoteId,
          timestamp: Date.now(), synced: false,
        });
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  },

  async getAll() {
    const context = contextNow();
    const records = (await allRecords()).filter(record => visible(record, context));
    const ownIds = new Set(records.filter(record => !record.shared).map(record => record.remoteId));
    return records.filter(record => !record.withdrawn && !(record.shared && ownIds.has(record.remoteId)))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  /** @returns {Promise<OfferRecord|null>} */
  async get(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORES.MARKETPLACE_OFERTAS, 'readonly').objectStore(STORES.MARKETPLACE_OFERTAS).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async remove(id) {
    const record = await this.get(id);
    if (!record) return;
    if (!visible(record, contextNow()) || (record.shared && record.owner !== getActiveTenantId())) throw new Error('Solo puede retirar sus propias ofertas.');
    if (record.marketContext?.owner) {
      await this.save({ ...record, withdrawn: true });
      return;
    }
    // A legacy local-only draft has never been sent to farmOS.
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MARKETPLACE_OFERTAS, 'readwrite');
      tx.objectStore(STORES.MARKETPLACE_OFERTAS).delete(id);
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });
  },

  async count() { return (await this.getAll()).length; },

  async acknowledge(transaction, failed = false) {
    const db = await openDB();
    const revision = JSON.parse(transaction.payload.data.attributes.notes.value).revision;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MARKETPLACE_OFERTAS, 'readwrite');
      const store = tx.objectStore(STORES.MARKETPLACE_OFERTAS);
      const req = store.get(transaction.localOfferId);
      req.onsuccess = () => {
        const record = req.result;
        if (record && record.revision === revision && sameContext(record.marketContext, transaction.marketContext)) {
          store.put({ ...record, pending: failed, published: failed ? record.published : true, syncError: failed });
        }
      };
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },

  async replaceShared(offers, context) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MARKETPLACE_OFERTAS, 'readwrite');
      const store = tx.objectStore(STORES.MARKETPLACE_OFERTAS);
      const req = store.getAll();
      req.onsuccess = () => {
        if (!sameContext(context, contextNow())) return;
        for (const record of req.result) {
          if (record.shared && sameContext(record.marketContext, context)) store.delete(record.id);
        }
        for (const offer of offers) store.put({ ...offer,
          id: `shared:${JSON.stringify(context)}:${offer.remoteId}`, shared: true, pending: false, marketContext: context });
      };
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },
};
