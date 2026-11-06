import { useId } from 'react';
import { moonPathD } from '../../utils/skyEphemeris.js';
import './escenaAtmosfera.css';

// Geometría y partículas recuperadas del original versionado.
const GOTAS = Array.from({ length: 30 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  dur: 0.55 + ((i * 13) % 9) / 20,
  delay: -(((i * 29) % 17) / 10),
  op: 0.35 + ((i * 7) % 5) / 12,
}));

// Bancos y jirones son el ÚNICO material de la escena que sabe parecer masa de
// aire en movimiento: sirven de niebla al ras y, re-tintados y más lentos, de
// techo de nubes. Por eso se amplían aquí (6→9 y 4→7) en vez de inventar capas.
const BANCOS = Array.from({ length: 9 }, (_, i) => ({
  top: 12 + ((i * 23) % 68),
  w: 62 + ((i * 31) % 74),
  dur: 44 + ((i * 17) % 38),
  delay: -((i * 19) % 40),
  op: 0.42 + ((i * 11) % 5) / 10,
}));

const JIRONES = Array.from({ length: 7 }, (_, i) => ({
  top: 16 + ((i * 29) % 62),
  dur: 30 + ((i * 13) % 28),
  delay: -((i * 23) % 30),
}));

const MOTAS = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 41 + 7) % 100,
  y: 18 + ((i * 27) % 70),
  dur: 7 + ((i * 11) % 8),
  delay: -((i * 17) % 12),
  s: 0.6 + ((i * 7) % 5) / 6,
}));

const LUCIERNAGAS = Array.from({ length: 11 }, (_, i) => ({
  x: (i * 43 + 13) % 96,
  y: 42 + ((i * 31) % 46),
  dur: 9 + ((i * 13) % 7),
  blink: 2.4 + ((i * 7) % 9) / 3,
  delay: -((i * 19) % 11),
}));

/* NUBLADO — masas sueltas (vh de la ESCENA, que arranca ~9 vh bajo el borde de la pantalla):
   una panza que cierra la grieta por la izquierda, una nube baja con el lomo encendido dentro
   de la grieta y cuatro hilachas oscuras que barren con el viento (dos por la grieta, dos por
   el techo). Techo, panza, claro y banco derivan por CSS; nada se repinta por frame. */
const NUBES = [
  { x: -8, y: 30, w: 56, h: 10, tono: 'panza', dur: 96, delay: -12 },
  { x: 54, y: 31.5, w: 30, h: 6, tono: 'luz', dur: 118, delay: -49 },
  { x: 44, y: 33.4, w: 36, h: 1.4, tono: 'jiron', dur: 22, delay: -9 },
  { x: 62, y: 36.2, w: 34, h: 1.2, tono: 'jiron', dur: 27, delay: -20 },
  { x: 10, y: 9, w: 40, h: 1.6, tono: 'jiron', dur: 31, delay: -4 },
  { x: 40, y: 15.5, w: 44, h: 1.3, tono: 'jiron', dur: 25, delay: -16 },
];

/* NUBLADO — lo que pasa POR DELANTE de la UI (vh del viewport): masas que cruzan la pantalla
   entera de izquierda a derecha (viento del páramo) e hilachas más rápidas. */
const NUBES_FRENTE = [
  { y: 2, w: 88, h: 30, tono: 'masa', dur: 58, delay: -30 },
  { y: 30, w: 80, h: 28, tono: 'masa', dur: 48, delay: -8 },
  { y: 56, w: 92, h: 30, tono: 'masa', dur: 68, delay: -51 },
  { y: 18, w: 70, h: 22, tono: 'masa', dur: 76, delay: -62 },
  { y: 12, w: 64, h: 4, tono: 'hilacha', dur: 22, delay: -6 },
  { y: 40, w: 58, h: 3.4, tono: 'hilacha', dur: 28, delay: -19 },
  { y: 69, w: 68, h: 4.2, tono: 'hilacha', dur: 25, delay: -12 },
];

const ESTRELLAS = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 39 + 5) % 100,
  y: 2 + ((i * 23) % 52),
  dur: 2.5 + ((i * 11) % 10) / 3,
  delay: -((i * 13) % 8) / 2,
  s: i % 4 === 0 ? 2.4 : 1.6,
}));

