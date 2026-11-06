import { useId, useRef } from 'react';
import { RH_INK } from './_rubberhose.jsx';
import { useVidaIdle, useRitmoPropio, useMiradaUsted } from './useVidaIdle.js';
import './jaguarCompai.css';

// Curvas escritas a mano. Cada mancha pertenece a un hueso, sin imagen ni calco.
const COSTADO = [
  [102, 111, .64, -12], [121, 106, .6, 14], [141, 106, .65, -22],
  [161, 112, .68, 20], [179, 115, .73, 32], [98, 122, .72, 30],
  [120, 125, .72, -10], [141, 128, .74, 17], [160, 127, .8, -30],
  [181, 136, .8, 12], [107, 141, .65, -16], [127, 144, .72, 40],
  [148, 146, .68, -5], [166, 149, .7, 28], [91, 105, .45, 35], [192, 125, .43, -10], [194, 145, .45, 16], [112, 155, .35, -12], [134, 155, .4, 25],
];
const HOMBRO = [
  [69, 113, .42, 20], [80, 109, .45, -12], [88, 118, .5, 12],
  [65, 127, .48, -25], [77, 124, .5, 25], [87, 134, .5, 50],
  [69, 140, .46, 0], [78, 147, .48, 25], [62, 150, .35, -10],
];
const MANCHAS_CARA = [
  'M50 71q-5-4-7 0q0 4 5 5z', 'M60 64q-4-3-5 1l3 5q4-1 2-6',
  'M72 62q-4-2-5 2l2 5q5 1 3-7', 'M82 65q4-3 6 1l-2 5q-5 0-4-6',
  'M95 73q5-3 6 1l-3 4q-5 0-3-5', 'M43 85q-5 1-3 5l5 1z',
  'M101 88q5-1 5 3l-4 3z', 'M42 99q-4 1-2 5l5 1z',
  'M103 100q5 1 2 5l-5 1z', 'M48 111q-5 1-3 4l6 1z',
  'M96 115q5-1 5 3l-5 2z',
];

function Roseta({ x, y, escala = 1, giro = 0 }) {
  return <g className="jc-roseta" transform={`translate(${x} ${y}) rotate(${giro}) scale(${escala} ${escala * (1.12 + (x % 3) * .09)})`} fill={RH_INK}>
    <path d="M-5-6C-9-8-11-2-9 2Q-10 6-6 6L-4 4Q-8 2-6-1Q-7-4-2-4ZM0-7Q3-9 5-6Q10-6 9 0L7 3L5 1Q8-2 4-3Q3-6 0-4Z" />
    <path d="M-3 6Q-1 9 2 7Q6 9 8 4L5 2Q5 6 2 5Q0 7-2 4Z" />
    <path d="M-1-1Q1-3 3 0Q2 3-1 1Z" />
  </g>;
}

function RosetaIrregular({ x, y, escala = 1, giro = 0 }) {
  return <g className="jc-roseta-irregular" transform={`translate(${x} ${y}) rotate(${giro}) scale(${escala})`} fill="none" stroke={RH_INK} strokeWidth="2.2" strokeLinecap="round">
    <path d="M-7-5Q-10-1-7 4Q-4 8 0 5M2-7Q7-9 9-4Q11 0 7 3M5 5Q1 9-3 6" />
    <path d="M-1-2Q2-4 4-1Q5 2 2 3" fill={RH_INK} stroke="none" />
  </g>;
}

function ManchaSólida({ x, y, escala = 1, giro = 0 }) {
  return <path className="jc-mancha-solida" transform={`translate(${x} ${y}) rotate(${giro}) scale(${escala})`} d="M-7-5Q-2-10 5-6Q10-2 7 5Q2 10-5 6Q-10 2-7-5Z" fill={RH_INK} stroke="none" />;
}

