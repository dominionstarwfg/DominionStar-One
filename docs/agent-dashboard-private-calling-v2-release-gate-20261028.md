# DominionStar Executive OS — private agent calling v2 release gate

**Project:** Netlify-hosted Agent Dashboard website — **not** the separate DominionStar Meet application.  
**Source:** `dominionstarwfg/DominionStar-One`, branch `review/login2-recovery-netlify-hold-20261019`.  
**Stage:** Review-only implementation and tests. **No Supabase policy changes, no production deployment, no feature activation.**

## Prepared web-only source

- `assets/js/direct-messages.js`: can use private pair topic `ds-call-v2:<smaller_uuid>:<larger_uuid>` and incoming inbox `ds-call-inbox-v2:<recipient_uuid>`, with `private: true`.
- `assets/js/global-call-manager.js`: can listen to the matching private inbox and send decline/timeout signaling over the same canonical pair topic.
- Both sides use the same explicit flag: `window.DOMINIONSTAR_CALL_PRIVATE_V2 === true`. **The flag is not enabled by the project.** Without explicit staging/release configuration, both sides preserve their original public channel names and configurations.
- Private v2 policy proposal: `scripts/security/agent-call-realtime-v2.DO-NOT-RUN.review.sql`. **Every SQL line is commented out intentionally**. It does not apply RLS policies or change Supabase. It describes topic membership, approved Agent Code checks, and restrictions on who may read or send to call topics.

## What the tests establish

- Canonical ordering produces the identical pair topic on caller and receiver.
- Caller and receiver both set `private: true` only in v2.
- Existing legacy signaling remains unchanged with the flag absent.
- Both the call invitation channel and the decline/timeout response path use coordinated topic helpers.
- The RLS proposal is non-executable and no production enablement appears in the frontend.

## Critical blockers before declaring the calling feature secure

1. Set up **independent staging Supabase and Netlify instances**. Do not reuse the production project.
2. Review the proposed `realtime.messages` SELECT/INSERT policies with an authorized database administrator. The current connected production `realtime.messages` table has RLS enabled **but no policies**, and the current public Broadcast channels are not protected by private-channel authorization.
3. Reconcile the proposed target-member check with `member_profiles` visibility policies. Private directory profiles may not be selectable by other approved agents; this can deny legitimate calls. Do not bypass directory RLS casually.
4. Create staging policies and test as approved, pending, revoked, and unrelated members. Attempt subscribe/send to another agent's inbox and a third party's pair topic; they must fail.
5. Test two-browser audio/video offers, answers, ICE candidates, missed calls, decline, timeout, hangup, reconnection and navigation between Dashboard and Direct Messages.
6. **Audit all other public Realtime channel users** (typing, notifications, collaboration, etc.) before turning off global Realtime 'Allow public access'. That server setting may break unrelated consumers; do not flip it as part of this review-only work.
7. Topic-level RLS does **not cryptographically authenticate the broadcast payload's `from` field**. Review impersonation and abuse controls; consider server-mediated or signed signaling for strong caller identity and rate limiting.
8. Deploy both updated browser components, the reviewed policies and the feature enablement only through a single staged release with verified rollback. Do not expose v2 flag while policies are absent.

## Automated checkpoints

- [Executive OS Agent Website QA](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40796678858): **136 passed, 0 failed**, including private/legacy transport runtime checks.
- The review-only Netlify package workflow now also triggers on changes to Agent Dashboard's calling scripts. It creates a static artifact; it does **not** deploy to Netlify.

**The current website calling transport remains legacy and must not be described as fully secured. This work prepares a safer transition but does not complete it.**
