// Rangos del inventario Humboldt (nodos AGE), no promesa de presencia local.
export const PLANTAS = [
  { id: 'palma', gid: '3659174697238800', nombre: 'Palma de vino', cientifico: 'Attalea butyracea', min: 0, max: 1000 },
  { id: 'guayacan', gid: '3659174697238805', nombre: 'Guayacán amarillo', cientifico: 'Tabebuia chrysantha', min: 200, max: 1800 },
  { id: 'cafe', gid: '3659174697238553', nombre: 'Café', cientifico: 'Coffea arabica', min: 1000, max: 2000 },
  { id: 'uchuva', gid: '3659174697238586', nombre: 'Uchuva', cientifico: 'Physalis peruviana', min: 1800, max: 2800 },
  { id: 'puya', gid: '3659174697238836', nombre: 'Puya de páramo', cientifico: 'Puya clava-herculis', min: 3500, max: 4200 },
  { id: 'aliso', gid: '3659174697238536', nombre: 'Aliso andino', cientifico: 'Alnus acuminata', min: 2200, max: 3200 },
  { id: 'agraz', gid: '3659174697238632', nombre: 'Agraz', cientifico: 'Vaccinium meridionale', min: 2600, max: 3400 },
  { id: 'colorado', gid: '3659174697238650', nombre: 'Colorado', cientifico: 'Polylepis sericea', min: 3000, max: 3600 },
  { id: 'frailejon', gid: '3659174697238648', nombre: 'Frailejón común', cientifico: 'Espeletia grandiflora', min: 3200, max: 3800 },
];

export const ANIMALES = {
  puma: { gid: '21110623253299225', id: 'puma', nombre: 'Puma', cientifico: 'Puma concolor', min: 0, max: 4000 },
  danta: { gid: '21110623253299223', id: 'danta', nombre: 'Danta de páramo', cientifico: 'Tapirus pinchaque', min: 1400, max: 4300 },
  condor: { gid: '21110623253299224', id: 'condor', nombre: 'Cóndor', cientifico: 'Vultur gryphus', min: 3200, max: 5000 },
};

/** @type {Record<string, [number, number]>} */
export const PISOS_ALTITUD = {
  cálido: [0, 1000],
  templado: [1000, 2000],
  frío: [2000, 3000],
  páramo: [3000, 4000],
};

/** @param {{ min: number, max: number }} especie @param {[number, number]} rango */
const cruzaPiso = (especie, [min, max]) => Math.min(especie.max, max) > Math.max(especie.min, min);

/** @param {number} altitud */
export function especiesHumboldt(altitud) {
  if (typeof altitud !== 'number' || !Number.isFinite(altitud) || altitud < 0 || altitud > 4000) return null;
  const piso = altitud < 1000 ? 'cálido' : altitud < 2000 ? 'templado' : altitud < 3000 ? 'frío' : 'páramo';
  const prioridad = piso === 'cálido' ? ['guayacan', 'palma'] : piso === 'templado' ? ['cafe', 'guayacan'] : piso === 'frío' ? ['aliso', 'agraz', 'uchuva'] : ['frailejon', 'colorado', 'agraz', 'puya'];
  const plantas = prioridad.map(id => PLANTAS.find(p => p.id === id)).filter(p => p && altitud >= p.min && altitud <= p.max).slice(0, 2);
  const candidato = altitud >= 3200 ? ANIMALES.condor : altitud >= 1400 ? ANIMALES.danta : ANIMALES.puma;
  const animal = cruzaPiso(candidato, PISOS_ALTITUD[piso]) ? candidato : null;
  if (!animal) return null;
  return { piso, plantas, animal };
}
