# DominionStar Executive OS — Navigation, Community and Recognition Gate

**Status:** GitHub review branch only. Not deployed. No production database mutations or billable Supabase development branch.

## Founder-approved presentation

- Greet all signed-in members with **Good morning/afternoon/evening, [preferred first name]** based on the browser's current local time; never require a stored previous visit.
- Authenticated name, photo or initials, contract level and conditional Founding Member badge remain prominent. Keep all primary actions and navigation **left-aligned**.
- Refined Community feed uses rounded, conversation-style cards; user content is escaped and explicit HTTP(S) links remain clickable. Like, Comment, Repost, Share, Copy Text, Copy Link, and **Download Post Text (.txt)** are available. Downloads cover text and original-post link, **not** unpublished media files.
- Unified caption-first composer: one attachment chooser. Current media files are preview-only and text publishing is disabled whenever draft attachments are present. Secure media upload is **not** live.
- No misleading “2030” in user-facing product branding; legacy class names and filenames may retain it as a technical identifier.

## Verified route mapping (source audit)

| Navigation | Current route | What is actually wired | Gaps before calling it production-complete |
| --- | --- | --- | --- |
| Home | `/member-dashboard/` | Auth session, profile, member milestones, community feed, schedule and status snippets | Authenticated end-to-end and load testing |
| Messages | `/direct-messages/` | Private conversation code, reactions, message attachments and presence | Two-account real-time RLS, file access, mobile testing |
| Community | `/community/` | Posts, comments, reactions, founder moderation and announcements; repost/share/copy/download-text staged | Secure media publication, RLS tests, full social browser testing |
| Calendar | `/appointments/` | Appointment requests and confirmation list | Not a full month/week calendar; event synchronization/notifications need implementation |
| Team Members | `/member-directory/` | Searchable **all-approved-member directory**, ranks, connections | **Not an authenticated downline/team hierarchy.** Needs authoritative sponsor/member relationship and visibility rules |
| Recognition | `/recognition/` (staged) | Approved-member recent Community announcements titled `Leadership Recognition · …`; Founder opt-in after verified rank advancement | Not immutable award history, not a server-authored `recognition.awarded` event; validate announcement RLS, create durable ledger and notification workflow |
| My Profile | `/professional-profile/` | Member profile and editable contact details | Avatar/image and profile update/permission integration tests |
| Settings | `/account-settings/` | Preferences, display settings, notifications, password/session actions | Persistence, notification delivery, full keyboard and privacy QA |
| Ask Aurora | `assets/js/dominionstar-os.js` | Rule-based page finder and guidance that navigates to available pages | **Not a generative AI assistant.** Must be presented as a platform guide until verified AI service exists |

## Founder-selected recognition flow

1. Only an authenticated Founder can access contract-level administration (backend `is_dominionstar_founder` check plus server RPC).
2. Founder picks rank. A **Recognize** checkbox is enabled **only** if the rank advances within TA → Associate → SA → MD → SMD and resulting status is approved.
3. On Save Changes, the existing `founder_update_member` RPC remains the authority. After success, the new code independently reads back the stored rank and status.
4. If verified and explicitly opted in, it attempts to publish a Founder Community announcement: `Leadership Recognition · [member name]`. The Recognition page displays these Community announcements.
5. If announcement insertion fails, the rank change **remains saved** and a separate publication error is displayed. It does not silently pretend an award was created.
6. No automatic congratulation for rank decreases or unchanged ranks, and no fabricated recognition numbers.

## Required release gate before production

- Verify `founder_update_member`, `community_messages` insert policy for official announcements, `list_community_feed`, and author eligibility using isolated Founder, approved agent, unapproved agent, and cross-account tests.
- Confirm Members can **read** only approved recognition posts and cannot impersonate Founder recognition. Frontend titles must not confer verified-award authority by themselves.
- Add a durable, server-controlled recognition ledger or event log and notification workflow before calling Recognition fully smart or automated.
- Confirm the real Team Members data model: parent/child relationship, sponsor, direct/indirect downline, permission boundaries, aggregate counts, current contract levels, and profile access.
- Add calendar event/meeting view and visibility controls rather than equating an appointment request list with a complete calendar.
- Test Community media with restricted storage bucket, signatures/type/size validation, owner policies, moderation and deletion.
- Validate Messages, profile edits, settings persistence, Aurora accessibility and role-bound routes using real authorized accounts.
- Run Node test suite and browser workflows on actual branch checkout. Local syntax/source checks alone do not verify Supabase access or cross-device behavior.

**Deployment:** production remains unchanged.
