import { newId } from '../utils/id.js';
import { fetchWithAuthRetry, fetchFromFarmOS, sendToFarmOS } from './apiService';
import { getActiveTenantId } from './tenantContext';
import { useFincaActiveStore } from './fincaActiveStore';
import { marketplaceOfertas } from '../db/marketplaceOfertas';
import { OFFER_PREFIX, parseOffer } from './marketplaceOfferContract';
import { CATEGORIAS } from '../data/marketplaceSeed';

export function marketContext() {
  return { owner: getActiveTenantId(), endpoint: useFincaActiveStore.getState().getActiveEndpoint() };
}

export function isMarketContext(context) {
  const now = marketContext();
  return !!context?.owner && context.owner === now.owner && context.endpoint === now.endpoint;
}

const authorQuery = '?include=uid&fields[user--user]=name';

/** farmOS requires a product_type term. Resolve the category chosen in the
 * form, creating it only if absent. The queued UUID survives lost responses.
 */
async function resolveProductType(payload, options) {
  const category = JSON.parse(payload.data.attributes.notes.value).oferta.categoria;
  const name = CATEGORIAS.find(item => item.id === category)?.label || 'Productos de la finca';
  const endpoint = '/api/taxonomy_term/product_type';
  const found = await fetchFromFarmOS(`${endpoint}?filter[name]=${encodeURIComponent(name)}&page[limit]=1`, options);
  if (found?.data?.[0]?.id) return found.data[0].id;
  const id = payload.data.relationships?.product_type?.data?.id || newId();
  try {
    const existing = await fetchFromFarmOS(`${endpoint}/${id}`, options);
    if (existing?.data?.id === id) return id;
  } catch (error) { if (error.status !== 404) throw error; }
  const created = await sendToFarmOS(endpoint, {
    data: { type: 'taxonomy_term--product_type', id, attributes: { name } },
  }, 'POST', options);
  if (created?.data?.id !== id) throw new Error('El servidor no confirmó la categoría.');
  return id;
}

/** Idempotent POST/PATCH. A lost response is recovered by UUID, never duplicated.
 * The server assigns uid from the authenticated session. Do not trust notes for ownership.
 */
export async function syncMarketplaceOffer(transaction) {
  const context = transaction.marketContext;
  if (!isMarketContext(context)) throw new Error('La cuenta del mercado cambió.');
  const options = { contextIsCurrent: () => isMarketContext(context) };
  const id = transaction.payload.data.id;
  const endpoint = `/api/asset/product/${id}`;
  let existing;
  try { existing = await fetchFromFarmOS(endpoint + authorQuery, options); }
  catch (error) { if (error.status !== 404) throw error; }
  if (!isMarketContext(context)) throw new Error('La cuenta del mercado cambió.');
  if (existing?.data) {
    const offer = parseOffer(existing.data, existing.included);
    if (!offer || offer.owner !== context.owner) throw new Error('No se puede modificar esta oferta.');
    const wanted = JSON.parse(transaction.payload.data.attributes.notes.value);
    // Older queued revisions must not resurrect an already withdrawn offer.
    if (offer.revision >= wanted.revision) {
      await marketplaceOfertas.acknowledge(transaction);
      return existing;
    }
  }
  const payload = structuredClone(transaction.payload);
  if (!existing?.data) {
    const productTypeId = await resolveProductType(payload, options);
    payload.data.relationships = { product_type: { data: { type: 'taxonomy_term--product_type', id: productTypeId } } };
  } else {
    // Preserve the server's required classification when withdrawing from a new phone.
    delete payload.data.relationships;
  }
  const result = await sendToFarmOS(existing?.data ? endpoint : '/api/asset/product',
    payload, existing?.data ? 'PATCH' : 'POST', options);
  if (result?.data?.id !== id) throw new Error('El servidor no confirmó la oferta.');
  await marketplaceOfertas.acknowledge(transaction);
  return result;
}

/** Shared catalogue only: deliberately outside the private farm's uid filter.
 * Sparse fields + publication marker + active status; no plants/logs/inventory requests.
 * Page links from the server are not followed to another origin.
 */
export async function refreshMarketplaceOffers() {
  const context = marketContext();
  if (!context.owner || !navigator.onLine) return false;
  const offers = [];
  for (let offset = 0; ; offset += 50) {
    const query = new URLSearchParams({
      'filter[market][condition][path]': 'name',
      'filter[market][condition][operator]': 'STARTS_WITH',
      'filter[market][condition][value]': OFFER_PREFIX,
      'filter[status]': 'active',
      'fields[asset--product]': 'name,status,notes,uid',
      'fields[user--user]': 'name', include: 'uid',
      'page[limit]': '50', 'page[offset]': String(offset), sort: 'id',
    });
    if (!isMarketContext(context)) return false;
    const response = await fetchWithAuthRetry(`${context.endpoint}/api/asset/product?${query}`, {
      headers: { Accept: 'application/vnd.api+json' }, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Market request failed (${response.status}).`);
    const body = await response.json();
    if (!Array.isArray(body.data)) throw new Error('El servidor no devolvió las ofertas.');
    for (const entity of body.data) {
      const offer = parseOffer(entity, body.included);
      if (offer && !offer.withdrawn) offers.push(offer);
    }
    if (!body.links?.next) break;
    if (offset >= 9950) throw new Error('El catálogo es demasiado grande para actualizarlo completo.');
  }
  if (!isMarketContext(context)) return false;
  await marketplaceOfertas.replaceShared(offers, context);
  return true;
}
