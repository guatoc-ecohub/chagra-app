import { assetCache } from '../db/assetCache';
import { getActiveTenantId } from './tenantContext';

// Presupuesto conservador en bytes UTF-8, sin depender de un codificador remoto.
// La lista contiene vocabulario, nunca ejemplos de frases con lugares sugeridos.
export const MAX_PROMPT_BYTES = 200;
const BASE = 'Vocabulario: matas, bultos, arbolitos, plántulas.';
const bytes = value => new TextEncoder().encode(value).length;
const clean = value => typeof value === 'string'
  ? value.replace(/[^\p{L}\p{N} -]/gu, ' ').replace(/\s+/g, ' ').trim()
  : '';

/** Construye contexto efímero exclusivamente con assets de la cuenta activa. */
export async function getVoiceVocabulary() {
  const tenant = getActiveTenantId();
  if (!tenant) return BASE;
  try {
    const [lands, structures, plants] = await Promise.all([
      assetCache.getByType('land'),
      assetCache.getByType('structure'),
      assetCache.getByType('plant'),
    ]);
    // Revalidar después del await, por si cambió la cuenta durante la lectura.
    if (getActiveTenantId() !== tenant) return BASE;
    const names = assets => [...new Set(assets
      // Legacy sin propietario verificable se omite, aunque la caché lo permita.
      .filter(asset => asset._tenant_id === tenant)
      .map(asset => clean(asset.attributes?.name))
      .filter(Boolean))];
    const places = names([...lands, ...structures]);
    const crops = names(plants);
    const seen = new Set();
    let prompt = BASE;
    // Alternar evita que muchos lugares agoten todo el espacio de los cultivos.
    for (let i = 0; i < Math.max(places.length, crops.length); i++) {
      for (const name of [places[i], crops[i]]) {
        if (!name || seen.has(name.toLocaleLowerCase('es'))) continue;
        seen.add(name.toLocaleLowerCase('es'));
        const candidate = `${prompt} ${name}.`;
        if (bytes(candidate) <= MAX_PROMPT_BYTES) prompt = candidate;
      }
    }
    return prompt;
  } catch {
    // Una caché no disponible no cambia el manejo de errores/reintentos de voz.
    return BASE;
  }
}
