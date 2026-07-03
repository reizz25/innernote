# Experiment Measurement

Use when planning, evaluating, or interpreting A/B tests, feature rollouts, pricing tests, onboarding tests, recommendation/ranking changes, or other product experiments.

## Experiment Readiness

A/B testing is useful only when the product has enough users, event frequency, and measurement maturity to compare variants meaningfully.

Before proposing an A/B test, check:

| Requirement | Question |
| --- | --- |
| Traffic | Is there enough eligible traffic in the target population? |
| Event frequency | Does the measured behavior happen often enough during the decision window? |
| Instrumentation | Are exposure, assignment, outcome, and guardrail events reliable? |
| Randomization | Can users/accounts be assigned without contamination? |
| Decision rule | Is there a clear launch, rollback, or iterate rule? |
| Risk control | Can the experiment start with limited exposure or a safe rollout? |

If these are weak, do not force an A/B test. Use research-driven validation first:

- user interviews or sales calls
- usability tests
- prototype or fake-door tests
- concierge or wizard-of-oz tests
- support-ticket and session review
- logs, funnel inspection, cohort analysis
- qualitative synthesis of failed attempts and workarounds

Use research to find the problem and generate hypotheses. Use experiments later to estimate causal impact at scale.

## PICOT Hypothesis

Use PICOT to write an experiment hypothesis:

| Field | Meaning |
| --- | --- |
| Population | Which users, accounts, segments, geographies, plans, or cohorts |
| Intervention | What changes for the treatment group |
| Comparison | Baseline/control experience |
| Outcome | Primary metric plus guardrails |
| Time | Duration, decision window, and follow-up window |

Template:

```markdown
For [Population], changing [Intervention] compared with [Comparison] will improve [Outcome] during [Time], without harming [Guardrails].
```

## Metrics

Every experiment needs:

- one primary metric tied to the decision
- input/diagnostic metrics to explain movement
- guardrail metrics for quality, retention, trust, cost, latency, failure, or monetization
- segment cuts when the target population matters

Do not optimize only a short-term click or conversion when the product decision depends on retention, satisfaction, trust, or long-term value.

## Interpreting Results

Classify outcomes:

| Result | Meaning | Next step |
| --- | --- | --- |
| Positive significant | Treatment likely beats control on the primary metric | Check guardrails, segments, novelty effects, then launch or ramp |
| Negative significant | Treatment likely hurts the primary metric or guardrail | Roll back, diagnose, and decide whether to redesign |
| Inconclusive | The result does not support a decision yet | Check sample size, MDE, event frequency, duration, assignment, and metric sensitivity |

Do not treat inconclusive as "no effect" by default. If MDE is too large, sample size is too small, behavior penetration is low, or the experiment is too short, the experiment may simply be unable to answer the question.

## Product-Stage Rule

Early products are usually research-driven, not experiment-driven.

| Stage | Preferred validation |
| --- | --- |
| Pre-launch | user interviews, prototype tests, landing page/fake-door tests |
| Low traffic / low frequency | qualitative research, funnel/log review, concierge tests, cohort reads |
| Growing usage | instrumentation, before/after reads, small controlled rollouts |
| Meaningful traffic and stable instrumentation | A/B tests with PICOT and guardrails |
| Mature product | experimentation portfolio, segment-level experiments, long-term holdouts when needed |

When the user asks for an A/B test on a low-volume product, explain the limitation and propose the smallest research-driven validation that can reduce uncertainty now.

## Output

```markdown
## Decision
## Experiment Readiness
## Hypothesis / PICOT
## Primary Metric
## Guardrails
## Required Tracking
## Decision Rule
## If Not Ready For A/B
```
