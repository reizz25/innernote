# GA4/GTM Adapter

Use for marketing-site analytics, traffic attribution, ads conversion tracking, and Google ecosystem reporting.

GA4/GTM is usually weaker than product analytics tools for deep product behavior, but it is often the right adapter for acquisition, landing pages, paid campaigns, and conversion reporting.

## When To Choose

- marketing website conversion tracking
- ad platform conversion reporting
- UTM and channel attribution
- lightweight funnel reporting
- existing Google Tag Manager setup

## Event Design

Use the same tracking plan principles:

- event names are lowercase snake case
- properties are stable and non-sensitive
- conversions are meaningful milestones, not every click

Common events:

- `cta_clicked`
- `form_submitted`
- `demo_requested`
- `signup_started`
- `signup_completed`
- `checkout_started`
- `purchase`

## GTM Data Layer Pattern

Prefer pushing structured events to `dataLayer` and letting GTM route them:

```js
window.dataLayer = window.dataLayer || []
window.dataLayer.push({
  event: "demo_requested",
  form_location: "pricing_page",
  plan_interest: "team"
})
```

Avoid scattering vendor-specific tags throughout product code when GTM is already used.

## GA4 gtag Pattern

If using gtag directly:

```js
gtag("event", "signup_completed", {
  method: "email",
  plan: "free"
})
```

## UTM Rules

Preserve standard UTM fields:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`

Use lowercase and consistent separators. Store first-touch/last-touch attribution according to the product's reporting needs.

## Verification

- GTM Preview mode for triggers and variables.
- GA4 DebugView for event arrival.
- Browser network inspector for duplicate tags.
- Confirm conversion events are marked as conversions in GA4 when needed.
- Confirm consent mode/privacy requirements are respected.
