# Auth

Innernote uses simple username/password authentication when it runs with Postgres.
The local file-backed mode stays open for development.

## Environment

Set these values in the deployment environment:

```text
INITIAL_USERNAME=<owner username>
INITIAL_PASSWORD=<owner password>
REVIEW_SYNC_USERNAME=<owner username>
```

On startup, the server creates the initial user if it does not exist, then assigns
existing journal entries and review summaries to that user during the schema
migration.

## Routes

```text
POST /api/register
POST /api/login
POST /api/logout
GET /api/me
```

The app stores a secure HTTP-only session cookie. Journal, asset, backup, and
model routes require a valid session, so entries and review summaries are read
and written under the current user.

## Review Sync

The review sync token can read journals and write summaries for
`REVIEW_SYNC_USERNAME`. This keeps the local Codex scheduled review worker
working without storing a browser session cookie.
