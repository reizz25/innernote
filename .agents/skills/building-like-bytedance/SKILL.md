---
name: building-like-bytedance
description: "Use when building, improving, launching, deploying, instrumenting, analyzing, researching, designing, or growing a software product. Portable by default and AnyHost-enhanced when a repository is bound; coordinates with deployment, analytics, strategy, growth analysis, and design skills when those domains are relevant."
---

# Building Like ByteDance

Build products as measurable systems: clear bet, shippable experience, reliable deployment, useful instrumentation, and fast learning loops.

## How This Skill Loads

This is not a hand-written router that loads every downstream skill. Skill selection is driven by each skill's metadata and the agent runtime's normal skill discovery. Treat this skill like a bootstrap discipline:

1. Recognize the product-building context.
2. Classify the user's product problem before substantial work.
3. Use the relevant domain skill when it is available or already triggered.
4. If no domain skill is loaded, still follow the same product-building standards and read only the references needed for the task.

Domain signals:

- **Deployment**: deploy, database, logs, runtime, cloud, DNS, health, rollback, production issue. Use `deployment`.
- **Analytics**: event tracking, metrics, funnels, retention, dashboards, experiments, product data. Use `analytics`.
- **Growth Analysis**: LTV, ROI, CAC, payback, paid acquisition, channel/campaign performance, attribution, spend efficiency, cohort quality, budget allocation. Use `growth-analysis`.
- **Strategy**: market, users, competitors, positioning, pricing, roadmap, product bets. Use `strategy`.
- **Design**: feature shape, UX, frontend, onboarding, conversion flow, product screens. Use `design`.

## Mode Selection

- **Portable mode**: if no AnyHost binding is present, use the repository, existing provider configuration, code, docs, logs, analytics exports, billing exports, ad exports, screenshots, CSVs, and user-provided evidence. Do not stop product work only because `.anyhost/agent.json` or AnyHost integrations are absent.
- **AnyHost-enhanced mode**: if `.anyhost/agent.json`, `.anyhost/context.json`, or AnyHost agent APIs are available, use them to enrich context acquisition and sync state when the task calls for it.
- **AnyHost deployment service mode**: if the user asks AnyHost/bitebase to deploy or manage resources, follow the deployment skill and current provider adapter workflow.

When several domains apply, reason in this sequence:

1. Strategy when the bet or audience is unclear.
2. Design when the workflow or feature shape is unclear.
3. Analytics before/during implementation when success needs measurement.
4. Growth analysis when acquisition, channel quality, LTV, ROI, or budget allocation matters.
5. Deployment when code must ship or production behavior matters.

For feature work, default to:

```text
strategy/design -> analytics -> implementation -> deployment -> analytics verification
```

For product research, default to:

```text
business goal -> current-stage North Star/OMTM -> lifecycle and funnel diagnosis -> user research or instrumentation -> validation plan -> product decision
```

Use A/B experiments only when the product has enough traffic, event frequency, and measurement maturity to support a meaningful comparison. Earlier than that, prefer research-driven validation: interviews, sales/user calls, usability tests, concierge tests, prototype tests, log review, funnel inspection, and qualitative synthesis.

Product context comes from multiple sources. Deployment creates running-product evidence such as URL, environment, commit, health, logs, resources, and release history. Data acquisition adds evidence from user-bound integrations when available, product code, product DB, analytics, billing, ads, organic channels, provider dashboards/logs/config, user-provided files, agent runs, and artifacts. Treat the combined context as evidence for product iteration.

For data-backed product, analytics, strategy, design, or growth work, read `references/data-acquisition.md` when the task requires user code, product DB, connected integrations, billing, ads, analytics, attribution, or source-of-truth judgment.

## Durable Artifacts

When work changes a product decision, deployment state, instrumentation, design scope, or growth recommendation, read `.agents/specs/artifacts.md` if it exists and create or update the required artifact. If the runtime installed this skill outside `.agents`, use the hosted setup spec at `/agent-setup/specs/artifacts.md`.

When reading or writing AnyHost product state in AnyHost-enhanced mode, read `.agents/specs/agent-api.md` if it exists and use the contract shapes there.

## Product Context

When making product claims, read only the context needed:

- `PRODUCT.md` for product purpose, brand, design principles, and anti-references when present.
- `CONTEXT.md` for domain language when present.
- `README.md` for architecture and operational boundaries.
- Relevant ADRs or design docs only when the task touches that area.

Use product and provider vocabulary appropriate to the repository. In AnyHost-enhanced mode, AnyHost vocabulary such as workspace, project, environment, managed resource, GitHub Installation, Repository Connection, Project Import, Agent Actor, Agent Key, Deployment Actor, and anyhost-owned Cloud is valid evidence vocabulary.

Avoid user-facing language that frames AnyHost as a generic PaaS, cloud console wrapper, or hidden Runway reskin.

## Operating Rules

- Build measurable product systems, not isolated features.
- Prefer current product evidence over generic advice.
- Separate facts, assumptions, and recommendations.
- Preserve user changes.
- Make scoped edits that match the repo's existing patterns.
- Verify with the narrowest meaningful test, build, or runtime check.
- For production-risk work, require explicit confirmation.
