# PostHog Adapter

Use when implementing event tracking with PostHog.

PostHog is useful for product analytics, funnels, retention, cohorts, session replay, feature flags, experiments, and error tracking. Use the generic tracking plan first; this adapter only covers implementation shape.

## Setup

1. Detect the framework and package manager.
2. Check for existing PostHog initialization.
3. If absent, install the appropriate SDK:
   - web/client: `posthog-js`
   - Node/server: `posthog-node`
   - use platform-specific SDKs for mobile/backend frameworks
4. Store project key and host in environment variables. Do not hardcode keys.

Common cloud hosts:

- US: `https://us.i.posthog.com`
- EU: `https://eu.i.posthog.com`

## Client Events

Use client capture for intent/UI events:

```ts
posthog.capture("setup_prompt_copied", {
  source: "homepage",
})
```

Use `posthog.identify(userId, properties)` after login/signup when user identity is known.

Call `posthog.reset()` on logout when appropriate to prevent identity bleed across shared devices.

## Server Events

Use server-side capture for backend facts:

```ts
posthog.capture({
  distinctId: userId,
  event: "subscription_started",
  properties: {
    plan: "pro",
  },
})
```

Flush/shutdown the server client in short-lived runtimes if the SDK requires it.

## Identity

- Use the same stable user ID across client and server.
- For account-based products, include `account_id`, `workspace_id`, or org equivalent as properties or groups if the product uses PostHog groups.
- Alias/identify anonymous users on signup when supported by the app flow.

## Verification

- Use PostHog live events/debugger.
- Confirm client and server events share the intended distinct ID.
- Confirm events appear in the correct project/environment.
- Confirm session replay/error tracking does not collect sensitive content.
