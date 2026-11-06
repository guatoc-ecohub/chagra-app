/**
 * Solicita al Service Worker que registre el Background Sync de la cola.
 *
 * El SW recibe REGISTER_SYNC y, cuando el navegador ejecuta el evento sync,
 * devuelve SYNC_REQUESTED al cliente para que SyncManager vacíe la cola.
 *
 * Background Sync no existe en todos los navegadores (Safari/iOS, Firefox) y
 * el permiso puede estar denegado, así que también se avisa a la página: con
 * la app abierta y en línea, SyncManager vacía la cola sin esperar al SW.
 */
export const SYNC_REQUESTED_EVENT = 'chagra:sync-requested';

export function requestBackgroundSync() {
  navigator.serviceWorker?.controller?.postMessage({ type: 'REGISTER_SYNC' });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SYNC_REQUESTED_EVENT));
}
