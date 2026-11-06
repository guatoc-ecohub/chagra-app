/**
 * Piel clara de home-a: paleta por familia de color (fuente única para
 * tailwind.config.js y para las pruebas de contraste).
 * ===========================================================================
 * Problema medido (auditoría SSOT de pantallas, hallazgo B1): home-a pinta las
 * vistas internas con la piel `nature`, pero solo slate/emerald/amber eran
 * theme-aware. Las demás familias (red, lime, fuchsia, cyan, stone…) seguían
 * con sus valores de tema oscuro: texto -100/-300 claro y superficies -900/-950
 * oscuras. Sobre el crema quedaban en 1,0–2,5:1 en ~35 pantallas.
 *
 * Solución: TODAS las familias de Tailwind pasan por variables CSS, con tres
 * usos separados para que cada uno se invierta como le corresponde:
 *
 *   --c-<familia>-<n>   superficies, degradados, anillos (bg-, from-, ring-…)
 *   --tx-<familia>-<n>  texto (text-)      → si no existe, cae a --c-
 *   --bd-<familia>-<n>  bordes (border-, divide-) → si no existe, cae a --c-
 *
 * En :root (biopunk/biopunk2) las --c- valen EXACTAMENTE lo de Tailwind y las
 * --tx-/--bd- no existen: el color que resulta es idéntico al de antes.
 * Solo `html[data-theme="nature"][data-piel="home-a"]` (lo escribe applyTheme
 * cuando el tema elegido es home-a) define la rampa clara:
 *
 *   texto:       cualquier tono → tinta -800/-900 de su MISMA familia
 *                (≥5,8:1 sobre el fondo de home-a; conserva rojo = alerta).
 *   superficie:  -800/-900/-950 (fondos oscuros del tema oscuro) → tintes -50/-100;
 *                -500/-600/-700 (botones sólidos) → -700/-800, para que el
 *                blanco encima siga en ≥4,5:1; -50…-400 quedan como están.
 *   borde:       oscuros → líneas suaves -100…-300; claros → -500/-600.
 *
 * emerald y amber usan el verde y el oro propios de home-a; stone comparte la
 * rampa cálida de slate; gray/zinc/neutral se quedan como en Tailwind (la app
 * los escribe ya pensados para fondo claro). Un componente escrito «claro de
 * origen» se marca con data-piel-propia="clara" y recupera los valores de
 * Tailwind. El tema `nature` elegido a mano, minimalista y verde-vivo NO cambian.
 */
import twColors from './tailwindV3Palette.js';

export const TONOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export const FAMILIAS_TINTE = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
];
export const FAMILIAS_NEUTRAS = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
export const FAMILIAS = [...FAMILIAS_TINTE, ...FAMILIAS_NEUTRAS];
/**
 * Neutros que la app usa «oscuro de origen» (texto -100…-400 sobre -800…-950)
 * y por eso se invierten. gray (y zinc/neutral, sin uso) se escriben «claro de
 * origen» (bg-gray-50, text-gray-600): invertirlos rompe esas pantallas, así
 * que bajo home-a conservan su valor Tailwind.
 */
export const NEUTRAS_INVERTIDAS = ['slate', 'stone'];

/** Variables --c- que index.css YA define por tema (no se re-emiten en la base). */
const YA_EN_INDEX_CSS = {
  slate: TONOS,
  emerald: [200, 300, 400, 500, 600, 700, 800, 900],
  amber: [200, 300, 400, 500, 600, 700, 900],
};

/** Colores propios de home-a (src/styles/esquemaHomeA.css), como triples RGB. */
export const HOME_A = {
  fondo: [244, 236, 216],   // --ha-fondo   #f4ecd8
  papel: [255, 250, 240],   // --ha-papel   #fffaf0
  papel2: [246, 238, 219],  // --ha-papel-2 #f6eedb
  filete: [226, 213, 184],  // --ha-filete  #e2d5b8
  tinta: [34, 26, 18],      // --ha-tinta   #221a12
  tinta2: [74, 59, 44],     // --ha-tinta-2 #4a3b2c
  verde: [47, 93, 30],      // --ha-verde   #2f5d1e
  verde2: [63, 116, 40],    // --ha-verde-2 #3f7428
  oro: [242, 182, 50],      // --ha-oro     #f2b632
  teja: [184, 85, 58],      // --ha-teja    #b8553a
};

