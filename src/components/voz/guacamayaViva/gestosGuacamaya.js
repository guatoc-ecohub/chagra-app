/**
 * Gestos de la guacamaya por estado de voz — función pura del tiempo.
 *
 * Técnica del corto «compai vivo · guacamaya» (documentación interna, PR #506):
 * todo el cuerpo es función de `t` y los números son los del CSS del rig
 * (`arte-valle/guacamaya.css`: idle, vuela, abreAlas, esponjaSacude,
 * estiraAlaPata, acicalaAla, cabezaHabla…). Nada se sortea.
 *
 *   entrada     al montarse: llega volando, frena con las alas abiertas, se
 *               posa y se sacude (≈3 s). Sin grito: la ventana puede abrir
 *               ya escuchando.
 *   reposo      la vida del rig: respira, parpadea, dardeo de pupilas, bob y
 *               acicalado; cada tanto estira ala y pata o se sacude.
 *   escuchando  ladea la cabeza hacia usted; las alas se entreabren con el
 *               nivel REAL del micrófono (0..1). No se mueve de la rama.
 *   pensando    se acicala el ala (acicalaAla) y mira de reojo.
 *   hablando    el pico sigue la voz (visema, o sílabas por frase si no hay
 *               visema) y la cabeza conversa (cabezaHabla); cada frase que
 *               arranca el TTS dispara un gesto: saluda, señala, asiente,
 *               abre las alas.
 *   error       se queda quieta, cabeza baja, parpadeo lento.
 *   foto        elegida/analizando: se inclina y mira la miniatura;
 *               lista: la señala con el ala.
 *   salida      abre las alas y se va volando por arriba (≤ 0,6 s visibles).
 *
 * Salida: `cuerpoGuacamaya(t, m)` → { P, dx, dy, sq } donde P es el mapa de
 * ganchos del rig → [tx, ty, rot°, sx, sy, alfa] que pinta lienzoRig, y dx/dy
 * van en unidades del rig respecto de la percha.
 */
import { VOZ_REPOSO, VOZ_ESCUCHANDO, VOZ_PENSANDO, VOZ_HABLANDO, VOZ_ERROR } from '../../../constants/estadosVoz';

const PI = Math.PI;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, k) => a + (b - a) * k;
const sm = (k) => { k = clamp(k); return k * k * (3 - 2 * k); };
const eio = (k) => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const eo = (k) => { k = clamp(k); return 1 - Math.pow(1 - k, 3); };
const back = (k) => { k = clamp(k); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const env = (t, a, b, r = .3) => sm((t - a) / r) * (1 - sm((t - (b - r)) / r));
const fase = (tau, per, retardo = 0) => { const u = (tau - retardo) / per; return u - Math.floor(u); };
const alterna = (tau, per, retardo = 0) => { let u = ((tau - retardo) / per) % 2; if (u < 0) u += 2; return eio(u > 1 ? 2 - u : u); };
function kf(keys, u, lineal) {
  if (u <= keys[0][0]) return keys[0].slice(1);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (u <= b[0]) { const k0 = (u - a[0]) / Math.max(1e-6, b[0] - a[0]), k = lineal ? k0 : eio(k0); return a.slice(1).map((v, j) => lerp(v, b[j + 1], k)); }
  }
  return keys[keys.length - 1].slice(1);
}

/** Del origen del rig a la planta de las patas (unidades del rig). */
export const PIE = 176;

/** Huesos que se mueven: los ids y clases del propio rig (sufijo de instancia aparte). */
const IDS = new Set(['guaca', 'anticRig', 'traviesoRig', 'cuerpoRig', 'cabezaRig', 'pico', 'picoBajo', 'alaIzq', 'alaDer', 'colaExterna', 'colaMedia', 'colaCentro', 'jaula']);
const CLASES = ['flota', 'ojo', 'pupila', 'fantasmaAla', 'semilla'];
/** transform-origin de cada hueso, copiado del CSS del rig (transform-box: fill-box). */
export const ORIGENES = { guaca: [.5, .4], flota: [.5, .5], anticRig: [.5, .45], traviesoRig: [.5, .34], cuerpoRig: [.5, .62], cabezaRig: [.5, .92],
  ojo: [.5, .5], pupila: [.5, .5], pico: [.5, .5], picoBajo: [.5, .04], alaIzq: [.8, .08], alaDer: [.8, .08], colaExterna: [.5, .02],
  colaMedia: [.5, .02], colaCentro: [.5, .02], fantasmaAla: [.5, .5], semilla: [.5, .5], patas: [.5, 0], pataDer: [0, 0], jaula: [.5, .5] };

