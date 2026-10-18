# DominionStar V12 — Financial Discovery: QA and Release Gate

Status: **staged for review, not authorized for production deployment until V11 live deployment is verified**.

## Intent
Guide visitors toward useful learning about **Life Insurance**, **Long-Term Care**, and **Annuities** based on the question "Who might consider it, and why does it matter?"

This is educational navigation, **not** a suitability recommendation, quote, underwriting decision, or financial/medical/legal advice.

## New route and behavior
- `/financial-services/discovery/`
- Navigation offers three different educational goals. Clicking a goal updates the headline, who might consider the topic, a decision-framing question, and authoritative references.
- Visitors may open a subject guide or an existing illustration without booking an appointment.
- Built-in educational choice controls make no network requests, collect no identifiers, and use no cookies/local storage.
- Accessibility: buttons with `aria-pressed`, visible keyboard focus, up/down/left/right keyboard navigation, live region for updates, responsive stacking, reduced motion.

## Integration
- Entry teaser links from main Financial Services, Life Insurance, LTC and Annuities pages.
- Aurora guided replies now recognize "Who needs life insurance?", "Why is LTC important?", "Who might consider annuities?" and mixed-topic questions.
- Optional server AI knows the discovery route and is expressly instructed not to determine suitability or collect private medical and financial data.
- Build script ensures all routes, anchors, references and scripts exist; does not change the existing Meet isolation guard.

## Trusted consumer sources
- NAIC Life Insurance: https://content.naic.org/insurance-topics/life-insurance
- NAIC LTC consumer guide: https://content.naic.org/consumer/long-term-care-insurance.htm
- Investor.gov annuities: https://www.investor.gov/introduction-investing/investing-basics/investment-products/annuities

## Review checklist
1. Code review of the V12 staged commit versus production `main`.
2. Verify current V11 production on Netlify: inspect the deployed commit and `/public-release.json`. The last external checker returned an older homepage with Academy; this has not been conclusively resolved.
3. Run the full public Netlify build in CI or the hosting environment.
4. Desktop and mobile: test three selector buttons, reset by choosing another, keyboard focus, sizing and accessibility.
5. Test Aurora questions for life, LTC, annuities, plus non-financial questions, and confirm no sensitive information is solicited.
6. Verify financial-education claims, disclaimers, external-source URLs and international availability language.
7. Check service forms, existing charts and all public routes as regression QA.
8. Do **not** deploy until the Netlify mismatch and any release-blocking tests are resolved.

## Non-goals
- No product recommendation engine, prospect ranking, lead intake or inferred health status.
- No changes to member platform, Meet desktop/browser, founder admin or insurance-carrier integrations.
- No switch to a new homepage/brand or replacement of approved founder photography.
