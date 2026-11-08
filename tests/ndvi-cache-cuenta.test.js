// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment jsdom
//
// Caché NDVI del lado del cliente: la clave depende de la cuenta, el bucket se
// vacía al cambiar de cuenta y al vencer la sesión, y la misma cuenta conserva
// su dato offline.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  NDVI_CACHE_NAME,
  claimNdviCacheForAccount,
  ndviAccountScope,
  ndviCacheKey,
} from '../src/services/ndviCacheStore.js';
import { setActiveTenantId, _resetForTests } from '../src/services/tenantContext.js';
import { readCachedNdviSeries } from '../src/services/ndviService.js';
import { loteGeoJson } from '../src/services/loteService.js';
import { expireSession } from '../src/services/authService.js';

class MemoryCache {
  constructor() { this.entries = new Map(); }
  #url(key) { return typeof key === 'string' ? key : key.url; }
  async put(key, response) { this.entries.set(this.#url(key), { status: response.status, body: await response.text() }); }
  async match(key) {
    const hit = this.entries.get(this.#url(key));
    return hit ? new Response(hit.body, { status: hit.status, headers: { 'Content-Type': 'application/json' } }) : undefined;
  }
  async keys() { return [...this.entries.keys()].map((url) => ({ url })); }
  async delete(key) { return this.entries.delete(this.#url(key)); }
}

class MemoryCacheStorage {
  constructor() { this.buckets = new Map(); }
  async open(name) {
    if (!this.buckets.has(name)) this.buckets.set(name, new MemoryCache());
    return this.buckets.get(name);
  }
  async has(name) { return this.buckets.has(name); }
  async delete(name) { return this.buckets.delete(name); }
  async keys() { return [...this.buckets.keys()]; }
}

const LOTE = {
  id: 'lote-1',
  attributes: { intrinsic_geometry: { value: 'POLYGON ((-74 4, -74.001 4, -74.001 4.001, -74 4.001, -74 4))' } },
  relationships: { parent: { data: { id: 'finca-1' } } },
};

// Lo que el service worker deja tras una respuesta 200 para la cuenta activa.
async function guardarComoServiceWorker(account, payload) {
  const scope = await ndviAccountScope(account);
  const body = { fincaId: 'finca-1', loteId: LOTE.id, geometry: loteGeoJson(LOTE) };
  const key = await ndviCacheKey(scope, JSON.stringify(body));
  const cache = await globalThis.caches.open(NDVI_CACHE_NAME);
  await cache.put(new URL(key, location.origin).toString(), new Response(JSON.stringify(payload), { status: 200 }));
}

async function bucketSize() {
  if (!(await globalThis.caches.has(NDVI_CACHE_NAME))) return 0;
  return (await (await globalThis.caches.open(NDVI_CACHE_NAME)).keys()).length;
}

beforeEach(() => {
  globalThis.caches = new MemoryCacheStorage();
  localStorage.clear();
  _resetForTests();
});

afterEach(() => {
  delete globalThis.caches;
});

describe('caché NDVI por cuenta', () => {
  it('dos cuentas de la misma finca tienen scopes y claves distintos; sin cuenta no hay scope', async () => {
    const a = await ndviAccountScope('cuenta-a');
    const b = await ndviAccountScope('cuenta-b');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(await ndviCacheKey(a, '{}')).not.toBe(await ndviCacheKey(b, '{}'));
    expect(await ndviAccountScope(null)).toBeNull();
    expect(await ndviCacheKey(null, '{}')).toBeNull();
  });

  it('la misma cuenta lee offline su dato guardado', async () => {
    setActiveTenantId('cuenta-a');
    await claimNdviCacheForAccount(await ndviAccountScope());
    await guardarComoServiceWorker('cuenta-a', { serie: ['de-a'] });
    expect(await readCachedNdviSeries(LOTE)).toEqual({ serie: ['de-a'], cache_origen: 'guardada' });
  });

  it('la segunda cuenta no recibe el dato de la primera y el bucket se vacía al cambiar de cuenta', async () => {
    setActiveTenantId('cuenta-a');
    await claimNdviCacheForAccount(await ndviAccountScope());
    await guardarComoServiceWorker('cuenta-a', { serie: ['de-a'] });
    expect(await bucketSize()).toBe(1);

    setActiveTenantId('cuenta-b');
    expect(await readCachedNdviSeries(LOTE)).toBeNull();
    expect(await bucketSize()).toBe(0);
  });

  it('al vencer la sesión el bucket NDVI queda vacío', async () => {
    setActiveTenantId('cuenta-a');
    await claimNdviCacheForAccount(await ndviAccountScope());
    await guardarComoServiceWorker('cuenta-a', { serie: ['de-a'] });
    expect(await bucketSize()).toBe(1);

    await expireSession({ reason: 'refresh-rejected' });
    expect(await globalThis.caches.has(NDVI_CACHE_NAME)).toBe(false);
    expect(await bucketSize()).toBe(0);
  });
});
