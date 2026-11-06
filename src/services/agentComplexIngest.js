/**
 * agentComplexIngest — descompone registros de campo con varias acciones.
 *
 * Esta primera ruta es deliberadamente determinista: reconoce una ESTRUCTURA
 * fija (siembra + lote + antigüedad + cosechas + cadencia de abono + lista de
 * problemas) pero NO un vocabulario cerrado — el cultivo, las cantidades, los
 * tiempos y los nombres de plaga/enfermedad se extraen del texto, cualquiera
 * que sean (D-07: antes exigía literalmente "tomate cherry" y exactamente
 * "trozador"/"gota"). No consulta el sidecar ni cambia datos por sí misma.
 * Quien integra la UI pasa cada propuesta a actionExecutor después de que el
 * operador la confirme.
 */
import { toISODateTime } from '../utils/dateFormatter';
import { createLote, listLotes } from './loteService';
import { createFarmProcess, recordFarmEvent } from './farmEventService';
import { newUlid } from '../utils/id';

const NUMBER_WORDS = {
  un: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
};

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const readNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NUMBER_WORDS[normalizeText(value)] || null;
};

/**
 * Palabras cuya presencia en el nombre de un problema lo clasifica como
 * ENFERMEDAD en vez de PLAGA. Lista conservadora de síndromes/patógenos
 * comunes en el campo colombiano; cualquier nombre que no matchee se
 * etiqueta 'plaga' por defecto (igual que el comportamiento previo para
 * "trozador"). Sirve solo para la ETIQUETA mostrada al operador — nunca
 * para decidir si el problema se reconoce o no.
 */
const DISEASE_KEYWORDS = [
  'gota', 'mildeo', 'roya', 'tizon', 'mancha', 'pudricion', 'moho',
  'virus', 'mosaico', 'antracnosis', 'marchitez', 'oidio', 'fusarium',
  'rizoctonia', 'fitoftora', 'phytophthora', 'botritis', 'sarna', 'costra', 'clorosis',
];

/** Clasifica un nombre de problema (ya normalizado) como 'plaga' o 'enfermedad'. */
function classifyProblemType(name) {
  return DISEASE_KEYWORDS.some((keyword) => name.includes(keyword)) ? 'enfermedad' : 'plaga';
}

/** Separa una lista de nombres de problema unidos por coma/"+"/"&"/"y (de)". */
function splitProblemNames(raw) {
  return raw
    .split(/\s*(?:,|\+|&| y de | y )\s*/)
    .map((piece) => piece.replace(/^de\s+/, '').trim())
    .filter(Boolean);
}

/**
 * Extrae la lista de problemas (plaga/enfermedad) mencionados, SIN vocabulario
 * cerrado: reconoce cualquier nombre que aparezca en la cláusula "problema(s)
 * de X y de Y" (forma larga) o como lista final separada por coma con "+"/"&"
 * y sin la palabra "problema" (forma corta de campo, ej. "trozador+gota").
 * Devuelve [] si no encuentra ninguna de las dos formas — nunca inventa un
 * problema que el texto no nombra.
 */
function extractProblems(normalized) {
  const longForm = normalized.match(/problemas?\s+de\s+([a-zñ0-9+&,\s]+?)(?:\.|$)/);
  let raw = longForm ? longForm[1] : null;

  if (!raw) {
    const segments = normalized.split(',').map((segment) => segment.trim()).filter(Boolean);
    const last = segments[segments.length - 1] || '';
    if (/^[a-zñ]+(?:\s*[+&]\s*[a-zñ]+)*$/.test(last)) raw = last;
  }
  if (!raw) return [];

  return splitProblemNames(raw).map((name) => ({ name, problem_type: classifyProblemType(name) }));
}

/** Pregunta de seguimiento nombrando los problemas realmente detectados. */
function buildTreatmentFollowUp(problems) {
  const names = problems.map((problem) => problem.name).join(' y ');
  return `¿quieres contarme qué tratamiento seguiste para ${names}?`;
}

const TOMATE_CHERRY_SLUG = 'solanum_lycopersicum';

/**
 * Deriva el slug de especie para el FarmProcess a partir del cultivo ya
 * extraído del texto (normalizado). Conserva el slug conocido para el caso
 * histórico de "tomate cherry"; para cualquier otro cultivo usa un slug
 * genérico derivado del nombre (evita etiquetar como tomate un FarmProcess de
 * lechuga, papa o cualquier otro cultivo generalizado por D-07).
 */
