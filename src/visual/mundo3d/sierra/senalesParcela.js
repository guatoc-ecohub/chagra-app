import { altitudFincaValida } from '../pisosTermicos.js';
import { alturaSierra, wzDeAltura, yDeMsnm } from './sierraRelieve.js';

const clamp = (value) => Math.max(0, Math.min(1, value));

// Traducción gráfica, no cálculo meteorológico. No completa lecturas ausentes.
export function senalesParcela(clima) {
  const disponible = clima?.senal === true;
  const lluvia = disponible && Number.isFinite(clima?.lluviaMm) && clima.lluviaMm > 0
    ? clamp(clima.lluviaMm / 40) : 0;
  const niebla = disponible && Number.isFinite(clima?.humedad)
    ? clamp((clima.humedad - 80) / 20) : 0;
  const viento = disponible && Number.isFinite(clima?.viento) && clima.viento >= 0
    ? clamp(clima.viento / 40) : null;
  return { lluvia, niebla, viento };
}

// Punto ilustrativo sobre la cota confirmada, no una geolocalización en el macizo.
export function anclaParcela(msnm) {
  const altitud = altitudFincaValida(msnm);
  if (altitud == null) return null;
  const z = wzDeAltura(yDeMsnm(altitud));
  return z == null ? null : [0, alturaSierra(0, z), z];
}
