import { ARIA_ZARIGUYA, FRASE_MUERTA } from '../../compai/nucleo/zariguyaGestos.js';
import { useEffect, useId, useMemo, useRef } from 'react';
import './creatures.css';
import './zariguyaCompai.css';
import { CuerpoCuadrupedo } from './zariguyaCuadrupedo.jsx';
import { useVidaIdle, useRitmoPropio, useMiradaUsted } from './useVidaIdle.js';
import { CompaiAgente } from '../agente/CompaiAgente.jsx';
import { COMPAI_ESPECIES } from '../agente/compaiEspecies.js';
import { CreatureFilters } from './_filters.jsx';
import { RH_INK } from './_rubberhose.jsx';
import { ZARIGUYA_SLUG, PERFIL_ZARIGUYA } from './zariguyaIdentidad.js';
import { cuerpoDeClima } from './creatureClimaCuerpo.js';
import { LineBoilFilter } from './LineBoilFilter.jsx';
import { PropEnMano } from './PropEnMano.jsx';
import { AuraPoder } from './AuraPoder.jsx';
import { auraDeBicho } from './transformacion.js';
import { conductaZariguya } from '../../compai/zariguyaConducta.js';
import { grabado } from './zariguyaGrabado.js';

/* LA ZARIGÜEYA COMPAI — Didelphis (chucha, fara, runcho), DIBUJADA A MANO.
   Vector puro de la familia de los compais que sí funcionaron (OsoBaston,
   Guacamaya, Angelita): formas con nombre de anatomía sobre el kit compartido
   `_rubberhose.jsx` + `useVidaIdle.js`. Reemplaza el trazado automático de
   numerosas piezas por formas anatómicas nombradas.

   Las láminas de `_archivo/laminas/zariguya-gemini-*.png` se MIRARON para el
   personaje (la cara, la máscara, el gesto de las orejas, el pelaje de guardia,
   la cola desnuda, las manitos rosadas) y NO se calcaron: cada curva de aquí
   se escribió a mano, en unidades del viewBox.

   ── EL ESQUELETO DE HUESOS (grupos SVG = huesos, jerarquía real) ────────────
     .zc-tumba (wrapper de la tanatosis: se desploma ENTERA)
       └─ .crt-body (raíz: pelvis)
            ├─ .zc-cola → .zc-cola-punta        (prensil, nace BAJA en la grupa)
            ├─ .zc-pierna-i                     (apoyo lejano)
            │    └─ .zc-canilla-* → .zc-pie-*   (rodilla→canilla→pie plantígrado)
            └─ .zc-columna                      (el tronco: se inclina SOLO)
                 ├─ .zc-tronco (+ panza crema que se FUNDE, sin borde duro)
                 ├─ .zc-pierna-d                 (anca cercana, delante del flanco)
                 ├─ .crt-brazo-l / .crt-brazo-r (hombro→brazo→manito rosada)
                 ├─ .zc-cuello                  (gola CONTINUA: no-decapitable)
                 ├─ .zc-cabeza-mira             (wrapper ADITIVO: sigue a usted)
                 │    └─ .zc-cabeza             (nod / ladeo / husmeo)
                 │         ├─ .zc-oreja-i/-d    (grandes, desnudas, giran solas)
                 │         ├─ .zc-hocico        (trufa + bigotes + boca: habla)
                 │         └─ .zc-parpados      (cierran en la tanatosis)
                 └─ .zc-crias                   (las crías que se asoman)

   ── SIN BORDE DURO (veto del operador) ──────────────────────────────────────
   Ningún parche de color plano pegado sobre el pelaje: la panza crema, la
   máscara pálida de la cara y el antifaz oscuro son GRADIENTES RADIALES que se
   funden con el pelaje; los mechones son trazos, no recortes.

   ── AL CAMINAR NO BRINCA ────────────────────────────────────────────────────
   El andar se lee por las patas (péndulo de cadera + rodilla que pliega + pie
   que despega) y los brazos a contrapeso. El cuerpo NO sube ni baja: tope de
   1,5 px de oscilación vertical, medido (ver zariguyaCompai.css).

   Fundación transversal INTACTA (cero código duplicado): kit rubber-hose
   (solo el token de tinta), vida propia (useVidaIdle + ritmo propio +
   useMiradaUsted, repertorio SSOT en perfilesConducta.js), clima→cuerpo,
   line-boil, prop por mundo, modo poder (aura ROSA DE LUNA). */
const VIEWBOX = '-20 -25 40 45';
const ZARI_PERFIL_COMPAI = COMPAI_ESPECIES.zariguya;

/* LA PALETA DE LA LÁMINA (no la ceniza del vector viejo): pelaje CARBÓN-CAFÉ
   con luz fría arriba, lanilla CREMA de panza y cara, piel ROSADA desnuda en
   orejas, trufa, manos, pies y cola. */
const P = {
  /* Pelaje pardo-oliva de las láminas SET-LIMPIO (medido sobre el hero:
     lomo #4d4333, muslo #7b6951, puntas claras de guardia). */
  cuerpo: '#4d4333',
  cuerpoLuz: '#766650',
  cuerpoSombra: '#2c251c',
  brillo: '#a8977a',
  umbra: '#16120c',
  /* Crema tostada de la lámina (mejilla #d1bea0): menos blanca que antes. */
  crema: '#dccbaa',
  cremaLuz: '#efe3c8',
  cremaSombra: '#b3a07f',
  mascara: '#2a221a',
  oreja: '#d6aaa4',
  orejaLuz: '#ebc9c2',
  orejaHondo: '#8d6a66',
  orejaBorde: '#4b3a34',
  trufa: '#e2939b',
  trufaLuz: '#f3bfc3',
  trufaSombra: '#b06770',
  piel: '#dcb9a6',
  pielSombra: '#b08a76',
  garra: '#2e241e',
  cola: '#d7a99b',
  colaLuz: '#ecc6ba',
  colaSombra: '#a67c70',
  esclera: '#f7f1e6',
  iris: '#3b2717',
  pupila: '#120b07',
  lengua: '#e8879b',
};
const INK = RH_INK;

/* ═══ SILUETAS (unidades del viewBox, dibujadas a mano) ══════════════════════ */

/* Pecho adelantado a la izquierda, flanco corto y grupa cargada a la derecha.
   La curva dorsal enlaza con el muslo cercano; no hay eje de espejo. */
const TRONCO =
  'M -4.9,-7.3 '
  + 'C -6.6,-6.0 -7.0,-3.8 -6.4,-1.5 '
  + 'C -6.0,0.1 -4.8,1.0 -4.5,2.5 '
  + 'C -4.3,4.0 -5.5,5.6 -4.1,7.4 '
  + 'C -2.4,9.5 1.5,10.0 5.0,8.8 '
  + 'C 8.1,7.8 9.0,5.7 8.1,2.6 '
  + 'C 7.4,0.0 5.9,-1.7 4.5,-3.8 '
  + 'C 3.1,-6.0 -1.4,-8.5 -4.9,-7.3 Z';

/* LA GOLA del cuello: masa continua bajo el cráneo (solape ≥ 4 unidades),
   borde bajo de mechones. */
const GOLA =
  'M -4.5,-11 C -6,-8 -6.2,-4 -4.5,-1 L -4,-2 -3,0 -2.6,-1 '
  + 'Q 0,1 2,-1 L 1,-2.5 3.8,-2 C 5,-6 3.5,-9.4 2.6,-11 Z';

/* Cráneo en tres cuartos: sien lejana corta, mejilla cercana amplia.
   El morro avanza hacia el mismo lado que el pecho. */
const CRANEO =
  'M -1.1,-19.5 C 1.0,-19.5 3.7,-19.2 4.6,-17.7 '
  + 'C 5.8,-15.8 5.8,-12.8 3.6,-10.3 '
  + 'C 1.0,-8.6 -2.8,-6.7 -5.3,-7.8 L -7.2,-10.0 '
  + 'C -6.4,-12.6 -6.8,-16.7 -4.4,-18.6 Q -3.0,-19.4 -1.1,-19.5 Z';
const CARA =
  'M -4.9,-18.2 C -1.4,-18.9 3.8,-18.9 4.8,-15.0 '
  + 'C 5.0,-12.3 0.7,-9.0 -4.7,-7.7 '
  + 'Q -4.7,-7.0 -6.2,-10.7 C -6.7,-13.5 -6.1,-16.1 -4.2,-17.7 Z';

// Tinta direccional dibujada por zonas: cada curva acompaña el volumen.
// Los subtrazos comparten path, pero siguen al hueso que les corresponde.
const PELO_CARA = 'M -5.7,-15.4 l 0.6,-0.9 M -5.0,-15.8 l 0.6,-0.9 M -4.3,-16.2 l 0.4,-0.9 M -3.6,-16.5 l 0.3,-0.9 M -2.9,-16.8 l 0.1,-0.8 M -2.2,-16.4 l -0.1,-0.8 M -1.6,-15.5 l -0.2,-0.8 M -1.2,-14.6 l -0.2,-0.6 M -5.8,-11.8 l 1.0,0.1 M -5.9,-11.1 l 1.0,-0.1 M -5.6,-10.5 l 1.0,-0.1 M -5.0,-9.8 l 0.8,-0.1 M -4.4,-9.1 l 0.7,0.0 M -3.7,-8.5 l 0.6,0.0 M -3.1,-7.8 l 0.5,0.1 M -2.5,-7.1 l 0.4,0.1 M -1.9,-6.6 l 0.5,0.2 M -1.1,-10.2 l -0.1,-0.5 M -0.7,-11.2 l -0.1,-0.7 M -0.5,-12.2 l -0.1,-0.6';

/* Tronco erguido: el pelo cae del cuello y se abre hacia la grupa. */
const flujoTronco = (x, y) => Math.PI / 2 - 0.55 * Math.max(-0.4, Math.min(1, (x + 2) / 9)) + (y < -4 ? 0.25 : 0);
const GRABADO_TRONCO = grabado({ x0: -7, x1: 9, y0: -8, y1: 10, n: 930, largo: 1.05, semilla: 23, flujo: flujoTronco });
const PUNTAS_TRONCO = grabado({ x0: -7, x1: 9, y0: -8, y1: 9, n: 360, semilla: 71, largo: 0.7, flujo: flujoTronco });
/* Cráneo: el pelo corre de la trufa hacia la nuca. */
const GRABADO_CRANEO = grabado({ x0: -7, x1: 6, y0: -20, y1: -7, n: 170, semilla: 5, largo: 0.6,
  flujo: (x, y) => Math.atan2(y + 9, x + 9) });
/* Muslo cercano: el pelo baja por la pierna. */
const GRABADO_MUSLO = grabado({ x0: 2.6, x1: 9.4, y0: 3.6, y1: 13.6, n: 155, semilla: 41, largo: 0.7,
  flujo: (x) => Math.PI / 2 - 0.35 + (x - 6) * 0.08 });

const MUSLO_CERCA = 'M 4,3.8 C 7,3.3 9,5.5 8.5,8 C 8,10 6,11.3 5.8,13.4 C 5.4,14 4.1,13.9 3.7,12.9 C 3.2,11 3,9.3 3.2,7.8 C 3.4,6.2 4.4,5 4,3.8 Z';

