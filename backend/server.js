import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './src/config.js';
import { runAgent } from './src/services/agent.js';
import { AppError } from './src/utils/helpers.js';

validateConfig();

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: config.clientOrigins }));
app.use(express.json({ limit: '100kb' }));

/* ---------------- minimal per-IP rate limiter (protects Groq quota) ---------------- */
const hits = new Map();
function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: `Too many requests. Try again in ${retryAfter}s.` });
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

/* ------------------------------------ routes ------------------------------------ */

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'vibesync-backend',
    llm: { provider: 'groq', model: config.groq.model },
    qloo: { mode: config.qloo.useMock ? 'mock' : 'live' },
    time: new Date().toISOString(),
  });
});

app.post('/api/itinerary', rateLimit({ windowMs: 60_000, max: 8 }), async (req, res, next) => {
  try {
    let { favorites, city, days } = req.body || {};

    if (typeof favorites === 'string') favorites = favorites.split(/[\n,]+/);
    favorites = Array.isArray(favorites)
      ? favorites.map((f) => String(f).trim().slice(0, 100)).filter(Boolean).slice(0, 10)
      : [];
    city = typeof city === 'string' ? city.trim().slice(0, 80) : '';
    days = Math.min(Math.max(parseInt(days, 10) || 2, 1), 3);

    if (favorites.length === 0) throw new AppError('Provide at least one favorite (anime, game, artist, etc.).', 400);
    if (!city) throw new AppError('Provide a target city.', 400);

    const result = await runAgent({ favorites, city, days });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/* --------------------------------- error handling --------------------------------- */

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err.name, err.message);

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }
  if (err.status === 429) {
    return res
      .status(429)
      .json({ error: 'An upstream API (Groq or Qloo) is rate limiting us. Please wait a few seconds and retry.' });
  }
  if (err.status === 401 || err.status === 403) {
    return res.status(502).json({ error: 'An upstream API rejected our credentials. Check GROQ_API_KEY / QLOO_API_KEY.' });
  }
  if (err.name === 'UpstreamError' || err.status === 504) {
    return res.status(503).json({ error: 'An upstream service is unavailable right now. Please retry shortly.' });
  }
  if (err instanceof SyntaxError) {
    return res.status(502).json({ error: 'The AI returned malformed output. Please retry.' });
  }
  res.status(500).json({ error: 'Something went wrong generating your itinerary.' });
});

app.listen(config.port, () => {
  console.log(`\n VibeSync backend running on http://localhost:${config.port}`);
  console.log(` LLM: Groq / ${config.groq.model} (fallback: ${config.groq.fallbackModel})`);
  console.log(` Qloo: ${config.qloo.useMock ? 'MOCK DATA' : `LIVE (${config.qloo.baseUrl})`}\n`);
});