/**
 * Rampa cálida de chrome (slate y neutros) bajo home-a. Igual que nature, la
 * rampa va INVERTIDA (950 = fondo, 50 = tinta), pero con la tinta café oscura
 * de home-a: el terciario (-500) pasa de 3,9:1 a 6,4:1 sobre el fondo.
 */
const SLATE_HOME_A = {
  950: HOME_A.fondo,
  900: HOME_A.papel,
  800: HOME_A.papel2,
  700: HOME_A.filete,
  600: [214, 197, 163],     // borde medio (solo líneas y rellenos)
  500: [100, 81, 58],       // terciario: 6,4:1 sobre el fondo
  400: [88, 72, 52],        // secundario: 7,5:1
  300: HOME_A.tinta2,       // texto fuerte: 9,1:1
  200: [52, 41, 30],
  100: HOME_A.tinta,        // tinta principal
  50: [26, 20, 14],
};

/** Verde de home-a como rampa tipo Tailwind (700 = --ha-verde). */
const VERDE_HOME_A = {
  50: '#f1f6ea', 100: '#e0ecd2', 200: '#c3daa8', 300: '#9cc27a', 400: '#77a653',
  500: '#57893a', 600: '#3f7428', 700: '#2f5d1e', 800: '#274b1a', 900: '#213f17', 950: '#10230a',
};
/** Oro de home-a como rampa tipo Tailwind (400 = --ha-oro). */
const ORO_HOME_A = {
  50: '#fef8e7', 100: '#fcedc4', 200: '#f9dc8a', 300: '#f6c955', 400: '#f2b632',
  500: '#d9961a', 600: '#b97412', 700: '#8f5512', 800: '#764515', 900: '#643a16', 950: '#3a1e08',
};

/** Tono de la rampa que toma cada uso bajo home-a (familias de tinte). */
export const MAPA_SUPERFICIE = { 50: 50, 100: 100, 200: 200, 300: 300, 400: 400, 500: 700, 600: 700, 700: 800, 800: 100, 900: 100, 950: 50 };
export const MAPA_TEXTO = { 50: 900, 100: 900, 200: 900, 300: 800, 400: 800, 500: 800, 600: 800, 700: 800, 800: 900, 900: 900, 950: 900 };
export const MAPA_BORDE = { 50: 600, 100: 600, 200: 600, 300: 600, 400: 600, 500: 500, 600: 400, 700: 300, 800: 200, 900: 200, 950: 100 };

export function hexARgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
const triple = (rgb) => rgb.join(' ');

/** Rampa (hex por tono) de una familia de tinte bajo home-a. */
export function rampaHomeA(familia) {
  if (familia === 'emerald') return VERDE_HOME_A;
  if (familia === 'amber') return ORO_HOME_A;
  return twColors[familia];
}

/** RGB que cada uso toma bajo home-a: { c, tx, bd }[familia][tono]. */
export function paletaHomeA() {
  const c = {}, tx = {}, bd = {};
  for (const f of FAMILIAS_TINTE) {
    const r = rampaHomeA(f);
    c[f] = {}; tx[f] = {}; bd[f] = {};
    for (const n of TONOS) {
      c[f][n] = hexARgb(r[MAPA_SUPERFICIE[n]]);
      tx[f][n] = hexARgb(r[MAPA_TEXTO[n]]);
      bd[f][n] = hexARgb(r[MAPA_BORDE[n]]);
    }
  }
  for (const f of NEUTRAS_INVERTIDAS) {
    c[f] = {}; tx[f] = {}; bd[f] = {};
    for (const n of TONOS) {
      c[f][n] = SLATE_HOME_A[n];
      // -600/-700 son líneas y rellenos; como TEXTO (tenue en el tema oscuro)
      // toman el terciario legible.
      tx[f][n] = n === 600 || n === 700 ? SLATE_HOME_A[500] : SLATE_HOME_A[n];
      bd[f][n] = SLATE_HOME_A[n];
    }
  }
  return { c, tx, bd };
}

/** Valores Tailwind exactos (piel oscura base) como triples RGB. */
export function paletaBase() {
  const c = {};
  for (const f of FAMILIAS) {
    c[f] = {};
    for (const n of TONOS) c[f][n] = hexARgb(twColors[f][n]);
  }
  return c;
}

