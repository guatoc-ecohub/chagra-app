import { newId } from '../utils/id.js';
import { fetchFromFarmOS, sendToFarmOS } from './apiService.js';
import { getActiveFincaId, getActiveFincaLandId, getActiveTenantId } from './tenantContext.js';
import { useFincaActiveStore } from './fincaActiveStore.js';
import { getProfile, saveProfile } from './userProfileService.js';
import { pickFarmLocation, hasFarmLocation, FARM_LOCATION_FIELDS } from './farmLocationFields.js';

const inFlight = new Map();
const marker = 'chagra_farm_location_v1';
const fingerprint = value => JSON.stringify(pickFarmLocation(value));
const endpoint = () => useFincaActiveStore.getState().getActiveEndpoint();

function currentFinca() {
  const state = useFincaActiveStore.getState();
  return state.fincas?.find((finca) => finca.slug === state.activeFincaSlug) || null;
}

function updateCurrentFincaLocation(location) {
  const state = useFincaActiveStore.getState();
  const active = currentFinca();
  if (!active?.isOwnedFinca) return;
  const fincas = state.fincas.map((finca) => finca.slug === active.slug
    ? { ...finca, location, ...location, altitud: location.finca_altitud ?? location.altitud ?? finca.altitud }
    : finca);
  state.setFincas(fincas);
}

function resourceList(response) {
  if (Array.isArray(response?.data)) return response.data;
  return response?.data ? [response.data] : [];
}

function pendingLocationKey(username, fincaId) {
  return `chagra:finca-location-pending:v1:${encodeURIComponent(username)}:${encodeURIComponent(fincaId)}`;
}

function readPendingLocation(username, fincaId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(pendingLocationKey(username, fincaId)) || 'null');
    return parsed && typeof parsed === 'object' ? pickFarmLocation(parsed) : null;
  } catch (_) { return null; }
}

function preservePendingLocation(username, fincaId) {
  if (!username || !fincaId) return;
  const profile = getProfile();
  if (!profile._farmLocationPending) return;
  const location = pickFarmLocation(profile);
  if (!hasFarmLocation(location)) return;
  try { localStorage.setItem(pendingLocationKey(username, fincaId), JSON.stringify(location)); } catch (_) { /* retry remains in profile */ }
}

function readData(asset) {
  const raw = asset.attributes?.data;
  if (!raw) return {};
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid asset data');
  return parsed;
}

