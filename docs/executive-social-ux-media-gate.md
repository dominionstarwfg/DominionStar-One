# Executive OS 2030 — Social UX revision and media gate

**Review branch only. Not deployed.**

## Design corrections following Founder feedback

- Replaced placeholder sidebar glyphs with accessible inline SVG icons (consistent stroke/spacing, no external icon dependency).
- Simplified the agent sidebar to **Home, Messages, Meet, Notifications, Community, Calendar, Team Members, Recognition, My Profile, Settings, Aurora**. Founder Control is visible only after the existing server permission RPC.
- Removed **Workspace** from the dashboard navigation. **Meet** points to the existing /meet/ route. Removing the visible navigation link does not delete or migrate the old legacy workspace/meeting code; that must be audited separately.
- Removed Academy from primary sidebar navigation; retained training as a findable content feature and renamed visible shortcuts **Training**. Renamed Directory to **Team Members**.
- Colored unread notification/message indicators red, online/presence green, community accents teal, learning accents lavender, and recognition gold, without replacing the executive navy/white layout.
- Moved approved-agent community composer entry and feed before identity/metrics, producing a social-first experience. Pending accounts still lack feed access at the UI level. Backend RLS remains the actual authorization boundary.
- Member message count is calculated from existing unread `executive_events` with message event types. It is not a separately verified direct-message inbox unread count until real integrated testing establishes event coverage.
- Community posts render safe HTTP(S) hyperlinks as escaped anchors and offer a 3-dot menu to **Copy post text** and **Copy post link** using browser clipboard permissions. Deep links to /community/?post=id highlight a corresponding visible post. Test link pagination and revocation in the browser.
- Restored **Login Concept 2** original reference copy: “Where your next chapter begins.” Registration remains full name, agent code, optional SMD, password, Founder approval, no Google OAuth option.

## Multimedia feature roadmap — NOT SHIPPED

Founder wants text, links, photos, flyers, short videos, bubbles, copy and three-dot actions. Text/link/copy are now staged, but **photo/flyer/video upload, playback and moderation remain an implementation gate**.

Plan for non-production Supabase with the user's approval:

1. Design media ownership schema and secured Storage bucket with row- and object-level authorization. Pending/suspended accounts must have zero upload/read privileges; approved members should read only explicitly authorized posts/media.
2. Validate allowed MIME types and actual file signatures, file sizes, quotas, naming, metadata/EXIF handling, malware scanning, and video transcoding where appropriate. Do not directly trust `Content-Type`, filenames or user-supplied `media_type`.
3. Limit attachment counts and video duration/bitrate; prepare responsive thumbnails, posters and aspect ratios to avoid slow scrolling and performance issues.
4. Provide upload progress, cancellation, retry, failure recovery, and media deletion/moderation including retention rules. Avoid exposing unreviewed remote URLs to clients.
5. Provide Founder/moderator abuse reporting and removal workflow; disallow confidential client documents, private policy records and non-consensual media; audit authorship/approvals.
6. Test mouse/keyboard/touch accessibility, slow bandwidth, denied Storage policies, rejected accounts, partial uploads and revoked memberships.
7. Require a verified isolated non-production project and security sign-off before any production storage configuration.

Do not claim media posting works until all of the above is built and tested. Composer currently only promises **Text and Links**.

## Preview files

Separately rendered local visual previews use **demo accounts and sample messages** and are not served from the GitHub application or connected to a real database. Compare against `member-dashboard/index.html`, `member-login/index.html`, and the scoped CSS files. The preview navigation (dashboard/login/article links) exists only in the preview file.

## Regression gate

- `node --test tests/executive-social-ux-review.test.mjs`
- `node --test tests/community-editorial-review.test.mjs`
- `node --test tests/executive-dashboard-2030-review.test.mjs`
- Real browser and authenticated Supabase testing still outstanding. Do not merge or publish based solely on static checks.

## Dashboard social action bar (2026-10-19 review)

- `assets/js/dashboard-social-2030.js` now renders the real approved-member feed with post avatar initials, real Like and Comment counts where authorized queries succeed, a Like selected state, and professional Like / Comment / Repost / Share buttons under every post.
- `assets/js/member-dashboard.js` mounts the isolated feed module only when the member profile status is approved. The `member-dashboard/index.html` script order loads the social module before the authenticated dashboard bootstrap.
- **Like:** `community_toggle_reaction` RPC and refresh from real reaction rows. **Comment:** inline form with authenticated `community_comments` insert and refresh. **Share:** native share sheet when supported or clipboard link. **Repost:** an attributed new member-community discussion pointing to the original post, using the existing `community_messages` insert. This is not a first-class relational repost and does not imply a repost count; add repost-id schema and server-enforced semantics in a separately approved staging migration if desired.
- The social card links are safe HTTP(S), escaped. Counts are shown as unknown (`—`) if their respective metadata reads fail; no fabricated engagement values are introduced into the application source.
- The separate local HTML/PNG preview renders illustrative agents and numbers and is not a real Supabase-backed session. This distinction must remain visible.
- Source-contract and mock-data rendering checks were added to `tests/executive-social-ux-review.test.mjs`, with legacy dashboard contract assertions updated.
- **Remaining release gate:** synthetic-user tests against a dedicated isolated Supabase project, especially approval revocation, RLS on reaction/comment/post tables, repost rate-limits, deleted/locked posts, signed URL exposure, HTML escaping, mobile share support, and updated post authorization. No production database writes or deploys authorized.

