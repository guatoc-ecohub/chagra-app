/* eslint-disable chagra-i18n/no-hardcoded-spanish */
import { hasFarmLocation } from '../../services/farmLocationFields';

const TRAMOS = [
  { id: 'despertar', nombre: 'Conocer la finca', registro: 'Perfil de finca con ubicación guardada.', view: 'perfil', check: ({ profile }) => hasFarmLocation(profile), date: ({ profile }) => newestDate([profile]) },
  { id: 'pausa_quimica', nombre: 'Registrar la primera siembra', registro: 'Una planta o un registro de siembra.', view: 'sembrar', check: ({ plants, logs }) => plants.length > 0 || logs.some(isSeeding), date: ({ plants, logs }) => newestDate([...plants, ...logs.filter(isSeeding)]) },
  { id: 'tierra_viva', nombre: 'Cuidar el suelo', registro: 'Una aplicación de insumo registrada en la bitácora.', view: 'bodega', check: ({ logs }) => logs.some((log) => log.type === 'log--input'), date: ({ logs }) => newestDate(logs.filter((log) => log.type === 'log--input')) },
  { id: 'diversificacion', nombre: 'Diversificar', registro: 'Dos especies identificadas entre las plantas registradas.', view: 'procesos', check: ({ plants }) => distinctPlants(plants).length >= 2, date: ({ plants }) => newestDate(plants) },
  { id: 'equilibrio', nombre: 'Observar los cambios', registro: 'Una cosecha o una observación registrada.', view: 'registro_voz', check: ({ logs }) => logs.some((log) => ['log--harvest', 'log--observation'].includes(log.type)), date: ({ logs }) => newestDate(logs.filter((log) => ['log--harvest', 'log--observation'].includes(log.type))) },
  { id: 'irradiacion', nombre: 'Compartir lo aprendido', registro: 'Un registro de actividad o mantenimiento de la finca.', view: 'registro_voz', check: ({ logs }) => logs.some((log) => ['log--activity', 'log--maintenance'].includes(log.type)), date: ({ logs }) => newestDate(logs.filter((log) => ['log--activity', 'log--maintenance'].includes(log.type))) },
];

function isSeeding(log) { return ['log--seeding', 'log--planting'].includes(log.type); }
function newestDate(items) {
  const timestamps = items.map((item) => item.timestamp || item.attributes?.timestamp || item.attributes?.created || item.created_at || item.updated_at)
    .map((value) => {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) return numeric < 1e12 ? numeric * 1000 : numeric;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    });
  const timestamp = Math.max(0, ...timestamps);
  return timestamp ? new Date(timestamp).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Fecha no disponible en el registro';
}
function distinctPlants(plants) {
  return [...new Map(plants.map((plant) => [plant.attributes?.species || plant.attributes?.title || plant.attributes?.name, plant]).filter(([name]) => typeof name === 'string' && name.trim())).values()];
}

export function calcularTramosCamino(data) {
  const completed = TRAMOS.map((tramo) => tramo.check(data));
  return TRAMOS.map((tramo, index) => ({
    ...tramo,
    done: completed[index],
    locked: completed.slice(0, index).some((isDone) => !isDone),
    date: completed[index] ? tramo.date(data) : null,
  }));
}