// Cadera/hombro → canilla → zarpa. Los solapes mantienen cerradas las juntas.
function Pata({ x, y, trasera = false, lejos = false, fase = 0 }) {
  return <g transform={`translate(${x} ${y})`}>
    <g className="jc-pata" style={{ '--jc-fase': `${fase}s` }}>
      <path d={trasera ? 'M-14-14C-28-7-26 11-16 24L-3 36L11 31Q4 20 10 7Q18-11 5-15Z' : 'M-9-5Q-17 12-10 36L8 36Q14 12 10-5Z'} fill={lejos ? '#a97936' : '#c99343'} stroke="none" />
      <path d={trasera ? 'M-14-14C-28-7-26 11-16 24L-3 36M5-15Q18-11 10 7Q4 20 11 31' : 'M-9-5Q-17 12-10 36M10-5Q14 12 8 36'} fill="none" />
      <Roseta x={-3} y={2} escala={.47} giro={25} />
      <ManchaSólida x={-5} y={17} escala={.52} giro={-20} />
      <path d="M2 9l3-2 3 4-3 3zM-10-7l3-2 2 3-3 2z" fill={RH_INK} stroke="none" />
      <path d="M-7 25q4-3 6 1l-2 3-5-1zM5 23q5 0 3 5l-4 1z" fill={RH_INK} />
      <g className="jc-canilla"><g transform={trasera ? 'translate(-8 2) skewX(16)' : undefined}>
        <path d="M-9 28Q-11 44-13 55L8 55Q6 43 8 29Z" fill={lejos ? '#a97936' : '#c99343'} stroke="none" />
        <path d="M-9 28Q-11 44-13 55M8 29Q6 43 8 55" fill="none" />
        <path d="M-7 36q3-3 5 1l-1 3-4-1zM3 44q4-1 4 3l-4 2z" fill={RH_INK} />
        <g className="jc-zarpa">
          <path d="M-12 51C-18 53-21 59-18 63Q-8 68 10 63Q14 57 7 52Z" fill={lejos ? '#bf9b61' : '#c99343'} />
          <path d="M-12 58l-1 5M-5 59v5M3 59l1 4" fill="none" stroke={RH_INK} strokeWidth="1.1" />
          <path d="M-12 53q3-3 5 0l-2 2zM0 53q4-2 4 1l-2 2z" fill={RH_INK} />
        </g></g>
      </g>
    </g>
  </g>;
}

