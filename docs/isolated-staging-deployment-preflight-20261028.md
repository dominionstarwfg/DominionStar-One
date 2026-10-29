# DominionStar — Isolated staging deployment preflight (NOT DEPLOYED)

**Review branch:** `review/login2-recovery-netlify-hold-20261019`  
**Prepared:** 2026-10-28  
**Status:** Source staging gates and synthetic CI rehearsal passed; no real staging URL, host site, new paid Supabase branch/project, or production deployment created.

## Why isolation is mandatory

The source storefront's `assets/js/supabase-config.js` and browser Meet's `meet-desktop/ui/browser-bridge.js` originally use the **production** Supabase project. A Netlify preview connected to this existing backend could access or change live members, meetings and notifications if a signed-in agent tests it.

`scripts/prepare-isolated-staging.mjs` rewrites both clients only inside the **built `public-dist` copy**, never the source files. It scans the rest of the packaged text assets and refuses to proceed if the production Supabase project reference or publishable key is still present. The output includes global noindex headers and a `robots.txt` disallow rule.

Additionally, `scripts/build-public-netlify.sh` rejects `CONTEXT=deploy-preview` and `CONTEXT=branch-deploy` unless staging isolation is deliberately enabled. This prevents a casual pull request from silently creating a preview that uses production Supabase.

## Required independent staging environment

Before publishing an actual URL, set up **a separate Netlify site** and **a separate Supabase project**—not a branch deploy or Deploy Preview that shares the production Netlify site's secrets or production Supabase project. Do not create billable resources without approval.

On the dedicated staging Netlify site, configure:

| Environment variable | Required value |
| --- | --- |
| `DOMINIONSTAR_STAGING_ISOLATION_APPROVED` | `STAGING_ONLY` |
| `DOMINIONSTAR_STAGING_NETLIFY_SITE_ID` | Actual dedicated staging Netlify site ID |
| `DOMINIONSTAR_PRODUCTION_NETLIFY_SITE_ID` | Actual production Netlify site ID; MUST differ from staging |
| `NETLIFY_SITE_ID` or `SITE_ID` | Actual staging site ID, as independently verified in Netlify |
| `DOMINIONSTAR_STAGING_SITE_URL` | Dedicated HTTPS `*.netlify.app` staging URL |
| `DOMINIONSTAR_STAGING_SUPABASE_URL` | HTTPS URL of a **separate** Supabase project, not production |
| `DOMINIONSTAR_STAGING_SUPABASE_PUBLISHABLE_KEY` | Publishable key for the separate staging project |
| `SUPABASE_URL` | If set for Netlify Functions, MUST equal the staging Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Only if needed, and must belong to staging; verify out of band; never store in Git |
| `RESEND_API_KEY` | Leave unset until a sandbox-only email provider is approved; if set, `DOMINIONSTAR_STAGING_EMAIL_SANDBOX_APPROVED=STAGING_ONLY` is required |

Do not copy live Netlify Function secrets, service-role credentials, notification-provider tokens, production analytics authorization, OAuth secrets, or any live user accounts into staging. Use a **test-only** Netlify Functions configuration and test-only Supabase Auth redirect URLs. Review the service-role function security findings and migration requirements before testing notifications.

The default Netlify site build command remains `bash scripts/build-public-netlify.sh`. In a correctly configured staging environment this command builds the site and automatically invokes `node scripts/prepare-isolated-staging.mjs` at the end. If its checks fail, the build fails before publication. The production site continues using its existing build behavior.

## Review-mode verification already completed

- [Automated Node suite: 107 passing / 0 failing](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40736396639)
- [No-deploy static packaging and synthetic staging rehearsal: passed](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40736430449)
- The packaging job deliberately runs a synthetic isolated-staging rewrite only in a disposable copy; its uploaded artifact is still the original unmodified, **non-isolated review package**, not a staging-ready release. **Do not publish that artifact as a live preview.**
- Test cover: missing credentials, same production Supabase URL, same Netlify identity, production Netlify host, HTTP preview, inherited server-side production Supabase URL, unsandboxed email provider, unexpected production references, successful isolated rewrite and noindex directives.
- Preview contexts without the staging environment fail closed with exit code 47, verified in GitHub Actions.

## Release milestones still blocked

1. An actual isolated staging Netlify site and separate Supabase project are not connected or provisioned. This is deliberate; no billable resource was authorized.
2. Run deployment against that separate site **only after** verifying Supabase schemas, Auth redirect domains, RLS, test users, test notifications, and email sandbox credentials are independent from production.
3. Perform interactive staging browser tests for signup, Founder approval, pending-user denial, Community, Messages, Agent Settings save/reload, Meet join/sharing and end lifecycle.
4. Run Mac and browser two-participant Meet tests. Review existing unresolved flicker and screen-share defects before declaring stable.
5. Apply any production notification RPC hardening SQL only after explicit approval and controlled live verification, not via this staging build.

**No production deploy, staging deploy, or Supabase resource creation was performed.**


## Staging gate 4 — dedicated-site production-context protection

Read-only Supabase project listing on 2026-10-28 returned **only one connected project**, `DominionStar Platform` (`ckmurvhjumzlhsegncba`). No independent staging Supabase project is currently available from this connection.

Confirmed from the official Netlify deploy-context documentation: a dedicated staging Netlify site can treat its own configured branch as `CONTEXT=production`, so checking `deploy-preview` / `branch-deploy` alone is not a sufficient isolation gate.

Updated `scripts/build-public-netlify.sh` to also require isolation when a Netlify build uses any non-`main` Git branch, even with `CONTEXT=production`. The GitHub repository's verified default branch is `main`. Also rejects staging site marker variables that appear without the approved staging isolation flag.

Tested in GitHub Actions:
- [Dedicated staging context and static packaging run 40737281524](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40737281524): **PASSED**. Explicitly proved unconfigured `CONTEXT=production BRANCH=review/login2-recovery-netlify-hold-20261019 NETLIFY=true` fails with exit 47. Original static package build, root route, browser Meet and synthetic isolation rehearsal still pass.
- [Node regression run 40737247817](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40737247817): **108/108 passed**, targeted **16/16 passed**.

**Residual deployment limitation:** This guard uses the Git branch and Netlify context to distinguish the current review branch from the production branch. If an unrelated Netlify site is configured to deploy **`main` with `CONTEXT=production`**, the build cannot reliably distinguish that site from the legitimate production site without a trusted production-site identifier. Consequently, **do not configure a staging site to deploy `main`**, and do not claim full staging safety until a dedicated Netlify site and Supabase project have been verified with their actual identifiers. Staging Functions remain independently subject to secret/API separation.

No new Netlify site, Supabase project/branch, staging URL, or live deployment was created.
