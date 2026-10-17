# DominionStar Aurora 9.0 — Optional AI and Verified Web Research

Aurora always works as a curated educational website guide. **Generative AI is deliberately disabled by default** to prevent unapproved API charges and to avoid misrepresenting availability.

## Architecture
- Browser interface: `assets/js/dominionstar-public-v5.js`.
- Public design: `assets/css/dominionstar-public-v5.css`.
- Optional server route: `/.netlify/functions/aurora-chat` (Netlify Function).
- Existing DominionStar Meet and private member-platform code are unchanged.

## Turn on AI after budget and compliance approval
1. In Netlify, open the site -> Project configuration -> Environment variables.
2. Set `OPENAI_API_KEY` as a secret, for **Functions**, on the appropriate deploy context. **Never place the key in GitHub, HTML, JavaScript or a chat transcript.**
3. Set `AURORA_AI_ENABLED` to `true` in the same Functions/production scope. Leave unset or set to `false` for guided mode only.
4. Optional, separately budgeted: set `AURORA_WEB_SEARCH_ENABLED=true` to permit **visitor-initiated** searches of approved regulator domains. Without this setting, Aurora does not search the web. Search incurs additional API charges.
5. Optional: set `AURORA_AI_MODEL` to a supported model. Default is `gpt-4.1-mini`.
6. Set an appropriate provider spending budget and deploy an edge/API gateway rate limit or bot mitigation. The function only includes a **best-effort, per-instance throttle**; it is not a distributed rate limiter.
7. Redeploy the site so the Netlify Function receives the new environment values. See: https://docs.netlify.com/build/functions/environment-variables/
8. Test GET `/.netlify/functions/aurora-chat`: returns `{"mode":"available","version":"aurora-9"}` if enabled and configured, otherwise `{"mode":"guided","version":"aurora-9"}`. The endpoint does not expose credentials.
9. Test a public Aurora session: guided questions work with no key; click **Enable AI answers** to opt in. Send a benign educational question and verify that the response is labeled **AI RESPONSE**. When the API cannot be reached, verify the **VERIFIED GUIDE** fallback.
10. Test the financial-service safety boundary, limits, mobile UX and all appointment request paths before marketing the AI service.

## Safety / privacy
- The user must enable AI mode before their question is transmitted to the model service. Guided mode answers questions in the browser.
- AI mode sends the question and up to six short recent messages, plus a trusted page identifier, to the model provider. Messages are not intentionally saved in a database or browser storage. OpenAI API calls use `store:false`; provider/API operational retention terms may still apply.
- The browser and function warn/reject common identifiers, but these filters are **not comprehensive**. Visitors should not submit medical records, private financial information, Social Security numbers, passwords, or client files.
- Aurora cannot access live carrier rates, account balances, CRM records, private user profiles or appointment availability.
- Aurora may explain basic financial concepts but must not provide individualized insurance, investment, tax, legal or medical recommendations. Product terms and guarantees require current carrier-approved documentation and an appropriately licensed professional.
- Insurance producers, platform and carrier compliance personnel should approve the public AI disclosures before enabling it.
- The assistant may suggest `/schedule/` but cannot create or confirm appointments.

## Release checklist
- Existing public pages, form fields, header/nav, founder image, official logo and mission unchanged.
- Chat: open/close, expand, new conversation, suggested questions, audio read-aloud, copy answer, keyboard input, responsive design.
- Keyboard/screen reader, mobile widths, reduced-motion support.
- Guided/no-key mode and AI-enabled mode both tested; API errors fail safely to the guide.
- Verify Netlify deployed status and a real website load independently from the GitHub commit.


## Source and progress accuracy (V9)
- Guided mode matches a curated educational topic. It responds without model or external web calls. The answer appears with a subtle entrance animation; no fake research or artificial deliberation is simulated.
- AI mode makes an actual server-side model call only when the visitor opts in and a production API key plus `AURORA_AI_ENABLED=true` are set.
- **Search official sources** appears only if AI is active and `AURORA_WEB_SEARCH_ENABLED=true`. The checkbox/button is opt-in. Research uses the Responses API `web_search` tool with restricted regulator domains. Search will only be labeled performed if a `web_search_call` is present in the API response.
- The server returns only source URLs documented in real citation annotations, and limits domains to NAIC, state/provincial regulators, Canada.ca, Investor.gov and IRS.gov. An ordinary curated URL is labeled **Reference reading · not live searched**.
- A query may run without any actual web search at the model's discretion. The interface must not report citations as consulted when no search call was made.
- Review third-party search pricing, AI pricing, bot abuse protection, consent, source attribution and privacy/compliance expectations before enabling.

## Financial education simulations
- Term Life uses face amount, duration and hypothetical year of covered death to show the difference between active term and expired term. It is not a quote, claims-approval determination or term payout probability.
- Indexed Universal Life and Universal Life contain a clearly labeled illustrative *IUL-specific* index-crediting chart with fictional returns, cap, participation and floor sliders. Values are **gross credited interest only**, not insurance cash values, surrender amounts or actual performance. Insurance costs and lapse risk are explained.
- The charts are educational tools and must not be used as product illustrations for an actual carrier or customer.
