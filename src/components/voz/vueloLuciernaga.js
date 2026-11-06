// Segundos, posición del cuerpo, luz, apoyo. Los intervalos repetidos son reposo real.
/** @type {Array<[number, number, number, number, string?]>} */
const RUTA = [
  [0, 591, 250, .85, 'hoja'], [1.1, 591, 250, .85, 'hoja'],
  [1.65, 640, 192, 1], [2.15, 622, 168, .9], [2.6, 622, 168, .9],
  [3.25, 705, 204, .7], [3.7, 684, 180, .15], [4.1, 684, 180, 0],
  [4.9, 796, 142, 0], [5.4, 796, 142, .95],
  [6, 758, 114, 1], [6.55, 737, 146, .8, 'tallo'],
  [8.2, 737, 146, .6, 'tallo'], [8.8, 803, 182, .85],
  [9.3, 780, 204, 1], [9.75, 817, 180, .75],
  [10.25, 817, 180, .15], [10.65, 817, 180, 0],
  [11.4, 703, 228, 0], [12, 703, 228, .9],
  [12.55, 751, 202, 1], [13.15, 775, 234, .8, 'borde'],
  [15.3, 775, 234, .65, 'borde'], [15.9, 702, 182, .9],
  [16.45, 720, 157, .8], [16.9, 720, 157, .8],
  [17.6, 624, 193, .45], [18.1, 649, 216, 0],
  [19, 540, 174, 0], [19.6, 540, 174, .95],
  [20.3, 512, 214, .85], [20.8, 560, 230, 1],
  [21.3, 560, 230, .7], [22, 591, 250, .8, 'hoja'],
  [24.4, 591, 250, .6, 'hoja'], [25, 641, 208, .85],
  [25.7, 615, 184, 1], [26.3, 615, 184, .9],
  [27.1, 569, 220, .7], [28, 591, 250, .85, 'hoja'],
];
export const DURACION_VUELO = 28;
const suave = t => t * t * (3 - 2 * t);
const mezclar = (a, b, t) => a + (b - a) * t;

function punto(fila, compacto) {
  const [t, x, y, luz, apoyo] = fila;
  // Se acorta la distancia, nunca se acelera el ritmo en un teléfono.
  return { t, x: compacto ? 591 + (x - 591) * .58 : x, y, luz, apoyo };
}

export function vueloLuciernaga(segundos, compacto = false) {
  const t = ((segundos % DURACION_VUELO) + DURACION_VUELO) % DURACION_VUELO;
  const indice = RUTA.findIndex(fila => fila[0] > t);
  const a = punto(RUTA[indice - 1], compacto);
  const b = punto(RUTA[indice], compacto);
  const avance = (t - a.t) / (b.t - a.t);
  const fase = suave(avance);
  const quieta = a.x === b.x && a.y === b.y;
  const apoyo = quieta && a.apoyo === b.apoyo ? a.apoyo : undefined;
  const giro = quieta ? 0 : Math.sign(b.x - a.x) * Math.sin(avance * Math.PI) * -9;
  const x = mezclar(a.x, b.x, fase);
  const y = mezclar(a.y, b.y, fase);
  const luz = mezclar(a.luz, b.luz, fase);
  const radianes = giro * Math.PI / 180;
  // Centro luminoso del abdomen: 140 unidades del cuerpo, a escala .43.
  const focoX = x - Math.sin(radianes) * 60.2;
  const focoY = y + Math.cos(radianes) * 60.2;
  return { x, y, giro, luz, apoyo, focoX, focoY,
    agua: luz * Math.max(0, 1 - (468 - focoY) / 300) ** 2,
  };
}
