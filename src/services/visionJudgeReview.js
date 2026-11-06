// SPDX-License-Identifier: AGPL-3.0-only
import { judgeVisionResult } from './sidecarClient';

// Async server budget: 360 s. Allow 10 s for transport; queue delays can
// exceed this window and are reported as an expired client wait.
export const VISION_REVIEW_TIMEOUT_MS = 370000;
export const VISION_REVIEW_INTERVAL_MS = 2000;

export function initialVisionReview(judge) {
  if (!judge) return null;
  if (judge.status === 'async' && judge.request_id) return { status: 'pending' };
  if (judge.reason === 'enqueue_failed' || judge.reason === 'queue_full' || judge.reason === 'queue_failed') {
    return { status: 'enqueue-error' };
  }
  return { status: 'error' };
}

function pause(ms, signal) {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

/**
 * @param {string} requestId id de revisión async del juez visual.
 * @param {{signal?: AbortSignal, timeoutMs?: number}} [opciones]
 *   `signal` cancela el sondeo; `timeoutMs` corta la espera al presupuesto.
 */
export async function waitForVisionReview(requestId, { signal, timeoutMs = VISION_REVIEW_TIMEOUT_MS } = {}) {
  if (!requestId) return { status: 'enqueue-error' };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, timeoutMs);
  try {
    while (!controller.signal.aborted) {
      const verdict = await judgeVisionResult(requestId, { signal: controller.signal });
      if (controller.signal.aborted) break;
      if (verdict?.status === 'done') {
        if (![true, false, null].includes(verdict.plausible)) return { status: 'error' };
        return {
          status: verdict.plausible === true ? 'positive' : verdict.plausible === false ? 'negative' : 'abstained',
        };
      }
      if (verdict?.status !== 'pending') {
        return verdict?.status === 'error' ? initialVisionReview(verdict) : { status: 'error' };
      }
      await pause(VISION_REVIEW_INTERVAL_MS, controller.signal);
    }
    return { status: signal?.aborted ? 'cancelled' : 'timeout' };
  } catch {
    return { status: signal?.aborted ? 'cancelled' : controller.signal.aborted ? 'timeout' : 'error' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
