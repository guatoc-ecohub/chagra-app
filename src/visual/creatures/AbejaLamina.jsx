import './creatures.css';
import './abeja-lamina.css';
import { OjosRubber, Cachetes, Miembro, AntenaRubber } from './_rubberhose.jsx';
import { CejasRubber } from './AngelitaGafas.jsx';

// Local pigments: the isolated drawing must not resize the production creature.
const INK = '#30251b';
const DARK = '#493322';
const OCHRE = '#c58f42';
const HONEY = '#d9a355';
const LIGHT = '#edc67d';
const CREAM = '#f0e0bc';
// Tetragonisca angustula: abdomen of translucent, even amber; head and thorax dark.
const AMBAR = '#e8ae4f';
const AMBAR_LUZ = '#f6d58c';
const AMBAR_SOMBRA = '#b97a2f';
const AMBAR_HILO = '#c98a3e';
const MANTO = '#6e4b2a';
const MANTO_LUZ = '#8c6436';
// Head scale about the neck: a large, legible face on a compact body.
const CABEZA_ERGUIDA = 'translate(.2 -.7) scale(1.2) translate(-.2 .7)';
const CABEZA_VOLAR = 'translate(5.3 1.75) rotate(7) scale(.9) translate(.2 -.7) scale(1.32) translate(-.2 .7)';
const EYE_RIM = 'M0 -1.14 C.7 -1.17 1.11 -.6 1.08 .06 C1.05 .77 .58 1.07 0 1.05 C-.67 1.02 -1.07 .58 -1.06 -.05 C-1.04 -.74 -.64 -1.12 0 -1.14Z M0 -.94 C-.53 -.94 -.94 -.5 -.93 .04 C-.91 .61 -.53 .97 0 .98 C.53 .99 .97 .58 .95 .04 C.94 -.53 .54 -.94 0 -.94Z';
const BROWS = {
  decir: ['M-1.96 -5.64 Q-1.3 -6.68 -.42 -5.88 Q-1.25 -6.25 -1.96 -5.64Z', 'M1.05 -6.03 Q1.85 -6.92 2.55 -5.87 Q1.84 -6.38 1.05 -6.03Z'],
  hablar: ['M-2.03 -5.73 Q-1.16 -6.6 -.38 -5.7 Q-1.2 -6.15 -2.03 -5.73Z', 'M1.05 -5.98 Q1.95 -6.54 2.64 -5.75 Q1.88 -6.18 1.05 -5.98Z'],
  leer: ['M-2.02 -5.95 Q-1.17 -6.41 -.38 -5.87 Q-1.18 -6.13 -2.02 -5.95Z', 'M1.11 -5.59 Q1.94 -6.07 2.61 -5.57 Q1.88 -5.78 1.11 -5.59Z'],
  pensar: ['M-2.02 -5.95 Q-1.18 -6.65 -.37 -5.96 Q-1.2 -6.30 -2.02 -5.95Z', 'M1.06 -6.02 Q1.97 -6.87 2.6 -5.9 Q1.9 -6.42 1.06 -6.02Z'],
  // Resting face: the same brows as decir, with the arch let down.
  calma: ['M-1.98 -5.66 Q-1.25 -6.32 -.42 -5.9 Q-1.25 -6.08 -1.98 -5.66Z', 'M1.06 -5.98 Q1.88 -6.5 2.58 -5.84 Q1.86 -6.18 1.06 -5.98Z'],
  // Happy face: a soft, even arch that sits a little higher than calma.
  alegre: ['M-2.02 -5.8 Q-1.2 -6.62 -.4 -5.86 Q-1.22 -6.3 -2.02 -5.8Z', 'M1.04 -6.08 Q1.9 -6.68 2.62 -5.92 Q1.88 -6.34 1.04 -6.08Z'],
  // Waiting face: calma's easy arch, lifted a hair so the face stays awake.
  esperar: ['M-1.98 -5.74 Q-1.24 -6.42 -.42 -5.98 Q-1.25 -6.18 -1.98 -5.74Z', 'M1.06 -6.06 Q1.88 -6.62 2.58 -5.92 Q1.86 -6.28 1.06 -6.06Z'],
};
// Resting face (rig.expresion = 'calma'): upper lids half down, eyes forward
// and a little low, closed smile. Without it every pose draws as approved.
const PARPADO_CALMA = { borde: -0.68, color: HONEY };
// Happy face (rig.expresion = 'alegre'): eyes open to the viewer with a second
// catchlight, the cheek pushing the lower lid up, blush and a wide open smile.
const MEJILLA_ALEGRE = { borde: 0.46, color: HONEY };
// Waiting face (sheet ESPERAR): a light lid, the look off to one side and a
// small closed smile. Patient, not sleepy: the lid stays far above calma's.
const PARPADO_ESPERAR = { borde: -0.86, color: HONEY };
const RUBOR_ALEGRE = '#d9785c';

function BocaLamina({ pose, visema }) {
  const forma = ['V1', 'V2', 'V3', 'V4'].includes(visema) ? visema : pose;
  return <g data-anatomia="boca" data-boca={forma === 'alegre' ? 'alegre' : undefined}>
    {forma === 'alegre' ? <>
      <path d="M-.92 -2.02 Q.6 -1.46 2.2 -2.3 C2.04 -.5 -.66 -.34 -.92 -2.02Z" fill={INK} />
      <path d="M-.62 -1.86 Q.6 -1.36 1.9 -2.06 L1.78 -1.72 Q.58 -1.1 -.5 -1.6Z" fill={CREAM} />
      <path d="M-.04 -1.02 Q.62 -1.42 1.34 -1.08 Q.64 -.6 -.04 -1.02Z" fill="#b8664f" />
      <path d="M-1.18 -2.22 Q-1.02 -2.02 -.86 -1.96 M2.44 -2.5 Q2.34 -2.3 2.16 -2.24" fill="none" stroke={INK} strokeWidth=".12" strokeLinecap="round" />
    </> : forma === 'hablar' || forma === 'V3' ? <>
      <path d="M-.75 -1.96 Q.46 -1.33 1.8 -2.1 C1.56 -.29 -.3 -.23 -.75 -1.96Z" fill={INK} />
      <path d="M-.38 -1.77 Q.62 -1.37 1.51 -1.87 L1.32 -1.45 Q.45 -1.13 -.2 -1.48Z" fill={CREAM} />
      <path d="M.22 -1.02 Q.7 -1.38 1.21 -1.01 Q.71 -.55 .22 -1.02Z" fill="#af7657" />
    </> : forma === 'decir' || forma === 'V4' ? <>
      <path d="M.05 -1.61 C.4 -2.34 1.53 -2.35 1.69 -1.78 Q1.69 -1.16 .63 -1.18 Q.08 -1.19 .05 -1.61Z" fill={INK} />
      <path d="M.64 -1.48 Q1.16 -1.87 1.47 -1.56 Q1.12 -1.27 .64 -1.48Z" fill="#ae7753" />
    </> : forma === 'esperar' ? <>
      <path d="M.02 -1.76 Q.74 -1.26 1.56 -1.9 Q.9 -.98 .02 -1.76Z" fill={INK} />
      <path d="M1.5 -2.06 Q1.66 -1.92 1.72 -1.74" fill="none" stroke={INK} strokeWidth=".1" />
    </> : forma === 'pensar' ? <path d="M.12 -1.7 Q.84 -1.1 1.67 -1.68 Q.84 -1.34 .12 -1.7Z" fill={INK} />
      : forma === 'V2' ? <path d="M-.27 -1.71 Q.68 -1.98 1.58 -1.7 Q.68 -.9 -.27 -1.71Z" fill={INK} />
        : <path d="M-.27 -1.75 Q.57 -1.08 1.4 -1.88 Q.81 -.76 -.27 -1.75Z" fill={INK} />}
  </g>;
}

