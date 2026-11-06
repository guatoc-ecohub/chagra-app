/* eslint-disable chagra-i18n/no-hardcoded-spanish -- etiquetas de la bitácora campesina. */
// Proyecciones en memoria. Ningún resumen se escribe en Assets (ADR-019).
export const nameOf = (item) => item?.attributes?.name || item?.name || 'Sin nombre';
export const refs = (item, relation) => {
  const data = item?.relationships?.[relation]?.data;
  return (Array.isArray(data) ? data : data ? [data] : []).filter(Boolean);
};
export const needsReview = (log) => Boolean(log.metadata?.ai?.needs_human_review || log.attributes?.metadata?.ai?.needs_human_review);
export const secondsOf = (log) => {
  const raw = log.timestamp ?? log.attributes?.timestamp;
  if (raw === null || raw === undefined || raw === '') return 0;
  const number = Number(raw);
  return Number.isFinite(number) ? number : (Date.parse(raw) / 1000 || 0);
};
export const statusOf = (log) => log.attributes?.status || log.status;
export const textOf = (log) => {
  const notes = log.attributes?.notes ?? log.notes;
  return typeof notes === 'string' ? notes : notes?.value || '';
};
export const normalizeSearch = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const isRecorded = (log, now = Date.now() / 1000) => !needsReview(log) && statusOf(log) === 'done' && secondsOf(log) > 0 && secondsOf(log) <= now;
export const logReferences = (log, id) => [...refs(log, 'asset'), ...refs(log, 'location')].some((r) => r.id === id) || log.asset_id === id;
export const plantsInZone = (plants, zoneId) => plants.filter((plant) => [...refs(plant, 'parent'), ...refs(plant, 'location')].some((r) => r.id === zoneId));
export const unplacedPlants = (plants, lands) => plants.filter((plant) => !lands.some((land) => plantsInZone([plant], land.id).length));
export const sortLogs = (logs) => [...logs].sort((a, b) => secondsOf(b) - secondsOf(a));
export const logTypeLabel = (log) => ({
  'log--observation': 'Observación', 'log--seeding': 'Siembra', 'log--planting': 'Siembra',
  'log--harvest': 'Cosecha', 'log--input': 'Aplicación', 'log--maintenance': 'Mantenimiento',
  'log--activity': 'Actividad', 'log--task': 'Tarea',
})[log.type] || 'Apunte';
export const dateLabel = (seconds) => seconds > 0 ? new Date(seconds * 1000).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha';
export const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function recentDays(now = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - 6 + i);
    return { key: dayKey(day), date: day };
  });
}
export function kindOf(log) {
  if (['log--seeding', 'log--planting'].includes(log.type)) return 'siembra';
  if (log.type === 'log--observation') return 'observacion';
  return 'labor';
}
export function pendingTasks(logs, now = Date.now() / 1000) {
  const completed = new Set();
  logs.filter((log) => isRecorded(log, now)).forEach((log) => {
    const text = textOf(log);
    if (text.includes('[TASK_COMPLETION]') && /verdict:\s*(completed|cancelled|rescheduled)\b/.test(text)) {
      const id = text.match(/target_task_id:\s*([^\s]+)/)?.[1];
      if (id) completed.add(id);
    }
  });
  return sortLogs(logs.filter((log) => log.type === 'log--task' && !needsReview(log)
    && ['pending', 'in_progress', 'urgent', 'blocked'].includes(statusOf(log))
    && !completed.has(log.id) && secondsOf(log) > 0 && secondsOf(log) <= now + 7 * 86400))
    .sort((a, b) => secondsOf(a) - secondsOf(b));
}
