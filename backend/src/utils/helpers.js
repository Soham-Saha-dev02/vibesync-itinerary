export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const normalizeName = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Small deterministic hash -> [0,1). Used by the mock so results are stable. */
export function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Error that carries which upstream service failed and with what HTTP status. */
export class UpstreamError extends Error {
  constructor(message, { status = 502, service = 'upstream' } = {}) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
    this.service = service;
  }
}

/** Error for bad user input / unprocessable requests. */
export class AppError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.extra = extra;
  }
}