/** Clave de gancho de un elemento del rig vivo (ids namespaceados como `cabezaRig-<sufijo>`). */
export function claveGuacamaya(el) {
  const id = el.id ? el.id.replace(/-[^-]+$/, '') : '';
  if (IDS.has(id)) return id;
  const cls = el.getAttribute?.('class') || '';
  for (const c of CLASES) if (cls.split(/\s+/).includes(c)) return c;
  if (el.tagName === 'g' && el.getAttribute('stroke') === '#4a4a52') return 'patas';
  if (el.tagName === 'path' && el.parentElement?.getAttribute('stroke') === '#4a4a52' && !el.nextElementSibling) return 'pataDer';
  return null;
}

const KEYS = ['guaca', 'flota', 'anticRig', 'traviesoRig', 'cuerpoRig', 'cabezaRig', 'ojo', 'pupila', 'pico', 'picoBajo', 'alaIzq', 'alaDer',
  'colaExterna', 'colaMedia', 'colaCentro', 'fantasmaAla', 'semilla', 'patas', 'pataDer', 'jaula'];
function P0() {
  const P = {}; for (const k of KEYS) P[k] = [0, 0, 0, 1, 1, 1];
  P.fantasmaAla[5] = 0; P.semilla[5] = 0; P.jaula[5] = 0;
  return P;
}
function mezclar(A, B, k, kAla) {
  const P = {};
  for (const key of KEYS) {
    const a = A[key], b = B[key], w = (key === 'alaIzq' || key === 'alaDer') ? kAla : k;
    P[key] = a.map((v, i) => lerp(v, b[i], w));
  }
  return P;
}
const set = (v, tx, ty, r, sx, sy) => { if (tx !== undefined) v[0] = tx; if (ty !== undefined) v[1] = ty; if (r !== undefined) v[2] = r; if (sx !== undefined) v[3] = sx; if (sy !== undefined) v[4] = sy; };
const add = (v, tx = 0, ty = 0, r = 0, k = 1) => { v[0] += tx * k; v[1] += ty * k; v[2] += r * k; };
const COLAS = ['colaExterna', 'colaMedia', 'colaCentro'];

function vidaBase(P, tau) {
  P.ojo[4] = kf([[0, 1], [.36, 1], [.38, .12], [.40, 1], [.74, 1], [.76, .1], [.78, 1], [.80, .14], [.82, 1], [1, 1]], fase(tau, 5.4), true)[0];
  const m = kf([[0, 0, 0], [.2, 0, 0], [.23, -3.4, 1], [.34, -3.4, 1], [.38, 3, 0], [.41, -3, 1], [.44, -3, 1], [.47, 0, 0], [.58, 0, 0], [.61, 2.8, -3], [.71, 2.8, -3], [.76, 0, 0], [1, 0, 0]], fase(tau, 7.9));
  P.pupila[0] = m[0]; P.pupila[1] = m[1];
  [0, .16, .3].forEach((d, i) => { P[COLAS[2 - i]][2] = lerp(-3, 3.6, alterna(tau, 2.9, d)); });
}
function boil(P, tau, per = 1.6) {
  const u = Math.floor(fase(tau, per) * 18) / 18;
  const b = kf([[0, 0, 1, 1], [.22, -1, .988, 1.024], [.5, 1.4, 1.024, .976], [.72, -.5, .995, 1.01], [1, 0, 1, 1]], u);
  P.cuerpoRig[1] = b[0]; P.cuerpoRig[3] = b[1]; P.cuerpoRig[4] = b[2];
}