// The wrist, palm and fingers share a parent; all contours are drawn by hand.
function Mano({ x, y, giro = 0, espejo = false, llamar = false }) {
  return <g data-anatomia="mano" data-agt-gesto-mano={llamar ? 'llama' : undefined} transform={`translate(${x} ${y}) rotate(${giro}) scale(${espejo ? -1 : 1} 1)`}>
    <path data-contorno="mano" d={llamar
      ? 'M-.49 .47 Q-.94 .35 -1.49 .31 L-2.02 .09 Q-2.31 -.1 -2.14 -.31 Q-2.05 -.4 -1.57 -.25 L-.7 -.16 L-.25 -.44 Q-.66 -.64 -.42 -.88 Q-.19 -1.1 .26 -.67 L.12 -1.1 Q-.08 -1.42 .22 -1.58 Q.52 -1.74 .75 -1.37 L.99 -.87 Q1.22 -1.12 1.49 -.87 Q1.72 -.56 1.4 -.22 Q1.04 .18 .47 .43Z'
      : 'M-.49 .47 Q-.94 .35 -1.49 .31 L-2.02 .09 Q-2.31 -.1 -2.14 -.31 Q-2.05 -.4 -1.57 -.25 L-.7 -.16 L-2.1 -.58 Q-2.37 -.7 -2.22 -.88 Q-2.09 -1.01 -1.7 -.81 L-.49 -.46 L-1.58 -1.04 Q-1.84 -1.25 -1.63 -1.39 Q-1.48 -1.48 -1.12 -1.21 L-.12 -.66 Q.3 -.55 .51 -.93 Q.59 -1.12 .24 -1.49 Q.04 -1.8 .27 -1.89 Q.49 -1.98 .85 -1.51 Q1.19 -1.07 1.08 -.62 Q.96 .04 .47 .43Z'} fill={DARK} stroke={INK} strokeWidth=".16" />
    <path data-interior="pliegues-mano" d="M-.49 .23 Q-.15 -.23 .48 -.35 M-1.58 -.09 L-.72 .06 M-1.7 -.68 L-.72 -.35 M.34 -1.51 L.64 -1.16" fill="none" stroke="#ae945d" strokeWidth=".1" />
  </g>;
}

function Ala({ espejo = false, giro = 0 }) {
  // Each membrane has its own contour; the far wing is narrower, not a scaled copy.
  return <g data-anatomia="ala" transform={`translate(${espejo ? 1.7 : -1.9} .6) scale(${espejo ? -.84 : .84} .84) rotate(${giro})`}>
    <path data-contorno="ala" d={espejo
      ? 'M0 0 C-1.01 .98 -2.55 3.25 -3.88 5.16 C-4.49 6.1 -5.03 7.25 -4.72 7.78 C-4.34 8.26 -2.69 7.65 -1.81 6.46 C-.49 4.75 .35 2.1 0 0Z'
      : 'M0 0 C-1.71 .96 -5.47 3.56 -7.13 5.46 C-8.01 6.47 -8.47 7.59 -7.95 7.84 C-7.13 8.21 -4.6 7.13 -2.86 5.44 C-1.02 3.7 .27 1.64 0 0Z'}
      fill="#f0e4c6" fillOpacity=".48" stroke="#67533c" strokeWidth=".13" />
    <path data-interior="membrana" d={espejo
      ? 'M-.14 .49 C-1.29 3.55 -3.42 6.71 -4.5 7.59 Q-2.72 7.31 -1.35 4.86 Q-.22 2.42 -.14 .49Z'
      : 'M-.18 .51 C-1.86 3.16 -5.38 6.62 -7.68 7.61 Q-4.6 6.83 -2.8 4.85 Q-.74 2.63 -.18 .51Z'}
      fill="#cdb989" opacity=".18" />
    <path data-interior="venas" d={espejo
      ? 'M-.18 .45 C-.86 2.63 -3.78 6.45 -4.59 7.55 M-.46 1.04 Q-1.07 4.18 -3.11 7.19 M-.4 2.2 Q-.82 5.25 -2.24 6.92 M-1.62 3.21 Q-1.71 4.42 -2.82 4.98 M-2.18 5.4 Q-2.75 5.69 -3.39 5.81 M-1.03 4.52 Q-1.63 4.66 -2.02 4.2'
      : 'M-.22 .43 C-1.66 2.3 -5.98 5.69 -7.81 7.61 M-.69 1.09 C-1.75 3.2 -3.7 5.8 -6.75 7.48 M-1.04 2.31 Q-2.2 4.9 -4.86 6.9 M-2.77 3.36 Q-3.02 4.49 -4.31 5.01 M-4.47 4.71 Q-5.36 5.08 -6.08 5.35 M-2.77 4.98 Q-3.6 5.13 -3.95 5.86 M-5.47 6.33 Q-5.65 6.84 -6.02 7.18'}
      fill="none" stroke="#967f58" strokeWidth=".075" strokeOpacity=".82" />
    <path data-interior="bord-lumiere" d={espejo
      ? 'M-.97 1.55 Q-2.73 4.04 -4.06 6.23 M-4.14 7.66 Q-3.07 7.3 -2.39 6.6'
      : 'M-1.8 1.5 Q-5.86 4.45 -7.4 6.54 M-7.23 7.66 Q-5.78 7.28 -4.72 6.5'}
      fill="none" stroke="#fff7df" strokeWidth=".11" strokeOpacity=".7" />
  </g>;
}

// Flight (sheet F3): both wings leave the top of the thorax towards the back;
// the near one climbs steeply, the far one opens flatter behind it.
function AlaVolar({ espejo = false }) {
  return <g data-anatomia="ala" data-pose-pieza="volar" transform={espejo ? 'translate(.75 -2.35) rotate(16) scale(.95)' : 'translate(.2 -2.05) rotate(4) scale(.9)'}>
    <path data-contorno="ala" d={espejo
      ? 'M0 0 C-1.05 -.9 -2.1 -3.22 -4.2 -5.48 C-5.33 -6.7 -6.12 -7.27 -6.39 -6.78 C-6.73 -6.12 -5.58 -4.1 -4.1 -2.27 C-2.53 -.34 -.72 .55 0 0Z'
      : 'M0 0 C-1.6 -1.16 -3.42 -3.55 -6.3 -5.72 C-7.77 -6.83 -8.9 -7.13 -9.03 -6.43 C-9.2 -5.64 -7.34 -3.56 -5.43 -2.05 C-3.39 -.44 -1.02 .63 0 0Z'}
      fill="#f0e4c6" fillOpacity=".48" stroke="#67533c" strokeWidth=".13" />
    <path data-interior="membrana" d={espejo ? 'M-.2 -.31 Q-2.72 -4.36 -5.94 -6.5 Q-3.62 -3.58 -1.06 -.01Z' : 'M-.24 -.31 Q-4.16 -4.68 -8.47 -6.49 Q-5.05 -3.55 -1.1 -.04Z'} fill="#cdb989" opacity=".18" />
    <path data-interior="venas" d={espejo
      ? 'M-.2 -.25 Q-2.43 -3.25 -5.94 -6.5 M-.71 -.16 Q-3.21 -2.53 -5.34 -5.3 M-1.33 -.08 Q-3.55 -1.69 -4.62 -4.13 M-2.02 -.4 Q-3.28 -1.03 -3.93 -2.49'
      : 'M-.25 -.24 Q-3.51 -3.72 -8.53 -6.47 M-.83 -.12 Q-3.99 -2.78 -7.03 -5.55 M-1.52 -.05 Q-3.77 -1.7 -5.96 -4.48 M-2.31 -.32 Q-3.47 -1.03 -4.77 -2.65'}
      fill="none" stroke="#967f58" strokeWidth=".075" strokeOpacity=".82" />
    <path data-interior="bord-lumiere" d={espejo ? 'M-1.03 -.55 Q-3.14 -3.62 -5.54 -5.97' : 'M-1.53 -.55 Q-4.74 -3.75 -7.98 -5.99'} fill="none" stroke="#fff7df" strokeWidth=".11" strokeOpacity=".7" />
  </g>;
}

