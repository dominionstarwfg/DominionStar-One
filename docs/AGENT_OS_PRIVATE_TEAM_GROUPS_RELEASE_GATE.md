# DominionStar One — Private Team Groups release gate (November 13, 2026)

**Scope:** Web-based Agent Platform only. This is separate from DominionStar Meet. Work is in the review-only branch / PR #198. No production deployment or Supabase schema modification is authorized by this draft.

## Product behavior / GroupMe reference

- A Founder-approved agent can create a **private** group with a name and purpose.
- Every new group starts with the creator as **owner**.
- Group owners and authorized admins can invite only approved, directory-visible agents. Invitation creates a pending membership; the invited agent must explicitly accept.
- Only active members can see messages or send messages. Invitations reveal only enough group metadata for a choice to accept.
- Members can write multiline chat messages and share safe HTTP(S) links (including Zoom); the group conversation keeps natural-height bubbles.
- **Unread and refresh:** approved active members have per-group unread counts and private read cursors. The selected conversation refreshes every 20 seconds while the page is visible; an agent can also press Refresh. This is **foreground polling**, not an always-on Realtime transport.
- **In-app group alerts:** new unread messages in other groups display a small on-page notice. Members may opt in to a short sound; sound is off by default. A muted group still has unread counts but does not produce a toast or sound.
- **Preview interaction:** the `Simulate message` control creates only a local sample message in another demo group; selecting that group displays and clears the unread badge. No real user, device, or external service is contacted.
- **No push or email delivery:** Group alerts do not create scheduled worker jobs, push notifications, or email; these remain a future, separately gated feature.
- Non-owner members can leave; owners cannot accidentally orphan a group.
- **Owner group editing:** the owner can revise a group's name and purpose; existing membership and messages remain intact.
- **Moderation:** owners can remove any non-owner member or cancel pending invitations; ordinary admins can remove regular members but **cannot expel another admin or owner**.
- **Invitation decisions:** invited agents can accept or decline. Before accepting, they cannot see previous messages or the active member roster.
- Example previews include a separate **pending invitation** for testing both acceptance and refusal.
- The live backend has NOT been enabled. On Netlify deploy-preview-198, demo group creation, invitations, sending and mute operations are **ephemeral** in that browser session, do not touch Supabase, do not notify anyone, and reset on reload.

**Not yet implemented:** file uploads, voice notes, video calls, invite-by-share-link (unsafe for private member-only groups without a gated accept flow), per-topic subchannels, polls, pinned messages, admin promotion/ownership transfer, background/push or email notifications, group message reactions, or production Realtime. Do not describe these as existing capabilities. The GroupMe product is a design reference, not a service integration.

## Existing data boundary

- Actual group tables and RPC are defined **only as a SQL proposal**:
  `scripts/security/agent-team-groups.DO-NOT-RUN.review.sql`.
- The initial feature flag `DOMINIONSTAR_AGENT_DATA_FEATURES.teamGroupsV1` is **off / undefined**. Authenticated pages fail closed unless it and `publicMemberProfilesV2` are explicitly enabled together after staged migration.
- Authenticated group code reads its own `member_profiles` row **only** to verify Founder approval; peer names are resolved solely from the safe, opted-in `member_public_profiles` projection.
- SQL permissions use RLS on all three public group tables, a narrow privileged `create_agent_group` RPC, and private-schema membership check helpers. No peer identity or content is made public.
- No browser service-role, no open anonymous invites, and no public group discovery.
- Group messages use table API with member RLS; **no group Realtime publication**, no push/email side effects in this release.
- The connected Supabase project is production and its read-only connection returned `28P01 password authentication failed` during this review. This blocks external verification and **must not be bypassed** by making an unreviewed production change.

## Isolated verification

- `.github/workflows/team-groups-isolation-review.yml` uses synthetic roles and a disposable Postgres 16 service. It compiles the exact SQL review draft and tests approved group creation, owner assignment and group edits, invitation/acceptance, member chat permissions, admin-versus-admin removal denial, owner-only admin removal, cancellation and self-decline paths, uninvited and revoked approval denial, anonymous denial, role spoofing rejection, and owner orphan prevention.
- `tests/team-groups-review.test.mjs` checks fail-closed flags, safe rendering, navigation and review-only build behavior.
- The disposable SQL suite also verifies member-only unread counts, exclusion of one's own messages, read-position updates, invited/anonymous/revoked denial, and rejection of future-dated cursors. Browser tests exercise sample unread badges, simulated incoming messages, manual read clearing, and opt-in sound controls at desktop and mobile widths.
- `scripts/review-feed-browser-geometry.mjs` opens the static `/team-groups/` preview, tests pending invite acceptance/decline, owner rename/topic edits, mute, cancellation and re-invitation, creates a sample group, sends a Zoom URL and checks desktop/mobile width and preview asset integrity.
- CI cannot substitute for **real Supabase Auth**, authenticated PostgREST, invitation notification delivery, connected-agent multi-device trials, or a secured staging deployment.

## Required release sequence

1. Obtain a **separate isolated Supabase staging project or approved branch**; do not write to the currently connected production database to test this feature.
2. Confirm the existing safe public-member-profile projection, approval enforcement, legacy migration integrity, and table/API grants match the group proposal. Resolve any naming or RLS conflicts.
3. Apply reviewed SQL **to staging only**, run RLS/synthetic HTTP matrix and real approved/anonymous/invited/revoked-account tests.
4. Add integration verification for member invitations, owner/admin controls, mute, multi-device message ordering, authorization revocation, link escaping, and attempts to enumerate group IDs.
5. Only when staging passes, coordinate versioned SQL migration + frontend deployment, then explicitly enable both flags. Never enable `teamGroupsV1` without the matching RLS tables and `publicMemberProfilesV2`.
6. Production must remain unchanged until the user approves the coordinated release.

## User review links

- Visual demo: `https://deploy-preview-198--melodious-buttercream-a99450.netlify.app/team-groups/`
- Draft integration PR: `https://github.com/dominionstarwfg/DominionStar-One/pull/198`

This feature belongs to Agent Platform **Team Groups** alongside, but distinct from, Direct Messages and Community.
