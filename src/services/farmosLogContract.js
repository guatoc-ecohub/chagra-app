import { parseDateTimestamp } from '../utils/dateFormatter';

/**
 * Contrato de escritura de logs hacia farmOS (JSON:API). farmOS responde 422 si
 * el payload trae un atributo que el bundle no tiene o una fecha fuera de sus
 * formatos aceptados ("U", "Y-m-d\TH:i:sO", "Y-m-d\TH:i:sP"). Aquí vive la
 * lista de atributos de `log--observation` y el normalizador de fecha, para que
 * los constructores de payload y el envío compartan la misma regla.
 */

const LOG_BASE_ATTRIBUTES = [
  'name', 'timestamp', 'status', 'notes', 'flag', 'geometry',
  'is_movement', 'is_group_assignment', 'data',
];

/** Atributos que farmOS 4.x acepta por bundle. Un bundle ausente no se valida. */
export const LOG_ATTRIBUTES_BY_BUNDLE = {
  'log--observation': LOG_BASE_ATTRIBUTES,
  'log--maintenance': LOG_BASE_ATTRIBUTES,
};

const ACCEPTED_TIMESTAMP_STRING = /^(\d{10}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{4}|[+-]\d{2}:\d{2}))$/;

/** Verdadero si farmOS acepta el valor tal cual como `timestamp` de un log. */
export function isAcceptedTimestamp(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 && value < 1e11;
  return typeof value === 'string' && ACCEPTED_TIMESTAMP_STRING.test(value);
}

