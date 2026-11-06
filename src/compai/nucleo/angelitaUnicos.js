/** Cuatro señales propias de Angelita. Datos y reglas puras, sin red ni UI. */
/**
 * @typedef {Object} RegistroAngelita
 * @property {string} [event_type]
 * @property {string} [tipo]
 * @property {number} [timestampMs]
 * @property {string|number} [timestamp]
 * @property {string} [date]
 * @property {boolean} [florecio]
 * @property {{event_type?: string, tipo?: string, metodo?: string, proximidad?: string}} [metadata]
 * @property {{metadata?: {event_type?: string, tipo?: string, metodo?: string, proximidad?: string}, timestamp?: string|number}} [attributes]
 */
function metadataDe(registro) {
  return registro?.metadata || registro?.attributes?.metadata || {};
}

function eventoDe(registro) {
  return registro?.event_type
    || registro?.tipo
    || metadataDe(registro).event_type
    || metadataDe(registro).tipo
    || null;
}

function fechaDe(registro) {
  const raw = registro?.timestampMs
    ?? registro?.timestamp
    ?? registro?.attributes?.timestamp
    ?? registro?.date;
  if (Number.isFinite(raw)) return raw > 1e12 ? raw : raw * 1000;
  const parsed = Date.parse(raw || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function tieneFechaConfirmada(registro) {
  return Number.isFinite(fechaDe(registro));
}

/** @param {{flor?: string, polinizador?: string}} [p] */
export function senalarFlor({ flor, polinizador } = {}) {
  if (!flor || !polinizador) return null;
  return { flor, polinizador };
}

/** @param {{registros?: RegistroAngelita[]}} [p] */
export function medirFloresVisitadas({ registros = [] } = {}) {
  if (!Array.isArray(registros)) return 0;
  return registros.filter((r) => eventoDe(r) === 'visita_flor' && tieneFechaConfirmada(r)).length;
}

/** @param {{registros?: RegistroAngelita[], cerca?: boolean}} [p] */
export function inquietudPorFumigacion({ registros = [], cerca } = {}) {
  if (cerca !== true || !Array.isArray(registros)) return false;
  return registros.some((r) => {
    const metadata = metadataDe(r);
    return eventoDe(r) === 'manejo_plagas'
      && metadata.metodo === 'fumigacion'
      && metadata.proximidad === 'cerca'
      && tieneFechaConfirmada(r);
  });
}

/** @param {{flores?: RegistroAngelita[], semanaInicioMs?: number, semanaFinMs?: number}} [p] */
export function noticiaColmena({ flores = [], semanaInicioMs, semanaFinMs } = {}) {
  if (!Array.isArray(flores)) return [];
  return flores.filter((f) => {
    const t = fechaDe(f);
    return eventoDe(f) === 'floracion'
      && f?.florecio === true
      && Number.isFinite(t)
      && (!Number.isFinite(semanaInicioMs) || t >= semanaInicioMs)
      && (!Number.isFinite(semanaFinMs) || t <= semanaFinMs);
  });
}

export default { senalarFlor, medirFloresVisitadas, inquietudPorFumigacion, noticiaColmena };
