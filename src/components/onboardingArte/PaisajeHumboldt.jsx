import React from 'react';
import './paisajeHumboldt.css';

import { especiesHumboldt } from './humboldtDatos.js';

function Hoja({ x = 0, y = 0, giro = 0, escala = 1, plata = false }) {
  return <g transform={`translate(${x} ${y}) rotate(${giro}) scale(${escala})`}>
    <path d={plata ? "M0 0 C-9 -4 -12 -25 -9 -41 Q-8 -55 0 -54 Q9 -54 10 -41 C13 -22 9 -6 0 0Z" : "M0 0 C-14 -12 -13 -35 0 -53 C11 -36 15 -13 0 0Z"} fill={plata ? '#bec9a3' : '#4b7948'} />
    {plata ? <path d="M-6 -12 l-2 -6 M7 -16 l2 -6 M-8 -29 l-1 -6 M8 -36 l-1 -7 M-5 -44 l1 -5" stroke="#e2e5c5" strokeWidth="1.5" fill="none" /> : null}
    <path d="M0 -3 Q-2 -26 0 -47" fill="none" stroke={plata ? '#edf0cc' : '#a4bb74'} strokeWidth="1.3" />
  </g>;
}

function Planta({ tipo, x, y, escala = 1 }) {
  return <g transform={`translate(${x} ${y}) scale(${escala})`} stroke="#42513a" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
    {tipo === 'puya' ? <>
      <path d="M0 0 L0 -149" stroke="#7e8961" strokeWidth="7" />
      <path d="M-9 -105 Q-15 -151 0 -181 Q16 -152 9 -105Z" fill="#b1b68a" />
      {[-85, -60, -35, -10, 20, 45, 75].map(giro => <path key={giro} transform={`rotate(${giro})`} d="M0 0 Q-13 -32 0 -85 Q8 -29 0 0Z" fill="#6a8a60" />)}
    </> : tipo === 'frailejon' ? <>
      <path d="M-10 0 L-13 -63 Q0 -76 12 -62 L9 0Z" fill="#766447" />
      <path d="M-7 -3 L-9 -56 M0 -1 L-2 -59 M6 -6 L8 -57" stroke="#b4a37c" />
      {[-115, -83, -52, -25, 3, 32, 61, 91, 120].map((giro, i) => <Hoja key={giro} y={-65} giro={giro} escala={i % 2 ? .87 : 1} plata />)}
      <path d="M-5 -67 Q-25 -105 -19 -133 M5 -68 Q22 -104 30 -123" fill="none" stroke="#8d8d53" />
      {[[-19, -133], [30, -123]].map(([cx, cy]) => <g key={cx}><circle cx={cx} cy={cy} r="7" fill="#d1b34d" /><circle cx={cx} cy={cy} r="2.5" fill="#776645" /></g>)}
    </> : tipo === 'palma' ? <>
      <path d="M-9 0 Q-3 -60 0 -117 L9 -117 Q4 -45 7 0Z" fill="#a49770" />
      {[-100, -66, -32, 8, 45, 79, 105].map(giro => <g key={giro} transform={`translate(5 -118) rotate(${giro})`}>
        <path d="M0 0 Q-16 -38 0 -87 Q16 -40 0 0Z" fill="#497447" />
        <path d="M0 0 V-80 M0 -14 L-10 -30 M0 -28 L-11 -43 M0 -44 L-9 -59 M0 -18 L10 -34 M0 -34 L11 -49 M0 -49 L8 -64" fill="none" stroke="#9baf70" />
      </g>)}
    </> : tipo === 'cafe' || tipo === 'uchuva' ? <>
      <path d="M0 0 Q-5 -49 0 -109 M0 -38 L-35 -59 M0 -57 L34 -78 M0 -79 L-22 -97" fill="none" stroke="#785f40" strokeWidth="4" />
      {[[-30, -54, -58], [0, -37, 56], [24, -73, 63], [-4, -69, -56], [-20, -93, -38], [0, -92, 30]].map(([x, y, giro]) => <Hoja key={`${x}:${y}`} x={x} y={y} giro={giro} escala={.7} />)}
      {[[-5, -43], [3, -51], [-13, -55], [10, -69], [17, -75], [-8, -83]].map(([cx, cy]) => tipo === 'cafe' ? <circle key={cy} cx={cx} cy={cy} r="4" fill="#ae4931" stroke="#6e3929" /> : <path key={cy} transform={`translate(${cx} ${cy})`} d="M0 0 Q-11 4 0 16 Q11 4 0 0Z" fill="#d9b666" />)}
    </> : <>
      <path d={tipo === 'colorado' || tipo === 'agraz' ? 'M-5 0 L-12 -30 L-32 -47 L-28 -51 L-7 -39 L4 -62 L10 -60 L1 -32 L8 0Z' : 'M-6 0 L-4 -79 L-32 -111 L-27 -116 L1 -91 L17 -125 L22 -122 L6 -81 L8 0Z'} fill={tipo === 'colorado' ? '#a27152' : '#8d7957'} />
      <g transform={tipo === 'colorado' || tipo === 'agraz' ? 'translate(0 14) scale(.8 .6)' : tipo === 'aliso' ? 'translate(0 -2) scale(.8 1.05)' : undefined}>
      <path d="M-61 -70 Q-84 -83 -65 -102 Q-74 -129 -45 -132 Q-41 -156 -13 -145 Q8 -163 31 -141 Q61 -149 66 -123 Q92 -112 66 -88 Q72 -67 44 -66 Q23 -45 4 -63 Q-30 -47 -41 -67Z" fill={tipo === 'guayacan' ? '#799051' : '#4f7951'} />
      <path d="M-56 -103 Q-35 -125 -16 -112 M12 -127 Q32 -140 48 -117 M-27 -80 Q-8 -96 17 -80 M33 -91 Q54 -103 63 -89" fill="none" stroke="#9fb97a" strokeWidth="5" />
      </g>
      {tipo === 'guayacan' ? [[-50, -119], [-27, -139], [2, -140], [33, -125], [57, -103], [20, -93], [-18, -99], [-49, -83]].map(([x, y]) => <g key={x} transform={`translate(${x} ${y})`} stroke="#b79b49" strokeWidth=".8">
        {[-7, 0, 7].map((dx, i) => <path key={dx} transform={`translate(${dx} ${i % 2 ? -5 : 2})`} d="M0 5 Q-12 0 -6 -6 Q-3 -12 2 -7 Q12 -11 10 -2 Q15 5 6 6Z" fill="#e8c858" />)}
      </g>) : null}
    </>}
  </g>;
}

