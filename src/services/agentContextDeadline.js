// SPDX-License-Identifier: AGPL-3.0-only
/** Optional local context must not indefinitely prevent a chat request. */
export async function withAgentContextDeadline(promise, fallback = null, timeoutMs = 1500) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(promise).catch(() => fallback),
      new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
