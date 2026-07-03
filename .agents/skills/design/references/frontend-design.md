# Frontend Design

Use when implementing, reshaping, or polishing product UI. This reference is portable by default and AnyHost-enhanced when running URL, deployment state, logs, resources, analytics, connected integrations, or agent-run evidence is available.

The goal is production-grade interface work: clear product state, confident visual hierarchy, purposeful styling, useful copy, resilient states, accessible interaction, and verification on real viewports.

## Start

1. Define the surface and job:
   - surface: landing, onboarding, dashboard, console, settings, checkout, editor, report, internal tool, or component
   - audience: first-time user, returning operator, buyer, builder, admin, or support/internal user
   - primary job: the one thing the screen must help them do next
2. Read existing product context when present: `PRODUCT.md`, `CONTEXT.md`, `README.md`, `docs/design/`, current route/component files, CSS/theme/tokens, and screenshots.
3. Inspect the existing UI before editing. Preserve working design-system conventions unless the task is an explicit redesign.
4. Build a context map:
   - portable: repo code, docs, provider config, logs, user-provided screenshots/exports
   - product evidence: analytics, support/sales signals, conversion/activation data, known failure modes
   - AnyHost-enhanced: running URL, deployment status, health, logs, resources, recent deploys, connected analytics, agent runs
5. Decide whether this is a small production edit, a new product surface, a redesign, or a visual polish pass.

## Reference Lock

Do not design from generic taste. Before substantial visual work, lock the direction from available evidence:

```markdown
## Frontend Direction

Surface:
Audience:
Primary job:
Existing conventions:
Evidence used:
Visual direction:
Token commitments:
Layout pattern:
State model:
Signature move:
Reject:
Verification:
```

Use real references when available: existing product screens, competitor/product examples, user-provided screenshots, or researched UI patterns. Do not copy a single reference. Extract decisions and adapt them to this product.

For small fixes, the reference lock can be a short mental checklist. For new screens, redesigns, onboarding, checkout, dashboards, or high-visibility surfaces, write or update a design artifact using `.agents/specs/artifacts.md`.

## Product UI Bias

- Product/user state first: activation, completion, health, readiness, progress, errors, URL, logs, resource status, or the domain-specific state the user needs to act on.
- Provider machinery second: AnyHost, Vercel, Netlify, Railway, Render, Fly, AWS, Cloudflare, Terraform, ECS, RDS, or other provider details should support the user's decision, not dominate the UI.
- Primary action should answer "what do I do next?"
- Empty and failure states should provide direction, not mood.
- Use evidence as evidence, not decoration. Logs, deployment status, analytics, and resource state should explain decisions or actions.
- Avoid fake metrics, fake activity, fake infrastructure, decorative dashboards, and vague AI automation claims.

## Layout And Hierarchy

Design the hierarchy before styling:

1. State: what is true now?
2. Meaning: why does it matter?
3. Action: what can the user do next?
4. Evidence: what supports the state?
5. Secondary controls: what else is available?

Prefer dense, useful product surfaces for operational tools. Use cards only for repeated items, modals, or genuinely framed objects. Avoid nested cards and decorative card grids.

Use stable responsive constraints:

- fixed-format UI such as grids, boards, toolbars, status rows, and counters need explicit dimensions, aspect ratios, or min/max constraints
- text must not overflow buttons, cards, nav, tables, or mobile containers
- long words and URLs need wrapping or truncation with accessible full text
- mobile should restructure secondary copy instead of shrinking dense desktop layouts

## Visual System

For new or substantially changed UI, define a compact token direction before coding:

```markdown
| Role | Choice | Reason |
| --- | --- | --- |
| Canvas | | |
| Surface | | |
| Text | | |
| Muted text | | |
| Primary action | | |
| Status colors | | |
| Border/radius/shadow | | |
| Type scale | | |
```

Rules:

- Match existing tokens when they exist.
- Make palette and typography specific to the product, not the category default.
- Spend boldness in one place: one memorable signature move, not scattered decoration.
- Use semantic color for status and action.
- Do not make one-note palettes where every element is a tint of the same hue.
- Avoid reflex palettes and tropes unless the brief explicitly calls for them: warm cream editorial, generic dark neon SaaS, purple-blue gradients, identical icon cards, or numbered section scaffolds.
- Typography must fit its container. Use sensible line length, clear hierarchy, and readable contrast.

## Components And States

Every meaningful product surface should account for:

- empty
- loading
- pending external action
- partial/configured
- success/ready
- warning/degraded
- failure/error
- permission denied
- no data yet
- stale data

For each state, define:

```markdown
| State | User meaning | Evidence | Primary action | Copy note |
| --- | --- | --- | --- | --- |
```

Copy rules:

- Use the user's vocabulary, not provider internals, unless the provider detail is needed for action.
- Controls should say exactly what they do.
- Keep action names consistent across button, toast, and result state.
- Errors should name what failed and how to recover.
- Empty states should invite the next useful action.

## Interaction And Motion

- Use familiar controls: icons for tool actions, toggles for binary settings, segmented controls for modes, menus for option sets, tabs for views, sliders/inputs for numeric values.
- Keyboard focus must be visible.
- Touch targets must be usable on mobile.
- Motion should clarify sequence, state change, or spatial relationship.
- Do not gate content visibility on animation.
- Respect reduced-motion preferences.
- Avoid bounce/elastic motion unless the product's brand explicitly earns it.

## AnyHost-Enhanced Evidence

When AnyHost context is available, use it to ground UI decisions:

| Evidence | Design use |
| --- | --- |
| Running URL/domain | show launch/readiness, open-product action, shareable result |
| Deployment status/history | explain current state, recent change, rollback/retry affordance |
| Health/logs/errors | design degraded/error states and debugging actions |
| Managed resources | show configured/missing dependencies and setup next steps |
| Connected analytics | prioritize activation, funnel, retention, or usage evidence |
| Billing/ads/organic data | ground conversion and growth surfaces |
| Agent runs/artifacts | show what changed, what was verified, and what needs follow-up |

If AnyHost is absent, use equivalent provider/runtime evidence instead. Do not block design work because AnyHost data is unavailable.

## Implementation Rules

- Use existing components, CSS variables, frameworks, icons, and local patterns.
- Keep edits scoped to the surface being changed.
- Do not introduce a new design system for a local fix.
- Use structured data and product state already present in the app; do not fabricate demo metrics.
- Keep provider details inspectable but secondary.
- Preserve accessibility: labels, roles, focus, contrast, responsive layout, and reduced motion.
- Avoid CSS specificity traps where broad selectors override component classes.

## Verification

Before handoff, perform the narrowest meaningful checks:

- render or build check for the touched surface
- browser/screenshot check for visual work when tooling is available
- mobile and desktop viewport check
- state check for empty/loading/error/success when feasible
- contrast/readability scan for changed text and controls
- no text overlap or overflow
- no fake data introduced

Report:

- what changed
- what evidence/context shaped the design
- what was verified
- any remaining state or viewport risk

## Anti-Patterns

Refuse and rewrite:

- decorative cards with no state or action
- nested cards
- fake dashboards, fake metrics, fake infra activity
- provider-console complexity as the primary experience
- vague AI automation copy
- gradient text as emphasis
- generic icon-card grids
- tiny uppercase eyebrows on every section
- numbered markers unless the content is actually ordered
- over-rounded cards and controls that do not match the product
- text that overflows or occludes nearby content
- motion that hides content or ignores reduced-motion
- gray text on colored backgrounds with poor contrast
