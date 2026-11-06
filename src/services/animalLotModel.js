// ADR-019: animal counts are projections of immutable logs, never asset fields.
export const LOT_MARKER = '[CHAGRA_ANIMAL_LOT_V1]';
export const EVENT_MARKER = '[CHAGRA_ANIMAL_EVENT_V1]';
export const PRODUCT_MARKER = '[CHAGRA_ANIMAL_PRODUCT_V1]';
export const SPECIES = ['Cerdos', 'Corderos', 'Ovejas', 'Cabras', 'Ovejas o cabras', 'Gallinas o pollos', 'Ganado (vacas)', 'Otros'];
export const HOUSING = ['Cochera', 'Corral', 'Pastoreo'];
export const EVENTS = { initial: 'Registro inicial', birth: 'Nacieron', sale: 'Se vendieron', slaughter: 'Salieron a sacrificio' };

export function readRecord(entity, marker) {
  const notes = entity?.attributes?.notes;
  const text = typeof notes === 'string' ? notes : notes?.value;
  if (!text?.startsWith(marker + '\n')) return null;
  try { return JSON.parse(text.slice(marker.length + 1)); } catch { return null; }
}

export function recordNotes(marker, data) {
  return { value: marker + '\n' + JSON.stringify(data), format: 'plain_text' };
}

export function animalCount(lotId, logs) {
  const seen = new Set();
  return logs.reduce((total, log) => {
    if (seen.has(log.id)) return total;
    seen.add(log.id);
    const event = readRecord(log, EVENT_MARKER);
    if (!event || event.lotId !== lotId || log.metadata?.ai?.needs_human_review || log.attributes?.metadata?.ai?.needs_human_review) return total;
    const refs = log.relationships?.asset?.data || [];
    if (!refs.some(ref => ref.id === lotId)) return total;
    if (!Number.isSafeInteger(event.count) || event.count <= 0) return total;
    if (event.kind === 'initial' || event.kind === 'birth') return total + event.count;
    if (event.kind === 'sale' || event.kind === 'slaughter') return total - event.count;
    return total;
  }, 0);
}

export function validateCount(value) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count <= 0) throw new Error('Escriba un número entero de animales, mayor que cero.');
  return count;
}

export function validateMovement(kind, value, available) {
  if (!['birth', 'sale', 'slaughter'].includes(kind)) throw new Error('Elija qué pasó con el lote.');
  const count = validateCount(value);
  if (kind !== 'birth' && count > available) throw new Error(`En el lote hay ${available} animales. No pueden salir más.`);
  return count;
}

export function farmTimestamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}
