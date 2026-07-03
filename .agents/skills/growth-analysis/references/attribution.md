# Attribution

Use when connecting acquisition source to product behavior and revenue.

## Required Choices

Define these before analysis:

| Choice | Examples |
| --- | --- |
| Attribution window | 1 day, 7 days, 28 days, first month, subscription trial window |
| Touch model | first-touch, last-touch, multi-touch, platform-reported, product-side cohort |
| Conversion event | signup, lead, activation, purchase, subscription started |
| Revenue window | D1, D7, D30, D90, first invoice, first 3 invoices |
| Identity stitching | device/anonymous -> user -> account/workspace -> billing customer |
| Currency/timezone | account currency, normalized USD, product timezone, ad account timezone |

## Rules

- Ad-platform reported ROI is not the same as product-side cohort ROI.
- Reconcile ad platform data with product events and billing/revenue data when possible.
- Preserve UTM fields and click IDs from landing through signup.
- Prefer account/workspace attribution for B2B when purchase and retention are account-level.
- State whether revenue is first-touch, last-touch, or platform-attributed.

## Common Fields

| Field type | Fields |
| --- | --- |
| UTM | `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` |
| Click IDs | `gclid`, `gbraid`, `wbraid`, `fbclid` |
| Ad hierarchy | `campaign_id`, `ad_group_id`, `adset_id`, `ad_id`, `creative_id`, `keyword_id` |
| Product identity | `anonymous_id`, `user_id`, `account_id`, `workspace_id` |
| Billing identity | `customer_id`, `subscription_id`, `invoice_id` |

## Output

```markdown
| Attribution Rule | Value | Reason | Caveat |
| --- | --- | --- | --- |
```
