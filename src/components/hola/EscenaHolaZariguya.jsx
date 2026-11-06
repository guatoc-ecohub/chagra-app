import { useId } from 'react';
import ChagraAgentAvatarZariguya from '../ChagraAgentAvatarZariguya';
import './escenaHolaZariguya.css';

/** El contrato de EscenaHola, con la zarigüeya al nivel del suelo. */
export default function EscenaHolaZariguya({
  estado = 'acompana',
  mensaje = null,
  variante = 'amplia',
  nombreCompai = 'La zarigüeya',
  children = null,
}) {
  const id = useId();
  return (
    <div className="hola-zariguya" data-variante={variante} data-testid="hola-escena" data-compai="zariguya">
      <svg className="hz-paisaje" viewBox="0 0 600 480" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-aire`} x2="0" y2="1">
            <stop stopColor="#163f3e" /><stop offset=".58" stopColor="#a6b8a0" /><stop offset="1" stopColor="#547952" />
          </linearGradient>
          <linearGradient id={`${id}-suelo`} x2="0" y2="1">
            <stop stopColor="#73845b" /><stop offset="1" stopColor="#173e2b" />
          </linearGradient>
          <linearGradient id={`${id}-musgo`} x2="1" y2="1">
            <stop stopColor="#92a86b" /><stop offset=".48" stopColor="#436740" /><stop offset="1" stopColor="#193c2e" />
          </linearGradient>
        </defs>
        <path fill={`url(#${id}-aire)`} d="M0 0H600V480H0Z" />
        <path fill="#5d8071" d="M0 208Q45 190 80 150T174 147Q235 206 280 153T386 152Q459 106 500 131T600 101V480H0Z" />
        <path fill="#3a6650" d="M0 255Q27 213 58 228Q93 184 125 223Q155 200 184 234Q217 208 248 241Q290 208 331 244Q371 217 399 232Q443 177 475 210Q528 170 563 190L600 205V480H0Z" />
        <g fill="none" stroke="#315843" strokeWidth="5" opacity=".7">
          <path d="M68 325L91 124M91 192L120 145M91 226L55 174M454 336L438 90M444 172L472 125M517 320L535 149" />
        </g>
        <path fill={`url(#${id}-suelo)`} stroke="#274b35" strokeWidth="2" d="M0 335Q90 307 167 329Q236 357 315 351Q410 341 489 293L600 288V480H0Z" />
        <path fill="#203f30" d="M0 0H76Q60 86 48 160Q37 238 73 310L107 353L53 339L27 320L0 324Z" />
        <path fill="#52654a" stroke="#1d3b2d" strokeWidth="2" d="M9 0H43Q27 142 20 222Q25 282 66 328L32 310Q0 255 9 201Z" />
        <path fill={`url(#${id}-musgo)`} d="M0 306Q34 286 65 305Q85 289 103 314Q144 300 164 322L211 366Q174 351 145 354Q114 342 80 354Q42 334 0 352Z" />
        <g fill="none" stroke="#91a675" strokeWidth="1.5" opacity=".5">
          <path d="M19 308Q49 300 65 314M75 320Q114 306 136 327M36 330Q75 316 102 337M146 339L169 346M10 174L15 252M29 90L23 140" />
        </g>
        <path fill="#234c35" d="M600 260Q566 241 546 266Q503 255 493 288Q455 281 439 313Q472 335 510 325Q553 343 600 318Z" />
        <path fill="#527649" d="M600 278Q565 258 547 284Q515 272 500 299Q540 297 557 311L600 303Z" />
        <g fill="#709156" stroke="#294f36" strokeWidth="1.3">
          <path d="M542 315Q501 300 486 260Q533 262 542 315Q528 260 550 230Q571 270 542 315Q562 264 592 262Q584 301 542 315Z" />
          <path d="M74 272Q43 257 40 230Q66 232 74 272Q58 221 80 205Q93 238 74 272Q96 232 116 230Q102 262 74 272Z" />
        </g>
        <g fill="none" stroke="#bed09b" strokeWidth="1" opacity=".6">
          <path d="M542 309L493 267M543 309L550 241M548 311L584 270M74 263L79 216M75 264L107 238" />
        </g>
        <path fill="#133c2a" d="M0 409Q43 375 91 404Q137 383 171 416Q206 402 226 437Q297 418 332 450Q405 422 453 443Q485 409 523 425Q562 387 600 403V480H0Z" />
        <path fill="#385d38" d="M0 426Q49 399 86 425Q127 407 161 436Q87 431 57 453L0 465ZM427 459Q478 429 516 445Q559 414 600 435V480H462Z" />
        <g fill="none" stroke="#718259" strokeWidth="2" strokeLinecap="round" opacity=".65">
          <path d="M54 377l17 -4m-9 12l10 2m329 -9l17 -3m-10 11l12 2m31 -12l8 -4m-271 24l13 3m-6 8l9 -2m282 -42l13 -3" />
        </g>
      </svg>
      <div className="hz-bruma" aria-hidden="true" />
      {children ? <div className="hz-cabecera">{children}</div> : null}
      {mensaje ? <div className="hz-mensaje" role="status" aria-live="polite" data-testid="hola-burbuja">{mensaje}</div> : null}
      <div className="hz-animal" data-testid="hola-compai" data-estado={estado}>
        <ChagraAgentAvatarZariguya estado={estado} size={300} ariaLabel={`${nombreCompai}, su compai, le da la bienvenida`} />
      </div>
      <div className="hz-costura" aria-hidden="true" />
    </div>
  );
}
