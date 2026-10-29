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

## Security review continuation — partner approval and channel inventory

- The **review-only** SELECT policy draft now verifies **both pair participants**, not just the authenticated viewer. A revoked, rejected, pending or Agent-Code-less partner fails the drafted pair-topic receive predicate; the INSERT predicate already checks both sides. This remains a comment-only proposal, not an applied policy or proven live authorization rule.
- **Known public Broadcast dependencies:** `assets/js/direct-messages.js` typing indicators on `dominionstar-typing-*`, plus the legacy agent call pair and per-user inbox channels in `assets/js/direct-messages.js` and `assets/js/global-call-manager.js`.
- **Known Postgres Changes subscribers:** `assets/js/direct-messages.js` (messages), `assets/js/community-chat.js` (chat/typing), `assets/js/community-hub.js` and `assets/js/community.js` (posts), `assets/js/group-chats.js` (group messages), `assets/js/presence-engine.js` (presence), `assets/js/notifications-center.js`, `assets/js/executive-core.js`, and `assets/js/communication-engine.js` (events). These are channel consumers even though the underlying tables may have their own RLS; the impact of a global public-channel shutdown must be tested.
- **Inventory limitation:** This is an audit of identified browser-side Agent/Community scripts, not an exhaustive audit of every repository channel or the separate Meet service. A complete branch-wide scan and isolated staging tests are still required before switching off the Supabase Realtime global public-access setting.
- Existing `member_profiles` SELECT RLS allows own-profile reads and directory reads only when `profile_visibility='members'`. Therefore the draft's partner lookup may reject calls to approved private-profile agents. Do **not** solve that by widening all profile visibility; design a narrow, reviewed authorization lookup and test it in isolated staging.
- The source regression suite now guards both paired approval predicates and reminds us of noncalling Realtime dependencies. These tests are static and do not validate database policies against real JWTs or WebRTC in two browsers.

**No release switch was enabled, no production Supabase migration was applied, and no Netlify deployment was made in this continuation.**

## Agent website static release safeguard — review only

A new `scripts/check-agent-release-gates.mjs` runs inside `scripts/build-public-netlify.sh` **before** staging rewrites or publication. It rejects the static package when Google sign-in/linking flags are enabled, a private call v2 flag is directly enabled in packaged member JavaScript/HTML, the two call endpoints lose coordinated flag handling, or the proposed Realtime SQL ceases to be comment-only. The automated regression suite deliberately alters temporary copies of each feature flag and expects the guard to refuse the build. Both the Agent QA and review Netlify packaging GitHub Actions workflows now monitor this guard file.

**Boundaries:** A static packaging check is a release-control tripwire, **not** production authorization or cryptographic caller verification. It does not make legacy public calling private, does not configure Google OAuth, and does not replace Supabase RLS, policy tests, two-browser AV tests or actual staging separation. No Google identity-provider configuration, Realtime setting, database privilege, private v2 release flag, billable staging project or production Netlify deployment was changed. When the time comes to launch these features, this guard must be revised as part of an explicitly authorized coordinated release rather than bypassed ad hoc.


## Browser calling lifecycle repair — review branch only

Following the static release guard, the browser Agent calling implementation was audited for timeout/decline defects. In `assets/js/direct-messages.js`:

- **Incoming ring timeout:** removed a contradictory `activeCallAnswered=true` assignment from the missed-call timeout path. A timed-out offer is dismissed with `aria-hidden=true`, the ringing sound is stopped and only the matching offer records the missed call. A stale timeout cannot dismiss a replacement invitation.
- **Outgoing rapid redial:** added an explicitly tracked timeout associated with the original `RTCPeerConnection` instance. After a new call starts, an expired timer for an older call cannot hang up the new connection; repeated Call clicks while a connection exists are rejected rather than overwriting it.
- **Answer and cleanup:** the ring timer stops as soon as an incoming call is accepted, while the outgoing timer is cancelled after an answer and both timers are cleared during call cleanup.
- **Decline from another conversation:** removed the premature assignment of `callPartnerId` that previously caused `ensureCallChannel` to reuse a channel for the wrong conversation. The channel is selected using the incoming caller's identity before sending the decline signal.

These are **review-branch client lifecycle fixes**. `tests/agent-call-lifecycle-runtime-review.test.mjs` executes the extracted browser call handlers with mock sessions, timers, media and channels; it covers timeout, replacement invitation, answered call, rapid redial and decline-channel selection.

**Verified:** [Agent Website QA run 40810381010](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40810381010) completed successfully with **149 passed, 0 failed**. [Review-only Netlify static build run 40810232812](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40810232812) also completed successfully after the website script change.

**Remaining gates are unchanged:** browser mock tests are not two-human/browser WebRTC tests; legacy Broadcast channels remain public; private v2 requires approved per-topic Supabase RLS and independent staging. Google OAuth remains off, no Netlify production deployment occurred, no Supabase policies or settings changed, and the separate DominionStar Meet application was not edited.


## Messages-page incoming call coverage — review-branch repair

**Verified gap:** The `assets/js/global-call-manager.js` global inbox deliberately skips `/direct-messages/`. Previously the Messages page itself only subscribed to a call pair topic for the currently selected conversation. An offer from a different member therefore could be missed while browsing Messages.

**Review-branch repair in `assets/js/direct-messages.js`:**