/** Las poses del CSS del rig (con sus números). */
export const POSE = {
  idle(tau) {
    const P = P0(); vidaBase(P, tau); boil(P, tau);
    const u = alterna(tau, 2.5); P.flota[1] = lerp(-2, 2, u); P.flota[2] = lerp(-.6, .7, u); // posada: el bob sin despegarse
    const tr = kf([[0, 0, 0, 0], [.28, 0, 0, 0], [.32, -4, -1.5, -4], [.37, -3.5, -1, 4], [.42, 1.4, .6, -2], [.46, 0, 0, 0], [.58, 0, 0, 0], [.60, 1, 0, 3.5], [.64, -1, 0, -3.5], [.68, .6, 0, 2], [.74, 0, 0, 0], [.79, 0, -3, 3], [.84, 0, 1, -2], [.90, 0, 0, 0], [1, 0, 0, 0]], fase(tau, 6.3));
    set(P.traviesoRig, tr[0], tr[1], tr[2]);
    const ca = kf([[0, -3, 0, 0], [.3, 3, 0, 0], [.68, -3, 0, 0], [.72, -4, 0, 0], [.77, 26, 6, 8], [.85, 23, 6, 8], [.9, -3, 0, 0], [1, -3, 0, 0]], fase(tau, 11.3));
    set(P.cabezaRig, ca[1], ca[2], ca[0]);
    set(P.alaIzq, 0, 0, lerp(1, 7, alterna(tau, 3.4)));
    set(P.alaDer, 0, 0, lerp(1, 7, alterna(tau, 3.8, -1.2)));
    return P;
  },
  vuela(tau) {
    const P = P0(); vidaBase(P, tau);
    set(P.cuerpoRig, 0, 0, -14);
    P.flota[1] = kf([[0, -16], [.42, -5], [1, -16]], fase(tau, .45))[0];
    const a = kf([[0, 116], [.38, 18], [.68, 64], [1, 116]], fase(tau, .45))[0];
    set(P.alaIzq, 0, 0, a); set(P.alaDer, 0, 0, a);
    set(P.cabezaRig, 0, -9, 10); set(P.patas, 0, -24);
    for (const k of COLAS) P[k][2] = 14;
    P.ojo[4] = 1;
    return P;
  },
  abre(tau) {
    const P = POSE.idle(tau);
    set(P.flota, 0, 0, 0); set(P.traviesoRig, 0, 0, 0); set(P.cuerpoRig, 0, 0, 0, 1, 1);
    const a = kf([[0, 8], [.45, 88], [1, 88]], clamp(tau / .9))[0];
    set(P.alaIzq, 0, 0, a); set(P.alaDer, 0, 0, a); set(P.cabezaRig, 0, -7, 0);
    for (const k of COLAS) P[k][2] = 0;
    return P;
  },
  frena(tau) {
    const P = POSE.abre(1);
    const a = 88 + 16 * Math.sin(tau * 2 * PI / .5);
    set(P.alaIzq, 0, 0, a); set(P.alaDer, 0, 0, a);
    P.colaExterna[2] = -6; P.colaCentro[2] = 4;
    return P;
  },
  sacude(tau) {
    const P = POSE.idle(tau);
    set(P.flota, 0, 0, 0); set(P.traviesoRig, 0, 0, 0);
    const sac = (u) => kf([[0, 0], [.22, -4], [.34, 5], [.46, -5], [.58, 5], [.70, -5], [.85, 2], [1, 0]], u)[0];
    const plu = (u) => kf([[0, 2, 0], [.22, 24, 0], [.34, 32, -5], [.46, 18, 0], [.58, 32, -5], [.70, 18, 0], [.85, 10, 0], [1, 2, 0]], u);
    set(P.cuerpoRig, 0, 0, sac(fase(tau, .8)), 1, 1);
    const pi = plu(fase(tau, .8)), pd = plu(fase(tau + .055, .8));
    set(P.alaIzq, pi[1], 0, pi[0]); set(P.alaDer, pd[1], 0, pd[0]);
    set(P.cabezaRig, 0, 0, sac(fase(tau + .06, .8)));
    const co = kf([[0, 0], [.3, 9], [.45, -9], [.6, 9], [.75, -9], [1, 0]], fase(tau, .8))[0];
    for (const k of COLAS) P[k][2] = co;
    return P;
  },
  estira(tau) {
    const P = POSE.idle(tau);
    set(P.flota, 0, 0, 0); set(P.traviesoRig, 0, 0, 0);
    set(P.cuerpoRig, 0, 0, -9, 1, 1); set(P.alaIzq, 0, 0, -8);
    set(P.alaDer, 0, 0, kf([[0, 14], [.28, 108], [.76, 108], [1, 14]], clamp(tau / 2.2))[0]);
    set(P.cabezaRig, 0, -5, 12);
    const k = kf([[0, 0], [.28, 1], [.76, 1], [1, 0]], clamp(tau / 2.2))[0];
    set(P.pataDer, 0, 0, -38 * k, 1, 1 + .7 * k);
    for (const key of COLAS) P[key][2] = 9;
    return P;
  },
  acicala(tau) {
    const P = POSE.idle(tau);
    set(P.flota, 0, 0, 0); set(P.traviesoRig, 0, 0, 0);
    set(P.cuerpoRig, 0, 0, 4, 1, 1);
    set(P.alaIzq, 0, 0, kf([[0, 12], [.22, 36], [.78, 36], [1, 12]], fase(tau, 1.6))[0]);
    set(P.alaDer, 0, 0, -7);
    const c = kf([[0, 0, 0, 4], [.25, -48, 32, 38], [.39, -55, 42, 45], [.53, -48, 32, 38], [.68, -55, 42, 45], [.8, -43, 26, 30], [1, 0, 0, 4]], fase(tau, 1.6));
    set(P.cabezaRig, c[0], c[1], c[2]); set(P.pupila, -3, 4);
    return P;
  },
};

