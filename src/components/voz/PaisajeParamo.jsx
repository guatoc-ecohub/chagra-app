import { memo, useId } from 'react';
import ChivitoEnParamo from './ChivitoEnParamo';

const ROSETAS = [-105, -78, -52, -26, 0, 26, 52, 78, 105];
const LEJANOS = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 167 + 32) % 1200, y: 410 + (i * 31) % 140, escala: .22 + (i % 4) * .08,
}));

function Frailejon({ x, y, escala = 1, semilla = 0 }) {
  return <g transform={`translate(${x} ${y}) scale(${escala})`}>
    <g className="paramo-frailejon" style={{ animationDelay: `${-semilla * 1.7}s` }}>
      <path d="M-16 4  -23 110Q0 127 23 110L16 4" fill="#6b6550" />
      {[18, 38, 58, 78, 98].map((alto) => <path key={alto} d={`M-19 ${alto} 0 ${alto + 22} 19 ${alto}`} fill="none" stroke="#aca080" strokeWidth="5" />)}
      {ROSETAS.map((angulo, i) => <g key={angulo} transform={`rotate(${angulo})`}>
        <path d="M0 8C-23-19-19-70 0-99C19-70 23-19 0 8Z" fill={i % 2 ? '#aebda9' : '#d4d9b8'} stroke="#687e72" strokeWidth="2" />
        <path d="M0 0V-85" stroke="#eef0d5" strokeWidth="2" opacity=".65" />
      </g>)}
      <path d="M9 0Q32-54 48-69M-8-1Q-37-47-43-64" fill="none" stroke="#87915e" strokeWidth="5" />
      {[[-43, -64], [48, -69]].map(([cx, cy]) => <g key={cx} transform={`translate(${cx} ${cy})`}>
        <circle r="10" fill="#e8bd55" stroke="#f8d778" strokeWidth="5" strokeDasharray="3 3" />
        <circle r="4" fill="#735c32" />
      </g>)}
      <circle r="10" fill="#899674" />
    </g>
  </g>;
}

