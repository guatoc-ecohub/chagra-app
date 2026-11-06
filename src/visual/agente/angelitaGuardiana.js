import { guardSyntheticAgrochemical } from '../../services/outputGuards.js';

export function materialSinteticoDetectado(nombre) {
  return guardSyntheticAgrochemical(String(nombre ?? '')).modified;
}

export function avisarCuidadoPorInsumo(nombre) {
  if (!materialSinteticoDetectado(nombre) || typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent('angelita:cuidado-insumo'));
  return true;
}
