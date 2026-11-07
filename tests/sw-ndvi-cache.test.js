// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment node
//
// Caché NDVI del service worker: carga public/sw.js en un contexto aislado con
// un CacheStorage en memoria y un fetch controlado por la prueba.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { NDVI_CACHE_NAME, ndviAccountScope, ndviCacheKey } from '../src/services/ndviCacheStore.js';

const ORIGIN = 'https://app.example.test';
const NDVI_URL = `${ORIGIN}/api/mcp/agro/api/ndvi/series`;
const SW_SOURCE = readFileSync(resolve(import.meta.dirname, '../public/sw.js'), 'utf8');

class MemoryCache {
  constructor() { this.entries = new Map(); }
  #url(key) { return typeof key === 'string' ? key : key.url; }
  async put(key, response) { this.entries.set(this.#url(key), await response.clone().arrayBuffer().then((body) => ({ body, response }))); }
  async match(key) {
    const hit = this.entries.get(this.#url(key));
    if (!hit) return undefined;
    const { response, body } = hit;
    return new Response(body.slice(0), { status: response.status, headers: response.headers });
  }
  async keys() { return [...this.entries.keys()].map((url) => new Request(url)); }
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
  async match(request) {
    for (const cache of this.buckets.values()) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    return undefined;
  }
}

function loadServiceWorker() {
  const listeners = new Map();
  const caches = new MemoryCacheStorage();
  const state = { network: null };
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type, fn) => listeners.set(type, fn),
    skipWaiting: () => {},
    clients: { claim: async () => {}, matchAll: async () => [] },
    registration: {},
  };
  const context = vm.createContext({
    self,
    caches,
    fetch: async (request) => {
      if (!state.network) throw new TypeError('Failed to fetch');
      return state.network(request);
    },
    Request, Response, Headers, URL, TextEncoder, TextDecoder, crypto: globalThis.crypto,
    setTimeout, clearTimeout, console, Promise,
  });
  context.globalThis = context;
  vm.runInContext(SW_SOURCE, context, { filename: 'sw.js' });

  async function post(body, scope) {
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer token' };
    if (scope) headers['x-chagra-ndvi-cache-scope'] = scope;
    const request = new Request(NDVI_URL, { method: 'POST', headers, body: JSON.stringify(body) });
    let pending;
    listeners.get('fetch')({ request, respondWith: (p) => { pending = p; } });
    return pending;
  }
  return { caches, state, post };
}

function jsonResponse(payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

const BODY = { fincaId: 'finca-1', loteId: 'lote-1', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } };

async function bucketSize(caches) {
  if (!(await caches.has(NDVI_CACHE_NAME))) return 0;
  return (await (await caches.open(NDVI_CACHE_NAME)).keys()).length;
}

describe('service worker · caché NDVI', () => {
  it('no guarda una respuesta con Cache-Control: no-store', async () => {
    const sw = loadServiceWorker();
    const scope = await ndviAccountScope('cuenta-a');
    sw.state.network = () => jsonResponse({ serie: [1] }, { 'Cache-Control': 'no-store' });
    expect((await sw.post(BODY, scope)).status).toBe(200);
    expect(await bucketSize(sw.caches)).toBe(0);

    sw.state.network = null;
    const offline = await sw.post(BODY, scope);
    expect(offline.status).toBe(503);
    expect(await offline.json()).toEqual({ error: 'ndvi_cache_miss' });
  });

  it('no guarda una respuesta con Cache-Control: private', async () => {
    const sw = loadServiceWorker();
    sw.state.network = () => jsonResponse({ serie: [1] }, { 'Cache-Control': 'private, max-age=60' });
    await sw.post(BODY, await ndviAccountScope('cuenta-a'));
    expect(await bucketSize(sw.caches)).toBe(0);
  });

  it('la misma cuenta ve offline su último resultado', async () => {
    const sw = loadServiceWorker();
    const scope = await ndviAccountScope('cuenta-a');
    sw.state.network = () => jsonResponse({ serie: ['a'] });
    await sw.post(BODY, scope);
    expect(await bucketSize(sw.caches)).toBe(1);

    sw.state.network = null;
    const offline = await sw.post(BODY, scope);
    expect(offline.status).toBe(200);
    expect(offline.headers.get('x-chagra-ndvi-cache')).toBe('offline');
    expect(await offline.json()).toEqual({ serie: ['a'] });
  });

  it('otra cuenta de la misma finca con el mismo cuerpo no recibe la respuesta de la primera', async () => {
    const sw = loadServiceWorker();
    const scopeA = await ndviAccountScope('cuenta-a');
    const scopeB = await ndviAccountScope('cuenta-b');
    expect(scopeA).not.toBe(scopeB);
    sw.state.network = () => jsonResponse({ serie: ['de-a'] });
    await sw.post(BODY, scopeA);

    sw.state.network = null;
    const offlineB = await sw.post(BODY, scopeB);
    expect(offlineB.status).toBe(503);
    expect(await offlineB.json()).toEqual({ error: 'ndvi_cache_miss' });
  });

  it('al guardar para una cuenta borra las entradas de otra', async () => {
    const sw = loadServiceWorker();
    const scopeA = await ndviAccountScope('cuenta-a');
    const scopeB = await ndviAccountScope('cuenta-b');
    sw.state.network = () => jsonResponse({ serie: ['x'] });
    await sw.post(BODY, scopeA);
    await sw.post({ ...BODY, loteId: 'lote-2' }, scopeB);

    const keys = await (await sw.caches.open(NDVI_CACHE_NAME)).keys();
    expect(keys).toHaveLength(1);
    expect(new URL(keys[0].url).pathname.startsWith(`/__chagra_ndvi_cache__/${scopeB}/`)).toBe(true);
  });

  it('sin scope de cuenta no guarda ni sirve caché', async () => {
    const sw = loadServiceWorker();
    sw.state.network = () => jsonResponse({ serie: [1] });
    await sw.post(BODY, null);
    await sw.post(BODY, 'anonymous');
    expect(await bucketSize(sw.caches)).toBe(0);
    sw.state.network = null;
    expect((await sw.post(BODY, null)).status).toBe(503);
  });

  it('la clave del worker coincide con la que lee el cliente', async () => {
    const sw = loadServiceWorker();
    const scope = await ndviAccountScope('cuenta-a');
    sw.state.network = () => jsonResponse({ serie: [1] });
    await sw.post(BODY, scope);
    const [key] = await (await sw.caches.open(NDVI_CACHE_NAME)).keys();
    expect(new URL(key.url).pathname).toBe(await ndviCacheKey(scope, JSON.stringify(BODY)));
  });
});
