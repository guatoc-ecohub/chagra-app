import { farmosTimestamp } from '../../services/farmosLogContract';

export async function guardarObservacionSuelo({ addLog, id, land, answers }) {
  const notes = Object.entries(answers || {})
    .map(([station, answer]) => `${station}: ${answer}`)
    .join('\n');
  return addLog(land?.id || null, {
    id,
    type: 'log--observation',
    ...(land?.id ? { relationships: { asset: { data: { type: 'asset--land', id: land.id } } } } : {}),
    attributes: {
      name: 'Diagnóstico del suelo',
      timestamp: farmosTimestamp(new Date()),
      status: 'done',
      notes,
    },
  });
}
