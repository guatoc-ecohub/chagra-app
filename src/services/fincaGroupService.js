import { newId } from '../utils/id.js';
import { fetchFromFarmOS, sendToFarmOS } from './apiService.js';
import {
  clearActiveFincaContext,
  getActiveTenantId,
  setActiveFincaTenant,
  setActiveTenantId,
} from './tenantContext.js';
import { useFincaActiveStore } from './fincaActiveStore.js';
import { hasFarmLocation, pickFarmLocation } from './farmLocationFields.js';

const CACHE_KEY = 'chagra:finca_groups:v3:';
const SELECTION_KEY = 'chagra:selected_finca:v1:';
const CREATE_KEY = 'chagra:finca_create:v1:';
const LOCATION_MARKER = 'chagra_farm_location_v1';
const createInFlight = new Map();

function usernameFromResource(resource) {
  return resource?.attributes?.name || resource?.attributes?.display_name || null;
}

function refs(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function readAssetData(resource) {
  const raw = resource?.attributes?.data;
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) { return {}; }
}

function locationFromLand(land) {
  return pickFarmLocation(readAssetData(land)[LOCATION_MARKER]);
}

function normalizeGroup(group, included, username) {
  if (!Array.isArray(group?.attributes?.flag) || !group.attributes.flag.includes('finca')) return null;
  const ownerRefs = refs(group.relationships?.owner?.data);
  const ownerLinks = ownerRefs.map((ref) => ({
    ref,
    name: usernameFromResource(included.find((item) => item.id === ref?.id && item.type === ref?.type)),
  })).filter((owner) => owner.name);
  const owners = ownerLinks.map((owner) => owner.name);
  if (owners.length && !owners.includes(username)) return null;
  // The group bundle has no `land` relationship. New groups point their
  // writable `parent` field at the land asset; accept `land` only for cached
  // or previously-read responses from the old client contract.
  const landRef = [
    ...refs(group.relationships?.parent?.data),
    ...refs(group.relationships?.land?.data),
  ].find((ref) => ref?.type === 'asset--land') || null;
  const land = landRef && included.find((item) => item.id === landRef.id && item.type === landRef.type);
  const location = locationFromLand(land);
  return {
    id: group.id,
    name: group.attributes?.name || group.attributes?.label || username,
    members: [...new Set([username, ...owners])],
    ownerRefs: ownerLinks.map((owner) => owner.ref),
    ownerNames: owners,
    landId: landRef?.id || null,
    location,
    ...location,
  };
}

function cacheKey(username) { return `${CACHE_KEY}${encodeURIComponent(username)}`; }

function readCachedGroups(username) {
  try { return JSON.parse(localStorage.getItem(cacheKey(username)) || '[]'); } catch (_) { return []; }
}

function storeGroups(username, groups) {
  try { localStorage.setItem(cacheKey(username), JSON.stringify(groups)); } catch (_) { /* best effort */ }
}

function asStoreFinca(group) {
  return {
    ...group,
    slug: group.id,
    nombre: group.name,
    altitud: group.finca_altitud ?? group.altitud,
    isOwnedFinca: true,
    farmos_endpoint: null,
  };
}

function showGroups(groups, selectedId) {
  useFincaActiveStore.setState({
    fincas: groups.map(asStoreFinca),
    activeFincaSlug: selectedId,
    gpsOverride: false,
  });
}

function clearOwnedFincasFromStore() {
  const state = useFincaActiveStore.getState();
  const publicFincas = (state.fincas || []).filter((finca) => !finca?.isOwnedFinca);
  useFincaActiveStore.setState({ fincas: publicFincas, activeFincaSlug: null, gpsOverride: false });
}

export async function getFincasDeUsuario(username, { refresh = true } = {}) {
  const cached = readCachedGroups(username);
  if (!refresh || (typeof navigator !== 'undefined' && navigator.onLine === false)) return cached;
  try {
    const response = await fetchFromFarmOS(`/api/asset/group?filter[flag]=finca&filter[owner.name]=${encodeURIComponent(username)}&include=owner,parent&page[limit]=50`);
    const included = response.included || [];
    const remoteGroups = [...new Map((response.data || [])
      .map((group) => normalizeGroup(group, included, username))
      .filter(Boolean)
      .map((group) => [group.id, group])).values()];
    const remoteIds = new Set(remoteGroups.map((group) => group.id));
    const groups = [...cached.filter((group) => !remoteIds.has(group.id)), ...remoteGroups];
    storeGroups(username, groups);
    return groups;
  } catch (_) {
    return cached;
  }
}

/** Resolve a user's farm group after authentication; no group keeps legacy tenant behavior. */
export async function activateFincaForUser(username, options = {}) {
  const { groupId, knownGroups } = options;
  const groups = knownGroups || await getFincasDeUsuario(username);
  if (!groups.length) {
    clearActiveFincaContext();
    clearOwnedFincasFromStore();
    setActiveTenantId(username);
    return { id: username, name: username, members: [username], legacy: true };
  }
  let selected = groupId
    ? groups.find((group) => group.id === groupId)
    : groups.find((group) => group.id === localStorage.getItem(`${SELECTION_KEY}${encodeURIComponent(username)}`));
  if (groupId && !selected) throw new Error('La finca seleccionada ya no está disponible');
  if (!selected && groups.length === 1) selected = groups[0];
  if (!selected) {
    clearActiveFincaContext();
    setActiveTenantId(username);
    return { selectionRequired: true, groups };
  }
  localStorage.setItem(`${SELECTION_KEY}${encodeURIComponent(username)}`, selected.id);
  showGroups(groups, selected.id);
  setActiveFincaTenant(username, selected.id, selected.members, selected.landId);
  return selected;
}

