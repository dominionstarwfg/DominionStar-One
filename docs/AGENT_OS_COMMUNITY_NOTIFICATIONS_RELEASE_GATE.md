# DominionStar One — Community Mentions and Reply Alerts

**Status:** Review-only; NOT ACTIVE. No live SQL, Netlify production
deployment, member notifications or outbound emails were performed.
This is part of PR #198; no DominionStar Meet modifications.

## Audit finding

At the production baseline, browser posting surfaces called
`community_notify_mentions(uuid,text)` after posts or comments were created. The production function is a
SECURITY DEFINER RPC that accepts a caller-supplied body, scans
`member_profiles`, and inserts into the legacy `member_notifications`
table. A live *read-only catalog inspection* confirms that neither
`anon` nor `authenticated` can execute that RPC. The Community browser
ignores the failure.

Separately, the modern Agent OS Notifications page listens to and displays
`executive_events`, not the legacy `member_notifications` table.

Consequently, members may publish successfully and **not receive the intended
mention alert in the OS notification inbox**.

## Review implementation

1. `scripts/security/community-notifications-from-source.DO-NOT-RUN.review.sql`
   proposes AFTER INSERT triggers on both `community_messages` and
   `community_comments`. The trigger reads the actual saved source row and
   emits one `executive_events` event per verified target:
   `community.mention` or `community.reply`.
2. Source provenance is determined by the saved row ID and author, never
   by an independently submitted body or guessed recipient ID.
3. Reply notification is sent to the approved post author when another member
   comments. Explicit `@Name` mentions are sent only to approved,
   directory-visible members and at most five recipients per saved item.
   If the commenter mentions the post author, the author receives the
   reply alert only, not two notices for the same comment.
4. Exact case-insensitive name matching requires character boundaries so
   `@Ann` does not match `@Annabelle`. The matcher treats names
   literally, without SQL LIKE wildcards supplied by members.
5. The source-based uniqueness index prevents replay from inserting duplicate
   `community.mention` and `community.reply` notifications.
6. The legacy RPC retains a non-executable state for ordinary members.
   No trigger function is granted for browser invocation.
7. `assets/js/community-hub.js` stops making the unsuccessful browser
   RPC calls after each post/comment. `assets/js/dashboard-social.js`
   already writes Community comments to the same table; both entry points
   converge on the proposed database triggers.
8. `assets/js/notifications-center.js` and `notifications/index.html`
   add a recognizable Community icon and an explicit Community filter.
   Notification links resolve to `/community/?post=<id>`.
9. The draft selected-priority email migration now checks the actual
   Community source item, original author and recipient before considering
   an opted-in mention/reply for email. **Community email remains
   default-off and the migration remains unexecuted.**

## 2026-11-09 Dashboard and full Feed composer audit

The earlier review fixed Community Hub and comment integrations but missed
the separate Dashboard quick-post composer (`dashboard-social-preview.js`)
and full Feed composer (`feed.js`). Both called the same revoked legacy
`community_notify_mentions` RPC after saving a post, so a successfully
saved post could report a misleading post error when preview refresh failed.

**Draft PR #198 now fixes both additional entry points**:
- Browser clients only insert the saved `community_messages` source row.
  No peer-selected recipient or independently supplied mention body is sent
  to the privileged RPC.
- Both composers report saved-post success even if the subsequent preview
  reload fails. An actual insert failure leaves the original draft intact.
- The 2,000-character composer limit is validated without silent truncation.
- Automated mocked runtime coverage is in
  `tests/agent-social-post-source-integrity-review.test.mjs`, and static
  source assertions now cover all four relevant modules.

**Still NOT live:** server trigger SQL remains unexecuted. Removing the
ineffective client call is not proof that any mention alert is delivered.
No reviewer should deploy these browser changes without the coordinated
server-source notification migration and authenticated staging tests.

## Staging negative and positive tests required

- [ ] Approved A publishes a post mentioning approved/opted-in B; B sees
      exactly one mention in their executive inbox and no private field leaks.
- [ ] A comments on B's post: B sees one reply; mentioning B in that same
      comment does not create a second alert.
- [ ] The Dashboard Feed comment composer and the Community comment composer
      cause the same behavior, without a separate RPC.
- [ ] Private/unapproved/anonymous users are not mention recipients.
- [ ] `@Ann` does not accidentally match `@Annabelle`; repeated mentions
      of the same person do not duplicate notices.
- [ ] A post/comment can mention at most five approved members. A user
      cannot fabricate alerts by calling the old RPC.
- [ ] Deleted posts do not generate alerts; source edits do not replay
      notifications. Stale links fail gracefully.
- [ ] Members only see their own `executive_events` by RLS and cannot
      insert notifications for another user directly.
- [ ] No routine mentions generate emails by default; optional email requires
      explicit opt-in, verified Auth address, a real source row and the
      independently reviewed delivery-worker guard.
- [ ] Verify actual UI and notifications with isolated synthetic users.
      Do not send a test email to any real member.
- [ ] Confirm trigger failure semantics: a failed notification insert rolls
      back the parent post/comment INSERT. This is deliberately conservative
      and requires an explicit product decision before a release.

## Release order

First review and test the P0 private directory split, then the community
source-event trigger, then the optional selected-priority email routing,
with coordinated authorized staging and production migrations. Do not
enable the new frontend and notification routing independently of the
schema release; the production site remains unchanged.

This document and all SQL are **review-only artifacts**, not evidence that
the feature is live or that real authenticated integration tests passed.
