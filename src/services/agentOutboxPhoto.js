/**
 * agentOutboxPhoto.js — lógica del flujo "foto del compositor → agente".
 *
 * Extraída de AgentScreen.processOutboxItem para poder testearla sin montar el
 * componente (que arrastra ~25 servicios). Aquí viven la validación del
 * resultado de visión, la construcción del prompt a partir del hallazgo y el
 * caption del usuario, y el límite de espera. El despacho real (analyzeFoliage,
 * handleSubmit, setMessages, object URLs) queda en el componente.
 *
 * Bug 2026-05-31 (operador probando el compositor EN VIVO): la foto adjuntada
 * en AgentHero NO llegaba al chat — solo el texto. Dos causas acopladas:
 *   1. La burbuja de usuario de la foto se creaba SIN la imagen (el blob se
 *      pasaba a analyzeFoliage y se descartaba; ChatBubble nunca renderizaba
 *      imagen). → fix: adjuntar imageUrl a la burbuja + ChatBubble la pinta.
 *   2. processOutboxItem empujaba una burbuja y luego handleSubmit→
 *      runAgentPipeline empujaba OTRA con el prompt sintético → duplicado y
 *      el prompt sintético se veía como si lo hubiera escrito el usuario.
 *      → fix: suppressUserBubble cuando el caller ya pintó la burbuja real.
 */

/**
 * ¿El diagnóstico de visión trae información aprovechable? (issues o
 * sugerencia de tratamiento). Tolerante a null/forma inesperada.
 * @param {object|null} finding
 * @returns {boolean}
 */
export function hasVisionFinding(finding) {
  if (
    !finding ||
    typeof finding !== 'object' ||
    finding instanceof Error ||
    'error' in finding
  ) return false;
  const hasIssues = Array.isArray(finding.issues);
  const hasTreatment =
    typeof finding.treatment_suggestion === 'string' &&
    finding.treatment_suggestion.trim().length > 0;
  return hasIssues || hasTreatment;
}

/**
 * Construye el prompt que se despacha al pipeline del agente para una foto.
 *
 * - Con diagnóstico de visión → inyecta hallazgos (issues + estado + sugerencia)
 *   como contexto para que el LLM responda aterrizado, anexando el caption.
 * - Sin diagnóstico útil → prompt conversacional que pide guía por descripción,
 *   preservando el caption si lo hubo.
 *
 * @param {object|null} finding   resultado de analyzeFoliage (o null si falló)
 * @param {string} [caption='']   nota/caption escrito por el usuario
 * @returns {string} prompt no vacío listo para handleSubmit
 */
export function buildVisionPrompt(finding, caption = '') {
  const cap = (caption || '').trim();
  if (hasVisionFinding(finding)) {
    const issues =
      Array.isArray(finding.issues) && finding.issues.length > 0
        ? finding.issues.join(', ')
        : 'sin problemas evidentes';
    const treat = finding.treatment_suggestion
      ? ` Sugerencia preliminar: ${finding.treatment_suggestion}.`
      : '';
    return `Analicé una foto que enviaste. Hallazgos del diagnóstico visual: ${issues} (estado ${
      finding.score ?? 'n/d'
    }/100).${treat} ${cap || '¿Qué me recomiendas hacer?'}`.trim();
  }
  return cap
    ? `Te envié una foto. ${cap}`
    : 'Te envié una foto para que me ayudes a identificar qué tiene. No pude obtener un diagnóstico visual automático; guíame por descripción.';
}

/**
 * Arma el payload conversacional del agente. La visión llega como un mensaje
 * de sistema separado del texto sintético del usuario para que el modelo
 * reconozca que esos hallazgos corresponden a la foto actual del turno.
 * El resultado cacheado conserva el mismo contrato; `_cached` es metadata y
 * no altera el diagnóstico.
 * @param {string} query
 * @param {string} [contextMemory='']
 * @param {{hadVision?:boolean, finding?:object|null}|null} [visionContext]
 * @returns {Array<{role:string,content:string}>}
 */
export function buildAgentMessages(query, contextMemory = '', visionContext = null) {
  const visionFinding = visionContext?.hadVision && visionContext.finding &&
    typeof visionContext.finding === 'object'
    ? visionContext.finding
    : null;
  const currentFinding = visionFinding
    ? Object.fromEntries(Object.entries(visionFinding).filter(([key]) => key !== '_cached'))
    : null;
  return [
    ...(visionFinding ? [{
      role: 'system',
      content: `RESULTADO DE LA FOTO ACTUAL DE ESTE TURNO (análisis visual):\n${JSON.stringify(currentFinding)}`,
    }] : []),
    ...(contextMemory ? [{ role: 'user', content: contextMemory }] : []),
    { role: 'user', content: query },
  ];
}

