# bitebase Agent API Contract

This contract defines the stable shapes a coding agent should use when reading AnyHost product state or asking AnyHost to deploy the current repository. Prefer the AnyHost CLI for normal work; use endpoint details only when debugging the control-plane integration.

## CLI-First Rule

Agents should use these commands as the public contract:

```sh
anyhost login
anyhost setup-agent
anyhost link
anyhost context
anyhost deploy -e dev
```

Production deploys require explicit user confirmation:

```sh
anyhost deploy -e prod --yes
```

Do not bypass AnyHost by calling cloud provider APIs directly unless the user explicitly asks for platform-level operations.

## Authentication

Agents authenticate with AnyHost-issued machine and project credentials created by:

```sh
anyhost login
anyhost setup-agent
```

The local project credential is stored at:

```text
.anyhost/agent.json
```

The file must not be committed. It should contain at least:

```json
{
  "apiOrigin": "https://anyhostcloud.com",
  "token": "<agent-project-token>",
  "projectCredentialToken": "<agent-project-token>",
  "workspaceId": "<anyhost-workspace-id>",
  "projectId": "<anyhost-project-id>",
  "createdAt": "2026-07-02T00:00:00Z"
}
```

The CLI writes both `token` and `projectCredentialToken` with the same project credential for compatibility. Treat all token fields as secrets.

## Project Context

Preferred command:

```sh
anyhost context
```

This refreshes:

```text
.anyhost/context.json
```

Source-of-truth endpoint used by the CLI:

```text
GET /api/v1/agent/context
```

Web proxy endpoint:

```text
GET /api/agent/context
```

Purpose: read AnyHost product authority before acting.

Minimum shape:

```json
{
  "workspace": {
    "id": "wsp_123",
    "name": "Acme"
  },
  "project": {
    "id": "prj_123",
    "workspace_id": "wsp_123",
    "name": "example",
    "slug": "example",
    "status": "online"
  },
  "repository": {
    "full_name": "acme/example",
    "default_branch": "main"
  },
  "environments": [
    {
      "name": "dev",
      "is_production": false
    },
    {
      "name": "prod",
      "is_production": true
    }
  ],
  "deployments": [
    {
      "id": "dep_123",
      "environment": "dev",
      "status": "online",
      "public_url": "https://example-dev.anyhostcloud.com",
      "logs_url": "https://anyhostcloud.com/workspaces/wsp_123/projects/prj_123/deployments/dep_123/logs"
    }
  ],
  "managedResources": [],
  "permissions": []
}
```

Use `.anyhost/context.json` as the source of truth for workspace, project, repository, environment, deployment status, public URL, logs URL, managed resources, and permissions. If local assumptions disagree with this file, report the mismatch before acting.

## Deployment

Preferred command:

```sh
anyhost deploy -e dev
```

The CLI creates a server-side deployment job for the current linked project and pushed commit. Before deploying, verify:

- deployable local changes are committed and pushed
- `.anyhost/context.json` points to the intended workspace/project/repository
- the target environment is correct
- production deploys have explicit user confirmation

`anyhost deploy` authenticates with the project credential in `.anyhost/agent.json`. A project credential may only create deployments for its own workspace/project and only for environments allowed by its scopes, such as `deploy:dev`.

Control-plane endpoint used by the CLI:

```text
POST /api/v1/workspaces/:workspaceID/projects/:projectID/deployments
```

Representative request shape:

```json
{
  "environment": "dev",
  "ref": "main",
  "commit": "0123456789abcdef",
  "source": "anyhost-cli"
}
```

Agents should not call this endpoint directly unless the CLI is unavailable and the control-plane contract is required for debugging.

## Logs

`anyhost logs` is reserved for the control-plane logs API and may not be implemented in this CLI version.

For now, read deployment `logs_url` or dashboard links from:

```text
.anyhost/context.json
```

## Managed Resources

Preferred read path:

```sh
anyhost context
```

Use the `managedResources` or `managed_resources` entries in `.anyhost/context.json` as the source of truth. A resource is deployable at runtime only when it belongs to the target environment, has a ready status, and includes a runtime secret reference.

Current deployment-time environment injection:

| Resource kind | Runtime environment variables |
| --- | --- |
| `postgres` | `DATABASE_URL` |
| `redis` | `REDIS_URL`, `REDIS_KEY_PREFIX` |
| `storage` | `S3_BUCKET`, `S3_PREFIX`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |

The current AnyHost CLI does not create managed resources from `.anyhost/agent.json`. Resource provisioning is a user-session/control-plane operation. Agents should not call user-session resource endpoints with the local project credential. If required resources are absent, report the required `kind`, `environment`, and `name`, use an explicitly available AnyHost user-facing path to create them, then rerun `anyhost context`.

## Deprecated Routes

Do not use these legacy routes in the default AnyHost setup flow:

```text
POST /api/agent/projects/:projectId/sync
PATCH /api/agent/projects/:projectId
POST /api/agent/projects/:projectId/analytics-plan
GET /api/agent/integrations/:provider/query
```

These routes belonged to an older provider-sync design. Current agents should read AnyHost context and ask AnyHost to deploy through the CLI.

## Rules

- Product state belongs in AnyHost; provider details should be represented through AnyHost context.
- Do not send secrets, tokens, raw logs, or private file contents.
- Never commit `.anyhost/`, `.env`, provider credentials, or downloaded tokens.
- Include the environment name for deployment decisions and reports.
- Prefer CLI commands over direct control-plane calls.
- Prefer `anyhost context` over stale local assumptions.