/* Brújula de bolsillo: aro de suspensión, limbo claro y aguja bicolor.
   El norte es un trazo, no una fuente dependiente del dispositivo. */
function Brujula() {
  return <g className="zc-brujula" role="img" aria-label="Brújula de bolsillo">
    <path d="M -0.65,-2.7 V -3.3 Q 0,-4.2 0.65,-3.3 V -2.7" fill="none" stroke="#72502e" strokeWidth="0.38" />
    <circle cy="0.2" r="3.05" fill="#72502e" stroke={INK} strokeWidth="0.2" />
    <circle r="2.95" fill="#c6a368" stroke="#f2d79b" strokeWidth="0.2" />
    <circle r="2.48" fill="#fff5db" stroke="#72502e" strokeWidth="0.2" />
    <path d="M -0.4,-1.55 v -0.65 l 0.8,0.65 v -0.65 M -2.15,0 h 0.45 M 1.7,0 h 0.45 M 0,1.75 v 0.45" fill="none" stroke={P.cuerpoSombra} strokeWidth="0.2" strokeLinecap="round" />
    <path d="M -1.5,-1.5 l 0.25,0.25 M 1.5,-1.5 l -0.25,0.25 M -1.5,1.5 l 0.25,-0.25 M 1.5,1.5 l -0.25,-0.25" stroke="#947346" strokeWidth="0.15" />
    <g transform="rotate(30)">
      <path d="M 0,-1.6 L 0.65,0 0,0.3 -0.65,0 Z" fill="#ab3f38" />
      <path d="M 0,1.6 L -0.65,0 0,-0.3 0.65,0 Z" fill="#343f40" />
    </g>
    <circle r="0.25" fill="#f2d79b" stroke={INK} strokeWidth="0.12" />
  </g>;
}

/* Aro delante del ojo cercano; el mango termina en la palma alzada. */
function Lupa() {
  return <g className="zc-lupa" aria-hidden="true">
    <path d="M -5.5,-5 L -2.7,-11.4" stroke={INK} strokeWidth="1.05" strokeLinecap="round" />
    <path d="M -5.5,-5 L -2.7,-11.4" stroke="#7a5431" strokeWidth="0.72" strokeLinecap="round" />
    <circle cx="-1.8" cy="-13.7" r="2.35" fill="#e6f0ea" fillOpacity="0.16" stroke={INK} strokeWidth="0.95" />
    <circle cx="-1.8" cy="-13.7" r="2.35" fill="none" stroke="#b58a45" strokeWidth="0.6" />
    <path d="M -3.2,-14.6 Q -2.8,-15.55 -1.8,-15.75" fill="none" stroke="#fffaf0" strokeWidth="0.32" strokeLinecap="round" opacity="0.85" />
  </g>;
}

