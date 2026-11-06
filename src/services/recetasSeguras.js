// SPDX-License-Identifier: AGPL-3.0-only
/**
 * recetasSeguras — respuestas y guardas DETERMINISTAS para recetas, mezclas y
 * controles donde un error del modelo hace daño directo (auditoría de producto
 * 2026-10-04, lente agroecólogo).
 *
 * Dos capas, mismo criterio que `buildPriceAnswer` + `outputGuards`:
 *
 *   1. `buildRecetaSeguraAnswer({ userMessage })` responde SIN LLM dos
 *      preguntas cuya respuesta correcta es fija y el modelo erraba siempre:
 *        - cuánto compostar estiércol (gallinaza…) antes de usarlo en hortalizas
 *          (el modelo cambiaba la pregunta por un "té de gallinaza" foliar);
 *        - si un microorganismo (Trichoderma, Beauveria…) se mezcla con un caldo
 *          mineral (sulfocálcico, bordelés…) (el modelo no respondía, o decía
 *          "no mezclar" y luego recomendaba un "bordelés enriquecido").
 *      Al no depender del LLM, tampoco cae en "Chagra no puede responder".
 *
 *   2. Guardas de SALIDA (puras, síncronas, firma `(text, { userMessage })`)
 *      para las variantes que sí pasan por el modelo:
 *        - guardEstiercolFoliarHortalizas: quita la aplicación foliar de
 *          estiércol/té de estiércol sobre hortalizas y antepone la regla de
 *          inocuidad;
 *        - guardMezclaMicroorganismoCaldoMineral: reemplaza toda respuesta que
 *          recomiende juntar un microorganismo con un caldo mineral;
 *        - guardBrocaRecoleccion: quita el consejo de NO retirar granos
 *          brocados y garantiza la recolección oportuna + repase (Re-Re);
 *        - guardCogolleroControlBiologico: corrige "Beauveria (Bt)", quita las
 *          mallas sobre el maíz y garantiza Bt + baculovirus + parasitoides;
 *        - guardMetanolSinAdvertencia: toda mención de metanol lleva sus
 *          cuidados y la proporción metanol:etanol 3:1 con su fuente.
 *
 * Fuentes de los hechos fijos:
 *   - Compostaje: EPA 40 CFR Parte 503, Apéndice B, proceso de reducción
 *     adicional de patógenos (PFRP): 55 °C o más durante 3 días en pila
 *     estática aireada o en recipiente; 55 °C o más durante 15 días con al menos
 *     5 volteos en camellón. Texto leído en ecfr.gov el 2026-10-04.
 *   - Broca: public/cycle-content/practica_broca_cafe.json (Cenicafé/FNC, RE-RE).
 *   - Cogollero: public/cycle-content/practica_cogollero_maiz.json (AGROSAVIA,
 *     EMBRAPA).
 *   - Sulfocálcico: public/cycle-content/practica_caldo_sulfocalcico.json
 *     (Restrepo Rivera 2004) y la ficha de Trichoderma del catálogo
 *     (incompatible con cúpricos; la viabilidad cae con pH muy alcalino).
 *
 * Copy de cara al usuario: usted, sin raya larga (AGENTS.md).
 *
 * @module recetasSeguras
 */

import { stripDiacritics } from './outputGuardQueryUtils.js';
import { segmentarOraciones } from './respuestaCorta.js';
import { AVISO_ESTIERCOL_CRUDO } from '../data/biopreparadosFichas.js';

const norm = (s) => (typeof s === 'string' ? stripDiacritics(s) : '');

// ── Vocabulario ─────────────────────────────────────────────────────────────

/** Estiércoles animales (texto normalizado, sin tildes). */
const ESTIERCOL_RE =
  /\b(gallinaza|pollinaza|porquinaza|cerdaza|bovinaza|caprinaza|conejaza|cuyinaza|equinaza|estiercol(es)?|bonig\w*|majada|excremento|abono de (gallina|pollo|vaca|cerdo|chivo|conejo|cuy|caballo))\b/;

/** Pregunta por el TIEMPO/PROCESO de compostar o curar el estiércol. */
const COMPOSTAR_PREGUNTA_RE =
  /\b(compost\w*|curar\w*|curado|madur\w*|descompon\w*|cuanto tiempo|cuantos dias|cuantas semanas|antes de usar\w*|antes de aplicar\w*|antes de echar\w*)\b/;

/** Cultivos que se comen crudos o tocan el suelo (hortalizas). */
const HORTALIZA_RE =
  /\b(hortaliza\w*|huerta\w*|lechuga\w*|cilantro|espinaca\w*|acelga\w*|repollo\w*|col\b|coles\b|brocoli|coliflor\w*|rabano\w*|zanahoria\w*|perejil|apio|cebollin\w*|cebolla\w*|tomate\w*|pepino\w*|pimenton\w*|fresa\w*|aromatica\w*|hierbabuena|albahaca|kale|rucula)\b/;

/** Aplicación foliar / sobre la parte aérea. */
const FOLIAR_RE =
  /\b(foliar\w*|asperj\w*|aspersion\w*|rocia\w*|rocie\w*|rociar|pulveriz\w*|fumig\w*|sobre (las|sus) hojas|a las hojas|al follaje|en el follaje)\b/;

/** Microorganismos vivos de control o de suelo. */
const MICROORGANISMO_RE =
  /\b(trichoderma|beauveria|metarhizium|lecanicillium|paecilomyces|purpureocillium|bacillus|micorriza\w*|microorganismos? (de montana|eficientes|benefico\w*)|hongo\w* (benefico\w*|antagonista\w*|entomopatogeno\w*))\b/;

/** Caldos minerales (fungicidas): sulfocálcico, bordelés, visosa, cobre. */
const CALDO_MINERAL_RE =
  /\b(sulfocalcico|polisulfuro\w*|caldo bordeles|bordeles|caldo visosa|visosa|sulfato de cobre|oxicloruro de cobre|hidroxido de cobre|cuprico\w*|caldo mineral\w*)\b/;

/** Giros de usar juntos / mezclar. */
const JUNTOS_RE =
  /\b(junt\w*|mezcl\w*|combin\w*|revolv\w*|enriquecid\w*|enriquec\w*|agreg\w*|anad\w*|incorpor\w*|a la vez|al tiempo|al mismo tiempo|mismo tanque|misma bomba)\b/;

/** Negación de la mezcla en la misma oración. */
const NIEGA_MEZCLA_RE =
  /\b(no\s+(los\s+|las\s+|lo\s+|la\s+)?(mezcl|combin|junt|aplique|apliquen|aplicar)\w*|nunca|jamas|incompatible\w*|por separado|separad\w*|separacion|aparte|evite\w*|evitar)\b/;

// ── Respuestas deterministas ────────────────────────────────────────────────

/** Fuente de la regla de compostaje (PFRP). */
export const FUENTE_COMPOSTAJE = {
  fuente: 'EPA 40 CFR 503, Apéndice B (proceso de reducción de patógenos por compostaje)',
  fuente_url: 'https://www.ecfr.gov/current/title-40/chapter-I/subchapter-O/part-503/appendix-Appendix%20B%20to%20Part%20503',
};

/** Fuente de la regla de mezcla microorganismo + caldo mineral. */
export const FUENTE_MEZCLA = {
  fuente: 'Restrepo Rivera (2004), caldo sulfocálcico; ficha de Trichoderma del catálogo Chagra',
};

/** Marca idempotente de la respuesta de compostaje. */
export const MARCA_COMPOSTAJE = 'Compostaje del estiércol para hortalizas';

/** Marca idempotente de la respuesta de mezcla. */
export const MARCA_MEZCLA = 'No se mezclan en el mismo tanque';

