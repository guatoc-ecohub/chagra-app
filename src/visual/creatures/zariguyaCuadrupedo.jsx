import { grabado } from './zariguyaGrabado.js';

/* Hombro alto, silla dorsal y grupa cargada; el vientre cuelga entre apoyos.
   Se conservan la escala r6 y los extremos de cruz e inserción de cola. */
const LOMO = 'M -16,-1 C -17,-5 -14,-10 -10,-11 L -10.6,-11.8 -8.7,-11.4 -9,-12 -7.4,-11.5 C -5.5,-10.8 -4.8,-9.3 -3,-9.5 C 0,-9.8 2,-11.8 6,-12.2 L 6.8,-12.8 7,-12.2 8.5,-12.6 8.4,-12 C 12,-12 16,-10 17,-7 L 17.8,-7.4 17.5,-5.8 18.2,-6 17.9,-4.4 C 19.1,-1.4 17.7,2.5 15,5 L 15.3,5.8 13.8,5.5 13.6,6.4 12.3,5.9 C 9.5,4.5 8.7,4.8 7,5.5 L 6.3,6.4 5.7,5.9 4.8,6.6 4.3,6 C 1.6,7 -2,6.7 -5,5.8 L -5.8,6.3 -6,5.5 -7.1,5.8 -7.3,4.9 C -9.5,4.4 -9.5,3 -11,3.2 C -13,2.5 -15,2 -16,-1 Z';

const flujoLomo = (x, y) => 0.3 + 0.9 * Math.max(0, Math.min(1, (y + 12) / 20)) - (x > 12 ? 0.5 : 0);
const GRABADO_LOMO = grabado({ x0: -17, x1: 18, y0: -14, y1: 8, n: 1480, semilla: 13, largo: 1.15, flujo: flujoLomo });
const PUNTAS_LOMO = grabado({ x0: -17, x1: 18, y0: -14, y1: 4, n: 540, semilla: 97, largo: 1.0, flujo: flujoLomo });

const PELO_ANCA = grabado({ x0: -3.5, x1: 3, y0: -4, y1: 3, n: 90, semilla: 37, largo: 1.1, flujo: (x) => 1.4 - x * 0.15 });
const PELO_BRAZO = grabado({ x0: -2.8, x1: 0.5, y0: -4, y1: 3, n: 45, semilla: 53, largo: 0.9, flujo: () => 1.2 });

// Loaded roots, grounded ankles: each side remains a cubic curve through the joint.
/* El pie apoya 3 unidades más arriba que antes: patas cortas y cuerpo bajo,
   como en el walk-cycle de las láminas. */
const PIE = 13;
const BAJA = 16 - PIE;
function contorno(trasera, avance = -1.5, alza = 0, vientre = 3) {
  const a = avance;
  const y = PIE - alza;
  // Hombro → codo hacia atrás → muñeca; anca → rodilla → corvejón.
  // Las cuatro fases comparten comandos para que CSS interpole el contorno.
  return trasera
    ? `M -4,-5 C 0,-8 5,-5 5,-1 C 5,2 2,4 0,5 C 0,6 ${a + 3.5},7 ${a + 3.5},8.5 C ${a + 3.5},10 ${a + 0.2},${y - 2} ${a},${y} C ${a - 0.6},${y + 0.5} ${a - 2.9},${y + 0.5} ${a - 3.4},${y} C ${a - 3},${y - 2} ${a + 0.8},9 ${a + 0.5},8.7 C ${a - 1.5},8 -6,5 -6,${vientre} C -7,${vientre} -7,-2 -4,-5 Z`
    : `M -3.8,-5 C -2,-6 1,-6 2.5,-4 C 3,-1 1.5,2 2.5,4 C 4,5 3,6 1,7 C ${a - 0.3},9 ${a - 0.3},${y - 2} ${a},${y} C ${a - 0.6},${y + 0.5} ${a - 2.9},${y + 0.5} ${a - 3.4},${y} C ${a - 3.9},${y - 3} ${a - 2.5},8 -1.5,5.5 C -3.2,5 -4,2 -4,0 C -4.5,-2 -5,-4 -3.8,-5 Z`;
}

