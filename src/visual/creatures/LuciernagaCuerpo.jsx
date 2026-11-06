import { BocaVisema } from './_rubberhose.jsx';
import './luciernagaCuerpo.css';
import { LUCIERNAGA_MAPA_ESTADOS_DEMO } from './luciernagaIdentidad.js';

const CARA_POR_ESTADO = Object.fromEntries(Object.entries(LUCIERNAGA_MAPA_ESTADOS_DEMO)
  .flatMap(([cara, { estado }]) => [[cara, cara], [estado, cara]]));
// Cuerpo del demo fc25626, rostro de 898771c. Recursos aislados por instancia.
export function LuciernagaCuerpo({ uid, vivo, visema, energia = 1, estado, eco }) {
  // El estado narrativo manda; eco cubre la lectura del idle sin cambiar la luz.
  const caraEstado = (estado && estado !== 'acompana' && estado !== 'idle' && CARA_POR_ESTADO[estado])
    || (LUCIERNAGA_MAPA_ESTADOS_DEMO[eco] ? eco : 'idle');
  return (<>
    <defs>
      <linearGradient id={`luci-art-gPaja-${uid}`} x1="0" y1="0" x2=".3" y2="1">
        <stop stopColor="#ead09a"/><stop offset=".6" stopColor="#bb9558"/><stop offset="1" stopColor="#82623d"/>
      </linearGradient>
      <linearGradient x1="0" y1="0" x2="0" y2="1" id={`luci-art-gElytra-${uid}`}>
        <stop offset="0" stopColor="#41464b" />
        <stop offset=".55" stopColor="#24282c" />
        <stop offset="1" stopColor="#111518" />
      </linearGradient>
      <linearGradient x1="0" y1="0" x2="0" y2="1" id={`luci-art-gPronoto-${uid}`}>
        <stop offset="0" stopColor="#f44536" />
        <stop offset="1" stopColor="#b81720" />
      </linearGradient>
      <radialGradient cx=".5" cy=".5" r=".5" id={`luci-art-gHalo-${uid}`}>
        <stop offset="0" stopColor="var(--luci-luz-halo)" stopOpacity=".9" />
        <stop offset=".45" stopColor="var(--luci-luz-halo)" stopOpacity=".38" />
        <stop offset="1" stopColor="var(--luci-luz-halo)" stopOpacity="0" />
      </radialGradient>
      <radialGradient cx=".5" cy=".58" r=".62" id={`luci-art-gLinterna-${uid}`}>
        <stop offset="0" stopColor="var(--luci-luz-centro)" />
        <stop offset=".48" stopColor="var(--luci-luz-media)" />
        <stop offset="1" stopColor="var(--luci-luz-borde)" />
      </radialGradient>
      <radialGradient id={`luci-art-gRebote-${uid}`} gradientUnits="userSpaceOnUse" cx="0" cy="132" r="100">
        <stop offset="0" stopColor="var(--luci-luz-media)" stopOpacity=".65" />
        <stop offset=".4" stopColor="var(--luci-luz-halo)" stopOpacity=".3" />
        <stop offset="1" stopColor="var(--luci-luz-halo)" stopOpacity="0" />
      </radialGradient>
      <radialGradient cx=".5" cy=".5" r=".5" id={`luci-art-gAura-${uid}`}>
        <stop offset="0" stopColor="#3a5a34" stopOpacity=".5" />
        <stop offset="1" stopColor="#3a5a34" stopOpacity="0" />
      </radialGradient>
      <filter x="-50%" y="-45%" width="200%" height="190%" id={`luci-art-resplandorLinterna-${uid}`} colorInterpolationFilters="sRGB">
        <feDropShadow dx="0" dy="0" stdDeviation="4" floodOpacity=".72" floodColor="var(--luci-luz-media)" />
      </filter>
      <filter id={`luci-art-blurAla-${uid}`}>
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
    </defs>
    <g
      className={`luci-demo-cuerpoRig crt-body${vivo ? " rh-boil" : ""}`}
      data-luci-animated={vivo ? "1" : "0"}
      data-agt-estado={estado}
      data-eco={eco || undefined}
    >
      <ellipse opacity={Math.max(0.12, Math.min(0.34, 0.14 + 0.2 * (energia ?? 1))) / 0.34} cx="0" cy="40" rx="160" ry="190" fill={`url(#luci-art-gAura-${uid})`} />
      <circle cx="0" cy="140" r="72" fill={`url(#luci-art-gHalo-${uid})`} className="luci-demo-linternaHalo luci-linterna-halo" />
      <g className="luci-demo-accesorios">
        <defs>
          <g id={`luci-art-sombrero-${uid}`} stroke="#302317" strokeWidth="3">
            <path d="M-41,-118 Q-43,-154 -11,-158 Q21,-158 27,-119Z" fill={`url(#luci-art-gPaja-${uid})`}/>
            <path d="M-40,-126 Q-8,-113 26,-128 L29,-116 Q-8,-102 -42,-115Z" fill="#7b4630"/>
            <path d="M-64,-116 Q-59,-128 -36,-121 Q-4,-106 31,-123 Q52,-128 57,-116 Q33,-100 -4,-102 Q-43,-103 -64,-116Z" fill={`url(#luci-art-gPaja-${uid})`}/>
            <path d="M-54,-116 Q-27,-103 20,-113 M-30,-144 Q-8,-153 11,-141" fill="none" stroke="#efdaa0" strokeWidth="2"/>
            <path d="M-39,-135 Q-8,-122 24,-136 M-36,-142 Q-7,-131 20,-143 M-30,-150 Q-9,-141 12,-150 M-48,-119 l-4,7 M-36,-117 l-4,10 M-23,-115 l-3,11 M-10,-114 l-1,11 M4,-114 l1,10 M18,-116 l3,10 M33,-119 l4,9 M45,-122 l4,7" fill="none" stroke="#775a34" strokeWidth=".9" opacity=".65"/>
            <path d="M-59,-111 Q-9,-90 53,-110" fill="none" stroke="#6d5030" strokeWidth="3"/>
          </g>
        </defs>
        <g stroke="#352d20" className="luci-demo-morral" strokeWidth="2.5">
          <path d="M-74,-32 Q-60,-40 -42,-29 L-36,33 Q-47,51 -67,44 Q-80,20 -74,-32Z" fill="#89764c" />
          <path d="M-74,-28 Q-65,-18 -42,-26 L-41,-10 Q-57,0 -75,-9Z" fill="#b39b64" />
          <path d="M-73,-2 Q-77,23 -65,39 M-45,0 L-42,28" fill="none" stroke="#c3aa70" strokeWidth="1.5" />
          <path d="M-64,-23 L-61,35 M-49,-23 L-47,32" fill="none" stroke="#55432b" strokeWidth="5" />
          <path d="M-65,6 l8,-1 1,9 -8,1Z" fill="#cab17a" strokeWidth="1.5" />
          <path d="M-73,-32 Q-83,-46 -68,-49 L-44,-45 Q-35,-35 -43,-29Z" fill="#ad945f" />
          <path d="M-73,-44 Q-80,-36 -71,-32 Q-62,-33 -69,-40 Q-73,-41 -72,-36 M-51,-44 L-50,-31" fill="none" strokeWidth="2" />
        </g>
      </g>
      <g className="luci-demo-sistemaVuelo">
        <g stroke="#11171b" className="luci-demo-toraxVuelo" strokeWidth="2.5">
          <path d="M-25,-49 Q0,-59 25,-49 L36,-6 Q44,22 27,48 Q0,62 -27,48 Q-44,22 -36,-6Z" fill="#30363a" />
          <path d="M-24,-39 Q0,-29 24,-39 M-32,-8 Q0,5 32,-8" fill="none" stroke="#717a7b" strokeWidth="1.5" />
          <path d="M-27,-24 Q-39,-5 -29,20 M27,-24 Q39,-5 29,20" fill="none" stroke="#4e575d" />
        </g>
        <g className="luci-demo-alasVuelo">
          <g transform="translate(-30,18) rotate(14)">
            <g className="luci-demo-pliegueAla luci-demo-pliegueIzq">
              <g className="luci-demo-alaMemb luci-demo-alaIzq luci-ala-i">
                <path d="M0,0 C -46,-8 -100,-4 -134,-44 C -100,-64 -48,-42 -8,-6 Z" transform="rotate(20 0 0)" fill="#cfe0a0" opacity=".16" filter={`url(#luci-art-blurAla-${uid})`} />
                <path d="M0,0 C -46,-8 -100,-4 -134,-44 C -100,-64 -48,-42 -8,-6 Z" fill="#d8e6a8" opacity=".55" stroke="#eef3cd" strokeWidth="1" />
                <path d="M0,0 Q-55,-24 -116,-40 M-22,-9 L-49,-36 M-57,-20 L-80,-47" fill="none" stroke="#eef3cd" opacity=".6" strokeWidth=".8" />
              </g>
            </g>
          </g>
          <g transform="translate(30,18) rotate(-14)">
            <g className="luci-demo-pliegueAla luci-demo-pliegueDer">
              <g className="luci-demo-alaMemb luci-demo-alaDer luci-ala-d">
                <path d="M0,0 C 46,-8 100,-4 134,-44 C 100,-64 48,-42 8,-6 Z" transform="rotate(-20 0 0)" fill="#cfe0a0" opacity=".16" filter={`url(#luci-art-blurAla-${uid})`} />
                <path d="M0,0 C 46,-8 100,-4 134,-44 C 100,-64 48,-42 8,-6 Z" fill="#d8e6a8" opacity=".55" stroke="#eef3cd" strokeWidth="1" />
                <path d="M0,0 Q55,-24 116,-40 M22,-9 L49,-36 M57,-20 L80,-47" fill="none" stroke="#eef3cd" opacity=".6" strokeWidth=".8" />
              </g>
            </g>
          </g>
        </g>
        <g className="luci-demo-elitrosAbiertos">
          <g className="luci-demo-elitro luci-demo-elitroIzq">
            <path d="M0,-12 C-48,-22 -79,9 -76,59 C-75,100 -47,134 -7,139 L0,-12Z" fill={`url(#luci-art-gElytra-${uid})`} stroke="#101519" strokeWidth="4" />
            <path d="M-27,-5 C-57,6 -67,34 -62,64 C-58,91 -38,119 -18,130" fill="none" stroke="#f7a52f" className="luci-demo-vittae" strokeWidth="7" strokeLinecap="round" />
            <path d="M-28,-4 C-54,10 -60,29 -59,43" fill="none" stroke="#ffd077" opacity=".8" strokeWidth="1.5" />
            <path d="M-12,12 Q-28,74 -13,119 M-39,15 Q-53,58 -32,99" fill="none" stroke="#697175" opacity=".45" strokeWidth="1.2" />
          </g>
          <g className="luci-demo-elitro luci-demo-elitroDer">
            <path d="M0,-12 C48,-22 79,9 76,59 C75,100 47,134 7,139 L0,-12Z" fill={`url(#luci-art-gElytra-${uid})`} stroke="#101519" strokeWidth="4" />
            <path d="M27,-5 C57,6 67,34 62,64 C58,91 38,119 18,130" fill="none" stroke="#f7a52f" className="luci-demo-vittae" strokeWidth="7" strokeLinecap="round" />
            <path d="M28,-4 C54,10 60,29 59,43" fill="none" stroke="#ffd077" opacity=".8" strokeWidth="1.5" />
            <path d="M12,12 Q28,74 13,119 M39,15 Q53,58 32,99" fill="none" stroke="#697175" opacity=".45" strokeWidth="1.2" />
          </g>
        </g>
      </g>
      <g className="luci-demo-abdomenVentral">
        <path d="M-29,2 Q-40,26 -38,54 Q-38,94 -26,123 Q0,137 26,123 Q38,94 38,54 Q40,26 29,2Z" fill="#30363a" stroke="#101519" strokeWidth="3" />
        <path d="M-35,30 Q0,43 35,30 M-37,49 Q0,63 37,49 M-36,69 Q0,83 36,69 M-33,89 Q0,103 33,89 M-29,108 Q0,121 29,108" fill="none" stroke="#11181c" strokeWidth="3" />
        <path d="M-33,33 Q0,46 33,33 M-35,52 Q0,66 35,52 M-34,72 Q0,86 34,72 M-31,92 Q0,106 31,92 M-27,111 Q0,124 27,111" fill="none" stroke="#758080" strokeWidth="1.2" />
        <path d="M-28,116 C-33,137 -21,170 0,173 C21,170 33,137 28,116 Q0,129 -28,116Z" fill="#353d3e" stroke="#11181c" strokeWidth="3" />
      </g>
      <path className="luci-luz-rebote" d="M-29,2 Q-40,26 -38,54 Q-38,94 -26,123 Q0,137 26,123 Q38,94 38,54 Q40,26 29,2Z" fill={`url(#luci-art-gRebote-${uid})`} />
      <g className="luci-demo-linternaCore luci-linterna-core" filter={`url(#luci-art-resplandorLinterna-${uid})`}>
        <path d="M-30,101 Q0,115 30,101 C34,129 22,166 0,170 C-22,166 -34,129 -30,101Z" fill={`url(#luci-art-gLinterna-${uid})`} />
        <path d="M-29,115 Q0,129 29,115 M-25,135 Q0,147 25,135 M-19,150 Q0,160 19,150 M-10,162 Q0,167 10,162" fill="none" opacity=".5" className="luci-demo-tabique" strokeWidth="1.7" />
        <path d="M-20,129 Q-23,140 -13,154" fill="none" stroke="var(--luci-luz-centro)" opacity=".8" strokeWidth="2" />
      </g>
      <g stroke="#140d07" fill="none" className="luci-demo-patasBiologicas" strokeWidth="8.5" strokeLinecap="round">
        <g className="luci-demo-patasTraseras">
          <g className="luci-demo-pata luci-demo-traseraIzq">
            <g transform="scale(-1,1)">
              <path d="M23,40 C34,58 57,81 59,100 Q60,124 66,158" />
              <path d="M23,40 C34,58 57,81 59,100" stroke="#4b493c" strokeWidth="5" />
              <ellipse cx="23" cy="40" rx="5" ry="6" fill="#4b493c" strokeWidth="2" />
              <g transform="translate(66,158) rotate(65)" className="luci-demo-tarso">
                <path d="M-3,-4 Q2,-5 7,-3 L8,3 Q2,5 -3,4Z" />
                <path d="M9,-3 L16,-2 L17,3 L10,4Z" />
                <path d="M18,-2 L24,-1 L24,3 L19,3Z" />
                <path d="M24,0 Q33,-7 32,-1 M24,3 Q32,10 33,4" className="luci-demo-garra" />
              </g>
            </g>
          </g>
          <g className="luci-demo-pata luci-demo-traseraDer">
            <g transform="scale(1,1)">
              <path d="M23,40 C34,58 57,81 59,100 Q60,124 66,158" />
              <path d="M23,40 C34,58 57,81 59,100" stroke="#4b493c" strokeWidth="5" />
              <ellipse cx="23" cy="40" rx="5" ry="6" fill="#4b493c" strokeWidth="2" />
              <g transform="translate(66,158) rotate(65)" className="luci-demo-tarso">
                <path d="M-3,-4 Q2,-5 7,-3 L8,3 Q2,5 -3,4Z" />
                <path d="M9,-3 L16,-2 L17,3 L10,4Z" />
                <path d="M18,-2 L24,-1 L24,3 L19,3Z" />
                <path d="M24,0 Q33,-7 32,-1 M24,3 Q32,10 33,4" className="luci-demo-garra" />
              </g>
            </g>
          </g>
        </g>
        <g className="luci-demo-patasMedias">
          <g className="luci-demo-pata luci-demo-mediaIzq">
            <g transform="scale(-1,1)">
              <path d="M24,23 C39,32 64,45 70,60 Q75,76 70,93" />
              <path d="M24,23 C39,32 64,45 70,60" stroke="#4b493c" strokeWidth="5" />
              <ellipse cx="24" cy="23" rx="5" ry="6" fill="#4b493c" strokeWidth="2" />
              <g transform="translate(70,93) rotate(65)" className="luci-demo-tarso">
                <path d="M-3,-4 Q2,-5 7,-3 L8,3 Q2,5 -3,4Z" />
                <path d="M9,-3 L16,-2 L17,3 L10,4Z" />
                <path d="M18,-2 L24,-1 L24,3 L19,3Z" />
                <path d="M24,0 Q33,-7 32,-1 M24,3 Q32,10 33,4" className="luci-demo-garra" />
              </g>
            </g>
          </g>
          <g className="luci-demo-pata luci-demo-mediaDer">
            <g transform="scale(1,1)">
              <path d="M24,23 C39,32 64,45 70,60 Q75,76 70,93" />
              <path d="M24,23 C39,32 64,45 70,60" stroke="#4b493c" strokeWidth="5" />
              <ellipse cx="24" cy="23" rx="5" ry="6" fill="#4b493c" strokeWidth="2" />
              <g transform="translate(70,93) rotate(65)" className="luci-demo-tarso">
                <path d="M-3,-4 Q2,-5 7,-3 L8,3 Q2,5 -3,4Z" />
                <path d="M9,-3 L16,-2 L17,3 L10,4Z" />
                <path d="M18,-2 L24,-1 L24,3 L19,3Z" />
                <path d="M24,0 Q33,-7 32,-1 M24,3 Q32,10 33,4" className="luci-demo-garra" />
              </g>
            </g>
          </g>
        </g>
      </g>
      <g className="luci-demo-testaRig luci-testa" data-luci-cara={caraEstado}>
        <g transform="scale(.84,1)">
          <defs>
            <radialGradient id={`luci-art-gCaraActuada-${uid}`} cx=".35" cy=".32" r=".78">
              <stop stopColor="#77766a"/><stop offset=".48" stopColor="#4b4d43"/><stop offset="1" stopColor="#252a25"/>
            </radialGradient>
            <linearGradient id={`luci-art-gCapuchaCara-${uid}`} x1="0" y1="0" x2="1" y2=".4">
              <stop stopColor="#783127"/><stop offset=".32" stopColor="#c6513c"/><stop offset=".65" stopColor="#de6b4e"/><stop offset="1" stopColor="#87362c"/>
            </linearGradient>
            <linearGradient id={`luci-art-gVisera-${uid}`} x1="0" y1="0" x2=".15" y2="1">
              <stop stopColor="#9a3a2c"/><stop offset=".55" stopColor="#d65c44"/><stop offset="1" stopColor="#ec8461"/>
            </linearGradient>
            <linearGradient id={`luci-art-gOjoCara-${uid}`} x1="0" y1="0" x2=".5" y2="1">
              <stop stopColor="#c4c4a9"/><stop offset=".4" stopColor="#f1e9c9"/><stop offset="1" stopColor="#d5d5b6"/>
            </linearGradient>
            {/* Ojo compuesto: casi negro arriba, con el rebote ámbar de la linterna abajo. */}
            <radialGradient id={`luci-art-gIris-${uid}`} cx=".42" cy=".3" r=".8">
              <stop stopColor="#2c3a30"/><stop offset=".55" stopColor="#121813"/><stop offset="1" stopColor="#4a3b17"/>
            </radialGradient>
            <clipPath id={`luci-art-recorteOjoCerca-${uid}`}><ellipse cx="-8" cy="-81" rx="14" ry="16.5"/></clipPath>
            <clipPath id={`luci-art-recorteOjoLejos-${uid}`}><ellipse cx="25" cy="-82.5" rx="9" ry="14.5"/></clipPath>
            <clipPath id={`luci-art-recorteIrisCerca-${uid}`}><ellipse cx="-2" cy="-80" rx="8.6" ry="11.2"/></clipPath>
            <clipPath id={`luci-art-recorteIrisLejos-${uid}`}><ellipse cx="28.6" cy="-81.5" rx="5.6" ry="10.2"/></clipPath>
          </defs>
          {/* Pronoto: escudo más ancho que la cabeza; asoma a los dos lados. */}
          <g className="luci-demo-pronoto luci-pronoto" stroke="#24251e" strokeWidth="2.7" strokeLinejoin="round">
            <path d="M-34,-109 C-47,-97 -48,-73 -44,-52 L-37,-27 Q-21,-14 -7,-16 L26,-22 Q40,-30 41,-48 L45,-93 Q31,-115 -34,-109Z" fill={`url(#luci-art-gCapuchaCara-${uid})`}/>
            <path d="M-38,-103 C-44,-93 -45,-73 -41,-53 M38,-96 Q38,-70 36,-50" fill="none" stroke="#8e2f24" strokeWidth="1.4"/>
            <path d="M-42,-90 Q-45,-74 -41,-58 L-38.5,-60 Q-41.5,-75 -39,-89Z" fill="#ffd9c4" stroke="none" opacity=".8"/>
            <path d="M40.5,-82 L41.5,-64 L39.6,-64 L38.8,-81Z" fill="#ffd9c4" stroke="none" opacity=".6"/>
            <path d="M-29,-36 Q-21,-22 -9,-21 M32,-60 Q37,-40 28,-30" fill="none" stroke="#752d27" strokeWidth="2"/>
            <path d="M-12,-46 Q3,-38 19,-43 L15,-20 Q8,-13 -5,-16Z" fill="#363b32"/>
            <path d="M-9,-34 Q2,-29 16,-33 M-8,-26 Q3,-21 14,-25" fill="none" stroke="#181e19" strokeWidth="1.8"/>
          </g>
          {/* Antenas filiformes y segmentadas: salen de debajo del escudo, por detrás del sombrero. */}
          <g transform="translate(-24,-112)">
            <g className="luci-demo-antena luci-demo-antenaIzq luci-antena-i">
              <path d="M0,0 C-4,-34 -18,-71 -43,-76" stroke="#201915" strokeWidth="5" fill="none" strokeLinecap="round"/>
              <path d="M-1,-8 C-5,-38 -18,-69 -40,-75" stroke="#7d6648" strokeWidth="2.2" fill="none" strokeDasharray="5.2 2"/>
            </g>
          </g>
          <g transform="translate(22,-114)">
            <g className="luci-demo-antena luci-demo-antenaDer luci-antena-d">
              <path d="M0,0 C14,-35 13,-64 0,-80" stroke="#201915" strokeWidth="5" fill="none" strokeLinecap="round"/>
              <path d="M2,-8 C13,-37 12,-63 1,-77" stroke="#7d6648" strokeWidth="2.2" fill="none" strokeDasharray="5.2 2"/>
            </g>
          </g>
          <g className="luci-demo-cabeza">
            <path className={`luci-demo-caraContorno${vivo ? " luci-cara-viva" : ""}`} d="M-26,-104 C-14,-117 18,-117 31,-103 C41,-93 42,-74 35,-58 C28,-44 18,-36 6,-37 C-8,-38 -22,-47 -28,-62 C-35,-78 -35,-94 -26,-104Z" fill={`url(#luci-art-gCaraActuada-${uid})`} stroke="#232720" strokeWidth="2.8"/>
            <path d="M-29,-86 Q-31,-73 -25,-65" fill="none" stroke="#a3a08a" strokeWidth="1.4" opacity=".46" strokeLinecap="round"/>
            <path d="M-24,-57 Q-8,-39 9,-41 Q26,-42 35,-60 Q24,-40 7,-37 Q-12,-39 -24,-57" fill="#171f19" opacity=".34"/>
            <g className={`luci-demo-ojo luci-demo-ojoCerca${vivo ? " rh-blink" : ""}`}>
              <g className="luci-demo-ojoForma">
                <g className="luci-demo-ojoAbierto" clipPath={`url(#luci-art-recorteOjoCerca-${uid})`}>
                  <ellipse className="luci-demo-esclera" cx="-8" cy="-81" rx="14" ry="16.5" fill={`url(#luci-art-gOjoCara-${uid})`}/>
                  <g className="luci-demo-pupila">
                    <g clipPath={`url(#luci-art-recorteIrisCerca-${uid})`}>
                      <ellipse cx="-2" cy="-80" rx="8.6" ry="11.2" fill={`url(#luci-art-gIris-${uid})`}/>
                      <path className="luci-demo-facetas" d="M-8,-90 Q-4,-80 -7,-69 M-2,-92 Q1,-80 -2,-68 M4,-90 Q6,-80 4,-70 M-11,-84 Q-2,-87 7,-84 M-11,-77 Q-2,-80 7,-77 M-10,-71 Q-2,-73 6,-71" fill="none" stroke="#56685a" strokeWidth=".5" opacity=".32"/>
                    </g>
                    <path d="M-8.5,-84 Q-7.5,-90 -2.5,-91" fill="none" stroke="#fff9df" strokeWidth="2.2" strokeLinecap="round" opacity=".88"/>
                    <circle cx="-6.8" cy="-84.6" r="1.7" fill="#fff9df"/>
                    <path d="M-6,-72 Q-1,-70 3,-73" fill="none" stroke="#c99a3d" strokeWidth="1.1" strokeLinecap="round" opacity=".7"/>
                  </g>
                  <path className="luci-demo-parpadoCerca" d="M-24,-100 L8,-100 L8,-96 Q-8,-100 -24,-95Z" fill={`url(#luci-art-gCaraActuada-${uid})`} stroke="#292b23" strokeWidth="1.8"/>
                </g>
                <ellipse className="luci-demo-ojoAbierto luci-demo-ojoTinta" cx="-8" cy="-81" rx="14" ry="16.5" fill="none" stroke="#24281f" strokeWidth="2"/>
                <path className="luci-demo-ojoCerrado" d="M-21,-78 Q-8,-93 5,-78" fill="none" stroke="#22281f" strokeWidth="2.8" strokeLinecap="round"/>
              </g>
            </g>
            <g className={`luci-demo-ojo luci-demo-ojoLejos${vivo ? " rh-blink" : ""}`}>
              <g className="luci-demo-ojoForma">
                <g className="luci-demo-ojoAbierto" clipPath={`url(#luci-art-recorteOjoLejos-${uid})`}>
                  <ellipse className="luci-demo-esclera" cx="25" cy="-82.5" rx="9" ry="14.5" fill={`url(#luci-art-gOjoCara-${uid})`}/>
                  <g className="luci-demo-pupila">
                    <g clipPath={`url(#luci-art-recorteIrisLejos-${uid})`}>
                      <ellipse cx="28.6" cy="-81.5" rx="5.6" ry="10.2" fill={`url(#luci-art-gIris-${uid})`}/>
                      <path className="luci-demo-facetas" d="M25,-90 Q27,-81 25,-72 M29,-91 Q31,-81 29,-71 M23,-85 Q29,-87 34,-85 M23,-79 Q29,-81 34,-79 M23,-73 Q29,-75 34,-73" fill="none" stroke="#56685a" strokeWidth=".45" opacity=".3"/>
                    </g>
                    <path d="M24.6,-85 Q25.2,-90 28,-91" fill="none" stroke="#fff9df" strokeWidth="1.6" strokeLinecap="round" opacity=".85"/>
                    <circle cx="25.8" cy="-85.6" r="1.2" fill="#fff9df"/>
                  </g>
                  <path className="luci-demo-parpadoLejos" d="M14,-100 L36,-100 L36,-96 Q25,-100 14,-96Z" fill={`url(#luci-art-gCaraActuada-${uid})`} stroke="#292b23" strokeWidth="1.6"/>
                </g>
                <ellipse className="luci-demo-ojoAbierto luci-demo-ojoTinta" cx="25" cy="-82.5" rx="9" ry="14.5" fill="none" stroke="#24281f" strokeWidth="1.8"/>
                <path className="luci-demo-ojoCerrado" d="M17,-80 Q25,-92 33,-81" fill="none" stroke="#22281f" strokeWidth="2.4" strokeLinecap="round"/>
              </g>
            </g>
            {/* Borde frontal del pronoto: la visera que encapucha y hace de ceja. */}
            <path className={`luci-demo-visera${vivo ? " luci-cara-viva" : ""}`} d="M-36,-110 Q3,-124 42,-106 L40,-93 Q27,-105 12,-94 Q-7,-107 -32,-91 Z" fill={`url(#luci-art-gVisera-${uid})`} stroke="#24251e" strokeWidth="3" strokeLinejoin="round"/>
            <path className="luci-demo-manchaPronoto" d="M3,-113 Q13,-117 23,-112 L19,-104 Q13,-102 7,-104Z" fill="#2b2924" stroke="#24251e" strokeWidth="1.2"/>
            <path d="M-27,-104 Q-14,-110 -2,-108 M24,-108 Q31,-108 37,-104" fill="none" stroke="#ffd2b8" strokeWidth="1.5" strokeLinecap="round" opacity=".85"/>
            <path d="M14,-75 Q18,-68 16,-64" fill="none" stroke="#95927a" strokeWidth="1" opacity=".4"/>
            <g className="luci-demo-boca" stroke="#20241d" strokeLinejoin="round" strokeLinecap="round">
              {visema ? <BocaVisema cx={12} cy={-55} w={12} prof={6} visema={visema} /> : (<g className="luci-demo-sonrisaCara">
                <path className="luci-demo-bocaReposo" d="M2,-57 Q12,-50 22,-59" fill="none" strokeWidth="2"/>
                <path className="luci-demo-bocaHablar" d="M0,-58 Q12,-52 24,-60 Q15,-44 6,-51Z" fill="#272720" strokeWidth="1.8"/>
                <path className="luci-demo-bocaHablar" d="M4,-56 Q12,-52 20,-57" fill="none" stroke="#d4c9a5" strokeWidth="1.3"/>
                <path className="luci-demo-bocaLeer" d="M9,-53 Q15,-52 20,-56" fill="none" strokeWidth="1.8"/>
                <path className="luci-demo-bocaSano" d="M-3,-60 Q11,-50 25,-61 Q15,-38 2,-51Z" fill="#292920" strokeWidth="2"/>
                <path className="luci-demo-bocaSano" d="M1,-58 Q13,-52 22,-59" fill="none" stroke="#e4d6b3" strokeWidth="2"/>
                <path className="luci-demo-bocaAlerta" d="M0,-50 Q5,-68 18,-61 Q25,-58 26,-48 Q12,-53 0,-50Z" fill="#242a25" strokeWidth="2"/>
                <path className="luci-demo-bocaAlerta" d="M8,-60 Q14,-63 20,-57" fill="none" stroke="#c3bfa5" strokeWidth="1.5"/>
                <path className="luci-demo-bocaPacto" d="M3,-56 Q12,-51 22,-58" fill="none" strokeWidth="1.8"/>
              </g>)}
            </g>
          </g>
          <use className="luci-demo-sombreroAnclado" href={`#luci-art-sombrero-${uid}`}/>
        </g>
      </g>
      <g className="luci-demo-apendicesInteractivos">
        <g className="luci-demo-patasDelanteras">
          <g transform="translate(-26,12)">
            <g className="luci-demo-pliegueBrazo luci-demo-pliegueBrazoIzq">
              <g className="luci-demo-brazo luci-demo-brazoIzq crt-brazo-l">
                <path d="M0,0 C -15,9 -25,28 -35,25 S -52,0 -62,-14" stroke="#140d07" fill="none" strokeWidth="9" strokeLinecap="round" />
                <path d="M0,0 C -15,9 -25,28 -35,25" stroke="#4b493c" fill="none" strokeWidth="5.5" strokeLinecap="round" />
                <ellipse cx="0" cy="0" rx="5" ry="6" fill="#4b493c" stroke="#140d07" strokeWidth="2" />
                <g transform="scale(-1,1)">
                  <g transform="translate(62,-14) rotate(-12)" className="luci-demo-tarso">
                    <path d="M-3,-4 Q2,-5 7,-3 L8,3 Q2,5 -3,4Z" />
                    <path d="M9,-3 L16,-2 L17,3 L10,4Z" />
                    <path d="M18,-2 L24,-1 L24,3 L19,3Z" />
                    <path d="M24,0 Q33,-7 32,-1 M24,3 Q32,10 33,4" className="luci-demo-garra" />
                  </g>
                </g>
              </g>
            </g>
          </g>
          <g transform="translate(26,12)">
            <g className="luci-demo-pliegueBrazo luci-demo-pliegueBrazoDer">
              <g className="luci-demo-brazo luci-demo-brazoDer crt-brazo-r">
                <path d="M0,0 C 15,9 25,28 35,25 S 52,0 62,-14" stroke="#140d07" fill="none" strokeWidth="9" strokeLinecap="round" />
                <path d="M0,0 C 15,9 25,28 35,25" stroke="#4b493c" fill="none" strokeWidth="5.5" strokeLinecap="round" />
                <ellipse cx="0" cy="0" rx="5" ry="6" fill="#4b493c" stroke="#140d07" strokeWidth="2" />
                <g transform="translate(62,-14) rotate(-12)" className="luci-demo-tarso">
                  <path d="M-3,-4 Q2,-5 7,-3 L8,3 Q2,5 -3,4Z" />
                  <path d="M9,-3 L16,-2 L17,3 L10,4Z" />
                  <path d="M18,-2 L24,-1 L24,3 L19,3Z" />
                  <path d="M24,0 Q33,-7 32,-1 M24,3 Q32,10 33,4" className="luci-demo-garra" />
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
      <g fill="none" className="luci-demo-correaMorral" strokeLinecap="round">
        <path d="M32,-10 Q9,10 -19,28 L-43,44 Q-53,39 -57,27" stroke="#30271c" strokeWidth="8" />
        <path d="M32,-10 Q9,10 -19,28 L-43,44 Q-53,39 -57,27" stroke="#b99b63" strokeWidth="5" />
        <path d="M28,-8 Q7,11 -21,30 L-42,42" stroke="#e0c38a" strokeWidth="1" strokeDasharray="2 3" />
        <path d="M-15,19 l8,8 -8,8 -8,-8Z" fill="#786442" stroke="#dfc584" strokeWidth="2" />
      </g>
      <g>
        <g fill="#bf3d32" stroke="#34170f" className="luci-demo-panuelo" strokeWidth="2">
          <path d="M-29,-3 Q0,12 29,-3 L17,13 L0,19 L-21,11Z" />
          <path d="M1,12 Q10,21 9,37 L-5,29 L-10,39 L-9,13Z" />
          <path d="M-7,10 Q0,6 7,11 L3,19 L-5,19Z" fill="#e3694f" />
        </g>
      </g>
    </g>
  </>);
}