function pisoAtmosphereStyle(piso, luz) {
  if ((piso === 'frio' || piso === 'paramo') && luz === 'noche') {
    return {
      '--ca-velo-alto': '0.72',
      '--ca-bruma-op': '0.64',
    };
  }
  if ((piso === 'calido' || piso === 'templado') && luz === 'dia') {
    return {
      '--ca-velo-alto': '0.68',
      '--ca-bruma-op': '0.22',
      '--ca-ladera-op': '0.58',
    };
  }
  return undefined;
}

/* Roseta elevada sobre una columna de hojas marcescentes.
   Referencias del grafo: espeletia_grandiflora y quercus_humboldtii.
   Curvas, agrupaciones y proporciones son decisiones de ilustración. */
function Frailejon({ x, y, escala }) {
  return (
    <g data-vegetacion="frailejon" transform={`translate(${x} ${y}) scale(${escala})`}>
      {/* La sombra proyectada se alarga y aclara según el estado de luz
          (scaleX + opacity vía tokens --ca-sombra-*, transicionados). */}
      <ellipse className="ca-sombra-planta" cx="-12" cy="3" rx="30" ry="5.5" />
      <path className="ca-tallo" d="M-7 2 Q-10 -35 -7 -91 L7 -91 Q10 -34 7 2 Z" />
      <path className="ca-falda" d="M-8 -88 Q-15 -64 -11 -8 L-7 -15 L-4 -4 L0 -12 L4 -5 L7 -17 L11 -10 Q15 -57 8 -88 Z" />
      <path className="ca-falda-fibras" d="M-7 -78 Q-11 -52 -8 -24 M-3 -85 Q-6 -48 -3 -15 M2 -82 Q-1 -49 2 -21 M6 -76 Q10 -46 7 -29 M-8 -61 l-2 17 M7 -55 l3 14" />
      <g className="ca-roseta" transform="translate(0 -94)">
        {[-126, -105, -84, -63, -42, -21, 0, 21, 42, 63, 84, 105, 126].map((a) => (
          <path key={a} className="ca-hoja" d="M0 5 C-4 -3 -9 -12 -6 -20 Q-4 -27 0 -28 Q6 -26 7 -19 C8 -10 3 -2 0 5 Z" transform={`rotate(${a})`} />
        ))}
        <path className="ca-roseta-lana" d="M-19 -5 Q-12 -1 -4 1 M-12 -16 Q-8 -8 -2 -2 M0 -24 L0 -4 M12 -16 Q8 -8 2 -2 M19 -5 Q12 -1 4 1" />
        <ellipse className="ca-roseta-corazon" cx="0" cy="1" rx="2.5" ry="1.8" />
      </g>
      <g className="ca-escarcha-hojas" transform="translate(0 -94)">
        {[-72, -48, -24, 0, 24, 48, 72].map((a) => (
          <path key={a} d="M0 -26 L0 -8" transform={`rotate(${a})`} />
        ))}
      </g>
      <path className="ca-escarcha-tallo" d="M-6 -80 h12 M-6 -52 h12 M-6 -20 h12" />
    </g>
  );
}

/* Dos estratos de robles: fustes descubiertos y copas estrechas solapadas.
   La bruma atraviesa el sotobosque sin convertir cada árbol en un icono. */
function BosqueFrio({ x, y, escala }) {
  return (
    <g data-vegetacion="roble-andino" transform={`translate(${x} ${y}) scale(${escala})`}>
      <ellipse className="ca-sombra-planta" cx="-12" cy="3" rx="55" ry="5.5" />
      {[[-34, -10, 0.78], [29, -6, 0.87], [0, 0, 0.90]].map(([dx, dy, s], i) => (
        <g key={dx} className={i < 2 ? 'ca-roble-lejano' : 'ca-roble-cercano'} transform={`translate(${dx} ${dy}) scale(${s})`}>
          <path className="ca-tallo" d="M-4 3 L-3 -45 L-16 -69 L-13 -71 L0 -52 L1 -111 L5 -111 L4 -66 L18 -85 L20 -82 L4 -56 L5 3 Z" />
          <path className="ca-hoja" d="M-9 -125 Q-1 -134 8 -126 Q21 -130 21 -114 Q33 -111 26 -97 Q38 -88 28 -78 Q35 -64 22 -59 Q11 -53 4 -63 Q-7 -55 -16 -63 Q-31 -57 -30 -74 Q-41 -82 -30 -94 Q-36 -109 -23 -113 Q-26 -126 -9 -125 Z" />
          <path className="ca-copa-luz" d="M-22 -109 Q-22 -120 -10 -118 Q-6 -132 6 -120 Q19 -126 18 -112 Q7 -118 3 -102 Q-9 -114 -22 -101 Z M-27 -90 Q-15 -96 -8 -85 Q0 -92 5 -82 Q-13 -87 -23 -77 Z" />
          <path className="ca-copa-sombra" d="M-28 -75 Q-17 -68 -9 -77 Q-1 -69 9 -80 Q23 -70 28 -88 Q37 -68 21 -63 Q12 -57 4 -67 Q-8 -59 -16 -68 Q-28 -63 -28 -75 Z" />
          <path className="ca-nervadura" d="M0 1 L1 -44 M1 -51 L-9 -67 M4 -60 L15 -77" />
        </g>
      ))}
      <path className="ca-bosque-bruma" d="M-70 -39 Q-34 -51 8 -39 Q39 -33 68 -44 L72 -29 Q30 -19 -11 -31 Q-45 -36 -70 -26 Z" />
    </g>
  );
}

