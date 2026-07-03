# Feature Design

Use when defining a new feature or reshaping a workflow.

Design from user needs, not surface requirements. A user's stated request is often a proposed solution, not the underlying need.

## Workflow

1. Define the user job.
2. Name the product object involved: workspace, project, environment, deployment, managed resource, GitHub Installation, Repository Connection, Agent Key.
3. Separate Needs, Requirements, and Demand.
4. Map the happy path.
5. Add states:
   - empty
   - loading
   - pending external action
   - success
   - failure
   - permission denied
6. Identify trust moments: auth, GitHub install, production confirmation, credentials, deployment, billing.
7. Define instrumentation.
8. Choose a validation mode based on maturity: research-driven for low traffic or unclear needs; experiment-driven only when there is enough traffic and reliable measurement.
9. Specify what should be implemented now and what should remain explicit future work.

## Needs, Requirements, Demand

Use this distinction:

- **Needs**: the original user motivation or problem.
- **Requirements**: product/design requirements derived from the need.
- **Demand**: market quantity or willingness at a price/cost/friction level.

Do not treat Requirements as Needs. "Add a dashboard" may mean "I need confidence the deployment is alive." "Add logs" may mean "I need to understand what broke without knowing AWS."

## Identifying Needs

Look for:

- user behavior and workarounds
- repeated failure points
- moments where users ask agents for help
- successful failures in the category
- tasks users tolerate despite friction
- needs dismissed as impossible or nonexistent

Ask "why now?" for major feature ideas. A strong feature is often enabled by a new shift in agent capability, infrastructure, cost, distribution, or user behavior.

## Feature Shaping

For each feature, define:

| Layer | Question |
| --- | --- |
| Need | What motivation or pain creates this? |
| Requirement | What must the product do to satisfy the need? |
| Demand signal | What behavior proves users care? |
| Wedge | Which user/segment/use case should this serve first? |
| Trust moment | What could make the user hesitate? |
| Measurement | What event or metric proves progress? |
| Validation | What research, prototype, rollout, or experiment should test this? |

Prefer simple, effective early-product experiences for innovators and early adopters. Add polish, explanation, compatibility, and support as the target user moves toward mainstream adoption.

Avoid hiding agent handoff or cloud/resource status behind vague automation copy.

## Research And Experiment Fit

Use qualitative research to generate hypotheses and explain behavior:

- user interviews
- support/sales call review
- usability tests
- prototype tests
- session/log review
- analysis of workarounds and failed attempts

Use A/B tests to estimate causal impact only when there is enough user volume, event frequency, and reliable instrumentation. For early products, do not ask design to choose between variants by fake statistical precision. Instead, define the riskiest assumption and the fastest research-driven validation.

When a design intentionally trades off metrics, define the acceptable range before launch:

```markdown
| Tradeoff | Acceptable range | Why acceptable | Guardrail |
| --- | --- | --- | --- |
```
