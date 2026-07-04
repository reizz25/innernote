import test from 'node:test';
import assert from 'node:assert/strict';

import {
  authorizeReviewSync,
  reviewSummariesFromPayload,
} from '../src/review-sync.js';

test('authorizeReviewSync accepts bearer or x-innernote-token secrets', () => {
  const env = { REVIEW_SYNC_TOKEN: 'sync-secret' };

  assert.doesNotThrow(() => authorizeReviewSync({
    authorization: 'Bearer sync-secret',
  }, env));
  assert.doesNotThrow(() => authorizeReviewSync({
    'x-innernote-token': 'sync-secret',
  }, env));
});

test('authorizeReviewSync rejects missing, unset, or mismatched secrets', () => {
  assert.throws(() => authorizeReviewSync({}, {}), /REVIEW_SYNC_TOKEN is not set/);
  assert.throws(() => authorizeReviewSync({}, { REVIEW_SYNC_TOKEN: 'sync-secret' }), /Review sync token is required/);
  assert.throws(
    () => authorizeReviewSync({ authorization: 'Bearer wrong' }, { REVIEW_SYNC_TOKEN: 'sync-secret' }),
    /Review sync token is invalid/,
  );
});

test('reviewSummariesFromPayload accepts one summary or a summaries list', () => {
  assert.deepEqual(reviewSummariesFromPayload({
    summary: { id: 'week-2026-06-29', type: 'week', summary: '一周回顾' },
  }).map((summary) => summary.id), ['week-2026-06-29']);

  assert.deepEqual(reviewSummariesFromPayload({
    summaries: [
      { id: 'week-2026-06-29', type: 'week', summary: '一周回顾' },
      { id: 'month-2026-06', type: 'month', summary: '六月回顾' },
    ],
  }).map((summary) => summary.id), ['week-2026-06-29', 'month-2026-06']);
});

test('reviewSummariesFromPayload rejects empty or id-less payloads', () => {
  assert.throws(() => reviewSummariesFromPayload({}), /summary or summaries is required/);
  assert.throws(() => reviewSummariesFromPayload({ summary: { summary: '没有 id' } }), /summary.id is required/);
});