function Fauna({ tipo }) {
  if (tipo === 'condor') return <g transform="translate(332 64) rotate(-7)" fill="#353d35" stroke="#343c32" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M-5 3 Q-38 -13 -80 -16 L-105 -36 L-103 -26 L-117 -33 L-109 -20 L-121 -22 L-108 -12 L-119 -10 L-102 -5 L-109 0 Q-57 7 -10 13 L-5 29 L6 28 L10 13 Q51 11 92 -2 L101 -10 L88 -7 L99 -18 L85 -13 L94 -27 L79 -19 L81 -32 L69 -21 Q35 -12 4 3Z" />
    <path d="M-16 8 Q-51 -5 -92 -10 M15 8 Q46 1 77 -10" fill="none" stroke="#e6e3cf" strokeWidth="5" />
    <path d="M-4 3 Q-7 -10 0 -12 Q8 -11 6 -4 L10 -3 L5 0 L4 6Z" fill="#a8967e" />
    <path d="M-7 5 Q0 10 7 5" fill="none" stroke="#f4efd9" strokeWidth="4" />
  </g>;
  return <g transform="translate(310 185)" stroke="#4e4b37" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
    {tipo === 'danta' ? <>
      <path d="M-66 -17 Q-80 -38 -59 -53 Q-32 -65 6 -53 L22 -46 Q34 -57 47 -41 L58 -29 Q63 -21 57 -12 L50 -10 L48 -23 L36 -25 L24 -17 L20 0 L9 0 L8 -18 L-29 -18 L-33 0 L-45 0 L-46 -17Z" fill="#535448" />
      <path d="M24 -46 Q17 -65 27 -63 Q35 -62 34 -49 M39 -44 Q37 -59 45 -55 L48 -43" fill="#565a47" stroke="#c7c5a2" strokeWidth="3" />
      <path d="M-22 -21 L-19 -2 L-10 -2 M24 -22 L29 -3 L37 -3" fill="none" stroke="#44483e" strokeWidth="7" />
      <path d="M-60 -39 Q-31 -52 3 -43" fill="none" stroke="#929078" strokeWidth="3" />
      <path d="M39 -27 L48 -23 L55 -16" fill="none" stroke="#e3ddbd" strokeWidth="2.5" />
      <circle cx="40" cy="-36" r="1.8" fill="#242e27" stroke="none" />
    </> : <>
      <path d="M-60 -41 Q-84 -36 -88 -18 Q-91 -4 -101 -5 Q-107 -6 -110 -11" fill="none" stroke="#4e4b37" strokeWidth="9.5" />
      <path d="M-60 -41 Q-84 -36 -88 -18 Q-91 -4 -101 -5 Q-107 -6 -110 -11" fill="none" stroke="#b08f5e" strokeWidth="6" />
      <path d="M-99 -5 Q-106 -6 -110 -11" fill="none" stroke="#4f4434" strokeWidth="6" />
      <path d="M22 -30 Q30 -20 34 -8 L35 -3 Q36 0 41 0 L48 0 Q49 -3 45 -5 L42 -8 Q39 -22 35 -35Z" fill="#987a50" />
      <path d="M-50 -32 Q-61 -21 -67 -12 L-69 -4 Q-70 0 -65 0 L-58 0 Q-57 -3 -61 -5 L-59 -11 Q-50 -19 -42 -28Z" fill="#987a50" />
      <path d="M44 -61 L47 -68.5 Q50 -70 52 -63Z" fill="#8f7149" />
      <path d="M34 -50 C26 -57 16 -58 6 -54 C-8 -49 -26 -50 -40 -53 C-50 -56 -58 -54 -61 -47 C-68 -41 -68 -30 -62 -24 Q-60 -18 -64 -12 L-62 -4 Q-62 0 -56 0 L-46 0 Q-45 -3 -50 -5 L-52 -10 Q-50 -18 -42 -26 C-30 -22 -4 -21 9 -24 Q13 -16 12.5 -5 Q12 0 18 0 L27 0 Q28 -3 22.5 -5 L23 -20 Q24 -30 33 -33 Q40 -37 44.6 -41.4 Q51.5 -39 60.7 -40.2 Q67.6 -41.4 68.7 -46 L69.9 -49.4 Q67.6 -55.2 60.7 -58.6 Q56.1 -63.2 49.2 -63.2 L46.9 -66.7 Q42.3 -72.4 38.8 -66.7 L37.7 -62.1 Q35.4 -57.5 34 -50Z" fill="#b89a69" />
      <path d="M-38 -26.5 C-26 -23.8 -6 -23 6 -24.6 C-6 -26 -24 -26 -38 -26.5Z" fill="#d9c597" stroke="none" />
      <path d="M-48 -52 Q-60 -38 -50 -28 M22 -52 Q14 -40 18 -29" fill="none" stroke="#9d7f53" strokeWidth="2" />
      <path d="M40.5 -66.5 Q42.5 -69 45 -65.5" fill="none" stroke="#4f4434" strokeWidth="2.5" />
      <path d="M62 -44 Q66 -44.5 68.4 -45 Q66.5 -41.2 61 -40.6 Q59.5 -42.3 62 -44Z" fill="#efe5cb" stroke="none" />
      <path d="M60.5 -47 Q58.5 -44.5 59.3 -41.5" fill="none" stroke="#4f4434" strokeWidth="1.6" />
      <path d="M66.5 -50.5 L69.9 -49.4 L67.6 -47.3Z" fill="#4f4434" strokeWidth="1" />
      <ellipse cx="57" cy="-54" rx="2.2" ry="1.4" transform="rotate(-12 57 -54)" fill="#30372c" stroke="none" />
      <path d="M54 -56.5 Q57 -58 60.5 -56" fill="none" stroke="#7d6644" strokeWidth="1.3" />
    </>}
  </g>;
}

