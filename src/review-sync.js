import { timingSafeEqual } from 'node:crypto';

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function headerValue(headers = {}, name = '') {
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '';
}

function requestToken(headers = {}) {
  const auth = String(headerValue(headers, 'authorization') || '');
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer || String(headerValue(headers, 'x-innernote-token') || '');
}

function safeEqual(left = '', right = '') {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function authorizeReviewSync(headers = {}, env = process.env) {
  const expected = String(env.REVIEW_SYNC_TOKEN || '');
  if (!expected) throw httpError(503, 'REVIEW_SYNC_TOKEN is not set.');

  const token = requestToken(headers);
  if (!token) throw httpError(401, 'Review sync token is required.');
  if (!safeEqual(token, expected)) throw httpError(403, 'Review sync token is invalid.');
}

export function reviewSummariesFromPayload(payload = {}) {
  const summaries = Array.isArray(payload.summaries)
    ? payload.summaries
    : payload.summary
      ? [payload.summary]
      : [];

  if (!summaries.length) throw httpError(400, 'summary or summaries is required.');

  return summaries.map((summary) => {
    if (!summary?.id) throw httpError(400, 'summary.id is required.');
    return {
      ...summary,
      type: normalizeReviewType(summary.type),
      createdAt: summary.createdAt || summary.generatedAt || new Date().toISOString(),
    };
  });
}

function normalizeReviewType(type) {
  if (type === 'weekly' || type === 'weekly-review') return 'week';
  if (type === 'monthly' || type === 'monthly-review') return 'month';
  return type || 'week';
}
