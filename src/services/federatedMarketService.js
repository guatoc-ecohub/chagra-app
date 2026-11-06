import {
  DAVID_MARKET_PRODUCTS,
  DAVID_MARKET_SOURCE,
} from '../data/davidMarketReference';

const DEFAULT_PRODUCTS_PATH = '/api/productos';

export function getMarketProductsPath() {
  const configured = import.meta.env.VITE_MARKET_PRODUCTS_PATH;
  return typeof configured === 'string' && configured.trim()
    ? configured.trim()
    : DEFAULT_PRODUCTS_PATH;
}

function parsePrice(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : null;
}

function firstPhoto(product) {
  const photos = product?.imagenes?.fotos;
  const candidate = Array.isArray(photos) && typeof photos[0]?.url === 'string'
    ? photos[0].url
    : (typeof product?.foto === 'string' ? product.foto : product?.imagen);
  if (typeof candidate === 'string' && candidate.startsWith('https://milpa-test.milpachoachi.co/_astro/')) {
    return null;
  }
  if (typeof candidate === 'string' && /^\/(?:fotos|mercado\/fotos-webp)\//.test(candidate)) return null;
  if (typeof candidate === 'string') return candidate;
  return null;
}

function asTags(product) {
  const tags = product?.tags || product?.etiquetas;
  return Array.isArray(tags) ? tags.filter((tag) => typeof tag === 'string' && tag.trim()) : [];
}

export function normalizeApiProduct(product, index = 0) {
  const source = product?.procedencia?.finca || {};
  const nodeId = String(product?.mercado || 'nodo-sin-identificar');
  const slug = String(product?.slug || product?.id || `producto-${index + 1}`);
  return {
    id: `${nodeId}:${slug}`,
    slug,
    nombre: typeof product?.nombre === 'string' ? product.nombre.trim() : '',
    precioCop: parsePrice(product?.precio_cop ?? product?.precio ?? product?.precio_texto),
    unidad: typeof product?.unidad_venta === 'string'
      ? product.unidad_venta
      : (typeof product?.precio_por === 'string' ? product.precio_por : null),
    foto: firstPhoto(product),
    productor: typeof source.productor === 'string'
      ? source.productor
      : (typeof product?.productor === 'string' ? product.productor : null),
    tags: asTags(product),
    descripcion: typeof product?.descripcion === 'string' ? product.descripcion : null,
    nodeId,
    nodeName: product?.mercado_nombre || nodeId,
    disponible: product?.disponible !== false
      && !(typeof product?.stock_disponible === 'number' && product.stock_disponible <= 0),
    stock: typeof product?.stock_disponible === 'number' ? product.stock_disponible : null,
    source: {
      url: getMarketProductsPath(),
      sourceId: product?.id ?? null,
    },
  };
}

export function normalizeApiPayload(payload) {
  const products = Array.isArray(payload) ? payload : payload?.productos;
  if (!Array.isArray(products)) {
    throw new Error('La respuesta del mercado no contiene un arreglo productos.');
  }
  return products.map(normalizeApiProduct).filter((product) => product.nombre);
}

/**
 * @param {{
 *   endpoint?: string,
 *   mercado?: string,
 *   signal?: AbortSignal,
 *   fetchImpl?: typeof fetch,
 * }} [opciones]
 * @returns {Promise<ReturnType<typeof normalizeApiPayload>>}
 */
export async function fetchFederatedProducts({
  endpoint = getMarketProductsPath(),
  mercado,
  signal,
  fetchImpl = fetch,
} = {}) {
  const baseUrl = globalThis.location?.origin || 'https://market.invalid';
  const url = new URL(endpoint, baseUrl);
  if (mercado) url.searchParams.set('mercado', mercado);
  const response = await fetchImpl(url.toString(), { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`El catálogo respondió ${response.status}.`);
  return normalizeApiPayload(await response.json());
}

function keyFor(product) {
  return String(product?.nombre || '').trim().toLocaleLowerCase('es-CO');
}

export function compareCatalogs(referenceProducts, importedProducts) {
  const referenceByName = new Map(referenceProducts.map((product) => [keyFor(product), product]));
  const importedByName = new Map(importedProducts.map((product) => [keyFor(product), product]));
  const missing = referenceProducts.filter((product) => !importedByName.has(keyFor(product)));
  const unexpected = importedProducts.filter((product) => !referenceByName.has(keyFor(product)));
  const priceMismatches = referenceProducts
    .filter((product) => importedByName.has(keyFor(product)))
    .map((product) => ({
      nombre: product.nombre,
      esperado: product.precioCop,
      importado: importedByName.get(keyFor(product)).precioCop,
    }))
    .filter(({ esperado, importado }) => esperado !== importado);
  return {
    ok: missing.length === 0 && unexpected.length === 0 && priceMismatches.length === 0,
    referenceCount: referenceProducts.length,
    importedCount: importedProducts.length,
    missing,
    unexpected,
    priceMismatches,
  };
}

export function getDavidReferenceProducts() {
  return DAVID_MARKET_PRODUCTS.map((product) => ({
    ...product,
    foto: null,
    source: { ...product.source },
  }));
}

/**
 * @param {{
 *   nodeId?: string,
 *   endpoint?: string,
 *   signal?: AbortSignal,
 *   fetchImpl?: typeof fetch,
 * }} [opciones]
 */
export async function loadFederatedMarket({
  nodeId = import.meta.env.VITE_MARKET_NODE_ID || 'central',
  endpoint,
  signal,
  fetchImpl,
} = {}) {
  if (nodeId === 'milpa' || nodeId === 'milpa-david') {
    // 2026-09-08 (visual mercado.chagra.bio/milpa.chagra.bio): la vitrina del
    // nodo aliado mostraba SIEMPRE el snapshot estático de #productos
    // (DAVID_MARKET_PRODUCTS, congelado 2026-08-24, 8 items) e ignoraba el
    // resultado real de `?mercado=milpa` salvo para una comparación que no se
    // veía en pantalla. El catálogo vivo ya trae 24 (y va camino a 45, otro
    // carril está sincronizando desde el repo del aliado). Prioridad: mostrar
    // el catálogo vivo; el snapshot queda solo como respaldo si la API falla.
    let apiProducts = [];
    let apiError = null;
    try {
      apiProducts = await fetchFederatedProducts({ endpoint, mercado: 'milpa', signal, fetchImpl });
    } catch (error) {
      apiError = error;
    }
    const comparison = compareCatalogs(DAVID_MARKET_PRODUCTS, apiProducts);
    const products = apiError ? getDavidReferenceProducts() : apiProducts;
    return {
      products,
      nodes: [{ id: 'milpa-david', name: 'MILPA', count: products.length }],
      source: apiError ? 'david-reference' : 'federated-api',
      sourceUrl: apiError ? DAVID_MARKET_SOURCE : (endpoint || getMarketProductsPath()),
      comparison,
      apiError,
    };
  }

  // Central = unión completa sin filtro, SIN excluir nada (decisión operador
  // 2026-09-08). Antes, si el snapshot congelado no coincidía con la API viva
  // (algo garantizado en cuanto el catálogo creciera), el central sustituía el
  // subconjunto 'milpa' por el snapshot y el listado se achicaba en silencio.
  // `comparison` se conserva solo como dato informativo (aviso en pantalla),
  // nunca para recortar productos.
  const apiProducts = await fetchFederatedProducts({ endpoint, signal, fetchImpl });
  const milpaApiProducts = apiProducts.filter((product) => product.nodeId === 'milpa');
  const comparison = compareCatalogs(DAVID_MARKET_PRODUCTS, milpaApiProducts);
  const nodeCounts = new Map();
  apiProducts.forEach((product) => {
    const key = product.nodeId;
    nodeCounts.set(key, (nodeCounts.get(key) || 0) + 1);
  });
  return {
    products: apiProducts,
    nodes: Array.from(nodeCounts, ([id, count]) => ({ id, name: id === 'milpa' ? 'MILPA' : id, count })),
    source: 'federated-api',
    sourceUrl: endpoint || getMarketProductsPath(),
    comparison,
    apiError: null,
  };
}