const VISEMA_GRADOS = { V1: 0, V2: 4, V4: 8, V3: 14 };
const GESTOS_FRASE = ['saluda', 'senala', 'asiente', 'abre'];
export const gestoDeFrase = (indice) => GESTOS_FRASE[Math.abs(indice | 0) % GESTOS_FRASE.length];

/** Pose de un estado de voz, `tau` segundos después de entrar en él. */
function poseDeVoz(estado, tau, t, m) {
  if (estado === VOZ_PENSANDO) {
    const P = POSE.acicala(tau);
    const g = Math.sin(tau * 2.6) > .55 ? 1 : 0; // mira de reojo entre pasadas
    add(P.pupila, 3.2 * g, -1 * g);
    return P;
  }
  const P = POSE.idle(t);
  if (estado === VOZ_ESCUCHANDO) {
    const e = sm(tau / .35), n = clamp(m.nivel || 0);
    add(P.cabezaRig, 4, 2, 14, e); add(P.pupila, 0, 3.4, 0, e);
    P.alaIzq[2] += 16 * n; P.alaDer[2] += 16 * n; P.flota[1] -= 5 * n;
  } else if (estado === VOZ_HABLANDO) {
    const ch = kf([[0, -2, 0], [.12, -6, -2], [.24, 3, 1], [.38, 7, -1], [.52, -3, -3], [.66, 4, 0], [.80, -6, -2], [1, -2, 0]], fase(t, 2.8));
    const e = sm(tau / .3);
    add(P.cabezaRig, 0, ch[1], ch[0], e);
    const f = m.frase;
    const silabas = f ? Math.pow(Math.abs(Math.sin((t - f.t) * PI * 3.2)), .7) * (1 - sm((t - f.t - 2.4) / .4)) : 0;
    P.picoBajo[2] += (m.visema ? VISEMA_GRADOS[m.visema] || 0 : 15 * silabas) * e;
    if (f) {
      const k = sm((t - f.t) / .3) * (1 - sm((t - f.t - 1.6) / .35));
      const g = gestoDeFrase(f.indice);
      if (g === 'saluda') { add(P.alaIzq, 0, 0, 36, k); add(P.alaDer, 0, 0, 36, k); }
      if (g === 'senala') { add(P.alaIzq, 0, 0, 88, k); add(P.cabezaRig, -3, 0, -7, k); add(P.pupila, -3.5, 1, 0, k); }
      if (g === 'asiente') add(P.cabezaRig, 0, 7 * Math.abs(Math.sin((t - f.t) * PI * 2.2)), 0, k);
      if (g === 'abre') { add(P.alaIzq, 0, 0, 70, k); add(P.alaDer, 0, 0, 70, k); }
    }
  } else if (estado === VOZ_ERROR) {
    const e = sm(tau / .4);
    add(P.cabezaRig, 0, 6, -4, e); set(P.traviesoRig, 0, 0, 0);
    const u = fase(tau, 3.2); if (u < .2) P.ojo[4] = Math.min(P.ojo[4], lerp(1, .12, Math.sin(u / .2 * PI)));
  } else {
    // reposo: cada 26 s un momento del rig (estira ala y pata, se sacude), con transición suave
    const u = fase(t, 26);
    if (u > .3 && u < .3 + 2.2 / 26) return mezclar(P, POSE.estira((u - .3) * 26), env(u * 26, 7.8, 10, .35), back(env(u * 26, 7.8, 10, .35)));
    if (u > .7 && u < .7 + .8 / 26) return mezclar(P, POSE.sacude((u - .7) * 26), env(u * 26, 18.2, 19, .15), env(u * 26, 18.2, 19, .15));
  }
  return P;
}

