import 'dotenv/config';

const toBool = (v, fallback = false) =>
  v === undefined || v === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

export const config = {
  port: Number(process.env.PORT) || 5000,
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    fallbackModel: process.env.GROQ_FALLBACK_MODEL || 'llama-3.1-8b-instant',
  },

  qloo: {
    apiKey: process.env.QLOO_API_KEY || '',
    baseUrl: (process.env.QLOO_BASE_URL || 'https://hackathon.api.qloo.com').replace(/\/$/, ''),
    useMock: toBool(process.env.USE_MOCK_QLOO, false),
    fallbackToMock: toBool(process.env.QLOO_FALLBACK_TO_MOCK, false),
    cacheTtlMs: Number(process.env.QLOO_CACHE_TTL_MS) || 10 * 60 * 1000,
    explainability: toBool(process.env.QLOO_EXPLAINABILITY, false),
  },
};

export function validateConfig() {
  const missing = [];
  if (!config.groq.apiKey) missing.push('GROQ_API_KEY');
  if (!config.qloo.useMock && !config.qloo.apiKey) missing.push('QLOO_API_KEY (or set USE_MOCK_QLOO=true)');

  if (missing.length) {
    console.error(`\n[FATAL] Missing environment configuration: ${missing.join(', ')}`);
    console.error('Edit backend/.env (see .env.example) and restart.\n');
    process.exit(1);
  }
}