function Pata({ lado, posterior = false, tamborilea = false }) {
  return <g data-anatomia={posterior ? 'pata-posterior' : 'pata-media'} transform={`translate(${posterior ? (lado < 0 ? -1.5 : 1.85) : (lado < 0 ? -3.9 : 3.7)} ${posterior ? 5.2 : 1.8}) scale(${lado} 1)`}>
    <Miembro d={posterior ? 'M0 0 Q.51 2.3 .87 3.42 Q1.3 4.2 1.03 5.33 L1.35 6.7' : 'M0 0 Q-.7 .65 -.29 2.85 Q-.96 4.42 -.61 5.96'} ancho={posterior ? .54 : .47} ink={INK} />
    <path data-contorno="tibia" d={posterior ? 'M.57 2.42 Q1.7 2.9 1.5 4.2 L1.16 5.5 Q.5 5.12 .51 4.33 L.27 3.33Z' : 'M-.55 2.33 Q-.01 3.07 -.24 4.31 L-.58 5.69 Q-1.14 5.39 -1.24 4.45 L-1.07 2.83Z'} fill="#826039" stroke={INK} strokeWidth=".16" />
    <path data-interior="pelo-pata" d={posterior ? 'M.6 3.11 L.94 3.8 M.49 3.72 L.85 4.39 M.67 4.45 L.95 4.98 M1.3 3.38 L1.16 4.17' : 'M-.86 3.13 L-.68 3.77 M-.97 3.89 L-.76 4.61 M-.81 4.65 L-.67 5.24'} fill="none" stroke="#d6ab68" strokeWidth=".085" />
    {posterior && <g data-anatomia="tarso" className={tamborilea ? 'lamina-tamborileo' : undefined}>
      <path data-contorno="pie" d="M1.11 5.68 Q1.24 6.16 1.47 6.28 L1.88 6.33 Q2.12 6.02 2.37 6.4 Q2.69 6.15 2.87 6.47 Q3.26 6.35 3.32 6.64 Q3.12 7.04 2.71 6.86 Q2.36 7.01 2.06 6.83 Q1.71 7.04 1.43 6.76 Q.93 6.8 .79 6.39Z" fill={DARK} stroke={INK} strokeWidth=".14" />
      <path data-interior="nudillos" d="M1.43 6.39 L1.42 6.61 M1.94 6.47 L1.89 6.68 M2.41 6.49 L2.38 6.73 M2.88 6.59 L2.87 6.76" stroke={OCHRE} strokeWidth=".09" />
    </g>}
  </g>;
}

// Flight legs hang from under the thorax, bent down and back. The far pair is
// the same limb seen behind the body: shifted towards the head and darker.
function PataVolar({ lejana = false, posterior = false }) {
  const [x, y] = posterior ? (lejana ? [.45, 2.2] : [-.45, 2.4]) : (lejana ? [1.95, 2.45] : [1.15, 2.75]);
  const d = posterior
    ? 'M0 0 Q-.6 1.4 -1.9 2.2 Q-3.1 3 -4.1 4.2 L-5 4.9'
    : 'M0 0 Q-.3 1.3 -1.2 2.1 Q-2 2.9 -2.4 4 L-3 4.8';
  return <g data-anatomia={posterior ? 'pata-posterior' : 'pata-media'} data-pose-pieza="volar" transform={`translate(${x} ${y})${lejana ? ' scale(.9)' : ''}`}>
    <Miembro d={d} ancho={posterior ? .5 : .45} ink={INK} />
    <path data-contorno="tibia" d={posterior ? 'M-1.5 1.9 Q-3 2.1 -4.3 3.6 L-4.5 4.4 Q-3.3 3.8 -2.1 2.8 Q-1.7 2.4 -1.5 1.9Z' : 'M-.9 1.8 Q-1.9 2.2 -2.5 3.3 L-2.7 4.2 Q-1.9 3.8 -1.4 2.8 Q-1.1 2.3 -.9 1.8Z'} fill={lejana ? '#5e4329' : '#826039'} stroke={INK} strokeWidth=".16" />
    <path data-interior="pelo-pata" d={posterior ? 'M-2.1 2.35 L-2.2 2.8 M-2.7 2.7 L-2.75 3.2 M-3.3 3.15 L-3.3 3.65 M-3.85 3.65 L-3.8 4.1' : 'M-1.45 2.4 L-1.4 2.85 M-1.85 2.85 L-1.75 3.3 M-2.2 3.35 L-2.1 3.8'} fill="none" stroke={lejana ? '#a7834f' : '#d6ab68'} strokeWidth=".085" />
    <path data-contorno="pie" d={posterior
      ? 'M-4.75 4.6 Q-5.45 4.6 -5.8 5.1 Q-5.45 5.42 -5.05 5.18 Q-4.75 5.4 -4.42 5.12 Q-4.35 4.8 -4.75 4.6Z'
      : 'M-2.78 4.52 Q-3.4 4.55 -3.7 5.02 Q-3.36 5.32 -3.02 5.1 Q-2.74 5.3 -2.46 5.05 Q-2.4 4.72 -2.78 4.52Z'} fill={DARK} stroke={INK} strokeWidth=".14" />
  </g>;
}

