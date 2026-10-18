# DominionStar | Qualified Traffic Launch Playbook
Updated: 2026-10-18

## Objective
Grow **qualified** traffic to dominionstarld.com and turn that traffic into legitimate career inquiries and financial-education consultation requests. Success is measured by valid inquiries and meaningful follow-up, not raw clicks.

## Two separate journeys
1. **Recruiting and mentorship** — source → career/licensing/leadership resource → /join/ → Netlify career inquiry.
2. **Financial education** — source → topic-specific education → /consultation/ or /schedule/ → Netlify consultation/appointment inquiry.
Never mix claims about hiring, insurance, legal services, or financial outcomes. Personalized insurance recommendations require appropriate licensing. Trust drafting and tailored legal advice belong with licensed attorneys.

## Approved campaign-link convention
Use lowercase UTM tokens without spaces or personal information; change `utm_content` for each post. Keep campaign names stable to compare content.

- Facebook recruiting (organic):
  https://dominionstarld.com/join/?utm_source=facebook&utm_medium=organic_social&utm_campaign=oct2026_recruiting&utm_content=leadership_intro
- LinkedIn recruiting (organic):
  https://dominionstarld.com/opportunity/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=oct2026_recruiting&utm_content=licensing_guide
- Facebook financial education (organic):
  https://dominionstarld.com/financial-services/?utm_source=facebook&utm_medium=organic_social&utm_campaign=oct2026_financial_education&utm_content=family_protection
- Living Trusts education (organic):
  https://dominionstarld.com/financial-services/living-trusts/?utm_source=facebook&utm_medium=organic_social&utm_campaign=oct2026_financial_education&utm_content=trust_basics
- Email invitation to career information:
  https://dominionstarld.com/join/?utm_source=email&utm_medium=owned_email&utm_campaign=oct2026_recruiting&utm_content=mentorship_invite

**Important:** These are sample trackable links, not evidence that a campaign is already published or producing leads.

## First 30 days: operating cadence
**Week 1 — Measurement and QA**
- Verify Netlify Forms registers each static HTML form and that a consented test submission reaches /thank-you.html.
- Reconcile a test form submission with the Netlify Forms inbox and GA4 `generate_lead` event.
- Confirm GA4 `ds_contact_intent` and `ds_form_start`; configure `generate_lead` as a key event where appropriate.
- Configure the GA4 custom dimension `lead_type` for event reporting if the account supports it.
- Check Google Search Console indexing for key pages including /financial-services/living-trusts/.

**Week 2 — Consistent organic distribution**
- Publish 2 recruiting education posts and 2 financial education posts each week, each with one clearly relevant trackable link.
- Explain licensing steps, mentorship, long-term care preparation, life insurance basics, and probate/trust coordination without guaranteed financial or career results.
- Repurpose existing educational meeting takeaways into compliant site articles and social posts.

**Week 3 — Optimize**
- Compare sessions, landing pages, engaged sessions, `ds_form_start`, `ds_contact_intent`, and confirmed Netlify submissions by traffic source.
- Identify pages with high engagement but few meaningful inquiry clicks; improve on-page CTAs without interruption or dark patterns.
- Refine headlines and content only when the baseline reveals a specific issue.

**Week 4 — Controlled expansion**
- Retain channels that yield genuine, qualified inquiries.
- Test one new educational topic per audience with unique `utm_content`.
- Only consider paid spend after tracking and follow-up processes are validated, with jurisdictional and advertising compliance review.

## Reporting definitions
- **Site sessions**: GA4 measured sessions; sampling, consent and blockers may affect counts.
- **Contact intent**: `ds_contact_intent` event for appointment, consultation, career, phone, or email link.
- **Form start**: `ds_form_start` recorded on first form interaction.
- **Lead indication**: `generate_lead` sent only when a form submit is followed by the confirmation page in the same browser session within five minutes.
- **Operational confirmed lead**: a real, non-spam submission visible in Netlify Forms. The source of truth for lead counts is Netlify submissions, not GA4 alone.
- **Lead conversion rate**: operational confirmed leads / appropriately attributable visits to the funnel (define denominator consistently); use separate rates for recruiting and financial education.
- **Qualified inquiry**: reviewed and relevant, without misleading or fabricated performance numbers.

## Privacy / operational boundaries
- Analytics events must not contain names, emails, phones, message text, health details, or full URLs with query parameters.
- UTM values must be nonsensitive campaign labels.
- Campaign attribution is scoped to the visitor's browser tab session; GA4 attribution is separate.
- The current browser-side confirmation technique is a useful signal, not server-side proof of receipt.
- Ensure form notifications are configured for authorized recipients and follow up on confirmed requests using approved contact methods.

## Open verification items
- Netlify production deployment and form detection.
- Google Analytics reporting configuration and key event designation.
- Search Console sitemap submission and indexing.
- Mobile visual inspection and end-to-end test lead reconciliation.
