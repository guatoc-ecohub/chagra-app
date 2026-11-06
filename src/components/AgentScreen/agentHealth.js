import { fetchWithAuthRetry } from '../../services/apiService';

export async function probeAgentHealth(signal, fetcher = fetchWithAuthRetry) {
  try {
    const response = await fetcher('/api/ollama/api/tags', { signal });
    return response.ok;
  } catch {
    return false;
  }
}

export function shouldShowAgentUnavailableNotice({ turnStatus, isIdle, llmHealthy }) {
  return isIdle && turnStatus === 'failed' && !llmHealthy;
}
