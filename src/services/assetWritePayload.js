/**
 * FarmOS computes asset.location from movement logs and does not persist writes
 * to it. Keep asset writes limited to writable relationships and preserve the
 * active farm through the writable parent reference for newly created plants.
 */
export function prepareAssetWritePayload(payload, { landId = null, method = 'POST' } = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  const prepared = structuredClone(payload);
  const create = method === 'POST';

  const visit = (resource) => {
    if (!resource || typeof resource !== 'object') return;
    if (typeof resource.type === 'string' && resource.type.startsWith('asset--')) {
      if (resource.attributes && typeof resource.attributes === 'object') {
        delete resource.attributes.geometry;
      }
      if (resource.relationships && typeof resource.relationships === 'object') {
        delete resource.relationships.location;
      }
      // Solo una planta que se crea (trae atributos) recibe la finca como
      // padre; una referencia {type, id} dentro de un log apunta a una planta
      // existente y debe viajar como identificador limpio.
      if (resource.type === 'asset--plant' && create && landId && resource.attributes) {
        const parent = resource.relationships?.parent?.data;
        const hasParent = Array.isArray(parent) ? parent.some((ref) => ref?.id) : Boolean(parent?.id);
        if (!hasParent) {
          resource.relationships = {
            ...(resource.relationships || {}),
            parent: { data: [{ type: 'asset--land', id: landId }] },
          };
        }
      }
      if (resource.relationships && Object.keys(resource.relationships).length === 0) {
        delete resource.relationships;
      }
    }

    for (const relationship of Object.values(resource.relationships || {})) {
      const data = relationship?.data;
      for (const related of Array.isArray(data) ? data : [data]) visit(related);
    }
  };

  visit(prepared.data);
  return prepared;
}
