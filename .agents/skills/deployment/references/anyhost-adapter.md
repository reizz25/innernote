# AnyHost Provider Adapter

Use this reference when the current AnyHost/bitebase deployment provider is AnyHost.

AnyHost is the product control plane and the CLI surface. User-facing setup should install `anyhost`, authenticate with browser device approval, install project-local bitebase skills, bind the repository to an AnyHost project, and deploy through the control plane.

## Requirements

- The user has an AnyHost account.
- The repository is visible to the connected GitHub App. Current CLI binding expects a GitHub repository; if `anyhost setup-agent` or `anyhost link` returns `unsupported_source_provider`, report the current remote and use portable mode unless the user is deploying through a connected GitHub repository.
- Local changes intended for deployment are committed and pushed before `anyhost deploy`.
- Never commit `.anyhost/`, token files, `.env`, secrets, or provider credentials.

## Install

macOS/Linux:

```sh
command -v anyhost || curl -fsSL https://releases.anyhostcloud.com/anyhost/install.sh | sh
anyhost version
```

Windows PowerShell:

```powershell
irm https://releases.anyhostcloud.com/anyhost/install.ps1 | iex
anyhost version
```

## Authenticate And Bind

```sh
anyhost login
anyhost setup-agent
anyhost context
```

`anyhost login` opens browser authorization and stores only the local machine session. `anyhost setup-agent` installs or refreshes `.agents/` setup files and links the current repository when a machine session exists. If setup reports that the repository is not visible to AnyHost or multiple projects match, follow the printed instruction, then rerun:

```sh
anyhost link
anyhost setup-agent
anyhost context
```

Expected local files:

- `.anyhost/agent.json`: project credential and binding pointer, including `token`, `projectCredentialToken`, `workspaceId`, and `projectId`. Must not be committed.
- `.anyhost/context.json`: current AnyHost workspace/project/environment/deployment/resource context.
- `.agents/skills/...`: project-local bitebase skills.
- `.gitignore`: should include `.anyhost/`. If the CLI creates or updates this file, keep the safety change and commit it with normal setup changes when appropriate.

## Managed Resources

The current CLI reads managed-resource state through `anyhost context` and injects ready resources during deployment, but it does not create resources from the project credential.

Before deploying resource-dependent code, inspect `.anyhost/context.json`:

- `postgres` resources with `status: ready` and `runtime_secret_ref` become `DATABASE_URL`.
- `redis` resources with `status: ready` and `runtime_secret_ref` become `REDIS_URL` and `REDIS_KEY_PREFIX`.
- `storage` resources with `status: ready` and `runtime_secret_ref` become `S3_BUCKET`, `S3_PREFIX`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`.
- Production environments need their own ready resources. Do not assume `dev`
  resources are reused by `prod`; compare ready resource kinds across
  environments before prod deploys.

If a required resource is missing or still provisioning, create it through the Customer Console project Resources panel, then rerun:

```sh
anyhost context
```

The web resource creation path requires a signed-in user session. The Customer Console currently calls these web-session routes, which forward to the control plane:

```text
POST /api/projects/:projectID/resources/postgres
POST /api/projects/:projectID/resources/storage
POST /api/projects/:projectID/resources/redis
```

Do not call user-session resource APIs with `.anyhost/agent.json`; the local project credential is for context, deploy, and log-link operations.

## Runtime Config

Use `anyhost env` as the primary surface for application runtime configuration.
Agents should treat this as one concept, even though AnyHost stores plain values,
user secrets, and managed-resource outputs differently underneath.

Common commands:

```sh
anyhost env list -e dev
anyhost env set -e dev API_TOKEN=secret-value
anyhost env set --plain -e dev PUBLIC_BASE_URL=https://app.example.com
anyhost env reveal -e dev API_TOKEN
anyhost env delete -e dev API_TOKEN
```

Rules:

- `anyhost env set -e dev KEY=VALUE` stores a secret by default and `env list` masks it.
- Use `--plain` only for non-sensitive values that are safe to print in logs.
- `anyhost env list` merges user plain values, user secrets, and managed-resource
  outputs.
- `DATABASE_URL`, `REDIS_URL`, `REDIS_KEY_PREFIX`, and S3 variables produced by
  managed resources are generated runtime variables. Do not overwrite them with
  user-provided values; fix or create the resource instead.
- Revealing a secret is an explicit action. Do not reveal secrets unless the task
  requires the raw value.
- After changing runtime config, redeploy the environment before expecting a
  running service to see the new value.

## Deploy

Before deploying:

- Run the narrowest project checks.
- Confirm `git status --short` is clean for deployable files.
- Push the branch or commit that should be deployed.
- Confirm `.anyhost/context.json` points at the intended project.
- For production deploys, run `anyhost env list -e prod` and confirm generated
  resource variables such as `DATABASE_URL` and `S3_*` are present when the app
  depends on them.
- First-time setup may create `.agents/` and update `.gitignore`; commit those setup changes only when the repository wants project-local bitebase skills pinned. Preserve an existing convention that intentionally ignores `.agents/`.

Dev deploy:

```sh
anyhost deploy -e dev
```

`anyhost deploy` uses the project credential in `.anyhost/agent.json`; it should not require a fresh machine login once the repository is linked. The credential is project-scoped and environment-scoped, so a default local agent credential can deploy `dev` but not `prod`.

Prod deploy requires explicit user confirmation:

```sh
anyhost deploy -e prod --yes
```

After deployment:

```sh
anyhost context
```

Verify deployment status, public URL, health behavior, and logs/build URL from `.anyhost/context.json`.

## Daily Operations

| Need | Command |
| --- | --- |
| Install or refresh skills | `anyhost setup-agent` |
| Authenticate machine | `anyhost login` |
| Bind current checkout | `anyhost link` |
| Refresh project state | `anyhost context` |
| List runtime config | `anyhost env list -e dev` |
| Set secret runtime config | `anyhost env set -e dev KEY=VALUE` |
| Set plain runtime config | `anyhost env set --plain -e dev KEY=VALUE` |
| Reveal a secret value | `anyhost env reveal -e dev KEY` |
| Deploy dev | `anyhost deploy -e dev` |
| Deploy prod | `anyhost deploy -e prod --yes` |
| Update CLI and skills | `anyhost update` |

`anyhost logs` is reserved for the control-plane logs API and may not be implemented in this CLI version. Use deployment `logs_url` or dashboard links from `.anyhost/context.json` when available.

## Output

Report AnyHost product state first:

- workspace/project
- environment
- deploy status
- public URL
- health/log verification
- managed resources

Then include unresolved operational risk or required user action.
