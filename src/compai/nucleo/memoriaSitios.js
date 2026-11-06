/** Memoria navegacional de lugares: referencia, nunca relación estructural. */
export const MEMORIA_SITIOS_STORAGE_KEY = 'chagra:compai:memoria-sitios';

/** @param {{recuerdos?: Array<{objetoId?: string, lugar?: string}>, objetoId?: string, lugar?: string}} [p] */
export function recordarSitio({ recuerdos = [], objetoId, lugar } = {}) {
  if (!objetoId || !lugar || !Array.isArray(recuerdos)) return recuerdos;
  return [...recuerdos.filter((r) => r?.objetoId !== objetoId), { objetoId, lugar }];
}

/** @param {{recuerdos?: Array<{objetoId?: string, lugar?: string}>, objetoId?: string}} [p] */
export function buscarSitio({ recuerdos = [], objetoId } = {}) {
  if (!Array.isArray(recuerdos) || !objetoId) return null;
  return recuerdos.find((r) => r?.objetoId === objetoId) || null;
}

/**
 * La memoria de sitios es un recuerdo local del usuario, no una ubicación del
 * Asset. Se mantiene fuera de IndexedDB/FarmOS para no competir con
 * relationships.location.
 */
export function leerRecuerdosSitios(storage = globalThis?.localStorage) {
  try {
    const raw = storage?.getItem(MEMORIA_SITIOS_STORAGE_KEY);
    const recuerdos = raw ? JSON.parse(raw) : [];
    return Array.isArray(recuerdos) ? recuerdos : [];
  } catch {
    return [];
  }
}

export function guardarRecuerdosSitios(recuerdos, storage = globalThis?.localStorage) {
  if (!Array.isArray(recuerdos)) return false;
  try {
    storage?.setItem(MEMORIA_SITIOS_STORAGE_KEY, JSON.stringify(recuerdos));
    return true;
  } catch {
    return false;
  }
}

const SAVE_SITE_RE = /(?:guard[eé]|dej[eé]|puse|ubic[eé])\s+(?:esto\s+)?(?:en|dentro de|junto a|bajo|sobre)\s+(.+?)\s*[.!?]?$/i;
const FIND_SITE_RE = /(?:d[oó]nde\s+(?:dej[eé]|guard[eé]|puse)|en\s+(?:qu[eé]\s+)?lugar\s+(?:dej[eé]|guard[eé]|puse))/i;

/** Detecta solo las dos acciones explícitas que modifican/leen este recuerdo. */
export function detectarAccionSitio(texto) {
  const text = typeof texto === 'string' ? texto.trim() : '';
  if (!text) return null;
  const save = text.match(SAVE_SITE_RE);
  if (save) return { tipo: 'recordar', lugar: save[1].trim() };
  if (FIND_SITE_RE.test(text)) return { tipo: 'buscar' };
  return null;
}

export default {
  recordarSitio,
  buscarSitio,
  leerRecuerdosSitios,
  guardarRecuerdosSitios,
  detectarAccionSitio,
};
