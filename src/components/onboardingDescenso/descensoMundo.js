/*
 * descensoMundo.js — el mundo del onboarding-juego: UNA sola toma, sin
 * cortes, de lo más grande a la tierra de la persona.
 *
 * Técnica: la del prototipo «Descenso» (de la mata de café al ADN). Cada
 * escala es un nivel dibujado en Canvas 2D en su propio espacio de unidades;
 * el nivel siguiente vive dentro de un PORTAL del anterior (x, y, s). La
 * cámara hace zoom logarítmico hacia el portal y, cuando el hijo ya ocupa
 * buena parte del cuadro, se abre dentro de él como una ventana redonda.
 *
 *   0 · la Tierra de noche desde lejos, con las luces de Colombia
 *   1 · Colombia de noche: cada luz es un municipio DANE (centroide real)
 *   2 · la montaña al amanecer, lámina a lo Humboldt: los pisos térmicos se
 *       leen por lo que crece, y la casa de la persona está a su altura
 *   3 · la vereda en la mañana, vista desde arriba (su polígono DANE si lo hay)
 *   4 · su tierra, de lado, según lo que hace y el tamaño que dijo
 *
 * Nada de lo geográfico se inventa: las luces son los 1.122 centroides de
 * `colombia-locations.dane.json`, el punto de la persona es su lat/lng, la
 * altura es la medida, y la vereda es el polígono DANE cuando el municipio
 * tiene dataset. Lo que no se sabe se dibuja genérico, nunca como dato.
 *
 * Sin dependencias: recibe el canvas y devuelve un control imperativo.
 */

import { COLOMBIA_LOCATIONS } from '../../utils/colombiaLocations';

/* ─────────────────────────── utilidades ─────────────────────────── */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua","Noto Serif",Georgia,serif';
const TINTA = '#231d17';

/* ─────────────────────────── escalas ─────────────────────────── */

// Metros que mide una unidad de cada nivel.
export const F = [17_700_000, 1_540_000, 36_000, 2_400, 60];
// Centro geográfico del cuadro de Colombia (centro de la caja DANE).
const LAT0 = 4.15;
const LNG0 = -72.95;
const COS0 = Math.cos((LAT0 * Math.PI) / 180);
const KM_LAT = 110.57;
const KM_LNG = 111.32;

/** lat/lng → unidades del nivel 1 (equirectangular local, norte arriba). */
export function geoANivel1(lat, lng) {
  return {
    x: ((lng - LNG0) * KM_LNG * COS0 * 1000) / F[1],
    y: (-(lat - LAT0) * KM_LAT * 1000) / F[1],
  };
}
/** Inversa de geoANivel1. */
export function nivel1AGeo(x, y) {
  return {
    lat: LAT0 - (y * F[1]) / (KM_LAT * 1000),
    lng: LNG0 + (x * F[1]) / (KM_LNG * COS0 * 1000),
  };
}

/* Las luces: un punto por municipio, en unidades del nivel 1. */
const LUCES = (() => {
  const xs = [];
  const ys = [];
  const br = [];
  for (const munis of Object.values(COLOMBIA_LOCATIONS)) {
    for (const m of munis) {
      if (typeof m.lat !== 'number' || typeof m.lng !== 'number') continue;
      const p = geoANivel1(m.lat, m.lng);
      xs.push(p.x);
      ys.push(p.y);
      // Brillo estable por código: variedad visual, no un dato de población.
      const r = rng(Number(m.codigo) || xs.length)();
      br.push(0.55 + r * 0.45);
    }
  }
  return { x: Float32Array.from(xs), y: Float32Array.from(ys), b: Float32Array.from(br), n: xs.length };
})();
export const NUMERO_LUCES = LUCES.n;

/* ─────────────────────────── sprites ─────────────────────────── */

function sprite(tam, paradas) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = tam;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  for (const [o, col] of paradas) g.addColorStop(o, col);
  c.fillStyle = g;
  c.fillRect(0, 0, tam, tam);
  return cv;
}


function tesela(dibujar, tam = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = tam;
  const c = cv.getContext('2d');
  dibujar(c, tam, rng(tam * 7 + dibujar.length));
  return cv;
}
function copasTesela(c, n, r, cols, fondo, extra) {
  c.fillStyle = fondo;
  c.fillRect(0, 0, n, n);
  for (let i = 0; i < 70; i++) {
    const x = r() * n;
    const y = r() * n;
    const rad = 5 + r() * 7;
    for (const [dx, dy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]]) {
      c.fillStyle = cols[Math.floor(r() * cols.length)];
      c.strokeStyle = 'rgba(30,40,24,.55)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(x + dx, y + dy, rad, 0, 7);
      c.fill();
      c.stroke();
    }
    if (extra) extra(c, x, y, r);
  }
}
function crearPatrones(ctx) {
  if (PAT.listo) return;
  PAT.monte = ctx.createPattern(tesela((c, n, r) => copasTesela(c, n, r, ['#3d6e39', '#4a7d41', '#2f5a33', '#5a8a47'], '#46703c')), 'repeat');
  PAT.selva = ctx.createPattern(tesela((c, n, r) => copasTesela(c, n, r, ['#4f8e42', '#5f9a47', '#3e7a3c', '#6aa04a'], '#4b8540')), 'repeat');
  PAT.cafetal = ctx.createPattern(tesela((c, n, r) => {
    c.fillStyle = '#5d8a45';
    c.fillRect(0, 0, n, n);
    for (let row = 0; row < n; row += 12) {
      for (let x = (row / 12) % 2 ? 4 : 10; x < n; x += 12) {
        c.fillStyle = '#2d5a33';
        c.strokeStyle = 'rgba(25,35,20,.6)';
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(x, row + 6, 5, 4, 0, 0, 7);
        c.fill();
        c.stroke();
        if (r() < 0.35) { c.fillStyle = '#c0392b'; c.fillRect(x - 1, row + 5, 2, 2); }
      }
    }
    for (let i = 0; i < 4; i++) {
      const x = r() * n;
      const y = r() * n;
      c.fillStyle = '#4c8746';
      c.beginPath();
      c.ellipse(x, y, 16, 8, 0, 0, 7);
      c.fill();
      c.stroke();
    }
  }), 'repeat');
  PAT.frio = ctx.createPattern(tesela((c, n, r) => {
    // parcelas de papa, arveja y potrero: rombos torcidos, no cuadrícula
    const cols = ['#b99a62', '#8aa052', '#a88f5c', '#9bb465', '#c2a56e', '#7c9a4c'];
    c.fillStyle = '#8fa458';
    c.fillRect(0, 0, n, n);
    for (let i = 0; i < 26; i++) {
      const x = r() * n;
      const y = r() * n;
      const w = 18 + r() * 26;
      const h = 10 + r() * 14;
      const a = (r() - 0.5) * 0.7;
      for (const [dx, dy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]]) {
        c.save();
        c.translate(x + dx, y + dy);
        c.rotate(a);
        c.fillStyle = cols[i % cols.length];
        c.beginPath();
        c.moveTo(-w / 2 + r() * 3, -h / 2);
        c.lineTo(w / 2, -h / 2 + r() * 3);
        c.lineTo(w / 2 - r() * 3, h / 2);
        c.lineTo(-w / 2, h / 2 - r() * 3);
        c.closePath();
        c.fill();
        c.strokeStyle = 'rgba(52,80,44,.8)';
        c.lineWidth = 1.6;
        c.stroke();
        if (i % 2) {
          c.strokeStyle = 'rgba(80,60,35,.3)';
          c.lineWidth = 0.8;
          for (let k = -h / 2 + 3; k < h / 2; k += 3.5) { c.beginPath(); c.moveTo(-w / 2 + 2, k); c.lineTo(w / 2 - 2, k); c.stroke(); }
        }
        c.restore();
      }
    }
    for (let i = 0; i < 12; i++) {
      c.fillStyle = '#355f3a';
      c.beginPath();
      c.arc(r() * n, r() * n, 3 + r() * 2, 0, 7);
      c.fill();
    }
  }), 'repeat');
  PAT.paramo = ctx.createPattern(tesela((c, n, r) => {
    c.fillStyle = '#a79c6c';
    c.fillRect(0, 0, n, n);
    c.strokeStyle = '#c9b56a';
    c.lineWidth = 1.2;
    for (let i = 0; i < 90; i++) {
      const x = r() * n;
      const y = r() * n;
      c.beginPath();
      for (let k = -2; k <= 2; k++) { c.moveTo(x, y); c.lineTo(x + k * 2, y - 5 - (2 - Math.abs(k)) * 1.5); }
      c.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const x = r() * n;
      const y = r() * n;
      c.fillStyle = '#b9c4a4';
      c.strokeStyle = 'rgba(35,29,23,.6)';
      c.beginPath();
      c.arc(x, y, 3.2, 0, 7);
      c.fill();
      c.stroke();
    }
  }), 'repeat');
  PAT.listo = true;
}

function granoPapel() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 160;
  const c = cv.getContext('2d');
  const img = c.createImageData(160, 160);
  const r = rng(99);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 150 + r() * 105;
    img.data[i] = v;
    img.data[i + 1] = v * 0.97;
    img.data[i + 2] = v * 0.9;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return cv;
}

/* ─────────────────────────── ayudas de dibujo ─────────────────────────── */

/** Rótulo en espacio de pantalla (las fuentes diminutas bajo escala fallan). */
function rotulo(c, env, x, y, texto, { tam = 15, color = TINTA, halo = null, italica = true, peso = 400, alinear = 'center', alfa = 1, papel = false } = {}) {
  if (alfa <= 0.01) return;
  const sx = env.ox + x * env.ppu;
  const sy = env.oy + y * env.ppu;
  c.save();
  c.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
  c.globalAlpha = alfa;
  c.font = `${italica ? 'italic ' : ''}${peso} ${tam}px ${SERIF}`;
  c.textAlign = alinear;
  c.textBaseline = 'middle';
  if (papel) {
    const w = c.measureText(texto).width + tam * 1.1;
    const h = tam * 1.75;
    const x0 = alinear === 'center' ? sx - w / 2 : alinear === 'left' ? sx - tam * 0.55 : sx - w + tam * 0.55;
    c.fillStyle = 'rgba(248,241,222,.94)';
    c.strokeStyle = 'rgba(35,29,23,.75)';
    c.lineWidth = 1.2;
    c.beginPath();
    if (c.roundRect) c.roundRect(x0, sy - h / 2, w, h, h / 2);
    else c.rect(x0, sy - h / 2, w, h);
    c.fill();
    c.stroke();
  }
  if (halo) {
    c.lineWidth = Math.max(3, tam * 0.3);
    c.strokeStyle = halo;
    c.lineJoin = 'round';
    c.strokeText(texto, sx, sy);
  }
  c.fillStyle = color;
  c.fillText(texto, sx, sy);
  c.restore();
}

/** Rótulos solo cuando la cámara está en la pausa del nivel, no mientras vuela. */
function alfaPausa(env) {
  return sstep(2.4, 1.25, env.f) * sstep(0.22, 0.55, env.f);
}

function fondoVertical(c, env, paradas) {
  const [x0, y0, x1, y1] = env.view;
  const a = paradas[0][0];
  const b = paradas[paradas.length - 1][0];
  const g = c.createLinearGradient(0, a, 0, b);
  for (const [y, col] of paradas) g.addColorStop((y - a) / (b - a), col);
  c.fillStyle = g;
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
}

function enVista(env, x, y, m) {
  const v = env.view;
  return x > v[0] - m && x < v[2] + m && y > v[1] - m && y < v[3] + m;
}

/* ─────────────────────────── NIVEL 0 · la Tierra ─────────────────────────── */

const ESTRELLAS = (() => {
  const r = rng(7);
  const a = [];
  for (let i = 0; i < 420; i++) a.push({ x: -3 + r() * 6, y: -3 + r() * 6, r: 0.5 + r() * r() * 1.6, a: 0.35 + r() * 0.6, f: r() * 6.28 });
  return a;
})();

const R_TIERRA = 0.36;
function ortografica(lat, lng) {
  const f = (lat * Math.PI) / 180;
  const l = ((lng - LNG0) * Math.PI) / 180;
  const f0 = (LAT0 * Math.PI) / 180;
  const cosc = Math.sin(f0) * Math.sin(f) + Math.cos(f0) * Math.cos(f) * Math.cos(l);
  return {
    x: R_TIERRA * Math.cos(f) * Math.sin(l),
    y: -R_TIERRA * (Math.cos(f0) * Math.sin(f) - Math.sin(f0) * Math.cos(f) * Math.cos(l)),
    ve: cosc > 0,
  };
}

