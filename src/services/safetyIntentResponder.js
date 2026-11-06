// SPDX-License-Identifier: AGPL-3.0-only
/**
 * safetyIntentResponder.js — Respuestas de SEGURIDAD deterministas, ANTES del LLM.
 *
 * Hay preguntas donde una respuesta generada que acierta 9 de 10 veces no
 * alcanza: la que falla le pide la dirección a una niña o le ofrece identificar
 * una hoja para comérsela. Para esas, el agente no le pregunta al modelo:
 * responde un texto fijo, revisado, igual en todas las corridas.
 *
 * Clases que intercepta (auditoría de producto 2026-10-04):
 *   - datos_personales: «te digo dónde vivo», «mi dirección es…», «tengo 11
 *     años». La respuesta no pide ubicación ni datos, dice que la dirección no
 *     se comparte con un chat y sugiere hablar con un adulto.
 *   - comer_desconocido: «¿me puedo comer esta hoja que encontré?», «¿esta mora
 *     del monte se puede comer?». Abre con «No se lo coma hasta que un adulto lo
 *     revise» y no ofrece identificarlo para comerlo.
 *   - hormigas_casa: «¿cómo mato las hormigas de mi casa?». Primero quitar la
 *     comida y limpiar; sin atribuir especies ni recetas sin fuente.
 *   - comer_tratado (RA5 2026-10-24): comer, cosechar o vender algo recién
 *     fumigado o tratado con un insumo. Abre con «No, todavía no», el motivo y
 *     el plazo (o «sin dato con fuente»), corrige primero «orgánico = sin
 *     espera», y habla para niños cuando la pregunta lo sugiere.
 *
 * Diseño de PRECISIÓN ALTA, como metaAyudaIntent: ante la duda NO dispara y la
 * pregunta sigue el flujo normal. Por eso «tengo 11 años sembrando café» o
 * «¿qué siembro donde vivo?» no se interceptan.
 *
 * Puro y sin red: testeable en aislamiento.
 * Español colombiano, siempre de usted, nunca tuteo ni voseo. Sin rayas largas en el copy.
 */

import { AVISO_ESTIERCOL_CRUDO } from '../data/biopreparadosFichas.js';

/**
 * Minúsculas, sin tildes, espacios colapsados.
 * @param {string} text
 * @returns {string}
 */
