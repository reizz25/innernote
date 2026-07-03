# Deploy Workflow

Use when shipping code or changing runtime configuration.

1. Identify deploy target and risk level.
2. Check repo status and relevant env/config files.
3. Run the narrowest preflight checks:
   - Go/control plane: `go test ./...` or focused package tests.
   - Web: `make web-test` and/or `make web-typecheck`.
   - Server build: `go build ./cmd/server`.
4. Build using existing repo scripts or documented commands.
5. Deploy with the existing project path. Do not invent a new deployment mechanism unless the task is to design one.
6. Verify:
   - health endpoint
   - logs
   - user-visible URL or API behavior
   - database/resource readiness if relevant
7. Summarize version, URL, checks, and unresolved risk.

For production deployments or destructive changes, stop for explicit confirmation before the operation.
