# DominionStar Agent OS — Single-Reaction Release Gate

**Status:** REVIEW ONLY. SQL remains DO NOT RUN. No production or Supabase schema changes.
**Scope:** Feed + Community social engagement; not DominionStar Meet.

## Verified production discrepancy (metadata and aggregate counts only)

The approved Feed offers Like, Love, Celebrate, Support and Insightful, while
the production `community_reactions_reaction_check` only permits Like,
Celebrate, Support and Insightful. The current unique constraint is on
`(message_id,user_id,reaction)`, so members can store several different
reaction types on one post. The current `community_toggle_reaction` RPC
toggles only the selected type without replacing earlier types.

A read-only count check on November 5, 2026 found **9 total stored reactions,
6 distinct member/post pairs and 3 excess reaction rows**. No member names,
IDs, email addresses or post contents were read.

## Agreed social behavior

- Like, Love, Celebrate, Support and Insightful use recognizable icons and
  clear semantic colors. Each member has at most **one reaction per post**.
- Clicking the same choice again removes it.
- Choosing a different reaction replaces the existing one without incrementing
  the number of distinct reacting members.
- A failed request never claims a successful reaction.
- The Feed and Community share the same underlying reaction and counts.
- Comments, reposts and shared links do not modify the member's reaction.
- Desktop/mobile size and full post text stay consistent with the approved
  executive social layout.

## Changes prepared on PR #198

1. `assets/js/community-hub.js`: Community now renders Love and a matching
   five-reaction choice, maintaining existing accessible labels/counts.
2. `assets/css/dominionstar-community-reactions.css`: compact 17px icon
   controls and responsive, wrapping five-choice layout.
3. `scripts/security/community-single-reaction.DO-NOT-RUN.review.sql`:
   the coordinated five-choice constraint, one-choice unique constraint,
   and transaction-safe RPC replacement. The existing RPC signature and
   integer return type remain unchanged.
4. `scripts/security/community-reaction-archive.DO-NOT-RUN.review.sql`:
   a **separate**, explicitly gated option to archive superseded
   historical reactions in a private schema, verify the archive and only
   then keep the most recent reaction per member/post.
5. `tests/community-single-reaction-review.test.mjs`: checks parity, access
   limits, review-only migration and archival-before-delete ordering.
6. `scripts/review-feed-social-interactions.mjs`: real Chromium
   click-through using **synthetic posts and a simulated backend**:
   Love -> Celebrate -> clear -> intentional RPC failure -> Comment ->
   Share -> Repost. Never uses real member data or Supabase credentials.

## Required gating sequence

- [ ] A nonproduction Supabase project with isolated synthetic test members exists.
- [ ] Validate archived reaction records and access protections in staging.
- [ ] Review historical duplicate-resolution policy before ANY record removal.
- [ ] Run the archival candidate on staging, inspect private archive and
      verify that only one row remains for each member/post pair.
- [ ] Apply the single-reaction schema/RPC proposal to staging.
- [ ] Test A's reaction changes in two sessions, replay and concurrent
      requests, anonymous user denial, revoked members and deleted posts.
- [ ] Verify Community and Feed agree on Love and selected reaction, including
      full-page browser interactions across screen sizes.
- [ ] Re-run production RLS/security advisors and audit direct table writes.
- [ ] Approve migration sequencing, monitoring, backups and rollback.
- [ ] Reconcile with PR #198's P0 profile-privacy and notification-email
      release gates before any production merge.

**Until explicitly authorized and validated, PR #198 remains a draft and the
production DB retains the old four-reaction function/constraints. The UI is
prepared, not live.**