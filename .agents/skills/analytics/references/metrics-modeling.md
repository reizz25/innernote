# Metrics Modeling

Use when defining activation, product health, dashboards, or success criteria.

## Metric Layers

1. North Star: the compounding product outcome.
2. Input metrics: user actions that drive the North Star.
3. Guardrails: quality, reliability, cost, trust, and safety.
4. Diagnostics: lower-level metrics for debugging movement.

## First-Time Analytics Strategy Document

If the project does not already have an analytics strategy or metric-system document, create `docs/analytics/strategy.md` or the nearest existing analytics docs location.

Required sections:

```markdown
# Analytics Strategy

Product:
Product version:
Owner:
Last updated:

## Project Summary

## Strategic Goal

## North Star Metric

## Core Metric System

## Metric Definitions

## Lifecycle / Funnel

## Open Questions
```

The North Star should describe the compounding product value delivered to the target user. It is not automatically revenue, DAU, pageviews, or signups.

Core metric system should include:

- North Star metric
- current-stage OMTM when the product needs near-term focus
- input metrics
- activation metrics
- conversion metrics
- retention/engagement metrics
- monetization metrics when relevant
- guardrail metrics
- diagnostic metrics

## From Strategy To Metrics

Convert product strategy into measurable behavior:

- PMF wedge -> activation and repeat-use signals
- scale effects -> compounding input metrics
- supply-demand diagnosis -> scarce-side metrics
- positioning -> segment-specific conversion and retention
- 4P -> price, product, channel, and promotion metrics
- operating strategy -> efficiency, quality, and reliability metrics

Do not measure only what is easy to log. Measure the assumption that would change the product decision.

## Lifecycle Growth Diagnosis

For user-growth products, decompose active users before choosing tactics:

```text
Active users = new users + retained existing users + resurrected users
```

Do not mix new users and existing users in one diagnosis. New users usually need activation, onboarding, and key-value discovery. Existing users usually need deeper value, habit, collaboration, content/supply quality, reliability, or expanded use cases. Resurrected users usually need a changed reason to return.

Use RARRA rather than acquisition-first AARRR when the product does not yet have strong activation and repeat use:

1. Retention: do users come back after the first value moment?
2. Activation: do new users reach the key behavior?
3. Referral: do satisfied users invite, share, or pull others in?
4. Revenue: does value convert into willingness to pay?
5. Acquisition: can the product scale traffic profitably?

Before scaling acquisition, identify the key behavior that delivers product value and measure whether new users reach it.

## Metric Hierarchy

Classify metrics by decision level:

| Level | Use | Examples |
| --- | --- | --- |
| T1 strategic | Company/product outcome and current-stage North Star | active accounts completing the core job, retained successful outcomes |
| T2 strategy/input | Product-area or business-line levers that move T1 | activation rate, repeat use rate, conversion rate, supply fulfillment |
| T3 execution | Operational metrics that guide daily work | step completion, latency, failure reason, campaign response, support burden |

T1 should focus attention. T2 should explain what to do. T3 should make work executable.

## Decomposition Models

Use these models before inventing events:

| Model | Use when | Output |
| --- | --- | --- |
| OSM: Objective, Strategy, Measurement | The business goal is clear | target outcome, strategy levers, metric definitions |
| UJM: User Journey Map | The product has a concrete user flow | journey stages, funnel metrics, event candidates |
| Scenario decomposition | Different segments/use cases behave differently | segment-specific metrics and guardrails |

OSM keeps the metric tied to strategy. UJM keeps the metric tied to actual behavior. Scenario decomposition prevents one average from hiding different user jobs.

## Metric Definitions

Every core metric needs a concrete口径:

| Field | Meaning |
| --- | --- |
| Name | Stable metric name |
| Product question | Decision this metric informs |
| Definition | Plain-language definition |
| Formula | Exact numerator, denominator, filters |
| Grain | User, account, workspace, project, session, order, etc. |
| Window | Day, week, month, rolling 7 days, cohort week, etc. |
| Source | Events, tables, API logs, warehouse models |
| Segment | Plan, channel, role, platform, geography, cohort, etc. |
| Exclusions | Test data, internal users, retries, duplicate events |
| Caveats | Known blind spots |

Do not accept a metric name without a formula.

## Example Metric Patterns

Use examples as patterns, not defaults. Replace them with metrics that match the product's actual value loop.

North Star candidates:

- successful outcomes per active account
- retained users who complete the core job weekly
- projects, orders, documents, workflows, or campaigns that reach the intended finished state
- scarce-side successful matches or fulfilled requests

Activation candidates:

- account created and first workspace/project configured
- first meaningful input completed
- first successful output produced
- first invite, integration, payment, import, publish, or export completed
- first return session after the initial successful outcome

Conversion candidates:

- pricing page viewed to checkout started
- checkout started to subscription started
- trial started to paid conversion
- invite sent to invite accepted
- lead captured to qualified lead

Retention and engagement candidates:

- weekly active accounts completing the core job
- repeat successful outcomes by cohort week
- time between first and second successful outcome
- accounts using more than one key feature
- depth of collaboration, automation, or integration usage

Guardrails:

- failure rate for the core workflow
- median time to successful outcome
- cancellation, refund, churn, or downgrade rate
- support/debug incidents per active account
- cost, latency, quality, trust, or safety regressions

Supply-demand or marketplace signals:

- demand attempts from the constrained side
- supply availability and quality
- match/fill/fulfillment rate
- time to match or fulfillment
- failed requests by reason

PMF behavior signals:

- users return to repeat the core job without prompting
- accounts expand usage after first success
- users invite collaborators or connect integrations
- failure is followed by debugging/retry rather than abandonment
- organic sharing, referral, or word-of-mouth behavior appears

Scale-effect signals:

- success rate improves with repeated usage
- time to outcome decreases by cohort
- marginal support burden per outcome decreases
- templates, automation, marketplace depth, or data network effects improve conversion/retention

## Output

For every metric, define:

- exact formula
- time window
- entity grain: user, workspace, project, environment, deployment
- source events/tables
- exclusions
- known caveats

Also classify the metric:

- North Star
- input metric
- guardrail
- diagnostic
- scarce-side metric
- PMF signal
