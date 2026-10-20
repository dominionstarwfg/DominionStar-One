# Gate 1 — Community Access and Article Concept 8

**Status:** GitHub review only. No Netlify deployment, main merge, or Supabase production writes.

## Community improvements staged

- Founder-only composer controls now use `is_dominionstar_founder()` instead of trusting `member_profiles.role` or `is_founder` from a browser profile row.
- The community feed first requests `list_community_feed` and then queries `community_comments` and `community_reactions` using only the returned `message_id` list. Empty post results do not trigger table reads. This is minimization, **not a replacement for RLS**.
- Feed refreshes reject stale asynchronous responses, and local filtering retains already generated avatar links rather than discarding profile photos.
- Escaping applies to generated card IDs and avatar URLs; reaction keys are accepted only from the explicit reaction dictionary.
- Review tests: `node --test tests/community-editorial-review.test.mjs`.

## Database authorization remains an OPEN release gate

The previous Gate 0 audit in `security/gate0-review-20261018` described sensitive member-profile and community access risks. **Do not claim security certification based on client code or static tests.** The following checks require a disposable **isolated non-production Supabase project** and synthetic identities; do not perform write tests against production.

| Synthetic identity | Community feed RPC | Comments/reactions | Post/comment mutations | Founder moderation |
|---|---|---|---|---|
| Anonymous/no session | Denied | Denied | Denied | Denied |
| Pending member | Denied | Denied | Denied | Denied |
| Suspended/rejected member | Denied | Denied | Denied | Denied |
| Approved member | Allowed, only visible posts | Only approved visible posts | Own authorized items only | Denied |
| Founder, server-authorized | Allowed | Authorized content only | Allowed by policy | Allowed and audited |

### Additional negative tests (must pass before release)

1. Check `list_community_feed` RPC's `EXECUTE` grants and function body; `SECURITY DEFINER` can bypass RLS. Authenticate and authorize on the server for each invocation. Audit all public functions for anon/PUBLIC grants.
2. Verify `community_messages`, `community_comments`, and `community_reactions` RLS policies and column-level rights. Test arbitrary IDs, locked/deleted posts, cross-user reaction or comment changes, forged `user_id`, forged announcement/`is_pinned`, and unauthorized moderation calls.
3. Test revoked approval during an already-open session. The database should deny access even when the UI still displays a cached profile or an in-flight request.
4. Test `member_profiles` SELECT permissions: reading author details from a feed must not expose agent code, email, addresses, administrative notes, personal identifiers, or contact information beyond intentionally permitted fields.
5. Verify `community_notify_mentions` checks that the caller is approved and authorized for `target_message_id`, prevents spoofed alerts, and throttles repeated attempts. No assumption that a callable RPC is safe.
6. Test Realtime publication access rules for community post, reaction, and comment change events. In particular, make sure pending/suspended users cannot receive private member events.
7. Verify loading, empty, network-failure, retry, create-post, comment, like, moderation, filter, and search flows with synthetic approved users. Confirm no flashing/stale results with rapid updates.
8. Confirm profile avatar signed URLs are scoped appropriately, short-lived as policy permits, and never used to broaden underlying Storage object access. Inspect any previously issued long-lived links in Gate 0 separately.
9. Run separate Founder privilege-negative tests: spoofing browser-visible `role`, `is_founder`, or email must not grant rights. Authorization must ultimately be database-controlled.

**Do not apply any SQL migration automatically.** Use the existing Gate 0 security review and independently approved, rollback-tested changes to address findings.

## Article Concept 8 staged and held

- Source: `knowledge/articles/build-a-career-on-trust/index.html`.
- Editorial CSS: `assets/css/dominionstar-editorial-concept8.css`.
- Format: approved Concept 8 long-form editorial page with table of contents, responsive two-column reading experience, lead paragraph, practical educational sections, contextual calls to action, and related reading.
- Metadata: canonical, title, description, Open Graph, Twitter card, semantic Article JSON-LD (no fabricated publication or modification dates).
- Compliance: general professional-development guidance; no income, licensing, or client-result guarantees. Editorial and legal/compliance review remain required.
- **Unpublished:** intentionally `noindex,nofollow`, not added to `sitemap.xml`, and not linked from the public `knowledge/index.html`.

### Article publication gate (after Netlify usage restored and user approves)

1. Approve editorial copy and review regulatory/compliance statements for targeted jurisdictions and carrier/platform guidelines. This content must not imply guaranteed employment, licensing, or income.
2. Verify internal CTA URLs, responsive layout, contrast, keyboard navigation, social preview, SEO title/description, and schema using a browser-enabled preview.
3. Remove `noindex,nofollow` **only on approval**, add a Knowledge index card, add the canonical route to sitemap with the true publication date, and consider marking `datePublished` and `dateModified` only once factually known.
4. Verify Netlify build guard script, publication paths, metadata, and no accidental release of Meet or private member routes.
5. Approve deployment to preview first; then merge and release only after separate permission and security gate approvals.
6. After deployment, validate served content with a clean cache and check analytics, search indexing, booking CTA, and site navigation. Do not claim that connecting a domain alone proves a successful release.

## Commands for the later controlled QA environment

```bash
node --test tests/community-editorial-review.test.mjs
node --test tests/executive-dashboard-2030-review.test.mjs
node --test tests/login2-recovery-review.test.mjs
```

These commands have **not** been executed against the GitHub branch's source in this conversation. Source inspection can validate structure and JavaScript syntax, but cannot certify browser behavior or database policy.