/** A shared, static foreground: no texture downloads, filters or animation loop. */
export default function PaisajeHumboldt({ altitud }) {
  const seleccion = especiesHumboldt(altitud);
  if (!seleccion) return null;
  const { piso, plantas, animal } = seleccion;
  return <figure className="onbh" data-testid="paisaje-humboldt" data-piso={piso}>
    <svg viewBox="0 0 520 235" preserveAspectRatio="xMidYMax meet" role="img" aria-label={`${piso}: ${[...plantas.map(p => p.nombre), animal.nombre].join(', ')}`}>
      <path d="M0 150 Q74 99 145 140 Q207 101 287 144 Q385 89 520 135 V235 H0Z" fill={piso === 'páramo' ? '#acb99a' : '#9db287'} />
      <path d="M0 195 Q98 157 200 188 Q359 146 520 189 V235 H0Z" fill={piso === 'páramo' ? '#879b72' : '#73995c'} />
      {plantas.map((p, i) => <g key={p.id} data-especie={p.cientifico}>
        <Planta tipo={p.id} x={i ? 458 : 102} y={202} escala={i ? .8 : 1} />
        {p.id === 'frailejon' ? <><Planta tipo={p.id} x={27} y={192} escala={.54} /><Planta tipo={p.id} x={173} y={192} escala={.64} /></> : null}
      </g>)}
      <g data-especie={animal.cientifico}><Fauna tipo={animal.id} /></g>
      <path d="M0 216 Q93 195 172 215 Q303 201 397 215 Q458 198 520 213 V235 H0Z" fill="#bac18b" />
      <path d="M17 220 l-3 -12 m3 12 l7 -15 M153 218 l-7 -10 m7 10 l4 -17 M382 217 l-5 -10 m5 10 l6 -16 M488 217 l-2 -13 m2 13 l9 -10" fill="none" stroke="#657b4c" strokeWidth="2" />
    </svg>
    <figcaption>{plantas.map(p => p.nombre).join(' · ')}{plantas.length ? ' · ' : ''}{animal.nombre}<small>Especies de este piso. Su presencia varía según el lugar.</small></figcaption>
  </figure>;
}
