// SPDX-License-Identifier: AGPL-3.0-only
/**
 * corpusRetriever.js — cablea el corpus del sidecar (5647 chunks dr-fanout +
 * fichas, pgvector nomic 768d) al chat del agente. Complementa el RAG cliente
 * (ragRetriever, 501 fichas arctic 1024d) llamando al endpoint /hybrid-retrieve
 * del sidecar y devolviendo pasajes en la MISMA forma { key, text, score } que
 * consume buildCorpusVariants — así se mezclan sin tocar el ensamblado del prompt.
 *
 * Gated por VITE_USE_CORPUS_RETRIEVAL (OFF por defecto → cero cambio en el flujo
 * RAG). Fail-soft: cualquier error/timeout devuelve [] (nunca degrada la UX).
 *
 * ¿Por qué separado del RAG cliente? El corpus vive server-side (768d nomic, con
 * su índice HNSW), el cliente es 1024d arctic — embeddings incompatibles. Se
 * consultan como dos piernas y se fusionan a nivel de pasajes, no de vectores.
 */

import { passageRelevance } from './ragRelevance.js';
import { fetchWithAuthRetry } from './apiService';

// Latencia observada del endpoint: 4807–6928 ms. Diez segundos dan ~3 s de
// margen sobre la mayor respuesta medida sin dejar una espera indefinida.
const CORPUS_TIMEOUT_MS = 10_000;
const TEXT_MAX = 4000; // cota por chunk (evita inflar el prompt)

/** ¿Retrieval del corpus activo? Gated por env. OFF por defecto. */
export function isCorpusRetrievalEnabled() {
  try {
    const raw = import.meta.env?.VITE_USE_CORPUS_RETRIEVAL;
    if (raw === true) return true;
    if (typeof raw === 'string') {
      const v = raw.trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'on';
    }
    return false;
  } catch (_) {
    return false;
  }
}

function getBaseUrl() {
  try {
    const raw = import.meta.env?.VITE_SIDECAR_URL;
    if (typeof raw === 'string' && raw.trim()) return raw.trim().replace(/\/+$/, '');
  } catch (_) { /* ignore */ }
  // Default alineado con sidecarClient.getBaseUrl() (/api/mcp/agro): el sidecar
  // vive detrás de nginx en /api/mcp/agro/, NO en /api. Con el default viejo
  // '/api' el fetch pegaba a /api/hybrid-retrieve (404) → [] silencioso → el
  // corpus jamás se cableaba aunque el flag estuviera ON. Verificado 2026-07-29.
  return '/api/mcp/agro';
}

function clip(s) {
  return typeof s === 'string' ? s.slice(0, TEXT_MAX) : '';
}

/**
 * Recupera pasajes del corpus del sidecar. Devuelve [] si está deshabilitado,
 * si falla, o si no hay resultados. Conserva pasajes de respuestas degradadas
 * para que el prompt pueda marcarlos como contexto parcial. Nunca lanza.
 * @param {string} query
 * @param {number} [topK=3]
 * @returns {Promise<Array<{key:string,text:string,score:number,title?:string,foreign?:boolean}>>}
 */
export async function retrieveCorpus(query, topK = 3) {
  if (!isCorpusRetrievalEnabled()) return [];
  const q = (query ?? '').trim();
  if (!q) return [];

  const url = `${getBaseUrl()}/hybrid-retrieve`;
  const headers = { 'Content-Type': 'application/json' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CORPUS_TIMEOUT_MS);
  try {
    // nginx exige el bearer en /api/mcp/agro/ (auth_request /_auth/farmos);
    // sin él, /hybrid-retrieve responde 401 y el agente pierde el corpus.
    const res = await fetchWithAuthRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: q, top_k: Math.max(1, Math.min(topK, 10)) }),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.results)) return [];
    return data.results
      .filter((r) => r && typeof r.content === 'string' && r.content.trim())
      .map((r, index) => ({
        // key con prefijo 'corpus:' → ragOriginReconciler lo trata como pasaje
        // del corpus server-side; el chunk_key preserva la trazabilidad.
        key: `corpus:${r.chunk_key ?? 'sin-key'}`,
        chunk_key: r.chunk_key,
        retrieval_rank: index + 1,
        source_ids: Array.isArray(r.source_ids) ? r.source_ids.filter(id => typeof id === 'string') : [],
        degraded: data.degraded === true,
        low_relevance: data.low_relevance === true || r.low_relevance === true,
        relevance: passageRelevance({
          relevance: r.relevance ?? data.relevance,
          relevance_status: r.relevance_status ?? data.relevance_status,
          reranker_used: r.reranker_used ?? data.reranker_used,
          max_rerank_score: r.max_rerank_score ?? data.max_rerank_score,
          low_relevance: r.low_relevance ?? data.low_relevance,
        }),
        text: clip(r.content),
        score: typeof r.similarity === 'number' ? r.similarity : 0,
        title: typeof r.title === 'string' ? r.title : undefined,
        source_type: typeof r.source_type === 'string' ? r.source_type : undefined,
      }));
  } catch (_) {
    return []; // fail-soft
  } finally {
    clearTimeout(timer);
  }
}
