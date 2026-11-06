/**
 * ensoService — fase del Fenómeno del Niño / Oscilación del Sur (ENSO).
 *
 * GR-9 (auditoría 2026-06-10): fuente ÚNICA de la fase ENSO para toda la app.
 * Antes el motor offline (fenología/tareas/alertas) usaba una fase MANUAL en
 * localStorage mientras el chat usaba la fase VIVA del sidecar (NOAA/IDEAM) —
 * podían contradecirse. Ahora la prioridad es:
 *
 *   1. OVERRIDE MANUAL (setEnsoPhase) — si el operador/usuario fijó una fase a
 *      mano, esa gana (útil sin conexión o si NOAA falla).
 *   2. SNAPSHOT VIVO cacheado — climaService alimenta recordLiveEnsoStatus()
 *      en cada fetch exitoso del sidecar; persiste en localStorage para que el
 *      motor offline lo use sin red. TTL 60 días (ENSO cambia a escala mensual;
 *      más viejo que eso ya no es confiable). El RÓTULO de la fuente distingue
 *      copia fresca ('live', «En vivo») de copia guardada ('cached', «Copia
 *      guardada del …»): una copia de hace 8 días no puede decir "En vivo".
 *   3. 'neutral' explícito — sin red y sin caché, nunca un valor fantasma.
 *
 * El path del chat (climaService → buildClimaContext) usa applyEnsoOverride()
 * para que el override manual también gobierne lo que ve el agente: offline y
 * chat reportan SIEMPRE la misma fase.
 *
 * La consumen climateCycleService (tareas preventivas y recálculo de
 * fenología), cropAlertEngine (alerta de temporada) y climaService (chat).
 */
const MANUAL_KEY = 'chagra:enso:phase';
const LIVE_KEY = 'chagra:enso:live-v1';
const LIVE_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 días
// Ventana para llamarse "en vivo" (rótulo de la fuente). El consenso ENSO se
// actualiza a escala mensual, así que una copia de la misma semana sigue
// sirviendo — pero decir "En vivo" sobre una copia de hace 8 días es mentir
// (captura de prod 23-sep-2026: «En vivo» junto a «Fecha del snapshot:
// 15 de septiembre»). Pasadas 24 h sin poder refrescar, el dato no es "ahora":
// es una copia guardada que sigue siendo válida (dentro del TTL de 60 días).
const LIVE_FRESH_MS = 24 * 60 * 60 * 1000; // 24 horas

export const ENSO_PHASES = Object.freeze(['neutral', 'el_nino', 'la_nina']);
export const ENSO_LABELS = Object.freeze({ neutral: 'Neutral', el_nino: 'El Niño', la_nina: 'La Niña' });
// Forma que espera climateCycleService.getEnsemblePreventiveTasks.
const ENSO_SERVICE_PHASE = Object.freeze({ neutral: null, el_nino: 'el_nino', la_nina: 'la_nina' });
// Fase coarse → slug estilo sidecar (ensoFamily de ensoContext hace startsWith).
const COARSE_TO_LIVE_SLUG = Object.freeze({ neutral: 'neutral', el_nino: 'nino', la_nina: 'nina' });

/**
 * Normaliza un slug de fase del sidecar (nino_fuerte, nina_debil, neutral...)
 * o coarse (el_nino, la_nina) a la fase coarse de este servicio. Devuelve null
 * si no es reconocible (cero fabricación).
 */
function toCoarsePhase(phase) {
  if (typeof phase !== 'string') return null;
  if (phase === 'neutral') return 'neutral';
  if (phase === 'el_nino' || phase.startsWith('nino')) return 'el_nino';
  if (phase === 'la_nina' || phase.startsWith('nina')) return 'la_nina';
  return null;
}

/** Fase manual fijada por el operador, o null si no hay override. */
function readManualPhase() {
  try {
    const v = localStorage.getItem(MANUAL_KEY);
    if (ENSO_PHASES.includes(v)) return v;
  } catch { /* SSR/test sin localStorage */ }
  return null;
}

/**
 * Entrada viva cacheada, o null si no hay caché válido o venció (TTL 60 días).
 * Devuelve { phase (coarse), ts, label } para que el rótulo de la fuente pueda
 * distinguir copia fresca de copia guardada.
 */
function readLiveEntry() {
  try {
    const raw = localStorage.getItem(LIVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > LIVE_TTL_MS) return null;
    const phase = toCoarsePhase(parsed.phase);
    if (!phase) return null;
    return { phase, ts: parsed.ts, label: typeof parsed.label === 'string' ? parsed.label : null };
  } catch { /* corrupto/SSR */ }
  return null;
}