/** Segundos Unix (entero) desde segundos, milisegundos, ISO o Date. `null` si no es una fecha. */
export function farmosTimestamp(value) {
  const date = value instanceof Date ? value : parseDateTimestamp(value);
  if (!date || !Number.isFinite(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

/** Atributos del payload que su bundle no tiene. Lista vacía si el bundle no está catalogado. */
export function unknownLogAttributes(type, attributes) {
  const accepted = LOG_ATTRIBUTES_BY_BUNDLE[type];
  if (!accepted) return [];
  return Object.keys(attributes || {}).filter((key) => !key.startsWith('_') && !accepted.includes(key));
}

/**
 * Copia del payload lista para enviar: fecha en un formato aceptado y sin los
 * atributos que el bundle no tiene. No toca payloads que no sean un log.
 */
export function prepareLogForFarmOS(payload) {
  const data = payload?.data;
  if (!data || typeof data.type !== 'string' || !data.type.startsWith('log--') || !data.attributes) return payload;
  const attributes = { ...data.attributes };
  for (const key of unknownLogAttributes(data.type, attributes)) delete attributes[key];
  if ('timestamp' in attributes && !isAcceptedTimestamp(attributes.timestamp)) {
    const seconds = farmosTimestamp(attributes.timestamp);
    if (seconds != null) attributes.timestamp = seconds;
  }
  return { ...payload, data: { ...data, attributes } };
}

/**
 * `log--observation` no tiene atributo `severity`: la severidad viaja como
 * primera línea de las notas. 'info' es el valor por defecto y no se escribe.
 */
export function notasConSeveridad(notes, severity) {
  const text = typeof notes === 'string' ? notes : '';
  if (!severity || severity === 'info') return text;
  return text ? `Severidad: ${severity}\n${text}` : `Severidad: ${severity}`;
}

/**
 * Cantidades. En farmOS `quantity` NO es un atributo del log: es una relación a
 * entidades `quantity--standard`, cuyo `value` es un campo fracción que se
 * escribe como `{ decimal: "12" }`. Un log con `attributes.quantity` recibe 422
 * («relationship fields were provided as attributes») y una cantidad con
 * `value: 12` recibe 500 al crearse. Dentro de la app la cantidad sí viaja
 * aplanada (`{ value, unit }`) porque la leen las vistas locales; la forma de
 * farmOS se arma aquí, justo antes de enviar.
 */
const QUANTITY_MEASURES = new Set([
  'count', 'length', 'weight', 'area', 'volume', 'time', 'temperature',
  'pressure', 'water_content', 'value', 'rate', 'rating', 'ratio', 'probability', 'speed',
]);

/** @type {Array<[RegExp, string]>} */
const UNIT_MEASURE = [
  [/^(kg|kgs|kilo|kilos|kilogramos?|g|gr|grs|gramos?|lb|lbs|libras?|arrobas?|@|t|ton|toneladas?|bultos? de \d+ ?kg)$/i, 'weight'],
  [/^(l|lt|lts|litros?|ml|mililitros?|galon|galón|galones|cc|cm3)$/i, 'volume'],
  [/^(unidad|unidades|und|unds|u|plántulas?|plantulas?|plantas?|matas?|frutos?|racimos?|docenas?|atados?)$/i, 'count'],
];

/** Medida de farmOS que corresponde a una unidad escrita por el usuario; `null` si no se reconoce. */
export function measureForUnit(unit) {
  const text = typeof unit === 'string' ? unit.trim() : '';
  if (!text) return null;
  const match = UNIT_MEASURE.find(([pattern]) => pattern.test(text));
  return match ? match[1] : null;
}

/** `{ decimal: "12.5" }` desde número, texto con coma o `{ decimal }`. `null` si no es un número positivo. */
export function quantityDecimal(value) {
  const raw = value && typeof value === 'object' ? value.decimal ?? value.value : value;
  const number = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(number) || number <= 0) return null;
  return { decimal: String(number) };
}

/**
 * Item de relación `quantity--standard` listo para crearse en línea, desde la
 * forma aplanada de la app (`{ value, unit, label, measure }`) o desde un item
 * en línea ya armado. Una referencia con id se devuelve igual. `null` si la
 * cantidad no tiene un valor positivo: farmOS no debe guardar «0 kg».
 */
export function quantityStandardItem(quantity) {
  if (!quantity || typeof quantity !== 'object') return null;
  if (quantity.id && !quantity.attributes) return quantity;
  const source = quantity.attributes && typeof quantity.attributes === 'object' ? quantity.attributes : quantity;
  const value = quantityDecimal(source.value);
  if (!value) return null;
  const unit = [source.unit, source.label].find((text) => typeof text === 'string' && text.trim() && !QUANTITY_MEASURES.has(text.trim()));
  const measure = measureForUnit(unit)
    || (QUANTITY_MEASURES.has(source.measure) ? source.measure : 'count');
  const attributes = { measure, value, ...(unit ? { label: unit.trim() } : {}) };
  if (source === quantity) return { type: 'quantity--standard', attributes };
  // Un item en línea conserva su id y sus marcas internas (`_create`): con ellas
  // el reintento reutiliza la misma entidad en vez de crear otra.
  return { ...quantity, type: 'quantity--standard', attributes };
}

/**
 * Copia del payload con toda cantidad de un log en la forma de farmOS: la que
 * viene en `attributes.quantity` pasa a `relationships.quantity`, y cada item en
 * línea queda con `value: { decimal }` y una medida válida. No muta el original
 * y devuelve tal cual lo que no es un log.
 */
export function prepareLogQuantities(payload) {
  const data = payload?.data;
  if (!data || typeof data.type !== 'string' || !data.type.startsWith('log--')) return payload;
  const attributes = { ...(data.attributes || {}) };
  const fromAttributes = attributes.quantity;
  delete attributes.quantity;
  const relationships = { ...(data.relationships || {}) };
  const current = relationships.quantity?.data;
  const items = [
    ...(Array.isArray(current) ? current : current ? [current] : []),
    ...(Array.isArray(fromAttributes) ? fromAttributes : fromAttributes ? [fromAttributes] : []),
  ].map(quantityStandardItem).filter(Boolean);
  if (items.length) relationships.quantity = { data: items };
  else delete relationships.quantity;
  const next = { ...data, attributes };
  if (Object.keys(relationships).length) next.relationships = relationships;
  else delete next.relationships;
  return { ...payload, data: next };
}

/** @type {Array<[RegExp, string]>} */
const FARMOS_REASONS = [
  [/relationship fields were provided as attributes/i, 'la app mandó un dato con la forma equivocada'],
  [/does not exist on (the|this)\b/i, 'la app mandó un campo que el servidor no conoce'],
  [/timestamp|date.*format|formato.*fecha/i, 'la fecha no tiene un formato válido'],
  [/(este valor no puede ser nulo|this value should not be null|cannot be null|is required)/i, 'falta un dato obligatorio'],
  [/(access denied|forbidden|not allowed|permission)/i, 'su cuenta no tiene permiso para guardar esto'],
  [/(already exists|conflict|duplicate)/i, 'ese registro ya existe en el servidor'],
];

/**
 * Motivo en español, para mostrar al usuario, de un detalle de error de farmOS.
 * Nunca devuelve el texto del servidor: lo que no se reconoce da `null` y la
 * interfaz se queda con el mensaje general.
 */
export function motivoLegibleFarmOS(detail) {
  if (typeof detail !== 'string' || !detail.trim()) return null;
  const match = FARMOS_REASONS.find(([pattern]) => pattern.test(detail));
  return match ? match[1] : null;
}
