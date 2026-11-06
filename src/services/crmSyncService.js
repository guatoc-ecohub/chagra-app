import { assetCache } from '../db/assetCache.js';
import { logCache } from '../db/logCache.js';
import { fetchFromFarmOS, sendToFarmOS } from './apiService.js';
import { getActiveTenantId } from './tenantContext.js';
import { crmRemoteId, decodeCrmResource, encodeCrmNotes } from './crmTransport.js';

import { discoverMarketplaceInterests } from './marketplaceInterestService.js';

let activeSync = null;

async function syncForTenant(tenant) {
  const current = () => getActiveTenantId() === tenant;
  const options = { contextIsCurrent: current };
  const assertCurrent = () => { if (!current()) throw new Error('La cuenta cambió durante la sincronización.'); };
  await discoverMarketplaceInterests(tenant);
  const cachedContacts = await assetCache.getByType('person');
  const contacts = (Array.isArray(cachedContacts) ? cachedContacts : []).filter((c) => c.attributes?.crm_contact_type);
  const remoteIds = new Map();
  const upload = async (resource, endpoint, data, mutable) => {
    assertCurrent();
    let existing;
    try {
      existing = await fetchFromFarmOS(`${endpoint}/${data.id}`, options);
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    assertCurrent();
    let response = existing;
    if (!existing?.data?.id) response = await sendToFarmOS(endpoint, { data }, 'POST', options);
    else if (mutable) response = await sendToFarmOS(`${endpoint}/${data.id}`, { data }, 'PATCH', options);
    if (response?.data?.id !== data.id) throw new Error('farmOS no confirmó el registro CRM.');
    assertCurrent();
    return { ...resource, _tenant_id: tenant, _crmSynced: true, _crmRemoteId: data.id, _pending: false };
  };
  for (const contact of contacts) {
    const id = contact._crmRemoteId || await crmRemoteId(contact.id);
    remoteIds.set(contact.id, id);
    if (contact._crmSynced && !contact._pending) continue;
    const synced = await upload(contact, '/api/asset/group', {
      id, type: 'asset--group',
      attributes: { name: contact.attributes.name, status: contact.attributes.status, notes: encodeCrmNotes(contact) },
    }, true);
    const latest = decodeCrmResource(await assetCache.getAsset(contact.id));
    assertCurrent();
    // A local edit during an upload stays pending for the next pass.
    if (JSON.stringify(latest?.attributes) === JSON.stringify(contact.attributes)) await assetCache.put('person', synced);
  }
  const logs = (await Promise.all([logCache.getByType('log--activity'), logCache.getByType('log--task')])).flat();
  for (const raw of new Map(logs.map(decodeCrmResource).map((log) => [log.id, log])).values()) {
    const log = decodeCrmResource(raw);
    if (!log.attributes?.crm_interaction_type || !remoteIds.has(log.asset_id)) continue;
    if (log._crmSynced && !log._pending) continue;
    const id = log._crmRemoteId || await crmRemoteId(log.id);
    const synced = await upload(log, '/api/log/activity', {
      id, type: 'log--activity',
      attributes: { name: log.attributes.name, timestamp: log.timestamp, status: 'done', notes: encodeCrmNotes(log) },
      relationships: { asset: { data: [{ type: 'asset--group', id: remoteIds.get(log.asset_id) }] } },
    }, false);
    await logCache.put(synced);
  }
  const pull = async (endpoint, consume) => {
    let next = `${endpoint}?filter[uid.name]=${encodeURIComponent(tenant)}&page[limit]=50`;
    while (next) {
      const response = await fetchFromFarmOS(next, options);
      assertCurrent();
      for (const remote of response.data || []) {
        const local = decodeCrmResource(remote);
        if (!local._crmSynced) continue;
        await consume({ ...local, _tenant_id: tenant });
        assertCurrent();
      }
      const href = response.links?.next?.href;
      if (!href) break;
      const url = new URL(href, window.location.origin);
      // Transport remains through the same-origin API proxy, including pagination.
      if (!url.pathname.startsWith(endpoint)) throw new Error('Página CRM no válida.');
      next = `${url.pathname}${url.search}`;
    }
  };
  await pull('/api/asset/group', async (contact) => {
    const local = decodeCrmResource(await assetCache.getAsset(contact.id));
    assertCurrent();
    if (!local?._pending) await assetCache.put('person', contact);
  });
  const restoredContacts = await assetCache.getByType('person');
  const contactIds = new Set((Array.isArray(restoredContacts) ? restoredContacts : []).map((c) => c.id));
  await pull('/api/log/activity', async (log) => {
    if (contactIds.has(log.asset_id)) await logCache.put(log);
  });
}

/** Serialize CRM passes; local pending records are the durable offline queue. */
export function syncCrm() {
  const tenant = getActiveTenantId();
  if (!tenant || !navigator.onLine) return Promise.resolve();
  if (activeSync) return activeSync;
  activeSync = syncForTenant(tenant).finally(() => { activeSync = null; });
  return activeSync;
}
