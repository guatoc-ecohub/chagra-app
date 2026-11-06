import { useId } from 'react';
import ChagraAgentAvatarOsoBaston from '../ChagraAgentAvatarOsoBaston';
import '../../styles/hola-chagra.css';
import './escenaHolaOsoBaston.css';
import CapaViva from './viva/CapaViva';

export default function EscenaHolaOsoBaston({ estado = 'acompana', mensaje = null, variante = 'amplia', nombreCompai = 'El oso del bastón', children = null }) {
  const id = useId();
  return (
    <div className="hola-oso" data-compai="oso-baston" data-variante={variante} data-testid="hola-escena">
      <section className="hob-ventana" aria-labelledby={`${id}-titulo`}>
        <svg className="hob-paisaje" viewBox="0 0 600 580" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id={`${id}-aire`} x2=".8" y2="1"><stop stopColor="#193e38" /><stop offset=".6" stopColor="#92ad91" /><stop offset="1" stopColor="#41694b" /></linearGradient>
            <linearGradient id={`${id}-suelo`} x2="0" y2="1"><stop stopColor="#788b60" /><stop offset="1" stopColor="#254d35" /></linearGradient>
          </defs>
          <path fill={`url(#${id}-aire)`} d="M0 0H600V580H0Z" />
          <path fill="#557d6b" d="M0 298Q72 279 135 191Q169 163 215 218Q249 201 290 145Q327 96 358 143Q404 210 446 175Q500 124 600 144V430H0Z" />
          <g fill="#3f6957" opacity=".7"><path d="M119 75h9l-7 355h-17ZM209 26h8l14 403h-17ZM381 0h13l-5 437h-16ZM468 59h8l19 379h-16Z" /><path d="M0 115Q28 74 65 91Q94 35 140 70Q165 42 206 64Q240 21 287 61Q324 30 361 51Q395 15 437 51Q487 21 514 64Q563 36 600 55V0H0Z" /></g>
          <path d="M0 341Q24 310 50 332Q71 293 103 321Q139 286 171 330Q208 303 233 344Q271 320 302 346Q353 304 390 329Q432 286 466 320Q503 291 535 315Q574 284 600 306V483H0Z" fill="#315d45" stroke="#365c46" strokeWidth="2" />
          <path d="M0 435Q156 385 268 426Q376 444 600 391V580H0Z" fill={`url(#${id}-suelo)`} stroke="#355039" strokeWidth="2" />
          <path d="M375 406Q308 440 332 465Q361 494 451 521L509 580H203Q260 534 291 515Q319 494 292 475Q270 450 337 421Z" fill="#8b9270" opacity=".65" />
          <g stroke="#1b3e31" strokeWidth="2" strokeLinejoin="round">
            <path fill="#284d3b" d="M0 0H83L72 190Q66 297 92 385L126 444L79 425L55 394L38 451L9 466L25 407L28 280Z" />
            <path fill="#69805a" stroke="none" d="M45 0H61L51 226Q48 342 74 389L59 376Q29 308 38 212Z" />
            <path fill="#234735" d="M600 0H535Q548 81 537 152L505 195L481 218L504 214L535 186Q541 328 513 409L479 439L522 426L552 396L573 437L600 448Z" />
            <path fill="#607a50" stroke="none" d="M551 0H565Q581 178 565 280Q560 352 540 390Q560 280 548 183Q566 64 551 0Z" />
          </g>
          <g fill="#345e3f" stroke="#254a34" strokeWidth="2">
            <path d="M0 29Q44 0 90 27Q119 8 150 37Q194 12 221 44Q192 69 156 55Q133 84 95 64Q50 92 0 71ZM600 60Q575 39 548 57Q525 28 495 57Q464 40 444 71Q473 95 508 84Q552 109 600 90Z" />
            <path d="M0 487Q29 457 64 480Q87 451 118 480Q152 461 178 500Q204 486 231 526L253 580H0ZM600 466Q565 442 536 470Q511 453 490 484Q455 466 432 510Q395 497 375 534L359 580H600Z" />
          </g>
          <g fill="#76975b" stroke="#2e5439" strokeWidth="1.5">
            <path className="cv-hierba" d="M70 547Q28 533 15 496Q51 498 70 547Q44 502 62 464Q86 496 70 547Q82 494 123 482Q113 522 70 547Z" />
            <path className="cv-hierba" d="M528 551Q493 530 475 496Q515 497 528 551Q509 489 539 461Q554 506 528 551Q553 512 588 509Q569 543 528 551Z" />
          </g>
          <g fill="none" stroke="#b2bc81" strokeWidth="1.4" opacity=".65"><path d="M69 536L63 477M67 539L25 507M76 537L112 493M528 540L538 475M522 539L486 507M535 542L575 518M32 232l9 -35m4 144l5 -25m510 -61l5 -32M163 491l20 -2m180 33l25 5m-133 32l25 -4" /></g>
        </svg>
        <div className="hob-bruma" aria-hidden="true" />
        <header className="hob-saludo"><p>Hola, soy el oso del bastón</p><h1 id={`${id}-titulo`}>Caminemos<br />esta chagra.</h1><p>A su paso, con los pies en la tierra.</p></header>
        <div className="hob-oso" data-testid="hola-compai" data-estado={estado}><ChagraAgentAvatarOsoBaston estado={estado} size={350} ariaLabel={`${nombreCompai}, su compai, le da la bienvenida`} /></div>
        <CapaViva compai="oso-baston" />
      </section>
        {mensaje ? <p className="hob-mensaje" role="status">{mensaje}</p> : null}
      {children ? <div className="hc-tarjeta hob-formulario">{children}</div> : null}
    </div>
  );
}
