/**
 * Lectura puntual de SoilGrids desde GeoTIFF por rangos HTTP.
 *
 * Se consulta el VRT una vez para ubicar el mosaico que cubre el punto. Los
 * valores se leen de los GeoTIFF de cada capa, sin pasar por el REST de
 * propiedades. El VRT se guarda en Cache Storage; las estimaciones quedan en
 * memoria y nunca se escriben en el Asset.
 */

const DATA_ROOT = 'https://files.isric.org/soilgrids/latest/data';
const CACHE_NAME = 'chagra-soilgrids-index-v1';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 45_000;
const GRID_SIZE_M = 250;
const EARTH_RADIUS_M = 6378137;
const TRANSITION_LATITUDE = (40 + 44 / 60 + 11.8 / 3600) * Math.PI / 180;
const DEG = Math.PI / 180;
const DEPTHS = ['0-5cm', '5-15cm', '15-30cm'];
const PROPERTIES = ['phh2o', 'soc', 'sand', 'silt', 'clay'];
const CONVERSION = Object.freeze({ phh2o: 10, soc: 10, sand: 10, silt: 10, clay: 10 });

/**
 * @typedef {(url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>} SoilVrtFetcher
 * @typedef {(url: string, x: number, y: number, signal?: AbortSignal) => Promise<number>} SoilGridPixelReader
 * @typedef {{ match: (request: RequestInfo | URL) => Promise<Response | undefined>, put: (request: RequestInfo | URL, response: Response) => Promise<void> | void }} SoilVrtCache
 * @typedef {{ open: (name: string) => Promise<SoilVrtCache> }} SoilVrtCacheStorage
 * @typedef {{ fetchImpl?: SoilVrtFetcher, readPixel?: SoilGridPixelReader, cacheStorage?: SoilVrtCacheStorage, now?: () => Date, timeoutMs?: number }} SoilGridsClientOptions
 */

const normalizedLongitude = (longitude) => {
  let value = longitude;
  while (value < -180) value += 360;
  while (value > 180) value -= 360;
  return value;
};

