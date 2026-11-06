import { loteAreaSqMeters, loteGeoJson } from './loteService';

export const MIN_PEST_MAP_CONFIDENCE = 0.7;
const DAY_MS = 24 * 60 * 60 * 1000;
const RING_EPSILON = 1e-9;

/** GPS guardado junto a fotos de navegador, del importador o de Immich. */
export function extractPhotoGps(photo) {
  const gps = photo?.gps || photo?.metadata?.gps || photo?.exif?.gps;
  if (Array.isArray(gps) && gps.length >= 2) {
    return validCoords(Number(gps[0]), Number(gps[1]));
  }
  if (!gps || typeof gps !== 'object') return null;
  const lat = Number(gps.lat ?? gps.latitude ?? gps.GPSLatitude);
  const lng = Number(gps.lng ?? gps.lon ?? gps.longitude ?? gps.GPSLongitude);
  return validCoords(lat, lng);
}

function validCoords(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? [lat, lng]
    : null;
}

function diagnosisName(finding) {
  const firstIssue = Array.isArray(finding?.issues) ? finding.issues[0] : null;
  const candidate = finding?.pestName || finding?.name || finding?.diagnosis
    || (typeof firstIssue === 'string' ? firstIssue : firstIssue?.name);
  return typeof candidate === 'string' ? candidate.trim() : '';
}

function normalizeConfidence(value) {
  if (!Number.isFinite(value)) return null;
  if (value > 1 && value <= 100) return value / 100;
  return value >= 0 && value <= 1 ? value : null;
}

function isHealthyName(name) {
  const value = String(name || '').trim();
  return /^(?:sana?|saludable)\b/i.test(value)
    || /\b(?:sin plagas?|sin enfermedades?|sin hallazgos|no presenta signos|no se observan plagas?)\b/i.test(value);
}

/** Arma solo metadata local de la foto; no crea ni modifica Assets o Logs. */
export function buildPhotoMapDiagnosis(finding, {
  diagnosedAt = new Date().toISOString(),
  secondOpinionDisagreed = null,
} = {}) {
  const name = diagnosisName(finding);
  return {
    name: name && !isHealthyName(name) ? name : null,
    confidence: normalizeConfidence(finding?.confidence),
    diagnosedAt,
    secondOpinionDisagreed,
    source: 'vision_model',
    model_version: finding?.model_version || finding?._model || null,
    needs_human_review: true,
  };
}

/** Conserva el resultado existente y adjunta el resumen que consulta el mapa. */
export function withPhotoMapDiagnosis(finding, options) {
  if (!finding || typeof finding !== 'object') return finding;
  return { ...finding, pestMapDiagnosis: buildPhotoMapDiagnosis(finding, options) };
}

function readStoredDiagnosis(photo) {
  const raw = photo?.ai_diagnosis || photo?.diagnosis;
  if (!raw || typeof raw !== 'object') return null;
  const diagnosis = raw.pestMapDiagnosis || raw.pest_map_diagnosis || raw;
  const rawIssue = Array.isArray(raw.issues) ? raw.issues[0] : null;
  const candidate = diagnosis.name || diagnosis.pestName || diagnosis.diagnosis
    || (typeof rawIssue === 'string' ? rawIssue : rawIssue?.name);
  const name = typeof candidate === 'string' ? candidate.trim() : '';
  if (!name || isHealthyName(name)) return null;
  const confidence = normalizeConfidence(diagnosis.confidence);
  if (confidence !== null && confidence < MIN_PEST_MAP_CONFIDENCE) return null;
  return {
    name,
    confidence,
    diagnosedAt: diagnosis.diagnosedAt || diagnosis.date || null,
    secondOpinionDisagreed: typeof diagnosis.secondOpinionDisagreed === 'boolean'
      ? diagnosis.secondOpinionDisagreed
      : null,
    needsHumanReview: diagnosis.needs_human_review !== false,
  };
}

function pointOnSegment(point, start, end) {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);
  if (Math.abs(cross) > RING_EPSILON) return false;
  return x >= Math.min(x1, x2) - RING_EPSILON
    && x <= Math.max(x1, x2) + RING_EPSILON
    && y >= Math.min(y1, y2) - RING_EPSILON
    && y <= Math.max(y1, y2) + RING_EPSILON;
}

