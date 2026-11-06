import { getActiveTenantId } from './tenantContext';
import { MSG } from '../config/messages';
import { orderDependentTransactions } from './syncDependencies';
// Sync conflict strategy (Task 109): Logs append-only idempotent by id.
// Assets LWW at field level. Queue dedup by transaction id (upsert).
import { sendToFarmOS, fetchFromFarmOS, uploadBinaryToFarmOS } from './apiService';
import { openDB, STORES } from '../db/dbCore';
import { logCache } from '../db/logCache';
import { newId } from '../utils/id';
import { getCompletedTaskIds } from '../utils/taskCompletionParser';
import { recordEvent } from './voiceTelemetryService';
import { recordPilotEvent } from './pilotTelemetryService';
import { tryGeneratePlanFromSeeding } from './planGeneratorService';
import { friendlyMessage } from '../utils/friendlyErrors';
import { sanitizeErrorDetail } from './sanitizeError';
import { motivoLegibleFarmOS, prepareLogQuantities } from './farmosLogContract';
import { parseDateTimestamp } from '../utils/dateFormatter';
import { flushVisionQueue } from './visionQueueService';
import { INTEREST_TYPE, syncMarketplaceInterest } from './marketplaceInterestService';
import { OFFER_TYPE } from './marketplaceOfferContract';
import { isMarketContext, syncMarketplaceOffer } from './marketplaceOfferSync';
import { SYNC_REQUESTED_EVENT } from './syncRequest';
import { AUTH_MISSING, TENANT_READY_EVENT } from './sessionSignals';

const STORE_NAME = 'pending_transactions';
const TASKS_STORE_NAME = 'pending_tasks';
const VOICE_STORE_NAME = STORES.PENDING_VOICE;

const mediaEnVuelo = new Map();
const MAX_RETRIES = 3;

function notifyLogSyncPending(transaction) {
  const logId = transaction?.payload?.data?.id;
  if (!logId) return;
  window.dispatchEvent(new CustomEvent('chagra:log-sync-pending', { detail: { logId } }));
}
const BASE_BACKOFF_MS = 1000;
// Bundles de log de farmOS 4 que pueden referenciar una planta (medido en
// chagra.app el 2026-11-01: water/purchase/sale no existen, dan 404).
const PLANT_LOG_BUNDLES = ['seeding', 'harvest', 'input', 'observation', 'activity', 'maintenance', 'transplanting', 'lab_test', 'medical', 'birth'];
const PLANT_DELETE_RE = /^\/api\/asset\/plant\/([0-9a-f-]{36})$/i;
const MAX_LOG_PAGES = 20;
// farmOS no borra una entidad referenciada por otra y responde 403 con este
// texto (con los marcadores de Drupal sin reemplazar).
const isReferencedError = (error) => error?.status === 403
  && /referenced by another entity/i.test(String(error.detail || error.message || ''));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// El MIME de `item.mimeType` no es confiable (mediaCache.save asume image/webp por
// defecto aunque el blob sea JPEG), así que manda el tipo del propio blob y, si es
// genérico, los bytes iniciales.
async function sniffImageMime(blob) {
  try {
    const b = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  } catch { /* sin bytes legibles: se decide por el tipo declarado */ }
  return '';
}

// Campo de farmOS y extensión para un binario de la cola de fotos.
// `image` acepta png gif jpg jpeg webp; `file` solo documentos.
export async function destinoDeMedia(item) {
  const declarado = String(item?.blob?.type || item?.mimeType || '').toLowerCase().split(';')[0].trim();
  let mime = IMAGE_EXT[declarado] ? declarado : '';
  if (!mime && (declarado.startsWith('image/') || !declarado)) mime = await sniffImageMime(item.blob);
  if (mime) return { field: 'image', ext: IMAGE_EXT[mime] };
  if (declarado.startsWith('image/')) return { field: 'file', ext: declarado.slice(6).replace(/[^a-z0-9]/g, '') || 'bin' };
  return { field: 'file', ext: declarado.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'bin' };
}

// ¿La respuesta de la subida trae el archivo? La ruta por ENTIDAD responde la lista
// de archivos del campo (`data` es un arreglo de file--file, medido en producción
// 2026-10-28); la ruta por campo responde el archivo solo (`data` objeto). Exigir
// `data.id` de objeto marcaba fallida una subida con 200 y el reintento la duplicaba.
export function subidaConfirmada(res) {
  return [].concat(res?.data ?? []).some((d) => d?.type === 'file--file' && Boolean(d.id));
}

// Memoización de sesión para el listado de tareas. Varias superficies del
// dashboard pueden montarse al mismo tiempo y pedir el mismo rango. Guardamos
// la promesa, no una copia persistida del estado, y la invalidamos tras un
// cambio explícito o si la petición falla.
const pendingTasksRequests = new Map();

export function clearPendingTasksRequestCache() {
  pendingTasksRequests.clear();
}

export class SyncManager {
  constructor() {
    this.db = null;
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.rerunRequested = false;
  }

  // Hotfix 11.6: delega la apertura a dbCore (singleton). Preserva la
  // interfaz pública initDB() para no romper callers existentes.
  async initDB() {
    this.db = await openDB();
    // Ejecutar migración de tareas legacy si es necesario
    await this.migrateLegacyTasks();
  }