/** Local first. Failed requests leave the durable profile pending for retry. */
export function syncFarmLocation() {
  const tenant = getActiveTenantId();
  if (!tenant || navigator.onLine === false) return Promise.resolve({ status: 'offline' });
  const base = endpoint();
  const fincaId = getActiveFincaId();
  const landId = getActiveFincaLandId() || currentFinca()?.landId || null;
  const ownedFinca = Boolean(fincaId && currentFinca()?.isOwnedFinca);
  const key = JSON.stringify([base, tenant, fincaId, landId]);
  if (inFlight.has(key)) return inFlight.get(key);
  const current = () => tenant === getActiveTenantId() && base === endpoint()
    && fincaId === getActiveFincaId() && landId === (getActiveFincaLandId() || currentFinca()?.landId || null);
  const run = async () => {
    const original = getProfile();
    const pendingForFinca = ownedFinca ? readPendingLocation(tenant, fincaId) : null;
    const local = ownedFinca ? (pendingForFinca || {}) : pickFarmLocation(original);
    const hasPendingLocation = ownedFinca ? Boolean(pendingForFinca) : Boolean(original._farmLocationPending);
    // Explicit owner filter freezes the account even if a request awaits auth.
    const assets = [];
    if (ownedFinca && landId) {
      const response = await fetchFromFarmOS(`/api/asset/land/${landId}`, { contextIsCurrent: current });
      if (!current()) return { status: 'account-changed' };
      assets.push(...resourceList(response));
    } else {
      const query = `/api/asset/land?filter[uid.name]=${encodeURIComponent(tenant)}&filter[land_type]=property`;
      for (let offset = 0; ; offset += 50) {
        const page = await fetchFromFarmOS(`${query}&page[limit]=50&page[offset]=${offset}`, { contextIsCurrent: current });
        if (!current()) return { status: 'account-changed' };
        if (!Array.isArray(page.data)) throw new Error('Invalid asset response');
        assets.push(...page.data);
        if (!page.links?.next) break;
      }
    }
    const marked = assets.filter(asset => readData(asset)[marker]);
    if (!ownedFinca && (marked.length > 1 || (!marked.length && assets.length > 1))) return { status: 'ambiguous-farm' };
    const asset = marked[0] || assets[0];
    const data = asset ? readData(asset) : {};
    const remote = pickFarmLocation(data[marker]);
    // Never overwrite a location edited while the GET was in flight.
    if (!pendingForFinca && !ownedFinca && fingerprint(getProfile()) !== fingerprint(local)) return { status: 'local-changed' };
    if (hasFarmLocation(remote) && !hasPendingLocation) {
      const restored = Object.fromEntries(FARM_LOCATION_FIELDS.map(field => [field, remote[field]]));
      if (fingerprint(local) !== fingerprint(remote)) saveProfile(restored, { fromFarmOS: true });
      updateCurrentFincaLocation(remote);
      return { status: 'restored' };
    }
    if (ownedFinca && !hasFarmLocation(remote) && !hasPendingLocation) return { status: 'no-location' };
    if (!hasFarmLocation(local)) return { status: 'no-location' };
    if (fingerprint(local) !== fingerprint(remote)) {
      // Keep a UUID before POST, so a lost response cannot create a second farm.
      const idKey = `chagra:farm-location-id:${key}`;
      let id = asset?.id || (ownedFinca ? landId : null) || localStorage.getItem(idKey);
      if (!id) {
        id = newId();
        localStorage.setItem(idKey, id);
      }
      const attributes = { data: JSON.stringify({ ...data, [marker]: local }) };
      if (!asset) Object.assign(attributes, { name: 'Mi finca', land_type: 'property', status: 'active' });
      if (!current()) return { status: 'account-changed' };
      await sendToFarmOS(`/api/asset/land${asset ? `/${id}` : ''}`, {
        data: { type: 'asset--land', id, attributes },
      }, asset ? 'PATCH' : 'POST', { contextIsCurrent: current });
    }
    if (current() && hasPendingLocation) {
      if (pendingForFinca) {
        try { localStorage.removeItem(pendingLocationKey(tenant, fincaId)); } catch (_) { /* best effort */ }
      }
      saveProfile(local, { fromFarmOS: true });
      updateCurrentFincaLocation(local);
    }
    return { status: 'synced' };
  };
  const promise = run().catch(() => ({ status: 'pending' })).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

/** Start once at app bootstrap; retry after login, edits, reconnection and focus. */
export function startFarmLocationSync() {
  const retry = () => { void syncFarmLocation(); };
  const onLocationEdited = () => {
    const tenant = getActiveTenantId();
    const fincaId = getActiveFincaId();
    if (tenant && fincaId) preservePendingLocation(tenant, fincaId);
    retry();
  };
  const onFincaChanged = (event) => {
    const previous = event?.detail?.previous;
    if (previous) preservePendingLocation(getActiveTenantId(), previous);
    retry();
  };
  const events = ['online', 'focus', 'tenantChanged'];
  events.forEach(event => window.addEventListener(event, retry));
  window.addEventListener('fincaChanged', onFincaChanged);
  window.addEventListener('chagra:profile-location-edited', onLocationEdited);
  const timer = window.setInterval(retry, 60_000);
  retry();
  return () => {
    events.forEach(event => window.removeEventListener(event, retry));
    window.removeEventListener('fincaChanged', onFincaChanged);
    window.removeEventListener('chagra:profile-location-edited', onLocationEdited);
    window.clearInterval(timer);
  };
}