const AVISO_CRUDO =
  'No aplique estiércol, ni fresco ni en té, sobre lo que se come crudo (lechuga, cilantro, ' +
  'fresa, rábano) cerca de la cosecha, y nunca lo rocíe sobre las hojas de las hortalizas: ' +
  'el riesgo es llevar E. coli o Salmonella a la mesa.';

/**
 * Texto fijo de compostaje de estiércol para hortalizas.
 * @param {string} nombre  estiércol nombrado por el usuario (p.ej. "gallinaza").
 */
function _respuestaCompostaje(nombre) {
  return (
    `${MARCA_COMPOSTAJE}:\n\n` +
    `La ${nombre} no se usa fresca ni en té sobre hortalizas. Primero se composta en caliente ` +
    'toda la masa, y lo que cuenta es la TEMPERATURA y los DÍAS, no la fecha:\n' +
    '- Pila quieta con aire (con tubos o capas que dejen respirar): 55 °C o más durante 3 días seguidos en todo el montón.\n' +
    '- Pila que se voltea: 55 °C o más durante 15 días, con al menos 5 volteos en ese tiempo para que todo pase por el centro caliente.\n' +
    'Mida con un termómetro de varilla en varios puntos representativos de toda la masa, incluyendo centro, bordes y distintas profundidades, después de cada volteo. Si no llega a 55 °C, esos días no cuentan.\n\n' +
    'Después viene la MADURACIÓN: deje la pila varias semanas más, hasta que ya no caliente al voltearla, ' +
    'huela a tierra de monte y no a amoníaco. Antes de usarla, haga la prueba de germinación: siembre unas ' +
    'semillas de rábano o lechuga en una muestra del compost; la germinación orienta sobre madurez y fitotoxicidad, pero no demuestra inocuidad ni ausencia de patógenos.\n\n' +
    `${AVISO_CRUDO} Incorpórelo al suelo antes de sembrar o trasplantar.`
  );
}

/**
 * Texto fijo de microorganismo + caldo mineral.
 * @param {string} micro    microorganismo nombrado (p.ej. "Trichoderma").
 * @param {string} caldo    caldo nombrado (p.ej. "caldo sulfocálcico").
 */
function _respuestaMezcla(micro, caldo) {
  // RA3 2026-10-11 (R09): la versión anterior vetaba todo microorganismo con
  // todo caldo y dejaba la separación en «varios días» sin producto ni fuente.
  // Sin producto declarado no hay intervalo honesto: se pide etiqueta, cepa y
  // formulación antes de darlo, y la regla queda en el par que se preguntó.
  const esHongo = norm(micro) === 'trichoderma' || /^(beauveria|metarhizium|lecanicillium|paecilomyces|purpureocillium)$/.test(norm(micro));
  return (
    `${MARCA_MEZCLA}: el ${micro} y el ${caldo} no se aplican juntos en la misma bomba.\n\n` +
    `El ${caldo} es un fungicida mineral. ` +
    (esHongo ? `El ${micro} es un hongo vivo, ` : `El ${micro} es un microorganismo vivo, `) +
    'y en el mismo tanque el caldo puede matarlo o debilitarlo. Con este caldo no hay mezcla "enriquecida" segura.\n\n' +
    `Cuántos días dejar entre uno y otro depende del producto. Para decírselo necesito la etiqueta, la cepa y la formulación del ${micro} que tiene (polvo, líquido, granulado). La etiqueta suele traer con qué es compatible y cuánto esperar.\n\n` +
    'Mientras tanto, sepárelos en el sitio:\n' +
    `- El ${micro} va al suelo o a la semilla: al hoyo de siembra, en el sustrato o en drench al pie de la planta.\n` +
    `- El ${caldo} va al follaje, cuando lo necesite contra hongos o ácaros.\n` +
    '- Lave bien la bomba entre una aplicación y otra.\n\n' +
    `¿Qué producto de ${micro} tiene y qué dice su etiqueta?`
  );
}

/** Nombre legible del estiércol mencionado (o "gallinaza" por defecto). */
function _nombreEstiercol(userNorm) {
  const m = userNorm.match(ESTIERCOL_RE);
  if (!m) return 'gallinaza';
  const t = m[0];
  if (/^estiercol/.test(t)) return 'materia de estiércol';
  if (/^bonig/.test(t)) return 'boñiga';
  if (t === 'majada' || t === 'excremento' || t.startsWith('abono de')) return 'materia de estiércol';
  return t;
}

const MICRO_LEGIBLE = {
  trichoderma: 'Trichoderma',
  beauveria: 'Beauveria',
  metarhizium: 'Metarhizium',
  lecanicillium: 'Lecanicillium',
  paecilomyces: 'Paecilomyces',
  purpureocillium: 'Purpureocillium',
  bacillus: 'Bacillus',
};

function _nombreMicro(textNorm) {
  const m = textNorm.match(MICROORGANISMO_RE);
  if (!m) return 'microorganismo';
  return MICRO_LEGIBLE[m[1]] || 'microorganismo';
}

function _nombreCaldo(textNorm) {
  const m = textNorm.match(CALDO_MINERAL_RE);
  if (!m) return 'caldo mineral';
  const t = m[1];
  if (t === 'sulfocalcico' || t.startsWith('polisulfuro')) return 'caldo sulfocálcico';
  if (t.includes('bordeles')) return 'caldo bordelés';
  if (t.includes('visosa')) return 'caldo visosa';
  return 'caldo de cobre';
}

/** ¿La pregunta es "cuánto compostar estiércol para hortalizas"? */
export function esPreguntaCompostajeEstiercol(userMessage) {
  const u = norm(userMessage);
  if (!u) return false;
  return ESTIERCOL_RE.test(u) && COMPOSTAR_PREGUNTA_RE.test(u) && HORTALIZA_RE.test(u);
}

/** ¿La pregunta junta un microorganismo con un caldo mineral? */
export function esPreguntaMezclaMicroorganismoCaldo(userMessage) {
  const u = norm(userMessage);
  if (!u) return false;
  return MICROORGANISMO_RE.test(u) && CALDO_MINERAL_RE.test(u);
}

/**
 * Respuesta determinista (sin LLM) para las preguntas de inocuidad/mezcla cuya
 * respuesta correcta es fija. null si la pregunta no es de esas.
 *
 * @param {{userMessage?: string|null}} [args]
 * @returns {{text: string, id: string, corto?: string, fuente?: string, fuente_url?: string, catalog_answer?: string, resolvedEntities?:any[]}|null}
 */