function dibujaEstrellas(c, env, alfa) {
  const px = env.px;
  for (const s of ESTRELLAS) {
    if (!enVista(env, s.x, s.y, 0)) continue;
    const tw = 0.75 + 0.25 * Math.sin(env.t * 1.3 + s.f);
    c.globalAlpha = s.a * tw * alfa;
    const r = s.r * px;
    c.fillStyle = '#fff6e0';
    c.fillRect(s.x - r, s.y - r, r * 2, r * 2);
  }
  c.globalAlpha = 1;
}

function dibujaTierra(c, env) {
  if (env.solo === 'anim') return;
  fondoVertical(c, env, [[-2.5, '#03050d'], [0, '#0a1230'], [2.5, '#03050d']]);
  dibujaEstrellas(c, env, 1);
  const R = R_TIERRA;
  // halo de atmósfera
  const h = c.createRadialGradient(0, 0, R * 0.98, 0, 0, R * 1.16);
  h.addColorStop(0, 'rgba(110,160,255,.55)');
  h.addColorStop(0.35, 'rgba(70,120,230,.18)');
  h.addColorStop(1, 'rgba(40,80,200,0)');
  c.fillStyle = h;
  c.beginPath();
  c.arc(0, 0, R * 1.16, 0, 7);
  c.fill();
  // cuerpo de noche
  const g = c.createRadialGradient(-R * 0.25, -R * 0.3, 0, 0, 0, R);
  g.addColorStop(0, '#17284d');
  g.addColorStop(1, '#060b19');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, R, 0, 7);
  c.fill();
  c.save();
  c.beginPath();
  c.arc(0, 0, R, 0, 7);
  c.clip();
  // el amanecer entra por el oriente
  const d = c.createRadialGradient(R * 1.35, -R * 0.1, R * 0.2, R * 1.35, -R * 0.1, R * 1.25);
  d.addColorStop(0, 'rgba(255,196,128,.62)');
  d.addColorStop(0.45, 'rgba(240,140,90,.16)');
  d.addColorStop(1, 'rgba(240,140,90,0)');
  c.fillStyle = d;
  c.fillRect(-R, -R, 2 * R, 2 * R);
  // meridianos y paralelos, tinta fina sobre la noche
  c.lineWidth = env.px * 0.8;
  for (let lat = -75; lat <= 75; lat += 15) {
    c.strokeStyle = lat === 0 ? 'rgba(255,214,150,.28)' : 'rgba(150,180,235,.11)';
    c.beginPath();
    let pen = false;
    for (let lng = -180; lng <= 180; lng += 4) {
      const p = ortografica(lat, lng);
      if (!p.ve) { pen = false; continue; }
      if (pen) c.lineTo(p.x, p.y);
      else c.moveTo(p.x, p.y);
      pen = true;
    }
    c.stroke();
  }
  c.strokeStyle = 'rgba(150,180,235,.11)';
  for (let lng = -180; lng < 180; lng += 15) {
    c.beginPath();
    let pen = false;
    for (let lat = -88; lat <= 88; lat += 4) {
      const p = ortografica(lat, lng);
      if (!p.ve) { pen = false; continue; }
      if (pen) c.lineTo(p.x, p.y);
      else c.moveTo(p.x, p.y);
      pen = true;
    }
    c.stroke();
  }
  c.restore();
  // borde vivo del disco
  c.strokeStyle = 'rgba(170,205,255,.55)';
  c.lineWidth = env.px * 1.4;
  c.beginPath();
  c.arc(0, 0, R, 0, 7);
  c.stroke();
  // las luces de Colombia, a escala de nivel 0
  dibujaLuces(c, env, F[1] / F[0], 0, 0, 1);
  if (env.px < 0.004) {
    rotulo(c, env, 0, R * 0.36, 'Colombia', { tam: 13, color: 'rgba(255,233,190,.9)', alfa: sstep(0.004, 0.0015, env.px) });
  }
}

/* ─────────────────────────── luces (niveles 0 y 1) ─────────────────────────── */

let SPR_LUZ = null;
let SPR_HALO = null;
let SPR_NUBE = null;
/** Texturas de lámina por piso térmico (se crean una vez). */
const PAT = {};

function dibujaLuces(c, env, esc, ox, oy, alfa) {
  const n = LUCES.n;
  const ppu = env.ppu * esc; // px por unidad de nivel 1
  // Halo: la mancha tibia que dibuja la forma del país poblado.
  const rh = clamp(0.028 * ppu, 3, 34);
  if (esc === 1) alfa *= sstep(0.012, 0.09, env.f);
  const rhU = rh / env.ppu;
  c.globalAlpha = 0.16 * alfa;
  for (let i = 0; i < n; i++) {
    const x = ox + LUCES.x[i] * esc;
    const y = oy + LUCES.y[i] * esc;
    if (!enVista(env, x, y, rhU)) continue;
    c.drawImage(SPR_HALO, x - rhU, y - rhU, rhU * 2, rhU * 2);
  }
  // Núcleo de cada luz.
  const rn = clamp(0.0036 * ppu, 0.9, 7);
  const rnU = rn / env.ppu;
  for (let i = 0; i < n; i++) {
    const x = ox + LUCES.x[i] * esc;
    const y = oy + LUCES.y[i] * esc;
    if (!enVista(env, x, y, rnU * 3)) continue;
    const tw = 0.85 + 0.15 * Math.sin(env.t * 2.1 + i * 1.7);
    c.globalAlpha = LUCES.b[i] * tw * alfa;
    c.drawImage(SPR_LUZ, x - rnU * 2.2, y - rnU * 2.2, rnU * 4.4, rnU * 4.4);
  }
  c.globalAlpha = 1;
}

/* ─────────────────────────── NIVEL 1 · Colombia de noche ─────────────────────────── */

function dibujaColombia(c, env, datos) {
  if (env.solo !== 'anim') colombiaBase(c, env);
  if (env.solo !== 'base') colombiaLate(c, env, datos);
  if (env.solo !== 'anim') colombiaNubes(c, env, datos);
}

function colombiaBase(c, env) {
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 1.8);
  g.addColorStop(0, '#121c44');
  g.addColorStop(1, '#050817');
  c.fillStyle = g;
  const v = env.view;
  c.fillRect(v[0], v[1], v[2] - v[0], v[3] - v[1]);
  dibujaEstrellas(c, env, 0.25);
  // retícula de 2°, casi invisible
  c.lineWidth = env.px * 0.8;
  c.strokeStyle = 'rgba(150,180,235,.07)';
  for (let lat = -6; lat <= 14; lat += 2) {
    const y = geoANivel1(lat, LNG0).y;
    c.beginPath();
    c.moveTo(v[0], y);
    c.lineTo(v[2], y);
    c.stroke();
  }
  for (let lng = -82; lng <= -64; lng += 2) {
    const x = geoANivel1(LAT0, lng).x;
    c.beginPath();
    c.moveTo(x, v[1]);
    c.lineTo(x, v[3]);
    c.stroke();
  }
  const ye = geoANivel1(0, LNG0).y;
  c.strokeStyle = 'rgba(255,214,150,.22)';
  c.setLineDash([env.px * 6, env.px * 6]);
  c.beginPath();
  c.moveTo(v[0], ye);
  c.lineTo(v[2], ye);
  c.stroke();
  c.setLineDash([]);
  rotulo(c, env, geoANivel1(0, -69.6).x, ye - 0.018, 'línea del ecuador', { tam: 12, color: 'rgba(255,224,170,.55)', alfa: alfaPausa(env) });

  dibujaLuces(c, env, 1, 0, 0, 1);
}

function colombiaLate(c, env, datos) {
  // Buscando: un anillo que barre desde el centro.
  if (datos.buscando) {
    const k = (env.t * 0.55) % 1;
    c.strokeStyle = `rgba(255,226,160,${0.5 * (1 - k)})`;
    c.lineWidth = env.px * 2;
    c.beginPath();
    c.arc(0, 0, 0.05 + k * 0.7, 0, 7);
    c.stroke();
  }
  const marca = (p, fuerte, texto) => {
    const pu = geoANivel1(p.lat, p.lng);
    const k = (env.t * 0.8) % 1;
    for (const kk of [k, (k + 0.5) % 1]) {
      c.strokeStyle = `rgba(255,214,140,${(fuerte ? 0.85 : 0.5) * (1 - kk)})`;
      c.lineWidth = env.px * 2;
      c.beginPath();
      c.arc(pu.x, pu.y, (6 + kk * 34) * env.px, 0, 7);
      c.stroke();
    }
    const rr = 26 * env.px;
    c.globalAlpha = 0.9;
    c.drawImage(SPR_LUZ, pu.x - rr, pu.y - rr, rr * 2, rr * 2);
    c.globalAlpha = 1;
    c.fillStyle = '#fff6dc';
    c.beginPath();
    c.arc(pu.x, pu.y, 3.2 * env.px, 0, 7);
    c.fill();
    if (texto) rotulo(c, env, pu.x, pu.y - 30 * env.px, texto, { tam: 15, color: TINTA, papel: true, italica: false, peso: 600, alfa: alfaPausa(env) });
  };
  if (datos.candidato) marca(datos.candidato, false, datos.candidato.nombre);
  if (datos.punto) marca(datos.punto, true, datos.punto.nombre);
}

function colombiaNubes(c, env, datos) {
  // Nubes: al bajar hacia el punto, se atraviesan antes del amanecer.
  if (datos.punto) {
    const pu = geoANivel1(datos.punto.lat, datos.punto.lng);
    const s = F[2] / F[1];
    const pp = s * env.ppu; // px de una unidad de nivel 2
    const a = sstep(0.03 * env.S, 0.12 * env.S, pp) * (1 - sstep(0.35 * env.S, 0.8 * env.S, pp));
    if (a > 0.01) {
      const r = rng(5);
      for (let i = 0; i < 16; i++) {
        const ang = r() * 6.28;
        const d = (0.5 + r() * 2.8) * s;
        const rad = (0.9 + r() * 1.4) * s;
        const x = pu.x + Math.cos(ang) * d;
        const y = pu.y + Math.sin(ang) * d * 0.7;
        c.globalAlpha = a * (0.35 + r() * 0.35);
        c.drawImage(SPR_NUBE, x - rad, y - rad * 0.6, rad * 2, rad * 1.2);
      }
      c.globalAlpha = 1;
    }
  }
}

/* ─────────────────────────── NIVEL 2 · la montaña ─────────────────────────── */

const K_ALT = 1 / 3900; // unidades por metro (exageración vertical de lámina)
const X_SPAN = 2.5;
function altPerfil(t) {
  return 120 + 4780 * Math.pow(t, 1.55) + 150 * Math.sin(t * 21) * t + 70 * Math.sin(t * 57 + 1);
}
function tDeAltura(h) {
  let a = 0;
  let b = 1;
  for (let i = 0; i < 30; i++) {
    const m = (a + b) / 2;
    if (altPerfil(m) < h) a = m;
    else b = m;
  }
  return (a + b) / 2;
}
const PISOS = [
  { hasta: 1000, nombre: 'tierra caliente', h: 520 },
  { hasta: 2000, nombre: 'tierra templada', h: 1500 },
  { hasta: 3000, nombre: 'tierra fría', h: 2500 },
  { hasta: 4500, nombre: 'páramo', h: 3550 },
];
const ALTURA_POR_PISO = { cálido: 600, templado: 1500, frío: 2500, páramo: 3400 };

function montana(datos) {
  const h = Number.isFinite(datos.altitud) ? clamp(datos.altitud, 150, 4600) : ALTURA_POR_PISO[datos.piso] || 1800;
  const tU = tDeAltura(h);
  const ox = -(-X_SPAN / 2 + X_SPAN * tU);
  const oy = altPerfil(tU) * K_ALT + 0.06;
  const P = (t) => ({ x: ox - X_SPAN / 2 + X_SPAN * t, y: oy - altPerfil(t) * K_ALT });
  return { h, tU, P, ox, oy };
}

/** Dónde quedan los lotes de la persona en la ladera (el portal a su vereda). */
function fincaEnMontana(M) {
  const p = M.P(clamp(M.tU + 0.012, 0, 1));
  return { x: p.x, y: p.y + 0.03 };
}

const VEG = (() => {
  const r = rng(11);
  const a = [];
  for (let t = 0; t <= 1.0001; t += 0.0042) a.push({ t: t + (r() - 0.5) * 0.003, r: r(), q: r(), s: 0.8 + r() * 0.5, d: r() });
  return a;
})();

