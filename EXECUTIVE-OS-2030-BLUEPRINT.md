# DominionStar Executive OS 2030 — Product Blueprint
**Date:** 2026-10-18
**Status:** Design specification and acceptance criteria only. Not a live release.

## Mission
A premium, modern, agent-only professional network that combines social engagement, training, team communications, progress and meetings. The product's purpose is professional value and connection, not artificial addictive engagement. Cohesive DominionStar identity: navy, refined gold, luminous restrained accents and smooth motion.

## Existing foundation (confirmed in connected source)
- `/member-login/`: email/password login, registration request, reset through Supabase. Founder approval required.
- `/member-dashboard/`: Executive OS home, current dashboard shell, presence and updates.
- `/community/`: composer, discussions, posts, comments, reactions, announcements.
- `/direct-messages/`: messages and conversations.
- `/workspace/`: meetings, drive, chat, calendar, tasks, contacts and other tools.
- `/professional-profile/`, `/member-directory/`, `/account-settings/`, `/founder-control/`: related professional features.
- Supabase database active, relevant member/community/messages tables have RLS enabled. This is not evidence the policies or flows are fully correct.
- Mixed interface styles, release numbers, and overlapping dashboard/workspace concepts need consolidation.

## Design north star: A coherent social + professional home
**Desktop:** Left navigation (Home Feed, Network, Messages, Meet, Academy, Events, Recognition, Resources, Settings); center personalized greeting, post composer, verified social feed; right context panel (upcoming events, agent development, recognition, quick links).
**Mobile:** Feed-first layout with compact bottom navigation and preserved full functionality. Avoid cramped desktop card layouts.
**Visual treatment:** #07172e / deep slate surfaces, restrained satin-gold accents, high-contrast type, professional portrait avatars, clean iconography, luminous interactions without visual noise, polished empty states and no blink/flicker.
**Motion:** Only purposeful fast transitions. Respect reduced-motion settings, keyboard controls, focus indication, touch targets, screen readers, and weak-network resilience.
**Social design:** Useful professional updates, filtered and chronological/following feeds, opt-in notifications, mute/hide content, reporting, moderation, no dark patterns.

## Authentication and identity
1. Keep Supabase Auth as the authentication source; test sign-in, sign-out, reset, expiration, redirect preservation, and multiple devices.
2. Founder approval and agent-code checks are authorization rules enforced on the server/database, not only hidden buttons.
3. Identity verification by agent code must be manually or officially verified before approval; no invented direct WFG lookup/integration.
4. Present member's **Contract Level** (TA, Associate, SA, MD, SMD), not a generic UI role. Privileges stay in a separate secure permission model.
5. Preserve founder account protection; avoid account-demotion regressions.
6. Expose private messages only according to explicit, documented policy; audit administrative access and informed privacy expectations.
7. Protect all private routes and data behind verified sessions and effective RLS policies; public `noindex` is not authorization.

## Executive OS functional modules
- **Home:** Personalized activity, editorial-quality feed, milestone and question post composer, reactions, comments, save and share within approved membership.
- **Network:** Approved agent directory, search and profile, follow/connect, individual visibility settings.
- **Messages:** Reliable direct messaging, delivery/read state, notification center, verified presence; no duplicate/blinking panels.
- **Learning:** Licensing learning paths, Academy content and saved progress.
- **Meet & Events:** Deep links into existing DominionStar Meet, event lists, attendance and scheduled meetings. Do not change the Meet infrastructure in this UI release.
- **Recognition:** Real milestones, approved promotions, founding-member badges, contract levels, no fake data.
- **Aurora:** Site and training assistance, privacy-aware, no unsupported financial advice.
- **Founder:** Separate command center for approval, announcements, content moderation, contract-level updates, audit trails and feature rollouts.

## Release phases
### Gate 0: Security and architecture audit
- Audit key Supabase RLS SELECT/INSERT/UPDATE/DELETE rules, founder access, pending members, private messaging policy and session expiry.
- Inventory legacy versions and navigation collision between Workspace and Member Dashboard.
- Reproduce main user paths across desktop, mobile and older browsers.
- Confirm every agent route fails closed on unauthenticated/unauthorized access.

### Gate 1: Design system and unified navigation
- New login, registration pending and reset flows visually consistent with Executive OS; retain secure auth.
- One home/dashboard at `/member-dashboard/`; Workspace as a connected tool.
- Unified nav/search/notifications/profile across home, community, messages, academy and settings.
- Founder admin stays segregated; Founder view must not accidentally lose elevated access.
- Maintain current approved profiles and data; no renaming/deleting live records.

### Gate 2: Social Home (minimum lovable release)
- Personalized profile; feed sorted chronologically by default; composer, posts, reactions and comments.
- Training/event cards and verified recognition; clear notifications; real empty states.
- Upload safety/moderation, permissions, content reporting, audit trail.
- Live data backed by Supabase, not static mock numbers.

### Gate 3: Network intelligence and polish
- Connections, saves, agent spotlight, thematic groups, personalized but explainable relevance.
- Aurora education, stronger discovery, smooth multi-device preferences.
- Performance tuning, accessibility audit, responsive QA, regression suite.

## Non-negotiable acceptance
- 2-device authentication/presence/messaging test with distinct approved users; no unauthorized reads.
- Pending user cannot access approved-only content, including API responses.
- Founder retains admin functions and can approve without privilege escalation errors.
- Correct profile photo or initials, contract level, unread counts, all without blank states or visual blinking.
- Feed post persists and appears to other authorized agents; reaction/comment saves exactly once; notifications are relevant and dismissible.
- Meets and education open successfully without breaking existing pages.
- Long-scroll performance, slow-network handling, keyboard navigation and mobile layout pass.
- No deployment claimed until the authenticated flows and data rules are actually tested.

## Product standard
No duplicate competing dashboards; no demo content presented as real; no client medical/financial secrets in community posts; no login redesign that weakens access control. One approved production build.
