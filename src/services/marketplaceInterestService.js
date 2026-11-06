/** Consent creates an immutable CRM activity (ADR-019), not a new transport. */
import { newId } from '../utils/id.js';
import { openDB, STORES } from '../db/dbCore.js';
import { marketContext, isMarketContext } from './marketplaceOfferSync.js';
import { crmRemoteId, encodeCrmNotes, decodeCrmResource } from './crmTransport.js';
import { fetchFromFarmOS, sendToFarmOS, fetchWithAuthRetry } from './apiService.js';
import { parseOffer } from './marketplaceOfferContract.js';
import { assetCache } from '../db/assetCache.js';
import { logCache } from '../db/logCache.js';

export const INTEREST_TYPE = 'marketplace_interest';
const contactIdFor = (owner, buyer) => crmRemoteId(JSON.stringify(['market-buyer', owner, buyer]));

export async function queueMarketplaceInterest(offer, { consent, name, phone }) {
  if (consent !== true) return null;
  const context = marketContext();
  if (!context.owner || !offer.remoteId || !offer.owner || offer.demo || offer.owner === context.owner) {
    throw new Error('Seleccione una oferta publicada por otro productor.');
  }
  if (!name?.trim() || !/^[+\d ()-]{7,25}$/.test(phone || '')) throw new Error('Revise el nombre y el teléfono que desea compartir.');
  const id = newId();
  const contactId = await contactIdFor(offer.owner, context.owner);
  const timestamp = Math.floor(Date.now() / 1000);
  const resource = { id, type: 'log--activity', asset_id: contactId, attributes: {
    name: `Preguntó por ${offer.producto}`, timestamp, status: 'done', crm_interaction_type: 'mensaje',
    notes: `Preguntó por ${offer.producto}`, details: { marketplace_interest: {
      recipient: offer.owner, offerId: offer.remoteId, consent: true,
      contact: { name: name.trim(), phone: phone.trim() },
    } },
  } };
  const payload = { data: { id, type: 'log--activity', attributes: {
    name: resource.attributes.name, timestamp, status: 'done', notes: encodeCrmNotes(resource),
  }, relationships: { asset: { data: [{ type: 'asset--product', id: offer.remoteId }] } } } };
  const db = await openDB();
  if (!isMarketContext(context)) throw new Error('La cuenta del mercado cambió.');
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PENDING_TX, 'readwrite');
    tx.objectStore(STORES.PENDING_TX).add({ type: INTEREST_TYPE, marketContext: context,
      endpoint: '/api/log/activity', payload, timestamp: Date.now(), synced: false });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return id;
}

export async function syncMarketplaceInterest(transaction) {
  const current = () => isMarketContext(transaction.marketContext);
  if (!current()) throw new Error('La cuenta del mercado cambió.');
  const options = { contextIsCurrent: current };
  const endpoint = `/api/log/activity/${transaction.payload.data.id}`;
  try {
    const existing = await fetchFromFarmOS(endpoint, options);
    if (existing?.data?.id === transaction.payload.data.id) return existing;
  } catch (error) { if (error.status !== 404) throw error; }
  const result = await sendToFarmOS('/api/log/activity', transaction.payload, 'POST', options);
  if (result?.data?.id !== transaction.payload.data.id) throw new Error('El servidor no confirmó el interés.');
  return result;
}

/** Discover buyer-authored activities, verifying recipient against server offer ownership.
 * Only accepted records enter the producer's tenant cache. No server permission changes.
 */
export async function discoverMarketplaceInterests(tenant) {
  if (import.meta.env.VITE_DEMO_MODE === 'true') return;
  const context = marketContext();
  const current = () => context.owner === tenant && isMarketContext(context);
  const options = { contextIsCurrent: current };
  const offers = new Map();
  for (let offset = 0; ; offset += 50) {
    const query = new URLSearchParams({ include: 'uid', 'fields[user--user]': 'name',
      'filter[interest][condition][path]': 'notes.value', 'filter[interest][condition][operator]': 'CONTAINS',
      'filter[interest][condition][value]': '"marketplace_interest":',
      'page[limit]': '50', 'page[offset]': String(offset), sort: 'id' });
    const reply = await fetchWithAuthRetry(`${context.endpoint}/api/log/activity?${query}`, {
      headers: { Accept: 'application/vnd.api+json' }, signal: AbortSignal.timeout(15000),
    });
    if (!reply.ok) throw new Error(`No se pudieron leer los intereses (${reply.status}).`);
    const response = await reply.json();
    if (!Array.isArray(response.data)) throw new Error('El servidor no devolvió los intereses.');
    if (!current()) throw new Error('La cuenta del mercado cambió.');
    for (const remote of response.data || []) {
      const log = decodeCrmResource(remote);
      const interest = log.attributes?.details?.marketplace_interest;
      if (!log._crmSynced || interest?.consent !== true || interest.recipient !== tenant
        || !interest.contact?.name?.trim() || !interest.contact?.phone) continue;
      const buyer = response.included?.find(item => item.id === remote.relationships?.uid?.data?.id && item.type === 'user--user')?.attributes?.name;
      if (!buyer || log.asset_id !== await contactIdFor(tenant, buyer)) continue;
      const linked = remote.relationships?.asset?.data;
      if (!Array.isArray(linked) || !linked.some(item => item.type === 'asset--product' && item.id === interest.offerId)) continue;
      if (!offers.has(interest.offerId)) {
        const offer = await fetchFromFarmOS(`/api/asset/product/${interest.offerId}?include=uid&fields[user--user]=name`, options);
        offers.set(interest.offerId, parseOffer(offer.data, offer.included));
      }
      if (offers.get(interest.offerId)?.owner !== tenant) continue;
      if (!current()) throw new Error('La cuenta del mercado cambió.');
      const existing = await assetCache.getAsset(log.asset_id);
      let restored;
      if (!existing) {
        try {
          const remoteContact = await fetchFromFarmOS(`/api/asset/group/${log.asset_id}`, options);
          const decoded = decodeCrmResource(remoteContact.data);
          if (decoded.type === 'asset--person' && decoded.id === log.asset_id) restored = decoded;
        } catch (error) { if (error.status !== 404) throw error; }
      }
      if (!current()) throw new Error('La cuenta del mercado cambió.');
      if (!existing) await assetCache.put('person', restored ? { ...restored, _tenant_id: tenant } : { id: log.asset_id, type: 'asset--person', _tenant_id: tenant, _pending: true,
        attributes: { name: interest.contact.name, phone: interest.contact.phone,
          crm_contact_type: 'comprador', status: 'active', timestamp: log.timestamp } });
      await logCache.put({ ...log, _tenant_id: tenant });
    }
    if (!response.links?.next) break;
    if (offset >= 9950) throw new Error('Hay demasiadas interacciones para sincronizar.');
  }
}
