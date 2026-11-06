// SPDX-License-Identifier: AGPL-3.0-only
import { segmentarOraciones } from './respuestaCorta.js';
/**
 * ensoSiembraResponder.js — «¿cuándo siembro X si viene El Niño?» con el signo
 * del efecto fijado en código, no en el modelo.
 *
 * Re-auditoría RA1 2026-10-06 (N02, P0): a «¿cuándo siembro frijol en Boyacá si
 * viene El Niño?» el agente respondió que El Niño trae «lluvias intensas e
 * inundaciones», citó un ONI con fecha sin boletín y recomendó esperar. En los
 * Andes colombianos El Niño reduce la lluvia; el saludo de la misma app lo decía.
 *
 * El signo regional sale de ensoContext.js (REGION_IMPACTS, trazado a los DR de
 * ENSO de Chagra con fuentes IDEAM/UPRA/Cenicafé). Aquí no se afirma la fase
 * actual ni ningún ONI: la respuesta es condicional («si entra El Niño») y manda
 * al boletín vigente con su fecha.
 *
 * Dos usos:
 *   - detectEnsoSiembraIntent + buildEnsoSiembraResponse: respuesta fija antes
 *     del LLM (AgentScreen.handleSubmit, igual que safetyIntentResponder).
 *   - guardEnsoLluviaSigno (outputGuards): si otra ruta deja pasar «El Niño trae
 *     más lluvia», la respuesta se reemplaza por la fija.
 *
 * Puro y sin red. Usted, nunca voseo. Sin rayas largas en el copy.
 */

// Signo regional del efecto, condensado de REGION_IMPACTS en ensoContext.js
// (mismas fuentes: IDEAM/UPRA/Cenicafé). Se copia aquí, sin importarlo, para que
// la respuesta de seguridad no dependa de un módulo que otras pruebas simulan.
const SIGNO = Object.freeze({
  andina: {
    nino: 'El Niño en los Andes trae menos lluvia y más días calurosos.',
    nina: 'La Niña en los Andes trae más lluvia, suelos sobresaturados y más riesgo de deslizamientos en ladera y de hongos.',
  },
  caribe: {
    nino: 'El Niño agrava la sequía del Caribe: menos lluvia y déficit de agua.',
    nina: 'La Niña en el Caribe trae lluvias intensas e inundación en planicie.',
  },
  pacifico: {
    nino: 'El Niño reduce algo la lluvia del Pacífico, aunque sigue siendo una región muy lluviosa.',
    nina: 'La Niña intensifica las lluvias del Pacífico: erosión y deslizamientos en ladera.',
  },
  orinoquia: {
    nino: 'El Niño alarga y agrava la estación seca de los Llanos: menos lluvia y más riesgo de incendio.',
    nina: 'La Niña alarga la temporada de lluvias y el encharcamiento en la sabana inundable.',
  },
  amazonia: {
    nino: 'El Niño trae sequías inusuales a la Amazonía: menos lluvia y más riesgo de incendio.',
    nina: 'La Niña mantiene o aumenta la humedad amazónica; el riesgo es el exceso de agua en las vegas.',
  },
});

const DEPTO_TO_REGION = Object.freeze({
  'la guajira': 'caribe', cesar: 'caribe', magdalena: 'caribe', atlantico: 'caribe',
  bolivar: 'caribe', sucre: 'caribe', cordoba: 'caribe', 'san andres': 'caribe',
  choco: 'pacifico', 'valle del cauca': 'pacifico', cauca: 'pacifico', narino: 'pacifico',
  meta: 'orinoquia', casanare: 'orinoquia', arauca: 'orinoquia', vichada: 'orinoquia',
  amazonas: 'amazonia', caqueta: 'amazonia', putumayo: 'amazonia', guaviare: 'amazonia',
  guainia: 'amazonia', vaupes: 'amazonia',
  boyaca: 'andina', cundinamarca: 'andina', quindio: 'andina', caldas: 'andina',
  risaralda: 'andina', antioquia: 'andina', santander: 'andina', 'norte de santander': 'andina',
  tolima: 'andina', huila: 'andina',
});
const ensoRegionalLine = (fase, region) => (SIGNO[region] ? SIGNO[region][fase] : '');

