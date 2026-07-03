# Runway Provider Adapter

Use this reference when the current AnyHost/bitebase deployment provider is Runway.

Runway is the provider adapter, not the product language. User-facing work should say AnyHost/bitebase unless provider details are required.

Canonical Runway source: `https://releases.ifonlyapp.com/runway/README.md`.

## When To Use

- Deploying a repository in the current trial.
- Creating managed resources through Runway: database, storage, Redis, persistent volume.
- Reading deployment status, history, stats, logs, or environment variables.
- Debugging a Runway-backed app before AnyHost has native runner support.

## Requirements

- Code must be hosted on company Gitea: `https://git.hoxigames.xyz`.
- Runway deploy pulls from Gitea and builds from the pushed code.
- GitHub/GitLab/external repos cannot be deployed directly through Runway.
- Local changes that should be deployed must be committed and pushed first.
- Never commit `.anyhost/`, token files, secrets, or provider credentials.

## Transitional Runway Skills

Runway CLI installs/syncs AI skills into global agent skill directories on first use and during `runway upgrade`.

Prefer installed Runway skills when available:

| Task | Use |
| --- | --- |
| Onboard a new project | `@runway-onboard` |
| Deploy app | `@runway-deploy` |
| Create PostgreSQL | `@runway-db` |
| Create object storage | `@runway-storage` |
| Add Redis | `@runway-redis` |
| Logs/status/debugging | `@runway-ops` |

If skills are unavailable, use equivalent `runway` CLI commands.

These skills are provider-adapter implementation details. Do not copy the `runway-*` names into the default AnyHost/bitebase skill taxonomy; port the useful operational steps into AnyHost deployment references as native AnyHost support matures.

## Setup

### 1. Verify project files

```sh
pwd
git remote -v
git status --short --branch
test -f runway.yaml && cat runway.yaml
test -f Dockerfile && sed -n '1,220p' Dockerfile
```

Confirm the remote points to `git.hoxigames.xyz`.

### 2. Install or verify CLI

macOS/Linux:

```sh
command -v runway || curl -fsSL https://releases.ifonlyapp.com/runway/install.sh | sh
runway version
```

Windows PowerShell:

```powershell
irm https://releases.ifonlyapp.com/runway/install.ps1 | iex
runway version
```

If Windows PowerShell install is unavailable, download:

```text
https://releases.ifonlyapp.com/runway/latest/runway-windows-amd64.exe
```

Add the binary to PATH.

### 3. Authenticate

Check login:

```sh
runway status -e dev
```

If login is required, pause and ask the user to create a Gitea token:

```text
https://git.hoxigames.xyz/user/settings/applications
```

Required scope: `read:user`.

Then run:

```sh
runway login --token <token>
```

Do not invent a token. Token is stored by Runway under the user's home directory.

### 4. Onboard project

Use:

```text
@runway-onboard
```

The Runway onboarding skill detects the framework and should create/update:

- `runway.yaml`
- `Dockerfile`
- `/health` endpoint

If the skill is unavailable, use the equivalent Runway CLI/project setup path and preserve the same outputs.

## Deploy

Before deploying:

- Ensure local changes intended for deployment are committed and pushed to the Gitea remote.
- Confirm `runway.yaml` declares the target environment, normally `dev`.
- Confirm the app listens on the configured port.
- Confirm `GET /health` returns HTTP 200 locally when feasible.

Use:

```text
@runway-deploy
```

First deploy must happen from the project directory through `@runway-deploy` or:

```sh
runway deploy -e dev
```

Runway Console/Dashboard is for post-deploy management, logs, env vars, SQL, app retirement, and redeploying apps with existing deployment history.

After deploy, verify:

```sh
runway status -e dev
runway history -e dev --limit 12
runway stats --days 30
runway env list -e dev
```

Use `@runway-ops` or the corresponding CLI command for logs when debugging.

## Daily Operations

| Need | Command or skill |
| --- | --- |
| Onboard project | `@runway-onboard` |
| Deploy app | `@runway-deploy` or `runway deploy -e dev` |
| Create database | `@runway-db` |
| Create S3 + CDN storage | `@runway-storage` |
| Add Redis cache | `@runway-redis` |
| View logs/debug | `@runway-ops` |
| Set env var | `runway env set KEY=VALUE -e dev` |
| List env vars | `runway env list -e dev` |
| Deployment history | `runway history -e dev` |
| All app history | `runway history -e dev --all` |
| Deployment stats | `runway stats --days 30` |
| Update CLI and skills | `runway upgrade` |

For custom domains, add to `runway.yaml`:

```yaml
custom_domain: your.domain.com
```

Then redeploy with `@runway-deploy`.

Application retirement should be started from Runway Dashboard. Do not manually delete AWS resources.

## Managed Resources

Prefer the resource-specific Runway skills:

- PostgreSQL: `@runway-db`
- Object storage: `@runway-storage`
- Redis: `@runway-redis`

After adding a resource:

1. Verify env vars exist with `runway env list -e dev`.
2. Update app code to use the injected env vars.
3. Run the narrowest app test/build.
4. Redeploy if runtime behavior changed.

## Refresh AnyHost Context

For homepage setup flows, bind the repo to AnyHost before deployment, then refresh AnyHost control-plane context after Runway status/history/resources are known. Do not write provider state through legacy project mutation endpoints. The hosted setup guide at:

```text
https://contextnotcontrol.ai/agent-setup/prompt.md
```

is the source of truth for the current pairing and context-refresh commands.

AnyHost-specific order:

1. Bind the repo to AnyHost with `.anyhost/agent.json` ignored by git.
2. Use Runway to onboard/deploy/provision resources.
3. Read Runway status/history/stats/env.
4. Refresh `.anyhost/context.json` from AnyHost and report any mismatch.

## Output

Report AnyHost product state first:

- public URL/domain
- environment
- deploy status
- managed resources
- health/log verification

Then include provider details:

- Runway command or skill used
- Runway status/history signal
- unresolved provider issue, if any
