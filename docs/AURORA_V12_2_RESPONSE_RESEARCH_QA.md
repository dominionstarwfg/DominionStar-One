# DominionStar Aurora V12.2 — Response Experience and Research Gate
Date: 2026-10-17
Status: **Review branch only — NOT deployed**.

## Intent
The user requested a natural 3–5 second response presentation and web source lookup when information is not already available. This release distinguishes a paced *display* from actual computational reasoning. It does not invent reasoning steps, simulated web research, or citations.

## Implemented response experience
- When a visitor sends an ordinary safe question, Aurora immediately displays an accurate processing indicator and waits at least **3,400 ms** before presenting the reply, including when a prepared guided answer is already available.
- In guided mode the status is `Reviewing the prepared educational guide…`. It does not claim to have performed AI inference or live research.
- In AI mode the status reflects the active model request (`Aurora is thinking 🤔`).
- When an explicit/source-required question is sent, the status is `Requesting official-source research…` until server confirmation is received.
- Real inference/search may take **longer** than 3–5 seconds. Do not truncate provider work to simulate a 5-second maximum. The UI re-enables after reply/fallback.
- Clearing the conversation invalidates outstanding replies and aborts a live request; late responses will not repopulate a cleared chat.

## Source research (enabled only with server credentials)
- Existing configuration gates are preserved: `AURORA_AI_ENABLED=true` and a server-side `OPENAI_API_KEY` enable model calls. Additional `AURORA_WEB_SEARCH_ENABLED=true` enables official-source searches; keys stay on Netlify, never in frontend JS.
- Source research can be **requested** (visitor activates it, explicitly asks for a source/search, or the curated guide cannot handle the question) or **automatic** (the model can use search when it determines that facts need verification).
- Requested search sends the OpenAI Responses API `web_search` tool with `tool_choice: 'required'`. Automatic research sends `tool_choice: 'auto'`.
- Search domains are restricted to approved U.S./Canadian regulators and investor-education websites. Multiple official sources may be consulted as needed, but the interface never promises a specific number of sources.
- Source cards use verified `url_citation` annotations **only if** a real `web_search_call` occurred; no fabricated URLs, claims of performed research or duplicate citations.
- When research isn't configured, Aurora falls back to transparent guided mode or AI without web search. The UI clearly discloses these limitations.

## Review cases run
1. Guided response shows a preparation status for ~3,401ms.
2. AI mode shows its processing status for ~3,401ms in a mocked fast provider response.
3. Explicit source request sends forced web search; automatic research enables optional search; search-off sends no web-search tool.
4. Mock search returns citations from NAIC and Investor.gov. An unapproved domain is excluded.
5. Source-search-disabled configuration never claims research occurred.
6. Existing guided typo, open-question and follow-up tests passed in the earlier 12.1 gate.
7. JavaScript syntax tests passed; no private member or Meet changes.

## Safety and release conditions
- No live provider/production tests were possible without a configured Netlify endpoint and keys. Mock tests do not confirm AI service availability.
- Rate limiting is still best effort per warm function instance. For public high-traffic AI, enforce account-level spend caps and edge API abuse protection first.
- Do not use the assistant for product suitability recommendations, underwriting decisions, medical opinions or guarantees.
- **Do not merge into production until** a Netlify production-deployment revision is confirmed, server-side AI settings are reviewed, and live browser acceptance (desktop/mobile, reset during pending, citation rendering, 3–5 second pacing) passes.
- Approved DominionStar website, Meet and private member platform remain unchanged.