function norm(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:"«»()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// «El Niño» como fenómeno, no como un niño de la casa.
const RE_NINO = /\b(fenomeno (de )?el nino|fenomeno del nino|el nino|ano nino|ano de nino|epoca de nino)\b/;
const RE_NINA = /\b(fenomeno (de )?la nina|la nina|ano nina|ano de nina|epoca de nina)\b/;
const RE_NINO_PERSONA = /\b(el|la) nin[oa] (de|que|quiere|tiene|puede|juega|mio|mia|esta|va a)\b/;
const RE_SIEMBRA = /\b(siembr\w*|sembr\w*|plant(o|ar|amos|e)|cultiv(o|ar|amos|e)|cosech\w*|calendario de siembra|que (siembro|pongo))\b/;

// Regiones y pisos que la pregunta puede nombrar sin departamento.
/** @type {ReadonlyArray<[RegExp, 'andina'|'caribe'|'pacifico'|'orinoquia'|'amazonia']>} */
const REGION_POR_NOMBRE = Object.freeze([
  [/\b(altiplano|sabana de bogota|cundiboyacense|eje cafetero|zona cafetera|region andina|los andes|andes|cordillera|tierra fria|clima frio|piso frio|paramo|clima medio|tierra templada|clima templado|piso templado|bogota)\b/, 'andina'],
  [/\b(caribe|costa atlantica|la costa|sabanas de (sucre|cordoba|bolivar)|sierra nevada)\b/, 'caribe'],
  [/\b(pacifico|costa pacifica|choco biogeografico)\b/, 'pacifico'],
  [/\b(llanos|llano|orinoquia|sabana inundable|piedemonte llanero)\b/, 'orinoquia'],
  [/\b(amazonia|amazonas|selva)\b/, 'amazonia'],
]);

const RAIN_LESS = Object.freeze({ andina: true, caribe: true, orinoquia: true, amazonia: true, pacifico: true });

/**
 * Región natural que nombra el texto, o null. Departamento primero.
 * @param {string} text
 * @returns {'andina'|'caribe'|'pacifico'|'orinoquia'|'amazonia'|null}
 */
export function regionFromText(text) {
  const n = ` ${norm(text)} `;
  const deptos = Object.entries(DEPTO_TO_REGION)
    .map(([name, region]) => /** @type {[string, typeof region]} */ ([norm(name), region]))
    .sort((a, b) => b[0].length - a[0].length);
  for (const [name, region] of deptos) {
    if (new RegExp(`\\b${name}\\b`).test(n)) return region;
  }
  for (const [re, region] of REGION_POR_NOMBRE) {
    if (re.test(n)) return region;
  }
  return null;
}

const DEPTO_LABEL = Object.freeze({
  boyaca: 'Boyacá', cundinamarca: 'Cundinamarca', narino: 'Nariño', cordoba: 'Córdoba',
  bolivar: 'Bolívar', atlantico: 'Atlántico', choco: 'Chocó', quindio: 'Quindío',
  caqueta: 'Caquetá', guainia: 'Guainía', vaupes: 'Vaupés',
});

function lugarNombrado(text) {
  const n = norm(text);
  const deptos = Object.keys(DEPTO_TO_REGION).map(norm).sort((a, b) => b.length - a.length);
  const hit = deptos.find((d) => new RegExp(`\\b${d}\\b`).test(n));
  if (!hit) return null;
  return DEPTO_LABEL[hit] || hit.replace(/\b\w/g, (c) => c.toUpperCase());
}

function cultivoNombrado(text) {
  const t = String(text || '').toLowerCase();
  const m = t.match(/\b(?:siembro|sembrar|sembramos|siembre|siembra de|cultivo de|cultivar|planto|plantar)\s+(?:el |la |los |las |un |una )?([a-záéíóúñü]{3,}(?: de [a-záéíóúñü]{3,})?)/);
  if (!m) return null;
  const crop = m[1];
  if (/^(si|cuando|ahora|este|esta|algo|que|en|con|para|antes|despues)$/.test(crop.split(' ')[0])) return null;
  return crop;
}

/**
 * ¿Pregunta de siembra condicionada a El Niño o La Niña?
 * @param {string} text
 * @returns {{ isEnso: boolean, fase?: 'nino'|'nina', region?: string|null, lugar?: string|null, cultivo?: string|null }}
 */
export function detectEnsoSiembraIntent(text) {
  if (!text || typeof text !== 'string') return { isEnso: false };
  const n = norm(text);
  if (!RE_SIEMBRA.test(n) || RE_NINO_PERSONA.test(n)) return { isEnso: false };
  const fase = RE_NINO.test(n) ? 'nino' : RE_NINA.test(n) ? 'nina' : null;
  if (!fase) return { isEnso: false };
  return {
    isEnso: true,
    fase,
    region: regionFromText(text),
    lugar: lugarNombrado(text),
    cultivo: cultivoNombrado(text),
  };
}

const PIDE_DATOS = 'Para afinar la fecha necesito tres datos: su municipio, la altitud de la finca y si tiene agua para riego.';
const boletin = (fase) => `Si ya llegó o no ${fase === 'nina' ? 'La Niña' : 'El Niño'} lo dice el boletín vigente del IDEAM o de NOAA, con su fecha; no le doy una cifra ni una fecha sin ese boletín.`;
const BOLETIN = boletin('nino');
// Primera frase de la lectura regional (el signo), sin las cifras de otro cultivo.
const primeraFrase = (t) => {
  const primera = segmentarOraciones(t, { separarPuntoYComa: true })[0] || '';
  return `${primera.replace(/[;.!?…]+$/, '')}.`;
};

/**
 * Respuesta fija para la intención detectada, o null.
 * @param {ReturnType<typeof detectEnsoSiembraIntent>|string} intentOrText
 * @returns {{ kind: 'enso_siembra', content: string }|null}
 */
export function buildEnsoSiembraResponse(intentOrText) {
  const intent = typeof intentOrText === 'string' ? detectEnsoSiembraIntent(intentOrText) : intentOrText;
  if (!intent || !intent.isEnso) return null;
  const { fase, region, lugar, cultivo } = intent;
  const para = `Para sembrar${cultivo ? ` ${cultivo}` : ''}${lugar ? ` en ${lugar}` : ''}`;

  if (fase === 'nino') {
    const efecto = region
      ? [
        primeraFrase(ensoRegionalLine('nino', region)),
        RAIN_LESS[region] ? 'No trae más lluvia: trae menos.' : '',
        region === 'andina' ? 'En tierra fría, las noches despejadas pueden traer heladas; eso lo dice la mínima de cada noche.' : '',
      ].filter(Boolean).join(' ')
      : 'En casi toda Colombia El Niño trae menos lluvia y más calor, no más lluvia; en los Andes y el Caribe el déficit de agua es lo que más pesa (IDEAM).';
    return {
      kind: 'enso_siembra',
      content: [
        efecto,
        `${para} con El Niño en camino:`,
        '1. Siembre con el arranque de las lluvias, cuando el suelo ya esté húmedo; no espere a que pase el Niño, porque lo que viene es seco.',
        '2. Prefiera una variedad precoz, que cierre su ciclo antes de que falte el agua.',
        '3. Cubra el suelo (mulch o rastrojo) para guardar la humedad, y si puede, guarde agua lluvia.',
        PIDE_DATOS,
        BOLETIN,
      ].join('\n'),
    };
  }

  const efecto = region
    ? primeraFrase(ensoRegionalLine('nina', region))
    : 'En casi toda Colombia La Niña trae más lluvia: suelos encharcados, más hongos y, en ladera, riesgo de deslizamiento (IDEAM/UPRA).';
  return {
    kind: 'enso_siembra',
    content: [
      efecto,
      `${para} con La Niña en camino:`,
      '1. Evite los lotes que se encharcan y siembre en camas altas o con zanjas de drenaje.',
      '2. Deje más distancia entre plantas para que circule el aire y vigile los hongos.',
      '3. En ladera, mantenga el suelo cubierto y no deje la tierra desnuda.',
      PIDE_DATOS,
      boletin('nina'),
    ].join('\n'),
  };
}

// ── Guarda de salida ─────────────────────────────────────────────────────────

const RE_MAS_LLUVIA = /(m[aá]s lluvia|lluvias? (intensas?|abundantes?|fuertes?|torrenciales?|por encima)|exceso de (lluvia|agua)|inundaci[oó]n(es)?|aumento de (las )?lluvias|aumenta(n|r)? (las )?lluvias|temporada (muy )?lluviosa|m[aá]s precipitaci[oó]n|precipitaciones? (intensas?|por encima))/i;
const RE_NEGADO = /(no (trae|significa|implica|causa|habr[aá])|en vez de|menos lluvia|d[eé]ficit|sequ[ií]a|reduce|disminu)/i;
const RE_NINO_TXT = /\bEl Ni[ñn]o\b|\bfen[oó]meno del Ni[ñn]o\b/i;
const RE_NINA_TXT = /\bLa Ni[ñn]a\b/i;

function frases(text) {
  return segmentarOraciones(text);
}

/**
 * Si la respuesta asocia El Niño con más lluvia (en una región donde reduce la
 * lluvia, o sin región), la reemplaza por la respuesta fija.
 * @param {string} responseText
 * @param {{ userMessage?: string|null }} [opts]
 * @returns {{ text: string, modified: boolean, reason: string|null }}
 */
export function guardEnsoLluviaSigno(responseText, { userMessage = null } = {}) {
  if (typeof responseText !== 'string' || !RE_NINO_TXT.test(responseText)) {
    return { text: responseText, modified: false, reason: null };
  }
  const region = regionFromText(userMessage || '') || regionFromText(responseText);
  if (region && !RAIN_LESS[region]) return { text: responseText, modified: false, reason: null };
  const malSigno = frases(responseText).some((f) => RE_NINO_TXT.test(f) && !RE_NINA_TXT.test(f)
    && RE_MAS_LLUVIA.test(f) && !RE_NEGADO.test(f));
  if (!malSigno) return { text: responseText, modified: false, reason: null };
  const base = detectEnsoSiembraIntent(userMessage || '');
  /** @type {ReturnType<typeof detectEnsoSiembraIntent>} */
  const intent = base.isEnso
    ? { ...base, fase: 'nino' }
    : { isEnso: true, fase: 'nino', region, lugar: lugarNombrado(userMessage || ''), cultivo: cultivoNombrado(userMessage || '') };
  return { text: buildEnsoSiembraResponse(intent).content, modified: true, reason: 'enso_signo_lluvia' };
}

const RE_ONI = /\bONI\b[^.\n]*\d/;
const RE_BOLETIN_FECHADO = /bolet[ií]n[^.\n]*(\d{1,2} de [a-záéíóú]+ de \d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i;

/**
 * Quita las frases que dan un ONI sin citar un boletín con fecha.
 * @param {string} responseText
 * @returns {{ text: string, modified: boolean, reason: string|null }}
 */
export function guardOniSinBoletin(responseText) {
  if (typeof responseText !== 'string' || !RE_ONI.test(responseText)) {
    return { text: responseText, modified: false, reason: null };
  }
  let quitadas = 0;
  const lineas = responseText.split('\n').map((linea) => {
    if (!RE_ONI.test(linea)) return linea;
    const partes = segmentarOraciones(linea);
    const keep = partes.filter((f) => !RE_ONI.test(f) || RE_BOLETIN_FECHADO.test(f));
    quitadas += partes.length - keep.length;
    return keep.join(' ');
  });
  if (quitadas === 0) return { text: responseText, modified: false, reason: null };
  const limpio = lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text: `${limpio}\n\n${BOLETIN}`.trim(), modified: true, reason: 'oni_sin_boletin' };
}

export default { detectEnsoSiembraIntent, buildEnsoSiembraResponse, guardEnsoLluviaSigno, guardOniSinBoletin, regionFromText };