function palma(c, x, y, s, px) {
  c.strokeStyle = TINTA;
  c.lineWidth = Math.max(px, 0.0022 * s);
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + 0.006 * s, y - 0.03 * s, x + 0.002 * s, y - 0.055 * s);
  c.stroke();
  const tx = x + 0.002 * s;
  const ty = y - 0.055 * s;
  c.fillStyle = '#3e7a3c';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55;
    const ex = tx + Math.cos(a) * 0.03 * s;
    const ey = ty + Math.sin(a) * 0.022 * s + 0.012 * s;
    c.beginPath();
    c.moveTo(tx, ty);
    c.quadraticCurveTo((tx + ex) / 2, Math.min(ty, ey) - 0.012 * s, ex, ey);
    c.quadraticCurveTo((tx + ex) / 2, Math.min(ty, ey) - 0.004 * s, tx, ty);
    c.fill();
    c.stroke();
  }
}
function copa(c, x, y, rx, ry, col, px, tronco = true) {
  if (tronco) {
    c.strokeStyle = TINTA;
    c.lineWidth = Math.max(px, rx * 0.12);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x, y - ry * 1.1);
    c.stroke();
  }
  c.fillStyle = col;
  c.strokeStyle = TINTA;
  c.lineWidth = Math.max(px * 0.8, rx * 0.06);
  c.beginPath();
  const cy = y - ry * 1.5;
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const bump = 1 + 0.12 * Math.sin(i * 2.7);
    const px2 = x + Math.cos(a) * rx * bump;
    const py2 = cy + Math.sin(a) * ry * bump;
    if (i === 0) c.moveTo(px2, py2);
    else c.lineTo(px2, py2);
  }
  c.closePath();
  c.fill();
  c.stroke();
}
function mataCafe(c, x, y, s, px) {
  c.fillStyle = '#2d5a33';
  c.strokeStyle = TINTA;
  c.lineWidth = Math.max(px * 0.7, 0.0012 * s);
  c.beginPath();
  c.ellipse(x, y - 0.011 * s, 0.009 * s, 0.013 * s, 0, 0, 7);
  c.fill();
  c.stroke();
  c.fillStyle = '#c0392b';
  c.fillRect(x - 0.003 * s, y - 0.012 * s, 0.0025 * s, 0.0025 * s);
  c.fillRect(x + 0.002 * s, y - 0.007 * s, 0.0025 * s, 0.0025 * s);
}
function frailejon(c, x, y, s, px) {
  c.strokeStyle = '#4b4034';
  c.lineWidth = Math.max(px, 0.004 * s);
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y - 0.028 * s);
  c.stroke();
  c.fillStyle = '#b9c4a4';
  c.strokeStyle = TINTA;
  c.lineWidth = Math.max(px * 0.7, 0.001 * s);
  const cy = y - 0.03 * s;
  c.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = i % 2 ? 0.006 * s : 0.013 * s;
    const xx = x + Math.cos(a) * r;
    const yy = cy + Math.sin(a) * r * 0.7;
    if (i) c.lineTo(xx, yy);
    else c.moveTo(xx, yy);
  }
  c.closePath();
  c.fill();
  c.stroke();
}
function pajon(c, x, y, s, px) {
  c.strokeStyle = '#b39a4f';
  c.lineWidth = Math.max(px * 0.8, 0.0012 * s);
  c.beginPath();
  for (let i = -3; i <= 3; i++) {
    c.moveTo(x, y);
    c.lineTo(x + i * 0.003 * s, y - (0.012 + (3 - Math.abs(i)) * 0.002) * s);
  }
  c.stroke();
}

function casita(c, x, y, s, px, luz = 0) {
  const w = 0.03 * s;
  const h = 0.02 * s;
  if (luz > 0) {
    const g = c.createRadialGradient(x, y - h, 0, x, y - h, 0.12 * s);
    g.addColorStop(0, `rgba(255,214,140,${0.55 * luz})`);
    g.addColorStop(1, 'rgba(255,214,140,0)');
    c.fillStyle = g;
    c.fillRect(x - 0.12 * s, y - h - 0.12 * s, 0.24 * s, 0.24 * s);
  }
  c.lineWidth = Math.max(px, 0.0016 * s);
  c.strokeStyle = TINTA;
  c.fillStyle = '#f1e6cc';
  c.beginPath();
  c.rect(x - w / 2, y - h, w, h);
  c.fill();
  c.stroke();
  c.fillStyle = '#a8492f';
  c.beginPath();
  c.moveTo(x - w * 0.62, y - h);
  c.lineTo(x, y - h - 0.014 * s);
  c.lineTo(x + w * 0.62, y - h);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = luz > 0 ? '#ffd27a' : '#6b4a33';
  c.fillRect(x - w * 0.12, y - h * 0.62, w * 0.24, h * 0.62);
}

function dibujaMontana(c, env, datos) {
  if (env.solo === 'anim') return;
  const M = montana(datos);
  const v = env.view;
  const px = env.px;
  // cielo del amanecer, anclado al mundo
  fondoVertical(c, env, [[-2.2, '#1b2656'], [-1.1, '#5d5a95'], [-0.4, '#d98f82'], [0.05, '#f4b77e'], [0.5, '#f8dcaa'], [2.5, '#f8dcaa']]);
  // sol que asoma
  const sx = -0.62;
  const sy = 0.02 + M.oy * 0.15;
  const gs = c.createRadialGradient(sx, sy, 0, sx, sy, 0.55);
  gs.addColorStop(0, 'rgba(255,238,190,.95)');
  gs.addColorStop(0.08, 'rgba(255,222,150,.8)');
  gs.addColorStop(0.3, 'rgba(255,190,120,.22)');
  gs.addColorStop(1, 'rgba(255,190,120,0)');
  c.fillStyle = gs;
  c.fillRect(sx - 0.55, sy - 0.55, 1.1, 1.1);
  c.fillStyle = '#fff2c9';
  c.beginPath();
  c.arc(sx, sy, 0.05, 0, 7);
  c.fill();
  // cordilleras lejanas
  const lejanas = [
    { col: '#b8a9c9', dy: 0.1, amp: 0.28, fr: 3.1, fase: 1.2 },
    { col: '#8e8fb8', dy: 0.2, amp: 0.22, fr: 4.3, fase: 2.9 },
  ];
  for (const L of lejanas) {
    c.fillStyle = L.col;
    c.beginPath();
    c.moveTo(v[0] - 0.1, v[3] + 0.1);
    const x0 = v[0] - 0.1;
    const x1 = v[2] + 0.1;
    const paso = Math.max((x1 - x0) / 90, px * 3);
    for (let x = x0; x <= x1 + paso; x += paso) {
      const wx = x - M.ox * 0.25;
      const y = L.dy - L.amp * (0.55 + 0.3 * Math.sin(wx * L.fr + L.fase) + 0.15 * Math.sin(wx * L.fr * 2.7 + L.fase * 2));
      c.lineTo(x, y + M.oy * 0.3 - 0.2);
    }
    c.lineTo(x1, v[3] + 0.1);
    c.closePath();
    c.fill();
  }
  // el cuerpo de la montaña
  const N = 260;
  const top = [];
  for (let i = 0; i <= N; i++) top.push(M.P(i / N));
  const gm = c.createLinearGradient(0, M.oy - 4700 * K_ALT, 0, M.oy);
  gm.addColorStop(0, '#9c9477');
  gm.addColorStop(0.22, '#8f9868');
  gm.addColorStop(0.45, '#557c45');
  gm.addColorStop(0.75, '#3f7340');
  gm.addColorStop(1, '#46803f');
  c.fillStyle = gm;
  c.beginPath();
  c.moveTo(top[0].x - 2, top[0].y);
  for (const p of top) c.lineTo(p.x, p.y);
  c.lineTo(top[N].x + 2, top[N].y + 0.4);
  c.lineTo(top[N].x + 2, 3);
  c.lineTo(top[0].x - 2, 3);
  c.closePath();
  c.fill();
  // la cara de la montaña, pintada por pisos como en la lámina: monte abajo,
  // cafetales, potreros y papa en tierra fría, pajonal en el páramo
  c.save();
  c.beginPath();
  c.moveTo(top[0].x - 2, top[0].y);
  for (const p of top) c.lineTo(p.x, p.y);
  c.lineTo(top[N].x + 2, 3);
  c.lineTo(top[0].x - 2, 3);
  c.closePath();
  c.clip();
  const bandas = [[-400, 1000, PAT.selva], [1000, 2050, PAT.cafetal], [2050, 3150, PAT.frio], [3150, 5200, PAT.paramo]];
  const alfaTex = 0.55 * sstep(0.18, 0.7, env.f);
  bandas.forEach(([h0, h1, pat], i) => {
    if (!pat) return;
    if (alfaTex < 0.02) return;
    pat.setTransform(new DOMMatrix().translateSelf(i * 0.37, i * 0.21).rotateSelf(i * 7 - 8).scaleSelf(0.0019, 0.0016));
    c.fillStyle = pat;
    c.globalAlpha = alfaTex;
    const borde = (h, x) => M.oy - h * K_ALT + 0.014 * Math.sin(x * 23 + i * 2) + 0.008 * Math.sin(x * 61 + i);
    c.beginPath();
    const x0 = v[0] - 0.05;
    const x1 = v[2] + 0.05;
    const paso = (x1 - x0) / 60;
    for (let x = x0; x <= x1 + 1e-6; x += paso) (x === x0 ? c.moveTo(x, borde(h1, x)) : c.lineTo(x, borde(h1, x)));
    for (let x = x1; x >= x0 - 1e-6; x -= paso) c.lineTo(x, i === 0 ? 3 : borde(h0, x));
    c.closePath();
    c.fill();
  });
  c.globalAlpha = 1;
  // la bruma de la mañana sube desde abajo
  const bru = c.createLinearGradient(0, M.oy - 900 * K_ALT, 0, M.oy + 0.3);
  bru.addColorStop(0, 'rgba(248,220,170,0)');
  bru.addColorStop(1, 'rgba(248,220,170,.35)');
  c.fillStyle = bru;
  c.fillRect(v[0], M.oy - 0.4, v[2] - v[0], 1.2);
  c.restore();
  // su finca: unos lotes en la ladera, debajo de la casa
  const fin = fincaEnMontana(M);
  const lotes = [[-0.045, -0.012, '#c9a86a'], [-0.005, -0.016, '#8fb45e'], [0.035, -0.02, '#b99a62'], [-0.03, 0.014, '#a2c06c'], [0.012, 0.01, '#c7b27a']];
  for (const [dx, dy, col] of lotes) {
    const x = fin.x + dx;
    const y = fin.y + dy;
    c.fillStyle = col;
    c.strokeStyle = TINTA;
    c.lineWidth = Math.max(px, 0.0012);
    c.beginPath();
    c.moveTo(x - 0.02, y + 0.012);
    c.lineTo(x + 0.02, y + 0.006);
    c.lineTo(x + 0.02, y - 0.012);
    c.lineTo(x - 0.02, y - 0.006);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = 'rgba(70,50,30,.45)';
    c.beginPath();
    for (let k = -2; k <= 2; k++) {
      c.moveTo(x - 0.018, y + k * 0.004 + 0.003);
      c.lineTo(x + 0.018, y + k * 0.004 - 0.003);
    }
    c.stroke();
  }
  // nieve de la cumbre
  c.fillStyle = '#f3f1ea';
  c.beginPath();
  let enNieve = false;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const h = altPerfil(t);
    if (h < 4550) continue;
    const p = top[i];
    const bajo = (h - 4550) * K_ALT * 0.7;
    if (!enNieve) { c.moveTo(p.x, p.y + bajo); enNieve = true; }
    c.lineTo(p.x, p.y);
  }
  for (let i = N; i >= 0; i--) {
    const h = altPerfil(i / N);
    if (h < 4550) break;
    const p = top[i];
    c.lineTo(p.x - 0.004, p.y + (h - 4550) * K_ALT * 0.7);
  }
  c.closePath();
  if (enNieve) c.fill();
  // la línea de la ladera, en tinta
  c.strokeStyle = TINTA;
  c.lineWidth = Math.max(px * 1.6, 0.0022);
  c.lineJoin = 'round';
  c.beginPath();
  top.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.stroke();
  // franjas de cultivo en tierra fría: parches sobre la ladera
  for (let i = 0; i < N; i += 3) {
    const t = i / N;
    const h = altPerfil(t);
    if (h < 2150 || h > 3050) continue;
    const a = top[i];
    const b = top[Math.min(N, i + 3)];
    if (!enVista(env, a.x, a.y, 0.1)) continue;
    const col = (i / 3) % 3 === 0 ? '#b99a62' : (i / 3) % 3 === 1 ? '#8aa052' : '#a88f5c';
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(a.x, a.y + 0.004);
    c.lineTo(b.x, b.y + 0.004);
    c.lineTo(b.x, b.y + 0.05);
    c.lineTo(a.x, a.y + 0.05);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(35,29,23,.35)';
    c.lineWidth = px;
    c.stroke();
  }
  // lo que crece a cada altura
  for (const g of VEG) {
    const t = clamp(g.t, 0, 1);
    const h = altPerfil(t);
    const p = M.P(t);
    const y = p.y + 0.006 + g.d * 0.03;
    if (!enVista(env, p.x, y, 0.08)) continue;
    const s = g.s;
    if (h < 1000) {
      if (g.q < 0.45) palma(c, p.x, y, s, px);
      else if (g.q < 0.8) copa(c, p.x, y, 0.014 * s, 0.01 * s, '#4f8e42', px);
    } else if (h < 2000) {
      if (g.q < 0.6) mataCafe(c, p.x, y, s, px);
      else if (g.q < 0.82) copa(c, p.x, y, 0.024 * s, 0.011 * s, '#4c8746', px);
    } else if (h < 3000) {
      if (h >= 2200 && g.q < 0.3) copa(c, p.x, y, 0.012 * s, 0.017 * s, '#355f3a', px);
    } else if (h >= 3200 && h <= 3800) {
      if (g.q < 0.45) frailejon(c, p.x, y, s, px);
      else pajon(c, p.x, y, s, px);
    }
  }
  // bosque de niebla: la franja de nubes que abraza la ladera
  const nr = rng(3);
  for (let i = 0; i < 22; i++) {
    const t = tDeAltura(2350 + nr() * 700);
    const p = M.P(t);
    const dx = ((env.t * 0.004 + nr()) % 1) * 0.12 - 0.06;
    const rad = 0.06 + nr() * 0.07;
    const x = p.x + dx + (nr() - 0.5) * 0.1;
    const y = p.y - 0.01 + (nr() - 0.5) * 0.04;
    if (!enVista(env, x, y, rad)) continue;
    c.globalAlpha = 0.42;
    c.drawImage(SPR_NUBE, x - rad, y - rad * 0.45, rad * 2, rad * 0.9);
  }
  c.globalAlpha = 1;
  // los nombres de los pisos, escritos sobre la ladera como en la lámina
  for (const piso of PISOS) {
    const t = tDeAltura(piso.h);
    const p = M.P(t);
    const t2 = tDeAltura(piso.h + 120);
    const p2 = M.P(t2);
    const ang = Math.atan2(p2.y - p.y, p2.x - p.x);
    const sx2 = env.ox + (p.x) * env.ppu;
    const sy2 = env.oy + (p.y - 0.035) * env.ppu;
    const al = alfaPausa(env) * (Math.abs(piso.h - M.h) < 380 ? 0.35 : 1);
    if (al < 0.02 || sx2 < 70 || sx2 > env.ox + (v[2] - 0.0) * env.ppu - 70) continue;
    c.save();
    c.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
    c.translate(sx2, sy2);
    c.rotate(ang);
    c.globalAlpha = al;
    c.font = `italic 400 15px ${SERIF}`;
    c.textAlign = 'center';
    c.lineWidth = 3.5;
    c.strokeStyle = 'rgba(250,236,205,.8)';
    c.strokeText(piso.nombre, 0, 0);
    c.fillStyle = TINTA;
    c.fillText(piso.nombre, 0, 0);
    c.restore();
  }
  // la casa de la persona, a su altura
  const pu = M.P(M.tU);
  const alfaCasa = sstep(0.3, 0.75, env.f);
  if (alfaCasa > 0.02) {
    c.globalAlpha = alfaCasa;
    casita(c, pu.x, pu.y + 0.004, 1.3, px, 0.9 + 0.1 * Math.sin(env.t * 2));
    c.globalAlpha = 1;
  }
  const etq = Number.isFinite(datos.altitud)
    ? `Usted · ${Math.round(datos.altitud).toLocaleString('es-CO')} m`
    : 'Usted';
  rotulo(c, env, pu.x, pu.y - 0.075, etq, { tam: 15, italica: false, peso: 700, papel: true, alfa: alfaPausa(env) });
}