/* LA MANITO rosada de cinco deditos (la lámina: manos desnudas, garritas). */
function Mano({ cx, cy, s = 1, rot = 0, abierta = false }) {
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rot})`}>
      {abierta ? <g transform="rotate(180)">
        <path d="M -0.8,1.4 Q -1.8,0.8 -1.7,-0.4 L -2.5,-1.5 Q -2.8,-2.1 -2.3,-2.2 Q -1.9,-2.2 -1.3,-1.2 L -1.8,-3.4 Q -1.9,-4 -1.4,-4 Q -1,-4 -0.6,-1.7 L -0.8,-4.2 Q -0.7,-4.8 -0.3,-4.5 L 0.1,-1.8 L 0.4,-4 Q 0.6,-4.6 1,-4.2 L 0.9,-1.6 L 1.5,-3.2 Q 1.8,-3.6 2.1,-3.2 L 1.7,-0.6 Q 1.6,0.9 0.7,1.4 Z" fill={P.piel} stroke={P.pielSombra} strokeWidth="0.16" />
        <path d="M -0.8,0.6 Q -1,-0.2 -0.5,-0.8 M 0.1,0.5 Q 0.8,0.1 0.7,-0.7" fill="none" stroke={P.pielSombra} strokeWidth="0.13" />
      </g> : <>
      <path d="M -0.7,-1.65 Q -1.4,-0.7 -1.3,0.5 Q -0.8,1.7 0.6,1.2 Q 1.5,0.5 0.7,-1.65 Z" fill={P.piel} stroke={P.pielSombra} strokeWidth="0.15" />
      {/* Solo la brújula: el lápiz del hero no vuelve (decisión del operador). */}
      {s > 0 ? <g transform="translate(-0.6 2.2) rotate(-36)"><Brujula /></g> : null}
      <g fill="none" stroke={P.pielSombra} strokeWidth="0.65" strokeLinecap="round">
        <path d="M -1,-0.6 Q -0.1,-0.2 0.5,-0.6 M -1.1,0.05 Q -0.1,0.55 0.6,0.15 M -0.8,0.75 Q 0.1,1.1 0.8,0.6 M 0.8,-0.9 Q 1.2,-0.1 0.45,0.1" />
      </g>
      <path d="M -1,-0.7 Q -0.1,-0.3 0.45,-0.7 M -1.05,-0.05 Q -0.1,0.4 0.55,0.05 M -0.75,0.65 Q 0.1,0.95 0.75,0.5" fill="none" stroke={P.piel} strokeWidth="0.38" strokeLinecap="round" />
      <path d="M 0.45,-0.7 l 0.25,-0.15 M 0.55,0.05 l 0.26,-0.12 M 0.75,0.5 l 0.22,-0.12" stroke={P.garra} strokeWidth="0.17" strokeLinecap="round" />
      </>}
    </g>
  );
}

/* EL BRAZO (`s`: -1 izquierdo, +1 derecho): hombro→codo (hueso padre) y
   codo→manito (hueso hijo `.zc-antebrazo-*`). Pivotes en el hombro y en el
   codo; la mano cuelga abierta un poco adelante del cuerpo. */
function Brazo({ s, estado = undefined, libre = false, lupa = false }) {
  const cerca = s > 0;
  const lado = cerca ? 'r' : 'l';
  if (estado === 'escuchando') return (
    <g className={`crt-brazo-${lado}`} style={{ transform: 'none' }}>
      <path d={cerca
        ? 'M 0.5,-5.8 Q 3.5,-6.8 6.3,-10 L 8.1,-11.3 7.7,-14.5 8,-18.8 9.8,-19 C 10.5,-15 12,-11.5 10,-9.8 Q 7,-6 3,-4 L 1.5,-3.8 Z'
        : 'M -5.8,-5.7 Q -9,-5.9 -12,-8 Q -13.8,-9.5 -12,-12 L -10,-17.7 -8.4,-18.4 Q -8,-15 -9,-11 L -10,-9.7 Q -7,-10 -5,-8 Z'} fill={P.cuerpo} />
      <path d={cerca ? 'M 9,-17 Q 10,-13 9.6,-11 Q 8.4,-10 7.6,-10.2 M 8.8,-13 L 9.3,-11.8 M 6,-7 L 8,-9' : 'M -9.5,-16.5 Q -10.5,-13 -11.5,-10 Q -11,-8.6 -9.8,-8.8 M -10.5,-12 L -11,-10.7 M -9,-7.5 L -7.5,-7'} fill="none" stroke={P.brillo} strokeWidth="0.12" />
      <g className={`zc-antebrazo-${lado}`} style={{ transform: 'none' }}>
        <g transform={`translate(${cerca ? 9 : -9.2} ${cerca ? -19 : -18.2}) scale(${cerca ? -1 : 1} 1)`}>
          <path d="M -0.8,1.4 Q -1.8,0.4 -1.5,-1 L -1.1,-3.5 Q -0.8,-4.7 0,-4.4 Q 0.6,-4.2 0.3,-3.4 L -0.1,-1.6 0.6,-3.5 Q 1,-4.4 1.7,-3.9 L 2.4,-2.9 Q 2.7,-2.3 2.2,-2.1 L 1.3,-2.8 0.8,-1.2 1.9,-2.1 Q 2.6,-2.6 3,-1.8 L 3.2,-0.6 Q 3.2,0 2.7,-0.1 L 2.3,-1 1.2,0.1 Q 0.8,1.4 -0.8,1.4 Z" fill={P.piel} stroke={P.pielSombra} strokeWidth="0.16" />
          <path d="M -0.8,-0.8 Q -0.5,0 0,0.5 M -0.5,-3.7 L 0,-3.6 M 1.3,-3.5 L 1.8,-3 M 2.4,-1.7 L 2.6,-1.2" fill="none" stroke={P.pielSombra} strokeWidth="0.14" />
        </g>
      </g>
    </g>
  );
  if (lupa && !cerca) return <g className="crt-brazo-l" style={{ transform: 'none' }}>
    <path d="M -5,-6 Q -8,-6.5 -8.8,-3.1 Q -9.3,-0.7 -6.9,-0.8 Q -4.5,-1 -4.6,-4.6 L -6.2,-5.2 Q -6.7,-2.2 -7,-3.4 Q -7.3,-4.5 -5,-6 Z" fill={P.cuerpo} />
    <g className="zc-antebrazo-l" style={{ transform: 'none' }}>
      <Lupa />
      <Mano cx={-5.5} cy={-5} s={0} rot={25} />
    </g>
  </g>;
  // Corrección de alcance para el brazo que ahora cruza el pecho.
  const alcance = cerca ? { pensando: [25, 105] }[estado] : null;
  return (
    <g className={`crt-brazo-${lado}`} style={{ transformBox: 'view-box', transformOrigin: cerca ? '1.4px -4.8px' : '-5.5px -5.8px', transform: alcance ? `rotate(${alcance[0]}deg)` : undefined }}>
      <path d={cerca
        ? 'M 0.5,-5.8 C 2.5,-6.3 4.6,-4.6 5.0,-2.8 C 5.5,-1.2 4.6,0.4 3.0,1.1 L 1.6,-0.6 C 2.8,-1.7 1.9,-3.4 0.5,-5.8 Z'
        : 'M -4.6,-5.8 C -7.0,-6.0 -7.6,-3.5 -8.3,-1.7 Q -9.2,-0.8 -10.1,-1.5 L -11.2,-3.0 C -9.4,-3.0 -9.4,-4.4 -8.2,-6.3 Q -6.5,-7.7 -4.6,-5.8 Z'}
        fill={P.cuerpo} />
      <path d={cerca
        ? 'M 1.5,-5.0 q 1.3,0.7 1.9,1.8 M 2.0,-4.1 l 0.8,1.0 M 3.3,-3.8 l 0.5,1.1 M 2.9,-2.4 l 0.3,0.9 M 4.2,-2.2 q 0.1,1.2 -0.7,1.8'
        : 'M -6.1,-5.9 l -0.8,0.7 M -7.0,-5.0 l -0.5,1.0 M -7.8,-3.8 l -0.5,0.9 M -8.6,-2.8 l -0.9,0.5'}
        fill="none" stroke={P.brillo} strokeWidth="0.14" opacity="0.8" />
      <g className={`zc-antebrazo-${lado}`} style={{ transformBox: 'view-box', transformOrigin: cerca ? '3.3px 0.2px' : '-10px -2px', transform: alcance ? `rotate(${alcance[1]}deg)` : undefined }}>
        {lupa && !cerca && <Lupa />}
        <Mano cx={cerca ? -0.9 : -11.1} cy={cerca ? 4.2 : -3.4} s={libre ? 0 : s} rot={cerca ? 36 : 130} />
        <path d={cerca
          ? 'M 3.0,-0.8 C 4.6,-1.3 5.0,0.4 3.8,1.6 C 2.5,2.9 1.5,3.5 0.1,4.1 L -0.2,3.7 -0.6,4.0 -0.8,3.4 -1.1,3.6 -1.3,2.7 C 0.2,1.6 1.5,0.8 3.0,-0.8 Z'
          : 'M -8.9,-2.3 C -9.0,-0.9 -10.4,-0.6 -11.4,-1.8 L -12.0,-2.8 -11.5,-2.9 -11.4,-3.4 -10.9,-3.3 -10.7,-3.8 Z'}
          fill={P.cuerpo} />
        <path d={cerca
          ? 'M 3.2,0.1 l -0.6,0.9 M 3.5,1.0 l -0.8,0.7 M 2.2,1.1 l -0.7,0.8 M 2.0,2.1 l -0.9,0.6 M 0.9,2.0 l -0.8,0.8 M 0.7,3.0 l -0.8,0.5'
          : 'M -10.1,-1.7 l -0.8,-0.8 M -10.8,-1.7 l -0.7,-0.8'}
          fill="none" stroke={P.brillo} strokeWidth="0.065" opacity="0.7" />
      </g>
    </g>
  );
}

/* LA PIERNA (`s`: -1 izquierda, +1 derecha): muslo macizo desde la cadera,
   rodilla que pliega (grupo canilla) y PIE PLANTÍGRADO desnudo de deditos
   largos, apuntando hacia afuera. Cada tramo es un hueso con su pivote. */
function Pierna({ s, masa }) {
  const x = (v) => (s * v).toFixed(2);
  const lado = s < 0 ? 'i' : 'd';
  return (
    <g className={`zc-pierna-${lado}`} style={{ transformBox: 'fill-box', transformOrigin: s < 0 ? '79% 4%' : '21% 4%' }}>
      <g transform={`translate(${-s * 1.65} 0)`}>
      {/* El anca cercana se extiende por delante del flanco, hasta la rodilla. */}
      <path d={s > 0
        ? MUSLO_CERCA
        : 'M -3.9,6.6 C -6.6,7.0 -7.3,8.8 -6.5,10.5 C -6.1,11.8 -4.6,12.8 -3.4,12.9 C -2.5,12.5 -2.4,11.2 -3.1,10.1 C -3.7,9.0 -2.6,7.5 -3.9,6.6 Z'}
        fill={`url(#${masa})`} />
      <path d={s > 0
        ? 'M 4.3,5.1 C 2.9,7.1 3.0,9.2 4.1,10.8 M 8.7,7.3 Q 9.0,9.0 7.6,10.3'
        : 'M -6.4,8.0 Q -7.1,9.9 -5.1,11.5'}
        fill="none" stroke={P.cuerpoSombra} strokeWidth="0.22" />
      <path d={s > 0
        ? 'M 4.9,4.9 q 1.0,-0.2 1.8,0.4 M 4.3,6.0 l -0.2,1.0 M 5.4,5.8 l 0.8,0.5 M 6.8,5.9 l 0.9,0.7 M 7.9,6.8 q 0.6,0.8 0.3,1.5 M 4.1,7.6 l 0.1,1.2 M 5.2,7.0 l 0.2,1.2 M 6.3,7.3 l 0.1,1.2 M 7.4,8.0 l -0.3,1.2 M 4.5,9.2 l 0.4,1.0 M 5.5,9.1 l 0.3,1.1 M 6.5,9.5 l -0.2,1.0 M 4.8,11.0 l 0.3,1.0 M 5.8,11.0 l -0.2,1.0 M 5.2,12.3 l 0.1,0.7'
        : 'M -5.6,8.0 l -0.2,1.0 M -4.7,8.1 l 0.1,1.0 M -5.6,9.6 l 0.5,0.9 M -4.5,9.7 l 0.4,1.0 M -4.5,11.2 l 0.5,0.7'}
        fill="none" stroke={P.brillo} strokeWidth="0.065" opacity="0.75" aria-hidden="true" />
      {s > 0 && <>
        <clipPath id={`${masa}-muslo`}><path d={MUSLO_CERCA} /></clipPath>
        <path d={GRABADO_MUSLO} clipPath={`url(#${masa}-muslo)`} fill="none" stroke={P.cuerpoSombra}
          strokeWidth="0.09" strokeLinecap="round" opacity="0.7" aria-hidden="true" />
      </>}
      {/* canilla + pie (hueso hijo: pliega en la rodilla) */}
      <g className={`zc-canilla-${lado}`} style={{ transformBox: 'fill-box', transformOrigin: s < 0 ? '73% 24%' : '27% 24%' }}>
        <path d={`M ${x(3.6)},11.6 C ${x(4.6)},11.1 ${x(5.8)},11.8 ${x(5.7)},12.8 C ${x(5.6)},13.8 ${x(5)},14.5 ${x(5.65)},15.55 Q ${x(4.5)},16 ${x(3.35)},15.7 C ${x(3.8)},14.5 ${x(3.5)},13.8 ${x(3.25)},13 C ${x(3)},12.4 ${x(3.1)},12 ${x(3.6)},11.6 Z`}
          fill={P.cuerpo} stroke={P.cuerpoSombra} strokeWidth="0.2" strokeLinejoin="round" />
        <path d={`M ${x(4.1)},12 l ${x(0.65)},0.7 M ${x(4.7)},12 l ${x(0.55)},0.55 M ${x(4.5)},13.4 l ${x(-0.2)},0.9 M ${x(4.9)},13.6 l ${x(-0.15)},0.8 M ${x(4.15)},14.4 l ${x(-0.1)},0.8 M ${x(4.85)},14.7 l ${x(0.15)},0.5`}
          fill="none" stroke={P.brillo} strokeWidth="0.07" strokeLinecap="round" />
        <g className={`zc-pie-${lado}`} style={{ transformBox: 'fill-box', transformOrigin: s < 0 ? '63% 25%' : '37% 25%' }}>
          {/* EL PIE de la lámina: planta rosada, cuatro dedos largos abiertos
              con garra oscura y el pulgar oponible hacia atrás (sin garra). */}
          <path d={`M ${x(3.65)},15.1 Q ${x(4.6)},14.8 ${x(5.6)},15.2 L ${x(6.3)},15.9 L ${x(8.4)},16.2 Q ${x(9)},16.4 ${x(8.7)},16.8 Q ${x(8.5)},17 ${x(7.9)},16.8 L ${x(6.15)},16.6 L ${x(7.6)},17.4 Q ${x(8.1)},17.8 ${x(7.7)},18.1 Q ${x(7.4)},18.3 ${x(7.05)},17.9 L ${x(5.55)},16.95 L ${x(6.05)},18.05 Q ${x(6.2)},18.6 ${x(5.7)},18.6 Q ${x(5.3)},18.6 ${x(5.15)},18.1 L ${x(4.65)},17.1 L ${x(4.55)},18 Q ${x(4.5)},18.5 ${x(4.05)},18.4 Q ${x(3.7)},18.2 ${x(3.85)},17.6 L ${x(3.85)},16.7 L ${x(2.65)},17.15 Q ${x(2.1)},17.3 ${x(2.1)},16.85 Q ${x(2.1)},16.5 ${x(2.7)},16.2 L ${x(3.3)},15.85 Z`}
            fill={P.piel} stroke={INK} strokeWidth="0.2" strokeLinejoin="round" />
          <path d={`M ${x(4)},15.65 Q ${x(4.9)},15.4 ${x(5.5)},16 M ${x(7.5)},16.25 l ${x(-0.1)},0.45 M ${x(6.9)},17.15 l ${x(-0.3)},0.4 M ${x(5.2)},17.65 l ${x(0.5)},-0.15 M ${x(3.9)},17.55 l ${x(0.45)},0.05 M ${x(3)},16.25 l ${x(0.2)},0.4`}
            fill="none" stroke={P.pielSombra} strokeWidth="0.16" strokeLinecap="round" aria-hidden="true" />
          <path d={`M ${x(8.45)},16.3 Q ${x(9.2)},16.45 ${x(9.15)},17.05 L ${x(8.55)},16.8 Z M ${x(7.7)},17.55 Q ${x(8.35)},17.9 ${x(8)},18.5 L ${x(7.55)},18 Z M ${x(5.9)},18.1 Q ${x(6.4)},18.6 ${x(5.9)},19 L ${x(5.65)},18.5 Z M ${x(4.4)},18 Q ${x(4.65)},18.65 ${x(4.05)},18.8 L ${x(4)},18.3 Z`}
            fill={P.garra} aria-hidden="true" />
        </g>
      </g>
      </g>
    </g>
  );
}

/* LA OREJA (`s`): grande, redonda y DESNUDA — piel rosada con el hueco más
   hondo y el borde de pelaje. Grupo propio: gira sola y se agranda al
   escuchar. Pivote en su base (donde nace del cráneo). */
function Oreja({ s, orejaG }) {
  const cx = s * 5.6;
  const lado = s < 0 ? 'i' : 'd';
  return (
    <g className={`zc-oreja-${lado}`} style={{ transformBox: 'fill-box', transformOrigin: s < 0 ? '64% 89%' : '36% 89%' }}>
      <g transform={`translate(${cx * 0.12} -1.86) scale(0.88 0.88)`}>
      <path d={`M ${cx-s*1.5},-15.5 C ${cx-s*3.7},-17.1 ${cx-s*2.7},-21.35 ${cx-s*0.9},-21.45 C ${cx+s*1.5},-21.5 ${cx+s*3.6},-19.7 ${cx+s*2.6},-17.35 Q ${cx+s*1.7},-15.5 ${cx-s*1.5},-15.5 Z`}
        fill={`url(#${orejaG})`} stroke={INK} strokeWidth="0.4" />
      {/* el hueco del pabellón (más hondo hacia adentro) */}
      <ellipse cx={cx - s * 0.35} cy="-17.55" rx="2.05" ry="2.45" fill={P.orejaHondo} opacity="0.55"
        transform={`rotate(${s * 14} ${cx} -17.55)`} aria-hidden="true" />
      <ellipse cx={cx - s * 0.55} cy="-17.3" rx="1.25" ry="1.7" fill={P.orejaBorde} opacity="0.35"
        transform={`rotate(${s * 16} ${cx} -17.3)`} aria-hidden="true" />
      {/* el pliegue del borde superior que agarra la luz */}
      <path d={`M ${(cx - s * 2.2).toFixed(2)},-19.6 C ${(cx - s * 0.6).toFixed(2)},-20.9 ${(cx + s * 1.4).toFixed(2)},-20.6 ${(cx + s * 2.4).toFixed(2)},-19.3`}
        fill="none" stroke={P.orejaLuz} strokeWidth="0.45" strokeLinecap="round" opacity="0.8" aria-hidden="true" />
      <path d={`M ${cx-s*1.4},-16.5 C ${cx-s*2.0},-18.9 ${cx+s*0.5},-19.5 ${cx+s*1.6},-18.7 M ${cx-s*1.0},-16.5 Q ${cx+s*0.7},-18.6 ${cx+s*1.8},-17.5`}
        fill="none" stroke={P.orejaLuz} strokeWidth="0.22" opacity="0.8" />
      <path d={`M ${cx-s*1.2},-15.6 l ${s*0.15},-0.5 m ${s*0.3},0.5 l ${s*0.1},-0.6 m ${s*0.3},0.5 l 0,-0.5`}
        fill="none" stroke={P.cuerpoSombra} strokeWidth="0.09" aria-hidden="true" />
      </g>
    </g>
  );
}