export function buildRecetaSeguraAnswer({ userMessage = null } = {}) {
  const u = norm(userMessage);
  if (!u) return null;
  // RA5 2026-10-24: mezclar dos insumos y cosechar tras aplicar uno van antes
  // que la receta del bordelés, que de lo contrario contesta las dos.
  const mezcla = respuestaMezclaInsumos(u);
  if (mezcla) return mezcla;
  const carencia = respuestaCosechaTrasInsumo(u);
  if (carencia) return carencia;
  if (/\bbordeles\b/.test(u) && /\b(prepar\w*|receta|dosis|gota|aplic\w*|usar|uso)\b/.test(u) && !MICROORGANISMO_RE.test(u) && !/\b(mezcl|combin)\w*/.test(u)) {
    return {
      id: 'bordeles_catalogo',
      text: RESPUESTA_BORDELES,
      fuente: FUENTE_BORDELES,
    };
  }
  if (esPreguntaDefinicionCompost(u)) {
    return { id: 'compost_definicion', text: RESPUESTA_COMPOST_DEFINICION, fuente: FUENTE_COMPOST_DEFINICION };
  }
  if (esPreguntaManejoGota(u)) {
    const gota = respuestaGotaPorCultivo(u);
    return { id: 'gota_manejo', text: gota.text, fuente: gota.fuente };
  }
  if (/\btomate\b/.test(u) && /hojas?/.test(u) && /bajas?|inferiores?|abajo/.test(u) && /amarill\w*/.test(u)) {
    return {
      id: 'tomate_hojas_bajas_amarillas',
      text: 'Sobre las hojas bajas amarillas del tomate: ese dato por sí solo no confirma una enfermedad ni permite indicar un tratamiento. ¿Desde cuándo ocurre, cuántas plantas están afectadas y cómo está la humedad del suelo? Revise si hay manchas, marchitez o daño en raíces y si también cambian las hojas nuevas. Envíe una foto de la planta completa y otra de las hojas afectadas para orientar el diagnóstico. No aplique productos sin identificar la causa.',
    };
  }
  if (BROCA_RE.test(u) && (/\b(control\w*|manej\w*|biologic\w*|beauveria)\b/.test(u)
    || (/\b(cafe|cafetal|cafeto)\b/.test(u) && /\bque\s+(?:le\s+)?(?:hago|hacer)\b/.test(u)))) {
    return { id: 'broca_manejo', text: guardBrocaRecoleccion(BLOQUE_BROCA_ENEMIGOS, {userMessage}).text, fuente: `Cenicafé: recolección oportuna y repase; Beauveria: ${FUENTE_BEAUVERIA_BROCA.fuente}; trampas: ${FUENTE_TRAMPA_BROCA.fuente}`, fuente_url: FUENTE_TRAMPA_BROCA.fuente_url };
  }
  if (esPreguntaManejoCogollero(u)) {
    return { id: 'cogollero_manejo', text: RESPUESTA_COGOLLERO, fuente: 'AGROSAVIA: manejo del gusano cogollero del maíz' };
  }
  if (esPreguntaMezclaMicroorganismoCaldo(userMessage)) {
    return {
      id: 'mezcla_microorganismo_caldo_mineral',
      text: _respuestaMezcla(_nombreMicro(u), _nombreCaldo(u)),
      ...FUENTE_MEZCLA,
    };
  }
  if (esPreguntaCompostajeEstiercol(userMessage)) {
    return {
      id: 'compostaje_estiercol_hortalizas',
      text: _respuestaCompostaje(_nombreEstiercol(u)),
      ...FUENTE_COMPOSTAJE,
    };
  }
  return null;
}

// ── Cosecha después de un insumo y mezcla de dos insumos ────────────────────

// RA5 2026-10-24 (RECETAS-02, P0): «Le eché biol a la lechuga ayer, ¿cuándo la
// puedo cosechar para vender?» iba a precios SIPSA por «vender» y contestaba el
// precio de la lechuga. (PREPARAR-02, P0): «¿Puedo aplicar caldo sulfocálcico
// y caldo bordelés el mismo día?» caía en la receta del bordelés («Úselo el
// mismo día»). Las dos son preguntas de seguridad: la respuesta empieza por el
// plazo o por «no se mezclan», con lo que dice la ficha de la app. Si la ficha
// no trae el número con fuente, se dice así.

/**
 * Insumos que una pregunta puede nombrar. `estiercol`: la ficha lleva
 * estiércol fresco (aviso de lo crudo). `familia`: para las incompatibilidades.
 */
const INSUMOS = [
  { re: /\bbiol(es)?\b/, nombre: 'el biol', estiercol: true },
  { re: /\bsuper ?magro\b/, nombre: 'el supermagro', estiercol: true, familia: 'cobre' },
  { re: /\bbo[ck]ashi\b/, nombre: 'el bocashi', estiercol: true },
  { re: /\bte de (compost|estiercol|gallinaza|pollinaza|bonig\w*)\b/, nombre: 'el té de compost', estiercol: true },
  { re: ESTIERCOL_RE, nombre: 'el estiércol', estiercol: true },
  { re: /\b(sulfocalcico|polisulfuro\w*)\b/, nombre: 'el caldo sulfocálcico', familia: 'azufre', caldo: true },
  { re: /\bbordeles\b/, nombre: 'el caldo bordelés', familia: 'cobre', caldo: true },
  { re: /\bvisosa\b/, nombre: 'el caldo visosa', familia: 'cobre', caldo: true },
  { re: /\b(sulfato de cobre|oxicloruro de cobre|hidroxido de cobre|cuprico\w*)\b/, nombre: 'el cobre', familia: 'cobre', caldo: true },
  { re: /\baceites?\b/, nombre: 'el aceite', familia: 'aceite' },
  { re: /\bpurin\w*\b/, nombre: 'el purín' },
  { re: /\b(fungicida|insecticida|herbicida|plaguicida|agroquimico|veneno)s?\b/, nombre: 'el producto', comercial: true },
];

/**
 * Pares que la ficha de la app da por incompatibles: el sulfocálcico no va con
 * el bordelés ni con aceites, y el bordelés no va con aceites. Los días de
 * separación los deja «sin dato con fuente» (ficha del caldo sulfocálcico y
 * del caldo bordelés, sección de cuidados).
 */
const PARES_INCOMPATIBLES = [
  ['azufre', 'cobre'],
  ['azufre', 'aceite'],
  ['cobre', 'aceite'],
];

/** Insumos distintos que nombra el texto, en orden de aparición. */
function _insumosEn(u) {
  const vistos = [];
  for (const ins of INSUMOS) {
    const m = u.match(ins.re);
    if (!m) continue;
    if (vistos.some((v) => v.ins.nombre === ins.nombre || (ins.re === ESTIERCOL_RE && v.ins.estiercol))) continue;
    vistos.push({ ins, pos: m.index });
  }
  return vistos.sort((a, b) => a.pos - b.pos).map((v) => v.ins);
}

/** Ya aplicó (o va a aplicar) el insumo antes de cosechar. */
const APLICACION_RE =
  /\b(eche|heche|echamos|aplique|aplico|aplicamos|aplicad\w*|abone|abonamos|abonad\w*|regue|regamos|regad\w*|rocie|rociamos|rociad\w*|fumigue|fumigamos|fumigad\w*|asperje|asperjamos|puse|pusimos|tratad\w*|le di|les di|despues de(l)? (aplicar|echar|regar|rociar|fumigar|abonar|usar)?|despues del|tras (aplicar|echar|el|la)|luego de(l)?|desde que)\b/;

/** Cosechar, recoger, sacar o vender/comer lo cosechado. */
const COSECHA_RE =
  /\b(cosech\w*|recog\w*|arranc\w*|coger\w*|sacar\w*|vend\w*|venta|comer\w*|consum\w*)\b/;

/** Hortalizas cuya parte comestible toca el suelo (de hoja y de raíz). */
const TOCA_SUELO_RE =
  /\b(lechuga\w*|cilantro|espinaca\w*|acelga\w*|repollo\w*|col|coles|kale|rucula|perejil|apio|cebollin\w*|cebolla\w*|ajo\w*|rabano\w*|zanahoria\w*|remolacha\w*|papa\w*|arracacha\w*|yuca\w*|fresa\w*|hierbabuena|aromatica\w*|hortaliza\w* de hoja)\b/;

/** Plazos que trae la ficha del estiércol fresco: [no toca el suelo, toca el suelo]. */
function _plazosFicha() {
  const m = AVISO_ESTIERCOL_CRUDO.match(/(\d+) días si lo que se cosecha no toca el suelo, y (\d+) días si lo toca/);
  return m ? { noToca: m[1], toca: m[2] } : null;
}

/** Fuente que cita la ficha para los plazos del estiércol crudo. */
export const FUENTE_CARENCIA_ESTIERCOL = {
  fuente: 'Ficha de la app (biol y demás preparados con estiércol): norma orgánica de EE. UU., 7 CFR 205.203(c)(1)',
  fuente_url: 'https://www.ecfr.gov/current/title-7/subtitle-B/chapter-I/subchapter-M/part-205/subpart-C/section-205.203',
};