/* ─────────────────────────── NIVEL 3 · la vereda ─────────────────────────── */

const MALLA = (() => {
  const r = rng(23);
  const n = 26;
  const step = 0.13;
  const pts = [];
  for (let j = 0; j <= n; j++) {
    const fila = [];
    for (let i = 0; i <= n; i++) {
      const x = (i - n / 2) * step + (r() - 0.5) * step * 0.55;
      const y = (j - n / 2) * step + (r() - 0.5) * step * 0.55;
      fila.push([x + y * 0.18, y]);
    }
    pts.push(fila);
  }
  const celdas = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      celdas.push({ i, j, q: r(), rot: r() * 3.14, casa: r() < 0.08, arb: r() });
    }
  }
  return { pts, celdas, n };
})();
const COLORES_PARCELA = ['#9dbb6a', '#b3c47a', '#8fae5c', '#c7b27a', '#a9bf73', '#7fa257', '#bfa56c'];

function centroCelda(ce) {
  const P = MALLA.pts;
  const a = P[ce.j][ce.i];
  const b = P[ce.j][ce.i + 1];
  const d = P[ce.j + 1][ce.i];
  const e = P[ce.j + 1][ce.i + 1];
  return [(a[0] + b[0] + d[0] + e[0]) / 4, (a[1] + b[1] + d[1] + e[1]) / 4];
}
const CELDA_SUYA = (() => {
  let best = null;
  let bd = Infinity;
  for (const ce of MALLA.celdas) {
    const [x, y] = centroCelda(ce);
    const d = x * x + y * y;
    if (d < bd) { bd = d; best = ce; }
  }
  return best;
})();

function caminoCelda(c, ce, enc = 0) {
  const P = MALLA.pts;
  const pts = [P[ce.j][ce.i], P[ce.j][ce.i + 1], P[ce.j + 1][ce.i + 1], P[ce.j + 1][ce.i]];
  const [cx, cy] = centroCelda(ce);
  c.beginPath();
  pts.forEach((p, k) => {
    const x = lerp(p[0], cx, enc);
    const y = lerp(p[1], cy, enc);
    if (k) c.lineTo(x, y);
    else c.moveTo(x, y);
  });
  c.closePath();
}

function surcosEnCelda(c, ce, col, px, ang) {
  const [cx, cy] = centroCelda(ce);
  c.save();
  caminoCelda(c, ce, 0.08);
  c.clip();
  c.strokeStyle = col;
  c.lineWidth = Math.max(px, 0.006);
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  for (let k = -12; k <= 12; k++) {
    const ox = cx - dy * k * 0.013;
    const oy = cy + dx * k * 0.013;
    c.beginPath();
    c.moveTo(ox - dx * 0.2, oy - dy * 0.2);
    c.lineTo(ox + dx * 0.2, oy + dy * 0.2);
    c.stroke();
  }
  c.restore();
}

/** Proyección local del nivel 3: metros desde el punto de la persona. */
function geoANivel3(lat, lng, p) {
  const cos = Math.cos((p.lat * Math.PI) / 180);
  return [((lng - p.lng) * KM_LNG * cos * 1000) / F[3], (-(lat - p.lat) * KM_LAT * 1000) / F[3]];
}

function trazarGeometria(c, geom, p) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  c.beginPath();
  for (const poly of polys) {
    for (const ring of poly) {
      ring.forEach(([lng, lat], k) => {
        const [x, y] = geoANivel3(lat, lng, p);
        if (k) c.lineTo(x, y);
        else c.moveTo(x, y);
      });
      c.closePath();
    }
  }
}

function bordeQueLate(c, env) {
  const k = 0.5 + 0.5 * Math.sin(env.t * 2.4);
  caminoCelda(c, CELDA_SUYA, 0.03);
  c.strokeStyle = `rgba(255,${200 + 30 * k},120,${0.75 + 0.25 * k})`;
  c.lineWidth = Math.max(env.px * 3, 0.006);
  c.stroke();
}

