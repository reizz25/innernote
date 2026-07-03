---
name: growth-analysis
description: "Use for growth analysis: LTV, ROI, CAC, payback period, paid acquisition, channel performance, attribution, campaign analysis, cohort quality, budget allocation, and deciding whether growth is constrained by acquisition, activation, retention, monetization, or measurement."
---

# Growth Analysis

Decide whether to spend more, spend differently, or fix the product before spending. Connect acquisition cost to activation, retention, monetization, LTV, ROI, and payback.

## Start

1. Identify the growth decision: increase budget, cut/shift a channel, improve landing page, change targeting, change pricing, launch a campaign, or diagnose ROI/LTV.
2. Read `../building-like-bytedance/references/data-acquisition.md` before analysis that depends on product DB, ads, analytics, billing, or connected integrations.
3. Define the unit: user, account, workspace, customer, subscription, order, project, or marketplace side.
4. Connect acquisition -> activation -> retention -> monetization.
5. Segment by channel, campaign, creative, landing page, cohort date, geography, plan, and persona when available.
6. Diagnose the bottleneck before recommending spend.

## Workflows

- LTV, CAC, ROI, ROAS, payback, and LTV:CAC: read `references/ltv-roi-modeling.md`.
- Paid acquisition funnel and bottlenecks: read `references/acquisition-funnel.md`.
- Attribution windows, UTM, click IDs, identity stitching: read `references/attribution.md`.
- Channel/campaign/cohort quality: read `references/channel-cohort-analysis.md`.
- Paid growth tests and traffic-readiness: read `references/paid-growth-experiments.md`.
- Durable growth decision: read `.agents/specs/artifacts.md` and write or update a growth analysis artifact when the work recommends spend, budget allocation, positioning, pricing, channel changes, or product fixes.

## Rules

- Do not calculate ROI until spend, attribution, product conversion, and revenue data are aligned.
- Never judge a channel only by CAC.
- A cheap channel with poor activation or retention may be worse than an expensive channel with high LTV.
- If activation or retention is weak, recommend product or onboarding work before scaling spend.
- If traffic is insufficient for experiments, use cohort reads and research-driven validation instead of fake A/B confidence.

## Output

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

When a growth artifact is created or changed, include its path in the final response.
