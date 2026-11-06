const PHOTO_KEYS = ['photo_ref', 'photo_id', 'evidence_photo_ref', 'media_id', 'attachment_id'];

function valuesFrom(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

export function extractObservationSpeciesIds(log) {
  const attrs = log?.attributes || log?.payload || {};
  const ids = [
    ...valuesFrom(attrs.species_id),
    ...valuesFrom(attrs.species_ids),
    ...valuesFrom(log?.species_id),
  ];
  return ids
    .map((id) => (typeof id === 'object' ? id.id || id.value : id))
    .filter(Boolean)
    .map(String);
}

function relationshipIds(log, relationshipName) {
  const data = log?.relationships?.[relationshipName]?.data;
  return valuesFrom(data)
    .map((ref) => (typeof ref === 'object' ? ref.id : ref))
    .filter(Boolean)
    .map(String);
}

export function observationHasPhoto(log) {
  const attrs = log?.attributes || log?.payload || {};
  return PHOTO_KEYS.some((key) => attrs[key] != null || log?.[key] != null)
    || Boolean(attrs.photo || attrs.photos || attrs.attachments || log?.photo_ref)
    || relationshipIds(log, 'file').length > 0
    || relationshipIds(log, 'media').length > 0;
}

export function derivePhotoCoverage(species, observations, plants = []) {
  const speciesByPlantId = new Map();
  for (const plant of plants) {
    const slug = plant?.attributes?._speciesSlug || plant?.attributes?.species_slug || plant?.speciesSlug;
    if (slug) speciesByPlantId.set(plant?.id, slug);
  }
  const photographed = new Set(
    observations
      .filter(observationHasPhoto)
      .flatMap((observation) => [
        ...extractObservationSpeciesIds(observation),
        ...relationshipIds(observation, 'asset')
          .map((assetId) => speciesByPlantId.get(assetId))
          .filter(Boolean),
      ]),
  );
  const missing = species.filter((item) => !photographed.has(String(item.id)));
  return { missing, photographed, total: species.length };
}
