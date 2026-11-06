import { useId } from 'react';
import ChagraAgentAvatarJaguar from '../ChagraAgentAvatarJaguar';
import './escenaHolaJaguar.css';
import CapaViva from './viva/CapaViva';

/** El contrato de EscenaHola, con una orilla abierta frente al bosque. */
export default function EscenaHolaJaguar({
  estado = 'acompana',
  mensaje = null,
  variante = 'amplia',
  nombreCompai = 'El jaguar',
  children = null,
}) {
  const id = useId();
  return (
    <div className="hola-jaguar" data-variante={variante} data-testid="hola-escena" data-compai="jaguar">
      <section className="hj-ventana" aria-label="Paisaje del jaguar">
        <svg className="hj-paisaje" viewBox="0 0 600 480" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-luz`} x2=".7" y2="1">
            <stop stopColor="#123b2f" /><stop offset=".55" stopColor="#779666" /><stop offset="1" stopColor="#c5cc90" />
          </linearGradient>
          <linearGradient id={`${id}-agua`} x2="0" y2="1">
            <stop stopColor="#92ac83" /><stop offset="1" stopColor="#315e48" />
          </linearGradient>
          <linearGradient id={`${id}-orilla`} x2="0" y2="1">
            <stop stopColor="#849261" /><stop offset="1" stopColor="#355b35" />
          </linearGradient>
        </defs>
        <path fill={`url(#${id}-luz)`} d="M0 0H600V480H0Z" />
        <g fill="#466e47" opacity=".55">
          <path d="M125 0h12l-8 305h-12ZM245 0h8l15 298h-16ZM386 0h15l-7 305h-14ZM494 0h9l8 298h-14Z" />
          <path d="M0 141Q40 113 79 138Q100 99 136 117Q163 84 201 103Q230 77 262 105Q296 76 327 111Q359 80 390 98Q431 73 457 100Q494 61 530 96Q570 76 600 99V0H0Z" />
        </g>
        <path fill="#345d3b" d="M0 261Q23 230 58 244Q78 205 114 229Q142 207 168 238Q205 207 236 244Q268 221 294 250Q329 226 365 244Q399 201 431 224Q465 197 493 219Q538 176 568 214L600 201V337H0Z" />
        <path fill={`url(#${id}-agua)`} d="M264 276Q344 283 424 266Q508 248 600 275V434Q527 407 474 395Q414 375 396 346Q377 315 264 309Z" />
        <g fill="none" stroke="#d0d6a4" strokeWidth="1.5" opacity=".5">
          <path d="M391 284h66m18 -6h28m-164 21h50m49 6h79m-106 19h52m29 18h65m-28 28h47m-20 27h31" />
        </g>
        <path fill={`url(#${id}-orilla)`} stroke="#33583b" strokeWidth="2" d="M0 298Q82 279 163 303Q229 321 298 315Q385 312 410 347Q436 382 500 410Q536 426 600 436V480H0Z" />
        <path fill="#173c29" stroke="#102e23" strokeWidth="2" d="M0 0H62Q50 93 51 183Q52 243 80 284L139 323L79 311L48 293L51 327L28 308L0 321Z" />
        <path fill="#556846" d="M20 0H38Q26 167 37 220Q44 270 77 293Q44 280 28 249Q14 182 20 0Z" />
        <path fill="#244b2d" d="M0 32Q49 9 80 34Q118 9 151 37Q180 18 216 47Q185 64 153 56Q123 79 91 65Q61 91 32 68L0 79ZM600 0H514Q486 22 465 64Q496 89 527 63Q562 85 600 63Z" />
        <g fill="none" strokeLinecap="round">
          <path stroke="#294c2d" strokeWidth="9" d="M565 284L552 64M591 294L587 37M531 279L526 105" />
          <path stroke="#849466" strokeWidth="2" d="M561 230l9 -1m-12 -46l9 -1m-12 -46h9m20 101h9m-10 -56h9m-63 50h8m-10 -51h8" />
        </g>
        <path fill="#315c35" d="M600 109Q569 86 542 113Q514 86 489 114L519 121Q482 115 458 142Q496 149 520 135Q528 159 555 152Q577 176 600 160ZM600 222Q566 190 539 214Q510 194 484 224Q511 226 531 221Q536 249 561 239Q582 258 600 247Z" />
        <path fill="#143e28" d="M0 416Q43 388 76 415Q111 396 145 433Q171 413 201 448Q271 427 314 465L360 480H0ZM600 393Q565 378 547 404Q513 394 496 421L462 449Q502 439 530 458Q570 433 600 454Z" />
        <g fill="#4f763f" stroke="#214b2d" strokeWidth="1.5">
          <path d="M48 434Q0 418 0 377Q33 382 48 434Q29 374 47 349Q74 381 48 434Q69 385 100 379Q93 420 48 434Z" />
          <path d="M567 429Q531 406 519 369Q556 375 567 429Q552 374 574 342Q590 383 567 429Q579 386 600 378V401Q589 421 567 429Z" />
        </g>
        <g fill="none" stroke="#a2b473" strokeWidth="1.3" opacity=".5">
          <path d="M48 424L47 362M46 427L7 389M53 426L91 390M567 420L574 356M561 416L530 382M168 350l22 -3m-10 12l12 1m122 20l25 -2m-12 9l16 1" />
        </g>
        </svg>
        <div className="hj-aire" aria-hidden="true" />
        <div className="hj-animal" data-testid="hola-compai" data-estado={estado}>
          <ChagraAgentAvatarJaguar estado={estado} size={360} ariaLabel={`${nombreCompai}, su compai, le da la bienvenida`} />
        </div>
        <CapaViva compai="jaguar" />
        <div className="hj-costura" aria-hidden="true" />
      </section>
      {mensaje ? <div className="hj-mensaje" role="status" aria-live="polite" data-testid="hola-burbuja">{mensaje}</div> : null}
      {children ? <div className="hc-tarjeta hj-formulario">{children}</div> : null}
    </div>
  );
}