/* LA CRÍA: la madre en pequeño — cabecita oscura con la máscara pálida, las
   orejas grandes para su cabeza, ojos de botón y la manito que agarra. */
function Cria({ x, y, s = 1, delay = 0, craneo, cara, orejaG, vivo, perfil = false, montada = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={vivo ? 'zc-cria' : 'zc-cria zc-cria-quieta'} style={{ transformBox: 'fill-box', transformOrigin: 'center bottom', animationDelay: `${delay}s` }}>
        {!montada && <g>
        <ellipse cx="-1.5" cy="2.1" rx="0.75" ry="0.5" fill={P.piel} stroke={INK} strokeWidth="0.3" />
        <ellipse cx="1.5" cy="2.1" rx="0.75" ry="0.5" fill={P.piel} stroke={INK} strokeWidth="0.3" />
        </g>}
        {perfil ? <g>
          <path d="M -2,-1.5 C -1,-3 1,-2.5 1.8,-0.8 L 3.5,0.9 Q 3.8,1.5 2.6,1.8 L 0.6,2.1 C -1.3,2.5 -2.9,0.3 -2,-1.5 Z" fill={`url(#${craneo})`} stroke={INK} strokeWidth="0.4" />
          <path d="M -1,-2 Q 0.6,-2.2 1.7,-0.5 L 3.5,1 Q 3.1,2 0.6,2 Q -1.8,1.3 -1,-2 Z" fill={`url(#${cara})`} />
          <ellipse cx="-1.6" cy="-1.6" rx="1.1" ry="1.3" fill={`url(#${orejaG})`} stroke={INK} strokeWidth="0.35" />
          <path d="M -0.1,-0.4 Q 1,-1 1.5,0.2 Q 0.7,0.8 -0.1,-0.4" fill={P.mascara} />
          <circle cx="0.7" cy="-0.1" r="0.46" fill={P.pupila} />
          <circle cx="0.85" cy="-0.28" r="0.14" fill="#fff" />
          <ellipse cx="3.3" cy="1" rx="0.43" ry="0.32" fill={P.trufa} stroke={INK} strokeWidth="0.16" />
        </g> : <g>
        {/* orejitas */}
        <circle cx="-1.95" cy="-1.95" r="0.95" fill={`url(#${orejaG})`} stroke={INK} strokeWidth="0.42" />
        <circle cx="1.95" cy="-1.95" r="0.95" fill={`url(#${orejaG})`} stroke={INK} strokeWidth="0.42" />
        {/* cabecita */}
        <path d="M 0,-2.5 C 1.6,-2.5 2.4,-1.4 2.3,-0.3 Q 2,0.8 1,2 L 0.5,3.1 Q 0,3.5 -0.5,3.1 L -1,2 Q -2,0.8 -2.3,-0.3 C -2.4,-1.4 -1.6,-2.5 0,-2.5 Z"
          fill={`url(#${craneo})`} stroke={INK} strokeWidth="0.5" />
        <path d="M 0,-2.35 Q 0.5,-1.4 1.9,-1.5 Q 2.3,-0.5 1.5,1 Q 0.8,2 0.45,3 Q 0,3.4 -0.45,3 Q -0.8,2 -1.5,1 Q -2.3,-0.5 -1.9,-1.5 Q -0.5,-1.4 0,-2.35 Z" fill={`url(#${cara})`} aria-hidden="true" />
        <path d="M -0.3,-1.9 L 0,-0.9 0.3,-1.9 M -1.9,0.5 L -1.3,0.8 M 1.9,0.5 L 1.3,0.8" fill="none" stroke={P.cremaSombra} strokeWidth="0.12" />
        {/* antifaz chiquito */}
        <path d="M -2,-1.2 Q -1.2,-0.6 -0.5,-0.6 L -0.35,0.2 Q -1.3,0.5 -1.6,-0.4 Z M 2,-1.2 Q 1.2,-0.6 0.5,-0.6 L 0.35,0.2 Q 1.3,0.5 1.6,-0.4 Z" fill={P.mascara} opacity="0.7" aria-hidden="true" />
        <path d="M -0.35,-0.5 L -0.7,1.1 -0.35,2.9 Q 0,3.3 0.35,2.9 L 0.7,1.1 0.35,-0.5 Z" fill={`url(#${cara})`} />
        <path d="M -0.55,2.8 Q 0,3.2 0.55,2.8" fill="none" stroke={P.cremaSombra} strokeWidth="0.12" />
        {/* ojitos de botón */}
        <circle cx="-0.85" cy="-0.2" r="0.5" fill={P.pupila} />
        <circle cx="0.85" cy="-0.2" r="0.5" fill={P.pupila} />
        <circle cx="-1.0" cy="-0.38" r="0.16" fill="#fff" />
        <circle cx="0.7" cy="-0.38" r="0.16" fill="#fff" />
        {/* trufa */}
        <ellipse cx="0" cy="2.7" rx="0.42" ry="0.3" fill={P.trufa} stroke={P.trufaSombra} strokeWidth="0.18" />
        </g>}
      </g>
    </g>
  );
}

/* Five loads in depth order. Coordinates are contact points on the dorsal fur. */
const CARGAS = [
  { id: 'escapula', x: -6.8, y: -12.1, s: 1.05, giro: -18, lado: 1, alto: -3.3, fase: -0.66 },
  { id: 'asomada', x: -0.9, y: -12.5, s: 0.9, giro: 12, lado: 1, alto: -2.4, fase: -0.58 },
  { id: 'atras', x: 8.3, y: -1.08e1, s: 1.02, giro: -12, lado: 1, alto: -3, fase: -0.52 },
  { id: 'abrazada', x: 1.8, y: -8.4, s: 1.23, giro: -24, lado: 1, alto: -3.5, fase: -0.62 },
  { id: 'anca', x: 13.1, y: -5.8, s: 1.08, giro: 16, lado: -1, alto: -2.7, fase: -0.47 },
];

function CriasMontadas({ craneo, cara, orejaG, dorso }) {
  return <g className="zc-crias" aria-hidden="true">
    {CARGAS.map(({ id, x, y, s, giro, lado, alto, fase }) => (
      <g key={id} data-cria={id} transform={`translate(${x} ${y}) scale(${s})`}>
        {/* The compressed fur belongs to the contact, not to the spring. */}
        <path d="M -3.8,0 Q 0,1.5 3.8,0 L 4,3 Q 0,4 -4,2.5 Z" fill={`url(#${dorso})`} />
        <path d="M -4,-0.5 Q -3,2 -1,2.7 M -4.3,0.5 Q -3.4,2.9 -1.8,3.1 M 4,-0.4 Q 3.4,2 1.6,2.7 M 4.4,0.8 Q 3.3,3 2.2,3.2" fill="none" stroke={P.brillo} strokeWidth="0.26" opacity="0.8" />
        <path className="zc-cria-hundimiento" d="M -3.5,-0.6 Q -2,1.4 0,1.2 Q 2.7,1.4 3.6,-0.8 Q 2.3,2.6 0,2.3 Q -2.7,2.2 -3.5,-0.6 Z" fill={P.cuerpoSombra} opacity="0.8" />
        <g transform={`scale(${lado} 1)`}>
          <path className="zc-cria-cola" d="M 1,-0.5 C 5,0 5,5 2.8,5.2 C 0.7,5.4 0.9,2.5 2.8,2.5 C 4.6,2.5 4,4.1 2.8,3.8" fill="none" stroke={INK} strokeWidth="0.85" strokeLinecap="round" />
          <path d="M 1,-0.5 C 5,0 5,5 2.8,5.2 C 0.7,5.4 0.9,2.5 2.8,2.5 C 4.6,2.5 4,4.1 2.8,3.8" fill="none" stroke={P.piel} strokeWidth="0.48" />
          <g className="zc-cria-resorte" style={{ '--zc-cria-fase': `${fase}s`, '--zc-cria-giro': `${giro / 10}deg` }}>
            <path d="M -1,-4 C 2,-5 3.2,-2 2.5,0.8 Q 1,2 -1,0.8 Q -3,-1 -1,-4 Z" fill={`url(#${craneo})`} stroke={INK} strokeWidth="0.32" />
            <path d="M 1,-2 Q 2,-0.5 1,0.5 M 1.5,-2.6 Q 2.7,-1 2,0" fill="none" stroke={P.brillo} strokeWidth="0.18" />
            <g transform={`translate(-0.5 ${alto}) rotate(${giro})`}>
              <Cria x={0} y={0} s={0.9} craneo={craneo} cara={cara} orejaG={orejaG} vivo={false} montada perfil={id === 'atras' || id === 'anca'} />
            </g>
          </g>
          {/* Forearms overlap the delayed torso; the closed fingers stay planted. */}
          <path className="zc-cria-brazos" d="M -1.7,-2 Q -2.8,-1.5 -2.6,1 M 1.5,-1.6 Q 2.8,-0.5 2,1.4" fill="none" stroke={P.cuerpoSombra} strokeWidth="1.1" strokeLinecap="round" />
          <g className="zc-cria-agarre" fill={P.piel} stroke={INK} strokeWidth="0.18">
            <path d="M -3.2,0.6 Q -3.7,1.2 -3.1,1.6 L -2.1,1.7 Q -1.7,1.4 -2,1 L -2.6,0.7 Z M 1.5,1 Q 0.9,1.8 1.5,2 L 2.6,1.7 Q 3,1.1 2.4,0.9 Z" />
            <path d="M -2.9,0.9 l 0,0.5 m 0.4,-0.4 l 0,0.5 M 1.7,1.2 l 0.1,0.5 m 0.3,-0.6 l 0.1,0.4" fill="none" />
          </g>
          <path d="M -3.5,0 l 0.7,1.1 -0.1,-1 0.7,1.2 M 1.5,0.3 l 0.4,1 0.3,-1.1 0.2,0.8 M 2.1,3.1 l 0.6,0.6 0.7,-0.6" fill="none" stroke={P.brillo} strokeWidth="0.22" />
        </g>
      </g>
    ))}
  </g>;
}

