import { memo, useId } from 'react';

// Tres distancias de troncos. La niebla pasa entre ellas, no sobre una postal.
const TRONCOS = [
  [30, 80, 1.3], [160, 140, .85], [275, 50, .65], [402, 150, .55],
  [530, 90, .7], [685, 160, .5], [800, 55, .7], [950, 100, .95], [1110, 60, 1.4],
];

function Helecho({ x, y, escala = 1, giro = 0 }) {
  return <g transform={`translate(${x} ${y}) rotate(${giro}) scale(${escala})`}>
    <g className="oso-monte-fronda">
      {[-65, -35, 0, 35, 65].map(angulo => <g key={angulo} transform={`rotate(${angulo})`}>
        <path d="M0 0Q-9-63 8-122" fill="none" stroke="#94a67b" strokeWidth="2" />
        {Array.from({ length: 8 }, (_, i) => <g key={i} transform={`translate(${-3 + i * .6} ${-14 - i * 12})`}>
          <path d={`M0 0Q${-35 + i * 3} -4 ${-31 + i * 3} -18Q-7-15 0 0`} fill="currentColor" />
          <path d={`M0 0Q${34 - i * 3} -3 ${30 - i * 3} -17Q7-14 0 0`} fill="currentColor" />
        </g>)}
      </g>)}
    </g>
  </g>;
}

function MonteOso({ frente = false }) {
  const uid = useId().replace(/:/g, '');
  if (frente) return <div className="oso-monte-primer-plano" aria-hidden="true">
    <div className="oso-monte-bruma oso-monte-bruma-cerca" />
    <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMax slice">
      <path d="M-30 803Q130 714 292 794Q445 757 557 826H-30Z" fill="#102d29" />
      <path d="M1200 795Q1070 717 950 785Q830 740 739 813H1200Z" fill="#102d29" />
      <Helecho x={90} y={820} escala={1.8} giro={22} />
      <Helecho x={1120} y={820} escala={2.2} giro={-22} />
      <Helecho x={275} y={833} escala={.8} giro={-15} />
    </svg>
  </div>;

  return <div className="oso-monte-fondo" aria-hidden="true">
    <div className="oso-monte-luz" />
    <svg className="oso-monte-bosque" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id={`${uid}-loma`} x2="0" y2="1"><stop stopColor="#678f82" /><stop offset="1" stopColor="#183e38" /></linearGradient>
        <linearGradient id={`${uid}-suelo`} x2=".3" y2="1"><stop stopColor="#39534a" /><stop offset="1" stopColor="#102d2c" /></linearGradient>
        <linearGradient id={`${uid}-palo`}><stop stopColor="#102f2b" /><stop offset=".65" stopColor="#294c3d" /><stop offset="1" stopColor="#426348" /></linearGradient>
        <linearGradient id={`${uid}-agua`} x2="1" y2="1"><stop stopColor="#97bfb0" stopOpacity=".5" /><stop offset="1" stopColor="#7eaaa1" stopOpacity=".05" /></linearGradient>
      </defs>
      <path d="M0 335Q115 330 254 155Q337 57 410 171Q478 219 545 118Q610 17 700 143Q788 273 889 193Q1044 110 1200 250V800H0Z" fill={`url(#${uid}-loma)`} opacity=".43" />
      <g fill="none" stroke="#315e54" strokeWidth="9" opacity=".3">
        {Array.from({ length: 21 }, (_, i) => <path key={i} d={`M${i * 63} 630q${i % 2 ? -20 : 20}-190 4-375m-2 95-32-54m33 9 28-41`} />)}
      </g>
      <g opacity=".67">
        {TRONCOS.map(([x, y, s]) => <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M-22 650Q-6 411-23 192L-37-180H18L8 195Q24 446 36 650Z" fill={`url(#${uid}-palo)`} />
          <path d="M-6 222Q-71 168-108 37M6 305Q87 210 124 73" fill="none" stroke="#284d40" strokeWidth="18" />
          <path d="M-18 367Q-35 306-26 243M13 456Q-3 395 10 343M-30 97Q-1 104 11 76" fill="none" stroke="#749064" strokeWidth="7" opacity=".7" />
          <g className="oso-monte-liquen" fill="none" stroke="#88a58d" strokeWidth="2" opacity=".48">
            <path d="M-72 132q-17 63 5 101m-4-59q-18 37-5 62M77 204q-22 52-7 110m9-101q17 33 2 58" />
          </g>
        </g>)}
      </g>
      <path d="M0 566Q250 514 443 565Q676 513 863 562Q1033 526 1200 564V800H0Z" fill={`url(#${uid}-suelo)`} />
      <path d="M752 536Q695 579 620 601Q483 638 486 699Q594 734 788 800H1050Q692 698 662 667Q599 639 704 603Q794 574 784 541Z" fill="#809078" opacity=".24" />
      <path d="M758 539Q705 578 674 588M640 606Q527 641 530 668M568 696Q656 725 812 764" fill="none" stroke="#c0b28c" strokeWidth="3" opacity=".16" />
      <path d="M26 730Q93 635 241 662Q269 688 374 708Q289 754 186 779Z" fill={`url(#${uid}-agua)`} />
      <g className="oso-monte-ondas" fill="none" stroke="#c0d4bd" strokeWidth="1.5">
        <ellipse cx="163" cy="710" rx="39" ry="7" /><ellipse cx="163" cy="710" rx="60" ry="11" />
        <ellipse cx="267" cy="724" rx="27" ry="5" />
      </g>
      <path d="M0-20H100Q76 164 102 341Q100 522 197 645L282 678Q187 693 148 658Q183 717 238 740Q145 725 111 674Q70 702 0 693Z" fill={`url(#${uid}-palo)`} />
      <path d="M42-10Q10 262 60 489Q68 593 148 667M78 470Q63 599 109 656" fill="none" stroke="#6c8058" strokeWidth="9" opacity=".45" />
      <path d="M1200-20H1120Q1150 267 1104 457Q1090 577 1001 614Q1070 627 1120 581L1099 671Q1160 619 1174 554H1200Z" fill={`url(#${uid}-palo)`} />
      <Helecho x={354} y={606} escala={.5} giro={-15} />
      <Helecho x={947} y={628} escala={.8} giro={25} />
      <Helecho x={115} y={634} escala={.65} />
      <g fill="#b29458">
        {[0, 1, 2, 3, 4, 5].map(i => <ellipse key={i} cx={580 + i * 25} cy={687 + (i % 2) * 11} rx="3" ry="2" transform={`rotate(${i * 31} ${580 + i * 25} ${687 + (i % 2) * 11})`} />)}
      </g>
      <g fill="#9aa77e" opacity=".5"><ellipse cx="890" cy="651" rx="34" ry="10" /><ellipse cx="384" cy="639" rx="23" ry="7" /></g>
    </svg>
    <div className="oso-monte-bruma oso-monte-bruma-lejos" />
    <div className="oso-monte-bruma oso-monte-bruma-media" />
    <div className="oso-monte-goteo">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ '--i': i, left: `${7 + i * 5.8}%`, animationDelay: `${-i * 1.37}s` }} />)}</div>
  </div>;
}

export default memo(MonteOso);
