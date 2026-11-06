export const ACK_MS = 650;
export const WAITING_AFTER_MS = 3000;
export const waitingThresholdReached = (elapsedMs) => Number.isFinite(elapsedMs) && elapsedMs > WAITING_AFTER_MS;

export function smoothVoiceLevel(previous, sample, alpha = 0.28) {
  const next = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0;
  const current = Number.isFinite(previous) ? Math.max(0, Math.min(1, previous)) : 0;
  return current + (next - current) * Math.max(0, Math.min(1, alpha));
}

export function conversationPose({
  phase = 'idle',
  online = true,
  cameraOpen = false,
  waiting = false,
  acknowledged = false,
} = {}) {
  if (online === false) return 'sin-senal';
  if (cameraOpen) return 'marco';
  if (waiting) return 'esperando';
  if (acknowledged) return 'asiente';
  if (phase === 'listening') return 'escuchando';
  if (phase === 'speaking') return 'respondiendo';
  return 'acompana';
}

export function shouldAcknowledgeTranscript(text) {
  return typeof text === 'string' && text.trim().length > 0;
}