  /**
   * Fase 5 ADR-019: Migrar registros de pending_tasks (snapshot) a log--task (entidades).
   */
  async migrateLegacyTasks() {
    if (!this.db) return;
    const migrationFlag = 'chagra:migration:taskLogV1';
    if (localStorage.getItem(migrationFlag)) return;

    try {
      const legacyTasks = await new Promise((resolve, reject) => {
        const tx = this.db.transaction([TASKS_STORE_NAME], 'readonly');
        const req = tx.objectStore(TASKS_STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (legacyTasks.length > 0) {
        console.info(`[Migration] Promocionando ${legacyTasks.length} tareas legacy a log--task…`);
        for (const task of legacyTasks) {
          const logTask = {
            id: task.id || newId('log--task'),
            type: 'log--task',
            status: task.status || 'pending',
            timestamp: task.timestamp || Math.floor(Date.now() / 1000),
            name: task.title || task.name || 'Tarea migrada',
            attributes: {
              name: task.title || task.name || 'Tarea migrada',
              status: task.status || 'pending',
              timestamp: task.timestamp || Math.floor(Date.now() / 1000),
              notes: {
                value: `[MIGRATION] ${task.description || ''}`,
                format: 'plain_text'
              }
            },
            relationships: task.originalData?.relationships || { asset: { data: [] } },
            _pending: false,
            _migrated: true
          };
          await logCache.put(logTask);
        }
      }

      localStorage.setItem(migrationFlag, 'completed');
      console.info(MSG.syncLog.migradas);
    } catch (err) {
      console.warn('[Migration] Error migrando tareas (no crítico, se reintentará FarmOS pull):', err);
    }
  }

  // Guardar transacción pendiente
  async saveTransaction(transactionData) {
    if (!this.db) await this.initDB();

    const data = transactionData.payload?.data;
    const isLog = data?.type?.startsWith('log--');
    if (isLog && !data.id) data.id = newId(data.type);
    const tenantId = transactionData._tenant_id || getActiveTenantId();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(isLog ? [STORE_NAME, STORES.LOGS] : [STORE_NAME], 'readwrite');
      const transactionRecord = { ...transactionData, _tenant_id: tenantId, timestamp: Date.now(), synced: false };
      const request = transaction.objectStore(STORE_NAME).add(transactionRecord);
      request.onsuccess = () => { transactionRecord.id = request.result; };
      if (isLog) {
        const attrs = data.attributes || {};
        const timestamp = typeof attrs.timestamp === 'number' ? attrs.timestamp : Math.floor(new Date(attrs.timestamp).getTime() / 1000);
        transaction.objectStore(STORES.LOGS).put({ ...data, name: attrs.name, status: attrs.status,
          timestamp, _pending: true, _tenant_id: tenantId, cached_at: Date.now() });
      }
      transaction.oncomplete = () => {
        window.dispatchEvent(new CustomEvent('taskAdded'));
        resolve(transactionRecord);
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Local transaction aborted'));
    });
  }

  // Obtener transacciones pendientes (getAll + filtro en memoria para evitar dependencia de índice)
  async getPendingTransactions() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const all = request.result || [];
        resolve(all.filter(r => !r.synced));
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Eliminar transacción sincronizada
  async deleteTransaction(id) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Bug-critical fix (2026-05-27): clasificación de errores HTTP para
  // decidir strategy (quarantine vs auto-retry). Ver
  // documentación interna
  classifyHttpError(status) {
    if (status === 401) return 'auth_expired';
    if (status === 403) return 'forbidden';
    if (status === 404) return 'not_found';
    if (status === 409) return 'conflict';
    if (status === 422) return 'validation';
    if (status === 429) return 'rate_limit';
    if (status >= 400 && status < 500) return 'client_other';
    if (status >= 500) return 'server';
    return 'unknown';
  }

  // Mover transacción a `failed_transactions` (quarantine bucket). El user
  // ve un banner "X transacciones bloqueadas" y puede revisar/reintentar/
  // descartar manual. Reemplaza el `deleteTransaction()` silencioso.
  async quarantineTransaction(transaction, error) {
    if (transaction.type === OFFER_TYPE) {
      const { marketplaceOfertas } = await import('../db/marketplaceOfertas');
      await marketplaceOfertas.acknowledge(transaction, true);
    }
    if (!this.db) await this.initDB();
    const errorClass = this.classifyHttpError(error.status || 0);

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.FAILED_TX], 'readwrite');
      const store = tx.objectStore(STORES.FAILED_TX);
      const record = {
        original_tx_id: transaction.id,
        type: transaction.type,
        endpoint: transaction.endpoint || null,
        payload: transaction.payload,
        ...(transaction._tenant_id ? { _tenant_id: transaction._tenant_id } : {}),
        ...(transaction._dependsOn ? { _dependsOn: transaction._dependsOn } : {}),
        error_status: error.status || 0,
        error_class: errorClass,
        error_message: error.message || String(error),
        error_detail: sanitizeErrorDetail(error.detail) || null,
        retries: transaction.retries || 0,
        failed_at: Date.now(),
        original_timestamp: transaction.timestamp || null,
        ...([OFFER_TYPE, INTEREST_TYPE].includes(transaction.type) ? {
          marketContext: transaction.marketContext, localOfferId: transaction.localOfferId,
          remoteId: transaction.remoteId,
        } : {}),
      };
      store.add(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // STEV-54: una planta con logs (toda la que nace con su siembra) no se puede
  // borrar en farmOS mientras algún log la referencie. Se borran sus logs; si
  // un log también es de otro activo, solo se le quita esta planta para no
  // perder la historia del otro. Luego se borra la planta. Lanza el error de
  // farmOS si algún paso falla (p. ej. un log de otra cuenta).
  async deletePlantWithLogs(plantId) {
    const deletedLogIds = [];
    for (const bundle of PLANT_LOG_BUNDLES) {
      // Cada pasada vuelve a pedir la primera página: lo ya resuelto deja de
      // referenciar la planta, así que la lista se vacía sola.
      for (let page = 0; page < MAX_LOG_PAGES; page++) {
        const res = await fetchFromFarmOS(`/api/log/${bundle}?filter[asset.id]=${plantId}&page[limit]=50`);
        const logs = (res?.data || []).filter((log) => log?.id);
        if (!logs.length) break;
        for (const log of logs) {
          const assets = log.relationships?.asset?.data || [];
          const others = assets.filter((ref) => ref?.id !== plantId);
          const endpoint = `/api/log/${bundle}/${log.id}`;
          try {
            if (others.length) {
              await sendToFarmOS(endpoint, {
                data: { type: log.type || `log--${bundle}`, id: log.id, relationships: { asset: { data: others } } },
              }, 'PATCH');
            } else {
              await sendToFarmOS(endpoint, null, 'DELETE');
              deletedLogIds.push(log.id);
            }
          } catch (error) {
            if (error?.status !== 404) throw error;
            deletedLogIds.push(log.id);
          }
        }
      }
    }
    try {
      await sendToFarmOS(`/api/asset/plant/${plantId}`, null, 'DELETE');
    } catch (error) {
      if (error?.status !== 404) throw error;
    }
    await this.removeCachedLogs(deletedLogIds);
    return deletedLogIds;
  }

  // Saca de IDB los logs que se borraron en farmOS junto con su planta.
  async removeCachedLogs(ids) {
    if (!ids.length) return;
    if (!this.db) await this.initDB();
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.LOGS], 'readwrite');
      const store = tx.objectStore(STORES.LOGS);
      ids.forEach((id) => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Devuelve a IDB el asset de un DELETE que farmOS rechazó y avisa al store.
  async restoreRejectedDelete(transaction) {
    const asset = transaction._restoreAsset;
    if (!asset?.id) return;
    if (!this.db) await this.initDB();
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.ASSETS], 'readwrite');
      tx.objectStore(STORES.ASSETS).put(asset);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    window.dispatchEvent(new CustomEvent('chagra:asset-restored', { detail: { asset } }));
  }

