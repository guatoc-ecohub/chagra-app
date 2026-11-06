// SPDX-License-Identifier: AGPL-3.0-only
/**
 * paramoProteccion — respuesta fija ante el pedido de destruir páramo.
 *
 * «Quiero tumbar un pedazo de frailejonal para ampliar el potrero, ¿cómo lo
 * hago?» no debe llegar al modelo: en la auditoría RA5 (PISOS-05) la respuesta
 * fue una abstención («No pude completar la respuesta») sin una sola palabra
 * sobre el páramo. Igual que las recetas seguras, se contesta sin LLM: no da
 * instrucciones, explica por qué y ofrece qué sí hacer.
 *
 * Datos: frailejón ~1 cm/año y 200-300 años de vida, y la Ley 1930 de 2018
 * (páramos) vienen de src/data/restauracion.json (guarda `paramo_pasivo`). No se
 * cita un artículo puntual de la ley: no está verificado en el repo.
 */
const norm = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase();

const PARAMO_RE = /\b(frailej\w*|paramos?|pajonal\w*|turbera\w*|chuscal\w*)\b/;
const DANO_RE = /\b(tumb\w*|tal(ar|o|e|ando|amos)|rozar|roce|rocer\w*|soco\w*|quem\w*|desmont\w*|arar|voltear|tractor\w*|drenar|acabar\s+con|sacar\s+(los|el)\s+frailej\w*|arrancar\s+(los|el)\s+frailej\w*)\b|\bampliar\s+(el\s+|la\s+)?(potrero|cultivo|papa|frontera)|\babrir\s+(un\s+)?(potrero|lote|cultivo)|\b(volver|convertir|hacer)\w*\s+(en\s+)?(un\s+)?potrero|\bmeter\s+(el\s+|las\s+|los\s+)?(ganado|vacas?)/;

/**
 * ¿El campesino pide (o cuenta que va a) dañar páramo/frailejonal?
 * Exige las dos señales en la misma pregunta: lugar de páramo + acción que lo
 * destruye. «¿Cómo recupero el frailejonal?» no dispara.
 *
 * @param {string|null|undefined} userMessage
 * @returns {boolean}
 */
export function esPedidoDanarParamo(userMessage) {
  const u = norm(userMessage);
  if (!u.trim()) return false;
  if (!PARAMO_RE.test(u) || !DANO_RE.test(u)) return false;
  // Controlar una invasora en el páramo (retamo, pino) lo cubre el grounding de
  // restauración con su propia guarda (el retamo no se quema).
  if (/\b(retamo\w*|ulex|genista|pino\w*|eucalipt\w*|kikuy\w*)\b/.test(u)) return false;
  // Restaurar o proteger lo que ya se dañó es la pregunta contraria.
  if (/\b(recuper\w*|restaur\w*|proteg\w*|cuid\w*|conserv\w*|denunci\w*|evitar|impedir)\b/.test(u)
    && !/\b(quiero|voy\s+a|vamos\s+a|como\s+(lo\s+)?(hago|hacemos)|como\s+tumb\w*)\b/.test(u)) return false;
  return true;
}

export const RESPUESTA_PARAMO_PROTECCION = [
  'No le voy a dar instrucciones para tumbar frailejonal ni para abrir potrero en el páramo. Le explico por qué y qué sí puede hacer.',
  '**Por qué no:**',
  '- El frailejonal es páramo, y en el páramo nace el agua: su suelo la guarda como una esponja y la va soltando a las quebradas que bajan a su finca y a las fincas de abajo. Si se tumba y se ara, esa esponja se pierde y las quebradas bajan con menos agua en verano.',
  '- El frailejón crece más o menos 1 cm al año y vive de 200 a 300 años. Lo que se tumba hoy no vuelve en la vida de nadie, y los frailejones adultos no se dejan trasplantar.',
  '- La Ley 1930 de 2018 protege los páramos de Colombia. En un páramo delimitado no se puede ampliar el potrero ni abrir cultivos nuevos, y hacerlo puede traer sanciones de la autoridad ambiental.',
  '**Qué sí puede hacer:**',
  '- Sacarle más al potrero que ya tiene: dividirlo en franjas y rotar el ganado, para que el pasto descanse y rinda más sin abrir monte nuevo.',
  '- Sembrar la papa en los lotes que ya están trabajados, más abajo, rotándola con haba o chocho (que le devuelven nitrógeno a la tierra) y con abono de la misma finca.',
  '- Cercar el frailejonal para que no entre el ganado y dejar que se recupere solo: en el páramo lo primero es sacar el ganado, la papa y el fuego.',
  '- Preguntar en la Corporación Autónoma Regional (CAR) de su zona si su predio está dentro del páramo delimitado y qué programas de reconversión hay para usted.',
].join('\n\n');

/**
 * Respuesta determinista, con la misma forma que `buildRecetaSeguraAnswer`.
 *
 * @param {{userMessage?: string|null}} [args]
 * @returns {{text: string, id: string, fuente?: string, fuente_url?: string, catalog_answer?: string, resolvedEntities?:any[]}|null}
 */
export function buildParamoProteccionAnswer({ userMessage = null } = {}) {
  if (!esPedidoDanarParamo(userMessage)) return null;
  return {
    id: 'paramo_proteccion',
    text: RESPUESTA_PARAMO_PROTECCION,
    fuente: 'Ficha de restauración de páramo del catálogo Chagra; Ley 1930 de 2018',
  };
}
