/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Copy del Home A publicado en español. */
import { hasConfirmedHomeLocation } from './location';
import { registroSyncLabel } from '../../../utils/registroSyncLabel';
import { profileForFincaLocation } from '../../../services/farmLocationFields';
export const approvedLog = log => !(log.metadata?.ai?.needs_human_review || log.attributes?.metadata?.ai?.needs_human_review);
const displayLogName = log => log.title || log.name || log.attributes?.name || log.attributes?.notes?.value || 'Registro de finca';
const logDate = log => {
  const value = log.timestamp || log.attributes?.timestamp || log.date || log.attributes?.date;
  if (!value) return 'Fecha sin registrar';
  const numeric = typeof value === 'number' || /^\d{10,13}$/.test(String(value)) ? Number(value) : null;
  const date = new Date(numeric == null ? value : (numeric < 1e12 ? numeric * 1000 : numeric));
  return Number.isNaN(date.getTime()) ? 'Fecha sin registrar' : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(date);
};
const logQuantity = log => {
  const quantity = log.quantity ?? log.attributes?.quantity;
  if (quantity == null) return '';
  if (typeof quantity !== 'object') return String(quantity);
  const amount = quantity.value ?? quantity.amount ?? quantity.number;
  const unit = quantity.unit?.label || quantity.unit || quantity.units || '';
  return [amount, unit].filter(Boolean).join(' ');
};
const activityItems = logs => logs.slice(0, 4).map(log => ({
  label: displayLogName(log), date: logDate(log), quantity: logQuantity(log), state: registroSyncLabel(log),
}));
const cleanLabel = value => String(value || 'Sin nombre').replace(/\s*\([^)]*\)/g, '').replace(/\s+#\d+\s*$/, '').trim() || 'Sin nombre';
const label = asset => cleanLabel(asset.name || asset.attributes?.name || asset.attributes?.subject_label || asset.attributes?.plant_type?.name);
const groupByLabel = (items, view, limit = 4) => {
  const groups = new Map();
  for (const item of items) {
    const name = label(item);
    const key = name.toLocaleLowerCase('es');
    const group = groups.get(key) || { label: name, count: 0, view };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es')).slice(0, limit);
};

/** Read-only presentation. No derived state is written to Assets or IndexedDB. */
export function homeData({ assets, tasks = null, harvests = null, seedings = null, pending = null, snapshot = null, weatherPending = false, profile, finca = null, companion }) {
  const plants = assets.plants || [];
  const lands = assets.lands || [];
  const materials = assets.materials || [];
  const count = plants.length + lands.length + materials.length + (assets.equipment?.length || 0) + (assets.structures?.length || 0);
  const summary = assets.isHydrated ? `${plants.length} plantas, ${lands.length} zonas y ${materials.length} materiales registrados.` : 'Consultando los registros de su finca.';
  const homeProfile = profileForFincaLocation(profile || {}, finca);
  const locationConfirmed = hasConfirmedHomeLocation(homeProfile);
  const forecast = locationConfirmed && snapshot?.openmeteo?.available ? snapshot.openmeteo.forecast_7d || [] : [];
  const weatherDay = day => [day.date, day.label || day.condition_label, day.temp_max_c == null ? null : `${day.temp_max_c} °C máx.`, day.precipitation_probability == null ? null : `${day.precipitation_probability}% de lluvia`].filter(Boolean).join(' · ');
  const weather = !locationConfirmed ? 'Ubicación por confirmar. Confirme municipio y altitud para ver el pronóstico.' : forecast.length ? `${snapshot.stale ? 'Pronóstico guardado, pendiente de actualizar: ' : 'Pronóstico: '}${weatherDay(forecast[0])}` : weatherPending ? 'Consultando el pronóstico de su finca.' : 'Sin pronóstico disponible para su finca. Consulte El tiempo.';
  const confirmedHarvests = harvests?.filter(approvedLog);
  const year = new Date().getFullYear();
  const months = Array(12).fill(0);
  for (const log of confirmedHarvests || []) {
    const value = log.timestamp || log.attributes?.timestamp;
    const date = new Date(typeof value === 'number' ? value * 1000 : value);
    if (date.getFullYear() === year) months[date.getMonth()]++;
  }
  return {
    companion: ({ zariguya: 'zarigueya', 'oso-baston': 'oso', 'chivito-punk': 'chivito' })[companion] || companion,
    locationConfirmed,
    weatherView: locationConfirmed ? 'clima_boletin' : 'ubicacion-detectada',
    location: locationConfirmed ? (homeProfile.vereda || homeProfile.municipio) : 'Ubicación por confirmar',
    summary, pending, weather, months: confirmedHarvests ? months : null, year,
    forecast: forecast.length ? forecast.slice(0, 7).map(weatherDay) : [],
    tasksAvailable: tasks !== null,
    tasks: (tasks || []).filter(approvedLog).map(task => ({ title: task.title || task.name || 'Tarea', deadline: task.deadline || 'Sin fecha' })),
    groups: {
      2: assets.isHydrated ? {
        type: 'farm',
        counts: [
          { label: 'Plantas', count: plants.length, view: 'plantas-v2' },
          { label: 'Zonas', count: lands.length, view: 'puerta_zonas' },
          { label: 'Materiales', count: materials.length, view: 'bodega' },
        ],
        plants: groupByLabel(plants, 'plantas-v2'),
        lands: groupByLabel(lands, 'puerta_zonas'),
        plantTotal: plants.length,
        landTotal: lands.length,
      } : [summary],
      3: assets.isHydrated ? {
        type: 'materials',
        total: materials.length,
        items: groupByLabel(materials, 'bodega'),
      } : [summary],
      4: seedings === null ? { type: 'activity', available: false, label: 'Siembras', view: 'sembrar', items: [] } : {
        type: 'activity', available: true, label: 'Siembras', view: 'sembrar', total: seedings.filter(approvedLog).length,
        items: activityItems(seedings.filter(approvedLog)), empty: 'Aún no hay siembras anotadas.', emptyAction: 'Anote una siembra',
      },
      6: confirmedHarvests === undefined ? { type: 'activity', available: false, label: 'Cosechas', view: 'bitacora', items: [] } : {
        type: 'activity', available: true, label: 'Cosechas', view: 'bitacora', total: confirmedHarvests.length,
        items: activityItems(confirmedHarvests), empty: 'Aún no hay cosechas anotadas.', emptyAction: 'Anote una cosecha', emptyView: 'cosechar',
      },
      9: assets.isHydrated ? {
        type: 'counts', counts: [
          { label: 'Activos guardados', count, view: 'activos' },
          { label: 'Cosechas en el cuaderno de labores', count: confirmedHarvests?.length ?? null, view: 'bitacora' },
        ],
      } : [summary],
      10: {
        type: 'account', pending, profileName: profile.nombre || '',
      },
    },
  };
}
