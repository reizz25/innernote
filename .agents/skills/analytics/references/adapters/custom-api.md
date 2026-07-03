# Custom API Adapter

Use when the product should collect events through its own endpoint, database, queue, or warehouse pipeline instead of a third-party analytics SDK.

## When To Choose

- strict privacy or data ownership requirements
- existing data warehouse or BI stack
- need to join product events with internal domain tables
- early product only needs a few events
- analytics platform decision is not final

## Minimal Event Shape

Use a stable envelope:

```json
{
  "event": "signup_completed",
  "timestamp": "2026-07-01T00:00:00.000Z",
  "anonymous_id": "anon_123",
  "user_id": "user_123",
  "account_id": "acct_123",
  "session_id": "sess_123",
  "source": "web",
  "properties": {
    "plan": "free"
  },
  "context": {
    "url": "/signup",
    "user_agent": "...",
    "ip": "handled server-side if needed"
  }
}
```

Do not require every field for every event. Keep the schema permissive enough for product iteration, but validate event name and property size.

## Implementation Pattern

1. Create a small tracking wrapper such as `track(event, properties, context)`.
2. Client sends intent events to `/api/events` or equivalent.
3. Server emits fact events directly from the backend when state changes.
4. Store events in an append-only table, queue, or log stream.
5. Add a development sink that logs events without sending to production.

## Server Endpoint Rules

- Authenticate when the event requires known user/account context.
- Rate limit anonymous client events.
- Add server timestamp.
- Attach request/session context server-side.
- Drop or redact disallowed fields.
- Do not trust client-provided user/account IDs when authenticated context exists.

## Storage Fields

Recommended table columns:

- `id`
- `event`
- `timestamp`
- `anonymous_id`
- `user_id`
- `account_id`
- `session_id`
- `source`
- `properties` JSON
- `context` JSON
- `environment`

Index by `event`, `timestamp`, `user_id`, and `account_id` or equivalent account grain.

## Verification

- Unit test wrapper payload shape.
- Integration test endpoint rejects oversized/invalid events.
- Confirm server-side fact events are emitted from the transaction or immediately after success.
- Confirm dev/test environments are separated from production.