- The Messages page now also subscribes to its per-agent incoming-call inbox. It uses the existing coordinated legacy/private-v2 topic helper and remains in the same web project; the separate Meet application is untouched.
- Before starting this subscriber, it queries its own `member_profiles` record and requires `verification_status='approved'` and a nonblank Agent Code. Missing membership, RLS denial or network lookup failure stops the new subscription. This browser check supplements, **not replaces**, server RLS.
- Pair and inbox offer notifications pass through the same ringing state handler. Duplicate deliveries do not create two dialogs or timers; a replacement offer with a different SDP from the same caller still updates ringing; a second caller cannot displace the visible offer.
- Caller cancellation dismisses only a matching pending invitation, clears its timer and ringtone; wrong-recipient and self-originated notifications are ignored.
- Accepting a call from another agent switches the Messages conversation to that caller before attempting WebRTC negotiation, and checks that the invitation has not been cancelled during navigation. The inbox channel is removed on page unload.

**Regression results:** [Agent Dashboard QA run 40811034536](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40811034536) completed with **158 passed, 0 failed**, including mocked incoming inbox delivery and rejection of unapproved Agent Codes. [Review-only Netlify packaging run 40811003755](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40811003755) passed after the calling-code change, with no deployment.

**Outstanding:** These are JavaScript regression tests, not real two-browser phone/video delivery tests; existing legacy public Broadcast channels remain a security blocker. Isolated staging and reviewed Supabase Realtime authorization policies are still required before release. No production database or hosting change, feature-flag activation, new paid staging instance, or separate Meet application change occurred.


## Global dashboard incoming-call race and Accept-only handoff — review branch

**Problem confirmed in `assets/js/global-call-manager.js`:** Incoming calls could be cancelled while the asynchronous caller-profile lookup or audio engine initialized, after which stale completion could reopen the overlay or start a ringtone. Separately, the old implementation wrote a merely ringing invitation to session storage; `assets/js/direct-messages.js` would restore the stored offer and run its accept path on navigation, even without an explicit Accept click.

**Review fixes:**

- The global call handler now associates every asynchronous continuation and timer with its exact current invitation. After caller-profile resolution and audio initialization it checks that the invitation is still active; cancellation invalidates it immediately.
- Decline, timeout, caller cancellation and explicit acceptance synchronously stop the ringtone, clear the pending state and timeout, remove incidental handoff data and dismiss the overlay. Remote decline/timeout signaling cannot hold the overlay open during slow network operations.
- The global inbox ignores malformed offers, duplicates, self-originated calls and unrelated concurrent invitations. A new offer from the same caller can supersede an earlier one without allowing the first timer to cancel it.
- **Most importantly, an unanswered ringing offer is never persisted to `ds_pending_global_call`.** Only an explicit Accept action creates an `acceptedFromGlobal:true` handoff containing an `acceptedAt` timestamp.
- The Messages page consumes and immediately deletes a stored handoff, and calls `acceptIncomingCall()` only for a deliberately accepted offer with valid source and recipient, an offer SDP, and a fresh 0–60-second `acceptedAt` timestamp. Stale, unsolicited, corrupt and future-dated offers cannot automatically initiate WebRTC media setup.

**Verification:** [Agent Website QA run 40887921581](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40887921581) passed **171/171** full-suite tests with zero failures. This includes new mocked global inbox race tests and actual Messages-page handoff-handler execution tests. The [review-only Netlify package run 40887743576](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40887743576) also passed with the updated source.

**Limits:** Browser/session-storage guards cannot authenticate a caller's Broadcast payload or substitute for production Supabase RLS. Existing legacy calling is still not considered secure, private v2 and Google OAuth remain disabled, real two-browser media tests remain outstanding, and an isolated staging environment has not been provisioned. These changes apply only to the Agent Dashboard website review branch; no live Netlify deployment, production Supabase modification or separate DominionStar Meet change occurred.


## Active call signaling isolation from chat navigation — review branch

**Verified issue:** The Messages view's `openConversation(memberId)` unconditionally called `ensureCallChannel(memberId)`. During an established call or microphone-permission prompt, selecting a different chat removed the WebRTC call's original pair signaling subscription and redirected subsequent answer/ICE/hangup messages to the wrong pair topic.

**Repair in `assets/js/direct-messages.js`:**

- Normal chat navigation still updates the displayed conversation and typing channel, but does **not** switch the call signal channel while a `RTCPeerConnection` exists, a dialing/microphone-permission attempt is in progress, or an incoming invitation is ringing.
- A separate `callDialing` guard starts before asynchronous permission and signaling operations and clears in `finally`. Additional Call clicks during this period cannot launch overlapping offers.
- The target caller/member ID is captured before any asynchronous permission request. A chat navigation during the microphone prompt cannot change the destination of the subsequent offer or timeout.
- When the call ends, `endActiveCall` cleans its media and call UI and resubscribes to the conversation currently being viewed if it differs from the completed call's partner.
- This is website Agent-to-Agent browser calling, **not** the independent desktop/browser DominionStar Meet app.

**Verified:** [Agent Dashboard QA run 40888624531](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40888624531) — **177 tests passed, 0 failed**. The new `tests/agent-call-conversation-isolation.test.mjs` exercises active calls, ringing offers, pending media permission, ended-call restoration, and normal idle navigation. [Review-only Netlify build run 40888456892](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40888456892) passed after the source change.

**Limits:** VM-based tests do not prove live WebRTC connection quality or authorize server-side signaling. Independent staging, two-user/two-browser tests, Realtime RLS validation, OAuth setup and production release gating remain pending. No production deploy, billable staging creation, Supabase policy activation or Meet app change was performed.