/** ¿Pregunta cuándo cosechar (o vender, comer) después de aplicar un insumo? */
export function esPreguntaCosechaTrasInsumo(userMessage) {
  const u = norm(userMessage);
  if (!u) return false;
  return _insumosEn(u).length > 0 && APLICACION_RE.test(u) && COSECHA_RE.test(u);
}

function respuestaCosechaTrasInsumo(u) {
  if (!esPreguntaCosechaTrasInsumo(u)) return null;
  const insumos = _insumosEn(u);
  const ins = insumos.find((i) => i.estiercol) || insumos.find((i) => i.comercial) || insumos[0];
  const cultivo = (u.match(TOCA_SUELO_RE) || u.match(HORTALIZA_RE) || [])[0] || null;
  const tocaSuelo = Boolean(cultivo && TOCA_SUELO_RE.test(cultivo));
  const de = ins.nombre.replace(/^el /, 'del ');

  if (ins.estiercol) {
    const plazos = _plazosFicha();
    const plazo = !plazos
      ? `Plazo para cosechar después ${de}: sin dato con fuente en la ficha de la app.`
      : tocaSuelo
        ? `Plazo para cosechar ${cultivo} después ${de}: al menos ${plazos.toca} días desde la última aplicación, porque lo que se come toca el suelo.`
        : `Plazo para cosechar después ${de}: al menos ${plazos.noToca} días desde la última aplicación si lo que se cosecha no toca el suelo, y ${plazos.toca} días si lo toca (hortalizas de hoja y de raíz).`;
    const plazoCorto = !plazos
      ? `Plazo después ${de}: sin dato con fuente.`
      : tocaSuelo
        ? `Plazo: al menos ${plazos.toca} días entre ${ins.nombre} y la cosecha de ${cultivo}, porque toca el suelo.`
        : `Plazo: al menos ${plazos.noToca} días entre ${ins.nombre} y la cosecha si no toca el suelo, y ${plazos.toca} si lo toca.`;
    return {
      id: 'carencia_insumo',
      corto: `${plazoCorto} Lleva estiércol fresco: no coseche antes para vender ni para comer.`,
      text: [
        plazo,
        `Por qué: ${ins.nombre} lleva estiércol fresco, que puede traer E. coli o Salmonella, y la fermentación no los elimina. ` +
          'Lo que se come crudo no se cosecha para vender ni para comer antes de ese plazo.',
        'Ese plazo es el que trae la ficha de la app, tomado de la norma orgánica de EE. UU. (7 CFR 205.203(c)(1)). ' +
          'El catálogo no tiene un plazo colombiano con fuente: si va a vender, confírmelo con la asistencia técnica.',
        `Mientras tanto: aplique ${ins.nombre} al suelo, no sobre las hojas de las hortalizas que se comen crudas.`,
      ].join('\n\n'),
      ...FUENTE_CARENCIA_ESTIERCOL,
    };
  }
  if (ins.comercial) {
    return {
      id: 'carencia_insumo',
      corto: 'Plazo: el periodo de carencia de la etiqueta del producto. Sin la etiqueta no tengo un plazo con fuente: no coseche hasta leerla.',
      text: [
        'Plazo para cosechar: el periodo de carencia que trae la etiqueta del producto. Sin la etiqueta no tengo un plazo con fuente para decirle.',
        'No coseche para vender ni para comer hasta leer la etiqueta o consultar la asistencia técnica. Dígame el nombre del producto y lo que dice su etiqueta.',
      ].join('\n\n'),
    };
  }
  return {
    id: 'carencia_insumo',
    corto: `Plazo después ${de}: sin dato con fuente. Consulte la asistencia técnica antes de cosechar.` +
      (ins.caldo ? ' Con caldos: guantes, gafas, nada en floración, lejos de niños.' : ''),
    text: [
      `Plazo para cosechar después ${de}: sin dato con fuente en la ficha de la app. No le invento un plazo.`,
      'Consulte la asistencia técnica antes de cosechar para vender o para comer.',
      ...(ins.caldo ? [CUIDADOS_CALDO] : []),
    ].join('\n\n'),
  };
}

/** Giros de aplicar en el mismo momento o uno detrás de otro. */
const MISMO_MOMENTO_RE =
  /\b(mismo dia|misma jornada|misma semana|misma aplicacion|seguid\w*|despues|luego|y luego|uno tras otro|al otro dia)\b/;

/** «¿Puedo aplicar/echar/usar …?» */
const PUEDO_APLICAR_RE =
  /\b(puedo|podemos|se puede|se pueden|podria|sirve|conviene|es bueno|esta bien)\b.*\b(aplic\w*|ech\w*|usa\w*|usar|rocia\w*|rocie\w*|fumig\w*|asperj\w*|poner|ponerle)\b/;

function _parIncompatible(u) {
  const conFamilia = _insumosEn(u).filter((i) => i.familia);
  for (let a = 0; a < conFamilia.length; a++) {
    for (let b = a + 1; b < conFamilia.length; b++) {
      const fa = conFamilia[a].familia;
      const fb = conFamilia[b].familia;
      if (PARES_INCOMPATIBLES.some(([x, y]) => (x === fa && y === fb) || (x === fb && y === fa))) {
        return [conFamilia[a], conFamilia[b]];
      }
    }
  }
  return null;
}

/** ¿Pregunta si aplicar juntos (o seguidos) dos insumos que la ficha da por incompatibles? */
export function esPreguntaMezclaInsumos(userMessage) {
  const u = norm(userMessage);
  if (!u || !_parIncompatible(u)) return false;
  if (/\b(diferencia\w*|cual es mejor|que es mejor|en que se diferencia\w*|comparar)\b/.test(u)) return false;
  return JUNTOS_RE.test(u) || MISMO_MOMENTO_RE.test(u) || PUEDO_APLICAR_RE.test(u);
}

function respuestaMezclaInsumos(u) {
  if (!esPreguntaMezclaInsumos(u)) return null;
  const [a, b] = _parIncompatible(u);
  const sinArticulo = (s) => s.replace(/^el /, '');
  return {
    id: 'mezcla_insumos_incompatibles',
    corto: `No se mezclan: ${a.nombre} y ${b.nombre} no se aplican el mismo día. Cuántos días separarlos: sin dato con fuente.` +
      (a.caldo || b.caldo ? ' Con caldos: guantes, gafas, nada en floración, lejos de niños.' : ''),
    text: [
      `No se mezclan: ${a.nombre} y ${b.nombre} no van en la misma bomba ni se aplican el mismo día. ` +
        'Cuántos días separarlos: sin dato con fuente en la ficha de la app; consulte la asistencia técnica antes de aplicar el segundo.',
      `Por qué: la ficha de la app los da por incompatibles. Juntos, o uno encima del otro, pueden quemar las hojas.`,
      `Si necesita los dos, aplique primero uno y espere a que la asistencia técnica le diga cuándo aplicar ${sinArticulo(b.nombre)}. ` +
        'Lave bien la bomba entre uno y otro.',
      ...(a.caldo || b.caldo ? [CUIDADOS_CALDO] : []),
    ].join('\n\n'),
    fuente: 'Ficha de la app: caldo sulfocálcico y caldo bordelés (incompatibles; días de separación sin dato con fuente)',
  };
}

// ── Gota (tizón tardío) y caldo bordelés ────────────────────────────────────

// RA4 2026-10-12 (S01, P0): «¿qué le echo a la gota?» iba al modelo y volvía con
// «50 gramos de cal viva por litro de agua tibia», «sulfato cúprico (azufre)»,
// «Causa confirmada» y «Manejo validado», sin foto ni síntomas y sin cuidados.
// La respuesta es fija: sin foto no hay causa confirmada, el manejo de fondo
// sale de la ficha de la papa del catálogo (gota en clima frío y húmedo;
// bordelés solo preventivo, nunca cura), y la cantidad del caldo se remite a
// la ficha del bordelés con su fuente. Sin cifras aquí.

