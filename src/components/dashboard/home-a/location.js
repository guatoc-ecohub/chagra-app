import { isSavedLocationCoarse } from '../../../services/locationService';

/** A suggested municipality or its default elevation cannot identify a farm.
 * @param {Record<string, any>} [profile]
 */
export function hasConfirmedHomeLocation(profile = {}) {
  const altitude = profile.finca_altitud ?? profile.altitud;
  return Boolean(
    typeof profile.municipio === 'string' && profile.municipio.trim()
    && altitude != null && String(altitude).trim() !== ''
    && Number.isFinite(Number(altitude)) && Number(altitude) >= -100 && Number(altitude) <= 6000
    && profile.altitud_source !== 'cabecera'
    && !isSavedLocationCoarse(profile),
  );
}