function Pata({ x, y, trasera = false, fase, paleta: p, tinta, masa, lejana = false }) {
  return <g transform={`translate(${x} ${y + BAJA})`}>
    <g className="zcq-pata" style={{ '--zcq-fase': `${fase}s` }} data-apoyo={trasera ? 'trasero' : 'delantero'} data-lado={lejana ? 'derecho' : 'izquierdo'}>
      <defs>
        <linearGradient id={`${masa}-pata-${x}`} gradientUnits="userSpaceOnUse" x1="-2" y1="-5" x2="2" y2="14">
          <stop offset="0" stopColor={p.cuerpoLuz} />
          <stop offset="0.5" stopColor={p.cuerpo} />
          <stop offset="1" stopColor={lejana ? p.cuerpoSombra : p.cuerpo} />
        </linearGradient>
      </defs>
      <path className="zcq-flexion" d={contorno(trasera, -1.5, 0, 6 - y)}
        style={{ '--zcq-contacto': `path("${contorno(trasera, -4, 0, 6 - y)}")`, '--zcq-impulso': `path("${contorno(trasera, 4, 0, 6 - y)}")`, '--zcq-recoge': `path("${contorno(trasera, 0, 3.2, 6 - y)}")`, '--zcq-alcanza': `path("${contorno(trasera, -3.5, 1.6, 6 - y)}")` }}
        fill={`url(#${masa}-pata-${x})`} />
      {!lejana && <path d={trasera
        ? 'M 1,-2 C 3,0 2.8,3 0.5,5.5 C 2,3 2,0.4 1,-2 Z'
        : 'M 0.8,-2 C 2,0 1.5,3 0,5 C 0.8,2.8 1,0.5 0.8,-2 Z'}
        fill={p.cuerpoSombra} opacity="0.6" />}
      <path d={trasera ? PELO_ANCA : PELO_BRAZO} fill="none" stroke={p.brillo} strokeWidth="0.05" opacity="0.7" />
      {/* Short fur strokes follow the root; no closed cap across the shoulder. */}
      <path d={trasera ? 'M -2,-3 q 1,2 1,3 M 0,-2 q 1,2 0.7,3 M 2,-1 q 0.5,2 -0.2,3' : 'M -2,-3 q 0.8,2 0.7,3 M 0,-2 q 0.6,2 0.3,3'}
        fill="none" stroke={p.cuerpoSombra} strokeWidth="0.13" />
      <g className="zcq-pie" style={{ transformOrigin: `-2px ${PIE}px` }}>
        {/* The ankle widens into the palm before the toes spread. */}
        <g transform={`translate(-1.7 ${PIE - 0.6})`}>
          <path d="M -1.4,-0.8 Q 0.2,-1.2 1.5,-0.3 L 1.7,0.6 Q 1.3,1.2 0,1.15 L -1.8,2 Q -2.8,2.4 -3.15,2.1 Q -3.5,1.8 -2.4,1.4 L -3.5,1.6 Q -4.3,1.7 -4.5,1.3 Q -4.6,0.9 -3.7,0.7 L -1.4,0.4 L -4.2,0.65 Q -5,0.6 -4.8,0.15 Q -4.6,-0.2 -3.9,-0.2 L -1.5,-0.15 L -3.8,-0.35 Q -4.6,-0.4 -4.3,-0.85 Q -4,-1.1 -3.3,-0.9 Z" fill={p.piel} stroke={tinta} strokeWidth="0.18" />
          <ellipse className="zcq-planta" cx="0" cy="0.35" rx="0.9" ry="0.45" fill={p.pielSombra} />
          {trasera && <path className="zcq-pulgar" d="M 0.8,0.2 Q 2.2,0.2 2.7,1.1 Q 2.8,1.6 2.2,1.45 L 0.7,0.9" fill={p.piel} stroke={tinta} strokeWidth="0.18" />}
          <path d="M -4.25,-0.85 q -0.8,0 -0.85,0.55 l 0.8,-0.1 M -4.8,0.15 q -0.7,0.1 -0.65,0.6 l 0.75,-0.25 M -4.4,1.2 q -0.7,0.2 -0.55,0.65 l 0.75,-0.3" fill={p.garra} />
          <path d="M -3.05,1.9 q -0.6,0.1 -0.6,0.6 l 0.8,-0.25 Z" fill={p.garra} />
          <path d="M -3,-0.85 l -0.1,0.4 M -3.5,-0.15 l 0,0.45 M -3.1,0.85 l 0.15,0.5 M -1,-0.4 l 0.5,0.3" fill="none" stroke={p.pielSombra} strokeWidth="0.12" />
        </g>
      </g>
    </g>
  </g>;
}