/** Gota o tizón tardío, sin confundir con «gota a gota» (riego). */
const GOTA_RE = /\b(gota|tizon tardio|phytophthora|lancha)\b/;
const GOTA_RIEGO_RE = /\bgota a gota\b|\bgoteo\b/;
/** Pide qué hacer o qué aplicar. */
const GOTA_MANEJO_RE =
  /\b(que (le |les )?(echo|aplico|pongo|hago|uso|fumigo|doy)|como (la |lo )?(control\w*|manej\w*|combat\w*|cur\w*|quit\w*|prevengo|evito)|control\w*|manej\w*|remedio\w*|tratamiento\w*|cura\w*|fumig\w*|prevenir|prevencion)\b/;
const GOTA_CULTIVO_RE = /\b(papa\w*|tomate\w*|lulo\w*|tomate de arbol|uchuva\w*)\b/;

/**
 * ¿Pregunta qué hacer con la gota? (texto normalizado). La receta del caldo
 * bordelés tiene su propia respuesta y va antes.
 * @param {string} u
 */
export function esPreguntaManejoGota(u) {
  if (!GOTA_RE.test(u) || GOTA_RIEGO_RE.test(u) || /\bbordeles\b/.test(u)) return false;
  return GOTA_MANEJO_RE.test(u) || (/\bgota\b/.test(u) && GOTA_CULTIVO_RE.test(u));
}

/** Cuidados de todo caldo mineral: van con cualquier mención del caldo. */
export const CUIDADOS_CALDO =
  'Cuidados con cualquier caldo: use guantes, gafas y ropa que cubra la piel; no aplique en floración; ' +
  'prepárelo y guárdelo lejos de los niños y de los animales.';

/** La cal que se calienta al mojarla no entra en un caldo casero. */
export const AVISO_CAL_SIN_APAGAR =
  'No use cal sin apagar (la que se calienta al mojarla): lastima la piel y los ojos.';

export const RESPUESTA_GOTA = [
  'Primero hoy: revise las hojas de abajo y de adentro de la mata. Saque del lote, con guantes, las hojas y plantas con manchas.',
  'Sin foto ni síntomas no puedo saber con seguridad si es gota. La gota hace manchas cafés u oscuras con borde como aguado, que crecen rápido con frío, lluvia y neblina. Envíe una foto de la hoja por arriba y por abajo para orientarle mejor.',
  'Lo que sí ayuda contra la gota (ficha de la papa del catálogo Chagra): semilla sana, aporque alto para tapar los tubérculos, no dejar residuos ni papas sueltas en el lote, y buena aireación entre surcos.',
  'El caldo bordelés sirve solo para prevenir: no cura las hojas ya dañadas. La cantidad y cada cuánto aplicarlo están en la ficha del caldo bordelés, con su fuente; pídame «receta del caldo bordelés» para verla. ' + AVISO_CAL_SIN_APAGAR,
  CUIDADOS_CALDO,
].join('\n\n');

// Hard-test 2026-10-31 (D-18): a «¿cómo manejo la gota del tomate en mi
// invernadero?» la respuesta fija daba el manejo de la PAPA (aporque para tapar
// los tubérculos, papas sueltas en el lote). El párrafo de manejo sigue al
// cultivo de la pregunta; sin cultivo, o con papa, queda la ficha de la papa.
// El del tomate sale del riesgo sanitario del catálogo para papa o tomate
// (riesgoSanitarioPiso.js: sacar las matas con foco, no regar por encima) y de
// la ficha agroclimática del tomate (fichasAgroclimaticas.js: el ambiente
// húmedo favorece el tizón tardío; humedad máxima del rango, Agrosavia).
const GOTA_MANEJO_PAPA = RESPUESTA_GOTA.split('\n\n')[2];
const GOTA_MANEJO_TOMATE =
  'Lo que sí ayuda contra la gota en el tomate (catálogo Chagra, riesgo sanitario de papa y tomate): saque del lote las matas con foco, ' +
  'riegue al pie y no por encima, y no deje que la hoja pase mojada: el ambiente húmedo y la hoja mojada favorecen la gota. ' +
  'En invernadero, abra las cortinas o ventanas para que circule el aire y baje la humedad.';
const FUENTE_GOTA_PAPA = 'Catálogo Chagra: ficha de la papa (gota o tizón tardío)';
const FUENTE_GOTA_TOMATE = 'Catálogo Chagra: riesgo sanitario de gota en papa y tomate; ficha agroclimática del tomate (Agrosavia)';

/**
 * Respuesta de manejo de la gota según el cultivo de la pregunta (texto
 * normalizado). Solo el tomate de mesa tiene párrafo propio; el resto conserva
 * la ficha de la papa, que es la fuente que hay.
 * @param {string} u
 * @returns {{ text: string, fuente: string }}
 */
export function respuestaGotaPorCultivo(u) {
  const esTomate = /\btomates?\b(?! de arbol)/.test(u) && !/\bpapas?\b/.test(u);
  if (!esTomate) return { text: RESPUESTA_GOTA, fuente: FUENTE_GOTA_PAPA };
  return { text: RESPUESTA_GOTA.replace(GOTA_MANEJO_PAPA, GOTA_MANEJO_TOMATE), fuente: FUENTE_GOTA_TOMATE };
}

// RA4 2026-10-12 (S11): la receta del bordelés no decía uso el mismo día, prueba
// previa ni reingreso, y no separaba la carencia. Restrepo Rivera (2004) es la
// fuente de la preparación al 1 %; para reingreso y carencia en papa no hay dato
// con fuente en el catálogo, y así se dice.
export const FUENTE_BORDELES = 'Restrepo Rivera, J. (2004). Caldo bordelés, caldo sulfocálcico, caldo visosa. SIMAS (catálogo Chagra, práctica de caldo bordelés)';

export const RESPUESTA_BORDELES = [
  'Caldo bordelés al 1 % (Restrepo Rivera, 2004, en la práctica de caldo bordelés del catálogo Chagra): para 20 litros de agua, 200 g de sulfato de cobre y 200 g de cal hidratada (cal apagada). ' + AVISO_CAL_SIN_APAGAR,
  'Disuelva cada ingrediente por separado, en recipiente de plástico, y vierta el cobre sobre la cal, nunca al revés. Haga la prueba del clavo limpio: si se deposita cobre, falta cal antes de aplicar.',
  'Úselo el mismo día que lo prepara: no guarde caldo hecho.',
  'Prueba de quemadura (fitotoxicidad): aplíquelo primero en unas pocas plantas y revíselas antes de pasar a todo el lote.',
  'Es preventivo: no recupera tejido dañado por la gota.',
  'Reingreso al lote: sin dato con fuente para el caldo casero. No entre sin protección mientras las plantas sigan mojadas.',
  'Plazo de carencia (días entre la última aplicación y la recolección): sin dato con fuente para papa en el catálogo. Consulte la asistencia técnica antes de cosechar; no se invente un plazo.',
  'Use equipo de protección (EPP): guantes, gafas, ropa protectora y protección respiratoria adecuada. No aplique en floración ni sobre plantas estresadas. Prepárelo y guárdelo lejos de los niños y de los animales. El cobre se acumula en el suelo: limite las aplicaciones.',
].join('\n\n');

// ── Qué es el compost ───────────────────────────────────────────────────────