// Horizontal thorax, drawn for flight: the smooth rim faces the head, the tufts
// run over the back and the belly, and the ochre mantle rides on top.
function ToraxVolar() {
  return <>
    <path data-contorno="torax" d="M2.72 -2.26 L2.41 -2.56 L1.93 -2.54 L1.58 -2.84 L1.12 -2.71 L.69 -2.89 L.28 -2.7 L-.2 -2.82 L-.5 -2.44 L-1.05 -2.54 L-1.19 -2.04 L-1.76 -2.03 L-1.78 -1.53 L-2.35 -1.39 L-2.14 -.87 L-2.73 -.63 L-2.33 -.16 L-2.82 .2 L-2.38 .57 L-2.71 1.02 L-2.14 1.27 L-2.37 1.8 L-1.74 1.9 L-1.79 2.45 L-1.2 2.45 L-1.08 2.98 L-.48 2.8 L-.23 3.32 L.3 3 L.69 3.42 L1.11 3.06 L1.61 3.36 L1.9 2.87 L2.49 3.08 L2.62 2.52 Q4.55 2.06 4.22 .2 Q4.55 -1.66 2.72 -2.26Z" fill={DARK} stroke={INK} strokeWidth=".15" />
    <path data-interior="manto-ocre" d="M-2.3 -.55 Q-2.1 -2.3 .25 -2.62 Q2.6 -2.7 3.75 -1.2 Q4.25 .15 3.65 1.35 Q2.7 .3 1.25 .08 Q-.55 -.12 -2.3 -.55Z" fill={MANTO} />
    <path data-interior="luz-manto" d="M-1.35 -1.35 Q-.45 -2.18 1.08 -2.15 Q2.42 -2.08 3.1 -1.22 Q2.12 -1.52 1.02 -1.45 Q-.18 -1.5 -1.35 -1.35Z" fill={MANTO_LUZ} />
    <g data-interior="pelo-torax" fill="none" strokeLinecap="round">
      {/* Fibres follow the new rim: radial on the back, drooping under the belly. */}
      <path stroke="#c79a50" strokeWidth=".09" d="M-1.51 .83 q-.23 .12 -.5 .14 M-1.61 .15 q-.38 -.1 -.77 -.02 M-1.47 -.53 q-.3 -.03 -.57 -.18 M-1.1 -1.13 q-.28 -.32 -.67 -.47 M-.79 -1.42 q-.27 -.19 -.45 -.46 M-.14 -1.79 q-.05 -.24 -.2 -.43 M.6 -1.95 q-.1 -.34 -.06 -.69 M1.05 -1.95 q.1 -.26 .06 -.54 M1.79 -1.77 q.1 -.38 .35 -.7 M2.43 -1.39 q.29 -.17 .46 -.45" />
      <path stroke="#edca82" strokeWidth=".065" d="M-1.85 -.81 q-.28 -.05 -.51 -.2 M-1.64 -1.17 q-.16 -.15 -.37 -.21 M-1.1 -1.74 q-.25 -.17 -.41 -.42 M-.4 -2.15 q-.05 -.23 -.21 -.41 M.03 -2.29 q-.08 -.15 -.1 -.33 M.86 -2.38 q.07 -.25 .01 -.5 M1.68 -2.26 q.03 -.2 .13 -.37 M2.43 -1.92 q.23 -.19 .35 -.46 M2.78 -1.67 q.14 -.2 .34 -.32 M3.3 -1.08 q.18 -.04 .33 -.17" />
      <path stroke="#765027" strokeWidth=".07" d="M-.25 2.14 q-.19 .21 -.26 .49 M-.88 1.75 q-.24 .33 -.59 .55 M-1.34 1.2 q-.34 .07 -.61 .28 M2.42 .99 q.16 .13 .37 .18 M2.3 1.16 q.28 .11 .5 .32 M1.98 1.47 q.12 .2 .31 .33 M1.58 1.69 q.2 .25 .29 .56 M1.13 1.82 q-.01 .26 .1 .49 M.44 1.82 q-.13 .26 -.12 .54 M-.01 1.68 q-.07 .22 -.21 .39" />
      <path stroke="#b58a46" strokeWidth=".075" d="M-.94 2.25 q-.22 .16 -.34 .4 M-1.53 1.72 q-.15 .15 -.35 .23 M-1.77 1.37 q-.31 .06 -.55 .25 M-2.03 .66 q-.24 .09 -.49 .08 M-2.06 -.09 q-.18 -.06 -.37 -.04 M2.8 2.06 q.16 .1 .26 .24 M3.31 1.46 q.19 .16 .43 .22" />
      <path stroke="#edc67d" strokeWidth=".045" d="M-.06 2.85 q-.02 .16 -.1 .3 M-.87 2.52 q-.1 .08 -.15 .2 M-1.55 1.99 q-.13 .15 -.3 .23 M-1.83 1.63 q-.15 .04 -.27 .14 M-2.18 .89 q-.2 .09 -.43 .1 M-2.28 .09 q-.18 -.05 -.35 -.01 M-2.22 -.34 q-.14 0 -.26 -.05 M-1.92 -1.1 q-.16 -.13 -.35 -.17 M-1.39 -1.74 q-.13 -.08 -.22 -.2 M-.67 -2.23 q-.06 -.2 -.21 -.35 M-.23 -2.4 q-.09 -.14 -.12 -.3 M.65 -2.56 q.02 -.12 -.01 -.24 M1.55 -2.48 q.01 -.18 .1 -.34 M2.01 -2.34 q.09 -.11 .12 -.26 M2.77 -1.92 q.11 -.18 .28 -.3" />
      <path stroke={INK} strokeWidth=".06" d="M-.56 1.31 q-.17 .21 -.41 .33 M-.83 .97 q-.21 .04 -.37 .17 M-1 .57 q-.29 .12 -.6 .12 M.91 1.85 q.05 .18 .03 .37 M-.2 1.58 q-.25 .21 -.37 .52 M3.33 1.78 q.16 .06 .29 .18 M2.71 2.36 q.06 .11 .17 .19" />
    </g>
  </>;
}

// Horizontal abdomen: short and round, one even amber with no bands. The
// tergites are hairlines of a darker amber; the shade stays warm, never ink.
function AbdomenVolar() {
  return <>
    <path data-contorno="abdomen" d="M-1.3 -1.9 C-2.9 -2.75 -5.6 -2.6 -7.1 -1.1 C-8.3 .1 -8.55 1.9 -7.95 3.1 C-7.1 4.6 -4.4 4.75 -2.6 3.6 Q-1 2.5 -.8 .5 Q-.8 -1.1 -1.3 -1.9Z" fill={AMBAR} stroke={INK} strokeWidth=".17" />
    <path data-interior="luz-abdomen" d="M-2.2 -1.25 C-4 -2.05 -6.4 -1.65 -7.3 .1 Q-7.45 .95 -6.85 1.3 C-6.25 -.3 -4.2 -.95 -2.2 -1.25Z" fill={AMBAR_LUZ} opacity=".85" />
    <path data-interior="tergitos" d="M-3.45 -2.3 Q-4.15 .9 -3.55 4.2 M-5.25 -2.3 Q-6.05 .9 -5.55 4.35 M-6.9 -1.4 Q-7.6 1.2 -7.15 3.85" stroke={AMBAR_HILO} strokeWidth=".09" strokeOpacity=".7" fill="none" />
    <path data-interior="sombra-abdomen" d="M-7.95 3.1 C-7.1 4.6 -4.4 4.75 -2.6 3.6 Q-1 2.5 -.8 .5 Q-1.5 2.4 -3.2 3.3 Q-5.6 4.3 -7.95 3.1Z" fill={AMBAR_SOMBRA} opacity=".55" />
    <path data-interior="brillo-abdomen" d="M-3.3 -1.78 Q-4.3 -2.02 -5.05 -1.82" stroke="#fff3d6" strokeWidth=".22" fill="none" />
  </>;
}

// The curled hand of flight; esperar hangs it loose at the end of the arm.
function ManoVolar({ x, y, espejo = false, giro = 0, pieza = 'volar' }) {
  return <g data-anatomia="mano" data-pose-pieza={pieza} transform={`translate(${x} ${y})${giro ? ` rotate(${giro})` : ''} scale(${espejo ? -1 : 1} 1)`}>
    <path data-contorno="mano" d="M-.28 .48 Q-.82 .24 -1.08 -.23 Q-1.3 -.62 -.99 -.79 Q-.72 -.91 -.47 -.56 L-.1 -.24 Q.12 -.43 .03 -.78 Q-.04 -1.08 .27 -1.12 Q.58 -1.12 .67 -.7 Q.78 -.08 .47 .37 Q.19 .67 -.28 .48Z" fill={DARK} stroke={INK} strokeWidth=".16" />
    <path data-interior="pliegues-mano" d="M-.74 -.2 Q-.43 .08 -.08 .1 M.03 -.27 Q.25 -.08 .43 -.06 M-.78 -.55 Q-.55 -.38 -.34 -.37" fill="none" stroke="#ae945d" strokeWidth=".1" />
  </g>;
}

/** Approved drawing. Inline shares the host SVG coordinates and never adds a viewport. */
/** @typedef {{ alasClase?: string, alasStyle?: import('react').CSSProperties, ropaTorax?: import('react').ReactNode, cejas?: import('react').ReactNode, cara?: import('react').ReactNode, ropaCabeza?: import('react').ReactNode, manoIzquierda?: import('react').ReactNode, expresion?: 'calma'|'atenta'|'alegre', brazos?: 'reposo'|'marco'|'saluda'|'celebra'|'puños', gestoBrazoDerecho?: string, gestoBrazoIzquierdo?: string }} RigLamina */
/**
 * @param {{ size?: number, animated?: boolean, visema?: string|null, pose?: string, className?: string, title?: string, tier?: string, inline?: boolean, rig?: RigLamina, movimiento?: string, 'data-quieto'?: boolean }} props
 */