// ── Utilidades para tailwind.config.js ─────────────────────────────────────
const conAlfa = (expr) => `rgb(${expr} / <alpha-value>)`;
const porTono = (fn) => Object.fromEntries(TONOS.map((n) => [n, fn(n)]));

export const coloresPorVariable = Object.fromEntries(
  FAMILIAS.map((f) => [f, porTono((n) => conAlfa(`var(--c-${f}-${n})`))]),
);
export const textoPorVariable = Object.fromEntries(
  FAMILIAS.map((f) => [f, porTono((n) => conAlfa(`var(--tx-${f}-${n}, var(--c-${f}-${n}))`))]),
);
export const bordePorVariable = Object.fromEntries(
  FAMILIAS.map((f) => [f, porTono((n) => conAlfa(`var(--bd-${f}-${n}, var(--c-${f}-${n}))`))]),
);

// ── Reglas de excepción (combinaciones que una rampa sola no resuelve) ─────
/** Botones sólidos oscuros bajo home-a: su texto claro se queda blanco. */
const fondosSolidosOscuros = FAMILIAS_TINTE.flatMap((f) => [500, 600, 700].map((n) => `.bg-${f}-${n}`));
const textosClaros = [
  '.text-white', '.text-white\\/90', '.text-white\\/80', '.text-black',
  // -50…-200 (claro sobre botón oscuro) y -800…-950 (oscuro sobre botón
  // brillante del tema oscuro, que bajo home-a ya es oscuro).
  ...FAMILIAS_TINTE.flatMap((f) => [50, 100, 200, 800, 900, 950].map((n) => `.text-${f}-${n}`)),
];
/** Rellenos -800…-950 sólidos: bajo home-a son tinte claro. */
const fondosTinteClaro = FAMILIAS_TINTE.flatMap((f) => [800, 900, 950].map((n) => `.bg-${f}-${n}`));
/** Velos de foto y capas negras fijas (no las vira ningún tema). */
const VELOS_NEGROS = ['55', '70', '85', '90', '95'];
const CAPAS_NEGRAS = ['60', '70', '75', '80', '85', '90'];
const TEXTO_SUELTO = 'h1,h2,h3,h4,p,li,span,strong,b,em,small,label,figcaption';
/** Rellenos brillantes (siguen claros bajo home-a): su texto «950» va oscuro. */
const fondosBrillantes = FAMILIAS_TINTE.flatMap((f) => [200, 300, 400].map((n) => `.bg-${f}-${n}`));
/**
 * Fondos oscuros escritos como valor arbitrario en las fichas de cultivo
 * (bg-[#241a0c]/50 …). Bajo home-a pasan a papel.
 */
export const HEX_OSCUROS_FICHAS = [
  '#241a0c', '#241811', '#1a2413', '#221a38', '#241d11', '#1a2412', '#241708', '#16261c',
  '#20180f', '#2a1c12', '#2a1e0d', '#2a1c0f', '#221d10', '#14231a', '#10291d', '#101b26',
];
/** nature colapsa estos -500 a un verde claro; bajo home-a vuelven a su -700. */
const NATURE_500_COLAPSADOS = ['cyan', 'lime', 'fuchsia', 'sky', 'orange', 'violet', 'yellow'];

const HA = 'html[data-theme="nature"][data-piel="home-a"]';

/** CSS (objeto addBase) con las variables por tema y las excepciones de home-a. */
function homeAThemeVars() {
  const ha = paletaHomeA();
  const homeA = {};
  for (const f of Object.keys(ha.c)) {
    for (const n of TONOS) {
      homeA[`--c-${f}-${n}`] = triple(ha.c[f][n]);
      homeA[`--tx-${f}-${n}`] = triple(ha.tx[f][n]);
      homeA[`--bd-${f}-${n}`] = triple(ha.bd[f][n]);
    }
  }
  Object.assign(homeA, {
    '--c-surface': triple(HOME_A.fondo),
    '--c-surface-card': triple(HOME_A.papel),
    '--c-surface-raised': triple(HOME_A.papel2),
    '--c-surface-border': triple(HOME_A.filete),
    '--c-muzo': triple(HOME_A.verde),
    '--c-muzo-glow': triple(HOME_A.verde2),
    '--c-morpho': triple(HOME_A.verde),
    '--c-morpho-glow': triple(HOME_A.verde2),
    '--c-orchid': triple(HOME_A.teja),
    '--c-orchid-glow': triple(HOME_A.oro),
    '--c-frog': triple(HOME_A.oro),
    '--c-frog-glow': triple(hexARgb(ORO_HOME_A[300])),
    '--scrim-bg': triple(HOME_A.fondo),
  });
  return homeA;
}

