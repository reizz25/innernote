---
name: deployment
description: "Use for deployment and operations work: deploys, databases, managed resources, DNS, runtime config, logs, health checks, production debugging, rollbacks, and release verification. AnyHost deployment service is used when the repository is bound or the user asks for AnyHost/bitebase deployment."
---

# Deployment

Ship and operate products with product-state clarity: URL, health, logs, resource readiness, and user impact come before provider mechanics. Use AnyHost deployment service when available or requested; otherwise inspect the existing provider/runtime and preserve the same product-state standard.

## Start

1. Read `README.md` and any relevant ADR/design doc for the runtime area.
2. Inspect the repo state and preserve user changes.
3. Identify the target: local dev, preview, dev, staging, prod, current provider/runtime, or AnyHost control plane.
4. For production-risk operations, ask for explicit confirmation before acting.

## Workflows

- Deploy/release: read `references/deploy.md`.
- AnyHost provider adapter: read `references/anyhost-adapter.md` when deploying through AnyHost, installing the CLI, binding a repository, or reading AnyHost project context.
- Legacy Runway provider adapter: read `references/runway-adapter.md` only when an existing project is explicitly Runway-backed or the user asks for Runway-specific state.
- Managed PostgreSQL: read `references/database.md` when adding, using, connecting to, or debugging an AnyHost Postgres Resource.
- Managed object storage: read `references/storage.md` when adding uploads, downloads, public assets, or storage-backed features.
- Managed Redis/cache: read `references/redis.md` when adding cache, sessions, rate limits, locks, queues, or Redis-backed runtime behavior.
- Runtime or production debugging: read `references/debug.md`.
- Durable deployment state: read `.agents/specs/artifacts.md` when deploy config, managed resources, production state, or release evidence changes.
- AnyHost state sync: when bound or requested, read `.agents/specs/agent-api.md` before writing project status, deployment result, provider sync, or managed resource state.

## Defaults

- Prefer existing commands: `make test`, `make web-test`, `make web-typecheck`, `make web-dev`.
- In AnyHost-enhanced mode, treat the Go control plane as product authority for workspace, project, environment, deployment, managed resource, and audit state.
- Keep provider details secondary in user-facing surfaces unless the task is explicitly provider or infrastructure-level.
- Verify after changes with a command, health endpoint, log check, or browser/API smoke test.

## Output

Report:

- what changed
- how it was verified
- remaining operational risk
- artifact path when a deployment report was created or updated
- exact next step if production handoff is needed
