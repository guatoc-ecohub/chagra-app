// SPDX-License-Identifier: AGPL-3.0-only
import { MSG } from '../config/messages';
import { useEffect, useState } from 'react';
import { initialVisionReview, waitForVisionReview } from '../services/visionJudgeReview';

export default function VisionJudgeReview({ judge }) {
  const [resolved, setResolved] = useState(null);
  const requestId = judge?.request_id;
  const status = judge?.status;
  useEffect(() => {
    if (status !== 'async' || !requestId) return;
    const controller = new AbortController();
    // waitForVisionReview sí recibe `signal` en runtime, pero su tipo inferido
    // (desde services/visionJudgeReview.js) solo declara timeoutMs; la variable
    // tipada documenta la forma real del argumento.
    /** @type {{ signal: AbortSignal, timeoutMs?: number }} */
    const opcionesPoll = { signal: controller.signal };
    waitForVisionReview(requestId, opcionesPoll).then((review) => {
      if (!controller.signal.aborted) setResolved({ requestId, review });
    });
    return () => controller.abort();
  }, [requestId, status]);

  const review = status === 'async' && resolved?.requestId === requestId
    ? resolved.review : initialVisionReview(judge);
  if (!review) return null;
  return <p role="status" aria-live="polite" data-vision-review={review.status}>{MSG.visionReview[review.status]}</p>;
}
