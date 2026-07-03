# Event Tracking

Use when designing, adding, or auditing product analytics instrumentation.

Core rule: track decisions, not clicks. Every event should support a metric, and every metric should support a product decision.

## Workflow

1. Identify the product decision.
2. Identify the lifecycle, funnel, or feature stage.
3. Define the metric before defining events when possible.
4. Analyze the product code to map the user journey.
5. Define raw events and properties.
6. Choose client-side or server-side capture.
7. Define identity: device ID, anonymous ID, logged-in user ID, account/workspace/org ID, session ID.
8. Select an implementation adapter only after the tracking plan is clear.
9. Implement with minimal code changes.
10. Verify event quality.
11. Amend the event tracking document.

## Codebase Journey Analysis

Before designing events, inspect the codebase enough to understand the real product flow:

- routes/pages/screens
- forms and submit handlers
- API endpoints/server actions/controllers
- auth/session logic
- payment/subscription/resource/state-change code
- existing analytics wrappers or SDK initialization
- error boundaries and failure handling

Map the funnel as actual code paths, not imagined product steps:

```markdown
| Step | User intent | UI location | Backend fact | Current code path | Success/failure states |
| --- | --- | --- | --- | --- | --- |
```

Use this map to decide where each event should fire. Intent events usually live near UI handlers. Fact events should live where the durable backend state changes.

## Event Types

| Type | Examples | Notes |
| --- | --- | --- |
| Lifecycle | `user_signed_up`, `user_activated`, `subscription_started` | Major user/account state changes. Usually server-side. |
| Conversion | `checkout_started`, `checkout_completed`, `demo_requested` | Funnel milestones. Use both intent and completion when useful. |
| Feature | `report_created`, `project_published`, `invite_sent` | Meaningful product behavior, not every UI click. |
| System fact | `payment_succeeded`, `import_completed`, `deployment_succeeded` | Facts owned by backend systems. Server-side required. |
| Experiment | `experiment_exposed`, `goal_completed` | Include experiment and variant properties. |
| Failure | `payment_failed`, `upload_failed`, `import_failed` | Include stable error/failure reason, not raw logs. |

## Naming

Use lowercase snake case, preferably `object_action`:

- `signup_completed`
- `checkout_started`
- `project_created`
- `report_exported`
- `invite_sent`
- `subscription_cancelled`

Avoid vague names:

- `click_button`
- `user_action`
- `submit`
- `event_1`
- `tracking_test`

Put context in properties, not in long event names. Prefer `checkout_completed` with `plan`, `source`, and `coupon_code_present` over `checkout_completed_pro_homepage_coupon`.

## Client vs Server

Client-side events are for user intent and UI behavior:

- CTA clicked
- form submitted
- prompt copied
- onboarding step viewed
- feature panel opened

Server-side events are for facts:

- account created
- payment succeeded
- subscription changed
- invite accepted
- resource/import/deployment completed
- permission changed

Do not use a client-side event to claim a backend fact. A click on "Pay" is not `payment_succeeded`; it is `checkout_submitted` or `payment_attempted`.

## Identity Model

Define how events connect across the user journey:

- `device_id`: stable device/browser/app-install identity when available
- `anonymous_id`: pre-login browser/device identity
- `user_id`: stable logged-in user identity
- `account_id`, `workspace_id`, or `org_id`: B2B/customer account identity
- `session_id`: session journey identity

When users log in or sign up, identify/alias anonymous activity to the known user if the analytics platform supports it.

For B2B products, include both user and account identity where possible. Product decisions often happen at account/workspace level, not just user level.

Document the identity rules explicitly:

```markdown
| Identity | Source | Created when | Persisted where | Used for | Merge/alias rule |
| --- | --- | --- | --- | --- | --- |
```

Do not invent user identity from mutable display values like email, phone, or username if a stable internal ID exists.

## Properties

Common properties:

- `source`
- `utm_source`, `utm_medium`, `utm_campaign`
- `plan`
- `role`
- `platform`
- `environment`
- `session_id`
- `account_id` or `workspace_id`

Event-specific properties:

- `feature_name`
- `resource_type`
- `step_name`
- `step_number`
- `duration_ms`
- `error_code`
- `failure_reason`
- `experiment_key`
- `variant`

Keep properties stable. If a value can explode into thousands of unique strings, consider normalizing it.

## Privacy And Data Quality

Do not track:

- passwords, tokens, API keys, session cookies, secrets
- credit card numbers or raw payment details
- private prompts, raw logs, private file contents
- raw email/message content
- unnecessary PII such as phone, government ID, personal address

Prefer stable internal IDs over display names and raw URLs.

## Tracking Plan

Produce or amend an event tracking document before implementation.

If this is the first instrumentation pass, create `docs/analytics/event-tracking.md` or the nearest existing analytics docs location.

Required header:

```markdown
# Event Tracking Plan

Product:
Product version:
Tracking version:
Owner:
Last updated:

## Product Flow

## Identity Model

## Events

## Change History
```

Event table:

```markdown
| Event | Type | Trigger | Client/Server | Properties | Metric | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| signup_completed | lifecycle | account row created | server | plan, source | activation rate | evaluate signup flow quality |
```

Add an owner and location when implementing:

```markdown
| Event | Owner | Code location | Verification |
| --- | --- | --- | --- |
```

## Versioning And Change Control

Treat `event-tracking.md` as the source of truth for the instrumentation system.

- Record product version and tracking version.
- Increment tracking version when adding, renaming, removing, or changing semantics of events/properties.
- Never silently change the meaning of an existing event.
- Prefer adding a new event/property over mutating historical meaning.
- Keep a change history:

```markdown
| Date | Product version | Tracking version | Change | Reason | Author |
| --- | --- | --- | --- | --- | --- |
```

Before shipping a new feature, check whether it creates a new decision, funnel step, state change, or failure mode that needs instrumentation. If yes, amend `event-tracking.md` before or alongside code changes.

## Feature Release Gate

For each new feature, answer these before shipping:

```markdown
| Question | Answer |
| --- | --- |
| What user/account decision will this data inform? | |
| Which North Star, input, activation, conversion, retention, or guardrail metric can move? | |
| What new funnel step, state change, or failure mode is introduced? | |
| Which events/properties need to be added or changed? | |
| Does identity mapping change before/after login or across account/workspace boundaries? | |
| What is the product version and next tracking version? | |
```

If all answers are "no change", record that decision in the feature PR, release note, or analytics doc so the absence of new tracking is intentional.

## Adapter Selection

Choose implementation adapter:

- Custom endpoint or warehouse-first pipeline: read `adapters/custom-api.md`.
- PostHog product analytics: read `adapters/posthog.md`.
- GA4/GTM marketing analytics: read `adapters/ga4-gtm.md`.

If the codebase already has analytics tooling, follow the existing tool unless the user asks to migrate.

## Verification

Verify:

- event fires exactly once
- event fires after the fact it names
- required properties are present
- no PII/secrets leak
- anonymous and logged-in identities connect correctly
- server-side facts are emitted from the backend
- development/test events do not pollute production analytics

When possible, verify using the platform debugger, local test endpoint, network inspector, logs, or a small automated test around the tracking wrapper.