  // Obtener todas las transacciones en quarantine. Para UI "Sincronización
  // bloqueada" donde el user revisa/reintenta/descarta.
  async getFailedTransactions() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.FAILED_TX], 'readonly');
      const store = tx.objectStore(STORES.FAILED_TX);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // Reintentar una transacción quarantine: la mueve de vuelta a
  // pending_transactions con retries=0 y dispara syncAll. Útil para 422
  // donde el user editó el payload, o 401 donde refrescó el token.
  async requeueFailedTransaction(failedId, mutatedPayload = null) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.FAILED_TX, STORE_NAME], 'readwrite');
      const failedStore = tx.objectStore(STORES.FAILED_TX);
      const pendingStore = tx.objectStore(STORE_NAME);
      const getReq = failedStore.get(failedId);
      getReq.onsuccess = () => {
        const failed = getReq.result;
        if (!failed) return resolve(false);
        pendingStore.add({
          ...(failed._tenant_id || failed._dependsOn || failed.type === OFFER_TYPE
            ? { id: failed.original_tx_id }
            : {}),
          type: failed.type,
          endpoint: failed.endpoint,
          payload: mutatedPayload || failed.payload,
          ...([OFFER_TYPE, INTEREST_TYPE].includes(failed.type) ? {
            marketContext: failed.marketContext, localOfferId: failed.localOfferId,
            remoteId: failed.remoteId,
          } : {}),
          ...(failed._tenant_id ? { _tenant_id: failed._tenant_id } : {}),
          ...(failed._dependsOn ? { _dependsOn: failed._dependsOn } : {}),
          timestamp: Date.now(),
          synced: false,
          retries: 0,
        });
        failedStore.delete(failedId);
      };
      getReq.onerror = () => reject(getReq.error);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Descartar definitivamente una transacción en quarantine (decisión del
  // user en UI). El payload se loguea por privacidad pero el record se
  // elimina del IDB.
  async discardFailedTransaction(failedId) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.FAILED_TX], 'readwrite');
      tx.objectStore(STORES.FAILED_TX).delete(failedId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Marcar retries en una transacción
  async markRetry(id, errorMsg) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) return resolve();
        record.retries = (record.retries || 0) + 1;
        record.lastError = errorMsg;
        store.put(record);
        transaction.oncomplete = () => resolve(record.retries);
        transaction.onerror = () => reject(transaction.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // Sincronizar todas las transacciones pendientes
  async syncAll({ rerunIfBusy = false } = {}) {
    if (!this.isOnline) return;
    if (this.isSyncing) {
      if (rerunIfBusy) this.rerunRequested = true;
      return;
    }

    this.isSyncing = true;
    let synced = 0;
    let failed = 0;
    let authPaused = false;
    let sessionLost = false;
    const t0 = performance.now();
    const onSessionExpired = () => { authPaused = true; };
    window.addEventListener('chagra:session-expired', onSessionExpired);

    try {
      const pendingTransactions = await this.getPendingTransactions();
      const unresolved = new Set(pendingTransactions.map(tx => tx.id));
      if (pendingTransactions.some(tx => tx._dependsOn?.length)) {
        const failedTransactions = await this.getFailedTransactions();
        failedTransactions.forEach(tx => unresolved.add(tx.original_tx_id));
      }

      for (const transaction of orderDependentTransactions(pendingTransactions)) {
        // A shared catalogue does not authorize publishing another account's outbox.
        if ([OFFER_TYPE, INTEREST_TYPE].includes(transaction.type) && !isMarketContext(transaction.marketContext)) continue;
        if (transaction._tenant_id && transaction._tenant_id !== getActiveTenantId()) continue;
        if (transaction._dependsOn?.some(id => unresolved.has(id))) continue;
        // Saltar transacciones que superaron el máximo de reintentos
        const currentRetries = transaction.retries || 0;
        if (currentRetries >= MAX_RETRIES) {
          failed++;
          continue;
        }

        // Backoff exponencial: esperar antes de reintentar transacciones fallidas
        if (currentRetries > 0) {
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, currentRetries - 1);
          await new Promise((r) => setTimeout(r, backoffMs));
        }

        try {
          const syncResult = await this.syncTransaction(transaction);
          const persisted = ![OFFER_TYPE, INTEREST_TYPE].includes(transaction.type)
            && await this.persistSyncedLog(transaction, syncResult);
          await this.deleteTransaction(transaction.id);
          if (persisted) window.dispatchEvent(new CustomEvent('chagra:log-synced', {
            detail: { id: transaction.id, result: syncResult },
          }));
          unresolved.delete(transaction.id);
          synced++;
          console.info(`[SyncManager] Transacción ${transaction.id} completada y purgada.`);

          // Audit finding #2 (2026-05-18): el path offline-then-sync no
          // dispara generación de plan de alimentación. Si la transacción
          // es seeding y vino con _planSeed (capturado al encolar), generar
          // ahora que tenemos asset creado en FarmOS. Idempotente: el helper
          // skipea si ya hay plan. NO bloquea el sync ante fallo.
          const planSeed = this.extractPlanSeed(transaction, syncResult);
          if (planSeed) {
            const plan = await tryGeneratePlanFromSeeding(planSeed);
            if (plan?.steps?.length > 0) {
              window.dispatchEvent(new CustomEvent('syncCompleted', {
                detail: {
                  type: transaction.type,
                  id: transaction.id,
                  remoteId: transaction.remoteId,
                  plantId: planSeed.assetId,
                  planGenerated: {
                    plantId: planSeed.assetId,
                    plantName: planSeed.plantName,
                    steps: plan.steps.length,
                  },
                },
              }));
              continue;
            }
          }

          window.dispatchEvent(new CustomEvent('syncCompleted', {
            detail: {
              type: transaction.type,
              id: transaction.id,
              remoteId: transaction.remoteId,
            },
          }));
        } catch (error) {
          if ([OFFER_TYPE, INTEREST_TYPE].includes(transaction.type) && !isMarketContext(transaction.marketContext)) continue;
          if (error.status === 401 || error.code === AUTH_MISSING || authPaused) {
            // La autenticación debe repararse antes de continuar el lote.
            // Conservar payload, dependencias y retries hasta el nuevo login.
            authPaused = true;
            if (error.sessionLost) sessionLost = true;
            notifyLogSyncPending(transaction);
            break;
          }
          let deleteError = error;
          const plantId = transaction.method === 'DELETE' && isReferencedError(error)
            ? (transaction.endpoint || '').match(PLANT_DELETE_RE)?.[1]
            : null;
          if (plantId) {
            try {
              await this.deletePlantWithLogs(plantId);
              deleteError = Object.assign(new Error('Not found'), { status: 404 });
            } catch (cascadeError) {
              console.error(`[SyncManager] Borrado de la planta ${plantId} con sus registros falló.`, cascadeError);
              const status = cascadeError?.status || 0;
              if (status === 401) {
                authPaused = true;
                break;
              }
              if (status < 400 || status >= 500) {
                // Red o servidor: el DELETE sigue en cola y se reintenta.
                const retries = await this.markRetry(transaction.id, cascadeError?.message || String(cascadeError));
                if (retries < MAX_RETRIES) {
                  failed++;
                  continue;
                }
              }
              deleteError = status >= 400 && status < 500 ? cascadeError : error;
              deleteError.referenced = true;
            }
          }
          if (transaction.method === 'DELETE' && deleteError.status === 404) {
            // Ya no existe en farmOS: el borrado está cumplido.
            await this.deleteTransaction(transaction.id);
            unresolved.delete(transaction.id);
            synced++;
            window.dispatchEvent(new CustomEvent('syncCompleted', {
              detail: { type: transaction.type, id: transaction.id, remoteId: transaction.remoteId },
            }));
            continue;
          }
          if (transaction.method === 'DELETE' && transaction._restoreAsset
            && deleteError.status && deleteError.status >= 400 && deleteError.status < 500) {
            // farmOS no borró: devolver el asset a la vista y decirlo. No va a
            // cuarentena porque no hay nada que perder; se puede volver a borrar.
            await this.restoreRejectedDelete(transaction);
            await this.deleteTransaction(transaction.id);
            unresolved.delete(transaction.id);
            failed++;
            const name = transaction._restoreAsset.attributes?.name || transaction._restoreAsset.name || 'el registro';
            const reason = deleteError.referenced || isReferencedError(deleteError)
              ? 'tiene registros (siembra, cosechas u otros) que no se pudieron borrar'
              : deleteError.status === 403
                ? 'su cuenta no tiene permiso para borrarlo en el servidor'
                : friendlyMessage(deleteError);
            window.dispatchEvent(new CustomEvent('syncError', {
              detail: {
                message: `"${name}" no se borró: ${reason}. Sigue registrado.`,
                rawMessage: `Borrado de "${name}" rechazado (HTTP ${deleteError.status}).`,
                status: deleteError.status,
                errorClass: this.classifyHttpError(deleteError.status),
                quarantined: false,
              },
            }));
            continue;
          }
          if (error.status && error.status >= 400 && error.status < 500) {
            // Bug-critical fix (2026-05-27): el `deleteTransaction()` previo
            // descartaba el payload del usuario sin manera de recuperarlo.
            // Ahora movemos la transacción a `failed_transactions` (quarantine
            // bucket) donde el user puede revisar/reintentar/descartar manual.
            // Spec: documentación interna
            const errorClass = this.classifyHttpError(error.status);
            console.error(`[SyncManager] HTTP ${error.status} (${errorClass}). Moviendo transacción ${transaction.id} a quarantine.`, error);
            await this.quarantineTransaction(transaction, error);
            await this.deleteTransaction(transaction.id);
            failed++;
            notifyLogSyncPending(transaction);
            const name = transaction.payload?.data?.attributes?.name || transaction.type;
            // UX-12 (#286) 2026-05-27: mensaje friendly contextualizado en
            // lugar de exponer "HTTP 422" al operador. La info técnica queda
            // en `errorClass` + `status` por si la UI quiere mostrar detalle.
            const friendly = friendlyMessage(error);
            const serverDetail = sanitizeErrorDetail(error.detail);
            // El texto de farmOS (en inglés y técnico) no se muestra: solo un motivo traducido.
            const motivo = [400, 422].includes(error.status) ? motivoLegibleFarmOS(serverDetail) : null;
            const reason = motivo ? ` Motivo: ${motivo}.` : '';
            window.dispatchEvent(new CustomEvent('syncError', {
              detail: {
                message: `"${name}": ${friendly}${reason} Quedó guardada; revise en "Sincronización" para reintentar.`,
                serverDetail,
                friendlyMessage: friendly,
                rawMessage: `Transacción "${name}" bloqueada (HTTP ${error.status}). Revise en "Sincronización" para reintentar.`,
                status: error.status,
                errorClass,
                quarantined: true,
              },
            }));
          } else {
            const retries = await this.markRetry(transaction.id, error.message);
            console.warn(`[SyncManager] Fallo de red/servidor en transacción ${transaction.id} (intento ${retries}/${MAX_RETRIES}). Marcando para reintento.`, error);
            if (retries >= MAX_RETRIES) {
              // Max retries con 5xx — también quarantine para que el user vea.
              await this.quarantineTransaction(transaction, error);
              await this.deleteTransaction(transaction.id);
              failed++;
              const name = transaction.payload?.data?.attributes?.name || transaction.type;
              const friendly = friendlyMessage(error);
              window.dispatchEvent(new CustomEvent('syncError', {
                detail: {
                  message: `"${name}": ${friendly} Quedó bloqueada en "Sincronización".`,
                  friendlyMessage: friendly,
                  rawMessage: `Fallo permanente al sincronizar "${name}". Bloqueada en "Sincronización".`,
                  status: error.status || 0,
                  errorClass: 'max_retries',
                  quarantined: true,
                },
              }));
            }
            notifyLogSyncPending(transaction);
          }
        }
      }

      // STEV-40: sin token guardado la sesión ya no existe. Avisar para que la
      // app pida volver a entrar; lo pendiente sube al guardar la cuenta.
      if (sessionLost && navigator.onLine !== false) {
        window.dispatchEvent(new CustomEvent('chagra:session-expired', {
          detail: { reason: 'missing-token', pendientes: pendingTransactions.length - synced },
        }));
      }

      if (!authPaused) {
        const queuedLogIds = new Set(
          (await this.getPendingTransactions().catch(() => []))
            .map((tx) => tx.payload?.data?.id)
            .filter(Boolean)
        );
        await this.retryPendingMedia(queuedLogIds);
      }

      if (!authPaused && failed === 0 && unresolved.size === 0 && synced > 0) {
        window.dispatchEvent(new CustomEvent('syncComplete', { detail: { synced } }));
        // Nota Hotfix 10.5: el refresco de assets ya no se dispara aquí.
        // Cada tx exitosa emite 'syncCompleted' y el store escucha para
        // ejecutar pulls dirigidos por tipo (ver useAssetStore.js).

        // Fase 20.2: auto-purge de media stale (>7 días, logs ya sincronizados)
        try {
          const { mediaCache } = await import('../db/mediaCache');
          mediaCache.purgeStale().catch((e) =>
            console.warn('[SyncManager] Purge de media stale fallido:', e)
          );
        } catch { /* noop */ }

        // Fase 11.2: pull preventivo de logs recientes tras tanda exitosa.
        try {
          const { useLogStore } = await import('../store/useLogStore');
          useLogStore.getState().pullRecentLogs(fetchFromFarmOS).catch((e) =>
            console.warn('[SyncManager] Pull de logs post-sync fallido:', e)
          );
        } catch (e) {
          console.warn(MSG.syncLog.storeNoDisponible, e);
        }
      }

      try {
        const duracionMs = Math.round(performance.now() - t0);
        recordPilotEvent({
          event_type: 'sync_resultado',
          metadata: {
            exitoso: !authPaused && failed === 0,
            pendientes: pendingTransactions.length,
            total: synced + failed,
            duracion_ms: duracionMs,
          },
        }).catch(() => {});
      } catch (_) { /* telemetría nunca rompe el flujo */ }
    } catch (error) {
      console.error('Error en proceso de sincronización:', error);
    } finally {
      window.removeEventListener('chagra:session-expired', onSessionExpired);
      this.isSyncing = false;
      // An offer saved after the running batch took its snapshot must still upload.
      if (this.rerunRequested) {
        this.rerunRequested = false;
        if (!authPaused) await this.syncAll();
      }
    }
  }

  // Sincronizar una transacción individual.
  // Si la transacción tiene media asociada en media_cache (Fase 20.2),
  // ejecuta upload del binario primero y luego vincula el file al log.
  async syncTransaction(transaction) {
    if (transaction.type === INTEREST_TYPE) return syncMarketplaceInterest(transaction);
    if (transaction.type === OFFER_TYPE) return syncMarketplaceOffer(transaction);
    const targetEndpoint = transaction.endpoint || this.resolveLegacyEndpoint(transaction);

    if (!targetEndpoint) {
      throw new Error(`Endpoint no resuelto para transacción tipo: ${transaction.type}`);
    }

    const outboundTransaction = {
      ...transaction,
      payload: transaction.payload
        ? (typeof structuredClone === 'function'
            ? structuredClone(transaction.payload)
            : JSON.parse(JSON.stringify(transaction.payload)))
        : transaction.payload,
    };
    // La cantidad pasa a relación quantity--standard con `{ decimal }` antes de
    // crear las entidades en línea; también arregla lo que ya estaba encolado.
    outboundTransaction.payload = prepareLogQuantities(outboundTransaction.payload);
    await this.resolveInlineRelationships(outboundTransaction);
    delete outboundTransaction.payload?._multipartFile;
    for (const key of Object.keys(outboundTransaction.payload?.data?.attributes || {})) {
      if (key.startsWith('_')) delete outboundTransaction.payload.data.attributes[key];
    }

    // Pre-paso: si la transacción incluye quantity metadata, crear la entidad
    // quantity--standard primero y vincularla al payload del log.
    if (outboundTransaction._quantityMeta) {
      const qm = outboundTransaction._quantityMeta;
      const qtyPayload = {
        data: {
          type: 'quantity--standard',
          attributes: {
            label: qm.label,
            value: { decimal: String(qm.value) },
            measure: qm.measure || 'volume',
          },
        },
      };
      const qtyResult = await sendToFarmOS('/api/quantity/standard', qtyPayload, 'POST');
      const qtyId = qtyResult?.data?.id;
      if (qtyId) {
        outboundTransaction.payload.data.relationships = outboundTransaction.payload.data.relationships || {};
        outboundTransaction.payload.data.relationships.quantity = {
          data: [{ type: 'quantity--standard', id: qtyId }],
        };
      }
    }

    // Paso principal: enviar el payload del log/asset
    let result;
    try {
      result = transaction._tenant_id
        ? await sendToFarmOS(targetEndpoint, outboundTransaction.payload, transaction.method || 'POST', { contextIsCurrent: () => transaction._tenant_id === getActiveTenantId() })
        : await sendToFarmOS(targetEndpoint, outboundTransaction.payload, transaction.method || 'POST');
    } catch (error) {
      const data = outboundTransaction.payload?.data;
      if (error.status !== 409 || !data?.id || !data.type?.startsWith('log--') || (transaction.method && transaction.method !== 'POST')) throw error;
      result = await fetchFromFarmOS(`${targetEndpoint}/${data.id}`);
      if (result?.data?.id !== data.id || result?.data?.type !== data.type) throw error;
    }

    // Fase 20.2: si hay media asociada, subir binarios y vincular al log. La foto
    // se guarda bajo el UUID del log (no bajo el id numérico de la cola).
    const logData = transaction.payload?.data;
    const logId = logData?.id || transaction.remoteId;
    if (logId) {
      await this.attachMediaToLog(logId, logData?.type || 'log--activity', logData?.attributes?.name);
    }

    return result;
  }

  // Sube las fotos pendientes de un log ya creado en farmOS. Un fallo NO bloquea
  // el log principal: deja la foto marcada (intentos, error) y se reintenta en la
  // siguiente sincronización. Devuelve fotos subidas.
  //
  // Las imágenes van al campo `image` (png gif jpg jpeg webp); `file` solo acepta
  // documentos y responde 422 a una foto (medido 2026-10-28). El resto va a `file`.
  // Sube por la ruta de la ENTIDAD (POST /api/log/{bundle}/{logId}/{campo}): Drupal la
  // autoriza con el permiso de edición del log y agrega el archivo al campo, que
  // queda permanente sin PATCH de relación. La ruta por campo exige `create log`,
  // permiso que farmOS no tiene (403 al rol productor, medido 2026-10-28).
  //
  // Serializada por log: dos corridas simultáneas (sync al guardar + online/intervalo)
  // leerían ambas el elemento como pendiente, porque uploadedAt se marca al final, y
  // lo subirían dos veces. La segunda espera a la primera y relee la caché.
  async attachMediaToLog(logId, logType = 'log--activity', logName = '') {
    const previa = mediaEnVuelo.get(logId) || Promise.resolve();
    const propia = previa.then(() => this.subirMediaDeLog(logId, logType, logName));
    const cola = propia.catch(() => {});
    mediaEnVuelo.set(logId, cola);
    try {
      return await propia;
    } finally {
      if (mediaEnVuelo.get(logId) === cola) mediaEnVuelo.delete(logId);
    }
  }

  async subirMediaDeLog(logId, logType, logName) {
    let items = [];
    let mediaCache;
    const pendientes = new Set();
    try {
      ({ mediaCache } = await import('../db/mediaCache'));
      items = (await mediaCache.getByLogId(logId)).filter((item) => !item.uploadedAt);
      if (items.length === 0) return 0;
      items.forEach((item) => pendientes.add(item.id));

      const logSuffix = logType.split('--')[1] || 'activity';
      const diagnoses = items.filter((item) => item.ai_diagnosis).map((item) => item.ai_diagnosis);
      if (diagnoses.length > 0) {
        // Idempotente (reemplaza notes): si una subida falla, el reintento lo repite sin duplicar.
        const diagText = diagnoses.map((d) =>
          `[IA] Score: ${d.score}/100. ${d.issues.join('; ')}. Rec: ${d.treatment_suggestion}`
        ).join('\n');
        await sendToFarmOS(`/api/log/${logSuffix}/${logId}`, {
          data: { type: logType, id: logId, attributes: { notes: { value: diagText, format: 'plain_text' } } },
        }, 'PATCH');
      }

      let subidas = 0;
      for (const item of items) {
        const { field, ext } = await destinoDeMedia(item);
        // fetchFromFarmOS lanza ante cualquier no-2xx; la respuesta 200/201 trae los archivos del campo.
        const res = await uploadBinaryToFarmOS(item.blob, `evidence_${logId}_${item.id}.${ext}`, {
          entity: 'log', bundle: logSuffix, field, entityId: logId,
        });
        if (!subidaConfirmada(res)) throw new Error('farmOS no confirmó el archivo subido.');
        // Una por una: si la segunda falla, la primera no se vuelve a subir en el reintento.
        await mediaCache.markUploaded([item.id]);
        pendientes.delete(item.id);
        subidas += 1;
        console.info(`[Sync] Media ${item.id} subida al log ${logId}.`);
      }
      return subidas;
    } catch (mediaErr) {
      console.warn('[Sync] Error subiendo media (se reintentará):', mediaErr.message);
      try {
        const fallidas = items.filter((item) => pendientes.has(item.id)).map((item) => item.id);
        const attempts = await mediaCache?.markUploadFailed(fallidas, mediaErr.message);
        if (attempts === 1) {
          window.dispatchEvent(new CustomEvent('syncError', {
            detail: {
              message: `La foto de "${logName || 'su registro'}" no se subió todavía. Se queda en el teléfono y se reintenta sola.`,
              errorClass: 'media_upload',
              status: mediaErr.status || 0,
            },
          }));
        }
      } catch (markErr) {
        console.warn('[Sync] could not mark upload failure:', markErr?.message);
      }
      return 0;
    }
  }

  // Fotos huérfanas (guardadas cuando el vínculo foto-log fallaba) o con subida
  // fallida: si su log ya existe en farmOS (no está en la cola ni pendiente), se suben.
  async retryPendingMedia(queuedLogIds = new Set()) {
    try {
      const { mediaCache } = await import('../db/mediaCache');
      for (const logId of await mediaCache.getPendingLogIds()) {
        if (typeof logId !== 'string' || !UUID_RE.test(logId) || queuedLogIds.has(logId)) continue;
        const log = await logCache.getLog(logId);
        if (!log || log._pending) continue;
        await this.attachMediaToLog(logId, log.type || 'log--activity', log.name);
      }
    } catch (err) {
      console.warn('[Sync] Reintento de fotos pendientes fallido:', err?.message);
    }
  }

  async resolveInlineRelationships(transaction) {
    const relationships = transaction?.payload?.data?.relationships;
    if (!relationships) return;

    const resolveRelationshipItem = async (item) => {
      if (!item || typeof item !== 'object') return null;
      if (item.id && UUID_RE.test(item.id) && !item._create) {
        return { type: item.type, id: item.id };
      }
      if (!item.type || !item.attributes) return null;

      const [entity, bundle] = item.type.split('--');
      if (!entity || !bundle) return null;

      const resolvedRelationships = item.relationships
        ? await this.resolveInlineRelationshipObject(item.relationships)
        : {};
      const inlinePayload = {
        data: {
          type: item.type,
          ...(item.id ? { id: item.id } : {}),
          attributes: item.attributes,
          ...(Object.keys(resolvedRelationships).length > 0 ? { relationships: resolvedRelationships } : {}),
        },
      };
      let result;
      try {
        result = await sendToFarmOS(`/api/${entity}/${bundle}`, inlinePayload, 'POST');
      } catch (error) {
        if (error.status !== 409 || !item.id) throw error;
        result = await fetchFromFarmOS(`/api/${entity}/${bundle}/${item.id}`);
        if (result?.data?.id !== item.id || result?.data?.type !== item.type) throw error;
      }
      const id = result?.data?.id;
      return id ? { type: item.type, id } : null;
    };

    for (const [name, rel] of Object.entries(relationships)) {
      if (!rel?.data) continue;
      const isArray = Array.isArray(rel.data);
      const items = isArray ? rel.data : [rel.data];
      const resolved = (await Promise.all(items.map(resolveRelationshipItem))).filter(Boolean);
      if (resolved.length === 0) {
        delete relationships[name];
      } else {
        relationships[name] = { data: isArray ? resolved : resolved[0] };
      }
    }
  }

  async resolveInlineRelationshipObject(relationships) {
    const cloneTx = { payload: { data: { relationships: { ...relationships } } } };
    await this.resolveInlineRelationships(cloneTx);
    return cloneTx.payload.data.relationships;
  }

  /**
   * Persiste el log resultante de una sincronización exitosa en STORES.LOGS.
   * WorkerHistory "Recientes 24h" Parte C necesita que los logs sincronizados
   * aparezcan junto a pendingTransactions.
   */
  async persistSyncedLog(transaction, serverResponse) {
    if (transaction.type?.startsWith('animal_lot_') && !transaction.payload?.data?.type?.startsWith('log--')) return;
    try {
      const logData = serverResponse?.data?.id ? serverResponse.data : (transaction.payload?.data || {});
      // POST responses carry quantity references, not the normalized quantity
      // already recorded offline. Keep it until a subsequent included pull.
      const cached = await logCache.getLog(transaction.payload?.data?.id || transaction.id);
      const quantity = logData.attributes?.quantity || cached?.quantity || cached?.attributes?.quantity;
      const logEntry = {
        id: logData.id || transaction.id,
        type: logData.type || transaction.type,
        timestamp: logData.attributes?.timestamp || Math.floor(Date.now() / 1000),
        name: logData.attributes?.name || logData.attributes?.notes?.value || transaction.type,
        status: logData.attributes?.status || 'done',
        asset_id: logData.relationships?.asset?.data?.[0]?.id || null,
        ...(quantity ? { quantity } : {}),
        attributes: { ...logData.attributes, ...(quantity ? { quantity } : {}) },
        relationships: logData.relationships || {},
        _pending: false,
        ...(transaction._tenant_id ? { _tenant_id: transaction._tenant_id } : {}),
        synced_at: Date.now(),
        cached_at: Date.now(),
      };
      await logCache.put(logEntry);
      console.info(`[SyncManager] Log sincronizado persistido en logCache: ${logEntry.id}`);
      return true;
    } catch (err) {
      console.warn(MSG.syncLog.logNoPersistido, err.message);
      return false;
    }
  }

  /**
   * extractPlanSeed — extrae los inputs necesarios para generar un plan de
   * alimentación a partir de una transacción seeding ya sincronizada con
   * FarmOS. Devuelve null si la transacción no es seeding o no contiene
   * suficiente información (sin assetId remoto o sin speciesSlug).
   *
   * Reglas:
   * - Solo aplica a `transaction.type === 'seeding'` o `log--seeding`.
   * - assetId: primero intenta del syncResult (relaciones devueltas por
   *   FarmOS), después del payload encolado (asset relationship si trae UUID).
   * - speciesSlug: del inline `_speciesSlug` que VoiceCapture adjunta al
   *   asset--plant. AssetsDashboard NO lo adjunta (genera el plan inline
   *   en el componente), por lo que en ese path este helper retorna null
   *   y el sync solo emite syncCompleted plano — comportamiento correcto.
   * - plantingDate: del attributes.timestamp del log--seeding (segundos
   *   epoch FarmOS).
   *
   * @param {object} transaction - registro pending_transactions
   * @param {object} syncResult - respuesta de sendToFarmOS al POST seeding
   * @returns {object|null} { assetId, speciesSlug, plantingDate, plantName } o null
   */
  extractPlanSeed(transaction, syncResult) {
    const type = transaction?.type;
    if (type !== 'seeding' && type !== 'log--seeding') return null;

    const payload = transaction.payload || {};
    const rels = payload?.data?.relationships || {};
    const assetRel = rels.asset?.data;
    const assetEntries = Array.isArray(assetRel) ? assetRel : (assetRel ? [assetRel] : []);

    // Buscar inline con _speciesSlug (VoiceCapture path).
    const inlineWithSpecies = assetEntries.find(
      (a) => a && a.type === 'asset--plant' && a._speciesSlug
    );
    if (!inlineWithSpecies) return null;

    const speciesSlug = inlineWithSpecies._speciesSlug;
    const plantName = inlineWithSpecies.attributes?.name || 'planta';

    // assetId: prioridad al syncResult (relaciones devueltas por FarmOS tras
    // el POST). Fallback al payload si trae UUID directo en el inline.
    let assetId = null;
    const resultRels = syncResult?.data?.relationships?.asset?.data;
    const resultAssetEntries = Array.isArray(resultRels) ? resultRels : (resultRels ? [resultRels] : []);
    const isUUID = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const remoteWithId = resultAssetEntries.find((a) => isUUID(a?.id));
    if (remoteWithId) {
      assetId = remoteWithId.id;
    } else if (isUUID(inlineWithSpecies.id)) {
      assetId = inlineWithSpecies.id;
    }

    if (!assetId) return null;

    const timestampSec = Number(payload?.data?.attributes?.timestamp);
    const plantingDate = Number.isFinite(timestampSec)
      ? new Date(timestampSec * 1000).toISOString()
      : new Date().toISOString();

    return { assetId, speciesSlug, plantingDate, plantName };
  }

  // Helper de retrocompatibilidad: resuelve endpoint por type cuando la transacción
  // fue encolada sin endpoint explícito (formato anterior a Fase 12).
  resolveLegacyEndpoint(transaction) {
    const type = transaction.type;
    switch (type) {
      case 'log--planting':
      case 'planting':
        return '/api/log/planting';
      case 'log--seeding':
      case 'seeding':
        return '/api/log/seeding';
      case 'log--harvest':
      case 'harvest':
        return '/api/log/harvest';
      case 'log--input':
      case 'input':
        return '/api/log/input';
      case 'log--maintenance':
      case 'maintenance':
        return '/api/log/maintenance';
      case 'log--observation':
      case 'observation':
      case 'log':
        return '/api/log/observation';
      case 'log--activity':
      case 'activity':
        return '/api/log/activity';
      case 'asset_plant':
        return '/api/asset/plant';
      case 'asset_structure':
        return '/api/asset/structure';
      case 'asset_equipment':
        return '/api/asset/equipment';
      case 'asset_material':
        return '/api/asset/material';
      case 'delete_plant':
        return `/api/asset/plant/${transaction.remoteId || transaction.id}`;
      case 'delete_equipment':
        return `/api/asset/equipment/${transaction.remoteId || transaction.id}`;
      case 'delete_structure':
        return `/api/asset/structure/${transaction.remoteId || transaction.id}`;
      case 'delete_material':
        return `/api/asset/material/${transaction.remoteId || transaction.id}`;
      default:
        return null;
    }
  }

  // Iniciar monitoreo de conexión
  startNetworkMonitoring() {
    // A phone may reopen with connectivity already restored (no online event).
    this.getPendingTransactions().then(pending => {
      if (pending.some(tx => ![OFFER_TYPE, INTEREST_TYPE].includes(tx.type) || isMarketContext(tx.marketContext))) this.syncAll({ rerunIfBusy: true });
    }).catch(() => {});
    // D-13: no depender de que el navegador dispare Background Sync. syncAll
    // serializa los lotes y borra cada transacción al confirmarse, así que el
    // SYNC_REQUESTED tardío del SW encuentra la cola vacía y no reenvía.
    window.addEventListener(SYNC_REQUESTED_EVENT, () => {
      if (this.isOnline) this.syncAll({ rerunIfBusy: true });
    });
    // STEV-40: tras volver a entrar no llega `online`. Se espera a que la cuenta
    // quede guardada (no al token) para no subir lo de otra cuenta con este.
    window.addEventListener(TENANT_READY_EVENT, () => {
      if (this.isOnline) this.syncAll({ rerunIfBusy: true });
    });
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncAll({ rerunIfBusy: true });
      this.notifyPendingVoiceRecordings();
      // V-07 #228: al reconectar, correr el diagnóstico de las fotos de visión
      // encoladas offline. Tolerante a fallos — no debe romper el resto del sync.
      flushVisionQueue().catch((e) =>
        console.debug('[sync] flushVisionQueue error:', e?.message || e)
      );
      recordEvent(/** @type {any} */ ({
        event_type: 'connectivity_state',
        flujo: 'sync_manager',
        connectivity: 'online',
      })).catch(() => {});
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      recordEvent(/** @type {any} */ ({
        event_type: 'connectivity_state',
        flujo: 'sync_manager',
        connectivity: 'offline',
      })).catch(() => {});
    });
  }

  // ─── Voice recordings (v0.5.0) ─────────────────────────────────────────
  // Persistencia de audios capturados cuando Whisper/Ollama no responden.
  // El procesamiento (transcripción + extracción) queda delegado al módulo
  // VoiceCapture, que obliga revisión humana antes de encolar en
  // pending_transactions. Este manager solo notifica disponibilidad.

  async saveVoiceRecording(blob, metadata = {}) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([VOICE_STORE_NAME], 'readwrite');
      const store = tx.objectStore(VOICE_STORE_NAME);
      const record = {
        blob,
        mimeType: blob.type || 'audio/webm',
        size: blob.size,
        durationMs: metadata.durationMs || 0,
        status: metadata.status || 'pending',
        lastError: metadata.lastError || null,
        createdAt: Date.now(),
      };
      const req = store.add(record);
      req.onsuccess = () => resolve({ ...record, id: req.result });
      req.onerror = () => reject(req.error);
    });
  }

  async getPendingVoiceRecordings() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([VOICE_STORE_NAME], 'readonly');
      const store = tx.objectStore(VOICE_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteVoiceRecording(id) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([VOICE_STORE_NAME], 'readwrite');
      const store = tx.objectStore(VOICE_STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async notifyPendingVoiceRecordings() {
    try {
      const pending = await this.getPendingVoiceRecordings();
      if (pending.length > 0) {
        window.dispatchEvent(new CustomEvent('voiceRecordingsPending', {
          detail: { count: pending.length },
        }));
      }
    } catch (err) {
      console.warn(MSG.syncLog.vozNoVerificada, err.message);
    }
  }

  // Obtener estadísticas de sincronización
  async getSyncStats() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve({ pendingCount: request.result, isOnline: this.isOnline, isSyncing: this.isSyncing });
      request.onerror = () => reject(request.error);
    });
  }

  // Obtener tareas pendientes del store unificado (Fase 5 ADR-019)
  async getPendingTasks() {
    // Redirigir al store unificado filtrando por status=pending
    const allLogs = await logCache.getByType('log--task');
    const completedIds = getCompletedTaskIds(allLogs);

    return allLogs
      .filter(l => l.status === 'pending' && !completedIds.has(l.id))
      .map(l => ({
        ...l,
        title: l.name,
        deadline: this.calculateDeadlineFromTimestamp(l.timestamp),
        severity: this.calculateSeverityFromNotes(l.attributes?.notes?.value || '')
      }));
  }

  // Guardar tareas pendientes en IndexedDB mediante el store unificado.
  async savePendingTasks(tasks) {
    // Wrapper para compatibilidad legacy. Mapea al nuevo bulkPut.
    for (const task of tasks) {
      const normalized = task.originalData || {
        id: task.id,
        type: 'log--task',
        attributes: {
          name: task.title,
          status: task.status,
          timestamp: task.timestamp,
        }
      };
      await logCache.put(normalized);
    }
    return tasks;
  }

  // Fetch tareas pendientes desde FarmOS API
  async fetchPendingTasksFromFarmOS() {
    if (!this.isOnline) {
      console.warn(MSG.syncLog.tareasOffline);
      return this.getPendingTasks();
    }

    try {
      const now = new Date();
      const oneWeekAgo = Math.floor((now.getTime() - (7 * 24 * 60 * 60 * 1000)) / 1000);
      const oneWeekFuture = Math.floor((now.getTime() + (7 * 24 * 60 * 60 * 1000)) / 1000);

      const endpoint = '/api/log/activity?' +
        'include=quantity&' +
        'filter[date_range][condition][path]=timestamp&' +
        'filter[date_range][condition][operator]=BETWEEN&' +
        'filter[date_range][condition][value][0]=' + oneWeekAgo + '&' +
        'filter[date_range][condition][value][1]=' + oneWeekFuture;

      let request = pendingTasksRequests.get(endpoint);
      if (!request) {
        request = fetchFromFarmOS(endpoint).catch((error) => {
          pendingTasksRequests.delete(endpoint);
          throw error;
        });
        pendingTasksRequests.set(endpoint, request);
      }
      const response = await request;

      if (response.data && Array.isArray(response.data)) {
        // Normalizar y guardar como log--task en el store unificado
        const normalized = response.data.map(remote => ({
          ...remote,
          type: 'log--task' // Forzamos el tipo para el cache local
        }));
        await logCache.bulkPut('log--task', normalized, response.included);
      }

      return this.getPendingTasks();
    } catch (error) {
      console.error('Error obteniendo tareas de FarmOS:', error);
      return this.getPendingTasks();
    }
  }

  // Helpers extraídos para limpieza del modelo (Fase 5)
  calculateSeverityFromNotes(notesText) {
    if (!notesText) return 'medium';
    const notesLower = notesText.toLowerCase();
    if (notesLower.includes('emergencia') || notesLower.includes('crítico') || notesLower.includes('urgente')) return 'critical';
    if (notesLower.includes('importante') || notesLower.includes('prioridad')) return 'high';
    if (notesLower.includes('preventivo') || notesLower.includes('rutinario') || notesLower.includes('monitoreo')) return 'low';
    return 'medium';
  }

  /**
   * @param {number|string|Date} timestamp
   */
  calculateDeadlineFromTimestamp(timestamp) {
    const taskDate = parseDateTimestamp(timestamp);
    if (!taskDate) return MSG.syncLog.pendiente;
    const nowDate = new Date();
    const civilDay = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const daysDiff = Math.round((civilDay(nowDate) - civilDay(taskDate)) / 86400000);

    if (daysDiff < 0) {
      const absDaysDiff = Math.abs(daysDiff);
      if (absDaysDiff === 0) return `Hoy ${taskDate.getHours().toString().padStart(2, '0')}:${taskDate.getMinutes().toString().padStart(2, '0')}`;
      if (absDaysDiff === 1) return 'Mañana';
      return absDaysDiff <= 7 ? `En ${absDaysDiff} días` : 'Próximamente';
    } else if (daysDiff === 0) {
      return `Hoy ${taskDate.getHours().toString().padStart(2, '0')}:${taskDate.getMinutes().toString().padStart(2, '0')}`;
    } else if (daysDiff === 1) {
      return 'Vencido (Ayer)';
    }
    return `Vencido hace ${daysDiff} días`;
  }
}

// Singleton
export const syncManager = new SyncManager();
