import PISOS from '../data/piso-termico.json';

/**
 * Clasifica el piso termico colombiano segun altitud.
 * @param {number} altitudMsnm
 * @returns {object|null}
 */
export function clasificarPisoTermico(altitudMsnm) {
  if (typeof altitudMsnm !== 'number' || altitudMsnm < 0) return null;
  const piso = PISOS.pisos.find((p) => {
    const min = Number(p.min_msnm);
    const max = p.max_msnm == null ? Infinity : Number(p.max_msnm);
    return Number.isFinite(min) && altitudMsnm >= min && altitudMsnm < max;
  });
  return piso || null;
}
