/**
 * miGoteoService.js — «Mi goteo»: los sistemas de goteo guardados en la finca.
 *
 * ── Modelo de datos (farmOS, sin backend nuevo) ─────────────────────────────
 * Un sistema de goteo ES un `asset--equipment` de farmOS: es infraestructura
 * física de la finca (tanque, mangueras, goteros), no un evento. El diseño que
 * calculó el mundo va en `attributes.data` (texto JSON, el mismo campo y el
 * mismo patrón de marca que usa `farmLocationSync.js`):
 *
 *   asset--equipment {
 *     attributes: {
 *       name: 'Goteo del invernadero de tomate',
 *       status: 'active',
 *       data: '{"chagra_goteo_v1":{ mundo, estado, resumen, piezas, comprado, guardado }}'
 *     }
 *   }
 *
 * Una finca puede tener varios. No dependen de ninguna zona (regla 3 de
 * AGENTS.md): si después se quiere ubicar, va por `relationships.location`.
 *
 * `resumen` y `piezas` son lo que el mundo calculó al guardar: la app no
 * repite la cuenta (vive en el mundo). `comprado` es lo único que se marca
 * aquí: los nombres de las piezas que ya se compraron.
 *
 * ── Offline-first ───────────────────────────────────────────────────────────
 * Toda escritura pasa por `useAssetStore` (commit atómico IndexedDB + encolado
 * en `pending_transactions`): sin señal queda guardado en el teléfono y sube
 * cuando vuelve la red. Las ediciones son PATCH de `name` y `data` (LWW por
 * campo, como el resto de assets).
 */

import { newId } from '../utils/id.js';
import useAssetStore from '../store/useAssetStore';
import { validarDiseno } from './goteoDiseno';

export const MARCA_GOTEO = 'chagra_goteo_v1';
const TIPO = 'equipment';
const ENDPOINT = '/api/asset/equipment';

function leerData(asset) {
  const raw = asset?.attributes?.data;
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** ¿Este equipo es un sistema de goteo guardado desde un mundo? */
export const esSistemaGoteo = (asset) => Boolean(leerData(asset)?.[MARCA_GOTEO]);

/**
 * Lee un sistema guardado. El dato vuelve a pasar por el validador: puede
 * venir del servidor o de otro teléfono, y se trata igual que un enlace.
 * @returns {null | {id:string, nombre:string, pendiente:boolean, diseno:object, comprado:string[], guardado:string|null}}
 */
export function leerSistema(asset) {
  const g = leerData(asset)?.[MARCA_GOTEO];
  if (!g) return null;
  const r = validarDiseno({ v: 1, mundo: g.mundo, estado: g.estado, resumen: g.resumen, piezas: g.piezas });
  if (!r.ok) return null;
  const nombres = new Set(r.diseno.piezas.map((p) => p.n));
  const comprado = Array.isArray(g.comprado) ? g.comprado.filter((n) => typeof n === 'string' && nombres.has(n)) : [];
  const nombre = typeof asset.attributes?.name === 'string' && asset.attributes.name.trim()
    ? asset.attributes.name.trim().slice(0, 60) : r.diseno.nombre;
  return {
    id: asset.id,
    nombre,
    pendiente: Boolean(asset._pending),
    diseno: r.diseno,
    comprado,
    guardado: typeof g.guardado === 'string' ? g.guardado : null,
  };
}

/** Los sistemas de goteo de la finca, del más nuevo al más viejo. */
export function sistemasDeGoteo(equipment) {
  return (equipment || [])
    .map(leerSistema)
    .filter(Boolean)
    .sort((a, b) => String(b.guardado || '').localeCompare(String(a.guardado || '')));
}

const limpiarNombre = (nombre, porDefecto) => {
  const t = [...String(nombre ?? '')].map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c)).join('')
    .replace(/\s+/g, ' ').trim().slice(0, 60);
  return t || porDefecto;
};

const dataDe = (diseno, comprado, guardado) => JSON.stringify({
  [MARCA_GOTEO]: {
    mundo: diseno.mundo,
    estado: diseno.estado,
    resumen: diseno.resumen,
    piezas: diseno.piezas,
    comprado,
    guardado,
  },
});

/**
 * Guarda un diseño nuevo en la finca.
 * @param {object} diseno validado por goteoDiseno
 * @param {string} [nombre]
 */
export async function crearSistema(diseno, nombre) {
  const r = validarDiseno(diseno);
  if (!r.ok) throw new Error(`Diseño no válido: ${r.motivo}`);
  const id = newId();
  const attributes = {
    name: limpiarNombre(nombre, r.diseno.nombre),
    status: 'active',
    data: dataDe(r.diseno, [], new Date().toISOString()),
  };
  const asset = { id, type: 'asset--equipment', attributes, _pending: true, _createdAt: Date.now() };
  const pendingTx = {
    id,
    type: 'asset_equipment',
    endpoint: ENDPOINT,
    method: 'POST',
    payload: { data: { type: 'asset--equipment', id, attributes } },
  };
  await useAssetStore.getState().addAsset(TIPO, asset, [pendingTx]);
  return asset;
}

/**
 * Cambia un sistema guardado: el nombre, lo comprado, o el diseño entero
 * (cuando vuelve del mundo con cambios). Lo comprado se conserva para las
 * piezas que siguen en la lista.
 * @param {string} id
 * @param {{nombre?:string, comprado?:string[], diseno?:object}} cambio
 */
export async function actualizarSistema(id, cambio = {}) {
  const store = useAssetStore.getState();
  const actual = store.equipment.find((a) => a.id === id);
  const sistema = actual && leerSistema(actual);
  if (!sistema) throw new Error('Sistema de goteo no encontrado');

  let diseno = sistema.diseno;
  if (cambio.diseno) {
    const r = validarDiseno(cambio.diseno);
    if (!r.ok) throw new Error(`Diseño no válido: ${r.motivo}`);
    diseno = r.diseno;
  }
  const nombres = new Set(diseno.piezas.map((p) => p.n));
  const comprado = (cambio.comprado ?? sistema.comprado).filter((n) => typeof n === 'string' && nombres.has(n));
  const guardado = cambio.diseno ? new Date().toISOString() : sistema.guardado;

  const attributes = {
    ...(actual.attributes || {}),
    name: cambio.nombre !== undefined ? limpiarNombre(cambio.nombre, sistema.nombre) : sistema.nombre,
    data: dataDe(diseno, [...new Set(comprado)], guardado),
  };
  const updated = { ...actual, type: 'asset--equipment', attributes, _pending: true };
  const pendingTx = {
    id: newId(),
    type: 'asset_equipment',
    remoteId: id,
    endpoint: `${ENDPOINT}/${id}`,
    method: 'PATCH',
    payload: { data: { type: 'asset--equipment', id, attributes: { name: attributes.name, data: attributes.data } } },
  };
  await store.updateAsset(TIPO, updated, [pendingTx]);
  return updated;
}

/** Marca o desmarca una pieza como comprada. */
export async function marcarComprado(id, nombrePieza, comprada) {
  const actual = useAssetStore.getState().equipment.find((a) => a.id === id);
  const sistema = actual && leerSistema(actual);
  if (!sistema) throw new Error('Sistema de goteo no encontrado');
  const set = new Set(sistema.comprado);
  if (comprada) set.add(nombrePieza); else set.delete(nombrePieza);
  return actualizarSistema(id, { comprado: [...set] });
}

/** Quita un sistema de la finca (borrado local + DELETE encolado). */
export async function quitarSistema(id) {
  await useAssetStore.getState().removeAsset(TIPO, id);
}
