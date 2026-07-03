# Data Acquisition

Use when product work requires evidence from user code, product databases, product analytics, billing, ads platforms, organic channels, provider/runtime context, user-provided files, or AnyHost connected integrations when available.

Core rule: build the data map before analysis. Do not calculate metrics, diagnose growth, or make product claims until source authority, identity, time windows, and join keys are clear.

This workflow is portable by default. If the repository is not bound to AnyHost, use local repo context, existing provider config, provider dashboards/logs the user has made available, exports, screenshots, CSVs, and user-provided evidence. If the repository is bound to AnyHost, use AnyHost agent context and connected integrations to enrich the same data map.

## Data Map

Start with available context:

1. Inspect product code and docs enough to understand the real user journey.
2. Inspect DB schema, migrations, ORM models, seed data, and existing analytics wrappers when available.
3. Inspect existing provider/runtime context when available, such as Vercel, Netlify, Railway, Render, Fly, AWS, Cloudflare, Docker, Kubernetes, logs, health checks, deployment history, and environment config.
4. Fetch AnyHost agent context when the repository is bound:
   - `.anyhost/context.json` if already present
   - `/api/agent/context` if the agent token is available
5. Identify connected integrations from AnyHost context, product code, exports, user-provided files, or provider dashboards.
6. Record what each source can answer and where it is unreliable.

Output first:

```markdown
| Data Need | Best Source | Available? | How To Fetch | Join Key | Caveat |
| --- | --- | --- | --- | --- | --- |
```

## Source Layers

| Layer | Source | Use |
| --- | --- | --- |
| Code | routes, screens, API handlers, jobs, ORM schema, migrations, analytics wrappers | real user journey, event semantics, durable state changes |
| Product DB | users, accounts, workspaces, orders, subscriptions, events, audit logs | source of truth for activation, retention, revenue, lifecycle |
| Product analytics | PostHog, GA4, custom event tables | behavior, funnels, cohorts, feature usage |
| Ads | Google Ads, Meta Ads | spend, impressions, clicks, campaign/ad/adset/keyword performance |
| Billing | Stripe, product DB billing tables | revenue, refunds, subscriptions, paid conversion, expansion |
| Organic | Search Console, GA4 | SEO acquisition and non-paid traffic quality |
| Provider/runtime | AnyHost, Vercel, Netlify, Railway, Render, Fly, AWS, Cloudflare, Docker, Kubernetes, logs, jobs, uptime, errors | reliability, release, environment, and failure diagnostics |
| User-provided files | CSVs, screenshots, exports, reports, support notes | evidence when direct integrations are unavailable |

Prefer the product DB for durable facts. Prefer ad platforms for spend and delivery. Prefer analytics tools for behavior and funnel exploration. Reconcile before trusting a blended metric.

## Connected Integrations

Use direct repo/provider/user-provided access when that is what is available. In AnyHost-enhanced mode, AnyHost exposes connected product accounts through control-plane context and dashboard surfaces:

- `google_ads`
- `meta_ads`
- `ga4`
- `posthog`
- `search_console`
- `stripe`
- `resend`

Use this sequence during the control-plane migration:

1. Read `.anyhost/context.json` or call `/api/agent/context` to discover connected integration IDs.
2. If connected integration query endpoints are not listed in context, treat them as unavailable to the agent and use product DB, product code, local exports, user-provided reports, or provider dashboards/logs instead.
3. Never call legacy web-issued agent integration endpoints; old `agent_token` credentials must be rebound to control-plane project credentials.
4. Never ask the user for third-party OAuth tokens when a managed connection exists. If no managed connection exists, ask for the least-sensitive export or access path that can answer the question.
5. Do not expose raw secrets, access tokens, private prompts, private file contents, or unnecessary PII in analysis artifacts.

Provider operation patterns:

| Integration | Useful operations | Data |
| --- | --- | --- |
| `google_ads` | `list_accessible_customers`, `search` | customers, campaigns, spend, clicks, impressions, conversions through GAQL |
| `meta_ads` | `list_ad_accounts`, `insights` | ad accounts, campaign/adset/ad insights, spend, clicks, impressions, actions |
| `ga4` | `list_properties`, `run_report` | traffic source, landing page, sessions, active users, key events |
| `posthog` | `list_projects`, `query` | product events, funnels, cohorts, feature usage through HogQL |
| `stripe` | `account`, `balance`, `list_charges` | payments, charges, refunds, billing evidence |
| `search_console` | `list_sites`, `search_analytics` | organic query/page impressions, clicks, CTR, position |

## Join Keys

Check these before joining:

| Key family | Fields |
| --- | --- |
| UTM | `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` |
| Click IDs | `gclid`, `gbraid`, `wbraid`, `fbclid` |
| Ad hierarchy | `campaign_id`, `ad_group_id`, `adset_id`, `ad_id`, `creative_id`, `keyword_id` |
| Product identity | `device_id`, `anonymous_id`, `user_id`, `account_id`, `workspace_id`, `session_id` |
| Revenue identity | `customer_id`, `subscription_id`, `order_id`, `invoice_id`, `account_id` |
| Time/currency | timezone, date grain, attribution window, revenue window, currency |

If join keys are missing, say so and propose instrumentation or import changes before presenting precise ROI, LTV, or funnel conclusions.

## Source Authority

Use this hierarchy unless the project proves otherwise:

- Spend and delivery: ad platform.
- Durable product state: product DB.
- Payments and refunds: billing provider or DB billing tables.
- User behavior exploration: event analytics.
- Traffic source exploration: GA4, Search Console, UTM fields.
- Runtime/release evidence: AnyHost or current deployment provider.
- Code path semantics: source code and tests.

Ad-platform ROI is not product-side cohort ROI. GA4 conversions are not necessarily paying customers. Analytics revenue is often less authoritative than billing revenue. Product DB revenue may miss refunds, taxes, fees, or subscription state if billing sync is incomplete.

## Output

End data acquisition with:

```markdown
## Data Sources
## Source Authority
## Join Keys
## Missing Data
## Caveats
## Next Query Or Instrumentation Step
```