/** Fase viva cacheada (coarse), o null si no hay caché válido o venció. */
function readLivePhase() {
  return readLiveEntry()?.phase ?? null;
}

/**
 * Alimenta el caché vivo desde el `enso_status` del snapshot del sidecar
 * (NOAA/IDEAM). La llama climaService en cada fetch exitoso. Ignora entradas
 * no reconocibles sin crashear ni envenenar el caché.
 */
export function recordLiveEnsoStatus(ensoStatus) {
  if (!ensoStatus || typeof ensoStatus !== 'object') return;
  const coarse = toCoarsePhase(ensoStatus.phase);
  if (!coarse) return;
  try {
    localStorage.setItem(LIVE_KEY, JSON.stringify({
      phase: ensoStatus.phase,
      label: typeof ensoStatus.label === 'string' ? ensoStatus.label : null,
      ts: Date.now(),
    }));
  } catch { /* cuota llena/privacy mode */ }
}

/**
 * Fase efectiva ('neutral' | 'el_nino' | 'la_nina').
 * Prioridad: override manual > snapshot vivo cacheado > 'neutral'.
 */
export function getEnsoPhase() {
  return readManualPhase() ?? readLivePhase() ?? 'neutral';
}

/**
 * De dónde salió la fase efectiva:
 *   'manual'  — override manual (gana siempre).
 *   'live'    — snapshot vivo cacheado FRESCO (refrescado dentro de
 *               LIVE_FRESH_MS): puede decirse «En vivo».
 *   'cached'  — copia guardada válida pero vencida como "en vivo" (dentro del
 *               TTL de 60 días, fuera de la ventana fresca): el rótulo debe
 *               decir «Copia guardada del …», nunca «En vivo». La fecha para
 *               ese rótulo la da getEnsoCachedAt().
 *   'default' — sin red y sin caché: valor base neutral.
 */
export function getEnsoPhaseSource() {
  if (readManualPhase()) return 'manual';
  const entry = readLiveEntry();
  if (!entry) return 'default';
  return Date.now() - entry.ts <= LIVE_FRESH_MS ? 'live' : 'cached';
}

/**
 * Fecha de la copia guardada del snapshot vivo (Date), o null si no hay caché
 * válido. Para el rótulo «Copia guardada del 15 de sept.» de la UI: una copia
 * vieja no puede etiquetarse «En vivo».
 */
export function getEnsoCachedAt() {
  const entry = readLiveEntry();
  if (!entry) return null;
  const date = new Date(entry.ts);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Fija el override manual (gana sobre el vivo hasta clearEnsoPhase). */
export function setEnsoPhase(phase) {
  try {
    if (ENSO_PHASES.includes(phase)) localStorage.setItem(MANUAL_KEY, phase);
  } catch { /* SSR/test */ }
}

/** Quita el override manual: vuelve al snapshot vivo cacheado (o neutral). */
export function clearEnsoPhase() {
  try {
    localStorage.removeItem(MANUAL_KEY);
  } catch { /* SSR/test */ }
}

/** Etiqueta humana de la fase efectiva. */
export function getEnsoLabel() {
  return ENSO_LABELS[getEnsoPhase()] || 'Neutral';
}

/** Valor de fase en el formato que consume climateCycleService (null si neutral). */
export function getEnsoServicePhase() {
  return ENSO_SERVICE_PHASE[getEnsoPhase()] || null;
}

/**
 * Aplica el override manual al `enso_status` vivo del snapshot (path del chat).
 *
 * - Sin override → devuelve el objeto vivo INTACTO (misma referencia, conserva
 *   intensidad granular, ONI, fuentes).
 * - Override en la MISMA familia que el vivo → también intacto (el vivo trae
 *   más detalle real y no se contradicen).
 * - Override distinto → la fase efectiva es la manual, marcada con
 *   `phase_source: 'manual'` y etiqueta explícita; los datos observados reales
 *   (ONI, tendencia, fuentes) se conservan tal cual — no se fabrica nada.
 */
export function applyEnsoOverride(ensoStatus) {
  const manual = readManualPhase();
  if (!manual) return ensoStatus ?? null;
  const live = ensoStatus && typeof ensoStatus === 'object' ? ensoStatus : null;
  if (live && toCoarsePhase(live.phase) === manual) return live;
  return {
    ...(live || {}),
    phase: COARSE_TO_LIVE_SLUG[manual],
    label: `${ENSO_LABELS[manual]} (fase fijada manualmente)`,
    severity: manual === 'neutral' ? 'neutral' : 'info',
    phase_source: 'manual',
  };
}