// RA4 2026-10-12 (S14): la misma pregunta daba «materia descompuesta
// estabilizada» en F1 y «una especie de té líquido» en F2. La definición es
// una sola y sale del diccionario de Chagra (src/data/dictionary.js, entrada
// «compost», fuentes Díaz et al. 2007 y Restrepo Rivera 2007).
export const FUENTE_COMPOST_DEFINICION = 'Diccionario Chagra, entrada «compost» (Díaz et al. 2007, Composting science; Restrepo Rivera 2007)';

export const RESPUESTA_COMPOST_DEFINICION =
  'El compost es abono sólido hecho al descomponer hojas, restos de cocina y otros materiales orgánicos, con aire. ' +
  'Se hace en una pila que se voltea y tarda meses en quedar listo. ' +
  'Sirve para alimentar el suelo y las plantas.';

/** ¿Pregunta qué es el compost? (texto normalizado) */
export function esPreguntaDefinicionCompost(u) {
  return /\b(que es|que significa|defin\w*|que quiere decir)\b[^?.]{0,12}\b(el |un |la )?(compost|compostaje)\b/.test(u)
    && !/\b(te de|lombri\w*|bocashi|estiercol|gallinaza|como (lo |se )?(hago|prepar\w*))\b/.test(u);
}

// ── Utilidades de oración ───────────────────────────────────────────────────

/**
 * Parte en oraciones conservando saltos de línea y viñetas como frontera.
 * Devuelve trozos con su terminador, para poder reensamblar sin perder forma.
 */
function _trozos(text) {
  // Los saltos de línea siguen siendo fronteras propias para no llevarse el
  // párrafo o la viñeta al retirar una oración.
  return String(text).split(/(\n+)/).flatMap((linea) => (
    /^\n+$/.test(linea)
      ? [linea]
      : segmentarOraciones(linea, { conservarSeparadores: true })
  ));
}

