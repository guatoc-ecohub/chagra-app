/*
 * Íconos en tinta para las respuestas del descenso (sin emoji: quien lee poco
 * se orienta por el dibujo). Trazo de pluma, relleno plano de acuarela.
 */
import React from 'react';

const T = '#231d17';
/** @type {React.SVGAttributes<SVGElement>} */
const base = { fill: 'none', stroke: T, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };

/** @param {{children: React.ReactNode, titulo?: string, className?: string, width?: number, height?: number}} props */
function Lienzo({ children, titulo, className, width = 48, height = 48 }) {
  return (
    <svg className={className} viewBox="0 0 48 48" width={width} height={height} aria-hidden={titulo ? undefined : 'true'} role={titulo ? 'img' : undefined}>
      {titulo ? <title>{titulo}</title> : null}
      {children}
    </svg>
  );
}

const ICONOS = {
  cultivo: (
    <Lienzo>
      <path d="M6 40 Q24 33 42 40" {...base} fill="#b48a55" />
      <path d="M24 36 V20" {...base} />
      <path d="M24 26 Q14 24 12 15 Q21 15 24 24" {...base} fill="#7bb257" />
      <path d="M24 22 Q33 19 36 10 Q27 10 24 20" {...base} fill="#5f9a47" />
    </Lienzo>
  ),
  frutales: (
    <Lienzo>
      <path d="M24 41 V24" {...base} strokeWidth="3" />
      <path d="M24 29 Q12 31 10 21 Q10 11 22 12 Q26 18 24 29 Z" {...base} fill="#6d9a4d" />
      <path d="M25 27 Q37 29 39 19 Q39 9 27 10 Q23 16 25 27 Z" {...base} fill="#83aa54" />
      <circle cx="18" cy="21" r="2.5" {...base} fill="#d45a3f" />
      <circle cx="32" cy="18" r="2.5" {...base} fill="#d45a3f" />
      <path d="M12 42 H36" {...base} />
    </Lienzo>
  ),
  animales: (
    <Lienzo>
      <ellipse cx="22" cy="28" rx="12" ry="9" {...base} fill="#f1e8d7" />
      <circle cx="34" cy="17" r="5.5" {...base} fill="#f1e8d7" />
      <path d="M32 11 l2 -4 l2 4" {...base} fill="#c0392b" />
      <path d="M39 17 l4 1 l-4 2" {...base} fill="#e8b04a" />
      <path d="M18 37 v5 M26 37 v5" {...base} />
      <path d="M11 26 Q6 22 9 18" {...base} />
    </Lienzo>
  ),
  restauro: (
    <Lienzo>
      <path d="M24 42 V26" {...base} strokeWidth="2.8" />
      <path d="M24 30 Q12 32 10 22 Q10 10 24 8 Q38 10 38 22 Q36 32 24 30 Z" {...base} fill="#4c8a45" />
      <path d="M17 20 q3 -3 6 0 M26 16 q3 -3 6 0" {...base} strokeWidth="1.6" />
      <path d="M8 42 H40" {...base} />
    </Lienzo>
  ),
  urbano: (
    <Lienzo>
      <path d="M8 42 V14 H26 V42" {...base} fill="#efe2c4" />
      <path d="M26 42 V22 H40 V42" {...base} fill="#e3cfa6" />
      <path d="M13 20 h4 M13 27 h4 M31 28 h4" {...base} />
      <path d="M6 34 H24" {...base} />
      <path d="M11 34 v-5 q-3 -3 0 -6 q3 3 0 6 M19 34 v-4 q3 -3 5 0 q-3 2 -5 0" {...base} fill="#7bb257" strokeWidth="1.8" />
      <path d="M4 42 H44" {...base} />
    </Lienzo>
  ),
  tecnico: (
    <Lienzo>
      <rect x="10" y="8" width="24" height="32" rx="3" {...base} fill="#f8f1de" />
      <path d="M15 17 h14 M15 23 h14 M15 29 h8" {...base} strokeWidth="1.8" />
      <path d="M36 14 l6 6 l-14 16 l-7 2 l1 -7 Z" {...base} fill="#e8b04a" />
    </Lienzo>
  ),
  balcon: (
    <Lienzo>
      <path d="M12 30 h24 l-3 12 h-18 Z" {...base} fill="#c96e48" />
      <path d="M24 30 V18" {...base} />
      <path d="M24 22 Q15 20 14 12 Q22 12 24 20 M24 20 Q32 17 34 9 Q26 9 24 18" {...base} fill="#7bb257" />
      <path d="M6 44 H42" {...base} />
    </Lienzo>
  ),
  invernadero: (
    <Lienzo>
      <path d="M6 40 V24 L24 10 L42 24 V40 Z" {...base} fill="#e9f1ee" />
      <path d="M15 40 V17 M24 40 V10 M33 40 V17" {...base} strokeWidth="1.5" />
      <circle cx="19" cy="33" r="3" {...base} fill="#5f9a47" />
      <circle cx="29" cy="33" r="3" {...base} fill="#5f9a47" />
    </Lienzo>
  ),
  finca: (
    <Lienzo>
      <path d="M4 22 Q14 12 24 20 Q34 10 44 20" {...base} fill="#9fb6b0" />
      <path d="M4 42 L20 24 M14 42 L22 24 M24 42 L24 24 M34 42 L26 24 M44 42 L28 24" {...base} strokeWidth="1.6" />
      <path d="M4 42 H44 M4 24 H44" {...base} />
    </Lienzo>
  ),
  cuadrado: (
    <Lienzo>
      <path d="M8 40 V22 L24 10 L40 22 V40 Z" {...base} fill="#e9f1ee" />
      <path d="M16 40 V16 M32 40 V16" {...base} strokeWidth="1.5" />
    </Lienzo>
  ),
  tunel: (
    <Lienzo>
      <path d="M6 40 Q6 10 24 10 Q42 10 42 40 Z" {...base} fill="#e9f1ee" />
      <path d="M15 40 Q15 16 24 14 M33 40 Q33 16 24 14" {...base} strokeWidth="1.5" />
    </Lienzo>
  ),
  casa_sombra: (
    <Lienzo>
      <rect x="7" y="14" width="34" height="26" {...base} fill="#e4ece6" />
      <path d="M7 22 L15 14 M7 30 L23 14 M7 38 L31 14 M13 40 L39 14 M21 40 L41 20 M29 40 L41 28" {...base} strokeWidth="1" />
    </Lienzo>
  ),
  pin: (
    <Lienzo>
      <path d="M24 44 Q10 28 10 19 A14 14 0 0 1 38 19 Q38 28 24 44 Z" {...base} fill="#e8b04a" />
      <circle cx="24" cy="19" r="5" {...base} fill="#fff6dc" />
    </Lienzo>
  ),
  cálido: (
    <Lienzo>
      <circle cx="16" cy="14" r="6" {...base} fill="#f4b04a" />
      <path d="M30 42 Q31 28 28 20" {...base} strokeWidth="2.6" />
      <path d="M28 20 Q20 16 16 22 M28 20 Q36 14 42 18 M28 20 Q24 10 18 8 M28 20 Q34 10 40 8" {...base} fill="#4f8e42" />
      <path d="M4 42 H44" {...base} />
    </Lienzo>
  ),
  templado: (
    <Lienzo>
      <ellipse cx="16" cy="30" rx="8" ry="10" {...base} fill="#2d5a33" />
      <ellipse cx="33" cy="30" rx="8" ry="10" {...base} fill="#3b6b3e" />
      <circle cx="14" cy="28" r="1.8" fill="#c0392b" />
      <circle cx="18" cy="33" r="1.8" fill="#c0392b" />
      <circle cx="34" cy="27" r="1.8" fill="#c0392b" />
      <path d="M4 42 H44" {...base} />
    </Lienzo>
  ),
  frío: (
    <Lienzo>
      <path d="M4 36 L14 26 L24 32 L34 22 L44 30" {...base} />
      <path d="M4 42 L44 42 L44 30 L34 22 L24 32 L14 26 L4 36 Z" fill="#b99a62" stroke="none" />
      <path d="M8 40 L18 30 M18 40 L28 34 M28 40 L38 28" {...base} strokeWidth="1.4" />
      <path d="M26 12 q6 -6 12 0 q4 0 4 4 h-20 q0 -4 4 -4" {...base} fill="#f4f1ea" />
    </Lienzo>
  ),
  páramo: (
    <Lienzo>
      <path d="M24 42 V24" {...base} stroke="#4b4034" strokeWidth="3" />
      <path d="M24 14 l3 6 l7 -2 l-4 6 l6 4 l-8 0 l-4 6 l-4 -6 l-8 0 l6 -4 l-4 -6 l7 2 Z" {...base} fill="#b9c4a4" />
      <path d="M8 42 l3 -8 M12 42 l0 -9 M16 42 l-2 -7 M34 42 l3 -8 M38 42 l0 -9" {...base} stroke="#b39a4f" strokeWidth="1.6" />
    </Lienzo>
  ),
  bocina: (
    <Lienzo>
      <path d="M8 19 H16 L26 10 V38 L16 29 H8 Z" {...base} fill="#f8f1de" />
      <path d="M32 17 Q37 24 32 31 M36 12 Q44 24 36 36" {...base} />
    </Lienzo>
  ),
};

/** Ícono en tinta por nombre (`pin`, `cultivo`, `frío`…). */
const ALIAS = {
  jardin: 'finca',
  'forma-cuadrado': 'cuadrado',
  'forma-tunel': 'tunel',
  'forma-casa_sombra': 'casa_sombra',
};

/** @param {{nombre?: string, id?: string, size?: number}} props */
export default function IconoTinta({ nombre, id, size = 48 }) {
  const clave = nombre || id;
  const icono = ICONOS[clave] || ICONOS[ALIAS[clave]];
  if (!icono) return null;
  return React.cloneElement(icono, { className: id ? 'onba-icono' : undefined, width: size, height: size });
}