/** Retorna outside, inside o boundary para un anillo GeoJSON [lng, lat]. */
function pointInRingState(point, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 'outside';
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const current = ring[i];
    const previous = ring[j];
    if (!Array.isArray(current) || !Array.isArray(previous)) continue;
    if (pointOnSegment(point, previous, current)) return 'boundary';
    const [x, y] = current;
    const [xPrev, yPrev] = previous;
    if ((y > point[1]) !== (yPrev > point[1])
      && point[0] < ((xPrev - x) * (point[1] - y)) / (yPrev - y) + x) {
      inside = !inside;
    }
  }
  return inside ? 'inside' : 'outside';
}

function pointInPolygon(point, polygon) {
  if (!Array.isArray(polygon) || polygon.length === 0) return false;
  const outer = pointInRingState(point, polygon[0]);
  if (outer === 'outside') return false;
  if (outer === 'boundary') return true;
  for (const hole of polygon.slice(1)) {
    const state = pointInRingState(point, hole);
    if (state === 'boundary') return true;
    if (state === 'inside') return false;
  }
  return true;
}

function pointInLandGeometry(point, geometry) {
  if (!geometry || !Array.isArray(point)) return false;
  if (geometry.type === 'Polygon') return pointInPolygon(point, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
  }
  return false;
}

/** Asigna por polígono (incluye el borde); nunca aproxima al lote más cercano. */
export function resolvePestLotForPoint(coords, lotes = []) {
  if (!Array.isArray(coords) || coords.length < 2 || !Array.isArray(lotes)) return null;
  const [lat, lng] = coords.map(Number);
  if (!validCoords(lat, lng)) return null;
  const point = [lng, lat];
  const matches = lotes.filter((lote) => pointInLandGeometry(point, loteGeoJson(lote)));
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const areaA = loteAreaSqMeters(a) || Number.POSITIVE_INFINITY;
    const areaB = loteAreaSqMeters(b) || Number.POSITIVE_INFINITY;
    return areaA - areaB;
  });
  const lote = matches[0];
  return {
    id: lote.id || null,
    name: lote?.attributes?.name || lote?.name || 'Lote sin nombre',
  };
}

function photoTimestamp(photo, diagnosis) {
  const value = diagnosis?.diagnosedAt || photo?.capturedAt || photo?.createdAt;
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Proyección en memoria de diagnósticos recientes para el mapa. */
export function buildPestMapData(records = [], lotes = [], {
  days = 30,
  pest = 'all',
  now = Date.now(),
} = {}) {
  const windowDays = Number.isFinite(Number(days)) && Number(days) > 0 ? Number(days) : 30;
  const cutoff = now - windowDays * DAY_MS;
  const recent = [];

  for (const photo of records) {
    if (!photo?.blob) continue;
    const diagnosis = readStoredDiagnosis(photo);
    if (!diagnosis) continue;
    const timestamp = photoTimestamp(photo, diagnosis);
    if (timestamp === null || timestamp < cutoff || timestamp > now) continue;
    recent.push({ photo, diagnosis, timestamp, coords: extractPhotoGps(photo) });
  }

  const availablePests = [...new Set(recent.map(({ diagnosis }) => diagnosis.name))]
    .sort((a, b) => a.localeCompare(b, 'es'));
  const selected = pest === 'all' ? recent : recent.filter(({ diagnosis }) => diagnosis.name === pest);
  const noGpsCount = selected.filter(({ coords }) => !coords).length;
  const points = selected.filter(({ coords }) => coords).map(({ photo, diagnosis, timestamp, coords }) => {
    const lot = resolvePestLotForPoint(coords, lotes);
    return {
      id: photo.id,
      photo,
      diagnosis,
      timestamp,
      coords,
      lotId: lot?.id || null,
      lotName: lot?.name || null,
    };
  });

  const countByLot = new Map();
  for (const point of points) {
    const id = point.lotId || 'sin-lote';
    const current = countByLot.get(id) || {
      id,
      name: point.lotName || 'Sin lote',
      count: 0,
      firstSeen: point.timestamp,
    };
    current.count += 1;
    current.firstSeen = Math.min(current.firstSeen, point.timestamp);
    countByLot.set(id, current);
  }

  return {
    points,
    noGpsCount,
    availablePests,
    countsByLot: [...countByLot.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es')),
    totalDiagnoses: selected.length,
  };
}
