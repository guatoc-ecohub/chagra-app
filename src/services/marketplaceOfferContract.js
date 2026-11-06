import { normalizeSeals } from './farmSealService';
/** Public offer contract on the existing farmOS product bundle (ADR-019).
 * This is an explicit sale listing, never a projection of farm inventory.
 * Private plant/log references and inferred quantities never leave the device.
 */
export const OFFER_PREFIX = 'Chagra oferta: ';
export const OFFER_TYPE = 'marketplace_offer';
const PUBLIC_FIELDS = ['producto', 'categoria', 'cantidad', 'unidad', 'precio', 'moneda',
  'finca', 'vereda', 'municipio', 'contactoTel', 'nota', 'fotoDataUrl', 'createdAt', 'sellos'];

export function offerPayload(offer) {
  const published = Object.fromEntries(PUBLIC_FIELDS.map(key => [key, offer[key] ?? null]));
  published.sellos = normalizeSeals(offer.sellos);
  return { data: {
    type: 'asset--product', id: offer.remoteId,
    relationships: { product_type: { data: { type: 'taxonomy_term--product_type', id: offer.productTypeId } } },
    attributes: {
      name: OFFER_PREFIX + offer.producto,
      status: offer.withdrawn ? 'archived' : 'active',
      notes: { format: 'plain_text', value: JSON.stringify({
        chagra_market_offer: 1, revision: offer.revision, oferta: published,
      }) },
    },
  } };
}

export function parseOffer(entity, included = []) {
  if (entity?.type !== 'asset--product' || !entity.attributes?.name?.startsWith(OFFER_PREFIX)) return null;
  try {
    const notes = JSON.parse(entity.attributes.notes?.value || '');
    const o = notes.oferta;
    if (notes.chagra_market_offer !== 1 || !o || typeof o.producto !== 'string'
      || !o.producto.trim() || !Number.isFinite(o.cantidad) || o.cantidad <= 0
      || typeof o.unidad !== 'string' || !o.unidad) return null;
    if (!Number.isInteger(notes.revision) || notes.revision < 1) return null;
    if (o.precio != null && (!Number.isFinite(o.precio) || o.precio < 0)) return null;
    const textFields = ['producto', 'categoria', 'unidad', 'moneda', 'finca', 'vereda', 'municipio', 'contactoTel', 'nota'];
    if (textFields.some(key => o[key] != null && typeof o[key] !== 'string')) return null;
    const authorId = entity.relationships?.uid?.data?.id;
    const author = included.find(item => item.type === 'user--user' && item.id === authorId);
    const offer = Object.fromEntries(PUBLIC_FIELDS.map(key => [key, o[key] ?? null]));
    offer.sellos = normalizeSeals(o.sellos);
    // Only embedded image formats that cannot execute scripts are accepted.
    if (typeof offer.fotoDataUrl !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(offer.fotoDataUrl)) offer.fotoDataUrl = null;
    return { ...offer, sellos: offer.sellos, fotoDataUrl: offer.fotoDataUrl, id: entity.id, remoteId: entity.id, revision: notes.revision,
      owner: author?.attributes?.name || null, demo: false,
      withdrawn: entity.attributes.status !== 'active', pending: false, shared: true };
  } catch { return null; }
}
