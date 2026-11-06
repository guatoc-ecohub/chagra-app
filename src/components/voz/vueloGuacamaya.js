import { GUACAMAYA_CSS_TEXTO } from '../../visual/creatures/arte-valle/guacamayaCssTexto';

// Un reloj para todo el traslado. Los estados solo motivan el próximo vuelo.
export const REPOSO_INICIAL = 3800;
export const DURACION_VUELO = 4000;
export const APOYOS = [.25, .75];
export const ANCHO_AVE = .46;

const suave = t => t * t * (3 - 2 * t);
const limitar = t => Math.max(0, Math.min(1, t));
const mezclar = (a, b, t) => a + (b - a) * suave(limitar(t));

// Reutiliza guacaBatido del rig sin sus otros bucles. El mismo tiempo que
// mueve el cuerpo muestrea las alas, por lo que la pausa conserva toda la pose.
const textoBatido = GUACAMAYA_CSS_TEXTO.match(/@keyframes guacaBatido\{((?:[^{}]*\{[^{}]*\})*)\}/)[1];
const batido = [...textoBatido.matchAll(/([\d%,]+)\{transform:rotate\((\d+)deg\)\}/g)]
  .flatMap(([, porcentajes, angulo]) => porcentajes.split(',').map(porcentaje => [parseFloat(porcentaje) / 100, Number(angulo)]))
  .sort((a, b) => a[0] - b[0]);

function anguloBatido(t) {
  const ciclo = ((t - .14) * DURACION_VUELO / 480) % 1;
  const i = batido.findIndex(([offset]) => offset >= ciclo);
  if (i <= 0) return batido[0][1];
  const [inicio, a] = batido[i - 1];
  const [fin, b] = batido[i];
  return mezclar(a, b, (ciclo - inicio) / (fin - inicio));
}

export function alasVuelo(tiempo) {
  const t = limitar(tiempo / DURACION_VUELO);
  const apertura = t < .14 ? suave(t / .14) : t > .86 ? 1 - suave((t - .86) / .14) : 1;
  const angulo = t < .14 ? batido[0][1] : t < .68 ? anguloBatido(t)
    : t < .86 ? mezclar(anguloBatido(.68), 88, (t - .68) / .18) : 88;
  return { apertura, angulo };
}

export function muestraVuelo(tiempo, origen, destino) {
  const t = limitar(tiempo / DURACION_VUELO);
  // Impulso sobre el apoyo; arco con tangentes horizontales en ambos extremos.
  const viaje = limitar((t - .14) / .72);
  const avance = suave(viaje);
  const elevacion = Math.sin(Math.PI * viaje) ** 2;
  const salida = suave(limitar((t - .07) / .13));
  const llegada = suave(limitar((t - .72) / .14));
  const aire = salida * (1 - llegada);
  const direccion = Math.sign(destino - origen);
  return {
    fase: t < .14 ? 'impulso' : t < .3 ? 'despegue' : t < .68 ? 'vuelo' : t < .86 ? 'frenado' : t < 1 ? 'aterrizaje' : 'posada',
    x: origen + (destino - origen) * avance,
    y: -elevacion * .23,
    inclinacion: direccion * (14 * Math.sin(Math.PI * avance) - 18 * llegada * (1 - suave(limitar((t - .86) / .14)))),
    compresion: t < .14 ? Math.sin(t / .14 * Math.PI) * .07 : t > .86 ? Math.sin((t - .86) / .14 * Math.PI) * .045 : 0,
    aire,
    avance,
  };
}