export function getCachedFincasForUser(username) {
  return readCachedGroups(username);
}

function hash(value) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function resourceFrom(response) {
  if (Array.isArray(response?.data)) return response.data[0] || null;
  return response?.data || null;
}

async function existingResource(endpoint, id, contextIsCurrent) {
  try {
    return resourceFrom(await fetchFromFarmOS(`${endpoint}/${id}`, { contextIsCurrent }));
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}

async function resolveOwnerRef(username, groups, contextIsCurrent) {
  for (const group of groups) {
    const index = group.ownerNames?.indexOf(username) ?? -1;
    if (index >= 0 && group.ownerRefs?.[index]?.type === 'user--user') return group.ownerRefs[index];
  }
  // The JSON:API root links the authenticated account (`meta.links.me`), so
  // the owner is resolved without listing or searching other accounts.
  const root = await fetchFromFarmOS('/api/', { contextIsCurrent });
  const id = currentUserIdFromRoot(root);
  if (id) {
    const own = resourceFrom(await fetchFromFarmOS(`/api/user/user/${id}?fields[user--user]=name`, { contextIsCurrent }));
    if (own?.type === 'user--user' && own.id === id && usernameFromResource(own) === username) {
      return { type: 'user--user', id };
    }
  }
  throw new Error('No fue posible resolver el usuario propietario en FarmOS.');
}

const USER_UUID = /\/api\/user\/user\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?(?:[?#]|$)/i;

function currentUserIdFromRoot(root) {
  const href = root?.meta?.links?.me?.href;
  return typeof href === 'string' ? href.match(USER_UUID)?.[1] || null : null;
}

/**
 * Creates an owned finca idempotently. New plants use the writable parent
 * reference; FarmOS derives asset.location from movement logs on reads.
 */
export function createFincaForUser(username, { name, location }) {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanLocation = pickFarmLocation(location || {});
  if (!username?.trim()) return Promise.reject(new Error('Inicie sesión para crear una finca.'));
  if (!cleanName) return Promise.reject(new Error('Escriba el nombre de la finca.'));
  if (!hasFarmLocation(cleanLocation)) return Promise.reject(new Error('Indique el municipio o las coordenadas de la finca.'));

  const signature = JSON.stringify({ username: username.trim(), name: cleanName.toLowerCase(), location: cleanLocation });
  const operationKey = `${CREATE_KEY}${encodeURIComponent(username)}:${hash(signature)}`;
  if (createInFlight.has(operationKey)) return createInFlight.get(operationKey);

  const promise = (async () => {
    const contextIsCurrent = () => getActiveTenantId() === username;
    if (!contextIsCurrent()) throw new Error('La sesión cambió. Vuelva a abrir la ventana de fincas.');
    const groups = await getFincasDeUsuario(username);
    let ids;
    try { ids = JSON.parse(localStorage.getItem(operationKey) || 'null'); } catch (_) { ids = null; }
    if (!ids?.groupId || !ids?.landId) {
      ids = { groupId: newId('asset--group'), landId: newId('asset--land') };
      localStorage.setItem(operationKey, JSON.stringify(ids));
    }
    const owner = await resolveOwnerRef(username, groups, contextIsCurrent);
    if (!contextIsCurrent()) throw new Error('La sesión cambió. Vuelva a abrir la ventana de fincas.');

    const existingLand = await existingResource('/api/asset/land', ids.landId, contextIsCurrent);
    if (!existingLand) {
      const attributes = {
        name: cleanName,
        land_type: 'property',
        status: 'active',
        data: JSON.stringify({ [LOCATION_MARKER]: cleanLocation }),
      };
      await sendToFarmOS('/api/asset/land', {
        data: {
          type: 'asset--land',
          id: ids.landId,
          attributes,
          relationships: { owner: { data: [owner] } },
        },
      }, 'POST', { contextIsCurrent });
    }

    let group = await existingResource('/api/asset/group', ids.groupId, contextIsCurrent);
    if (!group) {
      const response = await sendToFarmOS('/api/asset/group', {
        data: {
          type: 'asset--group',
          id: ids.groupId,
          attributes: { name: cleanName, status: 'active', flag: ['finca'] },
          relationships: {
            owner: { data: [owner] },
            parent: { data: [{ type: 'asset--land', id: ids.landId }] },
          },
        },
      }, 'POST', { contextIsCurrent });
      group = resourceFrom(response) || { id: ids.groupId, type: 'asset--group', attributes: { name: cleanName, flag: ['finca'] } };
    }

    const created = {
      id: group.id,
      name: group.attributes?.name || cleanName,
      members: [username],
      ownerRefs: [owner],
      ownerNames: [username],
      landId: refs(group.relationships?.parent?.data).find((ref) => ref?.type === 'asset--land')?.id || ids.landId,
      location: cleanLocation,
      ...cleanLocation,
    };
    const updated = [...groups.filter((item) => item.id !== created.id), created];
    storeGroups(username, updated);
    return created;
  })().finally(() => createInFlight.delete(operationKey));

  createInFlight.set(operationKey, promise);
  return promise;
}
