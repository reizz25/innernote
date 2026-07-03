# LTV And ROI Modeling

Use when defining or calculating LTV, CAC, ROI, ROAS, payback, or LTV:CAC.

## Metric Definitions

| Metric | Formula | Notes |
| --- | --- | --- |
| CAC | acquisition spend / new paying customers | Use the same cohort and attribution window. |
| CPA | acquisition spend / target conversions | Conversion may be signup, lead, trial, activation, or purchase. |
| ARPU | revenue / active users | Define active user and time window. |
| ARPPU | revenue / paying users | Useful when payer rate varies by channel. |
| Gross LTV | cumulative revenue per acquired user/account | Revenue-only; can overstate value. |
| Contribution LTV | cumulative gross profit after variable costs | Prefer when cost structure matters. |
| ROAS | attributed revenue / ad spend | Usually platform or attribution-window specific. |
| ROI | attributed gross profit or revenue / spend | State whether revenue or profit is used. |
| Payback period | time until cumulative contribution profit >= CAC | Use cohort cumulative curve. |
| LTV:CAC | contribution LTV / CAC | Use mature-enough LTV window or modeled LTV. |

## Rules

- Prefer contribution LTV over revenue LTV when variable costs, refunds, payment fees, infra costs, or support costs matter.
- Do not compare channels using blended LTV if cohort windows, attribution rules, or conversion definitions differ.
- Separate actual observed LTV from modeled/predicted LTV.
- For subscription products, separate new revenue, expansion, contraction, churn, and refunds.
- For B2B products, calculate at account/workspace level when purchase and retention decisions happen there.

## Output

```markdown
| Metric | Definition | Formula | Source | Grain | Window | Caveat |
| --- | --- | --- | --- | --- | --- | --- |
```
