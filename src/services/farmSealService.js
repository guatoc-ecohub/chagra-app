/** Producer supplied claims. Validity is derived at display time, never stored. */
export const SEAL_NAMES = Object.freeze([
  'USDA Organic', 'JAS', 'Orgánico UE', 'Alimento Ecológico de Colombia',
  'Indicación Geográfica Protegida', '4C', 'Café de Colombia', 'Denominación de Origen', 'Eco Bag',
]);
const legacyNames = {
  '4c': '4C', rainforest_comercio_justo: 'Rainforest Alliance o Comercio Justo',
  denominacion_origen_igp: 'Denominación de Origen o Indicación Geográfica Protegida', bpa_ica: 'BPA (ICA)',
};
const own = (map, key) => typeof key === 'string' && Object.hasOwn(map, key) ? map[key] : '';
const organicNames = { USDA: 'USDA Organic', JAS: 'JAS', 'Unión Europea': 'Orgánico UE', 'Colombia (Alimento Ecológico)': 'Alimento Ecológico de Colombia' };
const text = value => typeof value === 'string' ? value.trim().slice(0, 250) : '';
const imagePattern = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export function normalizeSeals(values) {
  if (!Array.isArray(values)) return [];
  return values.slice(0, 40).flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const nombre = text(value.nombre) || (value.id === 'organico' ? own(organicNames, value.esquema) || 'Orgánico' : own(legacyNames, value.id)) || text(value.texto);
    if (!nombre) return [];
    return [{ ...(text(value.id) ? { id: text(value.id) } : {}),
      ...(text(value.esquema) ? { esquema: text(value.esquema) } : {}),
      ...(text(value.texto) ? { texto: text(value.texto) } : {}), nombre, estado: value.estado === 'certificado' ? 'certificado' : 'declarado',
      entidad: text(value.entidad), numero: text(value.numero), vigencia: text(value.vigencia),
      fotoDataUrl: typeof value.fotoDataUrl === 'string' && value.fotoDataUrl.length <= 1_500_000 && imagePattern.test(value.fotoDataUrl) ? value.fotoDataUrl : null }];
  });
}

/**
 * @param {object} seal
 * @param {Date|string} [today]
 */
export function sealStatus(seal, today = new Date()) {
  const [s] = normalizeSeals([seal]);
  if (!s || s.estado !== 'certificado') return 'declarado';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.vigencia)) return 'declarado';
  const expiry = new Date(`${s.vigencia}T23:59:59.999Z`);
  if (!Number.isFinite(expiry.getTime()) || expiry.toISOString().slice(0, 10) !== s.vigencia) return 'declarado';
  const date = typeof today === 'string' ? today.slice(0, 10) : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(today);
  if (s.vigencia < date) return 'vencido';
  return s.entidad && s.numero ? 'certificado' : 'declarado';
}
