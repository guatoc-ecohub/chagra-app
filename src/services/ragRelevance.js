// SPDX-License-Identifier: AGPL-3.0-only
/** Explicit relevance takes precedence over the legacy abstention flag. */
export function passageRelevance(passage) {
  if (['unknown', 'low', 'high'].includes(passage.relevance)) return passage.relevance;
  if (passage.relevance_status === 'unknown') return 'unknown';
  const assessed = passage.reranker_used === 'neural'
    && Number.isFinite(passage.max_rerank_score);
  if (passage.low_relevance === true) return assessed ? 'low' : 'unknown';
  return assessed ? 'high' : 'unknown';
}