function deriveCropSlug(cropLabel) {
  const normalized = String(cropLabel || '').trim();
  if (normalized === 'tomate cherry') return TOMATE_CHERRY_SLUG;
  return normalized.replace(/\s+/g, '_');
}

/** Resta meses de calendario sin asumir que todos duran 30 días. */
function subtractCalendarMonths(date, months) {
  const input = new Date(date);
  const originalDay = input.getUTCDate();
  input.setUTCDate(1);
  input.setUTCMonth(input.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth() + 1, 0)).getUTCDate();
  input.setUTCDate(Math.min(originalDay, lastDay));
  return input;
}

/**
 * Reparte las cosechas históricas entre la siembra y hoy (ni todas hoy, ni
 * antes de sembrar), y fecha el abono en su primera aplicación (siembra +
 * intervalo). Las observaciones de plaga/enfermedad quedan a `now` porque el
 * operador las reporta como estado ACTUAL, no histórico.
 *
 * @param {{seedingTimestamp:string, harvestCount:number, intervalDays:number}} extracted
 * @param {Date|number|string} now
 * @returns {{harvestTimestamps:string[], fertilizerTimestamp:string}}
 */
function distributeHistoricalTimestamps(extracted, now) {
  const seedingMs = new Date(extracted.seedingTimestamp).getTime();
  const nowMs = new Date(now).getTime();
  const spanMs = Math.max(nowMs - seedingMs, 0);
  const harvestTimestamps = Array.from({ length: extracted.harvestCount }, (_, index) => {
    const fraction = (index + 1) / (extracted.harvestCount + 1);
    return toISODateTime(new Date(seedingMs + spanMs * fraction));
  });
  const fertilizerTimestamp = toISODateTime(new Date(seedingMs + extracted.intervalDays * 24 * 60 * 60 * 1000));
  return { harvestTimestamps, fertilizerTimestamp };
}

function makeOperation(kind, toolName, parameters, originalText) {
  return {
    kind,
    tool_name: toolName,
    parameters,
    requiresConfirmation: true,
    proposal: {
      tool_name: toolName,
      parameters,
      operation_kind: kind,
      intent: originalText,
      llm_response: '',
      timestamp: new Date().toISOString(),
    },
  };
}

