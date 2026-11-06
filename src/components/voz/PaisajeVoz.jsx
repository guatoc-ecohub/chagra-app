import { memo } from 'react';

function PaisajeVoz() {
  return (
    <div className="voz-espacio" aria-hidden="true">
      <div className="voz-cielo" />
      <div className="voz-luz-lejana" />
      <svg className="voz-montes" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice">
        <path className="voz-sierra-lejana" d="M0 360 130 304 215 326 390 193 490 271 635 204 787 326 926 245 1028 296 1170 188 1300 278 1440 220V800H0Z" />
        <path className="voz-sierra-media" d="M0 425Q120 320 260 384T540 364Q650 285 790 397T1100 366Q1300 290 1440 365V800H0Z" />
        <path className="voz-loma" d="M0 525Q245 363 506 490T960 446Q1180 374 1440 465V800H0Z" />
        <g className="voz-surcos" fill="none" strokeWidth="2">
          <path d="M860 447Q750 532 295 690M906 440Q870 546 560 752M960 435Q1000 536 880 800M1014 430Q1110 530 1200 800M1060 429Q1200 516 1480 720" />
        </g>
      </svg>
      <div className="voz-bruma" />
      <div className="voz-bruma-alta" />
      <div className="voz-luz-atencion" />
      <div className="voz-piso" />
      <div className="voz-marco voz-marco-izq" />
      <div className="voz-marco voz-marco-der" />
      <div className="voz-viga" />
      <div className="voz-rama">
        <svg viewBox="0 0 300 520" focusable="false">
          <path d="M-20 510Q195 314 210 0" fill="none" stroke="currentColor" strokeWidth="9" />
          <g fill="currentColor">
            <path className="voz-follaje-bajo" d="M67 412Q-15 298 19 250Q119 285 67 412M118 339Q132 218 239 217Q211 328 118 339" />
            <path className="voz-follaje-alto" d="M153 266Q57 206 80 138Q185 169 153 266M184 191Q183 77 274 67Q271 161 184 191M203 97Q116 38 143-15Q224 13 203 97" />
          </g>
        </svg>
      </div>
    </div>
  );
}

export default memo(PaisajeVoz);
