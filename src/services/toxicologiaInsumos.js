/**
 * toxicologiaInsumos.js — Deriva la ficha toxicológica de un insumo/biopreparado
 * a partir de los datos REALES del catálogo (catalog/biopreparados-seed.json,
 * cargado en runtime vía getAllBiopreparados()). NO inventa toxicidad ni dosis.
 *
 * Campos de origen en el catálogo:
 *   - precaucion_seguridad: texto libre con la advertencia (incluye "TOXICOLOGIA
 *     COBRE/AZUFRE", "EPI: guantes, careta...", "metal pesado", límite de
 *     cobre en producción ecológica certificada, etc. para los casos críticos).
 *   - dosis / dosis_aplicacion: dosis seguras de aplicación.
 *   - fuente / source_ids / confianza: trazabilidad de la fuente.
 *
 * Reglas anti-alucinación:
 *   - Si el insumo NO trae precaucion_seguridad, su nivel queda como
 *     'sin_dato' → la UI muestra "sin dato, manejar con precaución", nunca
 *     "no es tóxico".
 *   - El nivel y el EPI se DERIVAN del texto real (palabras clave), no se
 *     asignan a dedo. Si el texto no menciona un EPI, no lo afirmamos.
 *
 * RA5 2026-10-24 (RECETAS-01): la SQLite servida trae `safety_class` y
 * `ppe_required` para los 36 insumos pero deja `precaucion_seguridad` vacía en
 * bordelés, sulfocálcico, mojante JADAM y vinagre de madera. Adivinar el nivel
 * por palabras dejaba 0 de 36 en «Toxicidad alta». Ahora mandan los campos
 * estructurados del catálogo (con la misma regla de estiércol que la pantalla
 * de Biopreparados); las palabras clave solo deciden cuando no hay
 * `safety_class`, y la prosa que falte se toma del seed heredado, igual que
 * hace BiopreparadosScreen.
 */

import biopreparadosSeguridad from '../../catalog/biopreparados-seed.json';
import { seguridadEfectiva, PPE_LABEL, DO_NOT_USE_LABEL } from '../data/biopreparadosFichas';

const PRECAUCION_HEREDADA = new Map(
  (biopreparadosSeguridad?.biopreparados || []).map((bp) => [bp.id, bp.precaucion_seguridad]),
);

/** Prosa de seguridad: la del catálogo, o la del seed heredado si falta. */
export function precaucionDe(bp) {
  const propia = bp?.precaucion_seguridad?.trim();
  if (propia) return propia;
  const heredada = PRECAUCION_HEREDADA.get(bp?.id)?.trim();
  return heredada || null;
}

const NIVELES_CATALOGO = new Set(['alto', 'medio', 'bajo']);

const norm = (s) => (s || '')
  .toString()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '');

/**
 * Detecta el EPI mencionado explícitamente en el texto de seguridad.
 * Solo devuelve un EPI si el texto lo nombra (no se asume).
 */
export function detectarEPI(textoSeguridad) {
  const t = norm(textoSeguridad);
  const epi = [];
  if (/\bguantes?\b/.test(t)) epi.push({ id: 'guantes', label: 'Guantes' });
  if (/\bcareta|mascarilla|respirador|tapabocas\b/.test(t)) {
    epi.push({ id: 'careta', label: 'Careta o tapabocas' });
  }
  if (/\bgafas|antiparras|proteccion (de |para )?(los )?ojos\b/.test(t)) {
    epi.push({ id: 'gafas', label: 'Gafas de protección' });
  }
  if (/al aire libre|ventilad|ventilacion/.test(t)) {
    epi.push({ id: 'ventilacion', label: 'Trabajar al aire libre / ventilado' });
  }
  return epi;
}

/**
 * Deriva el nivel de toxicidad a partir del texto real de precaución.
 * Devuelve uno de: 'alto' | 'medio' | 'bajo' | 'sin_dato'.
 */
export function nivelToxicidad(bp) {
  const textual = nivelPorTexto(precaucionDe(bp));
  if (NIVELES_CATALOGO.has(bp?.safety_class)) {
    const { safetyClass } = seguridadEfectiva(bp);
    // El texto solo puede subir el nivel (metal pesado, EPI obligatorio), nunca bajarlo.
    return textual === 'alto' ? 'alto' : safetyClass;
  }
  return textual;
}

/** Nivel adivinado por palabras clave; solo se usa sin `safety_class`. */
function nivelPorTexto(ps) {
  if (!ps || !ps.trim()) return 'sin_dato';
  const t = norm(ps);

  // ALTO: metales pesados / azufre con EPI obligatorio / restricción legal.
  if (
    /metal pesado/.test(t)
    || /toxicologia (cobre|azufre)/.test(t)
    || /resolucion ica/.test(t)
    || /\bepi\b/.test(t)
    || (/careta/.test(t) && /irritante|corrosivo|vapores/.test(t))
  ) {
    return 'alto';
  }

  // MEDIO: riesgo sanitario, irritante, alcalino, fitotoxicidad por exceso.
  if (
    /riesgo sanitario/.test(t)
    || /irritante|corrosivo|alcalin|quema/.test(t)
    || /fitotoxic|acumulacion de cobre|sulfatos minerales/.test(t)
    || /patogen/.test(t)
  ) {
    return 'medio';
  }

  // BAJO: el texto lo dice explícitamente.
  if (/bajo riesgo/.test(t)) return 'bajo';

  // Hay texto pero no encaja en patrones → tratar como medio (conservador).
  return 'medio';
}