/**
 * Cuerpo de la guacamaya en `t` (segundos) con la memoria `m`:
 *   { estado, desde, previo: {estado, desde} | null, nivel, frase: {indice, t} | null,
 *     visema, foto: {fase, t} | null, montada, salida }
 */
export function cuerpoGuacamaya(t, m) {
  let P = poseDeVoz(m.estado, t - m.desde, t, m);
  if (m.previo && t - m.desde < .45) {
    const k = (t - m.desde) / .45;
    P = mezclar(poseDeVoz(m.previo.estado, t - m.previo.desde, t, m), P, eio(k), back(k));
  }
  // la foto: la mira mientras se elige y se analiza; la señala cuando llega
  const f = m.foto;
  if (f && (f.fase === 'elegida' || f.fase === 'analizando')) {
    const e = sm((t - f.t) / .4); add(P.cabezaRig, -10, -2, -18, e); add(P.pupila, -3.4, -1.5, 0, e);
  } else if (f && f.fase === 'lista') {
    const e = sm((t - f.t) / .3) * (1 - sm((t - f.t - 1.8) / .35)); add(P.alaIzq, 0, 0, 88, e); add(P.pupila, -3.5, 1, 0, e);
  }
  let dx = 0, dy = 0, sq = 1;
  // entrada: llega volando desde la derecha, frena, se posa y se sacude
  const te = t - (m.montada ?? -99);
  if (te < 2.95 && !m.quieta) {
    const Pe = te < 1.55 ? POSE.vuela(te) : te < 2.05 ? mezclar(POSE.vuela(te), POSE.frena(te - 1.55), eio((te - 1.55) / .3), back((te - 1.55) / .3))
      : mezclar(POSE.frena(.5), POSE.sacude(te - 2.05), eio((te - 2.05) / .3), eio((te - 2.05) / .3));
    const k = te < 2.05 ? 1 : 1 - sm((te - 2.65) / .3);
    P = mezclar(P, Pe, k, k);
    if (te < 2.05) { const v = eo(te / 2.05); dx = lerp(900, 0, v); dy = lerp(-620, 0, v) - Math.sin(PI * v) * 90; }
    const l = (te - 2.05) / .5; if (l > 0 && l < 1) sq = 1 - .16 * Math.sin(l * PI) * (1 - l);
  }
  // salida: abre las alas y se va volando por arriba a la izquierda
  if (m.salida != null) {
    const ts = t - m.salida;
    P = ts < .3 ? mezclar(P, POSE.abre(ts), sm(ts / .15), back(ts / .15)) : POSE.vuela(ts);
    if (ts > .15) { const v = eio((ts - .15) / 1.1); dx = lerp(0, -900, v); dy = lerp(0, -700, v) - Math.sin(PI * v) * 80; }
  }
  return { P, dx, dy, sq };
}

export const ESTADOS_VOZ = [VOZ_REPOSO, VOZ_ESCUCHANDO, VOZ_PENSANDO, VOZ_HABLANDO, VOZ_ERROR];
