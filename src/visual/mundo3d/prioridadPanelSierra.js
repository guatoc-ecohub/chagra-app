import { FORECAST_THRESHOLDS } from '../../constants/alertThresholds.js';

// Solo presentación: consume las lecturas ya resueltas por el panel.
// Primero peligro, después ausencia crítica, revisión y tranquilidad.
// En empate, la confianza y el horizonte más cercano deciden.
export function ordenarDecisionesSierra({ minima, helada, lluvia, eto, humedad, viento, estado }) {
  const fresca = estado === 'fresco';
  const heladaConocida = helada === 'alto' || helada === 'medio';
  // Una mínima positiva no puede elevar la helada si la noche objetivo no fue evaluada.
  // Se conserva el caso heredado de congelación real (<= 0 °C) como señal suficiente.
  const heladaPorMinimaCongelante = helada == null && Number.isFinite(minima) && minima <= 0;
  const decision = (id, gravedad, dato, horizonte) => ({
    id, gravedad, confianza: Number.isFinite(dato) && fresca ? 1 : 0, horizonte,
  });
  return [
    decision('minima', !Number.isFinite(minima) ? 5 : heladaConocida || heladaPorMinimaCongelante ? 5 : 0, minima, 2),
    decision('suelo', !Number.isFinite(lluvia) || !Number.isFinite(eto) ? 3 : lluvia >= FORECAST_THRESHOLDS.LLUVIA_TORRENCIAL_MM_DIA ? 4 : lluvia !== eto ? 2 : 0, lluvia, 1),
    decision('humedad', !Number.isFinite(humedad) ? 3 : humedad >= 90 ? 2 : 0, humedad, 0),
    decision('viento', !Number.isFinite(viento) ? 3 : viento >= 15 ? 4 : 0, viento, 1),
  ].sort((a, b) => b.gravedad - a.gravedad || b.confianza - a.confianza || a.horizonte - b.horizonte).map(({ id }) => id);
}