function dibujaVereda(c, env, datos) {
  if (env.solo === 'anim') {
    bordeQueLate(c, env);
    return;
  }
  const px = env.px;
  const v = env.view;
  c.fillStyle = '#93b267';
  c.fillRect(v[0], v[1], v[2] - v[0], v[3] - v[1]);
  const P = MALLA.pts;
  const idn = datos.identidad;
  // parcelas
  for (const ce of MALLA.celdas) {
    const [cx, cy] = centroCelda(ce);
    if (!enVista(env, cx, cy, 0.2)) continue;
    const suya = ce === CELDA_SUYA;
    c.fillStyle = COLORES_PARCELA[Math.floor(ce.q * COLORES_PARCELA.length)];
    caminoCelda(c, ce, 0.03);
    c.fill();
    if (!suya && ce.q > 0.72) surcosEnCelda(c, ce, 'rgba(90,70,40,.22)', px, ce.rot);
  }
  // cercas vivas: la malla en tinta verde
  c.strokeStyle = 'rgba(38,64,34,.55)';
  c.lineWidth = Math.max(px, 0.0035);
  c.beginPath();
  for (let j = 0; j <= MALLA.n; j++) {
    for (let i = 0; i < MALLA.n; i++) {
      const a = P[j][i];
      const b = P[j][i + 1];
      if (!enVista(env, a[0], a[1], 0.2)) continue;
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
    }
  }
  for (let j = 0; j < MALLA.n; j++) {
    for (let i = 0; i <= MALLA.n; i++) {
      const a = P[j][i];
      const b = P[j + 1][i];
      if (!enVista(env, a[0], a[1], 0.2)) continue;
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
    }
  }
  c.stroke();
  // la quebrada, con su bosque de galería
  const q = (s) => [-0.9 + s * 2.2 + 0.08 * Math.sin(s * 11), -1.4 + s * 3.0 + 0.1 * Math.sin(s * 7 + 1)];
  const qx = (s) => q(s)[0] - 0.32;
  const qy = (s) => q(s)[1];
  const r = rng(41);
  for (let s = 0; s <= 1; s += 0.012) {
    for (const lado of [-1, 1]) {
      const x = qx(s) + lado * (0.03 + r() * 0.03);
      const y = qy(s) + (r() - 0.5) * 0.03;
      if (!enVista(env, x, y, 0.05)) continue;
      c.fillStyle = r() < 0.5 ? '#2f5a33' : '#3d6e3b';
      c.beginPath();
      c.arc(x, y, 0.017 + r() * 0.012, 0, 7);
      c.fill();
      c.strokeStyle = 'rgba(28,40,24,.7)';
      c.lineWidth = px;
      c.stroke();
    }
  }
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const [w, col] of [[0.022, '#35607a'], [0.014, '#79b1cf']]) {
    c.strokeStyle = col;
    c.lineWidth = w;
    c.beginPath();
    for (let s = 0; s <= 1.001; s += 0.01) (s ? c.lineTo(qx(s), qy(s)) : c.moveTo(qx(s), qy(s)));
    c.stroke();
  }
  // el camino veredal
  const cam = (s) => [-1.5 + s * 3.0, 0.5 - s * 0.9 + 0.12 * Math.sin(s * 6)];
  for (const [w, col, dash] of [[0.02, '#8b6d45', null], [0.013, '#d8bf8c', null], [0.002, 'rgba(90,70,40,.5)', [0.012, 0.012]]]) {
    c.strokeStyle = col;
    c.lineWidth = w;
    c.setLineDash(dash || []);
    c.beginPath();
    for (let s = 0; s <= 1.001; s += 0.01) {
      const [x, y] = cam(s);
      if (s) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();
  }
  c.setLineDash([]);
  // el pueblo
  const pueblo = [-0.78, -0.62];
  const rp = rng(17);
  if (enVista(env, pueblo[0], pueblo[1], 0.3)) {
    c.fillStyle = '#d9cfb2';
    c.fillRect(pueblo[0] - 0.05, pueblo[1] - 0.05, 0.1, 0.1);
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        if (Math.abs(i) <= 0 && Math.abs(j) <= 0) continue;
        if (rp() < 0.25) continue;
        const x = pueblo[0] + i * 0.058;
        const y = pueblo[1] + j * 0.058;
        c.fillStyle = rp() < 0.6 ? '#b35a3a' : '#c8744d';
        c.fillRect(x - 0.022, y - 0.022, 0.044, 0.044);
        c.strokeStyle = 'rgba(35,29,23,.7)';
        c.lineWidth = px;
        c.strokeRect(x - 0.022, y - 0.022, 0.044, 0.044);
      }
    }
    c.fillStyle = '#f4efe2';
    c.fillRect(pueblo[0] - 0.018, pueblo[1] - 0.048, 0.036, 0.03);
    c.strokeRect(pueblo[0] - 0.018, pueblo[1] - 0.048, 0.036, 0.03);
    rotulo(c, env, pueblo[0], pueblo[1] + 0.25, datos.municipio ? datos.municipio : 'el pueblo', { tam: 14, halo: 'rgba(250,240,215,.9)', alfa: alfaPausa(env) });
  }
  // casitas y árboles sueltos
  for (const ce of MALLA.celdas) {
    const [cx, cy] = centroCelda(ce);
    if (!enVista(env, cx, cy, 0.1) || ce === CELDA_SUYA) continue;
    if (ce.casa) {
      c.fillStyle = '#b8563a';
      c.fillRect(cx - 0.016, cy - 0.012, 0.032, 0.024);
      c.strokeStyle = TINTA;
      c.lineWidth = px;
      c.strokeRect(cx - 0.016, cy - 0.012, 0.032, 0.024);
    } else if (ce.arb < 0.35) {
      c.fillStyle = '#35643a';
      c.beginPath();
      c.arc(cx + 0.03, cy - 0.02, 0.02, 0, 7);
      c.fill();
      c.strokeStyle = 'rgba(28,40,24,.7)';
      c.lineWidth = px;
      c.stroke();
    }
  }
  // la vereda real (polígono DANE) o una silueta genérica
  const vg = datos.veredaGeo;
  if (vg && datos.punto) {
    c.lineWidth = Math.max(px * 1.2, 0.003);
    c.strokeStyle = 'rgba(35,29,23,.3)';
    c.setLineDash([0.02, 0.015]);
    for (const ve of vg.vecinas) {
      trazarGeometria(c, ve, datos.punto);
      c.stroke();
    }
    c.setLineDash([]);
    if (vg.suya) {
      trazarGeometria(c, vg.suya, datos.punto);
      c.fillStyle = 'rgba(255,244,205,.18)';
      c.fill('evenodd');
      c.strokeStyle = 'rgba(35,29,23,.85)';
      c.lineWidth = Math.max(px * 2.2, 0.006);
      c.setLineDash([0.03, 0.018]);
      c.stroke();
      c.setLineDash([]);
    }
  }
  if (datos.vereda) {
    rotulo(c, env, 0, -0.42, `vereda ${datos.vereda}`, { tam: 17, halo: 'rgba(250,240,215,.92)', alfa: alfaPausa(env) });
  }
  // su tierra: la parcela del centro cambia con lo que hace
  const ce = CELDA_SUYA;
  c.fillStyle = idn === 'restauro' ? '#6f9a4f' : idn === 'animales' ? '#b8cf7a' : idn === 'urbano' ? '#d6cbb0' : '#c9a86a';
  caminoCelda(c, ce, 0.03);
  c.fill();
  if (idn === 'cultivo' || idn === 'tecnico' || !idn) surcosEnCelda(c, ce, idn ? '#4f7a32' : 'rgba(95,70,40,.35)', px, 0.35);
  const [ux, uy] = centroCelda(ce);
  const ru = rng(77);
  if (idn === 'restauro') {
    for (let i = 0; i < 16; i++) {
      c.fillStyle = ru() < 0.5 ? '#2f5a33' : '#44793f';
      c.beginPath();
      c.arc(ux + (ru() - 0.5) * 0.1, uy + (ru() - 0.5) * 0.1, 0.012 + ru() * 0.01, 0, 7);
      c.fill();
      c.strokeStyle = 'rgba(28,40,24,.7)';
      c.lineWidth = px;
      c.stroke();
    }
  } else if (idn === 'animales') {
    for (let i = 0; i < 9; i++) {
      c.fillStyle = ru() < 0.5 ? '#f3ecdf' : '#6b4a33';
      c.beginPath();
      c.ellipse(ux + (ru() - 0.5) * 0.1, uy + (ru() - 0.5) * 0.09, 0.006, 0.004, 0.3, 0, 7);
      c.fill();
    }
  } else if (idn === 'urbano') {
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        c.fillStyle = (i + j) % 2 ? '#b35a3a' : '#c9754f';
        c.fillRect(ux + i * 0.038 - 0.015, uy + j * 0.038 - 0.015, 0.03, 0.03);
        c.strokeStyle = TINTA;
        c.lineWidth = px;
        c.strokeRect(ux + i * 0.038 - 0.015, uy + j * 0.038 - 0.015, 0.03, 0.03);
      }
    }
  } else if (idn === 'tecnico') {
    for (let i = 0; i < 4; i++) {
      const fx = ux - 0.045 + i * 0.03;
      const fy = uy - 0.03 + (i % 2) * 0.05;
      c.strokeStyle = TINTA;
      c.lineWidth = px * 1.2;
      c.beginPath();
      c.moveTo(fx, fy);
      c.lineTo(fx, fy - 0.02);
      c.stroke();
      c.fillStyle = '#e8b04a';
      c.beginPath();
      c.moveTo(fx, fy - 0.02);
      c.lineTo(fx + 0.012, fy - 0.016);
      c.lineTo(fx, fy - 0.012);
      c.fill();
    }
  }
  // borde que late: aquí es (en pausa lo pinta la capa que late)
  if (env.solo !== 'base') bordeQueLate(c, env);
  casita(c, ux + 0.035, uy + 0.045, 1.05, px, 0.4);
  rotulo(c, env, ux, uy - 0.105, 'su tierra', { tam: 15, italica: false, peso: 700, papel: true, alfa: alfaPausa(env) });
}

/* ─────────────────────────── NIVEL 4 · su tierra ─────────────────────────── */

export const ATERRIZAJE = { x: -0.06, y: 0.2, f: 0.5 };
const HORIZ = -0.14;
// Punto de fuga de los surcos y borde lejano del lote.
const FUGA = { x: -0.06, y: HORIZ - 0.42 };
const BORDE_LOTE = HORIZ + 0.1;
const CERCA_Y = 1.45;

function plantita(c, x, y, s, col, px) {
  c.strokeStyle = '#3b5d2a';
  c.lineWidth = Math.max(px * 0.8, 0.0025 * s);
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y - 0.018 * s);
  c.stroke();
  c.fillStyle = col;
  c.strokeStyle = TINTA;
  c.lineWidth = Math.max(px * 0.7, 0.0015 * s);
  for (const lado of [-1, 1]) {
    c.beginPath();
    c.ellipse(x + lado * 0.009 * s, y - 0.02 * s, 0.01 * s, 0.005 * s, lado * -0.5, 0, 7);
    c.fill();
    c.stroke();
  }
}

/* Matas del lote, según el piso térmico: papa arriba, café en templado, maíz abajo. */
function matPapa(c, x, y, s, px, r) {
  c.strokeStyle = TINTA;
  c.lineWidth = Math.max(px * 0.7, 0.0012 * s);
  const cols = ['#3f6e34', '#4f823f', '#5c9148'];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.5;
    c.fillStyle = cols[i % 3];
    c.beginPath();
    c.ellipse(x + Math.cos(a) * 0.012 * s, y - 0.008 * s + Math.sin(a) * 0.01 * s, 0.009 * s, 0.006 * s, a, 0, 7);
    c.fill();
    c.stroke();
  }
  if (r > 0.45) {
    c.fillStyle = r > 0.75 ? '#efe7f4' : '#d9c6ea';
    c.beginPath();
    c.arc(x + (r - 0.6) * 0.02 * s, y - 0.022 * s, 0.0035 * s, 0, 7);
    c.fill();
    c.stroke();
  }
}
function matMaiz(c, x, y, s, px) {
  c.strokeStyle = '#4c6b2b';
  c.lineWidth = Math.max(px, 0.0026 * s);
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + 0.002 * s, y - 0.07 * s);
  c.stroke();
  c.strokeStyle = TINTA;
  c.fillStyle = '#6aa04a';
  c.lineWidth = Math.max(px * 0.7, 0.001 * s);
  for (let i = 0; i < 4; i++) {
    const yy = y - (0.016 + i * 0.013) * s;
    const lado = i % 2 ? 1 : -1;
    c.beginPath();
    c.moveTo(x, yy);
    c.quadraticCurveTo(x + lado * 0.022 * s, yy - 0.014 * s, x + lado * 0.034 * s, yy + 0.006 * s);
    c.quadraticCurveTo(x + lado * 0.018 * s, yy - 0.006 * s, x, yy + 0.003 * s);
    c.fill();
    c.stroke();
  }
  c.strokeStyle = '#c9a13e';
  c.beginPath();
  c.moveTo(x + 0.002 * s, y - 0.07 * s);
  c.lineTo(x - 0.006 * s, y - 0.082 * s);
  c.moveTo(x + 0.002 * s, y - 0.07 * s);
  c.lineTo(x + 0.01 * s, y - 0.08 * s);
  c.stroke();
}
function matCafeLote(c, x, y, s, px) {
  c.fillStyle = '#2d5a33';
  c.strokeStyle = TINTA;
  c.lineWidth = Math.max(px * 0.7, 0.0012 * s);
  c.beginPath();
  c.ellipse(x, y - 0.02 * s, 0.017 * s, 0.022 * s, 0, 0, 7);
  c.fill();
  c.stroke();
  c.fillStyle = '#c0392b';
  for (const [dx, dy] of [[-0.006, -0.018], [0.005, -0.012], [0.002, -0.026]]) c.fillRect(x + dx * s, y + dy * s, 0.004 * s, 0.004 * s);
}
function gallina(c, x, y, s, px, col) {
  c.fillStyle = col;
  c.strokeStyle = TINTA;
  c.lineWidth = Math.max(px, 0.002 * s);
  c.beginPath();
  c.ellipse(x, y - 0.012 * s, 0.014 * s, 0.01 * s, 0, 0, 7);
  c.fill();
  c.stroke();
  c.beginPath();
  c.arc(x + 0.012 * s, y - 0.022 * s, 0.005 * s, 0, 7);
  c.fill();
  c.stroke();
  c.fillStyle = '#c0392b';
  c.fillRect(x + 0.01 * s, y - 0.03 * s, 0.004 * s, 0.004 * s);
  c.beginPath();
  c.moveTo(x - 0.004 * s, y - 0.003 * s);
  c.lineTo(x - 0.004 * s, y + 0.004 * s);
  c.moveTo(x + 0.004 * s, y - 0.003 * s);
  c.lineTo(x + 0.004 * s, y + 0.004 * s);
  c.stroke();
}
function vaca(c, x, y, s, px) {
  c.fillStyle = '#f2ece0';
  c.strokeStyle = TINTA;
  c.lineWidth = Math.max(px * 1.2, 0.0025 * s);
  c.beginPath();
  c.ellipse(x, y - 0.05 * s, 0.06 * s, 0.03 * s, 0, 0, 7);
  c.fill();
  c.stroke();
  c.fillStyle = '#3a2c22';
  c.beginPath();
  c.ellipse(x - 0.015 * s, y - 0.058 * s, 0.018 * s, 0.012 * s, 0.3, 0, 7);
  c.fill();
  c.fillStyle = '#f2ece0';
  c.beginPath();
  c.ellipse(x + 0.066 * s, y - 0.064 * s, 0.018 * s, 0.013 * s, -0.4, 0, 7);
  c.fill();
  c.stroke();
  c.beginPath();
  for (const dx of [-0.04, -0.025, 0.03, 0.045]) {
    c.moveTo(x + dx * s, y - 0.03 * s);
    c.lineTo(x + dx * s, y);
  }
  c.stroke();
}
function materas(c, x, y, s, px) {
  const cols = ['#b85c3c', '#c96e48', '#a9502f'];
  for (let i = 0; i < 5; i++) {
    const mx = x + (i - 2) * 0.075 * s;
    const h = 0.04 * s;
    c.fillStyle = cols[i % 3];
    c.strokeStyle = TINTA;
    c.lineWidth = Math.max(px, 0.002 * s);
    c.beginPath();
    c.moveTo(mx - 0.025 * s, y - h);
    c.lineTo(mx + 0.025 * s, y - h);
    c.lineTo(mx + 0.018 * s, y);
    c.lineTo(mx - 0.018 * s, y);
    c.closePath();
    c.fill();
    c.stroke();
    if (i % 2) matPapa(c, mx, y - h, s * 1.6, px, 0.3);
    else for (let k = -1; k <= 1; k++) plantita(c, mx + k * 0.012 * s, y - h, s * (1.1 + 0.3 * Number(k === 0)), '#6aa84a', px);
  }
}

