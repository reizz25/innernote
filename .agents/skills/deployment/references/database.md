# Managed PostgreSQL

Use when an app needs a relational database, migrations, local database tools, or production database debugging through AnyHost.

AnyHost product language is Project -> Environment -> Postgres Resource. Provider details such as RDS instance names, secret IDs, subnets, and Terraform state are implementation details unless the user is explicitly debugging infrastructure.

## Runtime Contract

- A Postgres Resource belongs to one project environment.
- A ready Postgres Resource injects `DATABASE_URL` into the app runtime during deployment.
- Application code must read `DATABASE_URL` from the environment.
- Do not hardcode database hosts, usernames, passwords, or provider secret names.
- Do not create a user-provided `DATABASE_URL` with `anyhost env set`; create or fix the managed resource instead.

## Provisioning

Resource creation is a user-authorized AnyHost action. The local project credential is for context, deploy, and log access; do not call user-session resource APIs with `.anyhost/agent.json`.

Before database-dependent deploys:

```sh
anyhost context
anyhost db list -e dev
anyhost env list -e dev
```

If the required Postgres Resource is missing or still provisioning, create it through the available AnyHost user-facing path, then rerun `anyhost context`.

After a resource becomes ready, redeploy the environment so runtime injection can take effect:

```sh
anyhost deploy -e dev
```

## External Access

External tools such as Navicat, psql, migrations from a laptop, BI tools, or support sessions should use AnyHost Database Access Profiles, not the app runtime credential.

```sh
anyhost db connect -e dev --name Navicat
anyhost db connect -e prod --name "Office BI" --cidr 203.0.113.10/32 --yes
anyhost db reveal PROFILE_ID
```

Rules:

- Production database access requires explicit confirmation.
- External credentials are separate from the app's `DATABASE_URL`.
- Use CIDR allowlists for stable production access when available.
- Revealing connection fields is sensitive. Do it only when the task needs the raw password.
- Do not fetch provider secrets directly as the normal workflow.

## App Integration

Go:

```go
dsn := os.Getenv("DATABASE_URL")
if dsn == "" {
    return fmt.Errorf("DATABASE_URL is not set")
}
```

Node.js:

```js
const dsn = process.env.DATABASE_URL
if (!dsn) throw new Error("DATABASE_URL is not set")
```

Run migrations with the same environment boundary as the deploy target. Do not run production migrations against a dev connection string or vice versa.

## Debugging

Start with product state, then provider evidence:

1. `anyhost context` to confirm the project, environment, resource status, and latest deployment.
2. `anyhost env list -e <env>` to confirm `DATABASE_URL` is generated and masked.
3. `anyhost logs -e <env> --since 10m` for runtime connection errors.
4. `anyhost db list -e <env>` for ready Postgres resources.
5. `anyhost db connect` only when an external client connection is needed.

Common causes:

- resource is not ready yet;
- app was not redeployed after the resource became ready;
- migration uses the wrong environment;
- connection pool is too large for the database plan;
- TLS or driver settings are missing from the app.
