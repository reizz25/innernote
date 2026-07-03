# Managed Object Storage

Use when an app needs uploads, media, exports, generated files, signed downloads, or public asset delivery through AnyHost.

AnyHost product language is Project -> Environment -> Storage Resource. Bucket names, prefixes, IAM policies, access keys, and CDN origins are provider details unless the task is infrastructure debugging.

## Runtime Contract

- A Storage Resource belongs to one project environment.
- A ready Storage Resource injects runtime storage variables during deployment.
- Current generated variables are `S3_BUCKET`, `S3_PREFIX`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`.
- Application backend code may use those variables or the platform-provided runtime credential.
- Browser code must never receive AWS credentials.
- Do not overwrite generated storage variables with `anyhost env set`; create or fix the Storage Resource instead.

Before storage-dependent deploys:

```sh
anyhost context
anyhost env list -e dev
```

After a resource becomes ready, redeploy the environment:

```sh
anyhost deploy -e dev
```

## Uploads

Prefer browser -> backend -> object storage:

1. Browser asks the app backend for an upload URL.
2. Backend validates ownership, size, type, and path.
3. Backend creates a short-lived presigned upload URL scoped under `S3_PREFIX`.
4. Browser uploads directly to object storage.
5. App records the object key or public asset URL in its own database.

Backend key construction must stay inside the assigned prefix:

```js
const key = `${process.env.S3_PREFIX}${relativeKey}`
```

Reject absolute paths, `..`, untrusted content types, and user-controlled bucket names.

## Downloads And Public Assets

Use the narrowest access mode:

- private files: signed download URL or app backend proxy;
- public assets: AnyHost/CDN public URL when configured;
- internal app processing: backend SDK access only.

Do not expose the physical bucket and prefix as the main user-facing model. If a URL needs to be durable, prefer an AnyHost-owned or app-owned URL surface.

## Local Development

For local work, prefer a project-specific local storage emulator or explicit development bucket configured outside production. Keep local credentials out of git and `.agents`.

If code only needs to compile or test upload path generation, isolate storage behind a small app-level interface and test key construction without hitting cloud storage.

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
- frontend is trying to use backend-only credentials;
- object keys are missing `S3_PREFIX`;
- CDN/public URL and storage key are being mixed up;
- CORS or content-type rules are too narrow for the upload path.

If the app truly needs mounted directory semantics such as `/data`, report that persistent volume support is a separate product capability and do not fake it with object storage paths.
