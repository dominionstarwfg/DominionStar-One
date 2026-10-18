# DominionStar Estate + Living Benefits — Content QA
Date: 2026-10-17
Release scope: **draft PR review only; no production deployment**.

## Experience
- /financial-services/probate-estate/ — retains documented Prince (Minnesota) and Aretha Franklin (Michigan) cases; introduces Living Trusts and links InheritGuard as a **separate professional referral option**. Estate stories do not claim a trust would have prevented every problem.
- /financial-services/living-trust/ — practical revocable trust education: who may investigate one, possible continuity and probate implications, required funding, limits, coordination with attorneys, third-party InheritGuard Network introduction.
- /financial-services/living-benefits/ — insurance rider education covering possible accelerated death benefits and eligibility for defined terminal, chronic or critical illnesses, plus impact on remaining death benefits and possible fees/discounts.
- /financial-services/life-insurance/ — separate Living Benefits feature (not incorrectly designated as a fifth life-insurance category).
- /financial-services/ — separate navigation cards to both.
- /schedule/ — adds "Estate planning / living trust referral" as a selectable reason. No automatic forwarding to InheritGuard.
- Aurora guided and server AI recognize "living benefits", "accelerated death benefits", "living trust", "InheritGuard", and distinguish insurance/legal topics.

## Photo, story and source integrity
- Living Benefits fictional scenario uses an authentic stock photo (two people holding hands at a table) by Priscilla Du Preez, published on Unsplash and marked as free under the Unsplash License.
  Original: https://unsplash.com/photos/two-people-holding-hands-at-table-xM4wUnvbCKk
  License: https://unsplash.com/license
- It is **explicitly fictional**, not a client testimonial, documented insurance claim or performance/benefit illustration.
- Living Benefits references NAIC and state departments of insurance:
  https://content.naic.org/consumer/life-insurance.htm
  https://www.tdi.texas.gov/pubs/consumer/cb018.html
  https://www.aldoi.gov/consumers/AcceleratedBenefits.aspx
- Living Trust education links bar associations and InheritGuard:
  https://www.isba.org/public/guide/livingtrust
  https://www.texasbar.com/
  https://inheritguard.com/
- Do not guarantee tax savings, avoidance of all probate, creditor protection, or automatic living-benefit eligibility.

## QA and compliance before publication
1. Confirm Netlify is serving the correct public website and production branch; last known live-check mismatch remains unresolved.
2. Run GitHub Actions public build and verify no broken/missing routes/anchors, key pages and embedded photo.
3. Mobile/desktop browser check stock image loading, alt/attribution, page size, layout and responsive navigation.
4. Ensure referral compensation/affiliation wording is legally compliant with applicable WFG, carrier and state/provincial laws; get written approval if required before making referrals. The network's own site discusses compensation.
5. Verify the partner's actual service jurisdiction and the correct referral handoff/consent workflow; do not transfer personal or sensitive customer information without authorization.
6. Have a licensed local attorney review trust-specific legal-language accuracy where required.
7. Test Aurora with "living trust versus living benefits", "will a trust always avoid probate?", "Can an accelerated death benefit reduce my beneficiary's payout?", and "Tell me about Prince".
8. Preserve DominionStar Meet and all member-only systems.

## Release gate
Draft PR only. Passing source tests does not prove a live Netlify deployment or current AI service activation.
