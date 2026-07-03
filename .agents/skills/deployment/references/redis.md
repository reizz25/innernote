# Managed Redis

Use when an app needs cache, sessions, rate limits, short-lived coordination, lightweight queues, locks, or ephemeral counters through AnyHost.

AnyHost product language is Project -> Environment -> Redis Resource. Cluster names, ACL usernames, security groups, and provider endpoints are implementation details unless the task is infrastructure debugging.

## Runtime Contract

- A Redis Resource belongs to one project environment.
- A ready Redis Resource injects `REDIS_URL` and `REDIS_KEY_PREFIX` into the app runtime during deployment.
- Application code must read Redis settings from environment variables.
- Redis is for ephemeral state by default. Durable data belongs in Postgres or object storage.
- Do not overwrite generated Redis variables with `anyhost env set`; create or fix the Redis Resource instead.

Before Redis-dependent deploys:

```sh
anyhost context
anyhost env list -e dev
```

After a resource becomes ready, redeploy the environment:

```sh
anyhost deploy -e dev
```

## App Integration

Always use the injected URL and prefix when present:

```js
const Redis = require("ioredis")

const redis = new Redis(process.env.REDIS_URL, {
  keyPrefix: process.env.REDIS_KEY_PREFIX || "",
})
```

For clients where automatic key prefixing does not cover every command, add the prefix manually for multi-key commands, pub/sub channels, stream names, lock keys, and Lua script keys.

The prefix is useful for naming and observability. It is not a substitute for AnyHost resource isolation. Do not intentionally share keyspaces between apps or environments.

## Command Safety

Avoid broad or destructive Redis commands in application code:

- `FLUSHDB`, `FLUSHALL`
- `KEYS *`
- `CONFIG`, `SHUTDOWN`, `MONITOR`
- long-running Lua scripts
- unbounded scans or blocking operations without timeouts

Use bounded `SCAN` with the assigned prefix when debugging keys:

```sh
SCAN 0 MATCH "<prefix>*" COUNT 100
```

## Local Development

Prefer a local Redis container for tests and development:

```sh
docker run -d --name redis-dev -p 6379:6379 redis:7-alpine
export REDIS_URL=redis://localhost:6379
export REDIS_KEY_PREFIX=local:${USER}:app:
```

CI should use a Redis service container with a job-specific prefix.

## Debugging

Start with:

```sh
anyhost context
anyhost env list -e <env>
anyhost logs -e <env> --since 10m
```

Common causes:

- resource is not ready yet;
- app was not redeployed after the resource became ready;
- missing CA certificates in the container image for TLS connections;
- code forgot `REDIS_KEY_PREFIX` for multi-key commands or pub/sub channels;
- app uses Redis as durable primary storage;
- connection pool or blocking command behavior exhausts Redis capacity.
