/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Claves internas de actuación, sin texto visible. */
import { memo, useId } from 'react';
import { useVueloLuciernaga } from './useVueloLuciernaga';
import { LuciernagaCuerpo } from '../../visual/creatures/LuciernagaCuerpo';

// El reloj de vuelo mueve cuerpo, foco y reflejo sin renders por cuadro.
const NocheLuciernaga = memo(/** @param {{estado: string, pausada?: boolean}} props */ function NocheLuciernaga({ estado, pausada = false }) {
  const escenaRef = useVueloLuciernaga(pausada);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = nombre => `noche-${uid}-${nombre}`;
  const pintura = nombre => `url(#${id(nombre)})`;
  const cara = estado === 'hablando' ? 'hablar' : estado === 'mirando' || estado === 'pensando' ? 'leer' : 'idle';

  return <svg ref={escenaRef} className="luci-noche" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={id('fondo')} cx="60%" cy="55%" r="65%">
        <stop stopColor="#203f37" /><stop offset=".6" stopColor="#0b2425" /><stop offset="1" stopColor="#06171c" />
      </radialGradient>
      <linearGradient id={id('hoja')} x1=".2" y1="1" x2=".7" y2="0">
        <stop stopColor="#10251f" /><stop offset=".55" stopColor="#1c3529" /><stop offset="1" stopColor="#344634" />
      </linearGradient>
      <radialGradient id={id('foco')} data-foco gradientUnits="userSpaceOnUse" cx="591" cy="310.2" r="190">
        <stop stopColor="white" /><stop offset=".3" stopColor="#ddd" /><stop offset="1" stopColor="black" />
      </radialGradient>
      <mask id={id('luz-local')} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="560">
        <path fill={pintura('foco')} d="M0 0H1000V560H0Z" />
      </mask>
      <path id={id('juncos')} d="M55 550Q162 285 123 45Q255 275 55 550M900 535Q776 330 900 105Q937 300 900 535M90 560Q305 320 310 101Q395 386 90 560M820 550Q697 277 739 38Q848 323 820 550M480 540Q438 333 501 167Q537 369 480 540" />
      <path id={id('tallo')} className="luci-tallo" d="M783 460Q762 295 737 222" />
      <radialGradient id={id('suelo')}>
        <stop stopColor="#bba74b" stopOpacity=".45" /><stop offset="1" stopColor="#938747" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={id('agua')} x2="0" y2="1">
        <stop stopColor="#b4c781" stopOpacity=".45" /><stop offset="1" stopColor="#6e9c84" stopOpacity="0" />
      </linearGradient>
      <path id={id('limbo')} d="M235 356C298 238 510 215 798 309C662 392 423 460 235 356Z" />
      <clipPath id={id('recorte')}><use href={`#${id('limbo')}`} /></clipPath>
    </defs>
    <path fill={pintura('fondo')} d="M0 0H1000V560H0Z" />
    <g className="luci-lejania" strokeWidth="1">
      <use href={`#${id('juncos')}`} fill="#102c2a" stroke="#294038" />
      <use className="luci-luz-local" href={`#${id('juncos')}`} fill="#777c3b" stroke="#c1bc72" mask={pintura('luz-local')} />
    </g>
    <use href={`#${id('tallo')}`} fill="none" stroke="#304b32" strokeWidth="5" />
    <use className="luci-luz-local" href={`#${id('tallo')}`} fill="none" stroke="#d5cd7f" strokeWidth="3" mask={pintura('luz-local')} />
    <g className="luci-bruma" fill="none" stroke="#739985" strokeWidth="1" opacity=".15">
      <path d="M-80 210Q230 142 445 211T1060 199M-60 227Q250 167 465 230T1100 215" />
      <path d="M-80 437Q244 338 453 424T1090 406" />
    </g>
    <ellipse className="luci-suelo-luz" cx="580" cy="467" rx="180" ry="65" fill={pintura('suelo')} />
    <g className="luci-agua" fill="none" strokeWidth="1.2" stroke="#8d9e74">
      <ellipse className="luci-onda luci-onda-una" cx="622" cy="468" rx="77" ry="9" />
      <ellipse className="luci-onda luci-onda-dos" cx="622" cy="468" rx="77" ry="9" />
      <path d="M492 495Q583 486 690 497M395 514Q550 507 714 520M692 450l43 2" opacity=".25" />
    </g>
    <g className="luci-reflejo" fill={pintura('agua')}>
      <path d="M609 437l35 0 14 3-62 3ZM601 450l49-1 20 3-83 4ZM588 468l63-3 26 5-90 3ZM578 489l96-3 28 5-139 3ZM562 512l133-3 19 4-155 3Z" />
    </g>
    <ellipse className="luci-sombra-hoja" cx="520" cy="442" rx="238" ry="26" fill="#020e12" opacity=".8" />
    <path d="M155 560Q227 425 359 353" fill="none" stroke="#172c24" strokeWidth="15" />
    <path d="M155 560Q227 425 359 353" fill="none" stroke="#819052" strokeWidth="2" opacity=".55" />
    <g className="luci-hoja-viva">
      <use href={`#${id('limbo')}`} fill={pintura('hoja')} stroke="#405535" strokeWidth="1.5" />
      <g className="luci-luz-local" mask={pintura('luz-local')}>
        <use className="luci-hoja-luz" href={`#${id('limbo')}`} fill="#b7bb64" />
        <g clipPath={pintura('recorte')} fill="none" stroke="#c6ca7e" strokeWidth="1" className="luci-nervaduras">
          <path d="M239 355Q527 326 797 309" strokeWidth="2.5" />
          <path d="M318 347Q346 298 418 261M399 340Q421 292 505 267M478 332Q513 298 587 274M558 326Q596 300 670 288M637 321l88-19" />
          <path d="M324 347Q372 391 438 401M403 339Q454 381 513 391M482 332Q528 366 592 373M560 326Q603 347 668 350M640 320l77 14" />
          <path d="M264 362Q468 425 779 315" opacity=".35" />
        </g>
        <path className="luci-borde-luz" d="M238 357Q456 469 798 309" fill="none" stroke="#ecda8a" strokeWidth="2.5" />
        <g className="luci-rocio" fill="#dce7bb" stroke="#ffefab" strokeWidth=".7">
          <ellipse cx="429" cy="314" rx="7" ry="3.5" /><ellipse cx="696" cy="319" rx="5" ry="2.5" />
          <ellipse cx="477" cy="365" rx="3" ry="2" /><ellipse cx="745" cy="309" rx="2" ry="1.5" />
        </g>
      </g>
      <ellipse className="luci-sombra-compai" cx="591" cy="326" rx="49" ry="7" fill="#15281c" />
    </g>
    <g className="luci-viajera" transform="translate(591 250)">
      <g transform="scale(.43)" data-creature="luciernaga" data-pose="posa">
        <LuciernagaCuerpo uid={id('cuerpo')} vivo visema={undefined} eco={undefined} estado={cara} />
      </g>
    </g>
    <g className="luci-motas" fill="#e0d38c">
      <circle className="luci-mota-a" cx="377" cy="231" r="1.5" /><circle className="luci-mota-b" cx="718" cy="212" r="1.2" />
      <circle className="luci-mota-c" cx="485" cy="177" r="1" /><circle className="luci-mota-b" cx="651" cy="400" r="1.5" />
    </g>
    <g className="luci-resplandores" fill="#d5d997">
      {[ [455, 140], [758, 94], [550, 412], [815, 352], [402, 377], [675, 112] ].map(([x, y], i) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <g className="luci-luz-errante" style={{ '--demora': `${-i * 1.7}s`, '--duracion': `${6 + i * .7}s` }}>
            <ellipse rx="18" ry="9" opacity=".045" />
            <ellipse rx="7" ry="4" opacity=".12" />
            <circle r="1.6" />
          </g>
        </g>
      ))}
    </g>
    <g className="luci-primer-plano" fill="#061718" stroke="#203a2d" strokeWidth="1.5">
      <path d="M-30 560Q26 312 193 328Q127 482-30 560M-20 544Q-11 434 57 394Q76 490-20 544" />
      <path d="M1040 570Q862 529 820 387Q1002 405 1040 570M1019 556Q914 379 1003 313Q1081 433 1019 556" />
    </g>
    <path mask={pintura('luz-local')} className="luci-rebote-cerca luci-luz-local" d="M12 522Q95 450 174 346M996 535Q891 468 837 405" fill="none" stroke="#b3b262" strokeWidth="2" />
  </svg>;
});

export default NocheLuciernaga;
