# DominionStar Executive Agent Dashboard — web-only scope lock

**Effective:** October 28, 2026. **Repository:** `dominionstarwfg/DominionStar-One`. **Working branch:** `review/login2-recovery-netlify-hold-20261019`.

## Approved project — only the public website's agent experience

Develop a polished, executive-grade **website experience** delivered from `dominionstarld.com` by Netlify. Agents visit the public website, choose Member Login, authenticate, and enter the browser-based DominionStar Executive OS. There is **no new native desktop app, iPhone app, Mac installer, or downloadable application** in scope.

The approved product area consists of:
1. `/member-login/` — executive sign-in and registration, account recovery, mandatory Agent Code and Founder-approved access. Add **Google sign-in** as the only requested additional identity provider. It must preserve existing membership/Agent Code/Founder approval checks and should not silently register or grant access merely because Google authenticated an email. Do not add Apple login unless separately requested.
2. `/member-dashboard/` — premium, executive-style social dashboard with personalized identity, member posts, recognition, announcements, activity, notifications and task shortcuts.
3. `/community/`, `/direct-messages/` and existing member communications — posts, comments, messaging, and calls where supported; verify actual call behavior rather than advertising an untested capability.
4. `/appointments/`, `/member-directory/`, `/professional-profile/`, `/recognition/`, `/account-settings/` and `/founder-control/` — consistent dashboard design, role gates, user settings, and Founder administration.
5. `/meet/` — **a link or launch destination only**. Reuse the existing independent DominionStar Meet browser route. Do not redesign, repackage, debug, or alter DominionStar Meet desktop or browser source within the Agent Dashboard scope.

## Current verified details

- Netlify uses `scripts/build-public-netlify.sh` with publish directory `public-dist`.
- The review branch has the Executive OS member dashboard, agent shell, login, settings, and Founder/Community routes.
- The Member Login source includes a **Google sign-in flow**, but `assets/js/member-login-google-flags.js` currently sets both `googleSignIn: false` and `googleIdentityLinking: false`. These are **not live**. Enable only after Google provider/OAuth callback, verified account linkage, Supabase RLS and approved-member security are tested.
- The standalone Meet project already exists elsewhere in the same repository and may open from the Dashboard. Its Mac installer, toolbar, participant panel and sharing UI are out of scope here.
- Review branch work is **not equivalent to Netlify production deployment**. Before release, validate real approved/pending users, link behavior, Google login and final visual parity, then explicitly approve the Netlify production deploy.
- The past notification queue database-security review remains a separate release blocker if touched. Do not apply unapplied review SQL implicitly.

## Working rules

- Label this effort **DominionStar Agent Dashboard / Executive OS (web)** in updates.
- Do not use ambiguous terminology like “download the app” or “Mac application” when discussing this effort.
- Do not work on the Meet desktop project as part of Agent Dashboard implementation.
- Work only on the approved GitHub review branch until the website release is authorized.
- Keep the existing public site intact, and confirm the right branch/project, check CI, and verify deployment status rather than assuming success.