function Pajonal() {
  return (
    <g className="ca-pajonal">
      {Array.from({ length: 32 }, (_, i) => (
        <path key={i} transform={`translate(${i * 27 - 14} ${112 + (i * 17) % 66})`}
          d="M-13 2 Q-12 -6 -19 -12 Q-7 -8 -4 0 Q-7 -16 -12 -22 Q-1 -14 0 -2 Q2 -19 7 -25 Q4 -10 5 0 Q11 -14 17 -16 Q10 -4 12 2 Z" />
      ))}
    </g>
  );
}

/* Siluetas del primer plano. La masa de copa prima sobre el detalle de hoja.
   Piso y porte: catálogo de arquetipos referenciado por el SSOT de especies. */
function Vegetacion({ piso, x, y, escala }) {
  if (piso === 'paramo') return <Frailejon x={x} y={y} escala={escala} />;
  if (piso === 'frio') return <BosqueFrio x={x} y={y} escala={escala} />;
  if (!piso) return null;
  const especie = { calido: 'guadua', templado: 'guayabo' }[piso];
  return (
    <g data-vegetacion={especie} transform={`translate(${x} ${y}) scale(${escala})`}>
      <ellipse className="ca-sombra-planta" cx="-12" cy="3" rx="36" ry="5.5" />
      {piso === 'calido' ? <>
        <path className="ca-tallo" d="M-15 2 L-23 -91 L-19 -91 L-10 2 Z M-3 2 L0 -106 L5 -106 L3 2 Z M10 2 Q17 -55 29 -89 L33 -89 Q22 -48 16 2 Z" />
        <path className="ca-cicatriz ca-nudos" d="M-21 -70 l5 -1 M-19 -48 l5 -1 M-16 -26 l5 -1 M0 -82 h5 M0 -58 h5 M-1 -34 h5 M24 -65 l5 2 M18 -44 l5 2 M13 -22 l5 2" />
        {/* Ramas arqueadas y penachos unidos, sin abanico de palma. */}
        <g className="ca-hoja">
          <path d="M3 -91 Q-14 -115 -40 -102 L-28 -100 L-43 -92 L-27 -94 L-35 -84 Q-11 -91 3 -78 Q17 -107 44 -99 L31 -94 L47 -92 L33 -88 L39 -81 Q17 -88 3 -72 Z" />
          <path d="M-16 -64 Q-34 -88 -55 -72 L-43 -72 L-57 -61 L-41 -65 L-49 -54 Q-29 -64 -15 -53 Q-5 -80 20 -70 L10 -66 L24 -61 L10 -61 L17 -54 Q-2 -63 -15 -44 Z" />
          <path d="M21 -55 Q34 -83 59 -71 L47 -67 L61 -64 L46 -61 L54 -54 Q32 -62 20 -44 Q9 -64 -10 -52 L0 -51 L-12 -44 L3 -45 L-2 -37 Q13 -45 20 -36 Z" />
        </g>
        <path className="ca-nervadura" d="M3 -86 Q-17 -104 -33 -98 M3 -83 Q25 -99 38 -94 M-16 -59 Q-35 -74 -48 -67 M22 -51 Q38 -70 52 -66" />
      </> : <>
        <path className="ca-tallo" d={'M-7 2 L-4 -32 L-25 -53 L-22 -57 L0 -40 L3 -62 L8 -62 L6 -35 L30 -52 L33 -49 L6 -27 L7 2 Z'} />
        <path className="ca-hoja" d={'M-47 -59 Q-61 -77 -39 -87 Q-37 -104 -15 -97 Q-2 -112 16 -98 Q38 -105 42 -88 Q61 -89 60 -70 Q72 -56 48 -49 Q35 -35 16 -45 Q1 -35 -15 -44 Q-39 -36 -47 -59 Z'} />
        <path className="ca-copa-luz" d={'M-44 -76 Q-44 -88 -29 -87 Q-28 -102 -12 -91 Q1 -104 14 -92 Q33 -100 38 -84 Q17 -90 7 -77 Q-12 -90 -25 -75 Z'} />
        <path className="ca-copa-sombra" d={'M-46 -64 Q-28 -49 -14 -62 Q3 -48 17 -60 Q37 -45 55 -63 Q52 -45 33 -47 Q23 -38 15 -49 Q-1 -39 -14 -49 Q-38 -41 -46 -64 Z'} />
        <path className="ca-nervadura" d="M-3 -4 L0 -28 M1 -38 L-13 -53 M6 -34 L20 -45" />
      </>}
    </g>
  );
}

