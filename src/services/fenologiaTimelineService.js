/**
 * Agrupador de fotos repetidas por cercanía GPS para la vista de fenología.
 * Solo proyecta datos de media_cache en memoria. No modifica Assets ni fotos.
 */
import { openDB, STORES } from '../db/dbCore';

export const DEFAULT_LOCATION_RADIUS_METERS = 25;

export function normalizePhotoGps(photo) {
  const gps = photo?.gps || photo?.exif?.gps || photo?.metadata?.gps || photo;
  const lat = Number(gps?.lat ?? gps?.latitude);
  const lon = Number(gps?.lon ?? gps?.lng ?? gps?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export function photoTimestamp(photo) {
  const raw = photo?.capturedAt ?? photo?.createdAt ?? photo?.timestamp;
  const value = typeof raw === 'number' ? raw : Date.parse(raw || '');
  return Number.isFinite(value) ? value : null;
}

export function distanceMeters(a, b) {
  const earthRadius = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

/** Agrupa cada foto en el punto existente más cercano dentro del radio. */
export function groupPhotosByLocation(photos = [], radiusMeters = DEFAULT_LOCATION_RADIUS_METERS) {
  const groups = [];
  for (const photo of photos) {
    const gps = normalizePhotoGps(photo);
    if (!gps) continue;
    let nearest = null;
    let nearestDistance = Infinity;
    for (const group of groups) {
      const distance = distanceMeters(gps, group.center);
      if (distance <= radiusMeters && distance < nearestDistance) {
        nearest = group;
        nearestDistance = distance;
      }
    }
    if (!nearest) {
      nearest = { id: `punto-${groups.length + 1}`, center: gps, photos: [] };
      groups.push(nearest);
    }
    nearest.photos.push({ ...photo, gps, timestamp: photoTimestamp(photo) });
    const count = nearest.photos.length;
    nearest.center = {
      lat: nearest.photos.reduce((sum, item) => sum + item.gps.lat, 0) / count,
      lon: nearest.photos.reduce((sum, item) => sum + item.gps.lon, 0) / count,
    };
  }
  return groups
    .map((group) => ({
      ...group,
      photos: group.photos.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)),
      firstTimestamp: group.photos[0]?.timestamp || null,
      lastTimestamp: group.photos.at(-1)?.timestamp || null,
    }))
    .sort((a, b) => (a.firstTimestamp || Infinity) - (b.firstTimestamp || Infinity));
}

export async function listGeotaggedTimelinePhotos() {
  const db = await openDB();
  const transaction = db.transaction(STORES.MEDIA_CACHE, 'readonly');
  const records = await new Promise((resolve) => {
    const request = transaction.objectStore(STORES.MEDIA_CACHE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
  return records
    .filter((photo) => photo?.blob && normalizePhotoGps(photo))
    .map((photo) => {
      const url = URL.createObjectURL(photo.blob);
      return {
        id: photo.id,
        url,
        speciesSlug: photo.speciesSlug || null,
        capturedAt: photo.capturedAt || photo.createdAt || null,
        gps: normalizePhotoGps(photo),
        revoke: () => URL.revokeObjectURL(url),
      };
    });
}
