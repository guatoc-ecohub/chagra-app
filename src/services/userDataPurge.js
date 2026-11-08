/**
 * userDataPurge — borra del dispositivo los datos de la cuenta al salir.
 *
 * Se llama SOLO desde el «Salir» explícito. Una sesión vencida (401) pasa por
 * `logoutUser` y NO purga IndexedDB: el usuario no eligió irse y al volver a
 * entrar conserva su sesión local (contrato del E2E offline S2). La excepción
 * es el bucket NDVI: `logoutUser` lo borra siempre (ver ndviCacheStore).
 *
 * Qué se borra:
 *  - CacheStorage: el bucket NDVI (respuestas autenticadas por cuenta) y toda
 *    entrada `/api/` que un service worker anterior haya guardado en los
 *    buckets `chagra-*`.
 *  - IndexedDB: espejos de datos del servidor y conversación (`assets`, `logs`,
 *    `sync_meta`, `conversation_memory`), fotos ya subidas de `media_cache` y
 *    pedidos al agente ya respondidos de `agent_requests`.
 *
 * Qué NO se borra, a propósito:
 *  - `pending_transactions` y las demás colas de salida (`pending_tasks`,
 *    `failed_transactions`, `pending_voice_recordings`, `vision_queue`,
 *    `agent_outbox`, fotos sin subir, pedidos al agente sin responder). Son
 *    trabajo del usuario que aún no llegó al servidor; `syncManager` solo
 *    envía las transacciones del `_tenant_id` activo, así que otra cuenta no
 *    las sube con su sesión.
 *  - Datos que solo existen en el dispositivo (ciclos de cultivo, inventario,
 *    planes, reportes glaciares, ofertas, tratos): borrarlos sería perderlos.
 *  - Catálogo, taxonomía, corpus e índices: no son datos de la cuenta.
 */

import { openDB, STORES } from '../db/dbCore.js';
import { NDVI_CACHE_NAME } from './ndviCacheStore.js';

export const USER_CACHE_NAMES = Object.freeze([NDVI_CACHE_NAME]);

export const PURGED_STORES = Object.freeze([
  STORES.ASSETS,
  STORES.LOGS,
  STORES.SYNC_META,
  STORES.CONVERSATION_MEMORY,
]);

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * @returns {Promise<number>} transacciones pendientes de enviar (todas las
 *   cuentas del dispositivo). Si IndexedDB no responde devuelve 0.
 */
export async function countPendingTransactions() {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORES.PENDING_TX)) return 0;
    const tx = db.transaction(STORES.PENDING_TX, 'readonly');
    return await requestToPromise(tx.objectStore(STORES.PENDING_TX).count());
  } catch (_) {
    return 0;
  }
}

async function deleteWhere(db, storeName, predicate) {
  if (!db.objectStoreNames.contains(storeName)) return 0;
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  let removed = 0;
  await new Promise((resolve, reject) => {
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) { resolve(); return; }
      if (predicate(cursor.value)) {
        cursor.delete();
        removed += 1;
      }
      cursor.continue();
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
  await transactionDone(tx);
  return removed;
}

async function purgeIndexedDB() {
  const db = await openDB();
  const cleared = PURGED_STORES.filter((name) => db.objectStoreNames.contains(name));
  if (cleared.length > 0) {
    const tx = db.transaction(cleared, 'readwrite');
    for (const name of cleared) tx.objectStore(name).clear();
    await transactionDone(tx);
  }
  const uploadedPhotos = await deleteWhere(db, STORES.MEDIA_CACHE, (record) => Boolean(record?.uploadedAt));
  const answeredRequests = await deleteWhere(db, STORES.AGENT_REQUESTS, (record) => record?.status === 'done');
  return { cleared, uploadedPhotos, answeredRequests };
}

async function purgeCacheStorage() {
  if (typeof caches === 'undefined') return { deleted: [], apiEntries: 0 };
  const names = await caches.keys();
  const deleted = [];
  let apiEntries = 0;
  for (const name of names) {
    if (USER_CACHE_NAMES.includes(name)) {
      if (await caches.delete(name)) deleted.push(name);
      continue;
    }
    if (!name.startsWith('chagra-')) continue;
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      let pathname = '';
      try { pathname = new URL(request.url).pathname; } catch (_) { continue; }
      if (pathname.startsWith('/api/') && await cache.delete(request)) apiEntries += 1;
    }
  }
  return { deleted, apiEntries };
}

/**
 * Borra caches e IndexedDB de la cuenta. Nunca lanza: cada parte informa su
 * propio error en el resultado.
 *
 * @returns {Promise<{ pendingKept: number, caches: object|null, idb: object|null, errors: string[] }>}
 */
export async function purgeUserData() {
  const errors = [];
  const pendingKept = await countPendingTransactions();
  let cachesResult = null;
  let idbResult = null;
  try { cachesResult = await purgeCacheStorage(); } catch (err) { errors.push(`caches: ${err?.message || err}`); }
  try { idbResult = await purgeIndexedDB(); } catch (err) { errors.push(`idb: ${err?.message || err}`); }
  return { pendingKept, caches: cachesResult, idb: idbResult, errors };
}
