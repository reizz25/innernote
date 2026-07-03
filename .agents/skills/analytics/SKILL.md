---
name: analytics
description: "Use for product analytics work in any product: event tracking, tracking plans, metric definitions, activation, funnels, retention, dashboards, experiment measurement, data quality, analytics SDK integration, or deciding how to know whether a product change worked."
---

# Analytics

Make product work measurable. Start from the decision the data should inform, then define events, properties, metrics, and verification.

## Start

1. Read available product context when product language matters, such as `PRODUCT.md`, `CONTEXT.md`, PRDs, README, route files, analytics docs, or existing tracking plans.
2. Ask or infer the decision: what will the team do differently based on this data?
3. If the task requires existing data from user code, product DB, connected integrations, billing, ads, or analytics tools, read `../building-like-bytedance/references/data-acquisition.md` before analysis.
4. If this is the first analytics/instrumentation pass for the project, create or update both:
   - an analytics strategy document with product context, strategic goal, North Star metric, core metric system, and metric definitions
   - an event tracking document with product version, tracking version, event table, identity model, and change history
5. If the task touches a new feature or release, check whether the feature introduces a new decision, funnel step, user/account state change, conversion, failure mode, or experiment exposure. If yes, amend the event tracking document before or alongside implementation.
6. Separate:
   - raw events
   - event properties
   - derived metrics
   - dashboard views
   - experiment readouts

## Workflows

- Adding or auditing event instrumentation: read `references/event-tracking.md`.
- Defining product metrics before deciding events: read `references/metrics-modeling.md`.
- Planning, evaluating, or interpreting experiments: read `references/experiment-measurement.md`.
- Durable analytics artifacts: read `.agents/specs/artifacts.md` before creating or updating analytics strategy or event tracking docs.
- Future analytics control-plane sync: read `.agents/specs/agent-api.md` before attempting to publish analytics plans to AnyHost.

## Adapter Selection

Use the generic event tracking workflow first. Then choose a platform adapter only when implementation details are needed:

- `references/adapters/custom-api.md`: self-hosted or warehouse-first event collection.
- `references/adapters/posthog.md`: PostHog product analytics.
- `references/adapters/ga4-gtm.md`: marketing-site analytics, ad attribution, GA4/GTM.

## Output

For tracking plans, return:

```markdown
| Event | Type | Trigger | Client/Server | Properties | Metric | Decision |
| --- | --- | --- | --- | --- | --- | --- |
```

For metrics, return:

```markdown
| Metric | Definition | Formula | Source events/tables | Grain | Window | Caveats |
| --- | --- | --- | --- | --- | --- | --- |
```

When an analytics artifact is created or changed, include its path in the final response.