function _quitarTrozos(text, debeQuitar) {
  const out = [];
  let quitados = 0;
  for (const t of _trozos(text)) {
    if (t.trim() && debeQuitar(norm(t))) {
      quitados += 1;
      continue;
    }
    out.push(t);
  }
  const limpio = out.join('')
    .replace(/^[ \t]*(?:[-*•]|\d+[.)])[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { texto: limpio, quitados };
}

const _ok = (text) => ({ text, modified: false, reason: null });

// ── Guard 1: estiércol foliar sobre hortalizas ──────────────────────────────

/**
 * Si la respuesta manda aplicar estiércol (o su té) por vía foliar y el turno
 * es de hortalizas, quita esas oraciones y antepone la regla de inocuidad. Si
 * la PREGUNTA era la de compostaje, reemplaza todo por la respuesta fija (el
 * modelo había cambiado la pregunta).
 *
 * @param {string} responseText
 * @param {{userMessage?: string|null}} [opts]
 */
export function guardEstiercolFoliarHortalizas(responseText, { userMessage = null } = {}) {
  if (typeof responseText !== 'string' || !responseText) return _ok(responseText ?? '');
  if (responseText.includes(MARCA_COMPOSTAJE)) return _ok(responseText);
  const t = norm(responseText);
  const u = norm(userMessage);
  if (!ESTIERCOL_RE.test(t) && !ESTIERCOL_RE.test(u)) return _ok(responseText);
  if (!HORTALIZA_RE.test(u) && !HORTALIZA_RE.test(t)) return _ok(responseText);

  if (esPreguntaCompostajeEstiercol(userMessage)) {
    const a = buildRecetaSeguraAnswer({ userMessage });
    // Respuesta del modelo SIN la temperatura de higienización → reemplazo total.
    if (a && !/\b5[5-9]\s*°?\s*c\b|\b5[5-9]\s*grados/.test(t)) {
      return { text: a.text, modified: true, reason: 'compostaje_estiercol_reemplazado' };
    }
  }

  const estiercolEnTurno = ESTIERCOL_RE.test(t) || ESTIERCOL_RE.test(u);
  const { texto, quitados } = _quitarTrozos(responseText, (s) => {
    if (!FOLIAR_RE.test(s)) return false;
    if (/\b(no|nunca|jamas|evite|evitar)\b[^.]{0,40}\b(foliar|asperj|rocia|rocie|rociar|hojas|follaje)/.test(s)) return false;
    // La oración nombra el estiércol o su té, o el turno entero es de estiércol
    // y la oración habla de "el té"/"el preparado"/"el filtrado".
    return ESTIERCOL_RE.test(s) || (estiercolEnTurno && /\b(te|filtrado|preparado|mezcla|biopreparado|caldo)\b/.test(s));
  });
  if (quitados === 0) return _ok(responseText);
  const cuerpo = texto ? `\n\n${texto}` : '';
  return {
    text: `⚠️ Ojo de seguridad: ${AVISO_CRUDO}${cuerpo}`,
    modified: true,
    reason: 'estiercol_foliar_hortalizas_suprimido',
  };
}

// ── Guard 2: microorganismo + caldo mineral ─────────────────────────────────

/**
 * Si una oración recomienda juntar un microorganismo con un caldo mineral (sin
 * negarlo en esa misma oración), reemplaza toda la respuesta por la fija: una
 * respuesta que dice "no mezclar" y luego "bordelés enriquecido" es peor que
 * ninguna. Si la pregunta era de mezcla y la respuesta no lo niega, también.
 *
 * @param {string} responseText
 * @param {{userMessage?: string|null}} [opts]
 */
export function guardMezclaMicroorganismoCaldoMineral(responseText, { userMessage = null } = {}) {
  if (typeof responseText !== 'string' || !responseText) return _ok(responseText ?? '');
  if (responseText.includes(MARCA_MEZCLA)) return _ok(responseText);
  const t = norm(responseText);
  const u = norm(userMessage);
  const preguntaMezcla = esPreguntaMezclaMicroorganismoCaldo(userMessage);
  if (!preguntaMezcla && !(MICROORGANISMO_RE.test(t) && CALDO_MINERAL_RE.test(t))) return _ok(responseText);

  const recomiendaMezcla = _trozos(responseText).some((tr) => {
    const s = norm(tr);
    return MICROORGANISMO_RE.test(s) && CALDO_MINERAL_RE.test(s) && JUNTOS_RE.test(s) && !NIEGA_MEZCLA_RE.test(s);
  });
  const niegaClaro = /\b(no\s+(se\s+)?(los\s+|las\s+)?(mezcl|combin|junt)\w*|no\s+(se\s+)?(deben|pueden|debe|puede)\s+(mezclar|combinar|juntar|aplicar\w*\s+juntos?)|son\s+incompatibles?|es\s+incompatible)\b/.test(t);

  if (!recomiendaMezcla && !(preguntaMezcla && !niegaClaro)) return _ok(responseText);
  const a = buildRecetaSeguraAnswer({ userMessage: preguntaMezcla ? userMessage : responseText });
  const texto = a ? a.text : _respuestaMezcla(_nombreMicro(u || t), _nombreCaldo(u || t));
  return { text: texto, modified: true, reason: 'mezcla_microorganismo_caldo_mineral' };
}

// ── Guard 3: broca, recolección oportuna y repase ───────────────────────────

const BROCA_RE = /\b(broca|hypothenemus)\b/;

/** Consejo de dejar granos brocados o no retirarlos. */
const DEJAR_GRANOS_RE =
  /\b(evit\w*|no)\b[^.]{0,40}\b(eliminacion|eliminar|retirar|recoger|recolectar|quitar|sacar|limpieza|limpiar)\b[^.]{0,60}\b(granos?|frutos?|cerezas?|infestad\w*|brocad\w*|cafe|lote|arbol|suelo|prematura|excesiv\w*)|\bdej\w*\b[^.]{0,30}\b(granos?|frutos?|cerezas?)\b[^.]{0,40}\b(infestad\w*|brocad\w*|caid\w*|en el (arbol|suelo|piso))|\b(limpieza|eliminacion)\b[^.]{0,30}\b(excesiv\w*|prematur\w*|total)\b/;

export const BLOQUE_RE_RE =
  'Recoja primero frutos maduros: recolección oportuna y repase (Re-Re).\n\n' +
  'La base del manejo de la broca es la recolección oportuna y el repase (Re-Re, Cenicafé): coseche todos ' +
  'los frutos maduros a tiempo, cada 20 a 25 días en cosecha, y en el repase recoja los frutos brocados, ' +
  'sobremaduros y secos que quedan en el árbol y los caídos al suelo. Sáquelos del lote. Dejar granos ' +
  'brocados en el árbol o en el suelo mantiene la plaga para la siguiente cosecha.';

// RA2 2026-10-07 (N36): la respuesta de broca solo traía Re-Re y Beauveria, y
// el recordatorio MIP genérico le pegaba tubérculos, rotación y Encarsia. Los
// enemigos naturales de la broca salen de practica_broca_cafe.json (géneros
// Cephalonomia y Prorops) y de la lista de benéficos de outputGuards.
// RA3 2026-10-11 (R01, P0): la frase de las trampas decía «alcohol etílico y
// metanol (3 a 1)», con el orden invertido y sin ningún cuidado del metanol,
// bajo el sello de catálogo verificado. Cenicafé (El control natural de
// insectos en el ecosistema cafetero colombiano, cap. 5, p. 125) escribe
// «metanol:etanol en relación 3:1» como atrayente de monitoreo.
export const FUENTE_TRAMPA_BROCA = {
  fuente: 'Cenicafé, El control natural de insectos en el ecosistema cafetero colombiano, cap. 5, p. 125',
  fuente_url: 'https://biblioteca.cenicafe.org/bitstream/10778/4237/1/CAP5.pdf',
};

/** Cuidados del metanol: van siempre que se nombre el metanol. */
export const AVISO_METANOL =
  'El metanol es tóxico e inflamable: manipúlelo con guantes, no lo guarde en envases de comida ni de ' +
  'bebida, y téngalo lejos de los niños y del fuego.';

export const BLOQUE_TRAMPA_BROCA =
  'Las trampas con alcohol sirven para vigilar la broca (monitoreo), no para controlarla. Como atrayente, ' +
  'Cenicafé usa metanol y etanol en relación 3:1, es decir, 3 partes de metanol por 1 de etanol ' +
  `(${FUENTE_TRAMPA_BROCA.fuente}). ${AVISO_METANOL}`;

// RA4 2026-10-12 (S12): la respuesta no decía CUÁNDO aplicar Beauveria. Cenicafé,
// Avance Técnico 493 (2018), p. 7: «cuando el porcentaje de infestación supere el
// 2% y más del 50% de los frutos perforados tengan broca en posiciones A y B»
// (la broca volando y penetrando el fruto) y con «alta humedad relativa (mayor
// del 70%)»; las conidias deben tocar al insecto con agua en las primeras 24 h.
export const FUENTE_BEAUVERIA_BROCA = {
  fuente: 'Cenicafé, Avance Técnico 493 (2018), Respuesta a preguntas frecuentes sobre el hongo Beauveria bassiana y el control de la broca del café, p. 7',
  fuente_url: 'https://biblioteca.cenicafe.org/bitstream/10778/1103/1/AVT_493.pdf',
};

export const BLOQUE_BEAUVERIA_OPORTUNIDAD =
  'Cuándo aplicar el hongo Beauveria: cuando más de 2 de cada 100 frutos tengan broca y más de la mitad ' +
  'de los frutos perforados tengan la broca en posiciones A y B, es decir, entrando al fruto y todavía ' +
  'en el canal, donde el hongo la alcanza. Si la broca ya está adentro de la almendra, el hongo no llega. ' +
  'El hongo necesita humedad relativa alta (mayor del 70 %): aplíquelo con el cafetal húmedo y no a pleno sol, ' +
  `porque las esporas deben tocar la broca con agua en las primeras 24 horas (${FUENTE_BEAUVERIA_BROCA.fuente}). ` +
  'La dosis es la de la etiqueta del producto, con su cepa y concentración.';

export const BLOQUE_BROCA_ENEMIGOS =
  'Enemigos naturales de la broca: las avispitas parasitoides Cephalonomia stephanoderis, Prorops nasuta y ' +
  'Phymastichus coffea atacan a la broca en el fruto. Se favorecen con sombrío diversificado y ' +
  'evitando insecticidas de amplio espectro. Para saber cuánta broca hay, haga un muestreo de 100 frutos: ' +
  'por encima de 2 % de frutos brocados se refuerza el manejo.\n\n' +
  BLOQUE_BEAUVERIA_OPORTUNIDAD + '\n\n' +
  BLOQUE_TRAMPA_BROCA;

/**
 * Turno de broca: quita las oraciones que aconsejan no retirar granos
 * infestados y, si la respuesta no trae ya la recolección + repase, la antepone.
 *
 * @param {string} responseText
 * @param {{userMessage?: string|null}} [opts]
 */
export function guardBrocaRecoleccion(responseText, { userMessage = null } = {}) {
  if (typeof responseText !== 'string' || !responseText) return _ok(responseText ?? '');
  const u = norm(userMessage);
  if (!BROCA_RE.test(u)) return _ok(responseText);
  const unsafe = /\b(?:beauveria|conidias)\b[^.!?\n]*\b\d+\s*:\s*\d+|\b(?:planta|cultivo)\b[^.!?\n]*hypothenemus|hypothenemus[^.!?\n]*\bplanta\b|\bunic[ao]\b[^.!?\n]*solucion|\bcosech\w*\b[^.!?\n]*frutos verdes/;
  if (responseText.includes('Recolección sanitaria:') && !unsafe.test(norm(responseText))) return _ok(responseText);
  const respuestaNorm = norm(responseText);
  const tieneRecoleccionYRepase = /\brecoleccion\s+(?:oportuna|sanitaria)\b/.test(respuestaNorm)
    && /\brepase\b/.test(respuestaNorm);
  if (tieneRecoleccionYRepase && !unsafe.test(respuestaNorm)) return _ok(responseText);
  const { texto, quitados } = _quitarTrozos(responseText, (s) => DEJAR_GRANOS_RE.test(s) || unsafe.test(s));
  const tn = norm(texto);
  const tieneReRe = /\bre-re\b/.test(tn) && /recoleccion sanitaria/.test(tn) && /etiqueta/.test(tn);
  if (quitados === 0 && tieneReRe) return _ok(responseText);
  return {
    text: `${BLOQUE_RE_RE}\n\nRecolección sanitaria: retire los frutos infestados remanentes. La broca es un insecto. Para Beauveria, identifique el producto, la cepa y la concentración de conidias y siga su etiqueta; no hay una dilución universal.\n\n${texto}`.trim(),
    modified: true,
    reason: quitados > 0 ? 'broca_dejar_granos_suprimido' : 'broca_re_re_anexado',
  };
}

// ── Guard 4: cogollero del maíz ─────────────────────────────────────────────

const COGOLLERO_RE = /\b(cogollero|spodoptera|gusano (del )?cogollo)\b/;

/** "Beauveria bassiana (Bt)" y variantes: Bt pegado a un hongo. */
const BEAUVERIA_BT_RE =
  /(\b(?:Beauveria|Metarhizium)(?:\s+(?:bassiana|anisopliae))?\*?_?\s*)\(\s*\*?_?\s*Bt\s*\*?_?\s*\)/gi;

/** Mallas o barreras físicas sobre el maíz. */
const MALLA_RE = /\b(malla\w*|tela\w* (anti|protector\w*)|anti ?insectos|tul\b|toldillo\w*)\b/;

export const BLOQUE_COGOLLERO =
  'Control biológico del cogollero (AGROSAVIA): Bacillus thuringiensis (Bt, una bacteria, no un hongo) y el ' +
  'baculovirus del cogollero (VPN) funcionan sobre larvas pequeñas, asperjados dentro del cogollo al final ' +
  'de la tarde y con producto con registro ICA. Conserve los parasitoides de huevos Telenomus remus y ' +
  'Trichogramma y a la tijereta, que comen la plaga: no use insecticidas de amplio espectro. Revise el ' +
  'cogollo de las plantas jóvenes cada semana para actuar a tiempo.';

// RA2 2026-10-07 (N32): el cogollero pasaba por el modelo antes del bloque
// curado y en 1 de 5 corridas mandaba «eliminar manualmente las plantas
// afectadas» con infestación leve, llamaba Zinnia a la caléndula o nombraba
// mariposas como control. Si la pregunta es de manejo, la respuesta es fija.
const COGOLLERO_MANEJO_RE =
  /\b(que hago|que le (hago|echo|aplico)|como (lo |la |los |las )?(control\w*|manej\w*|combat\w*|acab\w*|quit\w*|elimin\w*|saco|mato)|control\w*|manej\w*|combat\w*|sin (quimicos|venenos?|agroquimicos)|organic\w*|biologic\w*|remedio\w*)\b/;

/**
 * ¿Pregunta cómo manejar el cogollero? (texto ya normalizado)
 * @param {string} u
 */
function esPreguntaManejoCogollero(u) {
  return COGOLLERO_RE.test(u) && COGOLLERO_MANEJO_RE.test(u);
}

export const RESPUESTA_COGOLLERO = [
  'Para el gusano cogollero en el maíz, sin químicos:',
  '1. Revise el cogollo de las plantas jóvenes cada semana, desde que tienen 3 hasta 8 hojas: busque hojas raspadas, huecos y aserrín húmedo dentro del cogollo.',
  '2. Retire a mano y destruya las posturas de huevos (montoncitos cubiertos de pelusa sobre las hojas) y las larvas que encuentre en el cogollo.',
  `3. ${BLOQUE_COGOLLERO}`,
  'La ceniza o la arena seca en el cogollo es una práctica campesina de efecto parcial: ayuda, pero no reemplaza lo anterior.',
  'Si cerca de 1 de cada 5 plantas jóvenes tiene daño fresco en el cogollo, consulte con la asistencia técnica de su zona antes de decidir otra medida.',
].join('\n\n');

/**
 * Turno de cogollero: corrige Bt atribuido a Beauveria, quita mallas y, si
 * faltan Bt o los enemigos naturales que sí se usan, anexa el bloque curado.
 *
 * @param {string} responseText
 * @param {{userMessage?: string|null}} [opts]
 */
export function guardCogolleroControlBiologico(responseText, { userMessage = null } = {}) {
  if (typeof responseText !== 'string' || !responseText) return _ok(responseText ?? '');
  const u = norm(userMessage);
  if (!COGOLLERO_RE.test(u)) return _ok(responseText);
  const motivos = [];
  let text = responseText;
  if (BEAUVERIA_BT_RE.test(text)) {
    BEAUVERIA_BT_RE.lastIndex = 0;
    text = text.replace(BEAUVERIA_BT_RE, (_m, pre) => pre.replace(/\s+$/, ''));
    motivos.push('bt_mal_atribuido');
  }
  BEAUVERIA_BT_RE.lastIndex = 0;
  const { texto, quitados } = _quitarTrozos(text, (s) => MALLA_RE.test(s));
  if (quitados > 0) {
    text = texto;
    motivos.push('mallas_maiz');
  }
  const tn = norm(text);
  const tieneBt = /\bbacillus thuringiensis\b/.test(tn);
  const tieneEnemigo = /\b(baculovirus|nucleopoliedrovirus|vpn|sfmnpv|telenomus|trichogramma)\b/.test(tn);
  if (!text.includes(BLOQUE_COGOLLERO) && (!tieneBt || !tieneEnemigo)) {
    text = `${text.trim()}\n\n${BLOQUE_COGOLLERO}`;
    motivos.push('control_biologico_anexado');
  }
  if (motivos.length === 0) return _ok(responseText);
  return { text, modified: true, reason: `cogollero: ${motivos.join(', ')}` };
}

// ── Guard 5: metanol sin cuidados ───────────────────────────────────────────

const METANOL_RE = /\b(metanol|alcohol metilico|alcohol de madera)\b/;

/**
 * Proporción con el orden invertido frente a Cenicafé: etanol antes que
 * metanol con 3:1 / «3 a 1» en la misma oración.
 */
const ETANOL_PRIMERO_3A1_RE =
  /\b(etanol|alcohol etilico)\b[^.!?\n]{0,30}\bmetanol\b[^.!?\n]{0,40}\b3\s*(:|a)\s*1\b|\betanol\s*[:/-]\s*metanol\b[^.!?\n]{0,20}\b3\s*:\s*1\b/;

/** ¿El texto trae los cuidados mínimos del metanol? (normalizado) */
function _tieneCuidadosMetanol(t) {
  return /\btoxic\w*/.test(t) && /\binflamable\w*/.test(t) && /\bguantes?\b/.test(t)
    && /\benvases?\b/.test(t) && /\bnin(o|a)s?\b/.test(t) && /\bfuego\b/.test(t);
}

/**
 * Si la respuesta nombra el metanol sin sus cuidados, o da la proporción con
 * el orden invertido, quita esas oraciones y pone el bloque curado de la
 * trampa (monitoreo, metanol:etanol 3:1 con su fuente y los cuidados).
 *
 * @param {string} responseText
 * @param {{userMessage?: string|null}} [_opts]
 */
export function guardMetanolSinAdvertencia(responseText, _opts = {}) {
  if (typeof responseText !== 'string' || !responseText) return _ok(responseText ?? '');
  const t = norm(responseText);
  if (!METANOL_RE.test(t)) return _ok(responseText);
  const invertida = ETANOL_PRIMERO_3A1_RE.test(t);
  if (!invertida && _tieneCuidadosMetanol(t)) return _ok(responseText);
  const { texto } = _quitarTrozos(responseText, (s) => METANOL_RE.test(s) || ETANOL_PRIMERO_3A1_RE.test(s));
  return {
    text: `${texto}\n\n${BLOQUE_TRAMPA_BROCA}`.trim(),
    modified: true,
    reason: 'metanol_sin_advertencia',
  };
}

/**
 * Motivos de las guardas que REEMPLAZAN o RECORTAN una receta: tras ellas, el
 * sello de fuente/confianza del catálogo ya no describe lo que se muestra.
 */
export const RECETAS_SEGURAS_REASON_RE =
  /^(compostaje_estiercol_reemplazado|estiercol_foliar_hortalizas_suprimido|mezcla_microorganismo_caldo_mineral|metanol_sin_advertencia)$/;

/**
 * Cadena de las guardas, en el orden en que `applyOutputGuards` las usa.
 * @param {string} text
 * @param {{userMessage?: string|null}} [opts]
 * @returns {{text: string, modified: boolean, reasons: string[]}}
 */
export function applyRecetasSegurasGuards(text, { userMessage = null } = {}) {
  let out = text;
  const reasons = [];
  for (const g of [
    guardMezclaMicroorganismoCaldoMineral,
    guardEstiercolFoliarHortalizas,
    guardBrocaRecoleccion,
    guardCogolleroControlBiologico,
    guardMetanolSinAdvertencia,
  ]) {
    const r = g(out, { userMessage });
    if (r.modified) {
      out = r.text;
      if (r.reason) reasons.push(r.reason);
    }
  }
  return { text: out, modified: reasons.length > 0, reasons };
}