export function CuerpoCuadrupedo({ paleta, tinta, dorso, masa, panza, cabeza, cola, children }) {
  const comunes = { paleta, tinta, masa };
  return <g className="zcq-cuerpo">
    {/* The tail root shares the hip load; its two bones trail that motion. */}
    <g transform="translate(0 -4)">
      <g className="zcq-cola-altura">
        <g className="zcq-cola-cadera">
          <g transform={`translate(14 ${BAJA - 1}) rotate(55 6.7 7.2)`}>{cola}</g>
        </g>
      </g>
    </g>
    <g transform="translate(0 -4)">
      <Pata {...comunes} x={-2} y={1} fase={-0.78} lejana />
      <Pata {...comunes} x={18.7} y={1} trasera fase={0} lejana />
      <Pata {...comunes} x={-8} y={3} fase={0} />
      <Pata {...comunes} x={10.9} y={3} trasera fase={-0.78} />
      <defs>
        <g id={`${masa}-torso`} transform="translate(2.5 0) scale(1.2 1)">
          <path className="zcq-pecho" d={LOMO} fill={`url(#${dorso}-continuo)`} />
          <path d="M -13,-4 C -8,-3 -8,1 -5,3 Q 0,6 8,3 C 12,3 10,7 7,8 Q 1,10 -5,8 C -9,6 -10,2 -13,-4 Z" fill={`url(#${panza})`} clipPath={`url(#${masa}-lomo-limite)`} opacity="0.5" />
          <defs>
            <linearGradient id={`${masa}-mechon-luz`} x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0" stopColor={paleta.brillo} stopOpacity="0" />
              <stop offset="0.4" stopColor={paleta.brillo} stopOpacity="0.55" />
              <stop offset="1" stopColor={paleta.brillo} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${masa}-mechon-sombra`} x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0" stopColor={paleta.cuerpoSombra} stopOpacity="0" />
              <stop offset="0.75" stopColor={paleta.cuerpoSombra} stopOpacity="0.8" />
              <stop offset="1" stopColor={paleta.cuerpoSombra} stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id={`${dorso}-continuo`} gradientUnits="userSpaceOnUse" x1="0" y1="-14" x2="0" y2="20">
              <stop offset="0" stopColor={paleta.cuerpoLuz} />
              <stop offset="0.5" stopColor={paleta.cuerpo} />
              <stop offset="0.72" stopColor={paleta.cremaSombra} />
              <stop offset="1" stopColor={paleta.cuerpo} />
            </linearGradient>
          </defs>
          <path d={LOMO}
            fill="none" stroke={tinta} strokeWidth="0.28" />
          {/* Solapes de pelo: cada lóbulo recibe luz y deja sombra bajo su punta. */}
          <g clipPath={`url(#${masa}-lomo-limite)`}>
            <path d="M -15,-8 Q -11,-13 -7,-10 C -3,-7 -7,-1 -6,3 L -8,1 -7.5,3.8 Q -13,0 -12,-4 Z M -4,-8 Q 3,-13 8,-12 C 5,-9 3,-6 -1,-4 L 0,-6 -3,-4.7 -2,-7 Z M 7,-9 Q 12,-13 16,-7 C 18,-3 16,1 13,3 L 14,-0.2 11,2 Q 13,-3 7,-9 Z M -5,-2 C -1,-5 3,-6 6,-8 C 7,-4 4,-1 0,2 L 1,0 -2,2 -1.5,0.3 -4,2 Z M 2,2 Q 7,-3 11,-3 Q 14,1 9,5 L 9,3 6,5 6.3,3 3,5 Z"
              fill={`url(#${masa})`} />
            <path d="M -11,-7 Q -7,-8 -8,-2 L -9,-3 -8.8,0 Q -11,-2 -11,-7 Z M -1,-8 Q 3,-11 6,-11 Q 3,-8 0,-7 L 1,-8.8 Z M 10,-8 Q 14,-9 15,-4 L 13,-5 14,-2 Q 12,-3 10,-8 Z M -2,-2 Q 1,-5 4,-5 L 2,-2 0,-1 0.5,-2.8 Z M 6,1 Q 8,-1 10,0 L 8,3 8,1.4 5,3 Z"
              fill={`url(#${masa}-mechon-luz)`} />
            <path d="M -12,-3 Q -11,2 -7,4 L -8,2 -5,4 Q -8,0 -7,-3 Q -8,0 -9,-1 Z M -4,-5 Q -1,-3 3,-6 Q 0,-1 -4,0 L -3,-2 -5,-0.7 Z M 9,-6 Q 14,-2 11,2 L 13,1 12,4 Q 17,1 15,-4 L 15,-1 Q 13,-5 9,-6 Z M -4,3 Q 1,5 5,2 L 3,4 6,3 Q 1,7 -4,5 Z"
              fill={`url(#${masa}-mechon-sombra)`} />
          </g>
          {/* Grabado de la lámina: rayado de buril que corre de la cabeza a la
              grupa, y puntas claras de guardia; recortado por el lomo. */}
          <clipPath id={`${masa}-lomo-limite`}><path d={LOMO} /></clipPath>
          <g clipPath={`url(#${masa}-lomo-limite)`} fill="none" strokeLinecap="round" aria-hidden="true">
            <path d={GRABADO_LOMO} stroke={paleta.cuerpoSombra} strokeWidth="0.065" opacity="0.28" />
            <path d={PUNTAS_LOMO} stroke={paleta.brillo} strokeWidth="0.05" opacity="0.35" />
          </g>

        </g>
        <clipPath id={`${masa}-pecho-apoyo`}><rect x="-30" y="-30" width="30.02" height="60" /></clipPath>
        <clipPath id={`${masa}-cadera-apoyo`}><rect x="0" y="-30" width="30" height="60" /></clipPath>
      </defs>
      {/* Both halves reuse the drawing; their common x=0 hinge follows the shared lift.
          The visible flank follows the near legs, not the opposite diagonal. */}
      <g transform={`translate(0 ${BAJA})`}>
      <g className="zcq-espinazo">
        <g className="zcq-carga-pecho"><g clipPath={`url(#${masa}-pecho-apoyo)`}><use href={`#${masa}-torso`} /></g></g>
        <g className="zcq-carga-cadera"><g clipPath={`url(#${masa}-cadera-apoyo)`}><use href={`#${masa}-torso`} /></g></g>
        <g className="zcq-lomo">{children}</g>
      </g>
      </g>
      <g transform={`translate(0 ${BAJA})`}>
        <g className="zcq-cuello">
          <path d="M -15,-8 Q -10,-10 -7,-5 C -6,-1 -8,3 -11,4 L -12,3 -12,4 -14,2.5 Q -17,1 -17,-3 Z" fill={`url(#${dorso}-continuo)`} />
          <path d="M -16,-3 Q -15,1 -11,2 L -12.2,0.5 -10.4,1.2 -11,-0.5 M -14,-5 Q -11,-4 -10,-2" fill="none" stroke={paleta.brillo} strokeWidth="0.2" />
          <g transform="translate(-12.5 9.5) rotate(4 0 -14)">{cabeza}</g>
        </g>
      </g>
    </g>
  </g>;
}
