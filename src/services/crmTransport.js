/** CRM transport v1, using existing group/activity fields (Asset+Log, ADR-019). */
const MARKER = 'chagra_crm';

export const encodeCrmNotes = (resource) => ({
  value: JSON.stringify({
    [MARKER]: 1,
    id: resource.id,
    kind: resource.type === 'asset--person' ? 'contact' : 'interaction',
    attributes: resource.attributes,
    contactId: resource.asset_id || null,
  }),
  format: 'plain_text',
});

export function decodeCrmResource(resource) {
  try {
    const envelope = JSON.parse(resource.attributes?.notes?.value || '');
    if (envelope[MARKER] !== 1 || !envelope.id || !envelope.attributes) return resource;
    const contact = envelope.kind === 'contact' && resource.type === 'asset--group';
    const interaction = envelope.kind === 'interaction' && ['log--activity', 'log--task'].includes(resource.type);
    if (!contact && !interaction) return resource;
    return {
      ...resource,
      id: envelope.id,
      type: contact ? 'asset--person' : 'log--activity',
      attributes: envelope.attributes,
      asset_id: envelope.contactId,
      timestamp: envelope.attributes.timestamp,
      _crmRemoteId: resource.id,
      _crmSynced: true,
      _pending: false,
      ...(interaction && { relationships: { asset: { data: { id: envelope.contactId, type: 'asset--person' } } } }),
    };
  } catch { return resource; }
}

/** Stable UUID for historical ULIDs: retry after a lost response cannot duplicate. */
export async function crmRemoteId(localId) {
  if (/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(localId)) return localId;
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`chagra-crm-v1:${localId}`)));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes.slice(0, 16)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
