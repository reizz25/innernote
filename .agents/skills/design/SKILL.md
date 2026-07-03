---
name: design
description: "Use for product design: feature design, UX flows, frontend design, onboarding, conversion, product screens, UI review, design-system decisions, and shaping a feature before or while implementing it. Portable by default and AnyHost-enhanced when context is available."
---

# Design

Shape product experiences that are clear, measurable, and shippable.

## Start

1. Read `PRODUCT.md` when present.
2. Read `CONTEXT.md` when naming product concepts and when present.
3. Identify the surface, such as landing, login, onboarding, project/app console, agent setup, deployment state, resource state, settings, checkout, activation flow, or internal control surface.
4. If the design needs evidence from real user behavior, product DB, connected analytics, support/sales signals, or acquisition quality, read `../building-like-bytedance/references/data-acquisition.md`.
5. Pair the design with analytics when success is not obvious.

## Workflows

- Feature shaping and UX: read `references/feature-design.md`.
- Frontend implementation/polish: read `references/frontend-design.md`.
- Durable design scope: read `.agents/specs/artifacts.md` and write or update a design artifact when the work defines or materially changes a feature, flow, state model, onboarding path, conversion path, or product screen.

## Product Design Principles

- Make agent handoff unmistakable when the product depends on agent work.
- Show product/user state before provider machinery.
- Treat temporary/demo/pending data honestly.
- Keep color semantic and intentional.
- Design for first-time builders without tutorial walls.
- Avoid provider-console complexity, fake infra dashboards, decorative card grids, and vague AI automation claims.
- In AnyHost-enhanced mode, use running URL, deployment state, health, logs, resources, recent changes, connected analytics, support/sales signals, and acquisition quality as design evidence.

## Output

For feature design, return:

```markdown
## User Job
## Flow
## States
## Edge Cases
## Instrumentation
## Implementation Notes
```

When a design artifact is created or changed, include its path in the final response.