function invernadero(c, cx, base, w, h, forma, px) {
  const cuerpo = () => {
    c.beginPath();
    if (forma === 'tunel') {
      c.moveTo(cx - w / 2, base);
      c.bezierCurveTo(cx - w / 2, base - h * 1.3, cx + w / 2, base - h * 1.3, cx + w / 2, base);
      c.closePath();
    } else if (forma === 'casa_sombra') {
      c.rect(cx - w / 2, base - h, w, h);
    } else {
      c.moveTo(cx - w / 2, base);
      c.lineTo(cx - w / 2, base - h * 0.7);
      c.lineTo(cx, base - h * 1.1);
      c.lineTo(cx + w / 2, base - h * 0.7);
      c.lineTo(cx + w / 2, base);
      c.closePath();
    }
  };
  // plantas de tomate adentro, con tutor
  c.save();
  cuerpo();
  c.clip();
  c.fillStyle = '#8a6a44';
  c.fillRect(cx - w / 2, base - h * 0.08, w, h * 0.08);
  for (let i = 0; i < 11; i++) {
    const x = cx - w / 2 + ((i + 0.5) / 11) * w;
    c.strokeStyle = 'rgba(35,29,23,.6)';
    c.lineWidth = px;
    c.beginPath();
    c.moveTo(x, base);
    c.lineTo(x, base - h * 0.62);
    c.stroke();
    c.fillStyle = i % 2 ? '#3f7a36' : '#4c8a3c';
    c.beginPath();
    c.ellipse(x, base - h * 0.3, w * 0.03, h * 0.26, 0, 0, 7);
    c.fill();
    c.stroke();
    c.fillStyle = '#d0452f';
    for (const [dx, dy] of [[0.012, 0.22], [-0.01, 0.36], [0.006, 0.44]]) {
      c.beginPath();
      c.arc(x + w * dx, base - h * dy, w * 0.007, 0, 7);
      c.fill();
    }
  }
  if (forma === 'casa_sombra') {
    c.strokeStyle = 'rgba(35,29,23,.22)';
    c.lineWidth = px;
    for (let k = -40; k <= 40; k++) {
      c.beginPath();
      c.moveTo(cx + k * w * 0.025, base);
      c.lineTo(cx + k * w * 0.025 + h, base - h);
      c.stroke();
    }
  }
  c.restore();
  // plástico: blanco lechoso con brillo
  c.fillStyle = 'rgba(240,246,244,.42)';
  cuerpo();
  c.fill();
  const g = c.createLinearGradient(cx - w / 2, base - h, cx + w / 2, base);
  g.addColorStop(0, 'rgba(255,255,255,.35)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = TINTA;
  c.lineWidth = Math.max(px * 1.6, 0.003);
  c.stroke();
  c.strokeStyle = 'rgba(35,29,23,.55)';
  c.lineWidth = px;
  for (let k = 1; k < 8; k++) {
    const x = cx - w / 2 + (k / 8) * w;
    const u = (x - cx) / (w / 2);
    const alto = forma === 'tunel' ? h * 0.98 * (1 - u * u) : forma === 'casa_sombra' ? h : h * (0.7 + 0.4 * (1 - Math.abs(u)));
    c.beginPath();
    c.moveTo(x, base);
    c.lineTo(x, base - alto);
    c.stroke();
  }
}

function casaFinca(c, x, y, s, px, t) {
  // casa de tapia con corredor y techo de teja
  const w = 0.3 * s;
  const h = 0.12 * s;
  c.lineWidth = Math.max(px * 1.4, 0.003 * s);
  c.strokeStyle = TINTA;
  // humo del fogón
  for (let i = 0; i < 4; i++) {
    const k = ((t * 0.12 + i / 4) % 1);
    c.fillStyle = `rgba(240,240,236,${0.5 * (1 - k)})`;
    c.beginPath();
    c.arc(x + w * 0.28 + k * 0.05 * s, y - h - 0.09 * s - k * 0.12 * s, (0.012 + k * 0.03) * s, 0, 7);
    c.fill();
  }
  c.fillStyle = '#6b4a33';
  c.fillRect(x + w * 0.24, y - h - 0.075 * s, 0.022 * s, 0.05 * s);
  c.strokeRect(x + w * 0.24, y - h - 0.075 * s, 0.022 * s, 0.05 * s);
  c.fillStyle = '#f1e6cc';
  c.fillRect(x - w / 2, y - h, w, h);
  c.strokeRect(x - w / 2, y - h, w, h);
  // zócalo
  c.fillStyle = '#9c5a3a';
  c.fillRect(x - w / 2, y - h * 0.18, w, h * 0.18);
  c.strokeRect(x - w / 2, y - h * 0.18, w, h * 0.18);
  // techo
  c.fillStyle = '#a8492f';
  c.beginPath();
  c.moveTo(x - w * 0.6, y - h);
  c.lineTo(x - w * 0.42, y - h - 0.07 * s);
  c.lineTo(x + w * 0.42, y - h - 0.07 * s);
  c.lineTo(x + w * 0.6, y - h);
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = 'rgba(35,29,23,.45)';
  c.lineWidth = px;
  for (let k = 1; k < 14; k++) {
    const xx = x - w * 0.55 + (k / 14) * w * 1.1;
    c.beginPath();
    c.moveTo(xx, y - h);
    c.lineTo(xx + (xx - x) * -0.12, y - h - 0.066 * s);
    c.stroke();
  }
  c.strokeStyle = TINTA;
  c.lineWidth = Math.max(px * 1.4, 0.003 * s);
  // puerta, ventana y pilares del corredor
  c.fillStyle = '#5a7f4a';
  c.fillRect(x - w * 0.08, y - h * 0.72, w * 0.14, h * 0.72);
  c.strokeRect(x - w * 0.08, y - h * 0.72, w * 0.14, h * 0.72);
  c.fillStyle = '#5a7f4a';
  c.fillRect(x - w * 0.38, y - h * 0.7, w * 0.16, h * 0.34);
  c.strokeRect(x - w * 0.38, y - h * 0.7, w * 0.16, h * 0.34);
  c.fillStyle = '#e8c07a';
  c.fillRect(x + w * 0.2, y - h * 0.7, w * 0.16, h * 0.34);
  c.strokeRect(x + w * 0.2, y - h * 0.7, w * 0.16, h * 0.34);
  // materas en el corredor
  for (let k = 0; k < 3; k++) {
    const mx = x - w * 0.46 + k * 0.03 * s;
    c.fillStyle = '#b85c3c';
    c.fillRect(mx, y - 0.018 * s, 0.018 * s, 0.018 * s);
    c.strokeRect(mx, y - 0.018 * s, 0.018 * s, 0.018 * s);
    c.fillStyle = k === 1 ? '#d2466e' : '#5f9a47';
    c.beginPath();
    c.arc(mx + 0.009 * s, y - 0.024 * s, 0.009 * s, 0, 7);
    c.fill();
  }
}

function arbolGrande(c, x, y, s, px) {
  c.strokeStyle = TINTA;
  c.fillStyle = '#5b4332';
  c.lineWidth = Math.max(px * 1.2, 0.003 * s);
  c.beginPath();
  c.moveTo(x - 0.012 * s, y);
  c.quadraticCurveTo(x - 0.004 * s, y - 0.1 * s, x - 0.01 * s, y - 0.2 * s);
  c.lineTo(x + 0.012 * s, y - 0.2 * s);
  c.quadraticCurveTo(x + 0.006 * s, y - 0.1 * s, x + 0.016 * s, y);
  c.closePath();
  c.fill();
  c.stroke();
  const lobs = [[-0.09, -0.22, 0.08], [0.0, -0.3, 0.1], [0.09, -0.23, 0.08], [-0.04, -0.18, 0.07], [0.05, -0.17, 0.07]];
  for (const [dx, dy, r] of lobs) {
    c.fillStyle = '#3d6e39';
    c.beginPath();
    c.ellipse(x + dx * s, y + dy * s, r * s, r * 0.75 * s, 0, 0, 7);
    c.fill();
    c.stroke();
  }
  for (const [dx, dy, r] of lobs) {
    c.fillStyle = 'rgba(140,190,100,.45)';
    c.beginPath();
    c.ellipse(x + (dx - 0.02) * s, y + (dy - 0.02) * s, r * 0.5 * s, r * 0.35 * s, 0, 0, 7);
    c.fill();
  }
}

/*
 * Las matas del lote se dibujan una vez como imagen y luego se estampan:
 * son cientos por cuadro y cada una lleva varias elipses entintadas.
 * Caja de cada tipo en unidades de s=1: [x0, y0, ancho, alto] respecto a la base.
 */
const CAJA_MATA = { papa: [-0.03, -0.035, 0.06, 0.04], maiz: [-0.04, -0.09, 0.08, 0.095], cafe: [-0.022, -0.046, 0.044, 0.05] };
const SPR_MATAS = {};
function spriteMata(tipo, variante) {
  const clave = `${tipo}${variante}`;
  if (SPR_MATAS[clave]) return SPR_MATAS[clave];
  const [x0, y0, w, h] = CAJA_MATA[tipo];
  const k = 150 / w; // px por unidad
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * k);
  cv.height = Math.ceil(h * k);
  const c = cv.getContext('2d');
  c.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  const px = 1.1 / k;
  if (tipo === 'papa') matPapa(c, 0, 0, 1, px, variante);
  else if (tipo === 'maiz') matMaiz(c, 0, 0, 1, px);
  else matCafeLote(c, 0, 0, 1, px);
  SPR_MATAS[clave] = cv;
  return cv;
}
function estampaMata(c, tipo, variante, x, y, s) {
  const [x0, y0, w, h] = CAJA_MATA[tipo];
  c.drawImage(spriteMata(tipo, variante), x + x0 * s, y + y0 * s, w * s, h * s);
}

/** Posición en el lote: u de izquierda a derecha en surcos, v de lejos (0) a cerca (1). */
function enLote(k, v) {
  const yNear = CERCA_Y;
  const xb = FUGA.x + k * 0.22;
  const y = lerp(BORDE_LOTE, yNear, v);
  const t = (y - FUGA.y) / (yNear - FUGA.y);
  return { x: lerp(FUGA.x, xb, t), y, esc: t };
}

function lote(c, env, datos, px) {
  const v = env.view;
  // tierra del lote: franjas de surco alternas, que convergen al fondo
  c.save();
  c.beginPath();
  c.rect(v[0] - 1, BORDE_LOTE, v[2] - v[0] + 2, CERCA_Y + 1);
  c.clip();
  for (let k = -14; k <= 14; k++) {
    const a0 = enLote(k - 0.5, 0);
    const a1 = enLote(k + 0.5, 0);
    const b0 = enLote(k - 0.5, 1.2);
    const b1 = enLote(k + 0.5, 1.2);
    c.fillStyle = k % 2 ? '#7c5634' : '#946842';
    c.beginPath();
    c.moveTo(a0.x, a0.y);
    c.lineTo(a1.x, a1.y);
    c.lineTo(b1.x, b1.y);
    c.lineTo(b0.x, b0.y);
    c.closePath();
    c.fill();
  }
  c.strokeStyle = 'rgba(35,29,23,.35)';
  c.lineWidth = px;
  for (let k = -14; k <= 14; k++) {
    const a = enLote(k - 0.5, 0);
    const b = enLote(k - 0.5, 1.2);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
  }
  // bruma hacia el fondo del lote
  const g = c.createLinearGradient(0, BORDE_LOTE, 0, BORDE_LOTE + 0.25);
  g.addColorStop(0, 'rgba(210,220,190,.55)');
  g.addColorStop(1, 'rgba(210,220,190,0)');
  c.fillStyle = g;
  c.fillRect(v[0], BORDE_LOTE, v[2] - v[0], 0.25);
  c.restore();
  // matas sobre cada surco, de atrás hacia adelante
  const piso = datos.piso || (Number.isFinite(datos.altitud) ? (datos.altitud < 1000 ? 'cálido' : datos.altitud < 2000 ? 'templado' : datos.altitud < 3000 ? 'frío' : 'páramo') : 'frío');
  const r = rng(19);
  const vs = [];
  for (let v2 = 0.02; v2 < 1.15; v2 += 0.022 + v2 * 0.07) vs.push(v2);
  for (const vv of vs) {
    for (let k = -12; k <= 12; k += 2) {
      const p = enLote(k, vv);
      if (!enVista(env, p.x, p.y, 0.15)) continue;
      const s = p.esc * 2.6;
      const q = r();
      if (Math.hypot(p.x - ATERRIZAJE.x, (p.y - ATERRIZAJE.y) * 2) < 0.1) continue;
      if (datos.identidad === 'tecnico' && q < 0.06) {
        c.strokeStyle = TINTA;
        c.lineWidth = Math.max(px, 0.003 * s);
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x, p.y - 0.07 * s);
        c.stroke();
        c.fillStyle = '#e8b04a';
        c.fillRect(p.x, p.y - 0.07 * s, 0.03 * s, 0.018 * s);
        c.strokeRect(p.x, p.y - 0.07 * s, 0.03 * s, 0.018 * s);
      }
      if (piso === 'cálido') {
        if (q < 0.22) palma(c, p.x, p.y, s, px);
      }
      else if (piso === 'templado') estampaMata(c, 'cafe', 0, p.x, p.y, s);
      else if (piso === 'páramo') {
        if (datos.altitud >= 3200 && datos.altitud <= 3800) {
          if (q < 0.25) frailejon(c, p.x, p.y, s, px);
          else pajon(c, p.x, p.y, s, px);
        }
      } else if (datos.altitud >= 2500 && datos.altitud <= 3200) estampaMata(c, 'papa', q > 0.75 ? 0.9 : q > 0.45 ? 0.6 : 0.2, p.x, p.y, s);
    }
  }
}