const PaisajeParamo = memo(/** @param {{estado: string, pausada: boolean, compacto: boolean}} props */ function PaisajeParamo({ estado, pausada, compacto }) {
  const id = useId().replace(/:/g, '');
  const ref = (nombre) => `url(#${id}-${nombre})`;
  return <svg className="paramo-paisaje" viewBox={compacto ? '390 40 650 850' : '0 0 1200 850'}
    preserveAspectRatio="xMidYMax slice" role="img" aria-label="Chivito entre rocas y frailejones, con niebla que cruza el páramo">
    <defs>
      <linearGradient id={`${id}-cielo`} x2="0" y2="1"><stop stopColor="#708f9b" /><stop offset=".58" stopColor="#c4d0c5" /><stop offset="1" stopColor="#e9e2b9" /></linearGradient>
      <linearGradient id={`${id}-loma`} x2=".3" y2="1"><stop stopColor="#768f7f" /><stop offset="1" stopColor="#283f3a" /></linearGradient>
      <linearGradient id={`${id}-roca`} x2=".8" y2="1"><stop stopColor="#8c9991" /><stop offset=".5" stopColor="#526c66" /><stop offset="1" stopColor="#243b3a" /></linearGradient>
      <linearGradient id={`${id}-niebla`}><stop stopColor="#f0f0d8" stopOpacity="0" /><stop offset=".4" stopColor="#edf1e3" stopOpacity=".8" /><stop offset="1" stopColor="#e5eee4" stopOpacity="0" /></linearGradient>
      <radialGradient id={`${id}-halo`}><stop stopColor="#fff7c8" stopOpacity=".85" /><stop offset="1" stopColor="#fff7c8" stopOpacity="0" /></radialGradient>
      <filter id={`${id}-suave`} x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="17" /></filter>
      <pattern id={`${id}-piedra`} width="37" height="41" patternUnits="userSpaceOnUse"><path d="m4 9 9-3m13 24 5-6M7 35l3 2" stroke="#d4d5ae" strokeWidth="2" opacity=".22" /></pattern>
    </defs>
    <path fill={ref('cielo')} d="M-400-300H1600V900H-400Z" />
    <g className="paramo-sol"><circle cx="965" cy="155" r="180" fill={ref('halo')} /><circle cx="965" cy="155" r="37" fill="#fff2c0" />
      <path d="m936 178-487 433 115 29 427-454" fill="#fff4c9" opacity=".13" />
    </g>
    <path d="M-80 426 110 276 181 324 333 188 477 331 625 243 757 318 878 229 1084 358 1260 233V850H-80Z" fill="#879fa0" />
    <path d="m-100 496 282-132 169 45 153-83 164 130 169-98 196 55 267-90V850H-100Z" fill="#6f8986" />
    <path d="m327 200-54 121 63-40 45 25-19-66M878 237l-37 80 47-24 58 33" fill="#d6ddd0" opacity=".5" />
    <g className="paramo-niebla paramo-niebla-lejos" filter={ref('suave')} fill={ref('niebla')}><ellipse cx="360" cy="360" rx="520" ry="55" /><ellipse cx="965" cy="405" rx="410" ry="48" /></g>
    <path d="M-100 650Q149 452 395 518T824 504Q1004 443 1300 494V900H-100Z" fill={ref('loma')} />
    <g opacity=".55">{LEJANOS.map(({ x, y, escala }, i) => <Frailejon key={i} x={x} y={y} escala={escala} semilla={i} />)}</g>
    <path d="M170 573Q332 538 526 564L435 595 239 610Z" fill="#9dbdb8" />
    <g className="paramo-agua" fill="none" stroke="#e6edd7" strokeWidth="2"><path d="m250 572 154-4m-96 14 152-5m-94 14 42-2" /></g>
    <g fill={ref('roca')} stroke="#435b56" strokeWidth="2">
      <path d="m529 685 78-84 80-4 60 49-16 141-188 21Z" />
      <path d="m705 668 17-119 49-5 73 72-15 157Z" />
      <path d="m783 665 32-195 82-3 50 61 50 174-112 67Z" />
    </g>
    <g fill="#acb6a0"><path d="m607 601 80-4 31 26-87-6Z" /><path d="m722 549 49-5 24 24-64-7Z" /><path d="m815 470 82-3 24 30-88-14Z" /></g>
    <path d="m829 504 27 44-12 39 33 58m-240-19 26 28-16 57m105-131 13 34" fill="none" stroke="#293f3a" strokeWidth="3" />
    <path d="m607 601 80-4 60 49-16 141-188 21Zm208-131 82-3 50 61 50 174-112 67-102-104Z" fill={ref('piedra')} />
    <g fill="#c4c791" opacity=".75"><ellipse cx="673" cy="631" rx="16" ry="5" /><ellipse cx="866" cy="498" rx="19" ry="4" /><ellipse cx="794" cy="664" rx="17" ry="8" /></g>
    <Frailejon x={1010} y={520} escala={.95} semilla={3} />
    <Frailejon x={481} y={612} escala={.63} semilla={4} />
    <ChivitoEnParamo estado={estado} pausada={pausada} />
    <g className="paramo-viento" fill="none" stroke="#eff0d1" strokeWidth="2" opacity=".5"><path d="M128 450q110-23 162-4m273-148q79-17 123-4m193 359q68-21 117-9M306 696q68-21 117-9" /></g>
    <g className="paramo-niebla paramo-niebla-cerca" filter={ref('suave')} fill={ref('niebla')}><ellipse cx="420" cy="670" rx="440" ry="54" /><ellipse cx="1120" cy="700" rx="320" ry="40" /></g>
    <path d="M-100 801Q122 651 381 750T780 769Q1029 680 1300 775V970H-100Z" fill="#263f38" />
    <g className="paramo-pajonal" fill="none" stroke="#9caa7a" strokeWidth="3">{Array.from({ length: 24 }, (_, i) => <path key={i} d={`M${i * 57} 855q-30-70-43-92m43 92q-8-99 8-122m-8 122q14-73 37-88`} />)}</g>
    <Frailejon x={140} y={721} escala={1.65} semilla={2} />
    <Frailejon x={1120} y={745} escala={1.6} semilla={1} />
    <Frailejon x={340} y={828} escala={1.12} semilla={5} />
    <g className="paramo-niebla paramo-niebla-borde" filter={ref('suave')} fill={ref('niebla')}><ellipse cx="370" cy="844" rx="550" ry="52" /></g>
  </svg>;
});

export default PaisajeParamo;
