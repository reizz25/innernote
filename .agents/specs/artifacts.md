# bitebase Agent Artifacts

Use this spec when a bitebase skill changes product decisions, deployment state, instrumentation, design scope, or growth analysis.

## Rule

Durable product work should leave a durable product artifact. If the work only answers a small question, a chat summary is enough. If the work changes what the team believes, ships, measures, or operates, update the nearest artifact.

## Default Locations

| Domain | Artifact | Create when |
| --- | --- | --- |
| Strategy | `docs/product/strategy.md` or a focused file under `docs/product/` | choosing a product bet, market, segment, pricing, positioning, or roadmap sequence |
| Design | `docs/design/<feature-or-flow>.md` | shaping a feature, onboarding flow, conversion path, console surface, or UX review |
| Analytics strategy | `docs/analytics/strategy.md` | defining North Star, OMTM, activation, metric system, guardrails, or dashboard plan |
| Event tracking | `docs/analytics/event-tracking.md` | adding, changing, or auditing product events and properties |
| Growth analysis | `docs/growth/<decision-or-period>.md` | analyzing CAC, LTV, ROI, channel quality, attribution, paid experiments, or budget allocation |
| Deployment report | `docs/deployments/<yyyy-mm-dd>-<environment>.md` | materially changing deploy config, managed resources, production state, or release evidence |

If the repository already has a better local convention, use it and mention the chosen path in the final response.

## Shared Header

Every new artifact should start with:

```markdown
# <Title>

Date: <yyyy-mm-dd>
Owner: agent
Status: draft | implemented | verified | superseded
Related skill: deployment | analytics | growth-analysis | strategy | design | building-like-bytedance
Product version:
Source context:
```

`Source context` should name the files, APIs, integrations, or user-provided evidence used. Do not pretend missing data was available.

## Required Sections

### Strategy

```markdown
## Decision
## Evidence
## Assumptions
## Options
## Recommendation
## Next Validation
```

### Design

```markdown
## User Job
## Flow
## States
## Edge Cases
## Instrumentation
## Implementation Notes
```

### Analytics Strategy

```markdown
## Product Goal
## North Star Or OMTM
## Metric System
## Activation Definition
## Guardrails
## Dashboard Plan
## Caveats
```

### Event Tracking

```markdown
## Product Flow
## Identity Model
## Events
## Change History
```

### Growth Analysis

```markdown
## Decision
## Data Map
## Metric Definitions
## Channel / Cohort Read
## Bottleneck
## Recommendation
## Caveats
## Next Validation
```

### Deployment Report

```markdown
## Change
## Target
## Commands
## Product State
## Verification
## Risks
## Follow-Up
```

## Change Control

- Prefer updating an existing artifact over creating a duplicate.
- Append a change history row when event semantics, metric definitions, deployment resources, or strategic decisions change.
- Keep facts, assumptions, and recommendations separate.
- Never store secrets, access tokens, raw private prompts, raw logs with credentials, or private customer data.
- For production-risk actions, record the confirmation source and exact date.
