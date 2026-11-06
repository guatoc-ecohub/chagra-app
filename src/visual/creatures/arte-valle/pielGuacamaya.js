// Fuente compartida de la piel final de la guacamaya.
// Los ids se mantienen locales al SVG y nsRigValle los namespacea por instancia.
export const gradientesPiel = `<radialGradient id="vozPecho" cx=".79" cy=".19" r=".85" gradientTransform="translate(0 -.08) scale(1 1.12)">
  <stop stop-color="#fa9260"/><stop offset=".28" stop-color="#dc4b32"/><stop offset=".62" stop-color="#a82929"/><stop offset=".86" stop-color="#64232c"/><stop offset="1" stop-color="#382b32"/>
</radialGradient>
<radialGradient id="vozCorona" cx=".76" cy=".25" r=".88"><stop stop-color="#ffab70"/><stop offset=".3" stop-color="#e35839"/><stop offset=".68" stop-color="#a82c2b"/><stop offset="1" stop-color="#492730"/></radialGradient>
<linearGradient id="vozCara" x1="0" y1=".7" x2="1" y2=".2"><stop stop-color="#8b928a"/><stop offset=".42" stop-color="#d3c8af"/><stop offset=".82" stop-color="#fff0cc"/><stop offset="1" stop-color="#e9d5ae"/></linearGradient>
<linearGradient id="vozPico" x1="0" y1=".7" x2="1" y2=".2"><stop stop-color="#171f28"/><stop offset=".4" stop-color="#303a42"/><stop offset=".7" stop-color="#7b817d"/><stop offset=".82" stop-color="#a7a292"/><stop offset="1" stop-color="#4b5558"/></linearGradient>
<linearGradient id="vozOro" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#755530"/><stop offset=".5" stop-color="#c09239"/><stop offset="1" stop-color="#f4cf70"/></linearGradient>
<linearGradient id="vozAzul" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#172c41"/><stop offset=".55" stop-color="#2b596c"/><stop offset="1" stop-color="#6b9d9c"/></linearGradient>
<linearGradient id="vozCola" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#432431"/><stop offset=".5" stop-color="#8b3033"/><stop offset="1" stop-color="#d96747"/></linearGradient>
<linearGradient id="vozGarra" x1="0" y1="1" x2=".7" y2="0"><stop stop-color="#303433"/><stop offset=".55" stop-color="#6a7267"/><stop offset="1" stop-color="#b6b399"/></linearGradient>`;

export const estiloPiel = `.guaca-rig .voz-plumon .voz-barba{stroke:#ffba83;stroke-opacity:.35;stroke-width:.8}.guaca-rig [data-superficie="pecho"],.guaca-rig [id^="cabezaRig-"]>circle{stroke:#71302c!important;stroke-width:2.5!important}.guaca-rig [id^="cabezaRig-"]>ellipse{opacity:.12}.guaca-rig [id^="cabezaRig-"]>path:first-of-type{opacity:.18}.guaca-rig [data-superficie="pecho"]+path{opacity:.1}`;

const plumas = Array.from({ length: 9 }, (_, fila) => Array.from({ length: 6 }, (_, columna) => {
  const y = fila * 15 + 7;
  const x = columna * 17 - 48 + (fila % 2) * 8 + (fila * columna % 5);
  const alto = 8 + (fila + columna * 3) % 5;
  return `<path d="M${x},${y} q4,${alto} 10,${alto + 3} q5,-3 7,-9"/><path d="M${x + 5},${y + 3} l3,${alto - 4}" class="voz-barba"/>`;
}).join('')).join('');

export function defsPiel(torso) {
  return `<defs>${gradientesPiel}<clipPath id="vozContorno"><path d="${torso}"/></clipPath></defs>`;
}

export function materiaPiel() {
  return `<g class="voz-plumon" clip-path="url(#vozContorno)"><g fill="none" stroke="#3d1e26" stroke-width="1.1" stroke-opacity=".24" stroke-linecap="round">${plumas}</g><path d="M-46,-12 Q-26,24 20,30 Q44,29 56,7 L55,-30Z" fill="#3e222b" opacity=".28"/><path d="M33,11 Q56,66 23,132" fill="none" stroke="#ffbe7d" stroke-width="2" opacity=".24"/></g>`;
}

export function aplicarPiel(rig, torso) {
  let out = rig
    .replaceAll('url(#gEscarlata)', 'url(#vozPecho)')
    .replaceAll('url(#gCabeza)', 'url(#vozCorona)')
    .replaceAll('url(#gPicoAlto)', 'url(#vozPico)')
    .replaceAll('url(#gAmarillo)', 'url(#vozOro)')
    .replaceAll('url(#gAzulAla)', 'url(#vozAzul)')
    .replaceAll('url(#gColaRoja)', 'url(#vozCola)')
    .replaceAll('fill="#a8151a"', 'fill="url(#vozCola)"')
    .replace('fill="#f6f0e4" stroke="#e2d8c6"', 'fill="url(#vozCara)" stroke="#bbae92"')
    .replace(`d="${torso}"`, `data-superficie="pecho" d="${torso}"`)
    .replaceAll('stroke="#2a140b" stroke-width="4"', 'stroke="#71302c" stroke-width="2.5"')
    .replaceAll('stroke="#2a140b" stroke-width="4.5"', 'stroke="#71302c" stroke-width="2.5"')
    .replaceAll('stroke="#2a140b" stroke-width="3"', 'stroke="#71302c" stroke-width="2.5"')
    .replaceAll('stroke="#141418" stroke-width="3.4"', 'stroke="#71302c" stroke-width="2.5"')
    .replaceAll('stroke="#ff8a66" stroke-width="4.5"', 'stroke="#ffbe7d" stroke-width="2"');
  out = out.replace(`fill="url(#vozPecho)" stroke="#71302c" stroke-width="2.5"/>`, `fill="url(#vozPecho)" stroke="#71302c" stroke-width="2.5"/>${materiaPiel()}`);
  return out;
}