export default function JaguarCompai({
  size = 64, estado = 'acompana', animated = true, reducedMotion = false,
  visema = null, tier, clima = null, enso = 'neutro', direccion = 'derecha',
  title = 'Jaguar', className = '', style, vidaForzada = null, ...rest
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const raiz = useRef(null);
  const ritmo = useRitmoPropio();
  const vivo = animated && !reducedMotion;
  // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish -- Clave del contrato de estados, no copy UI.
  const habla = ['speaking', 'respondiendo', 'hablando'].includes(estado);
  const escucha = ['listening', 'escuchando'].includes(estado);
  // eslint-disable-next-line chagra-i18n/no-hardcoded-spanish -- Clave del contrato de estados, no copy UI.
  const piensa = ['thinking', 'pensando'].includes(estado);
  const camina = ['caminando', 'walking', 'anda'].includes(estado);
  const natural = useVidaIdle('jaguar', vivo && tier !== 'bajo' && !habla && !escucha && !piensa && !camina && !vidaForzada);
  const momento = vidaForzada || natural;
  useMiradaUsted(raiz, vivo && tier !== 'bajo' && !habla);
  const apertura = ({ V1: 0, V2: 2.5, V3: 6, V4: 1.5 })[visema] ?? (habla ? 2.5 : 0);
  const oro = `url(#jc-oro-${uid})`;
  const crema = `url(#jc-crema-${uid})`;
  const silueta = direccion === 'izquierda'
    ? 'translate(330 7) scale(-1.27 .90)'
    : 'translate(-8 7) scale(1.27 .90)';
  return <svg {...rest} {...{ title }} ref={raiz} viewBox="0 0 330 240" width={size} height={size}
    role="img" aria-label={title} className={`jc-avatar ${className}`}
    style={{ ...ritmo, ...style, '--jc-boca': `${momento === 'ruge' ? 8 : apertura}px` }}
    data-creature="jaguar" data-dibujo="mano" data-agt-estado={rest['data-agt-estado'] || estado}
    data-jc-estado={camina ? 'camina' : escucha ? 'escucha' : piensa ? 'piensa' : habla ? 'habla' : 'reposo'}
    data-vivo={vivo ? '1' : '0'} data-vida={momento || undefined} data-visema={visema || undefined}
    data-clima={typeof clima === 'string' ? clima : undefined} data-enso={enso} data-direccion={direccion}>
    <title>{title}</title>
    <defs>
      <linearGradient id={`jc-oro-${uid}`} x1="0" y1="0" x2=".7" y2="1">
        <stop stopColor="#efc379" /><stop offset=".35" stopColor="#d79b46" /><stop offset=".72" stopColor="#ba7b34" /><stop offset="1" stopColor="#835125" />
      </linearGradient>
      <radialGradient id={`jc-crema-${uid}`}><stop stopColor="#f5e8c9" /><stop offset=".7" stopColor="#e7d1a1" /><stop offset="1" stopColor="#d2ae6c" stopOpacity="0" /></radialGradient>
    </defs>
    <g className="jc-direccion" transform={silueta}>
      <g className="jc-columna" stroke={RH_INK} strokeWidth=".85" strokeLinejoin="round" strokeLinecap="round">
        <g className="jc-cola">
          <path d="M181 137C207 140 219 153 224 172C230 192 237 202 245 194C252 187 248 173 240 167C236 164 239 158 244 160C258 168 261 194 248 207C232 221 211 211 205 190C200 169 194 157 178 151Z" fill={oro} />
          <path d="M201 158l-9 3M205 170l-10 3M208 183l-10 5M215 193l-4 6M225 189l6 7" fill="none" strokeWidth="4" />
          <path d="M229 177Q229 169 223 165Q221 159 226 159Q237 163 239 174Z" fill={RH_INK} />
        </g>
        <Pata x={94} y={153} lejos fase={-.65} />
        <Pata x={194} y={151} trasera lejos fase={-.32} />
        <path className="jc-torso" d="M65 96C78 83 94 90 109 96C129 99 148 89 172 98C192 102 205 117 201 139C196 160 173 169 151 166C129 160 116 166 95 163L71 160C55 143 50 112 65 96Z" fill={oro} />
        <path d="M80 142Q119 150 181 146Q163 173 116 160L80 157Z" fill={crema} stroke="none" />
        <g stroke="none">{COSTADO.map(([x, y, escala, giro], i) => i % 4 === 0
          ? <RosetaIrregular key={`${x}-${y}`} x={x} y={y} escala={escala} giro={giro} />
          : <Roseta key={`${x}-${y}`} x={x} y={y} escala={escala} giro={giro} />)}</g>
        <g fill={RH_INK} stroke="none">
          <path d="M108 101l3-1 2 3-3 2zM130 103l3-1 2 3-3 2zM149 100l3 1-1 3-3-1zM173 107l3 1 1 3-3 1zM111 118l3-1 1 3-3 2zM130 116l3 1-1 4-3-1zM151 116l3-1 1 4-2 2zM170 120l3-1 2 4-3 1zM110 132l3 1-1 4-3-1zM130 135l3-1 1 3-2 2zM151 136l3 1-1 3-3-1zM172 137l3-1 1 4-3 1zM185 148l3 1-1 4-3-1zM118 149l3-1 1 3-2 2zM140 150l2-1 2 3-3 1zM155 158l3-1 1 3-3 1z" />
        </g>
        <g fill="none" stroke="#f0cf91" strokeWidth=".45" opacity=".65">
          <path d="M102 97l4 2m7-2 4 2m9-3 5 1m9-3 4 2m9-2 4 2m9 1 4 3m10 1 4 3M108 114l3 4m17-8 3 4m18-4 2 4m17-3 3 4M107 132l2 4m21-7 2 4m20-4 2 4m18-3 2 5M102 149l3 4m18-10 2 4m20-6 2 4m17-7 2 4M118 158l4 2m6-2 4 2m6-2 4 2" />
        </g>
        <Pata x={166} y={155} trasera fase={-.98} />
        <path d="M75 94C56 91 51 114 55 140Q55 161 76 166Q97 153 96 128L91 103Z" fill={oro} />
        <path d="M59 112Q69 108 75 119L73 160Q54 151 57 129Z" fill={crema} stroke="none" />
        <g stroke="none">{HOMBRO.map(([x, y, escala, giro], i) => i % 2
          ? <ManchaSólida key={`${x}-${y}`} x={x} y={y} escala={escala * .8} giro={giro} />
          : <RosetaIrregular key={`${x}-${y}`} x={x} y={y} escala={escala} giro={giro} />)}</g>
        <Pata x={72} y={159} />
        <path d="M94 105Q102 126 94 143" fill="none" stroke="#855828" strokeWidth="1.2" />
        <g className="jc-atlas">
          <g className="jc-cuello">
            <path d="M73 91C82 87 96 91 104 101C108 108 106 119 100 126C91 123 82 117 76 109C72 103 70 97 73 91Z" fill={oro} />
            <path d="M78 96C85 94 95 97 101 105C103 110 101 116 98 120C90 117 84 112 80 106Z" fill="#9d6730" opacity=".48" stroke="none" />
          </g>
          <g className="jc-cabeza"><g transform="translate(22 29) scale(.59 .64)">
            <g className="jc-oreja-i"><g transform="translate(14 19) scale(.72)">
              <path d="M48 77C30 74 29 52 39 48C49 44 62 55 60 67Z" fill={oro} />
              <path d="M45 68Q32 59 40 53Q48 51 54 64Z" fill={RH_INK} stroke="none" />
              <path d="M38 55Q41 50 46 55L47 59L41 60Z" fill="#e9d5ae" stroke="none" />
            </g></g>
            <g className="jc-oreja-d"><g transform="translate(28 19) scale(.72)">
              <path d="M88 63C89 48 105 44 111 53C118 65 110 78 98 78Z" fill={oro} />
              <path d="M96 65Q99 51 106 56Q112 64 102 70Z" fill={RH_INK} stroke="none" />
              <path d="M100 56Q106 53 107 60L103 63L99 60Z" fill="#e9d5ae" stroke="none" />
            </g></g>
            <path d="M74 59C96 57 109 73 111 92C117 107 105 123 89 130Q71 140 54 126C37 121 32 104 38 91C37 73 53 59 74 59Z" fill={oro} />
            <path d="M42 97Q51 85 61 97L74 105L90 96Q104 89 109 101Q111 121 88 130Q66 138 49 122Z" fill={crema} stroke="none" />
            <g stroke="none">{MANCHAS_CARA.map(d => <path key={d} d={d} fill={RH_INK} />)}</g>
            <path d="M45 80l5 3-2 3-5-2zM98 79l-5 4 2 3 5-3zM44 94l8 4-1 3-8-3zM101 95l-7 4 1 3 7-3zM45 104l5 3-1 3-5-2zM100 105l-4 3 1 3 4-2zM63 70l2-5 2 2-1 4zM76 69l-1-5 3-1 1 6z" fill={RH_INK} stroke="none" />
            <path d="M57 75Q62 72 65 75M76 73Q80 70 84 75M47 80l4-1M94 81l4 2" fill="none" strokeWidth="2.3" />
            <g className="jc-ojos"><g transform="translate(0 17.8) scale(1 .8)">
              <path d="M46 89Q53 81 65 88Q58 99 48 93Z" fill="#d4ba6e" />
              <path d="M79 88Q90 81 101 88L99 94Q88 98 79 88Z" fill="#d4ba6e" />
              <g className="jc-pupilas" fill={RH_INK} stroke="none">
                <path d="M54 85Q60 83 60 90Q59 96 55 93Z" />
                <path d="M87 85Q93 83 93 90Q91 96 88 93Z" />
                <path d="M55 86h2v2h-2zM88 86h2v2h-2z" fill="#fff3cd" />
              </g>
              <path d="M46 88Q53 82 65 88M79 88Q90 81 101 88" fill="none" strokeWidth="2.5" />
            </g></g>
            <path d="M66 85Q70 79 76 84L83 103L63 104Z" fill={oro} stroke="none" />
            <path d="M54 110Q73 103 95 111L90 127Q72 140 54 123Z" fill={RH_INK} stroke="none" />
            <g className="jc-mandibula">
              <path d="M53 114Q72 123 94 113L90 124Q73 132 57 124Z" fill="#e8d5af" />
              <path d="M65 121Q73 116 81 121L79 125H68Z" fill="#b67b74" stroke="none" opacity={apertura > 0 || momento === 'ruge' ? 1 : 0} />
              <path d="M64 130Q73 132 83 129" fill="none" stroke="#9d804f" />
            </g>
            <path d="M69 103C60 100 51 103 50 110L54 118Q62 122 73 117Q84 121 93 116L96 108Q92 100 77 103Z" fill="#eddfbd" strokeWidth="1" />
            <path d="M63 103Q73 98 84 103L76 112Q73 114 70 110Z" fill={RH_INK} />
            <path d="M68 103Q73 101 79 103" fill="none" stroke="#a87f6d" />
            <path d="M73 111v6M59 121Q66 117 73 117Q82 117 89 120" fill="none" strokeWidth="1.3" />
            <path d="M54 109h1M60 107h1M57 114h1M86 107h1M91 111h1M84 114h1" fill="none" strokeWidth="2" />
            <g fill="none" stroke="#6d5a3d" strokeWidth=".75">
              <path d="M57 113Q40 107 27 110" /><path d="M58 117Q40 116 28 122" />
              <path d="M88 113Q108 105 120 110" /><path d="M88 117Q108 114 120 120" />
            </g>
            <g fill="none" stroke="#715334" strokeWidth=".6">
              <path d="M50 70l-3 5m6-7-3 6m8-8-2 5m28-5 2 5m4-3 3 5M43 110l3 3m-2 1 4 3m-1 1 4 3m46-11-3 3m3 1-4 3m1 1-4 3M57 124l3 3m1-2 3 3m1-2 3 3m3-2 1 3m4-4-1 3m4-5-1 3m4-5-1 3" />
            </g>
            <path d="M47 118l-4 2M50 122l-3 2M97 121l3 1M94 126l3 1" fill="none" stroke="#9f783f" strokeWidth=".8" />
          </g></g>
        </g>
      </g>
    </g>
  </svg>;
}