export default function AbejaLamina({ size = 200, animated = false, visema, pose = 'decir', className = '', title, tier, inline = false, rig = {}, movimiento = pose, 'data-quieto': quieto = false }) {
  const Root = inline ? 'g' : 'svg';
  const decorativa = title === '';
  const etiqueta = title ?? `Abejita de lámina, ${pose}`;
  const vivo = animated && !quieto;
  const detalleAnimado = vivo && tier !== 'bajo';
  const volar = pose === 'volar';
  const leer = pose === 'leer';
  const hablar = pose === 'hablar';
  const pensar = pose === 'pensar';
  // Waiting (sheet ESPERAR): upright, arms hanging loose at the sides.
  const esperar = pose === 'esperar';
  const calma = rig.expresion === 'calma' && !volar;
  // 'atenta' is the happy face with the mouth closed: listening, not talking.
  const atenta = rig.expresion === 'atenta';
  const alegre = rig.expresion === 'alegre' || atenta;
  // Resting arms (rig.brazos = 'reposo'): hands together on the belly instead
  // of the open palms of decir, which read as a shrug when held at rest.
  const reposo = rig.brazos === 'reposo' && !volar && !leer && !pensar && !hablar && !esperar;
  const marco = rig.brazos === 'marco' && !volar && !leer && !pensar && !hablar && !esperar;
  const saluda = rig.brazos === 'saluda' && !volar && !leer && !pensar && !hablar && !esperar;
  // Celebration keeps closed hands above the shoulders, including at rest.
  const celebra = rig.brazos === 'celebra' && !volar && !leer && !pensar && !hablar && !esperar;
  // The morning stretch closes the hands without changing the ordinary arm
  // anchors. Celebration's raised anchors would cover the face in this motion.
  const puños = rig.brazos === 'puños' && !volar && !leer && !pensar && !hablar && !esperar;
  const brazoIzquierdoRecogido = rig.gestoBrazoIzquierdo === 'recogido';
  const brazoDerechoLlama = rig.gestoBrazoDerecho === 'llama';
  const brazoDerechoSenala = rig.gestoBrazoDerecho === 'senala';
  const izquierda = celebra ? [-6.2, -5.5, -20] : brazoIzquierdoRecogido ? [-3.55, 6.35, 0] : esperar ? [-4.45, 6.45, 12] : leer ? [-2.35, 5.1, -25] : pensar ? [-.3, 3.4, -10] : hablar ? [-3.7, 2.4, -35] : marco ? [-5.1, -5.3, -18] : saluda ? [-5.2, -2.8, -18] : reposo ? [-1.45, 3.62, 8] : [-7.2, .38, 0];
  const derecha = celebra ? [6.2, -5.5, 20] : brazoDerechoLlama ? [5, -1.35, 0] : brazoDerechoSenala ? [9.8, -.45, 0] : esperar ? [4.1, 6.25, -12] : leer ? [4, 4.3, 30] : pensar ? [1.75, -.9, 95] : hablar ? [6.9, -1.15, 35] : marco ? [5.1, -5.3, 18] : reposo || saluda ? [1.5, 3.5, -8] : [7.5, -.05, 0];
  const brazoIzq = celebra ? 'M-2.7 .4 Q-4.8 -1.5 -6.2 -5.1' : volar ? 'M3.7 1.5 Q4.7 2.9 3.5 3.9' : brazoIzquierdoRecogido ? 'M-2.7 .4 Q-3.15 3.15 -3.55 6.05' : esperar ? 'M-2.7 .4 Q-4.3 2.4 -4.45 6.05' : leer ? 'M-2.7 .4 Q-4.73 4.2 -2.35 5.1' : pensar ? 'M-2.7 .4 Q-4.4 3.67 -.3 3.4' : hablar ? 'M-2.7 .4 Q-4.8 2.1 -3.7 2.4' : marco ? 'M-2.7 .4 Q-5.3 -1.8 -5.1 -5.1' : saluda ? 'M-2.7 .4 Q-5.4 -.7 -5.2 -2.8' : reposo ? 'M-2.7 .4 Q-5 2.9 -2.45 3.66' : 'M-2.7 .4 Q-3.91 4.79 -7.2 .38';
  const brazoDer = celebra ? 'M2.6 .4 Q4.8 -1.5 6.2 -5.1' : volar ? 'M3 1.9 Q3.9 3.4 2.6 4.5' : brazoDerechoLlama ? 'M2.6 .4 Q5.4 -.3 5.35 -1.4 Q5.25 -1.8 5 -1.35' : brazoDerechoSenala ? 'M2.6 .4 Q6.3 -.45 9.8 -.45' : esperar ? 'M2.6 .4 Q4.05 2.3 4.1 5.85' : leer ? 'M2.6 .4 Q5.44 1.43 4 4.3' : pensar ? 'M2.6 .4 Q5.28 3.74 1.75 -.9' : hablar ? 'M2.6 .4 Q4.64 1.9 6.9 -1.15' : marco ? 'M2.6 .4 Q5.3 -1.8 5.1 -5.1' : reposo || saluda ? 'M2.6 .4 Q4.9 2.8 2.5 3.54' : 'M2.6 .4 Q4.57 3.6 7.5 -.05';
  return <Root {...(inline ? {} : { xmlns: 'http://www.w3.org/2000/svg', viewBox: '-13.1 -13.1 26.2 26.2', width: size, height: size })}
    role={decorativa ? undefined : 'img'} aria-hidden={decorativa || undefined} aria-label={decorativa ? undefined : etiqueta}
    className={`crt-abeja-lamina ${className}`} data-pose={pose} data-tier={tier} data-animated={vivo ? '1' : '0'} data-quieto={!vivo || undefined} data-movimiento={movimiento} data-expresion={rig.expresion} data-brazos={celebra ? 'celebra' : puños ? 'puños' : reposo ? 'reposo' : marco ? 'marco' : saluda ? 'saluda' : undefined}>
    {!decorativa && <title>{etiqueta}</title>}
    <g className="lamina-pulso" strokeLinecap="round" strokeLinejoin="round">
      <g className={`crt-alas${rig.alasClase ? ` ${rig.alasClase}` : ''}`} style={rig.alasStyle} data-anatomia="alas">
        {volar ? <><AlaVolar /><AlaVolar espejo /></> : <><Ala giro={hablar ? 106 : leer ? 73 : pensar ? 15 : 0} />
          <Ala espejo giro={hablar ? 100 : leer ? 67 : pensar ? 10 : 0} /></>}
      </g>
      <g className="crt-patas" data-anatomia="patas">
        {volar ? <><PataVolar lejana posterior /><PataVolar lejana /></> : <><Pata lado={-1} posterior /><Pata lado={1} posterior tamborilea={esperar} /></>}
      </g>
      {/* Upright, the middle legs leave the thorax behind the round abdomen. */}
      {!volar && <g data-anatomia="patas-medias"><Pata lado={-1} /><Pata lado={1} /></g>}
      <g className="crt-abdomen" data-anatomia="abdomen">
        {volar ? <AbdomenVolar /> : <>
        <path data-contorno="abdomen" d="M-2.2 2.25 C-4.1 3.2 -4.45 6.2 -3 7.9 Q-1.95 9.05 -.5 8.85 C1.35 8.5 3.05 6.9 3.15 4.95 Q3.3 3.35 1.81 2.33Z" fill={AMBAR} stroke={INK} strokeWidth=".17" />
        <path data-interior="luz-abdomen" d="M-2.3 3.1 C-3.55 4.1 -3.65 6.3 -2.6 7.65 C-2.95 6.2 -2.75 4.4 -2.3 3.1Z" fill={AMBAR_LUZ} opacity=".85" />
        <path data-interior="tergitos" d="M-3.75 4.9 Q-.6 6.3 3.05 4.9 M-3.35 6.9 Q-.45 8 2.4 6.6" stroke={AMBAR_HILO} strokeWidth=".09" strokeOpacity=".7" fill="none" />
        <path data-interior="sombra-abdomen" d="M1.59 3.39 Q2.6 6.6 -.5 8.85 C1.35 8.5 3.05 6.9 3.15 4.95 Q3.3 3.35 1.81 2.33Z" fill={AMBAR_SOMBRA} opacity=".55" />
        <path data-interior="brillo-abdomen" d="M-2.75 3.55 Q-3.15 4.1 -3.1 4.7" stroke="#fff3d6" strokeWidth=".22" fill="none" />
        </>}
      </g>
      <g className="crt-torax" data-anatomia="torax">
        {volar ? <ToraxVolar /> : <>
        <path data-contorno="torax" d="M-2.56 -2.16 Q-2.98 -2.18 -3.26 -1.82 L-3.08 -1.79 L-3.49 -1.43 L-3.26 -1.44 L-3.6 -.98 L-3.43 -1.04 L-3.73 -.45 L-3.51 -.6 L-3.75 .03 L-3.57 -.08 Q-3.82 .74 -3.48 1.57 L-3.59 1.48 L-3.31 2.12 L-3.42 2.07 L-3.02 2.66 L-3.12 2.71 L-2.57 3.13 L-2.69 3.18 L-2.05 3.51 L-2.12 3.66 L-1.56 3.8 L-1.63 3.94 L-1.04 3.94 L-.91 4.12 L-.63 3.99 L-.32 4.05 L-.06 3.85 L.22 3.9 L.5 3.64 L.77 3.7 L1.02 3.36 L1.28 3.41 L1.48 3.07 L1.75 3.01 L1.86 2.71 L2.12 2.57 L2.18 2.25 L2.49 2.04 L2.49 1.77 L2.81 1.52 L2.72 1.34 L3.01 .95 L2.91 .8 L3.17 .37 L3.03 .25 L3.29 -.24 L3.12 -.24 L3.31 -.8 L3.07 -.67 L3.17 -1.14 L2.94 -1.03 Q2.79 -1.65 2.39 -1.83 Q.03 -3.08 -2.56 -2.16Z" fill={DARK} stroke={INK} strokeWidth=".15" />
        <path data-interior="manto-ocre" d="M-3.24 -1.3 Q-3.49 -.65 -3.2 .2 C-2.78 1.16 -2.07 1.47 -1.29 1.94 Q.19 2.62 1.19 1.4 Q2.36 .4 2.85 -1.09 L2.99 -.46 Q2.9 .53 2.34 1.24 L2.32 1.5 Q1.68 2.75 .44 3.27 L.19 3.21 L-.32 3.63 L-.76 3.48 L-1.19 3.61 Q-2.9 2.86 -3.33 1.42 Q-3.86 -.12 -3.24 -1.3Z" fill={MANTO} />
        <path data-interior="luz-manto" d="M-3.03 -1.55 Q-3.36 -.61 -2.77 .36 Q-2.39 1.16 -1.3 1.63 L-.99 1.56 Q.11 2.2 1.13 1.11 Q2.09 .47 2.76 -.93 L2.69 -.15 Q2.21 1.25 1.32 1.66 L1.27 1.85 L.63 2.2 L.32 2.12 L-.14 2.38 L-.34 2.17 L-.77 2.27 L-1.11 2.05 L-1.42 2.05 Q-2.69 1.47 -3.05 .54 Q-3.68 -.67 -3.03 -1.55Z" fill={MANTO_LUZ} />
        <g data-interior="pelo-torax" fill="none" strokeLinecap="round">
          {/* Hand-drawn irregular fibres follow the shoulder, flank and lower tufts. */}
          <path stroke="#c79a50" strokeWidth=".09" d="M-2.79 -1.72 q-.4 .18 -.59 .68 M-2.62 -1.3 q-.55 .57 -.44 1.12 M-3.04 -.83 q-.36 .35 -.4 .69 M-2.79 -.51 q-.18 .38 -.08 .78 M-2.38 -.6 q-.3 .54 -.06 1.11 M-2.1 -.38 q-.09 .27 .12 .61 M-1.8 -.29 q-.19 .53 .16 1.06 M-1.23 -.06 q-.2 .42 .05 .81 M-.92 .05 q-.04 .25 .18 .47 M-.6 .03 q-.16 .52 .03 .84 M-.04 -.04 q.08 .55 -.13 1.05 M.39 .02 q.22 .18 .03 .57 M.96 -.21 q.22 .4 -.18 .98 M1.44 -.35 q.24 .17 -.01 .69 M1.83 -.63 q.09 .5 -.27 .99 M2.36 -.94 q.02 .34 -.14 .5 M2.59 -1.12 q.24 .32 -.04 .73" />
          <path stroke="#edca82" strokeWidth=".065" d="M-3.24 -1.35 l-.21 .36 M-3.17 -.51 q-.06 .43 .18 .68 M-2.77 -.23 l.06 .53 M-2.63 .23 q.11 .48 .45 .72 M-2.23 .71 l.22 .58 M-1.89 .88 q.12 .46 .52 .69 M-1.43 1.24 l.15 .38 M-1.07 1.44 q.07 .41 .29 .5 M-.48 1.58 l.02 .46 M-.13 1.53 q.15 .3 -.01 .65 M.28 1.55 q.01 .38 -.24 .58 M.63 1.31 l-.09 .43 M1.05 1.04 q-.1 .57 -.34 .76 M1.49 .85 l-.11 .31 M1.71 .54 q.09 .3 -.3 .68 M2.03 .23 l-.12 .39 M2.42 -.22 q.02 .35 -.28 .75 M2.8 -.62 l-.18 .31" />
          <path stroke="#765027" strokeWidth=".07" d="M-3.41 .08 q.03 .37 .19 .53 M-3.21 .78 q.02 .62 .45 .97 M-2.91 1.17 l.14 .37 M-2.58 1.54 q.24 .55 .6 .75 M-2.2 1.82 l.14 .4 M-1.84 2.11 q.25 .4 .55 .5 M-1.28 2.26 l.06 .42 M-.96 2.48 q.05 .31 .24 .55 M-.49 2.51 l-.03 .65 M-.14 2.67 q-.02 .25 -.19 .46 M.31 2.51 l-.13 .39 M.67 2.21 q-.12 .51 -.52 .87 M1.12 1.9 q-.12 .37 -.35 .57 M1.65 1.64 l-.22 .52 M2.06 1.1 q-.05 .58 -.38 .88 M2.31 .74 l-.03 .3 M2.74 .23 q-.02 .54 -.3 .8" />
          <path stroke="#b58a46" strokeWidth=".075" d="M-3.37 1.28 q-.06 .5 .18 .87 M-2.97 1.92 l.36 .61 M-2.73 2.34 q.1 .42 .55 .7 M-2.27 2.63 l.31 .48 M-1.95 2.9 q.08 .46 .47 .81 M-1.48 3.11 l.23 .38 M-1.13 3.16 q.04 .51 .35 .8 M-.73 3.26 l-.06 .58 M-.28 3.21 q-.03 .4 -.33 .8 M.17 3.12 l-.2 .42 M.51 2.81 q-.05 .45 -.39 .78 M.92 2.62 l-.08 .33 M1.38 2.15 q-.12 .67 -.45 1.01 M1.81 1.92 l-.2 .46 M2.2 1.33 q.12 .35 -.19 .79" />
          <path stroke="#edc67d" strokeWidth=".045" d="M-3.56 -.6 l-.23 .35 M-3.58 -.13 l-.16 .4 M-3.58 .54 l.09 .52 M-3.28 1.79 l.18 .31 M-2.94 2.41 l.13 .29 M-2.45 2.81 l.12 .42 M-2.06 3.19 l.17 .29 M-1.7 3.3 l.19 .41 M-1.21 3.54 l.09 .4 M-.87 3.6 l-.06 .47 M-.38 3.59 l-.14 .32 M.17 3.42 l-.06 .33 M.61 3.12 l-.12 .47 M1.12 2.86 l-.18 .4 M1.57 2.42 l-.07 .35 M2.01 2.14 l-.17 .37 M2.48 1.56 l-.21 .38 M2.85 .88 l-.08 .28 M3.05 -.04 l-.14 .42" />
          <path stroke="#bd914b" strokeWidth=".04" d="M-2.92 -1.19 q-.35 .39 -.3 .83 M-2.82 -.93 l-.31 .4 M-2.57 -.85 q-.26 .42 -.11 .81 M-2.19 -.63 l-.12 .61 M-1.98 -.36 q-.18 .41 .08 .91 M-1.6 -.23 l.04 .52 M-1.32 .14 q-.13 .3 .13 .68 M-.97 .36 l.13 .41 M-.71 -.04 q-.07 .32 .08 .64 M-.35 .19 l.03 .74 M.18 .24 q.1 .45 -.08 .91 M.56 -.09 l.03 .51 M.83 .22 q.04 .31 -.21 .76 M1.17 -.27 l.05 .63 M1.51 -.19 q.05 .44 -.18 .78 M1.91 -.48 l-.04 .56 M2.22 -.74 q.14 .26 -.13 .82 M2.69 -.91 l-.01 .43 M-3.36 .41 l.12 .46 M-3.08 .85 l.2 .36 M-2.84 1.41 q.15 .46 .32 .59 M-2.62 1.93 l.21 .44 M-2.29 2.08 q.04 .35 .29 .6 M-1.91 2.47 l.19 .46 M-1.62 2.67 q.08 .41 .37 .67 M-1.24 2.91 l.21 .49 M-.92 3.1 l.15 .54 M-.61 3.25 l.01 .38 M-.27 3.34 l-.1 .31 M.1 3.21 l-.07 .29 M.42 2.88 l-.15 .37 M.8 2.65 q-.04 .5 -.28 .66 M1.23 2.27 l-.17 .51 M1.64 1.95 q-.06 .34 -.28 .68 M2.07 1.56 l-.18 .41 M2.42 1.14 l-.17 .49" />
          <path stroke="#f0cc80" strokeWidth=".035" d="M-3.39 -.91 l-.12 .31 M-3.08 -.12 l.06 .24 M-2.92 .25 l.16 .39 M-2.46 .62 l.15 .28 M-2.04 1.11 l.21 .31 M-1.64 1.22 l.06 .36 M-1.17 1.65 l.13 .43 M-.79 1.72 l.04 .26 M-.36 1.82 l.11 .48 M.15 1.62 l-.03 .29 M.57 1.71 l-.13 .29 M.87 1.45 l-.04 .38 M1.25 1.12 l-.16 .33 M1.56 .93 l-.03 .29 M1.93 .54 l-.18 .46 M2.22 .06 l-.03 .29 M2.62 -.3 l-.12 .48 M-2.61 2.59 l.29 .33 M-2.24 2.9 l.13 .34 M-1.88 3.25 l.29 .31 M-1.38 3.47 l.12 .31 M-.99 3.48 l.09 .35 M-.47 3.49 l-.07 .37 M.03 3.32 l-.12 .43 M.49 3.02 l-.11 .41 M1.01 2.81 l-.18 .27 M1.47 2.33 l-.13 .5 M1.89 1.83 l-.09 .27 M2.38 1.44 l-.18 .29" />
          <path stroke={INK} strokeWidth=".06" d="M-2.83 .6 q.07 .26 .21 .38 M-2.12 .14 l.11 .56 M-1.47 .27 q-.04 .31 .19 .62 M-.75 .61 l.15 .32 M-.03 .29 q.17 .33 -.06 .67 M.62 .31 l-.12 .59 M1.22 .17 q.09 .3 -.18 .66 M2.08 -.12 l-.2 .57 M-2.79 1.85 l.2 .36 M-1.96 2.36 l.27 .31 M-1.47 2.68 q-.04 .25 .18 .56 M-.62 2.9 l.05 .43 M.13 2.88 l-.12 .44 M.9 2.47 l-.2 .4 M1.7 2.09 l-.27 .37" />
        </g>
        </>}
      </g>
      {rig.ropaTorax}
      {volar && <g data-anatomia="patas-medias"><PataVolar posterior /><PataVolar /></g>}
      {/* In flight the same head leads the body: moved and tipped, never squashed. */}
      {/* The head is placed by an outer group so CSS gestures on .crt-cabeza never drop the scale. */}
      <g data-encaje="cabeza" transform={volar ? CABEZA_VOLAR : CABEZA_ERGUIDA}>
      <g className="crt-cabeza" data-anatomia="cabeza">
        <g className="crt-antenas" data-anatomia="antenas" transform="scale(.36)">
          <AntenaRubber d="M-2.8 -17 Q-4.05 -20.3 -4.3 -23.55 Q-1.9 -26.7 -.3 -29.4" bulbo={[-.3, -29.4]} bulboR={.55} ink={INK} sway={detalleAnimado} />
          <AntenaRubber d="M3.5 -17 Q3.75 -20.8 5 -23.25 Q10.35 -24.4 11.6 -25.95" bulbo={[11.6, -25.95]} bulboR={.55} ink={INK} sway={detalleAnimado} delay={.2} />
          <path data-contorno="extremos-antenas" d="M-4.3 -23.55 Q-1.9 -26.7 -.3 -29.4 Q.8 -29.82 .46 -28.29 Q-.38 -25.94 -4.3 -23.55Z M5 -23.25 Q10.35 -24.4 11.6 -25.95 Q12.42 -26.45 12.03 -25.11 Q10.82 -23.43 5 -23.25Z" fill={INK} />
          <path data-interior="luz-antena" d="M-3.2 -22.85 L-.23 -27.87 M5.58 -22.8 L10.58 -24.83" stroke="#a18b5f" strokeWidth=".22" fill="none" />
        </g>
        <g className="crt-cara" data-anatomia="cara">
          <path data-contorno="cabeza" d="M-3.03 -4.8 C-3.15 -6.96 -.97 -7.98 1.15 -7.2 C2.75 -6.77 3.29 -4.97 3.35 -3.13 C3.62 -1.28 1.74 -.48 .19 -.65 C-1.47 -.79 -2.75 -1.72 -3.09 -3.16 Q-3.27 -4.02 -3.03 -4.8Z" fill={DARK} stroke={INK} strokeWidth=".2" />
          <path data-interior="borde-cabeza" d="M-.34 -7.14 C-2.77 -6.97 -3.1 -4.38 -1.76 -2.46 Q-2.7 -5.6 -.1 -6.57 Q1.1 -6.92 2.02 -6.15 Q1.28 -7.05 -.34 -7.14Z" fill="#ab7c3d" />
          <path data-interior="cara-miel" d="M-.41 -6.57 Q.4 -6.67 .85 -5.67 Q1.36 -6.62 2.19 -6 C2.83 -5.39 2.91 -3.63 3.13 -2.84 C3.59 -1.14 1.7 -.64 .26 -.94 C-1.17 -1.14 -2.2 -2.56 -2.12 -4.17 Q-2.16 -6.32 -.41 -6.57Z" fill={HONEY} stroke={INK} strokeWidth=".11" />
          <path data-interior="luz-frente" d="M-1.76 -4.4 Q-1.7 -6.14 -.54 -6.21 Q.08 -6.16 .35 -5.56 Q-.79 -6.25 -1.76 -4.4Z M1.33 -5.65 Q1.82 -6.27 2.29 -5.68 L2.57 -5 Q1.98 -5.8 1.33 -5.65Z" fill={LIGHT} />
          <g className="crt-ojos" data-anatomia="ojos" transform="translate(.1 1.89) scale(1 1.55)">
            <OjosRubber ojos={[{ cx: -1.02, cy: -3.96, r: 1.02 }, { cx: 2.03, cy: -4.13, r: .72 }]} mirar={alegre ? (volar ? [.12, .1] : [.06, .12]) : volar ? [.3, .04] : esperar ? [.36, .2] : calma ? [.14, .04] : leer ? [.23, .38] : pensar ? [.22, -.33] : hablar ? [.29, .1] : [.24, -.14]} ink={INK} esclera={CREAM} contorno={EYE_RIM} parpadea={detalleAnimado} parpado={calma ? PARPADO_CALMA : esperar && !alegre ? PARPADO_ESPERAR : undefined} mejilla={alegre ? MEJILLA_ALEGRE : undefined} brillo={alegre} />
          </g>
          <g data-anatomia="cejas">{rig.cejas ?? <CejasRubber contornos={alegre ? BROWS.alegre : calma ? BROWS.calma : BROWS[pose] || BROWS.decir} ink={INK} />}</g>
          <g data-anatomia="mejillas"><Cachetes puntos={alegre ? [{ cx: -1.55, cy: -2.5, r: .56 }, { cx: 2.74, cy: -2.74, r: .36 }] : [{ cx: -1.09, cy: -2.44, r: .61 }, { cx: 2.59, cy: -2.68, r: .35 }]} color={alegre ? RUBOR_ALEGRE : '#bc8050'} vivo={detalleAnimado} /></g>
          <path data-anatomia="nariz" d="M.68 -2.96 Q1.05 -3.37 1.57 -3.05 Q1.9 -2.73 1.43 -2.58 Q.91 -2.5 .68 -2.96Z" fill="#a3793c" stroke={INK} strokeWidth=".1" />
          <g className="crt-boca"><BocaLamina pose={atenta ? 'sonrisa' : alegre ? 'alegre' : calma ? 'calma' : pose} visema={visema} /></g>
          <path data-interior="pelo-coronilla" d="M-2.64 -5.76 L-2.87 -6.12 M-2.27 -6.23 L-2.4 -6.73 M-1.9 -6.6 L-1.98 -7.06 M-1.47 -6.82 L-1.58 -7.26 M-.99 -6.97 L-1.09 -7.47 M-.48 -7.04 L-.54 -7.49 M.02 -7.04 L.02 -7.47 M.49 -6.96 L.58 -7.41 M.96 -6.82 L1.09 -7.25" fill="none" stroke={LIGHT} strokeWidth=".07" />
          {rig.cara}
        </g>
        {rig.ropaCabeza}
      </g>
      </g>
      {leer && <g className="crt-livre" data-objeto="libro" transform="translate(.7 1.8) rotate(12)" stroke={INK} strokeWidth=".16">
        <path d="M-2.91 .1 Q-1.4 -.26 .23 .53 Q1.8 -.25 3.3 -.05 L2.98 4.73 Q1.57 4.79 .1 5.44 Q-1.32 4.77 -2.9 4.72Z" fill="#765332" />
        <path d="M-2.72 -.25 Q-1.27 -.53 .23 .24 Q1.73 -.61 3.11 -.42 L2.79 4.4 Q1.39 4.37 .1 5.07 Q-1.31 4.44 -2.66 4.4Z" fill={CREAM} />
        <path d="M-2.52 -.09 Q-1.15 -.21 .24 .47 Q1.74 -.31 2.89 -.22 M.24 .47 L.1 5.07 M-2.54 .52 L-2.65 4.4 M2.72 .36 L2.45 4.1" fill="none" stroke="#987b4d" strokeWidth=".09" />
        <path d="M-2.41 .64 Q-1.31 .79 -.18 1.31 L-.28 4.55 Q-1.24 4.16 -2.43 4.05Z M.62 1.26 Q1.8 .55 2.47 .5 L2.26 3.98 Q1.54 4.12 .53 4.63Z" fill="#a47c47" />
        <path d="M-1.99 1.13 L-2.06 3.64 M-1.49 1.28 L-1.56 3.96 M-.91 1.52 L-.99 4.07 M1.01 1.36 L.88 4.07 M1.6 1.1 L1.42 3.91 M2.07 .93 L1.85 3.7" stroke="#765332" strokeWidth=".08" />
      </g>}
      <g className="crt-brazo-l" data-anatomia="brazo-izquierdo" data-agt-gesto-brazo={rig.gestoBrazoIzquierdo} style={{ transformBox: 'view-box', transformOrigin: '-2.7px .4px' }}>
        <g className="lamina-mano-l">
          <Miembro d={brazoIzq} ancho={.84} ink={INK} />
          <Miembro d={brazoIzq} ancho={.51} ink="#8c643b" />
          {celebra || puños ? <ManoVolar x={izquierda[0]} y={izquierda[1]} giro={celebra ? izquierda[2] : 0} pieza={celebra ? 'celebra' : 'estira'} /> : volar ? <ManoVolar x={3.3} y={4.1} /> : esperar ? <ManoVolar x={izquierda[0]} y={izquierda[1]} giro={izquierda[2]} pieza="esperar" /> : <Mano x={izquierda[0]} y={izquierda[1]} giro={izquierda[2]} espejo={reposo || marco || saluda || brazoIzquierdoRecogido} />}
          {rig.manoIzquierda}
        </g>
      </g>
      <g className="crt-brazo-r" data-anatomia="brazo-derecho" data-agt-gesto-brazo={rig.gestoBrazoDerecho} style={{ transformBox: 'view-box', transformOrigin: '2.6px .4px' }}>
        <g className="lamina-mano-r">
          <Miembro d={brazoDer} ancho={.84} ink={INK} />
          <Miembro d={brazoDer} ancho={.51} ink="#8c643b" />
          {celebra || puños ? <ManoVolar x={derecha[0]} y={derecha[1]} giro={celebra ? derecha[2] : 0} espejo pieza={celebra ? 'celebra' : 'estira'} /> : volar ? <ManoVolar x={2.4} y={4.7} /> : esperar ? <ManoVolar x={derecha[0]} y={derecha[1]} giro={derecha[2]} espejo pieza="esperar" /> : <Mano x={derecha[0]} y={derecha[1]} giro={brazoDerechoLlama ? 0 : derecha[2]} espejo={!reposo && !marco && !saluda} llamar={brazoDerechoLlama} />}
        </g>
      </g>
      {marco && <g data-gesto="marco-cara" aria-hidden="true" fill="none" stroke={INK} strokeWidth=".32" strokeLinecap="round"><path d="M-6.2 -4.6 V-8.2 H-2.8 M2.8 -8.2 H6.2 V-4.6 M6.2 -.2 V3.4 H2.8 M-2.8 3.4 H-6.2 V-.2" /></g>}
    </g>
  </Root>;
}
