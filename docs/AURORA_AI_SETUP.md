# DominionStar Aurora 7.0 — Production Activation

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
4. Optional: set `AURORA_AI_MODEL` to a supported model. Default is `gpt-4.1-mini`.
5. Set an appropriate provider spending budget and deploy an edge/API gateway rate limit or bot mitigation. The function only includes a **best-effort, per-instance throttle**; it is not a distributed rate limiter.
6. Redeploy the site so the Netlify Function receives the new environment values. See: https://docs.netlify.com/build/functions/environment-variables/
7. Test GET `/.netlify/functions/aurora-chat`: returns `{"mode":"available","version":"aurora-7"}` if enabled and configured, otherwise `{"mode":"guided","version":"aurora-7"}`. The endpoint does not expose credentials.
8. Test a public Aurora session: guided questions work with no key; click **Enable AI answers** to opt in. Send a benign educational question and verify that the response is labeled **AI RESPONSE**. When the API cannot be reached, verify the **VERIFIED GUIDE** fallback.
9. Test the financial-service safety boundary, limits, mobile UX and all appointment request paths before marketing the AI service.

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
