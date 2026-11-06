/**
 * Helpers de respuesta del AgentScreen.
 *
 * Añaden avisos post-LLM localizados sin reemplazar la respuesta original.
 */

import { registerCorrectionBlockSource } from '../../utils/correctionBlockSource.js';

/**
 * Antepone un bloque de correccion a la respuesta, de forma idempotente.
 *
 * @param {string} responseText
 * @param {string} correctionBlock
 * @returns {string}
 */
export function prependCorrectionBlock(responseText, correctionBlock) {
  const response = typeof responseText === 'string' ? responseText : '';
  const block = typeof correctionBlock === 'string' ? correctionBlock.trim() : '';
  if (!block) return response;
  const combined = !response || response.startsWith(block)
    ? (response || block)
    : `${block}\n\n${response}`;
  return registerCorrectionBlockSource(combined, block);
}

const COMPANION_ASSOCIATION_RE =
  /\b(?:compan\w*|asociaci\w*|asociad\w*|compatib\w*|policultiv\w*|intercultiv\w*|intercal\w*|antagonis\w*)\b|\bsembr\w*[\s\S]{0,40}\b(?:junto|junt[oa]s|al lado)\b|\b(?:junto|junt[oa]s|al lado)\b[\s\S]{0,40}\b(?:sembr\w*|cultiv\w*|plant\w*|especie\w*|cultivo\w*)\b/i;

const SPECIES_NAME_FIELDS = new Set([
  'nombre_comun',
  'common_name',
  'nombre',
  'species_name',
  'nombre_cientifico',
  'scientific_name',
]);

const SPECIES_COLLECTION_FIELDS = new Set([
  'alternativas',
  'alternativas_reales',
  'alternativas_viables',
  'companions',
  'antagonists',
  'cultivos',
  'especies',
  'items',
  'results',
  'species',
]);

/**
 * Dice si la respuesta formula una relación entre especies o cultivos.
 * Una lista de cultivos viables, por sí sola, no es una afirmación de compañía.
 *
 * @param {string} responseText
 * @returns {boolean}
 */
export function isCompanionAssociationResponse(responseText) {
  if (typeof responseText !== 'string' || !responseText.trim()) return false;
  const normalized = responseText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return COMPANION_ASSOCIATION_RE.test(normalized);
}

function normalizeSpeciesName(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(?:el|la|los|las|un|una)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function differsByAtMostOneCharacter(left, right) {
  if (Math.abs(left.length - right.length) > 1) return false;
  let leftIndex = 0;
  let rightIndex = 0;
  let differences = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    differences += 1;
    if (differences > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }

  if (leftIndex < left.length || rightIndex < right.length) differences += 1;
  return differences <= 1;
}

function matchesSpeciesNameWithTypo(candidate, catalogName) {
  const candidateWords = normalizeSpeciesName(candidate).split(' ').filter(Boolean);
  const catalogWords = normalizeSpeciesName(catalogName).split(' ').filter(Boolean);
  if (candidateWords.length === 0 || candidateWords.length !== catalogWords.length) return false;

  let typoCount = 0;
  for (let index = 0; index < candidateWords.length; index += 1) {
    const candidateWord = candidateWords[index];
    const catalogWord = catalogWords[index];
    if (candidateWord === catalogWord) continue;
    if (Math.min(candidateWord.length, catalogWord.length) < 5 ||
        !differsByAtMostOneCharacter(candidateWord, catalogWord)) {
      return false;
    }
    typoCount += 1;
    if (typoCount > 1) return false;
  }

  return true;
}

function speciesEvidenceAliases(name) {
  const aliases = new Set(name.split('/').map((part) => part.trim()).filter(Boolean));
  const binomial = name.match(/\b[\p{Lu}][\p{L}-]{2,}\s+[\p{Ll}][\p{L}-]{2,}/u)?.[0];
  if (binomial) aliases.add(binomial);
  return [...aliases];
}

function collectEvidenceSpeciesNames(value, names, inSpeciesCollection = false) {
  if (Array.isArray(value)) {
    for (const entry of value) collectEvidenceSpeciesNames(entry, names, inSpeciesCollection);
    return;
  }
  if (typeof value === 'string') {
    if (inSpeciesCollection && value.trim()) names.push(value);
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (SPECIES_NAME_FIELDS.has(normalizedKey) && typeof entry === 'string') {
      names.push(...speciesEvidenceAliases(entry));
    } else {
      collectEvidenceSpeciesNames(
        entry,
        names,
        SPECIES_COLLECTION_FIELDS.has(normalizedKey),
      );
    }
  }
}

function isConfirmedByToolEvidence(speciesMentioned, toolEvidence) {
  if (typeof speciesMentioned !== 'string' || !speciesMentioned.trim()) return false;
  const entries = Array.isArray(toolEvidence) ? toolEvidence : [toolEvidence];
  const catalogNames = [];

  for (const evidence of entries) {
    if (!evidence || typeof evidence !== 'object') continue;
    collectEvidenceSpeciesNames(evidence.result, catalogNames, Array.isArray(evidence.result));
  }

  return catalogNames.some((name) => matchesSpeciesNameWithTypo(speciesMentioned, name));
}

/**
 * Conserva la respuesta completa y señala únicamente la especie sin confirmar.
 * @param {string} responseText
 * @param {{has_fabricated_species?: boolean, species_mentioned?: string} | null | undefined} validation
 * @param {{toolEvidence?: object|Array<object>|null}} [options]
 * @returns {string}
 */
export function applyCompanionCorrection(responseText, validation, options = {}) {
  const toolEvidence = options?.toolEvidence ?? null;
  if (!validation?.has_fabricated_species || !isCompanionAssociationResponse(responseText)) {
    return responseText;
  }
  if (isConfirmedByToolEvidence(validation.species_mentioned, toolEvidence)) return responseText;

  const speciesMentioned = typeof validation.species_mentioned === 'string'
    ? validation.species_mentioned.replace(/\s+/g, ' ').trim().slice(0, 120)
    : '';
  const correction = speciesMentioned
    ? `Aviso: No pude confirmar «${speciesMentioned}» en el catálogo para esta asociación. Verifique la asociación antes de aplicarla.`
    : 'Aviso: No pude confirmar una de las especies de esta asociación en el catálogo. Verifique la asociación antes de aplicarla.';
  if (typeof responseText !== 'string' || !responseText.trim()) return correction;
  if (responseText.includes(correction)) return responseText;
  return `${responseText.trim()}\n\n${correction}`;
}
