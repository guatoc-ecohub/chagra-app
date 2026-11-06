import { NUBES_POR_TIER, nubesAlisios, nubesOrograficas } from './nubesSierra.js';
import { franjaCondensacion } from './descensoSierra.js';
import { alturaSierra, COSTA_Z } from './sierraRelieve.js';

export function componerNubesSierra({ tier, fase = 'neutral', humedad = null, cantidad = 0.65, semilla = 31 }) {
  const cfg = NUBES_POR_TIER[tier] ?? NUBES_POR_TIER.medio;
  const cobertura = Math.max(0, Math.min(1, cantidad));
  const franja = franjaCondensacion(fase, humedad);
  const faseAlisios = fase === 'el_nino' ? 'nino' : fase === 'la_nina' ? 'nina' : 'neutral';
  const alisios = cobertura < 0.18 ? [] : nubesAlisios({
    cuantas: Math.round(cfg.alisios * cobertura), fase: faseAlisios,
    lobulos: cfg.lobulos, costaZ: COSTA_Z, semilla,
  });
  const orog = nubesOrograficas({
    cuantas: Math.round(cfg.orograficas * cobertura), franja,
    alturaFn: alturaSierra, costaZ: COSTA_Z, lobulos: cfg.lobulos, semilla: semilla + 22,
  }).map((n) => ({ ...n, alto: n.alto * (0.75 + 0.25 * (n.amplitud ?? 1)) }));
  // Cuerpos separados dentro del cupo por tier, incluso con fase húmeda.
  return [...alisios.slice(0, cfg.alisios), ...orog].map((n, i) => ({
    ...n, ancho: n.ancho * 0.78, alto: n.alto * (1.1 + (i % 3) * 0.18),
  }));
}
