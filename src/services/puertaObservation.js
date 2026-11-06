/* eslint-disable chagra-i18n/no-hardcoded-spanish -- copy de observación humana. */
import { newId } from '../utils/id.js';
import { openDB, STORES } from '../db/dbCore';
import { getActiveTenantId } from './tenantContext';
import { can, currentSecurityRole } from './roleService';
import { requestBackgroundSync } from './syncRequest';

/** Apunte humano append-only; log y cola se confirman juntos (ADR-019). */
export async function savePuertaObservation({ text, assets = [], context = '' }) {
  const note = text.trim();
  if (!note || note.length > 2000) throw new Error('Escriba entre 1 y 2000 caracteres.');
  if (currentSecurityRole() && !can(undefined, 'log:create')) throw new Error('Su rol no permite guardar apuntes.');
  const id = newId();
  const timestamp = Math.floor(Date.now() / 1000);
  const relationships = { asset: { data: assets.map((asset) => ({ id: asset.id, type: asset.type || `asset--${asset.asset_type}` })) } };
  const attributes = {
    name: context ? `Observación: ${context}` : 'Observación de finca',
    timestamp,
    status: 'done',
    notes: { value: note, format: 'plain_text' },
  };
  const data = { id, type: 'log--observation', attributes, relationships };
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.LOGS, STORES.PENDING_TX], 'readwrite');
    tx.objectStore(STORES.LOGS).add({ ...data, timestamp, name: attributes.name, status: 'done', asset_id: assets[0]?.id || null,
      _pending: true, _tenant_id: getActiveTenantId(), cached_at: Date.now() });
    tx.objectStore(STORES.PENDING_TX).add({ id, type: 'log--observation', endpoint: '/api/log/observation', method: 'POST',
      payload: { data }, timestamp: Date.now(), synced: false, retries: 0 });
    tx.oncomplete = () => resolve(undefined);
    tx.onabort = () => reject(tx.error || new Error('No se pudo guardar el apunte.'));
    tx.onerror = () => reject(tx.error || new Error('No se pudo guardar el apunte.'));
  });
  window.dispatchEvent(new Event('puertaLogSaved'));
  requestBackgroundSync();
  return id;
}
