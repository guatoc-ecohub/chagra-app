/**
 * PaisajeArranque — el valle dibujado en tinta que recorre el arranque.
 *
 * Los seis pasos son seis estaciones de un mismo camino: la cámara (un
 * translateX por capa, con parallax) viaja de una a otra en vez de cambiar de
 * pantalla. Todo es SVG estático y transform/opacity en CSS: nada de filtros
 * ni de canvas, para que un celular de gama media lo mueva sin esfuerzo.
 *
 * Estaciones (paso → lo que se ve):
 *   0 la caja del compai · 1 el poste donde cae el pin de la ubicación ·
 *   2 la montaña con sus pisos térmicos · 3 los surcos · 4 el invernadero y
 *   las materas · 5 la casa, que se enciende al llegar.
 *
 * La caja tiene dos mitades: el fondo va en la capa del suelo y el FRENTE en
 * una capa encima del compai, así el compai sale de adentro de verdad.
 */
import React from 'react';
import PaisajeHumboldt from './PaisajeHumboldt.jsx';

const TINTA = 'var(--onba-tinta)';
/** @type {React.SVGAttributes<SVGElement>} */
const trazo = { stroke: TINTA, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' };
/** @type {React.SVGAttributes<SVGElement>} */
const borde = { stroke: TINTA, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' };

/* Bandas del piso térmico (las de locationService: 1000, 2000 y 3000 msnm). */
const PISOS = [
  { id: 'cálido', nombre: 'Cálido', color: '#e3b563' },
  { id: 'templado', nombre: 'Templado', color: '#9cc063' },
  { id: 'frío', nombre: 'Frío', color: '#6f9a6a' },
  { id: 'páramo', nombre: 'Páramo', color: '#b9b58c' },
];
const ALTURA_TOPE = 4200;

/** @param {{ i: number, className?: string, children?: React.ReactNode }} props */
function Estacion({ i, className = '', children }) {
  return <div className={`onba-estacion ${className}`} style={{ '--i': i }}>{children}</div>;
}

/** @param {{ abierta: boolean }} props */
export function CajaFondo({ abierta }) {
  return (
    <svg viewBox="0 0 200 170" className="onba-caja-svg" aria-hidden="true">
      {/* destello amarillo DETRÁS del compai: se ve el salto a través de él */}
      <g className="onba-caja-estallido">
        <path d={Array.from({ length: 14 }, (_, k) => {
          const a = (-180 + k * (180 / 13)) * (Math.PI / 180);
          const r = k % 2 ? 58 : 96;
          return `${k ? 'L' : 'M'}${(100 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`;
        }).join(' ') + ' Z'} fill="#f6c453" fillOpacity="0.9" {...borde} strokeWidth={3} />
      </g>
      {/* boca abierta de la caja: el hueco oscuro de donde sale el compai */}
      <path d="M22 52 L178 52 L170 40 L30 40 Z" fill={abierta ? '#4a2e1a' : '#c48b50'} {...borde} />
    </svg>
  );
}

/** @param {{ nombre?: string, abierta: boolean }} props */
export function CajaFrente({ nombre, abierta }) {
  return (
    <svg viewBox="0 0 200 170" className="onba-caja-svg" aria-hidden="true">
      <g className="onba-caja-cuerpo">
        <path d="M20 52 L180 52 L178 164 L22 164 Z" fill="#d7a262" {...borde} />
        <path d="M21 90 H179 M22 127 H178" {...borde} strokeWidth={2} />
        <path d="M34 54 V162 M166 54 V162" {...borde} stroke="#a86f3b" strokeWidth={9} />
        <path d="M29.5 54 V162 M38.5 54 V162 M161.5 54 V162 M170.5 54 V162" {...borde} strokeWidth={1.4} />
        {[[34, 64], [166, 64], [34, 152], [166, 152]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={3} fill={TINTA} />)}
        <text x="100" y="116" textAnchor="middle" className="onba-caja-rotulo" {...((abierta ? nombre : 'CHAGRA')?.length > 7 ? { textLength: 112, lengthAdjust: 'spacingAndGlyphs' } : {})}>{abierta ? (nombre || 'CHAGRA') : 'CHAGRA'}</text>
        <text x="100" y="146" textAnchor="middle" className="onba-caja-rotulo onba-caja-rotulo--chico">{abierta ? 'COMPAI' : '¿QUIÉN VA?'}</text>
      </g>
      <g className="onba-caja-tapa">
        <path d="M12 38 L188 38 L186 56 L14 56 Z" fill="#c48b50" {...borde} />
        <path d="M60 38 V56 M140 38 V56" {...borde} strokeWidth={2} />
      </g>
      {/* estallido de tinta al abrir: rayos y polvo, se ven solo una vez */}
      <g className="onba-caja-estallido">
        {Array.from({ length: 9 }, (_, k) => {
          const a = (-164 + k * 18.5) * (Math.PI / 180);
          const r1 = 104; const r2 = 150;
          return <path key={k} d={`M${(100 + Math.cos(a) * r1).toFixed(1)} ${(50 + Math.sin(a) * r1).toFixed(1)} L${(100 + Math.cos(a) * r2).toFixed(1)} ${(50 + Math.sin(a) * r2).toFixed(1)}`} {...borde} strokeWidth={6} />;
        })}
      </g>
      <g className="onba-caja-polvo">
        <circle cx="20" cy="160" r="14" fill="#efe4c6" {...borde} strokeWidth={2} />
        <circle cx="182" cy="158" r="16" fill="#efe4c6" {...borde} strokeWidth={2} />
        <circle cx="4" cy="146" r="9" fill="#efe4c6" {...borde} strokeWidth={2} />
      </g>
    </svg>
  );
}

function Letrero() {
  return (
    <svg viewBox="0 0 120 150" className="onba-prop onba-prop--letrero" aria-hidden="true">
      <path d="M58 150 V52 M66 150 V52" {...borde} fill="none" strokeWidth={4} stroke="#6b4426" />
      <path d="M58 150 V52 M66 150 V52" {...borde} fill="none" strokeWidth={1.4} />
      <path d="M8 18 L108 12 L112 50 L12 56 Z" fill="#e8c48a" {...borde} />
      <text x="60" y="41" textAnchor="middle" className="onba-letrero-texto" transform="rotate(-3 60 36)">CHAGRA</text>
    </svg>
  );
}

/** @param {{ ubicado: boolean }} props */
function PostePin({ ubicado }) {
  return (
    <svg viewBox="0 0 120 190" className="onba-prop onba-prop--poste" aria-hidden="true">
      <ellipse cx="60" cy="184" rx="34" ry="6" fill="rgba(43,33,24,.25)" />
      <g className={`onba-pin ${ubicado ? 'onba-pin--cae' : ''}`}>
        <path d="M60 180 Q30 120 30 96 A30 30 0 1 1 90 96 Q90 120 60 180 Z" fill="#d9543a" {...borde} />
        <circle cx="60" cy="96" r="12" fill="#fffdf4" {...borde} />
      </g>
    </svg>
  );
}

/** @param {{ altitud?: number | null }} props */
function MontanaPisos({ altitud }) {
  const alto = typeof altitud === 'number' && Number.isFinite(altitud) ? Math.max(0, Math.min(ALTURA_TOPE, altitud)) : null;
  // la montaña ocupa y ∈ [30, 250]; cada banda son 1000 m, el páramo hasta la cima
  const yDe = (m) => 250 - (m / ALTURA_TOPE) * 220;
  const bandas = [0, 1000, 2000, 3000, ALTURA_TOPE];
  const mid = (a, b) => (yDe(a) + yDe(b)) / 2;
  return (
    <svg viewBox="0 0 300 260" className="onba-prop onba-prop--montana" aria-hidden="true">
      <defs>
        <clipPath id="onba-montana-forma"><path d="M6 252 Q60 190 96 120 Q124 60 150 30 Q176 60 204 120 Q240 190 294 252 Z" /></clipPath>
      </defs>
      <g clipPath="url(#onba-montana-forma)">
        {PISOS.map((p, k) => <rect key={p.id} x="0" y={yDe(bandas[k + 1])} width="300" height={yDe(bandas[k]) - yDe(bandas[k + 1]) + 1} fill={p.color} />)}
        {bandas.slice(1, 4).map((m) => <path key={m} d={`M0 ${yDe(m)} Q150 ${yDe(m) + 8} 300 ${yDe(m)}`} fill="none" stroke={TINTA} strokeWidth={1.6} strokeDasharray="6 5" />)}
      </g>
      <path d="M6 252 Q60 190 96 120 Q124 60 150 30 Q176 60 204 120 Q240 190 294 252" fill="none" {...borde} />
      {PISOS.map((p, k) => (
        <text key={p.id} x={k === 3 ? 150 : 150} y={mid(bandas[k], bandas[k + 1]) + 5} textAnchor="middle" className="onba-piso-rotulo">{p.nombre}</text>
      ))}
      {alto != null && (
        <g className="onba-montana-marca" style={{ transform: `translateY(${yDe(alto)}px)` }}>
          <path d="M218 0 H262" {...borde} fill="none" strokeWidth={2.4} />
          <circle cx="212" cy="0" r="7" fill="#d9543a" {...borde} strokeWidth={2.4} />
          <text x="266" y="5" className="onba-piso-rotulo onba-piso-rotulo--marca">Usted</text>
        </g>
      )}
    </svg>
  );
}

function Surcos() {
  return (
    <svg viewBox="0 0 320 170" className="onba-prop onba-prop--surcos" aria-hidden="true">
      <path d="M8 164 L72 70 L248 70 L312 164 Z" fill="#8a5a3b" {...borde} />
      {[0, 1, 2, 3, 4].map((k) => {
        const xb = 34 + k * 63; const xt = 86 + k * 37;
        return <path key={k} d={`M${xt} 72 L${xb} 162`} stroke="#5f3b22" strokeWidth={5} strokeLinecap="round" />;
      })}
      {[0, 1, 2, 3].map((k) => {
        const xb = 66 + k * 63; const xt = 104 + k * 37;
        return [0.2, 0.5, 0.8].map((t) => {
          const x = xt + (xb - xt) * t; const y = 72 + 90 * t; const s = 0.6 + t * 0.7;
          return <path key={`${k}-${t}`} d={`M${x} ${y} q${-6 * s} ${-10 * s} ${-12 * s} ${-8 * s} M${x} ${y} q${6 * s} ${-12 * s} ${12 * s} ${-10 * s}`} fill="#7fae4a" stroke={TINTA} strokeWidth={1.8} strokeLinejoin="round" />;
        });
      })}
      <path d="M252 72 V30 M252 44 Q236 40 232 28 M252 38 Q266 30 274 32" {...borde} fill="none" strokeWidth={2.4} />
    </svg>
  );
}

function Invernadero() {
  return (
    <svg viewBox="0 0 320 180" className="onba-prop onba-prop--invernadero" aria-hidden="true">
      <path d="M20 170 V96 Q110 10 200 96 V170 Z" fill="#e6f0f2" fillOpacity="0.75" {...borde} />
      <path d="M65 170 V58 M110 170 V40 M155 170 V58 M20 124 Q110 50 200 124" {...borde} fill="none" strokeWidth={1.8} />
      {[40, 80, 130, 175].map((x) => <path key={x} d={`M${x} 170 q6 -18 12 0`} fill="#7fae4a" {...borde} strokeWidth={1.8} />)}
      {[[232, 170], [270, 170], [300, 170]].map(([x, y], k) => (
        <g key={x}>
          <path d={`M${x - 14} ${y - 30} H${x + 14} L${x + 10} ${y} H${x - 10} Z`} fill="#c9774a" {...borde} strokeWidth={2.4} />
          <path d={`M${x} ${y - 30} Q${x - 12 + k * 4} ${y - 52} ${x - 16} ${y - 56} M${x} ${y - 30} Q${x + 8} ${y - 50} ${x + 16} ${y - 58}`} fill="none" stroke="#3f6d2a" strokeWidth={4} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

/** @param {{ encendida: boolean }} props */
function Casa({ encendida }) {
  return (
    <svg viewBox="0 0 240 200" className={`onba-prop onba-prop--casa ${encendida ? 'onba-casa--llego' : ''}`} aria-hidden="true">
      <path d="M190 60 V26 H210 V78" fill="#b5673f" {...borde} />
      <g className="onba-humo"><circle cx="200" cy="14" r="7" fill="#efe4c6" {...borde} strokeWidth={2} /><circle cx="210" cy="-2" r="9" fill="#efe4c6" {...borde} strokeWidth={2} /></g>
      <path d="M26 102 L120 30 L214 102 Z" fill="#b5673f" {...borde} />
      <path d="M40 100 H200 V194 H40 Z" fill="#f2e3c2" {...borde} />
      <path d="M100 194 V138 Q120 124 140 138 V194" fill="#7a4a2a" {...borde} />
      <rect className="onba-casa-luz" x="56" y="120" width="30" height="28" fill="#5b4a35" {...borde} />
      <rect className="onba-casa-luz" x="154" y="120" width="30" height="28" fill="#5b4a35" {...borde} />
      <path d="M71 120 V148 M56 134 H86 M169 120 V148 M154 134 H184" stroke={TINTA} strokeWidth={2} />
      <path d="M8 194 H232" {...borde} fill="none" />
      {[16, 222].map((x) => <path key={x} d={`M${x} 194 q-8 -24 0 -40 q8 16 0 40`} fill="#7fae4a" {...borde} strokeWidth={2.2} />)}
    </svg>
  );
}

/** @param {{ paso: number, altitud?: number | null, ubicado: boolean, llego: boolean, caja?: { fondo?: React.ReactNode } }} props */
export default function PaisajeArranque({ paso, altitud, ubicado, llego, caja }) {
  return (
    <div className="onba-paisaje" aria-hidden="true">
      <div className="onba-sol">
        <svg viewBox="-60 -60 120 120">
          <g className="onba-sol-rayos">
            {Array.from({ length: 12 }, (_, k) => <path key={k} d="M0 -36 L5 -52 L-5 -52 Z" transform={`rotate(${k * 30})`} fill="#f6c453" stroke={TINTA} strokeWidth={2} strokeLinejoin="round" />)}
          </g>
          <circle r="28" fill="#f6c453" stroke={TINTA} strokeWidth={3} />
          <path d="M-10 -4 q3 -4 6 0 M4 -4 q3 -4 6 0 M-9 8 q9 8 18 0" fill="none" stroke={TINTA} strokeWidth={2.4} strokeLinecap="round" />
        </svg>
      </div>
      <svg className="onba-nube onba-nube--a" viewBox="0 0 160 60"><path d="M14 50 Q2 50 6 38 Q4 24 22 26 Q28 8 52 14 Q66 0 88 12 Q110 4 118 24 Q142 20 146 38 Q156 52 138 52 Z" fill="#fffdf4" stroke={TINTA} strokeWidth={3} strokeLinejoin="round" /></svg>
      <svg className="onba-nube onba-nube--b" viewBox="0 0 160 60"><path d="M14 50 Q2 50 6 38 Q4 24 22 26 Q28 8 52 14 Q66 0 88 12 Q110 4 118 24 Q142 20 146 38 Q156 52 138 52 Z" fill="#fffdf4" stroke={TINTA} strokeWidth={3} strokeLinejoin="round" /></svg>

      <div className="onba-capa onba-capa--lejos" style={{ '--paso': paso }}>
        <svg viewBox="0 0 2600 400" preserveAspectRatio="none">
          <path d="M0 400 L0 210 Q90 120 180 170 Q260 60 380 150 Q470 80 560 160 Q690 40 820 150 Q900 100 990 170 Q1100 50 1230 150 Q1320 90 1420 170 Q1540 60 1660 150 Q1760 90 1850 160 Q1980 50 2100 150 Q2200 100 2300 170 Q2420 70 2520 150 L2600 170 L2600 400 Z" fill="#9db9a2" {...trazo} />
          <path d="M0 400 L0 280 Q150 210 300 260 Q450 200 620 250 Q800 190 980 250 Q1150 200 1320 260 Q1500 200 1680 250 Q1860 200 2040 260 Q2220 210 2400 250 L2600 240 L2600 400 Z" fill="#7fa37a" {...trazo} />
        </svg>
      </div>

      <div className="onba-capa onba-capa--cerca" style={{ '--paso': paso }}>
        <svg className="onba-suelo" viewBox="0 0 6000 400" preserveAspectRatio="none">
          <path d="M0 400 L0 90 Q300 50 600 80 Q900 110 1200 80 Q1500 50 1800 85 Q2100 110 2400 80 Q2700 55 3000 85 Q3300 110 3600 80 Q3900 50 4200 85 Q4500 110 4800 80 Q5100 55 5400 85 Q5700 105 6000 80 L6000 400 Z" fill="#8fbf57" {...trazo} />
          <path d="M-20 300 Q400 250 800 290 Q1300 340 1800 280 Q2300 230 2800 290 Q3300 340 3800 285 Q4300 235 4800 290 Q5300 330 6020 280" fill="none" stroke={TINTA} strokeWidth={26} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d="M-20 300 Q400 250 800 290 Q1300 340 1800 280 Q2300 230 2800 290 Q3300 340 3800 285 Q4300 235 4800 290 Q5300 330 6020 280" fill="none" stroke="#e8cf98" strokeWidth={20} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {Array.from({ length: 60 }, (_, k) => {
            const x = 50 + k * 100 + ((k * 37) % 40);
            const y = 150 + ((k * 53) % 70);
            return <path key={k} d={`M${x} ${y} l6 -14 l6 14`} fill="none" stroke="#4f7a2e" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        <Estacion i={0} className="onba-estacion--caja">{caja?.fondo}</Estacion>
        <Estacion i={0} className="onba-estacion--letrero"><Letrero /></Estacion>
        <Estacion i={1} className="onba-estacion--poste"><PostePin ubicado={ubicado} /></Estacion>
        {altitud == null && <Estacion i={2} className="onba-estacion--montana"><MontanaPisos altitud={altitud} /></Estacion>}
        {altitud == null && <Estacion i={3} className="onba-estacion--surcos"><Surcos /></Estacion>}
        {altitud == null && <Estacion i={4} className="onba-estacion--invernadero"><Invernadero /></Estacion>}
        <Estacion i={5} className="onba-estacion--casa"><Casa encendida={llego} /></Estacion>
      </div>
      <PaisajeHumboldt altitud={altitud} />
    </div>
  );
}

/** Capa por ENCIMA del compai: el frente de la caja, que viaja con el suelo. */
/** @param {{ paso: number, children?: React.ReactNode }} props */
export function FrenteDelSuelo({ paso, children }) {
  return (
    <div className="onba-capa onba-capa--cerca onba-capa--frente" style={{ '--paso': paso }} aria-hidden="true">
      <Estacion i={0} className="onba-estacion--caja">{children}</Estacion>
    </div>
  );
}
