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
