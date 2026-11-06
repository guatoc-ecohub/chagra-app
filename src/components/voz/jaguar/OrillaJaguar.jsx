import { memo } from 'react';

const TRONCOS = [28, 102, 171, 259, 338, 421, 534, 603, 713, 792, 891, 971, 1084, 1179, 1288, 1391];

function OrillaJaguar() {
  return <div className="jv-orilla" aria-hidden="true">
    <div className="jv-cielo" />
    <div className="jv-luna" />
    <svg className="jv-bosque" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <path className="jv-monte-lejos" d="M0 315Q160 180 300 280T600 255T900 240T1200 250T1440 205V900H0Z" />
      <g className="jv-troncos-lejos">{TRONCOS.map((x, i) => <path key={x} d={`M${x} 630q${i % 2 ? -20 : 30}-230 8-510h${9 + i % 5}q-17 300 12 510z`} />)}</g>
      <path className="jv-dosel" d="M0 0H1440V135Q1370 200 1290 161Q1220 240 1130 171Q1030 211 990 145Q899 201 830 132Q734 215 653 151Q545 215 469 140Q358 207 300 146Q205 215 110 166Q40 199 0 159Z" />
      <path className="jv-ribera-lejos" d="M0 570Q210 499 398 556Q641 621 779 542Q1021 455 1440 531V900H0Z" />
      <path className="jv-rio" d="M864 534Q768 580 846 621Q977 681 532 788L340 900H1130Q1320 749 1040 657Q831 586 1001 535Z" />
      <g className="jv-reflejos" fill="none" strokeWidth="1.5">
        <path d="m866 572 42 1m-75 13 51 1m-34 26 77 2m-15 21 53 2m-53 22 133 3m-135 28 209 6m-300 36 279 7m-399 44 323 10m-452 49 391 11" />
      </g>
      <path className="jv-tierra" d="M0 637Q225 570 449 662Q682 717 811 693L921 756Q481 854 433 900H0ZM1440 639Q1187 612 1101 731L1190 900H1440Z" />
    </svg>
    <div className="jv-bruma jv-bruma-lejos" />
    <div className="jv-luz" />
    <div className="jv-ondas"><i /><i /><i /></div>
    <div className="jv-bruma jv-bruma-cerca" />
    <svg className="jv-primer-plano" viewBox="0 0 1440 900" preserveAspectRatio="none">
      <path className="jv-tronco-cerca" d="M0 0H66Q33 280 82 545L127 775L202 900H0ZM1440 0H1384Q1412 307 1364 488L1337 747L1263 900H1440Z" />
      <g className="jv-hojas" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M-30 820Q84 758 201 465M37 900Q201 847 306 672M1450 888Q1272 770 1268 520" />
        <g fill="currentColor" stroke="none">
          <path d="M70 722Q-2 612 29 562Q107 613 70 722M112 652Q107 538 150 510Q191 588 112 652M150 568Q177 473 232 464Q226 541 150 568M85 699Q148 601 216 607Q185 691 85 699M36 777Q88 699 155 713Q120 775 36 777M177 815Q126 741 155 712Q203 750 177 815M215 775Q226 695 275 688Q273 749 215 775M158 833Q229 782 274 809Q223 850 158 833M1311 725Q1242 633 1268 575Q1333 638 1311 725M1359 815Q1245 806 1210 735Q1293 728 1359 815M1301 674Q1310 572 1377 550Q1381 639 1301 674" />
        </g>
      </g>
    </svg>
    <div className="jv-luceros">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} style={{ '--i': i }} />)}</div>
    <div className="jv-vineta" />
  </div>;
}

export default memo(OrillaJaguar);
