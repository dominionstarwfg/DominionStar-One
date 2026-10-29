# DominionStar Executive OS (Web) — Agent Calling Access Gate

**Repository:** `dominionstarwfg/DominionStar-One`  
**Branch:** `review/login2-recovery-netlify-hold-20261019`  
**Scope:** Browser-based Agent Dashboard and agent-to-agent calling. **Not** DominionStar Meet, its desktop installer, or Meet source.
**Status:** Client-side guard repaired and verified. Transport authorization still **NOT release-certified**.

## Confirmed defect and review-branch repair

The website's `assets/js/global-call-manager.js` formerly initialized its incoming-call broadcast subscription whenever a cached Supabase session existed, even for members with `verification_status = 'pending'`. On login and recovery pages, it could attempt to initialize unnecessarily and retry every 750 milliseconds without a session.

In the review branch, it now:
- Skips `/member-login/` and `/member-update-password/`.
- Requires a persisted member profile with `verification_status = 'approved'` and a nonblank Agent Code **before** initializing the call UI or subscribing to incoming-call broadcasts.
- Fails closed on missing auth clients, session lookup failures, missing profiles and RLS/network errors, without unbounded unauthenticated retry.
- In `assets/js/member-dashboard.js`, initializes the communications engine only if the stored profile is approved and has an Agent Code.

Tests in `tests/agent-web-calling-approval-runtime-review.test.mjs` simulate approved, pending, rejected, revoked, missing Agent Code, denied lookup, missing session, unavailable client, login/recovery page and Messages page behavior.

**CI:** [DominionStar Executive OS Agent Website QA run 40787572582](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40787572582) — **129 tests passed, 0 failed**; targeted settings tests **16 passed**.

## Important unresolved server-side authorization

The existing `assets/js/global-call-manager.js` and `assets/js/direct-messages.js` currently create **public** Realtime Broadcast channels, including `dominionstar-user-call-<member uuid>` and the pair-specific `dominionstar-call-<uuid>-<uuid>`, using `config:{broadcast:{self:false}}` with no `private:true`.

Read-only inspection of the connected Supabase project on 2026-10-28 found `realtime.messages` has **RLS enabled but zero policies**. That does **not** make public broadcasts member-private: per official Supabase documentation, **public** Broadcast channels can be subscribed to without authenticated per-channel authorization. Browser-side member approval validation is *not a security boundary* for public channel messages, and offer/ICE SDP signaling may include sensitive connection details.

**Do not describe the calling system as fully secured based only on the new client-side gating.**

Required coordinated hardening in a **separate approved release**:
1. Design per-topic RLS rules for `realtime.messages`: only the intended receiver can join `dominionstar-user-call-<uuid>`; only the two approved participants can join a pair channel, with sender/receiver verification and permission for the caller to send the incoming-call notification.
2. Add `config:{private:true,broadcast:{self:false}}` to **both** the Dashboard's incoming call subscriber and the direct-messages call sender/pair channel clients **in the same reviewed release**. A unilateral switch would break call delivery.
3. Validate the `realtime.messages` policy behavior for authorized vs unauthorized users, rejected identities, spoofed topics, stale approvals and repeat subscriptions. For immediate revocations, evaluate how the existing connection's authorization is refreshed.
4. Review and disable `Allow public access` in Supabase Realtime settings only after auditing **other** public Realtime channel consumers, e.g. typing and collaboration. Turning off public access globally before migration could break unrelated features.
5. Validate call offer, answer, ICE, decline, timeout and hangup across two browsers using a dedicated isolated staging backend. Then obtain explicit authorization before production Auth/Realtime configuration changes.

Official documentation:
- https://supabase.com/docs/guides/realtime/authorization
- https://supabase.com/docs/guides/realtime/broadcast

## Production boundary

This task changed only review-branch website files, tests and CI. No live Supabase settings, production DB policies, Netlify deployment, or DominionStar Meet source was modified.
