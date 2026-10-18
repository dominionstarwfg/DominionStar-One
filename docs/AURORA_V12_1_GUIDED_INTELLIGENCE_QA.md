# Aurora V12.1 Guided Intelligence — Review Gate

**Status:** Reviewed and staged only. Do not merge or publish before the already required V12/Netlify acceptance gate.

## Screenshot defects repaired
- A visitor's "what can you tell mew" previously produced a generic "no verified answer" fallback. Guided normalization now handles several common spelling mistakes, open-ended introductory prompts and greetings.
- Guided answers use the current educational page as context, for example Long-Term Care or Annuities.
- Follow-up expressions such as "tell me more," "why is that important?" and "can you tell me more about it" use the prior educational topic within the current browser chat. Conversations are not persisted.
- The previous reply renderer appended "Request a conversation" even when the primary action was already the appointment link. All actions are now deduplicated, and appointment links are only shown where they are a relevant primary answer.
- The header previously displayed the stale "Aurora 7.0". This review build uses "Aurora 12.1" and a preview version string for traceability.
- Prepared/curated answers are labeled `AURORA · GUIDED KNOWLEDGE` rather than implying an answer was verified by a live source search.
- New welcome wording clarifies that guided answers come from prepared educational material. Search sources are labeled as researched only if an actual server-side web-search tool ran.

## Test record
- 23 representative natural-language and product-intent cases passed.
- Follow-up phrasing, including "why is that important?" and "can you tell me more about it," passed.
- UI action test: appointment topic produced exactly one appointment link; a researched answer with a repeated source returned the source only once; guided responses can show separately labeled independent reading sources.
- JavaScript syntax valid in the V8 engine.
- No API keys, private data, account identifiers, browser storage or network requests added for guided mode.
- Existing strict handling of quote requests, suitability questions and separate optional AI/source-research configuration preserved.

## Boundaries and remaining limitations
Guided mode is authored intent matching with controlled conversational context, **not** a general-purpose LLM. It cannot independently reason through unseen questions or perform live search. Real AI answers require `AURORA_AI_ENABLED=true` plus `OPENAI_API_KEY` in the Netlify **server** environment; official-source search additionally requires `AURORA_WEB_SEARCH_ENABLED=true`. Never place the key in frontend JS or chat. Do not falsely animate a search or claim research was performed when it was not.

## Review before release
1. Verify which Netlify deployment owns `dominionstarld.com` and that V11 public pages actually loaded.
2. Merge only after the new V12 financial-discovery path is accepted and its build passes.
3. In browser, test "what can you tell mew", "what can you tell me?", "hello Aurora", "who needs life insurance?", "tell me more", "which life insurance is best for me?", and an exact quote request.
4. Check there are no duplicated "Request a conversation" actions and that cross-topic navigation works on desktop and mobile.
5. Confirm guided-mode answers never claim to have searched the web. Enable optional AI only after explicit review of usage limits, privacy and API cost.
6. Verify public website and member/Meet isolation. Do not touch member or Meet code as part of this change.

**No production main update in this work.**