/* Rayo ramificado: tronco con dos ramas; se enciende en pulsos cortos. */
const RAYO_D = 'M52 0 L44 38 L56 40 L40 92 L50 94 L34 150';
const RAYO_RAMAS = ['M44 38 L28 60 L22 84', 'M56 40 L70 66 L66 90 L78 112', 'M40 92 L26 112'];

/**
 * La luna de hoy (fase de lunarPhase), solo como cielo. El lado oscuro lleva
 * la luz cenicienta: el disco entero, tenue, con la luz que devuelve la
 * Tierra; encima, la parte iluminada con el terminador de moonPathD.
 */
export function Luna({ luna, className = 'ca-luna', testId = 'escena-luna' }) {
  const { kind, d } = moonPathD(luna.fraction, 50, 50, 40);
  return (
    <svg className={className} viewBox="0 0 100 100" data-testid={testId}
      data-iluminacion={luna.illumination.toFixed(4)} data-fase={kind}>
      <circle className="ca-luna__halo" cx="50" cy="50" r="48" />
      <circle className="ca-luna__ceniza" cx="50" cy="50" r="40" />
      {kind === 'full' && <circle className="ca-luna__luz" cx="50" cy="50" r="40" />}
      {kind === 'partial' && <path className="ca-luna__luz" d={d} />}
    </svg>
  );
}