/** Detecta si hay una restricción legal citable (ICA) en el texto. */
export function restriccionLegal(bp) {
  const t = norm(precaucionDe(bp));
  // RA4 2026-10-12 (S11): la Res. ICA 698/2011 regulaba el registro de
  // bioinsumos, no la certificación orgánica (la re-auditoría la da por
  // derogada en lo pertinente por la 68370/2020, art. 30; no se verificó aquí). Sin la norma vigente con artículo en el catálogo,
  // no se cita ninguna.
  if (/698\/2011|resolucion ica 698|certificacion organica|produccion ecologica/.test(t)) {
    return 'El cobre tiene límite en la producción ecológica certificada. Consulte a su certificadora '
      + 'la norma vigente: el catálogo no tiene esa norma con su artículo.';
  }
  if (/resolucion ica/.test(t)) {
    return 'Sujeto a normativa ICA — consulta la resolución vigente para uso y límites.';
  }
  return null;
}

export const NIVEL_TOX_META = {
  alto: {
    label: 'Toxicidad alta',
    color: 'red',
    icono: '☠️',
    resumen: 'EPI obligatorio y precauciones estrictas. Puede tener restricciones legales.',
  },
  medio: {
    label: 'Toxicidad media',
    color: 'amber',
    icono: '⚠️',
    resumen: 'Manéjalo con cuidado: usa la protección indicada y respeta la dosis.',
  },
  bajo: {
    label: 'Toxicidad baja',
    color: 'emerald',
    icono: '🟢',
    resumen: 'Bajo riesgo, pero siempre con higiene básica (lavado de manos).',
  },
  sin_dato: {
    label: 'Sin dato — manejar con precaución',
    color: 'slate',
    icono: '❔',
    resumen:
      'Este insumo no tiene advertencia toxicológica registrada en el catálogo. '
      + 'No quiere decir que sea inofensivo: manéjalo con precaución y consulta a un técnico.',
  },
};

/** Qué EPI del texto ya queda cubierto por uno de `ppe_required`. */
const EPI_TEXTO_CUBIERTO_POR = {
  guantes: ['guantes', 'guantes_nitrilo'],
  careta: ['careta', 'tapabocas', 'mascarilla'],
  gafas: ['gafas', 'gafas_hermeticas'],
  ventilacion: [],
};

/**
 * EPI de la ficha: primero `ppe_required` del catálogo, después lo que nombre
 * la prosa y no esté ya cubierto. Nada que no venga de uno de los dos.
 */
export function epiDe(bp) {
  const ppe = Array.isArray(bp?.ppe_required) ? bp.ppe_required.filter(Boolean) : [];
  const epi = ppe.map((id) => ({
    id,
    label: PPE_LABEL[id] || 'Protección sin descripción. Consulte asistencia técnica antes de usar.',
  }));
  for (const e of detectarEPI(precaucionDe(bp))) {
    const cubre = EPI_TEXTO_CUBIERTO_POR[e.id] || [e.id];
    if (!ppe.some((p) => cubre.includes(p))) epi.push(e);
  }
  return epi;
}

/** Vetos del catálogo (`do_not_use_when`) en lenguaje campesino. */
export function vetosDe(bp) {
  const vetos = Array.isArray(bp?.do_not_use_when) ? bp.do_not_use_when.filter(Boolean) : [];
  return vetos.map((v) => DO_NOT_USE_LABEL[v] || 'Hay una restricción de uso sin descripción. Consulte asistencia técnica.');
}

/** Una dosis solo se llama «segura» si el catálogo la validó. */
const DOSIS_VALIDADA = new Set(['validated', 'field_validated']);

/**
 * Construye la ficha toxicológica completa de un biopreparado a partir del
 * objeto del catálogo. Todo sale del dato real; nada se inventa.
 */
export function fichaToxicologica(bp) {
  const nivel = nivelToxicidad(bp);
  const epi = epiDe(bp);
  return {
    id: bp?.id,
    nombre: bp?.nombre || bp?.id,
    tipo: bp?.tipo || null,
    nivel,
    meta: NIVEL_TOX_META[nivel],
    epi,
    // Riesgo alto sin protección registrada: la UI no puede caer a «higiene básica».
    epi_sin_dato: epi.length === 0 && nivel === 'alto',
    vetos: vetosDe(bp),
    precaucion: precaucionDe(bp),
    dosis: bp?.dosis_aplicacion || bp?.dosis || null,
    dosis_validada: DOSIS_VALIDADA.has(bp?.validation_level),
    restriccion_legal: restriccionLegal(bp),
    fuente: bp?.fuente || null,
    source_ids: Array.isArray(bp?.source_ids) ? bp.source_ids : [],
    confianza: bp?.confianza || null,
  };
}

/** Orden de severidad para listar (alto primero, sin_dato al final tras bajo). */
const ORDEN_NIVEL = { alto: 0, medio: 1, bajo: 2, sin_dato: 3 };

/** Construye y ordena las fichas de una lista de biopreparados. */
export function fichasToxicologicas(biopreparados) {
  return (biopreparados || [])
    .filter((bp) => bp && bp.id)
    .map(fichaToxicologica)
    .sort((a, b) => (ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel])
      || a.nombre.localeCompare(b.nombre, 'es'));
}
