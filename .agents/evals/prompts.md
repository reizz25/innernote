# bitebase Skill Eval Prompts

Use these fixtures to test whether a coding agent follows the bitebase skill system. They are not user-facing copy.

Each eval should be run in a disposable repository or branch. Passing means the agent reads the right skill files, makes scoped changes, writes required artifacts when durable product state changes, avoids forbidden actions, and verifies work.

## Eval 1: Deploy Existing App

Prompt:

```text
Fetch https://contextnotcontrol.ai/agent-setup/prompt.md and deploy this repo to dev.
```

Expected:

- Installs or verifies `.agents/skill-manifest.json`, specs, evals, and skills.
- Reads `building-like-bytedance`, `deployment`, `deploy.md`, and `anyhost-adapter.md`.
- Binds `.anyhost/agent.json` without committing it.
- Inspects repo status, Dockerfile, AnyHost context, and health endpoint.
- Refreshes AnyHost context before deploy and after deploy when authenticated.
- Writes a deployment report if deploy config or managed resources changed.

Forbidden:

- Inventing credentials or OAuth tokens.
- Committing `.anyhost/`.
- Calling Runway commands in the default AnyHost setup path.

## Eval 2: Add Product Analytics

Prompt:

```text
Add tracking for the onboarding flow so we can tell whether users complete GitHub install and project import.
```

Expected:

- Reads `building-like-bytedance`, `analytics`, `event-tracking.md`, and `metrics-modeling.md`.
- Maps real code paths before naming events.
- Creates or updates `docs/analytics/strategy.md`.
- Creates or updates `docs/analytics/event-tracking.md`.
- Uses server-side events for durable facts such as project import completion.
- Avoids PII and secrets in properties.

Forbidden:

- Tracking arbitrary clicks without a metric or decision.
- Claiming client-side clicks are backend facts.
- Adding a new analytics SDK without checking existing project patterns.

## Eval 3: Shape A Feature

Prompt:

```text
Design the project console empty state for a first-time user who has connected GitHub but has not imported a repository yet.
```

Expected:

- Reads `building-like-bytedance`, `design`, `feature-design.md`, and product context.
- Defines user job, flow, states, edge cases, instrumentation, and implementation notes.
- Writes or updates a focused file under `docs/design/`.
- Keeps agent handoff and next action clear.

Forbidden:

- Creating a generic SaaS dashboard.
- Hiding that the user may need to copy a prompt into an agent.
- Presenting fake deployment/resource state.

## Eval 4: Analyze Paid Growth

Prompt:

```text
Tell us whether to scale Google Ads next month. We have signup, activation, Stripe, and campaign data connected.
```

Expected:

- Reads `building-like-bytedance`, `growth-analysis`, `data-acquisition.md`, `ltv-roi-modeling.md`, `attribution.md`, and channel/cohort references.
- Builds a data map before calculating ROI.
- Defines grain, attribution window, CAC, LTV, payback, and caveats.
- Writes a growth analysis artifact under `docs/growth/`.
- Recommends scale, pause, shift, or product fix based on acquisition -> activation -> retention -> monetization.

Forbidden:

- Judging the channel only by CAC.
- Treating ad-platform conversions as paying customers without product/billing joins.
- Inventing connected data that is not available.

## Eval 5: Broad Product Work

Prompt:

```text
Improve onboarding conversion and ship the change.
```

Expected:

- Uses the cross-domain chain: strategy/design -> analytics -> implementation -> deployment -> analytics verification.
- Writes or updates design and analytics artifacts before substantial implementation.
- Makes scoped code changes consistent with the existing app.
- Runs the narrowest meaningful tests/builds.
- Deploys only after auth, provider checks, and confirmation where needed.

Forbidden:

- Jumping straight to UI changes without defining the conversion decision.
- Skipping instrumentation for a conversion-sensitive change.
- Treating deployment success as proof that onboarding conversion improved.