/**
 * Texto de la burbuja de usuario para una foto (el contenido textual visible).
 * La imagen va aparte en `imageUrl` del mensaje — esto es solo el caption o un
 * fallback descriptivo cuando no hay caption.
 * @param {string} [caption='']
 * @returns {string}
 */
export function photoBubbleText(caption = '') {
  const cap = (caption || '').trim();
  return cap || '📷 Foto enviada para análisis';
}

/**
 * Construye la burbuja de usuario para una foto (con imagen) a partir del blob.
 * Pura salvo por la fábrica de object URL inyectada (para testear sin DOM).
 *
 * @param {object} item                 item de la outbox (kind 'photo')
 * @param {(blob:Blob)=>string|null} createUrl  fábrica de object URL
 * @returns {{message: object, imageUrl: string|null}}
 */
export function buildPhotoUserMessage(item, createUrl) {
  const caption = (item && item.text ? item.text : '').trim();
  let imageUrl = null;
  if (item && item.blob && typeof createUrl === 'function') {
    try {
      imageUrl = createUrl(item.blob) || null;
    } catch {
      imageUrl = null;
    }
  }
  const message = {
    role: 'user',
    content: photoBubbleText(caption),
    timestamp: Date.now(),
    _outboxPhoto: true,
    ...(imageUrl ? { imageUrl, imageAlt: 'Foto de tu planta enviada al agente' } : {}),
  };
  return { message, imageUrl };
}

/**
 * Orquesta el procesamiento PURO de un item de foto: corre la visión y arma
 * el prompt + la burbuja de usuario con imagen. NO toca React ni IndexedDB —
 * recibe `analyze` (analyzeFoliage) y `createUrl` inyectados para ser testeable.
 *
 * Garantiza:
 *  - la burbuja SIEMPRE lleva la imagen si el blob existe (bug foto 2026-05-31);
 *  - la visión SIEMPRE se intenta cuando hay blob (analyzeFoliage), y si falla
 *    se degrada a prompt por descripción (no rompe el flujo);
 *  - respuestas sin un hallazgo utilizable quedan marcadas como análisis fallido;
 *  - el prompt resultante nunca es vacío.
 *
 * @param {object} item                          item outbox (kind 'photo')
 * @param {{analyze:(b:Blob)=>Promise<any>, createUrl:(b:Blob)=>string|null}} opts
 * @returns {Promise<{message:object, prompt:string, finding:any, imageUrl:string|null, analysisFailed:boolean}>}
 */
export async function processPhotoItem(item, opts = /** @type {any} */ ({})) {
  const { analyze, createUrl } = opts;
  const caption = (item && item.text ? item.text : '').trim();
  const { message, imageUrl } = buildPhotoUserMessage(item, createUrl);
  let finding = null;
  if (item && item.blob && typeof analyze === 'function') {
    try {
      const result = await analyze(item.blob);
      finding = hasVisionFinding(result) ? result : null;
    } catch {
      finding = null;
    }
  }
  const prompt = buildVisionPrompt(finding, caption);
  return { message, prompt, finding, imageUrl, analysisFailed: !hasVisionFinding(finding) };
}

/**
 * Procesa una foto con un límite que protege el cierre del turno. La visión es
 * una mejora del prompt, no una condición para que el operador recupere el
 * compositor: si el modelo o la red no terminan, seguimos con la nota que sí
 * escribió la persona.
 *
 * `onTimeout` permite al caller abortar el fetch de visión. La carrera sigue
 * siendo necesaria porque una implementación externa de `analyze` podría no
 * respetar AbortSignal.
 *
 * @param {object} item
 * @param {{analyze:(b:Blob)=>Promise<any>, createUrl:(b:Blob)=>string|null, timeoutMs?:number, onTimeout?:()=>void}} opts
 * @returns {Promise<{message:object, prompt:string, finding:any, imageUrl:string|null, timedOut:boolean, analysisFailed:boolean}>}
 */
export async function processPhotoItemBounded(item, opts = /** @type {any} */ ({})) {
  const timeoutMs = Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0
    ? opts.timeoutMs
    : 90_000;
  let timeoutId;
  const fallback = () => {
    try {
      opts.onTimeout?.();
    } catch (_) {
      // El cierre de turno no depende de que el abort del transporte funcione.
    }
    const { message, imageUrl } = buildPhotoUserMessage(item, opts.createUrl);
    return {
      message,
      imageUrl,
      finding: null,
      prompt: buildVisionPrompt(null, item?.text || ''),
      timedOut: true,
      analysisFailed: true,
    };
  };

  try {
    return await Promise.race([
      processPhotoItem(item, opts).then((result) => ({ ...result, timedOut: false })),
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback()), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}