const mollweideY = (latitude) => {
  if (Math.abs(Math.abs(latitude) - Math.PI / 2) < 1e-12) {
    return Math.sign(latitude) * Math.sqrt(2);
  }
  let theta = latitude;
  for (let i = 0; i < 12; i += 1) {
    const delta = (2 * theta + Math.sin(2 * theta) - Math.PI * Math.sin(latitude)) /
      (2 + 2 * Math.cos(2 * theta));
    theta -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return Math.sqrt(2) * Math.sin(theta);
};

const MOLLWEIDE_OFFSET = TRANSITION_LATITUDE - mollweideY(TRANSITION_LATITUDE);

/**
 * Proyecta una coordenada WGS84 al Interrupted Goode Homolosine de los COGs.
 * La selección de lóbulos y las ecuaciones siguen la definición pública de
 * PROJ para +proj=igh. SoilGrids usa radio 6378137 m y píxel de 250 m.
 * @param {[number, number]} coordinates [longitud, latitud] en grados.
 * @returns {[number, number]} Coordenadas proyectadas en metros.
 */
export function projectToSoilGridsGrid([longitude, latitude]) {
  const longitudeRad = normalizedLongitude(longitude) * DEG;
  const latitudeRad = latitude * DEG;
  let centerLongitude;
  let xOffset;
  let yOffset;
  let useMollweide = false;

  if (latitudeRad >= TRANSITION_LATITUDE) {
    centerLongitude = (longitudeRad <= -40 * DEG ? -100 : 30) * DEG;
    xOffset = centerLongitude;
    yOffset = MOLLWEIDE_OFFSET;
    useMollweide = true;
  } else if (latitudeRad >= 0) {
    centerLongitude = (longitudeRad <= -40 * DEG ? -100 : 30) * DEG;
    xOffset = centerLongitude;
  } else if (latitudeRad >= -TRANSITION_LATITUDE) {
    centerLongitude = (longitudeRad <= -100 * DEG ? -160
      : longitudeRad <= -20 * DEG ? -60
        : longitudeRad <= 80 * DEG ? 20 : 140) * DEG;
    xOffset = centerLongitude;
  } else {
    centerLongitude = (longitudeRad <= -100 * DEG ? -160
      : longitudeRad <= -20 * DEG ? -60
        : longitudeRad <= 80 * DEG ? 20 : 140) * DEG;
    xOffset = centerLongitude;
    yOffset = -MOLLWEIDE_OFFSET;
    useMollweide = true;
  }

  const relativeLongitude = longitudeRad - centerLongitude;
  if (useMollweide) {
    let theta = latitudeRad;
    if (Math.abs(Math.abs(latitudeRad) - Math.PI / 2) < 1e-12) {
      theta = Math.sign(latitudeRad) * Math.PI / 2;
    } else {
      for (let i = 0; i < 12; i += 1) {
        const delta = (2 * theta + Math.sin(2 * theta) - Math.PI * Math.sin(latitudeRad)) /
          (2 + 2 * Math.cos(2 * theta));
        theta -= delta;
        if (Math.abs(delta) < 1e-12) break;
      }
    }
    const x = xOffset + (2 * Math.SQRT2 / Math.PI) * relativeLongitude * Math.cos(theta);
    const y = yOffset + Math.SQRT2 * Math.sin(theta);
    return [x * EARTH_RADIUS_M, y * EARTH_RADIUS_M];
  }

  return [
    (xOffset + relativeLongitude * Math.cos(latitudeRad)) * EARTH_RADIUS_M,
    latitudeRad * EARTH_RADIUS_M,
  ];
}

const parseAttributes = (text) => Object.fromEntries(
  [...String(text || '').matchAll(/(xOff|yOff|xSize|ySize)="([^"]+)"/g)]
    .map((match) => [match[1], Number(match[2])]),
);

/** Convierte el VRT público en un índice liviano de rectángulos fuente. */
export function parseSoilGridsVrt(xml) {
  const transform = xml.match(/<GeoTransform>([\s\S]*?)<\/GeoTransform>/)?.[1]
    ?.split(',').map(Number);
  if (!transform || transform.length < 6 || transform.some((value) => !Number.isFinite(value))) {
    throw new Error('VRT sin geotransformación legible');
  }
  const version = xml.match(/<MDI key="Code_version">([^<]+)<\/MDI>/)?.[1] || null;
  const tiles = [];
  for (const match of xml.matchAll(/<ComplexSource>([\s\S]*?)<\/ComplexSource>/g)) {
    const source = match[1];
    const sourcePath = source.match(/<SourceFilename[^>]*>([^<]+)<\/SourceFilename>/)?.[1];
    const sourceRect = parseAttributes(source.match(/<SrcRect\b([^>]*)>/)?.[1]);
    const destinationRect = parseAttributes(source.match(/<DstRect\b([^>]*)>/)?.[1]);
    if (sourcePath && sourceRect.xSize > 0 && sourceRect.ySize > 0 &&
        destinationRect.xSize > 0 && destinationRect.ySize > 0) {
      tiles.push({ sourcePath, sourceRect, destinationRect });
    }
  }
  if (tiles.length === 0) throw new Error('VRT sin mosaicos legibles');
  return {
    originX: transform[0],
    pixelWidth: transform[1],
    originY: transform[3],
    pixelHeight: transform[5],
    version,
    tiles,
  };
}

async function fetchTextWithCache(url, fetchImpl, cacheStorage, signal) {
  let cache = null;
  let cachedText = null;
  let cachedAt = null;
  try {
    cache = cacheStorage ? await cacheStorage.open(CACHE_NAME) : null;
    const cached = cache ? await cache.match(url) : null;
    if (cached) {
      cachedText = await cached.text();
      cachedAt = Number(cached.headers?.get('x-chagra-cached-at')) || 0;
      if (cachedAt > 0 && Date.now() - cachedAt <= CACHE_MAX_AGE_MS) return cachedText;
    }
  } catch {
    cache = null;
  }

  try {
    const response = await fetchImpl(url, { mode: 'cors', signal });
    if (!response?.ok) throw new Error(`VRT no disponible (${response?.status || 'sin respuesta'})`);
    const text = await response.text();
    if (cache) {
      try {
        await cache.put(url, new Response(text, {
          headers: { 'content-type': 'application/xml', 'x-chagra-cached-at': String(Date.now()) },
        }));
      } catch { /* La lectura no depende de Cache Storage. */ }
    }
    return text;
  } catch (error) {
    if (cachedText) return cachedText;
    throw error;
  }
}

async function readCogPixel(url, x, y, signal) {
  const { fromUrl } = await import('geotiff');
  const tiff = await fromUrl(url, {}, signal);
  const image = await tiff.getImage();
  const raster = await image.readRasters({
    window: [x, y, x + 1, y + 1],
    interleave: true,
    signal,
  });
  return raster[0];
}

const getSourceFileParts = (sourcePath) => {
  const match = sourcePath.match(/(tileSG-[^/]+)\/(tileSG-[^/]+_\d-\d\.tif)$/);
  return match ? { tileDirectory: match[1], fileName: match[2] } : null;
};

const buildCogUrl = (property, depth, tile) => {
  const parts = getSourceFileParts(tile.sourcePath);
  if (!parts) throw new Error('Ruta de mosaico desconocida');
  const layer = `${property}_${depth}_mean`;
  return `${DATA_ROOT}/${property}/${layer}/${parts.tileDirectory}/${parts.fileName}`;
};

const findTileAt = (index, longitude, latitude) => {
  const [x, y] = projectToSoilGridsGrid([longitude, latitude]);
  const pixelX = Math.floor((x - index.originX) / index.pixelWidth);
  const pixelY = Math.floor((y - index.originY) / index.pixelHeight);
  const tile = index.tiles.find(({ destinationRect: rect }) =>
    pixelX >= rect.xOff && pixelX < rect.xOff + rect.xSize &&
    pixelY >= rect.yOff && pixelY < rect.yOff + rect.ySize,
  );
  if (!tile) return null;
  const localX = Math.floor(tile.sourceRect.xOff +
    ((pixelX - tile.destinationRect.xOff) * tile.sourceRect.xSize) / tile.destinationRect.xSize);
  const localY = Math.floor(tile.sourceRect.yOff +
    ((pixelY - tile.destinationRect.yOff) * tile.sourceRect.ySize) / tile.destinationRect.ySize);
  return { tile, localX, localY, pixelX, pixelY };
};

/**
 * Crea un cliente testeable con fixture VRT y lector de GeoTIFF inyectados.
 * @param {SoilGridsClientOptions} options
 */
export function createSoilGridsClient({
  fetchImpl = fetch,
  readPixel = readCogPixel,
  cacheStorage = globalThis.caches,
  now = () => new Date(),
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  const indexPromises = new Map();
  const estimatesByCell = new Map();
  const loadIndex = (property, signal) => {
    if (!indexPromises.has(property)) {
      const url = `${DATA_ROOT}/${property}/${property}_0-5cm_mean.vrt`;
      indexPromises.set(property, fetchTextWithCache(url, fetchImpl, cacheStorage, signal)
        .then(parseSoilGridsVrt)
        .catch((error) => {
          indexPromises.delete(property);
          throw error;
        }));
    }
    return indexPromises.get(property);
  };

  return async function getEstimate(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 2 ||
        !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]) ||
        coordinates[0] < -180 || coordinates[0] > 180 ||
        coordinates[1] < -90 || coordinates[1] > 90) return null;
    let estimateKey = null;
    const requestController = new AbortController();
    const requestSignal = requestController.signal;
    const timeout = setTimeout(() => requestController.abort(), timeoutMs);
    try {
      const indexes = Object.fromEntries(await Promise.all(PROPERTIES.map(async (property) =>
        [property, await loadIndex(property, requestSignal)])));
      const versions = new Set(Object.values(indexes).map((index) => index.version).filter(Boolean));
      if (versions.size > 1) throw new Error('Versiones de mosaico incompatibles');
      const locatedByProperty = Object.fromEntries(PROPERTIES.map((property) => [
        property,
        findTileAt(indexes[property], coordinates[0], coordinates[1]),
      ]));
      if (Object.values(locatedByProperty).some((located) => !located)) return null;
      estimateKey = coordinates.map((value) => value.toFixed(6)).join(':');
      if (estimatesByCell.has(estimateKey)) return estimatesByCell.get(estimateKey);
      const layers = await Promise.all(DEPTHS.map(async (depth) => {
        const values = await Promise.all(PROPERTIES.map(async (property) => {
          const located = locatedByProperty[property];
          const url = buildCogUrl(property, depth, located.tile);
          const raw = Number(await readPixel(url, located.localX, located.localY, requestSignal));
          if (!Number.isFinite(raw) || raw === -32768) throw new Error('Capa sin dato para este punto');
          return [property, raw / CONVERSION[property]];
        }));
        const mapped = Object.fromEntries(values);
        return {
          depth,
          ph: { value: mapped.phh2o, unit: 'pH' },
          organicCarbon: { value: mapped.soc, unit: 'g/kg' },
          texture: {
            sand: { value: mapped.sand, unit: '%' },
            silt: { value: mapped.silt, unit: '%' },
            clay: { value: mapped.clay, unit: '%' },
          },
        };
      }));
      const estimate = {
        source: 'SoilGrids, ISRIC',
        modelVersion: indexes.phh2o.version || 'SoilGrids 2.0',
        resolutionM: GRID_SIZE_M,
        retrievedAt: now().toISOString(),
        sampleDateAvailable: false,
        depths: layers,
      };
      estimatesByCell.set(estimateKey, estimate);
      return estimate;
    } catch {
      return estimateKey ? estimatesByCell.get(estimateKey) || null : null;
    } finally {
      clearTimeout(timeout);
    }
  };
}

const getDefaultEstimate = createSoilGridsClient();

/** Devuelve datos estimados o null si no se pudieron leer las capas requeridas. */
export const getSoilGridsEstimate = (coordinates) => getDefaultEstimate(coordinates);
