import { config } from '../config.js';
import { sleep, UpstreamError } from '../utils/helpers.js';

/* ---------------------------- tiny TTL cache ---------------------------- */
const cache = new Map();
const MAX_CACHE_ENTRIES = 300;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function cacheSet(key, data) {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { data, expires: Date.now() + config.qloo.cacheTtlMs });
}

/* ------------------------------ backoff -------------------------------- */
function backoffMs(attempt, retryAfterHeader) {
  const seconds = Number(retryAfterHeader);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 8000);
  return Math.min(500 * 2 ** attempt + Math.random() * 250, 8000);
}

/**
 * GET request to Qloo with auth, timeout, retries (429 / 5xx / network)
 * and response caching.
 */
async function qlooRequest(path, params = {}, { retries = 3, timeoutMs = 20000 } = {}) {
  const url = new URL(`${config.qloo.baseUrl}${path}`);
  Object.keys(params)
    .sort()
    .forEach((k) => {
      const v = params[k];
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });

  const key = url.toString();
  const cached = cacheGet(key);
  if (cached) return cached;

  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'X-Api-Key': config.qloo.apiKey, Accept: 'application/json' },
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        cacheSet(key, data);
        return data;
      }

      const body = (await res.text().catch(() => '')).slice(0, 300);
      const err = new UpstreamError(`Qloo ${path} responded ${res.status}: ${body}`, {
        status: res.status,
        service: 'qloo',
      });

      // Retry on rate limits and server errors; fail fast on other 4xx.
      if (res.status === 429 || res.status >= 500) {
        lastErr = err;
        console.warn(`[qloo] ${res.status} on ${path} (attempt ${attempt + 1}/${retries + 1})`);
        await sleep(backoffMs(attempt, res.headers.get('retry-after')));
        continue;
      }
      throw err;
    } catch (e) {
      if (e instanceof UpstreamError) throw e;

      lastErr =
        e.name === 'AbortError'
          ? new UpstreamError('Qloo request timed out', { status: 504, service: 'qloo' })
          : new UpstreamError(`Qloo network error: ${e.message}`, { status: 502, service: 'qloo' });
      console.warn(`[qloo] ${lastErr.message} (attempt ${attempt + 1}/${retries + 1})`);
      await sleep(backoffMs(attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr;
}

/* ------------------------------ public API ----------------------------- */

/** Resolve free text (anime, game, artist...) into a Qloo entity. */
async function resolveEntity(name) {
  try {
    const data = await qlooRequest('/search', { query: name, take: 1 });
    const hit = (data?.results || [])[0];
    if (!hit) return null;
    return {
      query: name,
      id: hit.entity_id || hit.id,
      name: hit.name,
      types: hit.types || [],
    };
  } catch (err) {
    // Auth errors should surface; everything else just means "couldn't resolve this one".
    if (err.status === 401 || err.status === 403) throw err;
    console.warn(`[qloo] could not resolve "${name}": ${err.message}`);
    return null;
  }
}

/** Taste-matched places in a city, seeded by resolved entity IDs. */
async function fetchPlaces(entityIds, city, take = 30) {
  const params = {
    'filter.type': 'urn:entity:place',
    'signal.interests.entities': entityIds.join(','),
    'filter.location.query': city,
    take,
  };
  if (config.qloo.explainability) params['feature.explainability'] = true;

  const data = await qlooRequest('/v2/insights', params);
  const entities = data?.results?.entities || [];

  return entities.map((e) => ({
    id: e.entity_id || e.id,
    name: e.name,
    address: e.properties?.address || e.location?.address || null,
    description: e.properties?.description || null,
    rating: e.properties?.business_rating ?? null,
    tags: (e.tags || []).map((t) => t.name).filter(Boolean).slice(0, 6),
    affinity: e.query?.affinity ?? null,
    explainability: e.query?.explainability ?? null, // experimental; shape depends on Qloo
    lat: e.location?.lat ?? e.properties?.geocode?.latitude ?? null,
    lng: e.location?.lon ?? e.properties?.geocode?.longitude ?? null,
    is_mock: false,
  }));
}

export const realQloo = { resolveEntity, fetchPlaces };
