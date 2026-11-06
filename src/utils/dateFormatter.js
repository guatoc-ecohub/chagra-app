/**
 * Formatea un timestamp UNIX (segundos) a string "YYYY-MM-DD HH:mm".
 *
 * @param {number|string|undefined} ts - Timestamp UNIX en segundos.
 * @returns {string} Fecha formateada, o cadena vacia si no hay timestamp.
 * @example
 * formatDate(1715123456) // => "2024-05-07 15:30"
 * formatDate(undefined)  // => ""
 */
export function formatDate(ts) {
  if (ts == null || ts === '') return '';
  const d = new Date(Number(ts) * 1000);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Formatea un timestamp ISO-8601 o numero a string localizado corto
 * (ej. "07/05/24, 15:30" para locale es-CO).
 *
 * @param {string|number|Date|undefined} iso - Fecha en ISO-8601, timestamp UNIX (ms), o Date.
 * @param {Intl.LocalesArgument} [locale='es-CO'] - Locale para toLocaleString.
 * @returns {string} Fecha localizada, o guion si no hay fecha valida.
 * @example
 * formatTimestamp('2024-05-07T20:30:00') // => "07/05/24, 15:30"
 * formatTimestamp(undefined)             // => "-"
 */
export function formatTimestamp(iso, locale = 'es-CO') {
  if (iso == null || iso === '') return '\u2014';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Retorna un texto de tiempo relativo en espanol
 * (ej. "Ahora mismo", "Hace 5 min", "Hace 2h", "Hace 3d", o fecha corta).
 *
 * @param {string|number|Date|undefined} ts - Fecha a comparar con ahora.
 * @param {Intl.LocalesArgument} [locale='es-CO'] - Locale para fecha fallback.
 * @returns {string} Texto relativo, o cadena vacia si no hay fecha.
 * @example
 * formatRelativeTime(new Date())           // => "Ahora mismo"
 * formatRelativeTime(Date.now() - 120000)  // => "Hace 2 min"
 */
export function formatRelativeTime(ts, locale = 'es-CO') {
  if (ts == null || ts === '') return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

/**
 * Convierte un timestamp a string ISO "YYYY-MM-DD" (solo fecha).
 *
 * @param {number|string|Date|undefined} ts - Timestamp UNIX (ms), ISO string, o Date.
 * @returns {string} Fecha en formato ISO, o cadena vacia si no hay valor valido.
 * @example
 * toISODate('2024-05-07T20:30:00') // => "2024-05-07"
 * toISODate(Date.now())            // => "2026-05-13"
 */
export function toISODate(ts) {
  if (ts == null || ts === '') return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Convierte un timestamp a string ISO-8601 completo.
 *
 * @param {number|string|Date|undefined} ts - Timestamp UNIX (ms), ISO string, o Date.
 * @returns {string} Fecha ISO-8601 completa, o cadena vacia si no hay valor valido.
 * @example
 * toISODateTime('2024-05-07T20:30:00') // => "2024-05-07T20:30:00.000Z"
 */
export function toISODateTime(ts) {
  if (ts == null || ts === '') return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

/** Día civil del dispositivo para formularios, sin convertirlo a UTC. */
export function localDateInputValue(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Guarda el día elegido a mediodía local para evitar cambiarlo al mostrarlo. */
export function localDateTimestamp(value) {
  return Math.floor(new Date(`${value}T12:00:00`).getTime() / 1000);
}

/** Fecha válida desde segundos FarmOS, milisegundos o ISO, sin inventar una fecha. */
export function parseDateTimestamp(value) {
  if (value == null || value === '' || value === 0) return null;
  const number = typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))
    ? Number(value) : null;
  const date = number != null ? new Date(number < 1e12 ? number * 1000 : number) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
