import { config } from '../config.js';
import { llmJson } from './llm.js';
import { realQloo } from './qlooClient.js';
import { mockQloo } from './qlooMock.js';
import { AppError, normalizeName } from '../utils/helpers.js';

/* ------------------------- result cache (demo safety) ------------------------- */
const resultCache = new Map();
const RESULT_TTL_MS = 10 * 60 * 1000;

const cacheKeyFor = ({ favorites, city, days }) =>
  JSON.stringify([favorites.map(normalizeName).sort(), normalizeName(city), days, config.qloo.useMock]);

/* ------------------------------ Step 1: vibe ------------------------------ */

async function extractVibe(favorites, city) {
  const system = `You are a cultural taste analyst. Given a user's favorite obscure media, extract the underlying "vibe" and produce clean search terms for a taste-graph API.
Respond with a single JSON object with exactly these keys:
{
  "vibe_title": string (a catchy 2-4 word name for this taste profile),
  "vibe_summary": string (2 sentences describing the underlying aesthetic, mood, and sensibility),
  "vibe_keywords": string[] (5-8 single-word or short-phrase descriptors),
  "qloo_entities": string[] (canonical, correctly spelled titles/artist names to look up; max 6),
  "preferred_atmospheres": string[] (3-5 physical atmospheres, e.g. "dim neon-lit listening bar")
}
Output JSON only, no commentary.`;

  const user = `City: ${city}\nFavorites:\n${favorites.map((f, i) => `${i + 1}. ${f}`).join('\n')}`;
  const raw = await llmJson({ system, user, temperature: 0.4 });

  // Defensive normalization: never trust model output shape.
  const arr = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
  return {
    vibe_title: String(raw.vibe_title || 'Your Vibe'),
    vibe_summary: String(raw.vibe_summary || ''),
    vibe_keywords: arr(raw.vibe_keywords).slice(0, 8),
    qloo_entities: arr(raw.qloo_entities).slice(0, 6),
    preferred_atmospheres: arr(raw.preferred_atmospheres).slice(0, 5),
  };
}

/* --------------------------- Step 2: Qloo retrieval --------------------------- */

async function gatherQlooData(provider, { favorites, vibe, city }) {
  const names = [...new Set([...favorites, ...vibe.qloo_entities])].slice(0, 8);
  const resolved = (await Promise.all(names.map((n) => provider.resolveEntity(n)))).filter(Boolean);

  const seen = new Set();
  const entities = resolved.filter((e) => e.id && !seen.has(e.id) && seen.add(e.id));
  if (entities.length === 0) return { entities, places: [] };

  const places = await provider.fetchPlaces(entities.map((e) => e.id), city, 30);
  return { entities, places };
}

/**
 * Rank by affinity, then diversify: round-robin across each place's primary
 * tag so the itinerary isn't 12 bars in a row.
 */
function rankAndDiversify(places, limit = 20) {
  const sorted = [...places].sort((a, b) => (b.affinity ?? -1) - (a.affinity ?? -1));
  const buckets = new Map();
  for (const p of sorted) {
    const k = p.tags?.[0] || 'other';
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(p);
  }

  const out = [];
  while (out.length < limit && [...buckets.values()].some((b) => b.length)) {
    for (const b of buckets.values()) {
      if (b.length && out.length < limit) out.push(b.shift());
    }
  }
  return out.map((p, i) => ({ ...p, ref: `p${i + 1}` }));
}

/* ----------------------- Step 3: itinerary + grounding ----------------------- */