export function baseCss() {
  const base = paletaBase();
  const raiz = {};
  for (const f of FAMILIAS) {
    for (const n of TONOS) {
      if (YA_EN_INDEX_CSS[f]?.includes(n)) continue;
      raiz[`--c-${f}-${n}`] = triple(base[f][n]);
    }
  }
  const homeA = homeAThemeVars();
  return {
    // Las variables nuevas valen lo de Tailwind en todos los temas. Los
    // contenedores de vista previa (data-theme anidado) anulan --tx-/--bd- para
    // no heredar la rampa de home-a del <html>.
    ':root, [data-theme="biopunk"], [data-theme="biopunk2"], [data-theme="nature"], [data-theme="minimalista"], [data-theme="verde-vivo"]': raiz,
    '[data-theme="biopunk"], [data-theme="biopunk2"], [data-theme="minimalista"], [data-theme="verde-vivo"]': Object.fromEntries(
      FAMILIAS.flatMap((f) => TONOS.flatMap((n) => [[`--tx-${f}-${n}`, 'initial'], [`--bd-${f}-${n}`, 'initial']])),
    ),
    [HA]: homeA,
    // Componentes escritos para fondo claro (CRM, Mundo Subsuelo): recuperan
    // los valores de Tailwind dentro de su raíz.
    [`${HA} [data-piel-propia="clara"]`]: {
      ...Object.fromEntries(FAMILIAS.flatMap((f) => TONOS.map((n) => [`--c-${f}-${n}`, triple(base[f][n])]))),
      ...Object.fromEntries(FAMILIAS.flatMap((f) => TONOS.flatMap((n) => [[`--tx-${f}-${n}`, 'initial'], [`--bd-${f}-${n}`, 'initial']]))),
    },
  };
}

/**
 * Reglas con selectores de clase. NO van por addBase: Tailwind les aplicaría
 * sus variantes (file:, hover:…) al encontrar esas clases en el código. Se
 * escriben en src/styles/piel-home-a.css con `node scripts/gen-piel-home-a.mjs`
 * (una prueba verifica que el fichero coincida con esta fuente).
 */
