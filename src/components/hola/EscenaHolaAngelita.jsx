import React, { useEffect, useState } from 'react';
import ChagraAgentAvatar from '../ChagraAgentAvatar';
import Typewriter from '../Typewriter';
import CapaViva from './viva/CapaViva';
import './escenaHola.css';

/**
 * EscenaHola — el amanecer en la vereda: el paisaje vivo de la bienvenida.
 *
 * Es lo primero que ve un campesino al abrir Chagra, y tiene que prometer lo
 * que la app ya es: compais con cuerpo, aire y un mundo detrás. Aquí no hay
 * tarjeta plana: hay un cielo que baja de índigo a miel, tres planos de
 * cordillera con perspectiva atmosférica, bruma que deriva, un sol que
 * respira y motas de polen que suben. El compai (Angelita por defecto, o el
 * que la persona ya eligió — fix 2026-07-25) VUELA en ese aire, a la
 * izquierda porque mira hacia la derecha, y habla en una burbuja de papel
 * con la misma tinta de su familia rubber-hose.
 *
 * El dibujo del compai NO se toca: se usa `ChagraAgentAvatar` tal cual, con
 * su vocabulario de estados (`angelitaEstados.js`). Lo que cambia es la
 * pantalla alrededor.
 *
 * Todo el movimiento es CSS (escenaHola.css): transform/opacity, cero JS por
 * frame. Con `prefers-reduced-motion` la escena queda quieta y completa, y el
 * saludo de entrada ('invita' unos segundos antes de aquietarse) se omite.
 *
 * Props:
 *   - estado:    estado conversacional del compai (acompana|senala|pensando…).
 *   - mensaje:   lo que dice en la burbuja (null → sin burbuja).
 *   - variante:  'amplia' (identidad) | 'compacta' (pasos 2-6) | 'celebra' (listo).
 *   - nombreCompai: nombre propio para el aria (Angelita, el jaguar…).
 *   - children:  la cabecera (paso + costura + saltar) sobre el cielo.
 */

/* Motas deterministas (sin Math.random: mismo paisaje en cada captura). */
const MOTAS = Array.from({ length: 7 }, (_, i) => ({
  x: (i * 37 + 9) % 92,
  y: 38 + ((i * 23) % 44),
  d: 11 + ((i * 7) % 9),
  r: -((i * 5) % 11),
  s: 0.6 + ((i * 3) % 4) / 5,
  dx: ((i % 3) - 1) * 14,
}));

/* Matas de café sobre la CRESTA de la loma cercana (viewBox 0 0 800 300):
   del mismo verde que la loma, así festonean la silueta contra el monte del
   medio — se leen como cafetal, no como manchas dentro del cerro. */
const MATAS = [
  [28, 243, 22, 12], [78, 232, 18, 10], [138, 218, 24, 13], [196, 219, 20, 11],
  [256, 217, 26, 14], [322, 213, 18, 10], [382, 214, 24, 13], [446, 213, 20, 11],
  [508, 217, 26, 14], [576, 214, 18, 10], [636, 219, 24, 13], [700, 228, 20, 11],
  [758, 239, 24, 13],
];

function prefiereQuietud() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const SALUDO_MS = 3400;

export default function EscenaHolaAngelita({
  estado = 'acompana',
  mensaje = null,
  variante = 'amplia',
  nombreCompai = 'Angelita',
  children = null,
}) {
  // El saludo: al llegar hace "venga" con la manita (invita) un ratico y
  // luego se aquieta en el estado que el paso le pida. Sin movimiento
  // (reduced-motion) va directo al estado del paso.
  const [saludando, setSaludando] = useState(() => !prefiereQuietud());
  useEffect(() => {
    if (!saludando) return undefined;
    const t = setTimeout(() => setSaludando(false), SALUDO_MS);
    return () => clearTimeout(t);
  }, [saludando]);

  // La burbuja se re-monta cuando cambia el mensaje (typewriter desde cero)
  // pero no en el primer render, donde la entrada la coreografía el CSS.
  const [primerMensaje] = useState(mensaje);
  const estadoEfectivo = saludando && (estado === 'acompana') ? 'invita' : estado;

  return (
    <>
      <div className="hola-escena" data-variante={variante} data-testid="hola-escena">
      <div className="hola-cielo" aria-hidden="true" />
      <div className="hola-sol" aria-hidden="true" />
      <div className="hola-motas" aria-hidden="true">
        {MOTAS.map((m, i) => (
          <span
            key={i}
            className="hola-mota"
            style={{
              left: `${m.x}%`,
              top: `${m.y}%`,
              '--d': `${m.d}s`,
              '--r': `${m.r}s`,
              '--s': m.s,
              '--dx': `${m.dx}px`,
            }}
          />
        ))}
      </div>

      <div className="hola-bruma hola-bruma--1" aria-hidden="true" />

      <svg
        className="hola-cordillera"
        viewBox="0 0 800 300"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="hola-monte hola-monte--lejos"
          d="M0,152 C60,124 110,96 170,112 C230,128 262,78 322,96 C382,114 420,66 482,84 C542,100 590,58 652,90 C704,116 752,100 800,122 L800,300 L0,300 Z"
        />
        <path
          className="hola-monte hola-monte--medio"
          d="M0,198 C50,182 92,150 152,160 C212,170 252,138 312,150 C372,162 412,134 472,150 C542,168 602,140 662,158 C722,176 762,166 800,182 L800,300 L0,300 Z"
        />
        <path
          className="hola-monte hola-monte--cerca"
          d="M0,244 C60,228 122,206 202,216 C282,226 332,200 422,210 C512,220 562,206 642,216 C722,226 762,236 800,242 L800,300 L0,300 Z"
        />
        <g className="hola-matas">
          {MATAS.map(([cx, cy, rx, ry], i) => (
            <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} />
          ))}
        </g>
      </svg>

      <div className="hola-bruma hola-bruma--2" aria-hidden="true" />

      <div className="hola-compai hola-compai-llega" data-testid="hola-compai" data-estado={estadoEfectivo}>
        <span className="hola-compai-halo" aria-hidden="true" />
        <ChagraAgentAvatar
          estado={estadoEfectivo}
          size={168}
          ariaLabel={`${nombreCompai}, su compai, le da la bienvenida`}
        />
      </div>
      <CapaViva compai="angelita" />

      {mensaje ? (
        <div
          key={mensaje}
          className={`hola-burbuja${mensaje !== primerMensaje ? ' hola-burbuja--nueva' : ''}`}
          role="status"
          aria-live="polite"
          data-testid="hola-burbuja"
        >
          <Typewriter texto={mensaje} velocidadMs={22} retardoMs={mensaje === primerMensaje ? 1100 : 160} />
        </div>
      ) : null}

      <div className="hola-tierra" aria-hidden="true" />
      </div>
      <div className="hola-panel">
      <div className="flex flex-col gap-1.5">
        <p className="hola-ceja text-[11px] uppercase tracking-widest font-bold">
          Su chagra empieza aquí
        </p>
        <h1 className="hola-titulo text-[1.9rem] text-slate-100">
          Cuéntenos de usted
        </h1>
        <p className="text-sm text-slate-400">
          Dos toques y arrancamos. Todo se puede saltar.
        </p>
      </div>
      {children}
      </div>
    </>
  );
}
