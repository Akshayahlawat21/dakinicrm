/**
 * V1 transcript-analysis client.
 * Calls Layer 2 -> Layer 3 -> Layer 5. Never calls the LLM provider from the browser.
 */
import { gatewayFetch } from './api';

export async function analyzeTranscript(transcript) {
  const cleaned = typeof transcript === 'string' ? transcript.trim() : '';
  if (!cleaned) throw new Error('Paste a sales-call transcript before starting the analysis.');

  const result = await gatewayFetch('/agent/transcript-analysis', {
    method: 'POST',
    body: JSON.stringify({ transcript: cleaned }),
  });

  if (!result.success) {
    throw new Error(
      result.error?.message ||
      result.error?.detail ||
      `Transcript analysis failed${result.status ? ` (${result.status})` : ''}.`
    );
  }

  const payload = result.data;
  if (payload?.status !== 'success' || !payload?.outputs?.summary || !payload?.outputs?.improvements) {
    throw new Error('Layer 5 returned an unexpected analysis response. Check the Layer 5 logs.');
  }
  return payload.outputs;
}