function dibujaTierraPropia(c, env, datos) {
  if (env.solo === 'anim') return;
  const px = env.px;
  const v = env.view;
  fondoVertical(c, env, [[-1.6, '#86bcd8'], [-0.7, '#c4dfe6'], [HORIZ, '#f4e9c9']]);
  // sol de la mañana y nubes
  const gs = c.createRadialGradient(-0.52, -0.78, 0, -0.52, -0.78, 0.6);
  gs.addColorStop(0, 'rgba(255,250,222,1)');
  gs.addColorStop(0.08, 'rgba(255,243,196,.9)');
  gs.addColorStop(0.35, 'rgba(255,236,190,.22)');
  gs.addColorStop(1, 'rgba(255,236,190,0)');
  c.fillStyle = gs;
  c.fillRect(-1.12, -1.38, 1.2, 1.2);
  const rn = rng(61);
  for (let i = 0; i < 6; i++) {
    const x = -1.2 + rn() * 2.4 + ((env.t * 0.004) % 0.3);
    const y = -1.1 + rn() * 0.5;
    const rad = 0.1 + rn() * 0.12;
    c.globalAlpha = 0.75;
    c.drawImage(SPR_NUBE, x - rad, y - rad * 0.35, rad * 2, rad * 0.7);
  }
  c.globalAlpha = 1;
  // la cordillera de fondo y las lomas con monte y potreros
  const lomas = [
    { col: '#a7b9c4', dy: HORIZ - 0.05, amp: 0.34, fr: 2.3, f: 0.7, pat: null },
    { col: '#86a58a', dy: HORIZ - 0.005, amp: 0.2, fr: 3.7, f: 2.1, pat: 'monte' },
    { col: '#9ab870', dy: HORIZ + 0.03, amp: 0.08, fr: 5.3, f: 0.3, pat: null },
  ];
  for (const L of lomas) {
    c.fillStyle = L.col;
    c.beginPath();
    c.moveTo(v[0] - 0.1, HORIZ + 0.3);
    const paso = Math.max((v[2] - v[0]) / 90, px * 3);
    for (let x = v[0] - 0.1; x <= v[2] + 0.1 + paso; x += paso) {
      const y = L.dy - L.amp * (0.5 + 0.35 * Math.sin(x * L.fr + L.f) + 0.15 * Math.sin(x * L.fr * 3.1 + L.f));
      c.lineTo(x, y);
    }
    c.lineTo(v[2] + 0.1, HORIZ + 0.3);
    c.closePath();
    c.fill();
    if (L.pat && PAT.monte) {
      c.save();
      c.clip();
      const m = new DOMMatrix().scaleSelf(0.0011, 0.0011);
      PAT.monte.setTransform(m);
      c.globalAlpha = 0.55;
      c.fillStyle = PAT.monte;
      c.fillRect(v[0] - 0.1, HORIZ - 0.6, v[2] - v[0] + 0.2, 0.8);
      c.globalAlpha = 1;
      c.restore();
    }
    c.strokeStyle = 'rgba(35,29,23,.35)';
    c.lineWidth = px;
    c.stroke();
  }
  // suelo
  const gsu = c.createLinearGradient(0, HORIZ, 0, 1.4);
  gsu.addColorStop(0, '#a3bf6c');
  gsu.addColorStop(0.5, '#86a656');
  gsu.addColorStop(1, '#6a8d45');
  c.fillStyle = gsu;
  c.fillRect(v[0], HORIZ + 0.02, v[2] - v[0], Math.max(0, v[3] - HORIZ));

  const escala = datos.escala;
  const idn = datos.identidad;
  const esBalcon = escala === 'balcon' || (!escala && idn === 'urbano');

  if (esBalcon) {
    c.fillStyle = '#efe2c4';
    c.fillRect(0.12, -1.5, 2, 1.52);
    c.strokeStyle = TINTA;
    c.lineWidth = Math.max(px * 1.4, 0.003);
    c.strokeRect(0.12, -1.5, 2, 1.52);
    c.fillStyle = '#6b8fa3';
    c.fillRect(0.32, -0.62, 0.28, 0.36);
    c.strokeRect(0.32, -0.62, 0.28, 0.36);
    c.beginPath();
    c.moveTo(0.46, -0.62);
    c.lineTo(0.46, -0.26);
    c.moveTo(0.32, -0.44);
    c.lineTo(0.6, -0.44);
    c.stroke();
    c.fillStyle = '#c98a62';
    c.fillRect(v[0], 0.02, v[2] - v[0], Math.max(0, v[3] - 0.02));
    c.strokeStyle = 'rgba(35,29,23,.35)';
    c.lineWidth = px;
    for (let k = -20; k <= 20; k++) {
      c.beginPath();
      c.moveTo(k * 0.12, 0.02);
      c.lineTo(k * 0.3, 1.4);
      c.stroke();
    }
    c.strokeStyle = TINTA;
    c.lineWidth = Math.max(px * 1.4, 0.004);
    c.beginPath();
    c.moveTo(v[0], -0.06);
    c.lineTo(v[2], -0.06);
    for (let x = Math.ceil(v[0] / 0.06) * 0.06; x < v[2]; x += 0.06) {
      c.moveTo(x, -0.06);
      c.lineTo(x, 0.02);
    }
    c.stroke();
    materas(c, -0.08, 0.02, 1.4, px);
  } else {
    arbolGrande(c, 0.2, HORIZ + 0.075, 1.25, px);
    casaFinca(c, 0.5, HORIZ + 0.085, 1, px, env.t);
    // cerca de postes al borde del lote
    c.strokeStyle = TINTA;
    c.lineWidth = Math.max(px, 0.0025);
    c.beginPath();
    for (let x = v[0] - 0.05; x < v[2] + 0.05; x += 0.07) {
      c.moveTo(x, BORDE_LOTE + 0.004);
      c.lineTo(x, BORDE_LOTE - 0.035);
    }
    c.moveTo(v[0] - 0.05, BORDE_LOTE - 0.012);
    c.lineTo(v[2] + 0.05, BORDE_LOTE - 0.012);
    c.moveTo(v[0] - 0.05, BORDE_LOTE - 0.027);
    c.lineTo(v[2] + 0.05, BORDE_LOTE - 0.027);
    c.stroke();
    if (escala === 'invernadero') {
      invernadero(c, -0.3, BORDE_LOTE - 0.004, 0.66, 0.2, datos.invernadero || 'cuadrado', px);
    }
    if (idn === 'animales') {
      const r = rng(9);
      vaca(c, -0.5, BORDE_LOTE + 0.07, 1.3, px);
      for (let i = 0; i < 8; i++) gallina(c, -0.7 + r() * 1.1, BORDE_LOTE + 0.12 + r() * 0.3, 1.7 + r() * 1.2, px, r() < 0.5 ? '#f1e8d7' : '#a2592f');
      // pasto en matojos
      c.strokeStyle = '#4f7a32';
      c.lineWidth = px * 1.2;
      c.beginPath();
      for (let i = 0; i < 70; i++) {
        const x = -1 + r() * 2;
        const y = BORDE_LOTE + 0.05 + r() * 1.2;
        const s = 0.01 + (y - HORIZ) * 0.02;
        c.moveTo(x - s, y);
        c.lineTo(x, y - s * 1.6);
        c.lineTo(x + s, y);
      }
      c.stroke();
    } else if (idn === 'restauro') {
      const r = rng(13);
      for (let i = 0; i < 10; i++) {
        const x = -1.1 + i * 0.13 + r() * 0.04;
        copa(c, x, BORDE_LOTE, 0.05 + r() * 0.03, 0.06 + r() * 0.03, r() < 0.5 ? '#3e6f3c' : '#2f5a33', px);
      }
      for (let i = 0; i < 7; i++) {
        const x = -0.55 + i * 0.16;
        const y = BORDE_LOTE + 0.14 + (i % 2) * 0.1;
        const s = 1.5 + (y - HORIZ) * 2;
        c.strokeStyle = '#8b6d45';
        c.lineWidth = Math.max(px, 0.003 * s);
        c.beginPath();
        c.moveTo(x + 0.01 * s, y);
        c.lineTo(x + 0.01 * s, y - 0.06 * s);
        c.stroke();
        copa(c, x, y, 0.016 * s, 0.016 * s, '#4f8a3f', px);
      }
    } else if (!(escala === 'invernadero' && !idn)) {
      lote(c, env, datos, px);
    }
  }
  // el montoncito de tierra con la semilla que brota: aquí aterriza el compai
  const A = ATERRIZAJE;
  const sombra = c.createRadialGradient(A.x, A.y + 0.01, 0, A.x, A.y + 0.01, 0.1);
  sombra.addColorStop(0, 'rgba(40,28,16,.35)');
  sombra.addColorStop(1, 'rgba(40,28,16,0)');
  c.fillStyle = sombra;
  c.fillRect(A.x - 0.1, A.y - 0.04, 0.2, 0.1);
  c.fillStyle = '#6d4a2c';
  c.strokeStyle = TINTA;
  c.lineWidth = Math.max(px * 1.2, 0.0025);
  c.beginPath();
  c.ellipse(A.x, A.y + 0.012, 0.08, 0.02, 0, Math.PI, 0);
  c.closePath();
  c.fill();
  c.stroke();
  plantita(c, A.x, A.y - 0.004, 1.7 + 0.08 * Math.sin(env.t * 1.5), '#79b556', px);
}

/* ─────────────────────────── el motor ─────────────────────────── */

function motorMudo(op) {
  let paso = 0;
  return {
    T: 0,
    P_PASO: [],
    setDatos() {},
    irAPaso(p) {
      paso = p;
      if (op.alLlegar) op.alLlegar();
      return 0;
    },
    geoEnPantalla: () => null,
    aterrizajeEnPantalla: () => null,
    estado: () => ({ p: paso, T: 0, nivel: 0, f: 1, moviendo: false, mudo: true }),
    destruir() {},
  };
}

const NIVELES = [dibujaTierra, dibujaColombia, dibujaMontana, dibujaVereda, dibujaTierraPropia];
const DE_DIA = [0, 0, 0.6, 1, 1];

/**
 * Crea el mundo sobre un canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {{ reducirMovimiento?: boolean, alAltura?: (metros:number)=>void, alCuadro?: ()=>void, alLlegar?: ()=>void }} [op]
 */
