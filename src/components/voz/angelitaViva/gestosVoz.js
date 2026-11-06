/**
 * Gestos de angelita por estado de voz — función pura del tiempo.
 *
 * Técnica del corto «compai vivo · angelita» (PR #497 de documentación interna):
 * todo el cuerpo es función de `t`, por pistas suavizadas; nada se sortea.
 * Cada estado de voz toma un tramo del corto como gesto propio:
 *
 *   reposo      respiración, mirada que pasea, parpadeo espaciado.
 *   escuchando  se inclina hacia quien habla; antenas y aleteo siguen el
 *               nivel REAL del micrófono (0..1), no una animación fingida.
 *   pensando    pose «pensar» del corto (7,2–9,2 s): mira arriba, cabeza
 *               que mece, y el tórax se entibia (el calor de la helada).
 *   hablando    pose «hablar»; cada frase que arranca el TTS dispara un
 *               gesto (saluda, abre los brazos, asiente) con saltico y
 *               parpadeo al inicio. El volumen no decide nada.
 *   error       el «aturdida» del corto (11,4–12,7 s): sacudón, antenas
 *               caídas, mirada al suelo.
 *
 * Transición: los parámetros del estado anterior y del nuevo se mezclan
 * durante TRANSICION_S, y el cambio de pose de la tinta ocurre en el fondo
 * de un pequeño agache (el mismo recurso con que el corto cambia de pose),
 * así se lee una sola abeja y no dos clips que se relevan.
 *
 * El vuelo no se usa: hay un carril que redibuja la pose `volar` en la
 * fuente. Punto de cambio si algún día se quiere: POSE_DE_ESTADO.
 */
import { VOZ_REPOSO, VOZ_ESCUCHANDO, VOZ_PENSANDO, VOZ_HABLANDO, VOZ_ERROR } from '../../../constants/estadosVoz';

const PI = Math.PI, TAU = PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, k) => a + (b - a) * k;
const sm = (k) => { k = clamp(k); return k * k * (3 - 2 * k); };
const ss = (a, b, t) => sm((t - a) / (b - a));
const eio = (k) => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
function h1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(h1(i), h1(i + 1), u) * 2 - 1; }
function trk(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b[0]) { const k = eio((t - a[0]) / (b[0] - a[0])); return a.slice(1).map((v, j) => lerp(v, b[j + 1], k)); }
  }
  return keys[keys.length - 1].slice(1);
}
const trk1 = (keys, t) => trk(keys, t)[0];

/** Parpadeo en un instante: 1 abierto, ~0,08 cerrado (el `parp` del corto). */
function parpEn(t, b, dur = .17) {
  const k = (t - b) / dur;
  return k > 0 && k < 1 ? 1 - Math.sin(k * PI) * .92 : 1;
}
/** Parpadeo espaciado y determinista: uno por ventana de `cada` segundos. */
function parpAuto(t, cada, sem) {
  const v = Math.floor(t / cada);
  let p = 1;
  for (const w of [v - 1, v]) p = Math.min(p, parpEn(t, w * cada + h1(w * 7.3 + sem) * cada * .8));
  return p;
}

export const TRANSICION_S = .42;

export const POSE_DE_ESTADO = Object.freeze({
  [VOZ_REPOSO]: 'decir',
  [VOZ_ESCUCHANDO]: 'decir',
  [VOZ_PENSANDO]: 'pensar',
  [VOZ_HABLANDO]: 'hablar',
  [VOZ_ERROR]: 'decir',
});

/** Gesto que dispara la frase i del TTS (rota: la primera siempre saluda). */
export const GESTOS_FRASE = Object.freeze(['saluda', 'abre-brazos', 'asiente']);
export const gestoDeFrase = (indice) => GESTOS_FRASE[((indice % 3) + 3) % 3];

/** Abeja en calma: los campos que lee laminaCanvas. dx/dy en unidades de lámina. */
export function abejaQuieta() {
  return {
    pose: 'decir', dx: 0, dy: 0, rot: 0, sq: 1, alpha: 1,
    cabeza: 0, antena: 0, parpado: 1, mirada: [0, 0], brazoI: .1, brazoD: .1, abdomen: 0, pata: 0,
    alaFase: 0, alaFrec: 0, alaAmp: 0, alaReposo: 0, estela: false, calor: 0, polen: 0, onda: false,
    t: 0, sem: 1.3,
  };
}

const NUMERICOS = ['dx', 'dy', 'rot', 'sq', 'cabeza', 'antena', 'parpado', 'brazoI', 'brazoD', 'abdomen', 'pata', 'alaFrec', 'alaAmp', 'alaReposo', 'calor'];

function respirar(B, t) {
  B.sq = 1 - .012 * (1 + Math.sin(t * 2.2));
  B.dy = Math.sin(t * 1.1) * .08;
}

function reposo(B, t) {
  respirar(B, t);
  B.cabeza = Math.sin(t * .7) * .03;
  B.mirada = [Math.sin(t * .37) * .5, -.1 + Math.sin(t * .23) * .2];
  B.parpado = parpAuto(t, 3.8, 1);
  B.antena = .02 + Math.sin(t * .9) * .03;
  B.alaFrec = 1.2; B.alaAmp = .04;
}

function escuchando(B, t, nivel) {
  const n = clamp(nivel);
  respirar(B, t);
  // se inclina hacia quien habla; más voz, más inclinada
  B.rot = -.05 - .05 * n;
  B.dx = -.25 - .2 * n;
  B.cabeza = -.1 - .07 * n + Math.sin(t * .9) * .02;
  // antenas: se tienden hacia la voz y vibran con ella
  B.antena = -.1 - .3 * n + vn(t * 18) * .06 * n;
  B.mirada = [-.35 + Math.sin(t * .5) * .1, -.15];
  B.parpado = parpAuto(t, 5.2, 2);
  B.brazoI = B.brazoD = .3;
  // aleteo: casi quieto en silencio, zumba con la voz
  B.alaFrec = 4 + 24 * n; B.alaAmp = .05 + .5 * n; B.estela = n > .2;
}

