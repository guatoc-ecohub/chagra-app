// SPDX-License-Identifier: AGPL-3.0-only
/**
 * respuestaCorta — primera respuesta corta cuando el usuario la pide.
 *
 * Re-auditoría RA3 2026-10-11 (R03): con el modo «Claro y corto» o con
 * «dígame corto», la broca seguía en 183 palabras con cepa, conidias y nombres
 * científicos, y la gota traía «mildiu», «carga hídrica» y un mandato «Sin
 * verificar». El modelo no obedece de forma estable una regla de longitud, así
 * que el recorte es determinista:
 *
 *   - `pideRespuestaCorta(userMessage, nivelRespuestas)`: modo del perfil
 *     «simple» (Claro y corto) o la pregunta pide «corto», «breve», etc.
 *   - `resumenCorto(text)`: toma frases afirmativas de hasta 15 palabras, sin
 *     términos técnicos sin explicar ni «sin verificar», hasta 40 palabras,
 *     más los cuidados si la respuesta los trae. Para una pregunta sobre cuándo
 *     sembrar, conserva la oración completa del momento si cabe en 40 palabras.
 *     Si el texto fue ensamblado por `prependCorrectionBlock`, omite ese bloque cuando hay
 *     una respuesta afirmativa después. El texto completo queda detrás de «Ver
 *     más» (ChatBubble). Si ninguna oración sirve, devuelve null.
 *   - `RESUMENES_CURADOS`: resumen escrito a mano para respuestas fijas.
 *
 * @module respuestaCorta
 */

import { stripDiacritics } from './outputGuardQueryUtils.js';
import { getCorrectionBlockSource } from '../utils/correctionBlockSource.js';

// RA4 2026-10-12 (R03): el criterio es ≤ 40 palabras en el primer bloque.
export const MAX_PALABRAS_CORTO = 40;
export const MAX_PALABRAS_FRASE = 15;

const PIDE_CORTO_RE =
  /\b(corto|cortico|cortito|breve|brevemente|resumid\w*|resuma|resumen|en pocas palabras|sin tanto detalle|rapidito)\b/;

/**
 * Nivel efectivo del perfil. RA4 2026-10-12 (R03): sin `nivel_respuestas`
 * guardado, el selector del inicio y el perfil ya MUESTRAN «Claro y corto»
 * marcado (aria-checked=true), pero el agente leía '' y respondía largo; tocar
 * el botón ya marcado no guardaba nada. Sin valor guardado, el nivel es
 * 'simple', igual que en la pantalla.
 * @param {string|null|undefined} nivel
 */
export function nivelRespuestasEfectivo(nivel) {
  const n = String(nivel || '').trim();
  return n || 'simple';
}

/**
 * @param {string|null|undefined} userMessage
 * @param {string|null|undefined} [nivelRespuestas] perfil: 'simple' = «Claro y corto».
 */
export function pideRespuestaCorta(userMessage, nivelRespuestas = '') {
  const nivel = String(nivelRespuestas || '').toLowerCase().trim();
  if (['simple', 'campesino', 'campesina', 'corto'].includes(nivel)) return true;
  const u = stripDiacritics(String(userMessage || '')).toLowerCase();
  return PIDE_CORTO_RE.test(u);
}

/** Binomio latino (Género epíteto) por la forma del epíteto. */
const BINOMIO_RE =
  /\b[A-Z][a-z]{3,}\s+[a-z]{3,}(?:ae|ii|us|um|is|ensis|ana|anum|oides|ei|ata|atum|ans|ens|ica|icum|osa|osum|ii|i)\b/;

/** Géneros y términos técnicos que un campesino no usa sin explicación. */
const TECNICO_RE =
  /\b(beauveria|metarhizium|trichoderma|hypothenemus|phytophthora|cephalonomia|prorops|phymastichus|spodoptera|bacillus|conidias?|cepas?|mildiu|carga hidrica|solanace\w*|entomopatogen\w*|parasitoides?|inoculo|esporula\w*|fitopatogen\w*|sistemic\w*|ufc|pH)\b/i;

const NON_ACTIONABLE_SUMMARY_RE =
  /\b(consejo climatico|ante condiciones climaticas extremas|monitorear los pronosticos|plan de contingencia para cultivos|priorizar variedades adaptadas|mantener registros historicos de clima|pronostico:|sembrarlo ahi es inviable|punto importante a considerar)\b/i;

