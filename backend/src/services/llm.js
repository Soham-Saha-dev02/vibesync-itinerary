import Groq from 'groq-sdk';
import { config } from '../config.js';
import { sleep } from '../utils/helpers.js';

let client = null;
const getClient = () => (client ??= new Groq({ apiKey: config.groq.apiKey }));

function safeParseJson(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned); // throws SyntaxError on garbage
}

function retryAfterMs(err, attempt) {
  const header = err?.headers?.['retry-after'] ?? err?.headers?.get?.('retry-after');
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 10000);
  return Math.min(1000 * 2 ** attempt, 8000);
}

const isJsonValidateFailure = (err) =>
  err?.error?.error?.code === 'json_validate_failed' || err?.error?.code === 'json_validate_failed';

/**
 * Calls Groq in JSON mode with resilience:
 *  - 429        -> wait (Retry-After), retry; if still limited, try the fallback model
 *  - bad JSON   -> retry with lower temperature
 *  - 400/404    -> model unavailable/decommissioned, move to fallback model
 *  - 5xx        -> short backoff, retry
 * NOTE: Groq JSON mode requires the word "JSON" in the prompt.
 */
export async function llmJson({ system, user, temperature = 0.7, maxTokens = 4096 }) {
  const models = [...new Set([config.groq.model, config.groq.fallbackModel].filter(Boolean))];
  let lastErr;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const completion = await getClient().chat.completions.create({
          model,
          temperature: attempt === 0 ? temperature : Math.min(temperature, 0.3),
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        });
        return safeParseJson(completion.choices?.[0]?.message?.content);
      } catch (err) {
        lastErr = err;

        if (err.status === 429) {
          console.warn(`[groq] rate limited on ${model} (attempt ${attempt + 1})`);
          if (attempt < 2) await sleep(retryAfterMs(err, attempt));
          continue;
        }
        if (err instanceof SyntaxError || isJsonValidateFailure(err)) {
          console.warn(`[groq] invalid JSON from ${model} (attempt ${attempt + 1}); retrying`);
          continue;
        }
        if (err.status >= 500) {
          await sleep(800 * (attempt + 1));
          continue;
        }
        if (err.status === 400 || err.status === 404) {
          console.warn(`[groq] ${model} unavailable (${err.status}); trying next model`);
          break;
        }
        throw err; // 401/403/etc: surface immediately
      }
    }
  }
  throw lastErr;
}