function extractCaseOne(text, now) {
  const normalized = normalizeText(text);
  const seeding = normalized.match(/sembr(?:e|o|amos|ar)\s+(\d+|[a-zñ]+)\s+([a-zñ]+(?:\s+[a-zñ]+){0,2}?)\s+en\s+(?:el\s+)?(?:surco|lote)\b/);
  const land = normalized.match(/(?:surco|lote)\s*(?:numero\s*)?(\d+)\b/);
  const monthsAgo = normalized.match(/hace\s+(\d+)\s+mes(?:es)?\b/);
  const harvest = normalized.match(/(?:entreg(?:ue|o)|registr(?:e|o)|tuve\s+|ya\s+)?(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+cosechas?\b/);
  const cadence = normalized.match(/(?:abon(?:e|o)?\s+(?:cada\s+)?(\d+)\s+dias?|abono\s+c\s*\/\s*(\d+)\s*d(?:ias?)?)\b/);
  const treatmentMentioned = /trat(?:e|o|amos|amiento)|apliqu|fumigu|fumig|control(?:e|o)/.test(normalized);
  const problems = extractProblems(normalized);

  if (!seeding || !land || !monthsAgo || !harvest || !cadence || problems.length === 0) return null;

  const quantity = readNumber(seeding[1]);
  const harvestCount = readNumber(harvest[1]);
  const intervalDays = readNumber(cadence[1] || cadence[2]);
  const months = readNumber(monthsAgo[1]);
  if (!quantity || !harvestCount || !intervalDays || !months) return null;

  return {
    crop: seeding[2],
    quantity,
    landReference: land[1],
    seedingTimestamp: toISODateTime(subtractCalendarMonths(now, months)),
    harvestCount,
    intervalDays,
    problems,
    treatmentMentioned,
  };
}

/**
 * Detecta el Caso 1 y produce el plan confirmado de operaciones. El contrato
 * es estable para que AgentScreen lo pueda consultar ANTES del pipeline LLM.
 *
 * @param {string} text
 * @param {{now?: Date|number|string}} [options]
 * @returns {{detected:false}|{detected:true, requiresConfirmation:true, operations:object[], followUpQuestion:string, agroecologicalSuggestion:object}}
 */
export function decomposeComplexIngest(text, options = {}) {
  if (!text || typeof text !== 'string') return { detected: false };

  const now = options.now || new Date();
  const extracted = extractCaseOne(text, now);
  if (!extracted) return { detected: false };

  const { harvestTimestamps, fertilizerTimestamp } = distributeHistoricalTimestamps(extracted, now);

  const operations = [
    makeOperation('ensure_land', 'crear_lote', {
      name: `Surco ${extracted.landReference}`,
      land_type: 'bed',
      reference: extracted.landReference,
    }, text),
    makeOperation('create_seeding', 'registrar_siembra', {
      crop: extracted.crop,
      quantity: extracted.quantity,
      land_reference: extracted.landReference,
      timestamp: extracted.seedingTimestamp,
    }, text),
    ...Array.from({ length: extracted.harvestCount }, (_, index) => makeOperation('register_harvest', 'crear_log', {
      log_type: 'log--harvest',
      land_reference: extracted.landReference,
      ordinal: index + 1,
      timestamp: harvestTimestamps[index],
      notes: `Cosecha histórica ${index + 1} de ${extracted.harvestCount} del surco ${extracted.landReference}`,
    }, text)),
    makeOperation('register_fertilizer_cadence', 'crear_log', {
      log_type: 'log--input',
      land_reference: extracted.landReference,
      interval_days: extracted.intervalDays,
      timestamp: fertilizerTimestamp,
      notes: `Abono registrado cada ${extracted.intervalDays} días en el surco ${extracted.landReference}`,
    }, text),
    ...extracted.problems.map((problem) => makeOperation('register_problem', 'crear_log', {
      log_type: 'log--observation',
      land_reference: extracted.landReference,
      ...problem,
      treatment_applied: extracted.treatmentMentioned,
      treatment_status: extracted.treatmentMentioned ? 'incomplete' : 'missing',
      notes: extracted.treatmentMentioned
        ? `${problem.problem_type}: ${problem.name}. Se mencionó tratamiento, sin detalle.`
        : `${problem.problem_type}: ${problem.name}. No se informó tratamiento.`,
    }, text)),
  ];

  return {
    detected: true,
    requiresConfirmation: true,
    operations,
    followUpQuestion: buildTreatmentFollowUp(extracted.problems),
    agroecologicalSuggestion: {
      crop: extracted.crop,
      problems: extracted.problems,
      land_reference: extracted.landReference,
    },
  };
}

/**
 * Etiqueta humana de una operación del plan, compartida por el mensaje de
 * resumen de AgentScreen y por el gate de confirmación (ActionConfirmModal),
 * para que el operador lea «la cosecha 2» y no un volcado JSON crudo.
 *
 * Control negativo: un kind desconocido devuelve el kind tal cual (nunca
 * inventa una etiqueta) y una operación inválida devuelve undefined sin
 * lanzar, para que el modal nunca quede en blanco por un plan parcial.
 *
 * @param {{kind?: string, parameters?: object}|null|undefined} operation
 * @returns {string|undefined}
 */
export function describeComplexIngestOperation(operation) {
  switch (operation?.kind) {
    case 'ensure_land': return 'el surco';
    case 'create_seeding': return 'la siembra retrofechada';
    case 'register_harvest': return `la cosecha ${operation?.parameters?.ordinal}`;
    case 'register_fertilizer_cadence': return `el abono cada ${operation?.parameters?.interval_days} días`;
    case 'register_problem': return `la observación de ${operation?.parameters?.name}`;
    default: return operation?.kind;
  }
}

/**
 * Ejecuta secuencialmente propuestas ya confirmadas a través del executor
 * existente. La UI conserva el gate porque cada propuesta lleva la marca de
 * confirmación y `executeAction` abre el modal para sus herramientas write.
 *
 * @param {ReturnType<typeof decomposeComplexIngest>} plan
 * @param {{operatorId?:string, execute?:(proposal:object, operatorId:string)=>Promise<object>}} [options]
 */
export async function executeComplexIngest(plan, { operatorId, execute } = {}) {
  if (!plan?.detected || !Array.isArray(plan.operations)) {
    return { status: 'ignored', executed: 0, failed: 0, results: [] };
  }
  if (typeof execute !== 'function') throw new TypeError('executeComplexIngest requiere un executor');

  const results = [];
  for (const operation of plan.operations) {
    const result = await execute(operation.proposal, operatorId);
    results.push({ operation, result });
    // No continuar con operaciones que dependen del mismo lote si el
    // operador rechazó o el executor no logró ejecutar una propuesta.
    if (result?.status !== 'executed') break;
  }

  const failed = results.filter(({ result }) => result?.status === 'failed').length;
  const rejected = results.filter(({ result }) => result?.status === 'rejected').length;
  return {
    status: failed || rejected ? 'partial' : 'executed',
    executed: results.filter(({ result }) => result?.status === 'executed').length,
    failed,
    rejected,
    results,
  };
}

const EVENT_SOURCE = 'operator';
const AI_METADATA = {
  source: 'agent-complex-ingest',
  model_version: 'deterministic-rules-v1',
  confidence: 1,
  needs_human_review: false,
};

/**
 * Persiste una ingesta ya aprobada usando las puertas de escritura existentes.
 * La función mantiene el contexto generado por la operación de lote y no muta
 * ningún Asset directamente: el lote pasa por createLote y el ciclo/eventos por
 * createFarmProcess y recordFarmEvent.
 *
 * @param {ReturnType<typeof decomposeComplexIngest>} plan
 * @param {{operatorId?: string, now?: number}} [options]
 * @returns {Promise<{status:string, executed:number, failed:number, results:object[], processId?:string, landId?:string}>}
 */
export async function persistComplexIngest(plan, { operatorId = 'operator', now = Date.now() } = {}) {
  if (!plan?.detected || !Array.isArray(plan.operations)) {
    return { status: 'ignored', executed: 0, failed: 0, results: [] };
  }

  const context = { landId: null, processId: null };
  const results = [];
  for (const operation of plan.operations) {
    try {
      let result;
      let txId;
      const params = operation.parameters || {};
      if (operation.kind === 'ensure_land') {
        // D-12: reutilizar el surco si ya existe en la finca activa — repetir
        // el mismo mensaje no debe dejar dos "Surco 12". Solo se encola un
        // txId propio cuando REALMENTE se crea algo nuevo; el reusado ya
        // pasó (o está pasando) su propio ciclo de sync.
        const existing = (await listLotes()).find((lote) => (lote.attributes?.name || lote.name) === params.name);
        if (existing) {
          result = existing;
          context.landId = existing.id;
        } else {
          result = await createLote({ name: params.name, landType: params.land_type || 'bed' });
          context.landId = result.id;
          txId = context.landId;
        }
      } else if (operation.kind === 'create_seeding') {
        // La anotación conserva el literal 'farm_process' en `type` (sin ella
        // tsc lo ensancha a string y FarmProcess exige el literal).
        /** @type {import('../types/farmProcess').FarmProcess} */
        const process = {
          process_id: newUlid(),
          type: 'farm_process',
          attributes: {
            process_type: 'sowing',
            subject_kind: 'aggregate',
            subject_slug: deriveCropSlug(params.crop),
            subject_label: params.crop,
            quantity: params.quantity,
            unit: 'plantas',
            location_land_asset_id: context.landId,
            status: 'active',
            current_stage: 'sowing_confirmed',
            created_at: Date.parse(params.timestamp) || now,
            updated_at: now,
          },
        };
        // D-02: la planta (vía el log--seeding inline) no puede salir a farmOS
        // antes que el surco del que cuelga — depende del tx del surco.
        const created = await createFarmProcess(process, {
          awaitSync: true,
          txId: process.process_id,
          dependsOn: context.landId ? [context.landId] : undefined,
        });
        context.processId = process.process_id;
        txId = process.process_id;
        result = created;
      } else if (!context.processId) {
        throw new Error(`No hay ciclo para la operación ${operation.kind}`);
      } else if (operation.kind === 'register_harvest') {
        txId = `complex:${context.processId}:harvest:${params.ordinal}`;
        result = await recordFarmEvent({
          process_id: context.processId,
          event_type: 'harvest_confirmed',
          occurred_at: Date.parse(params.timestamp) || now,
          actor: operatorId,
          source: EVENT_SOURCE,
          idempotency_key: txId,
          tx_id: txId,
          depends_on: [context.processId],
          payload: {
            ordinal: params.ordinal,
            land_reference: params.land_reference,
            land_asset_id: context.landId,
          },
          await_sync: true,
        });
      } else if (operation.kind === 'register_fertilizer_cadence') {
        txId = `complex:${context.processId}:fertilizer:${params.interval_days}`;
        result = await recordFarmEvent({
          process_id: context.processId,
          event_type: 'task_completed',
          occurred_at: Date.parse(params.timestamp) || now,
          actor: operatorId,
          source: EVENT_SOURCE,
          idempotency_key: txId,
          tx_id: txId,
          depends_on: [context.processId],
          payload: {
            completed_task: 'abono',
            interval_days: params.interval_days,
            land_reference: params.land_reference,
            text: params.notes,
          },
          await_sync: true,
        });
      } else if (operation.kind === 'register_problem') {
        txId = `complex:${context.processId}:problem:${params.name}`;
        result = await recordFarmEvent({
          process_id: context.processId,
          event_type: 'observation',
          occurred_at: now,
          actor: operatorId,
          source: EVENT_SOURCE,
          idempotency_key: txId,
          tx_id: txId,
          depends_on: [context.processId],
          payload: {
            text: params.notes,
            problem_type: params.problem_type,
            name: params.name,
            treatment_applied: params.treatment_applied,
            treatment_status: params.treatment_status,
            land_reference: params.land_reference,
            metadata: { ai: { ...AI_METADATA, reasoning: 'clasificación por término explícito del operador' } },
          },
          await_sync: true,
        });
      } else {
        throw new Error(`Operación no soportada: ${operation.kind}`);
      }
      results.push({ operation, result, status: 'executed', ...(txId ? { txId } : {}) });
    } catch (error) {
      results.push({ operation, status: 'failed', error: error?.message || 'fallo de persistencia' });
      break;
    }
  }

  const failed = results.filter((item) => item.status === 'failed').length;
  return {
    status: failed ? 'partial' : 'executed',
    executed: results.filter((item) => item.status === 'executed').length,
    failed,
    results,
    ...(context.processId ? { processId: context.processId } : {}),
    ...(context.landId ? { landId: context.landId } : {}),
  };
}

/**
 * D-11: el "Listo, registré X" del agente afirmaba éxito con solo la escritura
 * LOCAL (IndexedDB) confirmada — nunca con lo que farmOS de verdad aceptó. Esta
 * función dispara un intento de sync real y, para cada operación de la ingesta
 * que tiene un `txId` conocido, verifica si terminó en `failed_transactions`
 * (farmOS la rechazó: 404/422/...). Las que farmOS rechaza se reclasifican de
 * 'executed' a 'rejected_by_farmos' y SALEN de `executed`/`status` — el resumen
 * que lea esto ya no puede decir "registré" de algo que farmOS tumbó.
 *
 * No hay red o farmOS todavía no respondió (offline, 5xx en reintento): la
 * operación se queda como 'executed' (persistida localmente, pendiente de
 * sincronizar) — eso siempre fue verdad y sigue siéndolo; lo que esta función
 * corrige es el RECHAZO activo, no la latencia de la cola offline-first.
 *
 * @param {Awaited<ReturnType<typeof persistComplexIngest>>} persisted
 * @returns {Promise<Awaited<ReturnType<typeof persistComplexIngest>>>}
 */
export async function confirmComplexIngestAgainstFarmOS(persisted) {
  if (!persisted || !Array.isArray(persisted.results) || typeof navigator === 'undefined') {
    return persisted;
  }

  let failedTxs = [];
  try {
    const { syncManager } = await import('./syncManager');
    await syncManager.syncAll();
    failedTxs = await syncManager.getFailedTransactions();
  } catch (_) {
    // Verificación best-effort: si el sync no se puede intentar, no inventamos
    // ni éxito ni rechazo — se deja el resultado local tal como llegó.
    return persisted;
  }

  const rejectionByTxId = new Map(failedTxs.map((tx) => [tx.original_tx_id, tx]));
  const results = persisted.results.map((item) => {
    if (item.status !== 'executed' || !item.txId || !rejectionByTxId.has(item.txId)) return item;
    const rejection = rejectionByTxId.get(item.txId);
    return {
      ...item,
      status: 'rejected_by_farmos',
      error: rejection.error_message || `farmOS rechazó la escritura (HTTP ${rejection.error_status})`,
    };
  });

  const failed = results.filter((item) => item.status === 'failed' || item.status === 'rejected_by_farmos').length;
  return {
    ...persisted,
    results,
    failed,
    executed: results.filter((item) => item.status === 'executed').length,
    status: failed ? 'partial' : 'executed',
  };
}

/**
 * Deja la recomendación para una ruta secundaria. `suggest` puede usar el
 * grafo o el LLM, pero nunca participa en la ejecución de los registros.
 */
export function scheduleAgroecologicalSuggestion(plan, suggest) {
  if (!plan?.detected || typeof suggest !== 'function') return Promise.resolve(null);
  return Promise.resolve().then(() => suggest(plan.agroecologicalSuggestion));
}

export default decomposeComplexIngest;