const CONECTOR_INICIAL_RE = /^\s*(?:sin embargo|ademas|por otro lado|es importante notar)\s*,?\s*/i;
const RESPUESTA_DIRECTA_RE =
  /\b(?:puede[n]?\s+sembrar|siembre|siembra|sembrar|cultive|cultivar|plante|plantar|son alternativas|son opciones|se adapta[n]?|es una opcion)\b/i;
const AUTORIA_BOTANICA_RE =
  /\*?[A-Z][a-z]{3,}\s+[a-z]{3,}\*?(?:\s+(?:L\.\s*f\.|L\.|Schreb\.|C\.DC\.|Kunth|Cham\.|Schltdl\.\s*&\s*Cham\.))+/g;

const MARKDOWN_RE = /(\*\*|__|`|^#+\s*|^\s*[-*•]\s+|^\s*\d+[.)]\s+)/gm;
const PUNTO_PROTEGIDO = '\uE000';

/** Protege puntos internos de abreviaturas que no cierran la frase. */
function _protegerAbreviaturas(text) {
  let salida = String(text || '').replace(/(\d)\.(\d)/g, `$1${PUNTO_PROTEGIDO}$2`);

  // Marcador de lista ordenada markdown ("1. Finca…", "12. Finca…") al inicio
  // de línea: el punto no cierra oración, es el número del ítem. Sin esto,
  // un guard que filtra oraciones por línea (partialEvidenceGuard) separa el
  // "1." del resto; si el resto se filtra, el "1." huérfano sobrevive solo —
  // una lista de dos fincas quedaba en «1. 2.» con el contenido real borrado
  // (bug reportado 2026-10-31, comparación de fincas).
  salida = salida.replace(/^(\s*\d{1,2})\.(?=\s)/gm, (_match, prefix) => `${prefix}${PUNTO_PROTEGIDO}`);

  // En «m. s. n. m.» el último punto también cierra la oración si después
  // empieza otra, pero los tres anteriores son parte de la unidad.
  salida = salida.replace(/\bm\.\s*s\.\s*n\.\s*m\./gi, (unidad) => {
    const puntos = [...unidad.matchAll(/\./g)];
    return puntos.reduceRight((texto, punto, i) => {
      if (i === puntos.length - 1) return texto;
      const indice = punto.index;
      return `${texto.slice(0, indice)}${PUNTO_PROTEGIDO}${texto.slice(indice + 1)}`;
    }, unidad);
  });

  // «p. ej.» y las abreviaturas taxonómicas y de autoría no terminan frase.
  salida = salida.replace(/\bp\.\s*ej\./gi, (s) => s.replace(/\./g, PUNTO_PROTEGIDO));
  // Autorías botánicas frecuentes. Solo se protegen si siguen dentro del
  // binomio/listado (minúscula, puntuación de cierre o fin), para que una
  // inicial al final de una oración todavía pueda cerrar la frase.
  salida = salida.replace(
    /\b(?:Schltdl\.\s*&\s*Cham\.|L\.\s*f\.|C\.DC\.|Schreb\.|Cham\.|L\.)(?=\s+[a-záéíóúñ]|[),;:]|$)/gi,
    (s) => s.replace(/\./g, PUNTO_PROTEGIDO),
  );
  salida = salida.replace(/\b(?:var|subsp|ssp|f|cf|aff|cv)\.(?=\s|[),;:]|$)/gi, (s) => s.replace(/\./g, PUNTO_PROTEGIDO));
  salida = salida.replace(/\b(?:Bonpl|Baill|Cav|Lam|Mill|Mart|Humb|Aubl|Jacq|Willd|Duch|Holm-Niels)\.(?=\s+[a-záéíóúñ])/g, (s) => s.replace(/\./g, PUNTO_PROTEGIDO));
  // Iniciales antes de apellido, y una inicial seguida de continuación en
  // minúscula; una oración nueva en mayúscula conserva su punto de corte.
  salida = salida.replace(/\b(?:[A-Z]\.\s*){1,2}[A-Z][a-z-]+/g, (s) => s.replace(/\./g, PUNTO_PROTEGIDO));
  salida = salida.replace(/\b[A-Z]{1,2}\.(?=\s+[a-záéíóúñ])/g, (s) => s.replace(/\./g, PUNTO_PROTEGIDO));

  // «etc.» y «aprox.» son abreviaturas solo si continúa la misma frase.
  salida = salida.replace(/\b(?:etc|aprox)\.(?=\s+[a-záéíóúñ0-9])/gi, (s) => s.replace(/\./g, PUNTO_PROTEGIDO));
  return salida;
}

function _parentesisBalanceados(text) {
  let balance = 0;
  for (const caracter of text) {
    if (caracter === '(') balance += 1;
    if (caracter === ')') {
      balance -= 1;
      if (balance < 0) return false;
    }
  }
  return balance === 0;
}

/**
 * Quita delimitadores de cursiva/negrita sin pareja, incluso si un guard
 * conservó solo un fragmento de la oración que los contenía.
 * @param {string} text
 * @returns {string}
 */
export function balancearMarkdownAsteriscos(text) {
  const fuente = String(text || '');
  const sinPareja = new Set();
  const abiertos = new Map();
  const tokens = [...fuente.matchAll(/\*{1,3}/g)];

  for (const token of tokens) {
    const inicio = token.index ?? 0;
    const marca = token[0];
    const linea = fuente.slice(fuente.lastIndexOf('\n', inicio - 1) + 1, inicio);
    const escapadas = (fuente.slice(0, inicio).match(/\\+$/)?.[0].length || 0) % 2 === 1;
    // Una viñeta `* texto` es estructura de lista, no énfasis sin cerrar.
    if (escapadas || (marca === '*' && !linea.trim() && /^\s/.test(fuente.slice(inicio + 1)))) continue;

    if (marca === '***') {
      const triples = abiertos.get('***') || [];
      if (triples.length > 0) {
        triples.pop();
        abiertos.set('***', triples);
      } else {
        const sencillas = abiertos.get('*') || [];
        const dobles = abiertos.get('**') || [];
        if (sencillas.length > 0 && dobles.length > 0) {
          sencillas.pop();
          dobles.pop();
          abiertos.set('*', sencillas);
          abiertos.set('**', dobles);
        } else {
          triples.push(inicio);
          abiertos.set('***', triples);
        }
      }
      continue;
    }

    const pila = abiertos.get(marca) || [];
    if (pila.length > 0) {
      pila.pop();
      abiertos.set(marca, pila);
    } else {
      pila.push(inicio);
      abiertos.set(marca, pila);
    }
  }

  for (const [marca, posiciones] of abiertos) {
    for (const inicio of posiciones) {
      for (let i = inicio; i < inicio + marca.length; i += 1) sinPareja.add(i);
    }
  }
  if (sinPareja.size === 0) return fuente;
  let salida = '';
  for (let i = 0; i < fuente.length; i += 1) {
    if (!sinPareja.has(i)) salida += fuente[i];
  }
  return salida;
}

function _palabras(s) {
  return s.split(/\s+/).filter(Boolean).length;
}

function _esPregunta(oracion) {
  return /^\s*¿/.test(oracion) || /\?\s*$/.test(oracion);
}

function _sinConectorInicial(oracion) {
  const texto = String(oracion || '').trim();
  const conector = texto.match(CONECTOR_INICIAL_RE);
  if (!conector) return texto;

  const resto = texto.slice(conector[0].length).trim();
  return RESPUESTA_DIRECTA_RE.test(stripDiacritics(resto)) ? resto : '';
}

function _sinCitaBotanica(oracion) {
  return String(oracion || '')
    .replace(AUTORIA_BOTANICA_RE, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function _respuestaSinCorreccionAntepuesta(text) {
  const correctionBlock = getCorrectionBlockSource(text);
  if (!correctionBlock || !text.startsWith(correctionBlock)) return text;

  const response = text.slice(correctionBlock.length).trim();
  if (!response) return text;
  const hasAnswerPhrase = segmentarOraciones(response, { quitarMarkdown: true }).some((oracion) => !_esPregunta(oracion));
  return hasAnswerPhrase ? response : text;
}

/**
 * Segmentador compartido de respuestas. Protege puntos entre dígitos y
 * abreviaturas, conserva el contexto de paréntesis y puede devolver los
 * separadores originales para reconstruir texto filtrado sin pegar oraciones.
 *
 * @param {string} text
 * @param {{quitarMarkdown?:boolean, conservarSeparadores?:boolean, separarPuntoYComa?:boolean}} [opts]
 * @returns {string[]}
 */
export function segmentarOraciones(text, {
  quitarMarkdown = false,
  conservarSeparadores = false,
  separarPuntoYComa = false,
} = {}) {
  const original = String(text || '');
  const entrada = quitarMarkdown ? original.replace(MARKDOWN_RE, '') : original;
  const normalizado = _protegerAbreviaturas(entrada);
  /** @type {string[]} */
  const oraciones = [];
  let inicio = 0;
  let profundidad = 0;

  const guardar = (fin) => {
    const fragmento = normalizado.slice(inicio, fin).replaceAll(PUNTO_PROTEGIDO, '.');
    if (conservarSeparadores) {
      if (fragmento.length > 0) oraciones.push(fragmento);
      return;
    }
    const limpio = fragmento.trim();
    if (!limpio) return;
    const frase = quitarMarkdown ? balancearMarkdownAsteriscos(limpio) : limpio;
    oraciones.push(frase);
  };

  // El escaneo no corta decimales/miles, abreviaturas protegidas ni contenido
  // entre paréntesis. También conserva cierres markdown junto a la puntuación.
  for (let i = 0; i < normalizado.length; i += 1) {
    const caracter = normalizado[i];
    if (caracter === '(') profundidad += 1;
    if (caracter === ')') profundidad = Math.max(0, profundidad - 1);
    if (profundidad !== 0) continue;

    if (caracter === '\n') {
      let fin = i + 1;
      while (fin < normalizado.length && /\s/.test(normalizado[fin])) fin += 1;
      guardar(fin);
      inicio = fin;
      i = fin - 1;
      continue;
    }

    const puntoYComa = separarPuntoYComa && caracter === ';';
    if (!puntoYComa && (!'.!?…'.includes(caracter) || caracter === PUNTO_PROTEGIDO)) continue;

    let fin = i + 1;
    if (!puntoYComa) {
      while (fin < normalizado.length && '.!?…'.includes(normalizado[fin]) && normalizado[fin] !== PUNTO_PROTEGIDO) fin += 1;
    }
    while (fin < normalizado.length && /["'”’»*]/.test(normalizado[fin])) fin += 1;
    if (fin < normalizado.length && !/\s/.test(normalizado[fin])) continue;
    if (conservarSeparadores) {
      while (fin < normalizado.length && /\s/.test(normalizado[fin])) fin += 1;
    }
    guardar(fin);
    inicio = fin;
    i = fin - 1;
  }

  guardar(normalizado.length);
  if (quitarMarkdown) {
    return oraciones.filter((o) => o.length > 0 && /[a-záéíóúñ]/i.test(o) && _parentesisBalanceados(o));
  }
  return oraciones;
}

// RA5 2026-10-24 (FAMILIAS-08): en 8 de 14 respuestas útiles, lo visible sin
// tocar «Ver más» eran notas de las guardas («Esa otra especie es una planta
// distinta…», «Seguridad tomate: no voy a confirmar una cura…», la nota
// anti-quema en una pregunta de familias) y la respuesta quedaba plegada.
// Esas notas siguen en el texto completo; el resumen arranca por la respuesta.
const NOTA_DE_GUARDA_RE =
  /planta distinta|binomio corresponde a otra planta|no voy a confirmar una cura|pueden estar mal escritos|^\s*(?:⚠️\s*)?(?:aviso|advertencia):|^\s*(?:⚠️\s*)?seguridad(?: [a-z ]{1,24})?:|^\s*(?:⚠️\s*)?importante:|^\s*una precision sobre la clasificacion|\(binomio:/;
const QUEMA_RE = /\bquem\w*|\bley 1930\b|\bcar\b|\bfuego\b/;
const PREGUNTA_QUEMA_RE = /\bquem\w*|\bfuego\b|\brocer\w*|\bsocola\b/;

/** Cabeza que contesta: sí/no, recomiendo, puede sembrar, una orden. */
const RESPUESTA_AL_CAMPESINO_RE =
  /^\s*(?:si|no)\b[,.:;!]|^\s*(?:si|no),|^\s*no\s+(?:siembre|mezcle|aplique|use|lo|la|le|se|es|hay|conviene|recomiendo)\b|\b(?:no\s+)?recomiend\w*\b|\b(?:puede|pueden|podria)\s+(?:sembrar|rotar|resembrar|plantar)\b|^\s*(?:siembre|siembra|rote|evite|haga|use|aplique|plante|deje|espere|saque|cubra|revise)\b/;

// MF-11 (piloto 2026-10-31): «¿Cuántas plantas tengo?» mostraba solo «Si
// necesita agregar alguna nueva especie…, hágame saber.» y el dato («tiene 6
// plantas») quedaba tras «Ver más». Una oferta de cortesía al cierre no
// contesta nada: no entra al resumen.
const CORTESIA_CIERRE_RE =
  /^\s*(?:si\s+(?:necesita|desea|quiere|requiere|tiene)\b[^.!?]*\b(?:hagame saber|digame|aviseme|con gusto|estoy (?:aqui|para)|no dude)\b|(?:quedo|estoy)\s+(?:atent\w*|a la orden|a su disposicion|para (?:servirle|ayudarle))|no dude en\b|espero (?:que )?(?:esto|le) (?:le )?(?:sirva|ayude))/;
/** Cabeza antes de «:» que trae una cifra: el dato pedido (cuántas, cuánto). */
const CABEZA_CON_DATO_RE = /\d/;

/** Aviso de fuente caída (toolEvidenceAvailability): va siempre al resumen. */
const AVISO_FUENTE_RE = /^\s*Aviso: no pude consultar[^\n]*$/m;
const PREGUNTA_DESCUBRIMIENTO_CULTIVOS_RE =
  /\bque\b[^.!?\n]{0,45}\b(?:puedo|debo|conviene|recomienda|recomiendas)\b[^.!?\n]{0,24}\b(?:sembrar|plantar|cultivar)\b|\b(?:recomiend\w*|sugier\w*)\b[^.!?\n]{0,36}\b(?:cultivo|sembrar|plantar)\b|\b(?:cultivo|cultivos)\s+viable\w*\b/i;
const PREGUNTA_CUANDO_SIEMBRA_RE =
  /\b(?:cuando|en que mes|en que epoca|en que temporada|cual es el mejor momento|mejor epoca)\b[^.!?\n]{0,80}\b(?:sembr\w*|plant\w*|cultiv\w*)\b/;
const MOMENTO_SIEMBRA_RE =
  /\b(?:lluvias?|sequ[ií]a|temporada(?:s)?\s+(?:de\s+)?(?:lluvias?|sequ[ií]a)|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i;
const RESPUESTA_CON_CULTIVOS_RE = /\b(?:sembrar|plantar|cultivar|recomiend\w*|sugier\w*)\b/i;
const CITA_BOTANICA_RE = /\(\s*[\p{Lu}][\p{L}-]{3,}\s+[\p{Ll}][\p{L}-]{2,}/u;

function _quitarCitasBotanicasParaResumen(oracion) {
  return String(oracion || '')
    .replace(/\s*\((?=[^)]*\b[A-Z][a-z-]{3,}\s+[a-z][a-z-]{2,})[^)]*\)/gu, '')
    .replace(/\s+\b(?:cv|var|subsp|ssp)\.\s+['"][^'"]+['"]/giu, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Conserva la oración completa del momento de siembra para que una advertencia
 * posterior no la desplace.
 */
function _resumenMomentoSiembra(oraciones) {
  for (const oracion of oraciones) {
    if (!MOMENTO_SIEMBRA_RE.test(stripDiacritics(oracion))) continue;
    const candidata = oracion.trim();
    if (
      _palabras(candidata) <= MAX_PALABRAS_CORTO &&
      oracionSirveCorta(candidata, { maxPalabras: MAX_PALABRAS_CORTO })
    ) return candidata;
  }
  return null;
}

/**
 * ¿La oración sirve para la versión corta?
 * @param {string} o
 * @param {{maxPalabras?: number}} [options]
 */
export function oracionSirveCorta(o, { maxPalabras = MAX_PALABRAS_FRASE } = {}) {
  const n = stripDiacritics(o);
  if ((n.match(/[a-z]/gi) || []).length <= 2) return false;
  if (_palabras(o) > maxPalabras) return false;
  if (NON_ACTIONABLE_SUMMARY_RE.test(n) || /^\s*(?:⚠️\s*)?(?:ojo:|correccion importante:)/i.test(n)) return false;
  // Conserva la cursiva científica completa cuando viene marcada por el agente;
  // un binomio sin esa marca sigue fuera del resumen por legibilidad.
  if (BINOMIO_RE.test(o) && !/\*[A-Z][a-z]{3,}\s+[a-z]{3,}\*/.test(o)) return false;
  if (TECNICO_RE.test(n)) return false;
  if (/sin verificar/i.test(n)) return false;
  if (/:\s*$/.test(o)) return false;
  return true;
}

/**
 * Resumen corto determinista, o null si ninguna oración sirve.
 * @param {string} text
 * @param {{ userMessage?: string|null }} [opts]
 * @returns {string|null}
 */
export function resumenCorto(text, { userMessage = null } = {}) {
  const textoOriginal = String(text || '');
  const aviso = textoOriginal.match(AVISO_FUENTE_RE)?.[0]?.trim() || null;
  const textoParaResumen = _respuestaSinCorreccionAntepuesta(
    aviso ? textoOriginal.replace(AVISO_FUENTE_RE, '').trim() : textoOriginal,
  );
  const preguntaQuema = PREGUNTA_QUEMA_RE.test(stripDiacritics(String(userMessage || '')));
  const esNotaDeGuarda = (o) => {
    const n = stripDiacritics(o);
    return NOTA_DE_GUARDA_RE.test(n) || CORTESIA_CIERRE_RE.test(n.toLowerCase())
      || (!preguntaQuema && QUEMA_RE.test(n));
  };
  const todasLasOraciones = segmentarOraciones(textoParaResumen, { quitarMarkdown: true });
  const sinNotas = todasLasOraciones.filter((o) => !esNotaDeGuarda(o));
  const esPreguntaCuandoSiembra = PREGUNTA_CUANDO_SIEMBRA_RE.test(
    stripDiacritics(String(userMessage || '')),
  );
  const momentoSiembra = esPreguntaCuandoSiembra ? _resumenMomentoSiembra(sinNotas) : null;
  // Si la respuesta no contiene una oración completa y breve con el momento,
  // no muestre una advertencia o un fragmento como si contestara la pregunta.
  if (esPreguntaCuandoSiembra && !momentoSiembra) return null;
  const cropRecommendationSentences = sinNotas
    .filter((o) => RESPUESTA_CON_CULTIVOS_RE.test(o) || CITA_BOTANICA_RE.test(o))
    .map(_quitarCitasBotanicasParaResumen);
  const esConsultaCultivos = PREGUNTA_DESCUBRIMIENTO_CULTIVOS_RE.test(stripDiacritics(String(userMessage || '')));
  const oracionesBase = momentoSiembra
    ? [momentoSiembra]
    : esConsultaCultivos && cropRecommendationSentences.length > 0
    ? cropRecommendationSentences
    : sinNotas.some((o) => !_esPregunta(o)) ? sinNotas : todasLasOraciones;
  // «No recomiendo asociar tomate con papa: comparten Phytophthora…» no cabe
  // entera; su cabeza antes de los dos puntos sí es la respuesta.
  const oraciones = oracionesBase.map((o) => {
    if (oracionSirveCorta(o)) return o;
    const cabeza = o.split(/:\s/)[0];
    // «En su finca tiene 6 plantas registradas: Arveja, Uchuva…» (MF-11):
    // la cabeza con la cifra es la respuesta; la lista queda en «Ver más».
    return cabeza !== o && _palabras(cabeza) >= 4
      && (RESPUESTA_AL_CAMPESINO_RE.test(stripDiacritics(cabeza)) || CABEZA_CON_DATO_RE.test(cabeza))
      ? `${cabeza.trim()}.`
      : o;
  });
  const tieneFrasesAfirmativas = oraciones.some((oracion) => !_esPregunta(oracion));
  const candidatasOriginales = tieneFrasesAfirmativas
    ? oraciones.filter((oracion) => !_esPregunta(oracion))
    : oraciones;
  const candidatas = candidatasOriginales
    .map((oracion) => (oracion === momentoSiembra ? oracion : _sinConectorInicial(oracion)))
    .map((oracion) => (
      _palabras(oracion) > MAX_PALABRAS_FRASE && oracion !== momentoSiembra
        ? _sinCitaBotanica(oracion)
        : oracion
    ))
    .filter(Boolean);
  const candidatasValidas = candidatas.filter((oracion) => oracionSirveCorta(oracion, {
    maxPalabras: oracion === momentoSiembra ? MAX_PALABRAS_CORTO : MAX_PALABRAS_FRASE,
  }));
  const elegidas = [];
  const cuidado = cuidadoCorto(textoParaResumen);
  let total = cuidado ? _palabras(cuidado) : 0;
  for (const o of candidatasValidas) {
    if (cuidado && CUIDADO_RE.test(stripDiacritics(o))) continue;
    const p = _palabras(o);
    if (total + p > MAX_PALABRAS_CORTO) break;
    elegidas.push(/[.!?]$/.test(o) ? o : `${o}.`);
    total += p;
  }
  if (elegidas.length === 0) return null;
  if (cuidado) elegidas.push(cuidado);
  const corto = elegidas.join(' ');
  if (!_parentesisBalanceados(corto) || (corto.match(/\*/g) || []).length % 2 !== 0) return null;
  // Si el «resumen» ya es todo el texto, no hay nada que plegar.
  if (_palabras(corto) >= _palabras(textoOriginal.replace(MARKDOWN_RE, ''))) return null;
  return aviso ? `${corto}\n\n${aviso}` : corto;
}

/** Resúmenes escritos a mano para respuestas fijas (por id de receta segura). */
// RA4 2026-10-12 (R03): ≤ 40 palabras con la primera acción y, si la respuesta
// completa trae algo peligroso (metanol, caldos), sus cuidados.
export const RESUMENES_CURADOS = {
  broca_manejo:
    'Recoja a tiempo los granos maduros y repase el cafetal. ' +
    'Saque del lote los granos picados y caídos. ' +
    'No fumigue venenos: cuide las avispitas. ' +
    'Para el hongo, siga su etiqueta. ' +
    'Metanol de trampas: tóxico, con guantes y lejos de niños.',
  gota_manejo:
    'Saque del lote, con guantes, las hojas con manchas. ' +
    'Sin foto no se sabe si es gota: envíe una foto. ' +
    'El caldo bordelés solo previene. ' +
    'Con caldos: guantes, gafas, nada en floración, lejos de niños.',
  bordeles_catalogo:
    'Caldo bordelés al 1 %: 200 g de sulfato de cobre y 200 g de cal apagada en 20 litros. ' +
    'Úselo el mismo día. ' +
    'Pruébelo antes en pocas plantas. ' +
    'Use guantes y gafas, nada en floración, lejos de niños.',
  // RA4 (S13): venta de un bioinsumo propio. El primer bloque dice el siguiente
  // paso; el detalle del ICA (clasificación, registros, enlace) queda en «Ver más».
  venta_bioinsumo:
    'Para vender su biol necesita registros del ICA. ' +
    'Primer paso: anote qué lleva su biol y para qué sirve. ' +
    'Con eso, pregunte al ICA qué registro les toca a usted y al producto.',
};

/** Cuidados que obligan a llevar su versión corta (texto normalizado). */
const CUIDADO_RE = /\b(guantes?|gafas|toxic\w*|inflamable)\b/;

/**
 * Cuidado corto que debe ir en el resumen si la respuesta completa lo trae.
 * @param {string} text
 * @returns {string|null}
 */
export function cuidadoCorto(text) {
  const t = stripDiacritics(String(text || ''));
  if (/\bmetanol\b/.test(t)) return 'Metanol: tóxico, con guantes y lejos de niños.';
  if (/\b(caldo|bordeles|sulfocalcico|sulfato de cobre)\b/.test(t) && /\bguantes?\b/.test(t)) {
    return 'Con caldos: guantes, gafas, nada en floración, lejos de niños.';
  }
  return null;
}

/**
 * Resumen corto para un turno: el curado si existe, si no el determinista.
 * @param {string} text
 * @param {{ recetaId?: string|null, corto?: string|null, userMessage?: string|null }} [opts]
 */
export function resumenCortoTurno(text, { recetaId = null, corto = null, userMessage = null } = {}) {
  // RA5 2026-10-24: las respuestas fijas que se arman con el insumo de la
  // pregunta (plazo de cosecha, mezclas) traen su propio corto, que empieza
  // por el plazo o por «no se mezclan».
  if (typeof corto === 'string' && corto.trim()) return corto;
  if (recetaId && RESUMENES_CURADOS[recetaId]) return RESUMENES_CURADOS[recetaId];
  return resumenCorto(text, { userMessage });
}