export function ZariguyaCompaiRig({
  size = 64,
  className = '',
  inline = false,
  animated = true,
  reducedMotion = false,
  title = 'Zarigüeya (chucha)',
  /* La pose de interacción se conserva; camina usa el cuerpo cuadrúpedo. */
  pose = 'anda',
  animo = 'sereno',
  energia = 1,
  clima = null,
  enso = 'neutro',
  /* Lip-sync transversal (useLipSync → 'V1'..'V4'). */
  visema = null,
  /* TANATOSIS (opt-in): se hace la muerta — se desploma de lado, ojos
     cerrados, lengua afuera… y la cola sigue enroscándose sola. */
  tanatosis = false,
  /* HUSMEA (opt-in): la trufa lee el aire, las vibrisas tiemblan. */
  husmea = false,
  /* CRÍAS (opt-in): las crías se asoman por los hombros y la coronilla. */
  crias = false,
  /* VIDA PROPIA (idle-cerebro): default ON. Repertorio SSOT 'zariguya'
     (perfilesConducta.js): husmea/tanatosis/reposo/colaEnrosca/lavaCara/
     acomodaCrias/mirausted. `vidaForzada` fuerza un momento (vitrina). */
  vida = true,
  vidaForzada = null,
  tier = undefined,
  lineBoil = false,
  poder = false,
  mundoId = null,
  conductaContexto = undefined,
  onConducta = undefined,
  style: estiloHost = undefined,
  ...rest
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const glow = `crt-glow-${uid}`;
  const blur = `crt-blur-${uid}`;
  const boil = `crt-boil-${uid}`;
  const dorso = `zc-dorso-${uid}`;
  const craneo = `zc-craneo-${uid}`;
  const masa = `zc-masa-${uid}`;
  const panza = `zc-panza-${uid}`;
  const cara = `zc-cara-${uid}`;
  const mascara = `zc-mascara-${uid}`;
  const orejaG = `zc-oreja-${uid}`;
  const trufaG = `zc-trufa-${uid}`;
  const colaG = `zc-cola-${uid}`;
  const sombraG = `zc-sombra-${uid}`;
  const grano = `zc-grano-${uid}`;
  const pincel = `zc-pincel-${uid}`;
  const vivo = animated && !reducedMotion;

  // Cable de conducta: opcional para no alterar vitrinas existentes. La
  // conducta se calcula fuera del arte y el host decide cómo presentar voz.
  const conducta = useMemo(() => (mundoId
    ? conductaZariguya({ mundo: mundoId, ...(conductaContexto || {}) })
    : null), [mundoId, conductaContexto]);
  useEffect(() => {
    if (conducta && typeof onConducta === 'function') onConducta(conducta);
  }, [conducta, onConducta]);

  // ═══ VIDA PROPIA (idle-cerebro + ritmo propio + mirada).
  const raizRef = useRef(null);
  const ritmoPropio = useRitmoPropio();
  const enBase = pose === 'anda' && !visema && !tanatosis && !husmea && !crias;
  const activoVida = vida && vivo && tier !== 'bajo';
  const momentoNatural = useVidaIdle(ZARIGUYA_SLUG, activoVida && enBase && !vidaForzada);
  const momento = (enBase && vidaForzada) ? vidaForzada : momentoNatural;
  const tanatosisFx = tanatosis || momento === 'tanatosis';
  const criasFx = crias || momento === 'acomodaCrias' || rest['data-agt-estado'] === 'cargaCrias';
  const poseFx = momento === 'reposo' ? 'reposo' : pose;
  const estado = rest['data-agt-estado'];
  // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish -- identificadores del contrato de estados
  const interactua = Boolean(visema) || ['respondiendo', 'speaking', 'señala', 'senala', 'sostiene', 'mirausted', 'invita'].includes(estado) || ['señala', 'sostiene', 'mirausted'].includes(poseFx) || momento === 'mirausted';
  const cuadrupeda = !interactua && !tanatosisFx && (poseFx === 'camina' || ['caminando', 'atraviesa', 'cargaCrias'].includes(estado) || criasFx);
  // La carga solo se representa sobre el lomo horizontal. La interacción
  // tiene prioridad, pero conserva la solicitud para retomar el transporte.
  // Un solo canal para el CSS: la prop forzada se publica como el momento.
  const vidaFx = tanatosis ? 'tanatosis' : husmea ? 'husmea' : crias ? 'acomodaCrias' : momento;
  // Los momentos de cuidado no sustituyen una caminata ni una interacción.
  const momentoCuidado = !interactua && !tanatosisFx && poseFx !== 'camina'
    && !['caminando', 'atraviesa', 'cargaCrias'].includes(estado)
    && ['acomodaCrias', 'lavaCara'].includes(momento) ? momento : null;
  useMiradaUsted(raizRef, activoVida && !tanatosisFx && !momentoCuidado);
  // Ver-lupa: husmear es «ver» en el núcleo de gestos; solo dibuja la lupa.
  const veLupa = vidaFx === 'husmea' && !tanatosisFx;

  // CLIMA → cuerpo (determinista): tinte + opacidad.
  const cuerpoClima = cuerpoDeClima(clima, { enso: /** @type {any} */ (enso), tier, perfil: PERFIL_ZARIGUYA });
  const estiloClima = (cuerpoClima.tinte || cuerpoClima.opacidad < 1)
    ? { filter: cuerpoClima.tinte || undefined, opacity: cuerpoClima.opacidad < 1 ? cuerpoClima.opacidad : undefined }
    : undefined;
  const auraOp = Math.max(0.08, Math.min(0.22, 0.1 + 0.12 * (energia ?? 1)));

  const defs = (
    <defs>
      <CreatureFilters glow={glow} blur={blur} />
      {/* DORSO→VIENTRE del tronco: la luz fría cae de arriba. */}
      <linearGradient id={dorso} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={P.cuerpoLuz} />
        <stop offset="35%" stopColor={P.cuerpo} />
        <stop offset="78%" stopColor={P.cuerpoSombra} />
        <stop offset="100%" stopColor={P.umbra} />
      </linearGradient>
      <clipPath id={`${dorso}-limite`}><path d={TRONCO} /></clipPath>
      <clipPath id={`${craneo}-limite`}><path d={CRANEO} /></clipPath>
      {/* CRÁNEO: la luz entra por la coronilla, los carrillos en penumbra. */}
      <radialGradient id={craneo} cx="50%" cy="22%" r="86%">
        <stop offset="0%" stopColor={P.brillo} />
        <stop offset="40%" stopColor={P.cuerpoLuz} />
        <stop offset="100%" stopColor={P.cuerpoSombra} />
      </radialGradient>
      <linearGradient id={`${cara}-garganta`} gradientUnits="userSpaceOnUse" x1="-3" y1="-9" x2="0" y2="1">
        <stop offset="0" stopColor={P.crema} />
        <stop offset="0.42" stopColor={P.cremaSombra} stopOpacity="0.9" />
        <stop offset="1" stopColor={P.cuerpoLuz} stopOpacity="0" />
      </linearGradient>
      {/* MASAS (muslos): mismo pelaje, luz al tercio alto. */}
      <radialGradient id={masa} cx="42%" cy="28%" r="82%">
        <stop offset="0%" stopColor={P.cuerpoLuz} />
        <stop offset="55%" stopColor={P.cuerpo} />
        <stop offset="100%" stopColor={P.cuerpoSombra} />
      </radialGradient>
      {/* LA PANZA CREMA SE FUNDE: crema al centro, transparente al borde — es
          lanilla que asoma bajo el pelo de guardia, no un parche. */}
      <radialGradient id={panza} cx="50%" cy="45%" r="50%">
        <stop offset="0%" stopColor={P.cremaLuz} />
        <stop offset="28%" stopColor={P.crema} stopOpacity="0.95" />
        <stop offset="58%" stopColor={P.cremaSombra} stopOpacity="0.65" />
        <stop offset="82%" stopColor={P.cremaSombra} stopOpacity="0.22" />
        <stop offset="100%" stopColor={P.cremaSombra} stopOpacity="0" />
      </radialGradient>
      {/* LA CARA PÁLIDA: la máscara del marsupial, fundida en el borde. */}
      <radialGradient id={cara} cx="50%" cy="60%" r="68%">
        <stop offset="0%" stopColor={P.cremaLuz} />
        <stop offset="66%" stopColor={P.crema} />
        <stop offset="86%" stopColor={P.crema} stopOpacity="0.8" />
        <stop offset="100%" stopColor={P.crema} stopOpacity="0" />
      </radialGradient>
      {/* EL ANTIFAZ: parche oscuro que se difumina hacia el pelaje. */}
      <radialGradient id={mascara} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={P.mascara} stopOpacity="0.96" />
        <stop offset="72%" stopColor={P.mascara} stopOpacity="0.98" />
        <stop offset="100%" stopColor={P.mascara} stopOpacity="0" />
      </radialGradient>
      <filter id={`${mascara}-borde`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="0.2" />
      </filter>
      {/* OREJA desnuda: rosada al centro, pelaje al borde. */}
      <radialGradient id={orejaG} cx="48%" cy="46%" r="60%">
        <stop offset="0%" stopColor={P.orejaLuz} />
        <stop offset="60%" stopColor={P.oreja} />
        <stop offset="100%" stopColor={P.orejaBorde} />
      </radialGradient>
      <radialGradient id={trufaG} cx="40%" cy="30%" r="80%">
        <stop offset="0%" stopColor={P.trufaLuz} />
        <stop offset="60%" stopColor={P.trufa} />
        <stop offset="100%" stopColor={P.trufaSombra} />
      </radialGradient>
      <linearGradient id={colaG} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={P.colaLuz} />
        <stop offset="55%" stopColor={P.cola} />
        <stop offset="100%" stopColor={P.colaSombra} />
      </linearGradient>
      <radialGradient id={`${sombraG}-aura`}>
        <stop offset="0%" stopColor={auraDeBicho(ZARIGUYA_SLUG)} stopOpacity="0.5" />
        <stop offset="55%" stopColor={auraDeBicho(ZARIGUYA_SLUG)} stopOpacity="0.18" />
        <stop offset="100%" stopColor={auraDeBicho(ZARIGUYA_SLUG)} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={sombraG}>
        <stop offset="0%" stopColor="#140c06" stopOpacity="0.5" />
        <stop offset="70%" stopColor="#140c06" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#140c06" stopOpacity="0" />
      </radialGradient>
      {/* GRANO DE PELAJE — turbulencia compuesta DENTRO de la silueta (pelo
          de guardia denso, sin feDisplacementMap). Seed fija. */}
      <filter id={grano} x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="1.5 2.6" numOctaves="2" seed="11" result="ruido" />
        <feColorMatrix in="ruido" type="matrix"
          values="0 0 0 0 0.2  0 0 0 0 0.17  0 0 0 0 0.14  0 0 0 0.24 0" result="tinte" />
        <feComposite in="tinte" in2="SourceGraphic" operator="in" />
      </filter>
      {/* PINCEL — difumino chico para masas y parches (borde blando). */}
      <filter id={pincel} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="0.45" />
      </filter>
      {lineBoil && <LineBoilFilter id={boil} animated={vivo} />}
    </defs>
  );

  const propMundo = mundoId ? (
    <PropEnMano mundoId={mundoId} x={7.4} y={3.2} escala={0.6} ink={INK} animated={vivo} />
  ) : null;

  // Mandíbula propia: cada vocal conserva las comisuras y el morro largo.
  const apertura = { V1: 0.35, V2: 0.7, V3: 1.15, V4: 0.85 }[visema] || 0;
  const boca = (
    <g className="zc-mandibula" data-apertura={apertura}>
      <path d={`M -7.5,-9.35 Q -3.3,-8.7 1.7,-10.25 C 1.3,${-8.3 + apertura * 0.3} -4.3,${-7.3 + apertura * 0.3} -7.5,-9.35 Z`}
        fill={P.cuerpoSombra} stroke={P.cuerpoSombra} strokeWidth="0.22" strokeLinejoin="round" />
      <path d="M -6.7,-9.15 L -6.15,-9.1 -6.25,-8.55 Z M -5.95,-9.08 L -5.35,-9.06 -5.45,-8.18 Z M -5.1,-9.04 L -4.5,-9.08 -4.7,-8.55 Z M -4.2,-9.08 L -3.6,-9.13 -3.7,-8.57 Z M -3.25,-9.15 L -2.6,-9.26 -2.8,-8.66 Z M -2.25,-9.3 L -1.6,-9.45 -1.75,-8.76 Z M -1.25,-9.52 L -0.5,-9.72 -0.65,-8.72 Z M -0.1,-9.81 L 0.55,-10 0.2,-9.33 Z" fill={P.cremaLuz} />
      <path d="M -5.8,-8.5 l 0.6,0.1 -0.08,-0.38 Z M -4.7,-8.4 l 0.6,0.1 -0.16,-0.4 Z M -3.5,-8.4 l 0.65,-0.03 -0.28,-0.36 Z M -2.25,-8.6 l 0.6,-0.19 -0.38,-0.3 Z M -1.2,-8.9 l 0.58,-0.32 -0.5,-0.26 Z" fill={P.cremaLuz} />
      <path d={`M -4.7,${-8.4 + apertura * 0.2} Q -2.7,${-8.0 + apertura * 0.2} -0.9,-8.8 Q -3,-8.8 -4.7,${-8.4 + apertura * 0.2} Z`} fill={P.trufaSombra} />
      <path d="M -7.5,-9.35 Q -3.7,-7.0 1.7,-10.25 M 1.3,-10.6 q 0.6,-0.15 0.85,0.25" fill="none" stroke={P.cremaSombra} strokeWidth="0.22" strokeLinecap="round" />
    </g>
  );

  // La raíz queda en la grupa; la punta conserva su hueso independiente.
  const cola = cuadrupeda || tanatosisFx ? (
    <g className="zc-cola" style={{ transformBox: 'view-box', transformOrigin: '7px 7px' }}>
      <path d="M 6.7,7.2 C 10,8 10,12 13,14 Q 15,16 18,15.5" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M 6.7,7.2 C 10,8 10,12 13,14 Q 15,16 18,15.5" fill="none" stroke={P.cola} strokeWidth="1.25" strokeLinecap="round" />
      <g className="zc-cola-punta" style={{ transformBox: 'view-box', transformOrigin: '18px 15.5px' }}>
        <path d="M 18,15.5 Q 22,15 22.5,13.5 Q 23,15.9 18,16.1 Z" fill={P.cola} stroke={INK} strokeWidth="0.12" />
      </g>
      <path d="M 8,8 l -0.5,0.6 M 9.5,10 l -0.7,0.4 M 10.5,12 l -0.8,0.4 M 12,13.5 l -0.5,0.7 M 14,14.8 l -0.2,0.8 M 16,15.4 v 0.6 M 18,15.3 l 0.1,0.6 M 20,15 l 0.2,0.5" fill="none" stroke={P.colaSombra} strokeWidth="0.12" />
    </g>
  ) : (
    <g className="zc-cola" style={{ transformBox: 'view-box', transformOrigin: '7px 7px' }}>
      <path d="M 6.7,7.2 C 10.6,10.1 15.6,8.8 15.5,4.5 C 15.5,1.3 11.2,0.7 11.7,-2.7" fill="none" stroke={INK} strokeWidth="1.9" strokeLinecap="butt" />
      <path d="M 6.7,7.2 C 10.6,10.1 15.6,8.8 15.5,4.5 C 15.5,1.3 11.2,0.7 11.7,-2.7" fill="none" stroke={P.cola} strokeWidth="1.55" strokeLinecap="butt" />
      <g className="zc-cola-punta" style={{ transformBox: 'view-box', transformOrigin: '11.7px -2.7px' }}>
        <path d="M 10.93,-2.81 C 11.1,-5.9 15.4,-7.0 15.8,-9.45 Q 15.8,-10.8 14.6,-10.5 Q 16.9,-12.0 16.85,-9.4 C 16.7,-6.25 12.8,-5.8 12.47,-2.59 Z" fill={P.cola} />
        <path d="M 10.93,-2.81 C 11.1,-5.9 15.4,-7.0 15.8,-9.45 Q 15.8,-10.8 14.6,-10.5 Q 16.9,-12.0 16.85,-9.4 C 16.7,-6.25 12.8,-5.8 12.47,-2.59" fill="none" stroke={INK} strokeWidth="0.175" strokeLinejoin="round" />
        <path d="M 11.7,-4.0 l 0.7,0.3 M 13,-5.8 l 0.5,0.6 M 15,-7.3 l 0.5,0.5 M 16,-9.0 l 0.5,0.1" fill="none" stroke={P.colaSombra} strokeWidth="0.13" />
      </g>
      <circle cx="11.7" cy="-2.7" r="0.76" fill={P.cola} />
      <path d="M 9.2,8.1 l -0.4,1.2 M 11.1,8.5 v 1.1 M 13.0,8.2 l 0.4,1.0 M 14.4,7.1 l 0.9,0.5 M 14.8,5.3 l 1.1,0 M 14.4,3.4 l 0.9,-0.5 M 12.8,1.8 l 0.6,-0.8 M 11.4,-0.3 l 1,-0.3" fill="none" stroke={P.colaSombra} strokeWidth="0.17" />
      <path d="M 6.2,5.8 Q 8.7,6.8 9.5,8.2 L 8.7,8.0 9.0,8.6 8.1,8.2 8.2,8.8 Q 6.6,8.1 5.9,7.5 Z" fill={P.cuerpo} />
    </g>
  );

  const cabeza = (
        <g transform="translate(-1.2 -0.3) rotate(-4 0 -8)">
        <g className="zc-cabeza-mira">
          <g className="zc-cabeza" style={{ transformBox: 'fill-box', transformOrigin: '50% 92%' }}>
            <g transform="translate(-1.3 -1.9) scale(0.8 0.9)"><Oreja s={-1} orejaG={orejaG} /></g>
            <Oreja s={1} orejaG={orejaG} />
            <path d="M-4.0,-18.0Q-3.1,-18.2 -3.0,-19.8Q-3.5,-19.6 -4.6,-18.3ZM-2.9,-18.6Q-2.0,-18.6 -1.5,-20.1Q-2.0,-20.0 -3.4,-19.1ZM-1.5,-18.9Q-0.6,-18.8 0.0,-20.3Q-0.5,-20.3 -2.0,-19.4ZM0.0,-18.8Q0.9,-18.5 1.7,-19.8Q1.2,-19.9 -0.4,-19.4ZM1.5,-18.5Q2.3,-18.0 3.4,-19.1Q2.9,-19.3 1.3,-19.2ZM3.0,-18.0Q3.6,-17.3 5.0,-17.9Q4.6,-18.3 3.0,-18.7ZM4.0,-16.7Q4.3,-15.8 6.0,-15.9Q5.7,-16.4 4.3,-17.3ZM4.5,-15.3Q4.6,-14.4 6.1,-14.2Q6.0,-14.7 4.9,-15.9ZM4.4,-13.8Q4.4,-13.0 5.8,-12.5Q5.7,-13.0 4.8,-14.2ZM3.8,-12.0Q3.8,-11.2 5.1,-10.6Q5.1,-11.1 4.2,-12.4Z" fill={P.cuerpo} stroke={P.cuerpoLuz} strokeWidth="0.08" />
            <path d={CRANEO} fill={`url(#${craneo})`} stroke={INK} strokeWidth="0.4" />
            <path d={CRANEO} fill={P.cuerpo} filter={`url(#${grano})`} />
            <g clipPath={`url(#${craneo}-limite)`}>
              <path d={CARA} fill={`url(#${cara})`} filter={`url(#${pincel})`} />
              <path d="M -3.5,-19 Q -3,-16 -2.5,-14.3 Q -1.2,-17 -0.3,-19.3 Z" fill={P.mascara} filter={`url(#${pincel})`} />
              <path d="M -6.6,-15.1 Q -5.3,-15.8 -4.2,-14.9 L -2.8,-14 Q -1,-15.6 1.4,-15 L 4.8,-15.5 3.5,-14.4 Q 2,-14 1.6,-12.7 Q 0.3,-12 -1,-12.8 L -2.9,-13.3 -4.4,-13 Q -5.8,-12.7 -6.6,-13.3 Z" fill={P.mascara} filter={`url(#${mascara}-borde)`} />
              <g fill="none" stroke={P.cuerpoSombra} strokeWidth="0.11" opacity="0.7" strokeLinecap="round">
                <path d={PELO_CARA} /><path d={PELO_CARA} transform="translate(0.3 0.3) scale(-0.85 1)" />
                <path d="M -3.4,-18.7 l 0.2,0.8 M -2.6,-19 l 0.3,1.0 M -1.8,-19 l 0.2,1.1 M -0.9,-18.8 l -0.1,1.1 M 0.1,-18.5 l -0.2,0.9 M 1,-18.1 l -0.3,0.9 M 1.9,-17.7 l -0.4,0.8 M 2.8,-17.1 l -0.5,0.8 M 3.5,-16.4 l -0.5,0.7 M 4.2,-15.5 l -0.6,0.5 M 4.7,-14.4 l -0.7,0.3 M 4.8,-12 l -0.7,0.4 M 4.3,-11 l -0.7,0.5 M 3.5,-9.7 l -0.7,0.4 M 2.4,-8.5 l -0.8,0.3 M 1,-7.9 l -0.7,0.2" />
              </g>
              <path d={GRABADO_CRANEO} fill="none" stroke={P.cuerpoSombra} strokeWidth="0.07" strokeLinecap="round" opacity="0.5" aria-hidden="true" />
            </g>
            <g className="zc-ojos">
              <g className={vivo ? 'rh-blink' : undefined} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                {/* Ojos grandes de la lámina: esclera clara, iris café casi negro
                    que llena el ojo, brillo alto. Dentro del parpadeo. */}
                <ellipse cx="-5.05" cy="-14.1" rx="0.82" ry="1.02" fill={P.esclera} stroke={INK} strokeWidth="0.16" transform="rotate(-15 -5.05 -14.1)" />
                <ellipse cx="0.26" cy="-13.55" rx="1.22" ry="1.32" fill={P.esclera} stroke={INK} strokeWidth="0.2" />
                <g className={vivo ? 'rh-mirada zc-pupilas' : 'zc-pupilas'}>
                  <ellipse cx="-5.28" cy="-14.02" rx="0.56" ry="0.78" fill={P.iris} transform="rotate(-15 -5.28 -14.02)" />
                  <ellipse cx="-0.02" cy="-13.5" rx="0.88" ry="1.0" fill={P.iris} />
                  <ellipse cx="-5.32" cy="-14.0" rx="0.3" ry="0.44" fill={P.pupila} />
                  <ellipse cx="-0.08" cy="-13.45" rx="0.48" ry="0.58" fill={P.pupila} />
                  <circle cx="-5.45" cy="-14.33" r="0.14" fill={P.esclera} />
                  <circle cx="-0.34" cy="-13.9" r="0.22" fill={P.esclera} />
                  <circle cx="0.22" cy="-13.1" r="0.08" fill={P.esclera} opacity="0.7" />
                </g>
              </g>
              <g className="zc-parpados" fill="none" stroke={INK} strokeWidth="0.4" strokeLinecap="round">
                <path d="M -5.6,-14.1 q 0.55,0.4 1.1,0 M -0.65,-13.5 q 0.9,0.6 1.8,0" />
              </g>
            </g>
            <g className="zc-hocico" style={{ transformBox: 'view-box', transformOrigin: '-2px -12px', transform: 'scaleX(1.25)' }}>
              {/* La cuña nasal y la mandíbula comparten perspectiva con los ojos. */}
              <path d="M -3.5,-14.3 C -5.0,-12.5 -7.3,-11.7 -8.5,-10.45 Q -8.8,-9.7 -7.4,-9.05 C -4.4,-7.9 -0.5,-8.2 2,-10.25 C 0.6,-10.9 -0.9,-12.2 -1.8,-13.7 Z" fill={`url(#${cara})`} />
              <path d="M -3.5,-14.1 Q -5.3,-11.9 -8.3,-10.4 M -7.5,-9.1 Q -3.6,-7.2 1.8,-10.1" fill="none" stroke={P.cremaSombra} strokeWidth="0.18" />
              {boca}
              <g className="zc-trufa">
                <path d="M -8.65,-10.75 C -9.4,-10.6 -9.0,-9.4 -8.15,-9.4 Q -7.3,-9.6 -7.6,-10.3 Q -7.9,-10.9 -8.65,-10.75 Z" fill={`url(#${trufaG})`} stroke={P.cuerpoSombra} strokeWidth="0.18" />
                <path d="M -8.85,-10.2 q 0.2,0.5 0.45,0.2 M -7.85,-10 q -0.2,0.35 -0.4,0.2" fill="none" stroke={P.trufaSombra} strokeWidth="0.16" />
                <ellipse cx="-8.4" cy="-10.5" rx="0.27" ry="0.13" fill={P.trufaLuz} />
              </g>
              <g fill="none" stroke={P.cremaSombra} strokeWidth="0.1">
                <path d="M -3.3,-13.4 l -0.5,0.6 M -3.7,-12.5 l -0.6,0.5 M -4.3,-11.7 l -0.6,0.4 M -2.3,-12.4 l -0.4,0.5 M -1.4,-11.9 l -0.4,0.5 M -0.5,-11.3 l -0.4,0.4 M -5.2,-10.9 l -0.5,0.3" />
              </g>
              <g className="zc-bigotes" fill="none" stroke={INK} strokeWidth="0.1" strokeLinecap="round" opacity="0.7">
                <path d="M -6.2,-10.4 Q -8.3,-12.0 -10.4,-11.7 M -6.3,-10 Q -9.3,-10.9 -11,-10 M -5.9,-9.6 Q -8.8,-9.5 -10.1,-8.5 M -4.2,-10.5 Q -0.8,-11.5 2.7,-10.8 M -4,-10 Q -0.3,-10.2 3,-9.2" />
              </g>
              <path className="zc-lengua" d="M -4.3,-8.8 C -6,-8 -5.4,-6 -5,-4.9 Q -4.5,-3.6 -3.2,-4.4 Q -2.4,-4.5 -2.8,-3.8 C -4.5,-2.4 -6.2,-3.6 -6.4,-5.1 Q -7,-8 -4.3,-8.8 Z" fill={P.lengua} stroke={P.trufaSombra} strokeWidth="0.12" />
            </g>
          </g>
        </g>

        </g>
  );

  /* ═══ EL DIBUJO (atrás→adelante): sombra, cola, piernas, columna (tronco +
     brazos + gola + cabeza), crías, prop. */
  const cuerpoErguido = (
    <g className="crt-body">
      {/* aura tenue de presencia nocturna (rosa de luna) */}
      <circle cx="0" cy="0" r={11 + 1.2 * (energia ?? 1)} fill={`url(#${sombraG}-aura)`} opacity={auraOp} aria-hidden="true" />


      <g aria-hidden="true">
        <g transform="translate(-0.4 -1.0)"><Pierna s={-1} masa={masa} /></g>
      </g>

      {/* ═══ LA COLUMNA — el hueso del tronco: se inclina sola. El wrapper fijo
          la encorva hacia delante como en las láminas; con la lupa, más. */}
      <g transform={`rotate(${veLupa ? -9 : -4} 1 8)`}>
      <g className="zc-columna" style={{ transformBox: 'fill-box', transformOrigin: '50% 96%' }}>
        {cola}
        {rest['data-agt-estado'] !== 'escuchando' && !veLupa && <Brazo s={-1} estado={rest['data-agt-estado']} lupa={veLupa} />}
        <g className="zc-tronco" style={{ transformBox: 'fill-box', transformOrigin: 'center bottom' }}>
          <path d={TRONCO} fill={`url(#${dorso})`} stroke={INK} strokeWidth="0.55" strokeLinejoin="round" />
          <path d={TRONCO} fill={P.cuerpo} filter={`url(#${grano})`} aria-hidden="true" />
          <g clipPath={`url(#${dorso}-limite)`}>
            {/* El grabado de la lámina: rayado oscuro y puntas claras de guardia. */}
            {/* El esternón queda descentrado; la luz gira hacia el flanco cercano. */}
            <path d="M -5.9,-6.1 C -2.7,-7.3 0.0,-4.9 0.7,-1.0 C 1.0,2.1 4.0,3.4 3.5,6.7 C 2.6,9.6 -3.2,9.0 -4.2,6.4 C -5.0,4.4 -3.7,2.4 -4.7,0.2 C -6.0,-2.2 -6.7,-4.5 -5.9,-6.1 Z"
              fill={`url(#${panza})`} />
            <path d={GRABADO_TRONCO} fill="none" stroke={P.cuerpoSombra} strokeWidth="0.06" opacity="0.68" aria-hidden="true" />
            <path d="M -4.6,-5.9 Q -3.6,-3.7 -3.0,-2.6" fill="none" stroke={P.cremaLuz} strokeWidth="1.5" opacity="0.28" filter={`url(#${pincel})`} />
            <path d="M 3.7,-4.0 C 5.9,-0.9 7.6,2.0 8.0,4.3 Q 6.6,2.2 5.0,1.6 C 4.4,-0.1 4.1,-2.0 3.7,-4.0 Z" fill={P.umbra} opacity="0.4" filter={`url(#${pincel})`} />
            <path d="M -3.7,6.7 C -1.8,8.5 0.1,8.8 3.4,8.1" fill="none" stroke={P.umbra} strokeWidth="0.8" opacity="0.4" filter={`url(#${pincel})`} />
            <path d={PUNTAS_TRONCO} fill="none" stroke={P.brillo} strokeWidth="0.045" opacity="0.65" aria-hidden="true" />

          </g>
          <path d="M3.7,-4.0Q3.8,-2.8 5.8,-1.9Q5.7,-2.6 4.3,-4.6ZM4.8,-2.3Q4.8,-1.0 6.9,0.3Q6.8,-0.5 5.4,-2.8ZM5.8,-0.4Q5.9,0.9 8.2,2.1Q8.0,1.3 6.4,-1.0ZM6.8,1.6Q6.8,2.9 9.0,4.4Q8.9,3.6 7.4,1.1ZM7.3,3.7Q7.0,4.9 8.7,6.4Q8.8,5.7 8.0,3.3ZM7.0,5.6Q6.4,6.6 7.6,8.3Q7.9,7.7 7.8,5.4ZM5.8,7.0Q5.1,7.6 5.9,9.0Q6.2,8.6 6.5,7.0ZM2.5,-2.5Q2.3,-1.3 4.2,0.2Q4.2,-0.6 3.2,-2.9ZM3.6,-0.5Q3.5,0.8 5.4,2.3Q5.4,1.5 4.3,-0.9ZM4.5,1.8Q4.4,3.1 6.3,4.7Q6.3,3.9 5.2,1.4ZM5.1,4.0Q4.5,5.0 5.7,6.9Q6.0,6.2 5.9,3.8ZM4.6,6.0Q3.8,6.7 4.3,8.5Q4.7,8.0 5.3,6.1ZM1.5,-0.9Q1.3,0.3 2.9,1.9Q2.9,1.2 2.1,-1.2ZM2.5,1.3Q2.3,2.5 3.9,4.3Q3.9,3.6 3.1,1.0ZM3.3,3.6Q2.9,4.6 4.1,6.4Q4.3,5.7 4.0,3.4ZM3.4,5.7Q2.6,6.4 3.2,8.2Q3.6,7.7 4.1,5.8Z" fill={P.cuerpo} stroke={P.cuerpoLuz} strokeWidth="0.08" />
        </g>
        <g aria-hidden="true"><Pierna s={1} masa={masa} /></g>
        {momentoCuidado !== 'lavaCara' && rest['data-agt-estado'] !== 'escuchando' && <Brazo s={1} estado={rest['data-agt-estado']} />}

        {/* ═══ LA GOLA: el pelaje del cuello, DIBUJO CONTINUO bajo el cráneo. */}
        <g className="zc-cuello" transform="translate(-1.2 -0.3)" aria-hidden="true">
          <path d={GOLA} fill={`url(#${panza})`} opacity="0.6" />
          {/* la garganta crema: la cara clara sigue por el pecho (sin collar) */}
          <path d="M -5,-10 Q -1,-8 2.4,-10 C 2.6,-6.8 0.5,-5 0,-2 L -0.8,-3 -1,0 -2,-1 -2.5,0.3 C -4,-2 -5,-5.7 -5,-10 Z" fill={`url(#${cara}-garganta)`} />
          <path d="M -3.8,-7.8 Q -3.8,-5.6 -2.6,-4.7 M -2.8,-7.9 Q -2.7,-5.6 -1.5,-4.4 M -1.6,-7.8 L -0.9,-5.6 M 2.7,-8 Q 3.6,-5.6 2.4,-4.4 M -3.1,-6.5 l 0.5,1.3 M -2,-6.8 l 0.5,1.6 M -0.7,-6.7 l 0.3,1.2 M 0.5,-7 l 0,1.7 M 1.3,-7.5 l -0.1,1.3 M 2,-6.3 l -0.4,1.4" fill="none" stroke={P.cremaSombra} strokeWidth="0.12" opacity="0.65" />
        </g>

        {/* ═══ LA CABEZA — wrapper ADITIVO que sigue a usted + hueso de gestos. */}
        {cabeza}
        {veLupa && <Brazo s={-1} lupa />}
        {rest['data-agt-estado'] === 'escuchando' && <>
          <Brazo s={-1} estado="escuchando" />
          <Brazo s={1} estado="escuchando" />
        </>}
        {momentoCuidado === 'lavaCara' && <>
          <g transform="translate(6 3) scale(0.85)"><Brujula /></g>
          <Brazo s={1} libre />
        </>}

      </g>{/* /zc-columna */}
      </g>

      {propMundo}
    </g>
  );

  // Costado tendido: hombro bajo y anca alta, extremidades dibujadas en reposo lateral.
  const cuerpoLateral = (
    <g className="crt-body zc-lateral">
      <g transform="translate(8 -1) scale(0.72)">{cola}</g>
      <path d="M 8,5 Q 12,3 14,6 L 16,10 19,11 18,12.3 14,11.5 11,8 Z M -6,3 L -10,6 -14,7 -14,8.3 -9,8.5 -4,6 Z" fill={P.cuerpoSombra} />
      <path d="M 16,10 L 19,11 20,12 18.7,12.2 17,11.5 18.5,13 17.5,13.3 15,11.8 Z M -13,6.7 L -16,7.2 -17,8.3 -15.7,8 -16,9 -14.5,8.6 -12.6,7.9 Z" fill={P.piel} stroke={INK} strokeWidth="0.15" />
      <defs><path id={`${dorso}-lateral`} d="M -10,3 C -10,-1 -7,-4 -3,-4 L -2,-5 -1,-4.6 1,-5.5 2,-5 4,-5.7 C 9,-6 14,-4 16,0 L 15.3,0.2 16.5,1.8 15.7,1.7 Q 17,5 13,7 L 11,7 10,8 8,7.6 6,8.4 Q 1,9 -3,7.5 L -4,8 -4.5,7 -6,7.5 C -9,7 -11,6 -10,3 Z" />
        <clipPath id={`${dorso}-costado`}><use href={`#${dorso}-lateral`} /></clipPath>
      </defs>
      <use href={`#${dorso}-lateral`} fill={`url(#${dorso})`} stroke={INK} strokeWidth="0.25" />
      <g clipPath={`url(#${dorso}-costado)`}>
        <path d="M -9,4 Q -3,6 3,5 Q 9,4 13,5 Q 14,9 5,9 L -5,9 Z" fill={`url(#${panza})`} />
        <path d="M -9,0 Q -5,-5 0,-3 Q 3,0 -2,5 L -1,3 -4,5 -4,3 -7,4 Z M 0,-4 Q 7,-8 12,-3 Q 8,-1 5,3 L 5,1 2,3 2,1 -1,3 Z M 10,-2 Q 16,-2 15,4 L 13,6 13,4 10,6 Q 7,3 10,-2 Z" fill={`url(#${masa})`} />
        <path d="M -7,-1 Q -4,-3 -2,-1 L -4,1 -4,-0.5 -6,1 Z M 3,-3 Q 6,-5 9,-3 L 6,-1 6,-2.5 3,0 Z M 11,0 Q 14,1 13,4 L 12,2 10,3 Z" fill={P.brillo} opacity="0.48" />
        <path d="M -5,1 Q -1,0 0,-2 Q 2,3 -3,5 L -2,3 -5,4 Z M 7,-1 Q 9,2 7,5 L 9,4 8,6 Q 13,5 11,0 L 10,2 Z" fill={P.cuerpoSombra} opacity="0.7" />
        <g transform="translate(2 1) scale(1.6 0.8) rotate(-35)">
          <path d={GRABADO_TRONCO} fill="none" stroke={P.cuerpoSombra} strokeWidth="0.065" opacity="0.3" />
          <path d={PUNTAS_TRONCO} fill="none" stroke={P.brillo} strokeWidth="0.045" opacity="0.4" />
        </g>
      </g>
      <path d="M -4,1 Q 0,1 -1,4 L -4,7 -7,10 -9,9 Q -7,6 -6,4 Z" fill={`url(#${masa})`} />
      <path d="M -4,3 L -4.8,5 -4.6,3.8 -6.5,6 M -3,3 Q -3,5 -6,8" fill="none" stroke={P.brillo} strokeWidth="0.18" />
      <path d="M -7,8.6 Q -6,9 -7,10 L -9.7,12 -10.3,11.6 -8.7,9.8 -11,11.2 -11.5,10.7 -9,8.9 -11.2,9.7 -11.6,9.2 -9,8 Z" fill={P.piel} stroke={INK} strokeWidth="0.15" />
      <path d="M 10,3 Q 14,4 13,6 L 10,8 9,10 7.5,10.4 7,9 Q 8,6 9,6 Z" fill={`url(#${masa})`} />
      <path d="M 7.4,9.2 Q 9,8.7 9.2,10 L 8.5,11.7 7.6,12 7.3,10.5 6.8,12.3 6,12.2 6.2,10.6 5.7,11.8 5,11.3 5.8,9.7 Z" fill={P.piel} stroke={INK} strokeWidth="0.15" />
      <g transform="translate(-9 14) rotate(-14 0 -14) scale(0.88)">{cabeza}</g>
    </g>
  );

  const cuerpo = cuadrupeda ? (
    <CuerpoCuadrupedo paleta={P} tinta={INK} dorso={dorso} masa={masa} panza={panza}
      cabeza={cabeza} cola={cola}>
      {criasFx && <CriasMontadas craneo={craneo} cara={cara} orejaG={orejaG} dorso={dorso} />}
    </CuerpoCuadrupedo>
  ) : tanatosisFx ? cuerpoLateral : cuerpoErguido;

  // La TANATOSIS desploma a la criatura ENTERA (wrapper propio, no pisa el
  // cuerpo); el line-boil envuelve todo.
  const tumba = (
    <g>
      {/* la sombra de contacto vive FUERA del wrapper de la tanatosis: se
          queda en el piso cuando la criatura se desploma */}
      <ellipse className="zc-sombra" cx="0.2" cy="16.95" rx="10.8" ry="1.75" fill={`url(#${sombraG})`} aria-hidden="true"
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
      <g className="zc-tumba" style={{ transformBox: 'fill-box', transformOrigin: '59% 53%' }}>{cuerpo}</g>
    </g>
  );
  const cuerpoVivo = lineBoil ? <g filter={`url(#${boil})`}>{tumba}</g> : tumba;

  const estadoAttrs = {
    'data-momento-cuidado': momentoCuidado || undefined,
    'data-creature': ZARIGUYA_SLUG,
    'data-postura': cuadrupeda ? 'cuadrupeda' : 'erguida',
    'data-pose': vivo ? poseFx : undefined,
    'data-animo': animo,
    'data-tier': tier || undefined,
    'data-visema': visema || undefined,
    'data-vida': vivo ? (vidaFx || undefined) : (tanatosis ? 'tanatosis' : momentoCuidado || undefined),
    'data-crias': cuadrupeda && criasFx ? '1' : undefined,
    'data-lineboil': lineBoil ? '1' : undefined,
    'data-prop': !cuadrupeda ? mundoId || undefined : undefined,
  };
  const narracion = tanatosisFx ? ARIA_ZARIGUYA.muerta
    : estado === 'escuchando' ? ARIA_ZARIGUYA.escuchando
      : ARIA_ZARIGUYA.acompana;
  const tituloAccesible = `${title}. ${narracion}`;
  const descripcion = tanatosisFx ? FRASE_MUERTA : null;
  const clases = ['zc', vivo ? 'zc-viva' : 'zc-quieta', className].filter(Boolean).join(' ');
  const estiloRaiz = { ...ritmoPropio, ...estiloClima, ...estiloHost };

  if (inline) {
    return (
      <g ref={raizRef} className={clases} style={estiloRaiz} data-poder={poder ? '1' : undefined} role="img" aria-label={tituloAccesible} {...estadoAttrs}>
        {descripcion ? <desc>{descripcion}</desc> : null}
        {defs}
        {cuerpoVivo}
      </g>
    );
  }
  const svg = (
    <svg ref={raizRef} viewBox={cuadrupeda || tanatosisFx ? '-26 -25 54 45' : estado === 'escuchando' ? '-20 -29 40 49' : VIEWBOX} width={size} height={size} className={clases} style={estiloRaiz}
      role="img" {...estadoAttrs} {...rest} aria-label={tituloAccesible} aria-describedby={descripcion ? `${uid}-gesto` : undefined}>
      <title>{tituloAccesible}</title>
      {descripcion ? <desc id={`${uid}-gesto`}>{descripcion}</desc> : null}
      {defs}
      {cuerpoVivo}
    </svg>
  );
  if (poder) {
    return (
      <span
        className="is-powered-up zariguya-poder"
        data-creature-poder={ZARIGUYA_SLUG}
        style={{ '--aura-color': auraDeBicho(ZARIGUYA_SLUG), display: 'inline-flex' }}
      >
        {svg}
        <AuraPoder />
      </span>
    );
  }
  return svg;
}

/* Estado conversacional → pose del rig cuando el perfil no la decide sola. */
const POSE_RIG_DE_ESTADO = {
  contenta: 'celebra',
  escuchando: 'reposo',
  caminando: 'camina',
};

function AdaptadorZariguya({
  especie: _especie,
  creatureSlug: _creatureSlug,
  capacidades: _capacidades,
  perfil: _perfil,
  idlePerfil: _idlePerfil,
  climaPerfil: _climaPerfil,
  pose,
  poseLegada = undefined,
  estadoLegado = undefined,
  reducedMotion,
  'data-agt-especie': dataEspecie,
  'data-creature': dataCreature,
  'data-agt-estado': dataEstado,
  'data-pose': _dataPose,
  'data-visema': dataVisema,
  'data-clima': dataClima,
  'data-tier': dataTier,
  ...props
}) {
  const poseRig = POSE_RIG_DE_ESTADO[estadoLegado || dataEstado] || poseLegada || pose;
  const husmea = props.husmea || dataEstado === 'husmea';
  const rigAnimado = props.animated !== false && !reducedMotion;
  return (
    <ZariguyaCompaiRig
      {...props}
      pose={poseRig}
      husmea={husmea}
      reducedMotion={reducedMotion}
      data-agt-especie={dataEspecie}
      data-creature={dataCreature}
      data-agt-estado={estadoLegado || dataEstado}
      data-pose={rigAnimado ? poseRig : undefined}
      data-visema={dataVisema}
      data-clima={dataClima}
      data-tier={dataTier}
    />
  );
}

/** Fachada de la zarigüeya sobre el contrato común Compai. */
export function ZariguyaCompai({ inline = false, pose: poseLegada = undefined, estado = 'acompana', ...props }) {
  if (inline) return <ZariguyaCompaiRig {...props} inline pose={POSE_RIG_DE_ESTADO[estado] || poseLegada} data-agt-estado={estado} />;
  return (
    <CompaiAgente
      {...props}
      especie={ZARI_PERFIL_COMPAI.avatarType}
      estado={estado}
      estadoLegado={estado}
      chrome={false}
      preserveRigAnimation
      poseLegada={poseLegada}
      adaptador={AdaptadorZariguya}
    />
  );
}

export default ZariguyaCompai;
