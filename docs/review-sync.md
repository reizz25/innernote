# Review Sync

Innernote can receive review summaries from an external worker. The first worker is the local Codex automation; a future cloud worker can reuse the same endpoint.

## Endpoint

Read journals for the sync user:

```text
GET /api/journals
Authorization: Bearer <REVIEW_SYNC_TOKEN>
```

Write generated summaries:

```text
POST /api/review-summaries
Authorization: Bearer <REVIEW_SYNC_TOKEN>
Content-Type: application/json
```

Payloads may send one summary or a list:

```json
{
  "summary": {
    "id": "week-2026-06-29",
    "type": "week",
    "summary": "Short overview",
    "patterns": [],
    "blindSpots": [],
    "strengths": [],
    "recovery": [],
    "nextActions": [],
    "questions": [],
    "sourceEntryIds": [],
    "generatedAt": "2026-07-05T00:00:00.000Z"
  }
}
```

The endpoint validates the token, requires every summary to have an `id`, and writes to the `review_summaries` store for `REVIEW_SYNC_USERNAME`.

## Secrets

- AnyHost dev secret: `REVIEW_SYNC_TOKEN`
- AnyHost dev value: `REVIEW_SYNC_USERNAME`
- Local Codex token file: `/Users/zz/.codex/secrets/innernote-review-sync-token`

Do not commit the token value.

## Current Worker

The local Codex automation reads from the deployed journal API, generates the last completed weekly or monthly review, and writes the result back through `POST /api/review-summaries`.

The same interface is intended for a later server-side scheduled worker.