export function reglasExcepcion() {
  // Dentro de una foto con velo negro o de una capa negra.
  const fondoNegro = [
    ...VELOS_NEGROS.map((v) => `.from-black\\/${v} ~ *, .from-black\\/${v} ~ * *`),
    ...CAPAS_NEGRAS.map((v) => `.bg-black\\/${v} *`),
  ].join(', ');
  const cssOro = `rgb(${triple(hexARgb(ORO_HOME_A[800]))})`;
  return {
    // Tailwind 4 coloca addBase() en @layer base. Las variables de cada tema
    // declaradas fuera de capas tienen prioridad sobre esa capa aunque su
    // selector sea menos específico. Repetimos home-a sin capa para preservar
    // la rampa clara frente a los tokens nature de src/index.css.
    [HA]: homeAThemeVars(),
    // Color por defecto (especificidad cero: cualquier clase text-* del propio
    // elemento gana) para lo que hereda el color de su padre y cae sobre un
    // relleno sólido que cambió de claridad: -500…-700 quedan oscuros y llevan
    // blanco; -800…-950 quedan tinte claro y llevan tinta.
    [`:where(${HA}) :where(${fondosSolidosOscuros.join(',')})`]: { color: '#fff' },
    [`:where(${HA}) :where(${fondosTinteClaro.join(',')})`]: { color: `rgb(${triple(HOME_A.tinta)})` },
    // Blanco (o tinte claro) sobre botón sólido oscuro: sigue blanco. nature lo
    // vira a café en general; aquí el fondo -500…-700 ya es oscuro. Las
    // pantallas .ha-data-screen ya traen su propia piel y se respetan.
    [`${HA} :is(${fondosSolidosOscuros.join(',')}):is(${textosClaros.join(',')}):not(.ha-data-screen *)`]: {
      color: '#fff !important',
    },
    // Texto «950/900» de slate (crema bajo la piel clara) sobre relleno brillante.
    [`${HA} :is(${fondosBrillantes.join(',')}):is(.text-slate-950,.text-slate-900,.text-black)`]: {
      color: `rgb(${triple(HOME_A.tinta)}) !important`,
    },
    ...Object.fromEntries(NATURE_500_COLAPSADOS.map((f) => [
      `${HA} .bg-${f}-500`, { 'background-color': `rgb(var(--c-${f}-500)) !important` },
    ])),
    [`${HA} :is(${HEX_OSCUROS_FICHAS.map((h) => `[class*="bg-[${h}]"]`).join(',')})`]: {
      'background-color': `rgb(${triple(HOME_A.papel)} / 0.82) !important`,
    },
    // nature tiñe todo text-amber-* de un ocre fijo; bajo home-a, el oro propio.
    [`${HA} :is(.text-amber-100,.text-amber-200,.text-amber-300,.text-amber-400,.text-amber-500,.text-amber-100\\/90,.text-amber-200\\/90,.text-amber-400\\/70)`]: {
      color: `${cssOro} !important`,
    },
    // Texto sobre FOTO con velo negro fijo (from-black/85 de las fichas) o
    // sobre capa negra (bg-black/80 de los juegos): el fondo sigue oscuro, así
    // que el texto vuelve a blanco. Los botones con relleno propio no se tocan.
    [`${HA} :is(${VELOS_NEGROS.map((v) => `.from-black\\/${v} ~ *`).join(',')}) :is(${TEXTO_SUELTO}):not(button *)`]: {
      color: '#fff !important',
      'text-shadow': '0 1px 2px rgb(0 0 0 / 0.55)',
    },
    [`${HA} :is(${VELOS_NEGROS.map((v) => `.from-black\\/${v} ~ :is(${TEXTO_SUELTO})`).join(',')})`]: {
      color: '#fff !important',
      'text-shadow': '0 1px 2px rgb(0 0 0 / 0.55)',
    },
    [`${HA} :is(${CAPAS_NEGRAS.map((v) => `.bg-black\\/${v}`).join(',')}) :is(${TEXTO_SUELTO}):not(button *, [class*="bg-"])`]: {
      color: '#fff !important',
    },
    // Blanco translúcido suelto (sin relleno propio) sobre el papel: tinta.
    // nature solo cubría text-white, /60 y /70.
    [`${HA} :is(.text-white\\/75,.text-white\\/80,.text-white\\/85,.text-white\\/90):not([class*="bg-"]):not(${fondoNegro})`]: {
      color: `rgb(${triple(HOME_A.tinta)}) !important`,
    },
    [`${HA} :is(.text-white\\/30,.text-white\\/40,.text-white\\/50):not([class*="bg-"]):not(${fondoNegro})`]: {
      color: `rgb(${triple(SLATE_HOME_A[500])}) !important`,
    },
    // Botón sólido desactivado: con opacity .4–.6 sobre el crema el blanco
    // queda en <2:1. Bajo home-a se ve apagado por color, no por transparencia.
    [`${HA} :is(${fondosSolidosOscuros.join(',')}):disabled:is(.disabled\\:opacity-40,.disabled\\:opacity-50,.disabled\\:opacity-60)`]: {
      opacity: '1',
      'background-color': `rgb(${triple(HOME_A.filete)}) !important`,
      color: `rgb(${triple(HOME_A.tinta2)}) !important`,
    },
    // Texto de tinte con alfa (text-green-200/70): en el tema oscuro el alfa
    // atenúa un color claro; sobre papel deja la tinta en ~2,8:1. Va opaca.
    ...Object.fromEntries(FAMILIAS_TINTE.flatMap((f) => [50, 100, 200, 300, 400].map((n) => [
      `${HA} :is(${[60, 70, 75, 80].map((a) => `.text-${f}-${n}\\/${a}`).join(',')})`,
      { color: `rgb(var(--tx-${f}-${n}))` },
    ]))),
  };
}

/** Serializa reglasExcepcion() como CSS plano. */
export function reglasExcepcionCss() {
  const cuerpo = Object.entries(reglasExcepcion()).map(([sel, decl]) => {
    const lineas = Object.entries(decl).map(([k, v]) => `  ${k}: ${v};`).join('\n');
    return `${sel.split(/,(?![^(]*\))/).join(',\n')} {\n${lineas}\n}`;
  }).join('\n\n');
  return `/* GENERADO por scripts/gen-piel-home-a.mjs desde src/styles/pielHomeA.js. No editar a mano. */\n\n${cuerpo}\n`;
}