async function composeItinerary({ vibe, places, city, days }) {
  const system = `You are an elite local-experience curator building a weekend itinerary.
RULES:
- Build the itinerary primarily from the provided Qloo places (taste-graph matches). Reference each by its "ref" id (e.g. "p3") and use its exact name.
- Use each place at most once.
- You may add at most 1 generic non-listed activity per day (e.g. "wander the old quarter"). For those, set "place_ref" to null.
- Schedule hour-by-hour with realistic times, meals at sensible hours, and minimal backtracking.
- "why_it_fits" must connect that stop to this user's specific vibe.
- Produce exactly ${days} day(s).
Respond with a single JSON object in this shape:
{
  "title": string,
  "tagline": string,
  "days": [
    {
      "day": string (e.g. "Saturday"),
      "theme": string,
      "stops": [
        {
          "time": string (e.g. "10:00 AM"),
          "title": string,
          "place_ref": string | null,
          "place_name": string,
          "category": string,
          "description": string (1-2 sentences),
          "why_it_fits": string (1 sentence)
        }
      ]
    }
  ]
}
Output JSON only, no commentary.`;

  const user = JSON.stringify({
    city,
    number_of_days: days,
    vibe: {
      title: vibe.vibe_title,
      summary: vibe.vibe_summary,
      keywords: vibe.vibe_keywords,
      atmospheres: vibe.preferred_atmospheres,
    },
    qloo_places: places.map((p) => ({
      ref: p.ref,
      name: p.name,
      address: p.address,
      description: p.description ? p.description.slice(0, 160) : null,
      tags: p.tags,
      affinity: p.affinity,
    })),
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await llmJson({ system, user, temperature: 0.8 });
    if (Array.isArray(raw?.days) && raw.days.length && raw.days.every((d) => Array.isArray(d.stops))) {
      return raw;
    }
    console.warn('[agent] itinerary had invalid structure; retrying');
  }
  throw new AppError('The AI could not produce a valid itinerary. Please retry.', 502);
}

/** Link every stop to a real Qloo place, or flag it as non-Qloo. */
function groundItinerary(itinerary, places) {
  const byRef = new Map(places.map((p) => [p.ref, p]));
  const byName = new Map(places.map((p) => [normalizeName(p.name), p]));
  const used = new Set();
  let total = 0;
  let grounded = 0;

  const days = itinerary.days.map((day) => ({
    day: String(day.day || ''),
    theme: String(day.theme || ''),
    stops: day.stops.map((stop) => {
      total += 1;
      const wanted = normalizeName(stop.place_name);

      let match =
        byRef.get(String(stop.place_ref || '').toLowerCase()) ||
        byName.get(wanted) ||
        places.find((p) => wanted && (normalizeName(p.name).includes(wanted) || wanted.includes(normalizeName(p.name))));

      if (match && used.has(match.ref)) match = null; // de-dupe repeated places
      if (match) {
        used.add(match.ref);
        grounded += 1;
      }

      return {
        time: String(stop.time || ''),
        title: String(stop.title || stop.place_name || ''),
        place_name: match ? match.name : String(stop.place_name || ''),
        category: String(stop.category || ''),
        description: String(stop.description || ''),
        why_it_fits: String(stop.why_it_fits || ''),
        from_qloo: Boolean(match),
        place: match
          ? {
              id: match.id,
              address: match.address,
              lat: match.lat,
              lng: match.lng,
              tags: match.tags,
              affinity: match.affinity,
              rating: match.rating,
              is_mock: match.is_mock,
            }
          : null,
      };
    }),
  }));

  return {
    itinerary: {
      title: String(itinerary.title || 'Your VibeSync Weekend'),
      tagline: String(itinerary.tagline || ''),
      days,
    },
    coverage: total ? Number((grounded / total).toFixed(2)) : 0,
  };
}

/* ------------------------------ Orchestrator ------------------------------ */

export async function runAgent({ favorites, city, days }) {
  const key = cacheKeyFor({ favorites, city, days });
  const cached = resultCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return { ...cached.data, meta: { ...cached.data.meta, cached: true } };
  }

  const trace = [];
  const timed = async (step, fn) => {
    const t = Date.now();
    const out = await fn();
    trace.push({ step, ms: Date.now() - t });
    return out;
  };

  const t0 = Date.now();
  let degraded = false;
  let provider = config.qloo.useMock ? mockQloo : realQloo;

  // 1. Vibe
  const vibe = await timed('extract_vibe', () => extractVibe(favorites, city));

  // 2. Qloo (with optional graceful degradation to mock data)
  let qlooData;
  try {
    qlooData = await timed('qloo_retrieval', () => gatherQlooData(provider, { favorites, vibe, city }));
  } catch (err) {
    if (config.qloo.fallbackToMock && provider !== mockQloo) {
      console.warn(`[agent] Qloo failed (${err.message}); degrading to mock data`);
      provider = mockQloo;
      degraded = true;
      qlooData = await timed('qloo_retrieval_mock_fallback', () =>
        gatherQlooData(provider, { favorites, vibe, city })
      );
    } else {
      throw err;
    }
  }

  const { entities } = qlooData;
  if (entities.length === 0) {
    throw new AppError(
      'Qloo could not recognize any of those favorites. Try more mainstream spellings or add more titles.',
      422,
      { vibe }
    );
  }
  if (qlooData.places.length === 0) {
    throw new AppError(`Qloo returned no places for "${city}". Try a larger city (e.g. Tokyo, New York, London).`, 404, {
      vibe,
      entities,
    });
  }

  const places = rankAndDiversify(qlooData.places, 20);

  // 3. Compose + ground
  const rawItinerary = await timed('compose_itinerary', () => composeItinerary({ vibe, places, city, days }));
  const { itinerary, coverage } = groundItinerary(rawItinerary, places);

  const result = {
    city,
    favorites,
    vibe,
    entities,
    places,
    itinerary,
    meta: {
      total_ms: Date.now() - t0,
      llm_model: config.groq.model,
      qloo_source: provider === mockQloo ? 'mock' : 'live',
      degraded,
      qloo_coverage: coverage,
      cached: false,
      trace,
    },
  };

  resultCache.set(key, { data: result, expires: Date.now() + RESULT_TTL_MS });
  return result;
}