function pensando(B, t) {
  respirar(B, t);
  B.pose = 'pensar';
  B.mirada = [.7 + Math.sin(t * .8) * .2, -.75 + Math.sin(t * .55) * .1];
  B.cabeza = Math.sin(t * 1.6) * .04;
  B.antena = Math.sin(t * 2.4) * .12;
  B.parpado = parpAuto(t, 2.9, 3);
  B.dx = vn(t * 38) * .05;
  // el tórax se entibia y late: la abeja «calienta» la respuesta
  B.calor = .35 + .25 * (1 + Math.sin(t * 2.6)) / 2;
  B.alaFrec = 1; B.alaAmp = .02;
}

function hablando(B, t, frase) {
  respirar(B, t);
  B.pose = 'hablar';
  B.cabeza = Math.sin(t * 2.3) * .04;
  B.antena = Math.sin(t * 6) * .05;
  B.mirada = [-.2, -.1];
  B.parpado = parpAuto(t, 4.1, 4);
  B.brazoI = B.brazoD = .2;
  B.alaFrec = 2; B.alaAmp = .05;
  if (!frase) return;
  const u = t - frase.t;
  if (u < 0) return;
  // al arrancar cada frase: saltico, agache y parpadeo
  if (u < .25) B.sq = 1 - .08 * Math.sin(PI * u / .25);
  B.dy -= Math.abs(Math.sin(u * 7)) * .9 * (1 - ss(.2, 1.1, u));
  B.parpado = Math.min(B.parpado, parpEn(u, .04));
  const env = ss(0, .15, u) * (1 - ss(1.2, 1.8, u));
  const gesto = gestoDeFrase(frase.indice);
  if (gesto === 'saluda') {
    B.onda = true; B.brazoI = .1;
    B.brazoD = .15 + Math.sin(u * TAU * 1.8) * .4 * env;
  } else if (gesto === 'abre-brazos') {
    B.brazoI = B.brazoD = trk1([[0, .2], [.3, 1.1], [1.0, .9], [1.6, .2]], u);
  } else {
    B.cabeza += Math.sin(u * TAU * 2) * .1 * env;
  }
}

function error(B, t, u) {
  B.sq = trk1([[0, .8], [.15, 1.06], [.35, .97], [.55, 1]], u);
  B.cabeza = Math.sin(u * 9) * .12 * (1 - ss(.2, 1.2, u));
  B.mirada = trk([[0, -1, .5], [.4, -1, .6], [.7, .2, .7], [1.5, -.2, .6]], u);
  B.antena = trk1([[0, .35], [1.3, .25]], u);
  B.brazoI = B.brazoD = trk1([[0, .4], [.5, -.2], [1.3, -.6]], u);
  B.parpado = u < .35 ? .1 : Math.min(.75, parpAuto(u, 3.5, 5));
}

/** Cuerpo puro de un estado en el instante t. */
export function cuerpoEstado(estado, t, { desde = 0, nivel = 0, frase = null } = {}) {
  const B = abejaQuieta();
  B.t = t;
  B.pose = POSE_DE_ESTADO[estado] || 'decir';
  if (estado === VOZ_ESCUCHANDO) escuchando(B, t, nivel);
  else if (estado === VOZ_PENSANDO) pensando(B, t);
  else if (estado === VOZ_HABLANDO) hablando(B, t, frase);
  else if (estado === VOZ_ERROR) error(B, t, Math.max(0, t - desde));
  else reposo(B, t);
  return B;
}

/**
 * Cuerpo en t con la transición resuelta.
 * mem: { estado, desde, previo: { estado, desde } | null, nivel, frase, alaFase }
 */
export function cuerpoEn(t, mem) {
  const ahora = cuerpoEstado(mem.estado, t, { desde: mem.desde, nivel: mem.nivel, frase: mem.frase });
  const k = mem.previo ? clamp((t - mem.desde) / TRANSICION_S) : 1;
  let B = ahora;
  if (k < 1) {
    const antes = cuerpoEstado(mem.previo.estado, t, { desde: mem.previo.desde, nivel: mem.nivel, frase: mem.previo.frase });
    const e = eio(k);
    B = { ...ahora };
    for (const c of NUMERICOS) B[c] = lerp(antes[c], ahora[c], e);
    B.mirada = [lerp(antes.mirada[0], ahora.mirada[0], e), lerp(antes.mirada[1], ahora.mirada[1], e)];
    // La tinta cambia de pose en el fondo del agache, nunca a media vista.
    if (antes.pose !== ahora.pose) {
      B.pose = k < .5 ? antes.pose : ahora.pose;
      B.sq *= 1 - .1 * Math.sin(PI * k);
    }
    B.onda = k < .5 ? antes.onda : ahora.onda;
    B.estela = k < .5 ? antes.estela : ahora.estela;
  }
  B.alaFase = mem.alaFase || 0;
  return B;
}

/** Nombre del gesto visible en t (para el registro de tiempos). */
export function gestoVisible(mem, t) {
  if (mem.previo && t - mem.desde < TRANSICION_S) return `transicion:${mem.previo.estado}->${mem.estado}`;
  if (mem.estado === VOZ_HABLANDO && mem.frase) return `frase:${gestoDeFrase(mem.frase.indice)}`;
  return mem.estado;
}