export function crearDescenso(canvas, op = {}) {
  let ctx = null;
  try {
    ctx = canvas.getContext('2d', { alpha: false });
  } catch (_) {
    ctx = null;
  }
  // Sin canvas (navegador viejo, jsdom): el flujo sigue, sin mundo detrás.
  if (!ctx) return motorMudo(op);
  SPR_LUZ = SPR_LUZ || sprite(64, [[0, 'rgba(255,248,222,1)'], [0.18, 'rgba(255,226,150,.95)'], [0.45, 'rgba(255,190,90,.35)'], [1, 'rgba(255,170,70,0)']]);
  SPR_HALO = SPR_HALO || sprite(64, [[0, 'rgba(255,196,110,.9)'], [0.5, 'rgba(255,170,80,.25)'], [1, 'rgba(255,150,60,0)']]);
  SPR_NUBE = SPR_NUBE || sprite(96, [[0, 'rgba(255,250,244,.95)'], [0.55, 'rgba(250,244,238,.6)'], [1, 'rgba(250,244,238,0)']]);
  const grano = granoPapel();
  crearPatrones(ctx);

  /*
   * Dos superficies:
   *  · la caché: el nivel en pausa, pintado UNA vez con grano y viñeta; en
   *    pausa solo se copia y encima van los pulsos (o nada, si nada late).
   *  · la directa: mientras la cámara vuela se pinta cada cuadro en el canvas
   *    visible, sin grano. (Se probó pintar el vuelo a media resolución en un
   *    canvas aparte y escalarlo: medido A/B intercalado, costó 99–190 ms por
   *    cuadro contra 15–40 ms directo. Descartado.)
   */
  const superficie = () => {
    const cv = document.createElement('canvas');
    const b = document.createElement('canvas');
    return { cv, c: cv.getContext('2d'), buf: b, bctx: b.getContext('2d'), dpr: 1, grano: null };
  };
  const cache = superficie();
  const directa = { cv: canvas, c: ctx, buf: cache.buf, bctx: cache.bctx, dpr: 1 };

  const datos = {
    punto: null, candidato: null, buscando: false, altitud: null, piso: null,
    vereda: null, municipio: null, veredaGeo: null, identidad: null, escala: null, invernadero: null,
  };

  let W = 1;
  let H = 1;
  let DPR = 1;
  let S = 1;
  let FX = 0;
  let FY = 0;

  // Guion: por nivel, una pausa y un zoom al hijo; al final, el aterrizaje.
  /** @type {Array<{k:string,L:number,w:number,a:number,b:number}>} */
  const SEGS = [];
  for (let L = 0; L < NIVELES.length; L++) {
    SEGS.push({ k: 'hold', L, w: 1, a: 0, b: 0 });
    if (L < NIVELES.length - 1) SEGS.push({ k: 'zoom', L, w: 1.25, a: 0, b: 0 });
  }
  SEGS.push({ k: 'land', L: 4, w: 0.9, a: 0, b: 0 });
  let acc = 0;
  for (const s of SEGS) { s.a = acc; acc += s.w; s.b = acc; }
  const T = acc;
  const holdDe = (L) => SEGS.find((s) => s.k === 'hold' && s.L === L);
  const P_PASO = [0, 1, 2, 3, 4].map((L) => (holdDe(L).a + holdDe(L).b) / 2);
  P_PASO.push(T);

  function portal(L) {
    if (L === 0) return { x: 0, y: 0, s: F[1] / F[0] };
    if (L === 1) {
      const p = datos.punto ? geoANivel1(datos.punto.lat, datos.punto.lng) : { x: 0, y: 0 };
      return { x: p.x, y: p.y, s: F[2] / F[1] };
    }
    if (L === 2) {
      const fin = fincaEnMontana(montana(datos));
      return { x: fin.x, y: fin.y, s: F[3] / F[2] };
    }
    if (L === 3) {
      const [x, y] = centroCelda(CELDA_SUYA);
      return { x, y, s: F[4] / F[3] };
    }
    return null;
  }

  function camAt(p) {
    p = clamp(p, 0, T);
    let s = SEGS[SEGS.length - 1];
    for (const q of SEGS) { if (p <= q.b) { s = q; break; } }
    const u = clamp((p - s.a) / s.w, 0, 1);
    if (s.k === 'hold') return { L: s.L, cx: 0, cy: 0, f: 1 };
    if (s.k === 'land') {
      const uu = easeInOut(u);
      const f = Math.pow(ATERRIZAJE.f, uu);
      const k = (1 - f) / (1 - ATERRIZAJE.f);
      return { L: 4, cx: ATERRIZAJE.x * k, cy: (ATERRIZAJE.y - 0.12) * k, f };
    }
    const P = portal(s.L);
    const f = Math.pow(P.s, u);
    const k = (1 - f) / (1 - P.s);
    return { L: s.L, cx: P.x * k, cy: P.y * k, f };
  }

  function env(L, cx, cy, f, ppu, ox, oy, t, sup, solo) {
    return {
      L, cx, cy, f, ppu, px: 1 / ppu, ox, oy, dpr: sup.dpr, S, t, solo,
      view: [cx - FX / ppu, cy - FY / ppu, cx + (W - FX) / ppu, cy + (H - FY) / ppu],
    };
  }

  function pintaNivel(sup, L, cx, cy, f, t, solo = null) {
    const c = sup.c;
    const D = sup.dpr;
    const ppu = S / f;
    const ox = FX - cx * ppu;
    const oy = FY - cy * ppu;
    c.setTransform(D * ppu, 0, 0, D * ppu, D * ox, D * oy);
    NIVELES[L](c, env(L, cx, cy, f, ppu, ox, oy, t, sup, solo), datos);
    if (solo === 'anim') return;
    const P = portal(L);
    if (!P) return;
    const pp = P.s * ppu;
    const a = sstep(0.22 * S, 0.95 * S, pp);
    if (a <= 0) return;
    const ppu2 = pp;
    const ox2 = FX + (P.x - cx) * ppu;
    const oy2 = FY + (P.y - cy) * ppu;
    const cx2 = (cx - P.x) / P.s;
    const cy2 = (cy - P.y) / P.s;
    const f2 = f / P.s;
    const cubre = a >= 0.999;
    const bctx = sup.bctx;
    const dst = cubre ? c : bctx;
    if (!cubre) {
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.clearRect(0, 0, sup.buf.width, sup.buf.height);
    }
    dst.setTransform(D * ppu2, 0, 0, D * ppu2, D * ox2, D * oy2);
    NIVELES[L + 1](dst, env(L + 1, cx2, cy2, f2, ppu2, ox2, oy2, t, sup, null), datos);
    if (cubre) return;
    const rMax = Math.hypot(Math.max(ox2, W - ox2), Math.max(oy2, H - oy2));
    const r0 = lerp(pp * 0.18, rMax * 1.02, a * a);
    const r1 = r0 + pp * 0.22 + 20;
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalCompositeOperation = 'destination-in';
    const gm = bctx.createRadialGradient(ox2 * D, oy2 * D, r0 * D, ox2 * D, oy2 * D, r1 * D);
    gm.addColorStop(0, `rgba(0,0,0,${Math.min(1, a * 1.4)})`);
    gm.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = gm;
    bctx.fillRect(0, 0, sup.buf.width, sup.buf.height);
    bctx.globalCompositeOperation = 'source-over';
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(sup.buf, 0, 0);
  }

  function diaDe(cam) {
    const P = portal(cam.L);
    if (!P || cam.f >= 1) return DE_DIA[cam.L];
    const u = Math.log(cam.f) / Math.log(P.s);
    return lerp(DE_DIA[cam.L], DE_DIA[cam.L + 1], sstep(0.55, 1, u));
  }

  /** Grano de papel (solo de día) y viñeta, sobre una superficie ya pintada. */
  function acabado(sup, dia, conGrano) {
    const c = sup.c;
    const D = sup.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (conGrano && dia > 0.05) {
      if (!sup.grano) sup.grano = c.createPattern(grano, 'repeat');
      c.globalAlpha = 0.07 * dia;
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = sup.grano;
      c.fillRect(0, 0, sup.cv.width, sup.cv.height);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    }
    const gv = c.createRadialGradient(FX * D, FY * D, Math.min(W, H) * 0.35 * D, FX * D, FY * D, Math.hypot(W, H) * 0.75 * D);
    gv.addColorStop(0, 'rgba(0,0,0,0)');
    gv.addColorStop(1, `rgba(12,10,8,${0.38 - 0.18 * dia})`);
    c.fillStyle = gv;
    c.fillRect(0, 0, sup.cv.width, sup.cv.height);
  }

  /** ¿El nivel tiene algo que late en pausa (pulsos, el barrido de búsqueda)? */
  const late = (L) => (L === 1 ? Boolean(datos.buscando || datos.punto || datos.candidato) : L === 3);

  let p = 0;
  let tw = null; // { de, a, t0, dur }
  let raf = 0;
  let ultimo = 0;
  let vivo = true;
  let camActual = camAt(0);
  let cacheOk = false;
  let sucio = true;
  const t0 = performance.now();

  // Costo de dibujo de los últimos cuadros (ms), para medir sin adivinar.
  const costes = [];
  function render(now) {
    const tIni = performance.now();
    const t = (now - t0) / 1000;
    const cam = camAt(p);
    camActual = cam;
    const dia = diaDe(cam);
    if (tw) {
      cacheOk = false;
      pintaNivel(directa, cam.L, cam.cx, cam.cy, cam.f, t);
      acabado(directa, dia, false);
    } else {
      if (!cacheOk) {
        pintaNivel(cache, cam.L, cam.cx, cam.cy, cam.f, t, cam.f === 1 ? 'base' : null);
        acabado(cache, dia, true);
        cacheOk = true;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(cache.cv, 0, 0);
      if (cam.f === 1 && late(cam.L)) pintaNivel(directa, cam.L, cam.cx, cam.cy, cam.f, t, 'anim');
    }
    if (op.alAltura) {
      const anchoM = (W / (S / cam.f)) * F[cam.L];
      op.alAltura(anchoM * 0.9);
    }
    if (op.alCuadro) op.alCuadro();
    sucio = false;
    costes.push(performance.now() - tIni);
    if (costes.length > 240) costes.shift();
  }

  function frame(now) {
    if (!vivo) return;
    raf = requestAnimationFrame(frame);
    let moviendo = false;
    if (tw) {
      const u = clamp((now - tw.t0) / tw.dur, 0, 1);
      p = lerp(tw.de, tw.a, easeInOut(u));
      moviendo = true;
      if (u >= 1) { p = tw.a; tw = null; cacheOk = false; sucio = true; if (op.alLlegar) op.alLlegar(); }
    }
    if (moviendo || sucio) {
      ultimo = now;
      render(now);
      return;
    }
    // En pausa: si nada late, el cuadro ya está pintado y no se toca.
    // Si algo late, 30 cuadros por segundo alcanzan.
    if (!late(camActual.L) || camActual.f !== 1 || now - ultimo < 32) return;
    ultimo = now;
    render(now);
  }

  function medir() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    const nucleos = navigator.hardwareConcurrency || 4;
    DPR = Math.min(window.devicePixelRatio || 1, nucleos <= 4 ? 1.5 : 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    directa.dpr = DPR;
    cache.dpr = DPR;
    cache.cv.width = cache.buf.width = Math.round(W * DPR);
    cache.cv.height = cache.buf.height = Math.round(H * DPR);
    cache.grano = null;
    const vertical = W < H * 0.95;
    if (vertical) {
      S = W * 1.0;
      FX = W / 2;
      FY = H * 0.33;
    } else {
      S = Math.min(H * 0.82, W * 0.55);
      FX = W * 0.64;
      FY = H * 0.47;
    }
    cacheOk = false;
    sucio = true;
  }
  medir();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { medir(); render(performance.now()); }) : null;
  if (ro) ro.observe(canvas);
  const alVisibilidad = () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (vivo) { sucio = true; raf = requestAnimationFrame(frame); }
  };
  document.addEventListener('visibilitychange', alVisibilidad);
  raf = requestAnimationFrame(frame);

  return {
    T,
    P_PASO,
    setDatos(parcial) {
      Object.assign(datos, parcial);
      cacheOk = false;
      sucio = true;
    },
    /** Lleva la cámara al momento del paso. */
    irAPaso(paso, { inmediato = false } = {}) {
      const destino = P_PASO[clamp(paso, 0, P_PASO.length - 1)];
      if (inmediato || op.reducirMovimiento) {
        tw = null;
        p = destino;
        cacheOk = false;
        sucio = true;
        if (op.alLlegar) op.alLlegar();
        return 0;
      }
      const d = Math.abs(destino - p);
      if (d < 1e-4) return 0;
      const dur = clamp(900 + d * 1500, 1200, 5200);
      tw = { de: p, a: destino, t0: performance.now(), dur };
      return dur;
    },
    /** Punto de la pantalla (px CSS) → lat/lng, solo mientras se mira Colombia. */
    geoEnPantalla(clientX, clientY) {
      const cam = camActual;
      if (cam.L !== 1 || cam.f !== 1) return null;
      const r = canvas.getBoundingClientRect();
      const x = (clientX - r.left - FX) / S;
      const y = (clientY - r.top - FY) / S;
      return nivel1AGeo(x, y);
    },
    /** Dónde cae en pantalla el sitio de aterrizaje del nivel 4 (px CSS). */
    aterrizajeEnPantalla() {
      const cam = camActual;
      if (cam.L !== 4) return null;
      const ppu = S / cam.f;
      const r = canvas.getBoundingClientRect();
      return { x: r.left + FX + (ATERRIZAJE.x - cam.cx) * ppu, y: r.top + FY + (ATERRIZAJE.y - cam.cy) * ppu, escala: ppu / S };
    },
    estado() {
      const orden = [...costes].sort((a, b) => a - b);
      const media = orden.length ? orden.reduce((a, b) => a + b, 0) / orden.length : null;
      const p95 = orden.length ? orden[Math.floor(orden.length * 0.95)] : null;
      return { p, T, nivel: camActual.L, f: camActual.f, moviendo: !!tw, costeMedioMs: media, costeP95Ms: p95, cuadros: orden.length, dpr: DPR };
    },
    reiniciarCostes() {
      costes.length = 0;
    },
    destruir() {
      vivo = false;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      document.removeEventListener('visibilitychange', alVisibilidad);
    },
  };
}