/** Escena decorativa: el consumidor entrega los tres ejes del servicio. */
export default function EscenaAtmosfera({ condicion = null, luz = null, enso = null, piso = null, luna = null, lluvia = null, niebla = null }) {
  const rayoId = useId();
  const estiloDato = {
    ...(pisoAtmosphereStyle(['calido', 'templado', 'frio', 'paramo'].includes(piso) ? piso : null, luz) || {}),
    ...(lluvia ? { '--ca-lluvia-op': lluvia.opacidad, '--ca-lluvia-ritmo': lluvia.ritmo } : {}),
    ...(niebla != null ? { '--ca-niebla-dato': niebla } : {}),
  };
  const gotasVisibles = lluvia ? Math.round(GOTAS.length * Math.min(1, lluvia.cantidad / 64) + 0.5) : GOTAS.length;
  const validPiso = ['calido', 'templado', 'frio', 'paramo'].includes(piso) ? piso : null;
  return (
    <div className="ca-root ca-atmosfera" data-clima={condicion || undefined}
      data-piso={validPiso || undefined}
      data-luz={luz || undefined} data-enso={enso === 'nino' || enso === 'nina' ? enso : undefined}
      style={Object.keys(estiloDato).length ? estiloDato : undefined} aria-hidden="true">
      <div className="ca-pegajoso">
      <div className="ca-escena" aria-hidden="true">
        {/* Cielos: un gradiente por estado, crossfade de opacity (los
            background-image no interpolan; el velo cruzado sí). */}
        {['soleado', 'lluvia', 'niebla', 'dorada', 'noche', 'nublado', 'tormenta', 'helada'].map((id) => (
          <div key={id} className={`ca-cielo ca-cielo--${id}`} />
        ))}

        {/* Estrellas: noche despejada llena; en el crepúsculo solo las brillantes */}
        <div className="ca-capa ca-capa--estrellas">
          {ESTRELLAS.map((s, i) => (
            <span
              key={i}
              className="ca-estrella"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.s,
                height: s.s,
                animationDuration: `${s.dur}s`,
                animationDelay: `${s.delay}s`,
              }}
            />
          ))}
        </div>

        {/* Astro: el MISMO disco viaja y cambia de color según el estado
            (alto y blanco al mediodía, bajo, grande y ámbar en la dorada,
            luna fría de noche). */}
        <div className="ca-astro">
          <span className="ca-astro-disco" />
          <span className="ca-astro-crater" />
        </div>
        {luna && <Luna luna={luna} />}

        {/* Tormenta: relámpago que aclara el cielo y rayo ramificado */}
        <div className="ca-relampago" />
        <svg className="ca-rayo-tormenta" viewBox="0 0 100 160" preserveAspectRatio="xMidYMin meet">
          <path className="ca-rayo-tormenta__tronco" d={RAYO_D} />
          {RAYO_RAMAS.map((d) => <path key={d} className="ca-rayo-tormenta__rama" d={d} />)}
        </svg>

        {/* God-rays: abanico que respira, visible con sol franco (catálogo #6) */}
        <svg className="ca-rayos" viewBox="0 0 200 200">
          <defs>
            <linearGradient id={rayoId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--ca-rayo)" stopOpacity="0.5" />
              <stop offset="1" stopColor="var(--ca-rayo)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className="ca-rayos-giro">
            {[-64, -38, -14, 12, 38, 62].map((ang) => (
              <path
                key={ang}
                d="M100 100 L92 210 L108 210 Z"
                fill={`url(#${rayoId})`}
                transform={`rotate(${ang} 100 100)`}
              />
            ))}
          </g>
        </svg>

        {/* Techo de nubes (nublado): claro de la grieta, panza (sombra colgante), techo con
            borde deshecho por máscara de ruido, banco bajo con lomo, y las 4 masas sueltas. Solo se enciende con data-clima="nublado"; deriva lentísima por transform. */}
        <div className="ca-capa ca-capa--nubes">
          <div className="ca-claro" />
          <div className="ca-techo-sombra" />
          <div className="ca-techo" />
          <div className="ca-techo-bajo-base" />
          <div className="ca-techo-bajo-lomo" />
          <div className="ca-techo-bajo" />
          {NUBES.map((n, i) => (
            <span
              key={i}
              className={`ca-nube ca-nube--${n.tono}`}
              style={{
                left: `${n.x}vw`,
                top: `${n.y}vh`,
                width: `${n.w}vw`,
                height: `${n.h}vh`,
                animationDuration: `${n.dur}s`,
                animationDelay: `${n.delay}s`,
              }}
            />
          ))}
        </div>

        {/* Cordillera en 3 planos: perspectiva aérea (catálogo #8) + luz
            direccional de ladera (#7) vía gradiente fijo sobre los montes. */}
        <svg
          className="ca-cordillera"
          viewBox="0 0 800 340"
          preserveAspectRatio="xMidYMax slice"
        >
          <path
            className="ca-monte ca-monte--1"
            d="M0 216 Q60 168 120 190 Q180 210 240 152 Q300 106 360 168 Q420 222 480 178 Q540 140 600 176 Q660 210 720 170 Q760 146 800 168 L800 340 L0 340 Z"
          />
          <path
            className="ca-monte ca-monte--2"
            d="M0 256 Q80 206 160 236 Q240 264 320 212 Q400 168 480 226 Q560 276 640 228 Q720 192 800 232 L800 340 L0 340 Z"
          />
          <path
            className="ca-monte ca-monte--3"
            d="M0 298 Q100 252 220 282 Q340 310 460 262 Q580 222 700 276 Q750 296 800 268 L800 340 L0 340 Z"
          />
        </svg>
        <div className="ca-ladera-luz" />
        <div className="ca-bruma" />

        {/* Primer plano: vegetación del piso térmico con sombra viva */}
        <svg
          className="ca-frente"
          viewBox="0 -30 800 220"
          preserveAspectRatio="xMidYMax slice"
        >
          <path
            className="ca-suelo"
            d="M0 74 Q140 40 320 66 Q520 92 680 56 Q748 42 800 58 L800 190 L0 190 Z"
          />
          <path
            className="ca-pasto"
            d="M0 96 Q180 66 400 88 Q620 108 800 82 L800 190 L0 190 Z"
          />
          {/* escarcha del suelo: borde blanco-azul donde la luz rasante la toca */}
          <path className="ca-escarcha-suelo" d="M0 96 Q180 66 400 88 Q620 108 800 82" />
          {validPiso === 'paramo' && <Pajonal />}
          <Vegetacion piso={validPiso} x={104} y={132} escala={1.12} />
          <Vegetacion piso={validPiso} x={238} y={158} escala={1.5} />
          <Vegetacion piso={validPiso} x={636} y={126} escala={0.94} />
          <Vegetacion piso={validPiso} x={724} y={162} escala={1.32} />
        </svg>

        {/* Lluvia: cortina de trazos inclinados por el viento */}
        <div className="ca-capa ca-capa--lluvia">
          {GOTAS.slice(0, gotasVisibles).map((g, i) => (
            <span
              key={i}
              className="ca-gota"
              style={{
                left: `${g.x}%`,
                opacity: g.op,
                animationDuration: `calc(${g.dur}s * var(--ca-lluvia-ritmo, 1))`,
                animationDelay: `${g.delay}s`,
              }}
            />
          ))}
        </div>

        {/* Masa de aire: bancos anchos que derivan + jirones finos en contra.
            Al ras es niebla; alto, gris y lento es el techo del cielo nublado. */}
        <div className="ca-capa ca-capa--niebla">
          {BANCOS.map((b, i) => (
            <span
              key={i}
              className="ca-banco"
              style={{
                top: `${b.top}%`,
                width: `${b.w}vw`,
                opacity: b.op,
                '--ca-dur': `${b.dur}s`,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}
          {JIRONES.map((j, i) => (
            <span
              key={i}
              className="ca-jiron"
              style={{
                top: `${j.top}%`,
                '--ca-dur': `${j.dur}s`,
                animationDelay: `${j.delay}s`,
              }}
            />
          ))}
        </div>

        {/* Polvo dorado en suspensión (soleado tenue, dorada pleno) */}
        <div className="ca-capa ca-capa--polvo">
          {MOTAS.map((m, i) => (
            <span
              key={i}
              className="ca-mota"
              style={{
                left: `${m.x}%`,
                top: `${m.y}%`,
                transform: `scale(${m.s})`,
                animationDuration: `${m.dur}s`,
                animationDelay: `${m.delay}s`,
              }}
            />
          ))}
        </div>

        {/* Luciérnagas: salen con la humedad y al caer la tarde, no solo de noche */}
        <div className="ca-capa ca-capa--luci">
          {LUCIERNAGAS.map((l, i) => (
            <span
              key={i}
              className="ca-luci"
              style={{
                left: `${l.x}%`,
                top: `${l.y}%`,
                animationDuration: `${l.dur}s`,
                animationDelay: `${l.delay}s`,
              }}
            >
              <i style={{ animationDuration: `${l.blink}s` }} />
            </span>
          ))}
        </div>

        {/* Grades de luz por estado (catálogo #2): crossfade de planos */}
        {['soleado', 'lluvia', 'niebla', 'dorada', 'noche', 'nublado'].map((id) => (
          <div key={id} className={`ca-grade ca-grade--${id}`} />
        ))}

        {/* Viñeta + scrims de cine (catálogo #5) */}
        <div className="ca-vineta" />
        <div className="ca-scrim ca-scrim--alto" />
        <div className="ca-scrim ca-scrim--bajo" />
      </div>

      {/* NUBLADO — la nube pasa POR ENCIMA de la página (z 30, sobre el contenido), como el
          jirón sobre la UI del catálogo (#18): con esta densidad de texto, lo que queda detrás
          se pierde (corrección del operador 2026-09-06). Tres masas bajas que cruzan la
          pantalla, tres hilachas rápidas, la sombra de la nube que oscurece al pasar y una
          bruma que lame el borde inferior. Tonos y alfas topados para que el texto quede
          ≥ 4,5:1 debajo. Solo transform. */}
      <div className="ca-frente-nublado" aria-hidden="true">
        <div className="ca-sombra-pasa" />
        {NUBES_FRENTE.map((n, i) => (
          <span
            key={i}
            className={`ca-nube-frente ca-nube-frente--${n.tono}`}
            style={{
              top: `${n.y}vh`,
              width: `${n.w}vw`,
              height: `${n.h}vh`,
              animationDuration: `${n.dur}s`,
              animationDelay: `${n.delay}s`,
            }}
          />
        ))}
        <div className="ca-bruma-frente" />
      </div>
      </div>

      <div className="ca-jiron-ui" />
    </div>
  );
}
