import { leerCompanero } from '../compai/nucleo/elenco.js';

export const DEFAULT_COMPANION_VOICE = Object.freeze({
  engine: 'kokoro',
  voice: 'em_santa',
});

export const COMPANION_VOICES = Object.freeze({
  angelita: Object.freeze({ engine: 'piper', voice: 'es_MX-gevy-10196-epoch-high' }),
  abejita: Object.freeze({ engine: 'piper', voice: 'es_MX-gevy-10196-epoch-high' }),
  luciernaga: Object.freeze({ engine: 'piper', voice: 'es_MX-claude-14947-epoch-high' }),
  zariguya: Object.freeze({ engine: 'piper', voice: 'es_ES-sharvard-medium' }),
  'chivito-punk': Object.freeze({ engine: 'kokoro', voice: 'em_alex' }),
  'oso-baston': Object.freeze({ engine: 'kokoro', voice: 'em_santa' }),
});

/**
 * Resuelve la voz asignada al compai actual. Los compais sin reparto explícito
 * conservan el defecto actual y no inventan una voz.
 *
 * @param {string|null|undefined} compai
 * @returns {{engine: 'kokoro'|'piper', voice: string}}
 */
export function getCompanionVoice(compai = leerCompanero()) {
  return COMPANION_VOICES[compai] || DEFAULT_COMPANION_VOICE;
}

export default COMPANION_VOICES;
