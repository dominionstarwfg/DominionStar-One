# DominionStar V11 — LTC & Annuities Tools
Release: 2026-10-17

## Purpose
The Life Insurance hub retains its four true life-insurance categories. A prominent
**Long-Term Care & Annuities** section follows those categories, with direct access
from the hero, and corresponding cards on the Financial Services homepage.

### LTC benefit-gap learning tool
Route: /financial-services/long-term-care/#ltc-gap-tool

User-defined values: monthly care cost today, years until need, hypothetical
care-cost increase, current monthly benefit maximum, hypothetical benefit
increase, and simplified elimination days (0–180 in 30-day increments).

Equations:
- Future care cost per month = initial monthly care cost × (1 + annual increase)^years
- Future monthly benefit cap = initial benefit limit × (1 + benefit growth)^years
- Year of care expense = future monthly care expense × 12
- Maximum modeled benefit = min(future monthly care cost, future monthly benefit cap)
  × max(0, 12 − elimination days / 30)
- Modeled family gap = max(0, full-year care expense − modeled maximum benefit)

The model assumes qualifying services and eligible benefits, one continuous
12-month care episode, no other caps or prior claims, and 30-day months.
It does not constitute a price quote, a claims determination or a contract illustration.

### Deferred annuity accumulation learning tool
Route: /financial-services/annuities/#annuity-calculator

User-defined values: one initial premium, hypothetical annual fixed credit rate,
years, and an illustrative surrender charge percentage.

Equations:
- Hypothetical future contract value = premium × (1 + annual rate)^years
- Illustrative surrender deduction = value × hypothetical surrender charge fraction
- Illustrative net after deduction = value − deduction

The model deliberately excludes fees, taxes, market-value adjustments and variable
crediting schedules. It does NOT estimate lifetime payouts or guarantee a current
interest rate or a product return. The site links to Investor.gov and NAIC.

### Acceptance checks
- Life Insurance hub retains four policy type cards and adds distinct LTC/annuity cards
- Both tools are accessible directly via their respective guides and Finance homepage
- Tools immediately produce numerical outcomes and update SVG charts on input
- Both offer reset controls, visible disclaimers, accessible input labels and mobile scrolling
- Aurora's guided annuity and LTC replies link to the corresponding full guides
- Netlify build rejects missing pages, scripts, anchors and undefined links
- Private member dashboard and DominionStar Meet remain untouched
- Source-level test of default/changed/reset values passes; live browser QA pending

References:
- https://content.naic.org/insurance-topics/long-term-care-insurance
- https://content.naic.org/sites/default/files/legacy/documents/prod_serv_consumer_ltc_lp.pdf
- https://www.investor.gov/introduction-investing/investing-basics/investment-products/annuities
- https://www.investor.gov/introduction-investing/investing-basics/investment-products/annuities/variable-annuities

Production publication is not confirmed merely by pushing the repository. Verify
Netlify published commit and test the calculators on desktop and mobile.