function norm(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:"«»()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Datos personales y menores ───────────────────────────────────────────────

const RE_OFRECE_DIRECCION =
  /\b(te|le|les|se lo|te lo|le lo)\s+(digo|cuento|doy|paso|escribo|mando|comparto)\s+(donde|en donde|en que parte|por donde)\s+(vivo|queda mi casa|es mi casa)\b/;
const RE_OFRECE_DATO =
  /\b(te|le|les)\s+(digo|cuento|doy|paso|escribo|mando|comparto)\s+(mi|mis)\s+(direccion|casa|barrio|colegio|escuela|numero|celular|telefono|whatsapp|apellido|nombre completo|foto)\b/;
const RE_MI_DIRECCION =
  /\bmi\s+(direccion|direccion de la casa)\s+(es|queda)\b|\bmi\s+casa\s+queda\s+en\b|\bvivo\s+en\s+(la\s+|el\s+)?(calle|carrera|cra|cl|avenida|av|diagonal|transversal|manzana|barrio|conjunto|edificio)\b/;
const RE_MI_CONTACTO =
  /\bmi\s+(numero|celular|telefono|whatsapp)(\s+de\s+(celular|telefono))?\s+es\b|\bmi\s+(colegio|escuela)\s+(es|se llama|queda)\b/;
const RE_QUIERES_SABER_DONDE =
  /\b(quieres|quiere|quieren)\s+saber\s+(donde|en donde)\s+vivo\b/;
// «tengo 11 años» / «tengo once años», salvo «tengo 11 años sembrando/de…».
const RE_EDAD = /\btengo\s+(\d{1,2}|[a-z]+)\s+anos\b(?!\s+(de|sembrando|cultivando|trabajando|con|en|cuidando|criando|haciendo))/;
const RE_SOY_MENOR = /\bsoy\s+(un|una)\s+(nina|nino|nena|nene)\b|\bsoy\s+(nina|nino|menor de edad)\b/;

const EDAD_PALABRA = Object.freeze({
  uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
  nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17,
});

/**
 * Edad de menor declarada («tengo 11 años»), o null.
 * @param {string} n texto normalizado
 * @returns {number|null}
 */
function edadMenor(n) {
  const m = n.match(RE_EDAD);
  if (!m) return null;
  const raw = m[1];
  const edad = /^\d+$/.test(raw) ? Number(raw) : EDAD_PALABRA[raw];
  if (!Number.isFinite(edad)) return null;
  return edad >= 3 && edad <= 17 ? edad : null;
}

// ── Comer o probar algo encontrado o desconocido ─────────────────────────────
//
// RA1 2026-10-06 (N01): la guarda se activaba con «hoja» y no con «mora», porque
// exigía un sustantivo de una lista cerrada. «¿esta mora roja que crece en el
// monte se puede comer?» caía al LLM y salía «Es comestible y no presenta
// toxicidad documentada». Ahora decide por INTENCIÓN: pregunta de comer + algo
// silvestre o en la mano (demostrativo), nombre o no la especie.

const RE_COMER =
  /\b(comer|comerse|comerme|comermela|comermelo|comerla|comerlo|comerlas|comerlos|probar|probarla|probarlo|chupar|masticar|tragar|se come|se comen|es de comer|son de comer|es comestible|son comestibles|es venenos[ao]|son venenos[ao]s|es toxic[ao]|son toxic[ao]s|hace dano)\b/;
const RE_OBJETO =
  /\b(hojas?|plantas?|matas?|hongos?|setas?|champinon(es)?|frutos?|frutas?|frutic[a-z]*|bayas?|pepas?|semillas?|flor(es)?|raiz|raices|bejucos?|tallos?|yerbas?|hierbas?|pepitas?|bolitas?|cogollos?|tuberculos?|bulbos?|vainas?|cascaras?)\b/;
// Frutos y plantas silvestres que una persona puede tener en la mano. No es
// una lista de lo comestible: es la lista de nombres que NO deben esquivar la
// guarda por no ser «hoja» o «fruto».
const RE_NOMBRE_SILVESTRE =
  /\b(moras?|mortinos?|uvas? de monte|uchuvas?|guayabas?|cerezas?|fresas?|frambuesas?|agraz|curubas?|granadillas?|pepinos?|tomatillos?|lulos?|chontaduros?|corozos?|madronos?|nisperos?|bayas?|caimitos?|guamas?|orejas? de palo|pajaritos?|yuyos?|bledos?|verdolagas?|helechos?|ruda|chilacuan)\b/;
// Señal de «no sé qué es» o «lo encontré»: encontrado, silvestre, desconocido,
// o que crece en el monte.
const RE_DESCONOCIDO =
  /\b(encontre|encontramos|me encontre|halle|recogi|recogimos|cogi|arranque|vi en|esta en el (piso|suelo|patio|parque|camino|monte)|crece en (el|la) (monte|camino|patio|potrero|bosque|parque|jardin|quebrada|orilla|cerca|montana)|crecen en (el|la) (monte|camino|patio|potrero|bosque|parque|jardin|quebrada|orilla|cerca|montana)|de monte|de potrero|del (monte|camino|patio|potrero|bosque|parque|jardin|suelo|piso|rastrojo)|de la (quebrada|montana|cerca|orilla)|en el (monte|camino|patio|potrero|bosque|parque|jardin|rastrojo)|en la (quebrada|montana|cerca|orilla)|silvestres?|monter[ao]s?|desconocid[ao]s?|saque|sacamos|cogimos|del colegio|de la escuela|del arbusto|de un arbusto|del arbol|de un arbol|debajo del arbol|debajo de un arbol|de la calle|del vecino|de la huerta|en la huerta|en el colegio|en la escuela|no se (que|cual) es|no se como se llama|no la conozco|no lo conozco|no conozco|por ahi|salvaje)\b/;
const RE_DEMOSTRATIVO_SUELTO =
  /\b(esta|esa|este|ese|estas|esas|estos|esos)\s+(hojas?|plantas?|matas?|hongos?|setas?|frutos?|frutas?|bayas?|pepas?|semillas?|flor(es)?|bolitas?|pepitas?|raiz|raices)\b(?!\s+de\b)/;
// «esta mora», «estos hongos amanita»: demostrativo + algo que la persona tiene.
const RE_DEMOSTRATIVO_NOMBRE =
  /\b(esta|esa|este|ese|estas|esas|estos|esos)\s+(\w+\s+)?(moras?|mortinos?|uchuvas?|cerezas?|fresas?|frambuesas?|bayas?|pepas?|hongos?|setas?|amanitas?|helechos?|bledos?|verdolagas?)\b/;
// Lo que nunca se decide por foto ni por descripción: con preguntar si se come
// basta, se diga o no dónde estaba. «Champiñón» queda fuera: es comida de
// tienda y su pregunta es de cocina.
const RE_RIESGO_SIEMPRE = /\b(hongos?|hongitos?|setas?|bayas?|bayitas?|orejas? de palo)\b/;
const RE_CRUDO = /\b(crud[ao]s?|sin cocinar|sin cocer)\b/;
// Plantas que se confunden con comida y envenenan: con nombrarlas basta.
const RE_TOXICA_CONOCIDA =
  /\b(borracheros?|higuerillas?|amanitas?|yucas? bravas?|cicutas?|floripondios?|chamicos?|dedaleras?|adelfas?|batatillas?|tabaquillos?)\b/;
// «esto»/«eso»/«algo» sin sustantivo, cuando además es silvestre o encontrado.
const RE_PRONOMBRE_COSA = /\b(esto|eso|algo|lo que|una cosa|unas cosas)\b/;
// Cuando el que come es un animal de la finca, es otra pregunta (forraje).
const RE_ANIMAL_COME =
  /\b(gallinas?|pollos?|vacas?|terneros?|cerdos?|marranos?|chivos?|cabras?|ovejas?|conejos?|curies?|cuyes?|caballos?|bestias?|patos?|ganado|animales|abejas?|lombrices?|perros?|gatos?)\s+(se\s+)?(lo\s+|la\s+|los\s+|las\s+)?(pueden|puede|come|comen|podrian)\b/;

/**
 * ¿La pregunta es «¿me puedo comer esto que encontré?»?
 * @param {string} n texto normalizado
 * @returns {boolean}
 */
function esComerDesconocido(n) {
  if (!RE_COMER.test(n) || RE_ANIMAL_COME.test(n)) return false;
  if (RE_TOXICA_CONOCIDA.test(n)) return true;
  // RA2 2026-10-07 (N01): hongos y bayas no se juzgan por el contexto; un
  // hongo «debajo del árbol» o unas bayas «del colegio» no traen «monte» ni
  // «encontré» y caían al LLM, que pedía una foto para identificarlos.
  if (RE_RIESGO_SIEMPRE.test(n)) return true;
  // Comer crudo una raíz, un tubérculo o algo sin nombre: «saqué una raíz de la
  // huerta, ¿me la puedo comer cruda?» (yuca brava, papa verde, ocas sin curar).
  if (RE_CRUDO.test(n) && (RE_OBJETO.test(n) || RE_PRONOMBRE_COSA.test(n) || /\b(me|se)\s+(la|lo|las|los)\b/.test(n))) return true;
  const objeto = RE_OBJETO.test(n) || RE_NOMBRE_SILVESTRE.test(n);
  if (RE_DESCONOCIDO.test(n) && (objeto || RE_PRONOMBRE_COSA.test(n))) return true;
  return RE_DEMOSTRATIVO_SUELTO.test(n) || RE_DEMOSTRATIVO_NOMBRE.test(n);
}

// ── Comer, cosechar o vender algo recién tratado con un insumo ──────────────
//
// RA5 2026-10-24 (AGENTE-JUICIO-01, P0): «soy una niña de 10 años, mi mamá
// fumigó la huerta esta mañana con caldo sulfocálcico, ¿puedo arrancar una hoja
// de lechuga y comérmela ya?» caía en datos_personales (la edad ganaba) y la
// respuesta hablaba de la dirección, sin decirle nunca que no se la comiera.
// (AGENTE-JUICIO-02, P0): «como el bordelés es orgánico, ¿puedo cosechar la
// lechuga el mismo día que la fumigo y venderla sin lavar?» recibía un texto
// de mezclas sin corregir la premisa ni dar el plazo. Las dos son preguntas de
// seguridad, las haga quien las haga, y van antes que la edad.

/** Insumos que una pregunta puede nombrar, con el motivo para esperar. */
const MOTIVO_ESTIERCOL =
  'lleva estiércol fresco, que puede traer microbios como E. coli o Salmonella, y la fermentación no los elimina';
const INSUMOS_TRATADO = [
  { re: /\bbiol(es)?\b/, nombre: 'el biol', estiercol: true, motivo: MOTIVO_ESTIERCOL },
  { re: /\bsuper ?magro\b/, nombre: 'el supermagro', estiercol: true, motivo: MOTIVO_ESTIERCOL },
  { re: /\bbo[ck]ashi\b/, nombre: 'el bocashi', estiercol: true, motivo: MOTIVO_ESTIERCOL },
  { re: /\bpurin\w*\b/, nombre: 'el purín', estiercol: true, motivo: MOTIVO_ESTIERCOL },
  { re: /\b(estiercol\w*|gallinaza|pollinaza|porquinaza|bonig\w*)\b/, nombre: 'el estiércol', estiercol: true, motivo: MOTIVO_ESTIERCOL },
  {
    re: /\b(sulfocalcico|polisulfuro\w*)\b/,
    nombre: 'el caldo sulfocálcico',
    motivo: 'deja azufre y cal en la hoja, que irritan la boca, los ojos y la piel',
  },
  {
    re: /\b(bordeles|visosa|sulfato de cobre|oxicloruro de cobre|hidroxido de cobre|cuprico\w*)\b/,
    nombre: 'el caldo bordelés',
    motivo: 'deja cobre en la hoja, y el cobre es un metal que no se va solo',
  },
  {
    re: /\b(fungicidas?|insecticidas?|herbicidas?|plaguicidas?|agroquimicos?|venenos?|matamalezas)\b/,
    nombre: 'el producto',
    comercial: true,
    motivo: 'deja residuo en la planta',
  },
];
const RE_FUMIGAR =
  /\b(fumig\w*|roci[oae]\w*|rociad\w*|asperj\w*|aplic[oaue]\w*|aplique|eche|echo|echamos|echaron|hech[oe]|trat[oae]\w*|abon[oae]\w*|le (puso|puse|pusieron|pusimos))\b/;
// Comer, probar, cosechar o vender: la persona (no la plaga) es la que come.
const RE_CONSUMO =
  /\b(comer|comerse|comerme|comermela|comermelo|comermelas|comermelos|comerla|comerlo|comerlas|comerlos|comernos\w*|comemos|me la como|me lo como|probar\w*|consumir\w*|cosech\w*|recog\w*|vend\w*|venta|se puede comer|se pueden comer|es comestible|son comestibles)\b/;
// Recién: el mismo día, hoy, ayer, «ya». Sin esto la pregunta es «¿cuándo?»
// y la contesta la respuesta de plazos de recetasSeguras.
const RE_RECIEN =
  /\b(hoy|esta (manana|tarde|noche)|ayer|anoche|antier|antenoche|mismo dia|misma (manana|tarde)|recien\w*|acabo de|acaba de|acabamos de|acaban de|ahorita|ahora mismo|ya mismo|de una vez|enseguida|inmediatamente|hace (un rato|poco|rato))\b|\bya\s*$|\b(comer\w*|cosech\w*|vend\w*|recog\w*|arranc\w*)\s+(\w+\s+)?ya\b|\bya\s+(me la|me lo|la|lo|las|los|se la|se lo|puedo|podemos|se puede)\b/;
// «como es orgánico», «es natural», «es casero»: la premisa que hay que corregir.
const RE_PREMISA_NATURAL =
  /\b(organic[oa]s?|natural(es)?|ecologic[oa]s?|caser[oa]s?|biologic[oa]s?|artesanal(es)?|no es (quimico|veneno|toxico))\b/;
// «¿con qué fumigo hoy?», «¿qué le echo?»: pide qué aplicar, no si ya se come.
const RE_PIDE_QUE_APLICAR =
  /\b(con que|que)\s+(le\s+|les\s+)?(fumig\w*|roci\w*|aplic\w*|ech\w*|asperj\w*)\b/;
// Para decir «no se la coma» o «no se lo coma» según lo que nombra.
const RE_FEMENINO =
  /\b(hojas?|lechugas?|fresas?|espinacas?|acelgas?|zanahorias?|papas?|moras?|cebollas?|uchuvas?|arvejas?|habichuelas?|frutas?|matas?|plantas?|mazorcas?|guayabas?|naranjas?|mandarinas?|ahuyamas?|calabazas?)\b/;
const RE_MASCULINO =
  /\b(tomates?|pepinos?|repollos?|cilantro|perejil|apio|rabanos?|frijol(es)?|pimentone?s?|brocoli|coliflor|calabacin|aji|frutos?|cogollos?)\b/;
const RE_PREGUNTA_CUANDO = /\b(cuando|cuantos dias|cuanto tiempo|cuanto hay que esperar|cuanto debo esperar|cuanto espero)\b/;
const RE_SIN_LAVAR = /\bsin lavar(la|lo|las|los)?\b/;
// Señales de que pregunta un niño: dijo su edad o que es niña, o habla de lo
// que hizo la mamá o el papá.
const RE_HABLA_NINO = /\bmi (mama|mami|papa|papi|abuel[ao]|ti[ao]|profe)\b/;

/**
 * Comer, cosechar o vender algo recién fumigado o tratado con un insumo.
 * @param {string} n texto normalizado
 * @returns {{ insumo: object|null, premisa: boolean, sinLavar: boolean, objeto: 'la'|'lo'|null, nino: boolean }|null}
 */
function comerTratado(n) {
  if (!RE_CONSUMO.test(n) || RE_ANIMAL_COME.test(n)) return null;
  // Tiene que haber una aplicación; «¿puedo vender hoy el biol?» es otra cosa.
  if (!RE_FUMIGAR.test(n) || RE_PIDE_QUE_APLICAR.test(n)) return null;
  const insumo = INSUMOS_TRATADO.find((i) => i.re.test(n)) || null;
  const premisa = Boolean(insumo) && RE_PREMISA_NATURAL.test(n);
  if (!RE_RECIEN.test(n) && !premisa) return null;
  const nino = edadMenor(n) != null || RE_SOY_MENOR.test(n) || RE_HABLA_NINO.test(n);
  // «¿cuándo la puedo cosechar?» de un adulto, sin premisa, la contesta la
  // respuesta de plazos de recetasSeguras (empieza por el plazo).
  if (!nino && !premisa && RE_PREGUNTA_CUANDO.test(n)) return null;
  const sinFamilia = n.replace(RE_HABLA_NINO, ' ');
  const objeto = (RE_FEMENINO.test(sinFamilia) && 'la') || (RE_MASCULINO.test(sinFamilia) && 'lo') || null;
  return { insumo, premisa, sinLavar: RE_SIN_LAVAR.test(n), objeto, nino };
}

/** Plazos de la ficha del estiércol fresco: [no toca el suelo, toca el suelo]. */
function plazosEstiercol() {
  const m = AVISO_ESTIERCOL_CRUDO.match(/(\d+) días si lo que se cosecha no toca el suelo, y (\d+) días si lo toca/);
  return m ? { noToca: m[1], toca: m[2] } : null;
}

// ── Hormigas dentro de la casa ───────────────────────────────────────────────

const RE_HORMIGAS = /\bhormig(a|as|uitas?)\b/;
const RE_CASA =
  /\b(mi casa|la casa|en casa|de casa|mi cocina|la cocina|el apartamento|mi apartamento|mi cuarto|el cuarto|el bano|la alacena|la despensa|mi pieza|la pieza|el hogar|mi hogar|el azucar|la azucarera)\b/;
// Si la pregunta es de finca o cultivo, es otra conversación (arrieras,
// manejo integrado): la deja pasar al flujo agronómico.
const RE_CAMPO =
  /\b(finca|huerta|cultivo|cultivos|arriera|arrieras|cortadora|cortadoras|potrero|lote|cafetal|siembra|sembrado|cosecha|vivero|platanera|platanal|hormiguero en el)\b/;

/**
 * Detecta una pregunta que exige respuesta de seguridad fija.
 *
 * @param {string} text texto crudo del usuario
 * @returns {{ isSafety: boolean, kind?: 'comer_tratado'|'datos_personales'|'comer_desconocido'|'hormigas_casa', edad?: number|null, menor?: boolean, nino?: boolean, insumo?: object|null, premisa?: boolean, sinLavar?: boolean }}
 */
export function detectSafetyIntent(text) {
  if (!text || typeof text !== 'string') return { isSafety: false };
  const n = norm(text);
  if (!n) return { isSafety: false };

  // 0) Comer o vender algo recién tratado: daño físico, y la edad no lo tapa.
  const tratado = comerTratado(n);
  if (tratado) {
    const menor = edadMenor(n) != null || RE_SOY_MENOR.test(n);
    return { isSafety: true, kind: 'comer_tratado', ...tratado, menor };
  }

  // 1) Comer algo desconocido va primero: es el daño físico inmediato.
  if (esComerDesconocido(n)) {
    return { isSafety: true, kind: 'comer_desconocido' };
  }

  // 2) Datos personales o edad de menor.
  const edad = edadMenor(n);
  if (RE_OFRECE_DIRECCION.test(n) || RE_OFRECE_DATO.test(n) || RE_MI_DIRECCION.test(n)
    || RE_MI_CONTACTO.test(n) || RE_QUIERES_SABER_DONDE.test(n)
    || edad != null || RE_SOY_MENOR.test(n)) {
    return { isSafety: true, kind: 'datos_personales', edad, menor: edad != null || RE_SOY_MENOR.test(n) };
  }

  // 3) Hormigas dentro de la casa (no en la finca).
  if (RE_HORMIGAS.test(n) && (/\bvenenos?\b/.test(n) || (RE_CASA.test(n) && !RE_CAMPO.test(n)))) {
    return { isSafety: true, kind: 'hormigas_casa' };
  }

  return { isSafety: false };
}

export const RESPUESTA_DATOS_PERSONALES = [
  'Su dirección no se comparte con un chat: ni conmigo ni con nadie en internet.',
  'Eso también vale para su teléfono, su colegio y su apellido. Yo no necesito saber nada de eso para ayudarle.',
  'Antes de dar sus datos en cualquier chat o juego, hable con un adulto de confianza, como su mamá, su papá o su profe.',
  'Con mucho gusto le cuento cosas de plantas, animales, abejas o del clima. ¿Sobre qué quiere aprender?',
].join('\n\n');

export const RESPUESTA_EDAD_MENOR = [
  'Gracias por contarme. Su dirección no se comparte con un chat: ni conmigo ni con nadie en internet.',
  'Tampoco su teléfono, su colegio ni su apellido. Yo no necesito saber nada de eso para ayudarle.',
  'Si alguien en internet le pide esos datos, cuéntele a un adulto de confianza, como su mamá, su papá o su profe.',
  'Con mucho gusto le cuento cosas de plantas, animales, abejas o del clima. ¿Sobre qué quiere aprender?',
].join('\n\n');

// La primera frase es la del criterio de la re-auditoría RA1 (N01), literal:
// vale igual para una niña que para un adulto que trae algo del monte.
export const RESPUESTA_COMER_DESCONOCIDO = [
  'No se lo coma hasta que un adulto lo revise. No coma ni pruebe nada que no conozca: ni hojas, ni frutos, ni moras, ni hongos, ni semillas, ni flores, ni raíces.',
  'Algunas plantas y hongos que se ven inofensivos son venenosos, y ni por una descripción ni por una foto se puede saber con seguridad si algo se come.',
  'Lávese las manos si lo tocó y muéstreselo a un adulto de confianza.',
  'Si alguien ya se lo comió y se siente mal (vómito, mareo, dolor de barriga), busquen ayuda médica de inmediato y lleven un pedazo de la planta.',
].join('\n\n');

// RA3 2026-10-11 (R10): la prohibición de venenos y de mezclar limpiadores
// iba al final y en el teléfono quedaba bajo el pliegue. Va antes de la lista.
export const AVISO_HORMIGAS_ADULTO = 'Pida ayuda a un adulto, y no use venenos ni mezcle limpiadores.';

export const RESPUESTA_HORMIGAS_CASA = [
  'Lo primero es quitarles la comida y limpiar: las hormigas entran a la casa porque encuentran algo de comer.',
  AVISO_HORMIGAS_ADULTO,
  '1. Guarde el azúcar, la miel, el pan y la comida de las mascotas en frascos bien cerrados.',
  '2. Limpie las migas y lo pegajoso de mesas, piso y lavaplatos, y saque la basura seguido.',
  '3. Lave con agua y jabón el camino por donde pasan: así borra el rastro que siguen.',
  '4. Busque por dónde entran (una grieta, una ventana) y pida a un adulto que la tape.',
  'Si después de unos días siguen llegando, que un adulto decida qué más hacer.',
].join('\n');

/**
 * «No, todavía no» + motivo + plazo con fuente o «sin dato con fuente».
 * Con `nino`, frases cortas y la orden de avisarle a un adulto.
 * @param {{ insumo?: any, premisa?: boolean, sinLavar?: boolean, nino?: boolean, objeto?: 'la'|'lo'|null }} intent
 * @returns {string}
 */
export function respuestaComerTratado({ insumo = null, premisa = false, sinLavar = false, nino = false, objeto = null } = {}) {
  const nombre = insumo?.nombre || 'el producto';
  const despuesDe = `después ${nombre.replace(/^el /, 'del ')}`;
  const plazos = insumo?.estiercol ? plazosEstiercol() : null;

  if (nino) {
    const quePronombre = objeto ? `se ${objeto} coma` : 'se coma nada de la huerta';
    const quien = insumo ? nombre : 'lo que fumigaron';
    const primera = premisa
      ? `No, todavía no ${quePronombre}: aunque ${nombre} sea natural, queda en la planta y le puede hacer daño.`
      : `No, todavía no ${quePronombre}: ${quien} queda en la planta y le puede hacer daño.`;
    return [
      primera,
      insumo ? `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${insumo.motivo}.` : 'Lo que se fumiga deja residuo en la planta, aunque no se vea.',
      'Hay que esperar varios días, y un adulto le dice cuándo ya se puede.',
      'Si ya tocó las plantas, lávese bien las manos con agua y jabón.',
      'Cuéntele a su mamá o a un adulto de confianza. Si ya se comió algo y se siente mal (le pica la boca, le duele la barriga o vomita), díganle a un adulto enseguida y busquen ayuda médica.',
    ].join('\n\n');
  }

  const primera = premisa
    ? `No, todavía no: que ${nombre} sea orgánico o natural no quiere decir que no deje residuo, porque ${insumo.motivo}, así que no se cosecha ni se vende el mismo día.`
    : `No, todavía no: ${nombre} ${insumo?.motivo || 'deja residuo en la planta'}, y lo recién tratado no se come, no se cosecha ni se vende ese mismo día.`;
  let plazo;
  if (plazos) {
    plazo = `Plazo: al menos ${plazos.noToca} días entre la última aplicación y la cosecha si lo que se come no toca el suelo, y ${plazos.toca} días si lo toca (hortalizas de hoja y de raíz). Fuente: ficha de la app, tomada de la norma orgánica de EE. UU. (7 CFR 205.203(c)(1)); el catálogo no tiene un plazo colombiano con fuente.`;
  } else if (!insumo || insumo.comercial) {
    plazo = 'Plazo: el periodo de carencia que trae la etiqueta del producto, contado desde la última aplicación. Si no tiene la etiqueta, no hay dato con fuente: espere, lave bien y consulte a la asistencia técnica (ICA o la UMATA).';
  } else {
    plazo = `Plazo antes de cosechar ${despuesDe}: sin dato con fuente en el catálogo. Espere el plazo que le indique la asistencia técnica (ICA, Agrosavia o la UMATA) y lave bien antes de comer o vender.`;
  }
  const partes = [primera, plazo];
  if (sinLavar) {
    const o = objeto || 'lo';
    partes.push(`Y no ${o} venda sin lavar: quien ${o} compra se ${o} puede comer crud${o === 'la' ? 'a' : 'o'}.`);
  }
  partes.push('Mientras tanto, no deje que niños ni animales coman de esa parte de la huerta, y lávese las manos después de tocar las plantas.');
  return partes.join('\n\n');
}

/**
 * Texto fijo para la clase detectada, o null.
 * @param {{ isSafety: boolean, kind?: string, edad?: number|null, insumo?: any, premisa?: boolean, sinLavar?: boolean, nino?: boolean, objeto?: 'la'|'lo'|null }} intent
 * @returns {{ content: string, kind: string }|null}
 */
export function buildSafetyResponse(intent) {
  if (!intent || !intent.isSafety) return null;
  switch (intent.kind) {
    case 'datos_personales':
      return {
        kind: intent.kind,
        content: intent.edad != null ? RESPUESTA_EDAD_MENOR : RESPUESTA_DATOS_PERSONALES,
      };
    case 'comer_desconocido':
      return { kind: intent.kind, content: RESPUESTA_COMER_DESCONOCIDO };
    case 'hormigas_casa':
      return { kind: intent.kind, content: RESPUESTA_HORMIGAS_CASA };
    case 'comer_tratado':
      return { kind: intent.kind, content: respuestaComerTratado(intent) };
    default:
      return null;
  }
}

export default { detectSafetyIntent, buildSafetyResponse };
