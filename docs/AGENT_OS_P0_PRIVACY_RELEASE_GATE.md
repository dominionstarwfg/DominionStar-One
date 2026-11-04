# DominionStar One — P0 Agent OS privacy and connection release gate

**Status: REVIEW ONLY — production changes prohibited.**  
Date: 2026-11-04  
Scope: Agent One website, signed-in Members, Founder authorization. **Not DominionStar Meet.**

## Verified findings (catalog inspection; no member data inspected)

1. `public.member_profiles` is used both for public directory identity and private
   account fields (email, phone, mailing address, account notes).
2. The row policy `profile approved directory read` allows any authenticated
   user to see rows where `profile_visibility='members'` and
   `verification_status='approved'`. The default visibility is `members`.
   Authenticated users currently have table-wide SELECT. **RLS is row-granular,
   not column-granular.** A read-only professional-profile page is NOT a data
   authorization boundary.
3. `member_connections` currently permits signed-in requesters to INSERT
   rows using the `requester_id=auth.uid()` predicate without forcing
   `status='pending'`. The existing UPDATE policy allows either requester or
   recipient to update the record without limiting editable columns.
4. Direct-message SELECT policy includes a Founder exception beyond sender and
   recipient. This may be deliberate, but needs a signed-off privacy policy and
   role-based access tests.
5. Connected Supabase advisor reports privileged function exposure, RLS policy
   performance, and index advisories. These are audit inputs, not proof of exploit.
   Do not blindly revoke all functions: inspect each caller and internal auth check.

## Intended authorization boundaries

| Data / action | Pending member | Approved member | Founder |
| --- | --- | --- | --- |
| Public approved-member directory identity | Deny | Allowed within profile visibility | Allowed |
| Other members' email/phone/address/account notes | Deny | Deny | Allow only if approved organizational need |
| Own contact information | Own only after authenticated onboarding | Own only | Own + scoped administration |
| Send a connection request | Deny | Allowed, only as pending | Same unless acting under documented admin workflow |
| Accept/decline invitation | Deny | Recipient only, pending -> accepted/declined | Not by default |
| Cancel sent pending invitation | Deny | Requester only | Not by default |
| Other members' direct messages | Deny | Deny unless sender or recipient | **Decision required:** no access by default unless explicit legal/compliance purpose and logging |
| Recognized rank and verified organization info | Deny except self | Approved directory subset | Authorized management |

## Technical sequencing — never apply out of order

**A. Privacy data separation (blocking).**

- Create an explicitly public-safe member-directory representation containing only
  id, chosen display name, contract level, approved badge, optional city/state,
  photo reference, and verified founding recognition. Avoid internal account notes,
  direct contact data, full postal addresses, private identifiers and any user
  configured hidden fields.
- Because a `security_invoker` view alone does NOT hide the original base table,
  design a separate RLS-protected private table for personal contact and
  administrative notes. Migrate frontend reads/writes for own-profile and Founder
  operations to narrow, authenticated accessors.
- Backfill and audit **in isolated staging**. Only after all current caller
  dependencies are migrated, revoke broad authenticated SELECT on the original
  member profile table (or drop private columns from it as part of an approved
  atomic migration). Verify the raw REST API cannot retrieve another member's
  email/phone/address/notes.
- Do not attempt a quick deny-by-frontend CSS change, and do not add a directory
  view while retaining the leaky table grants and call that a security fix.

**B. Connection request integrity (draft prepared).**

- Review `scripts/security/member-connection-integrity.DO-NOT-RUN.review.sql`
  in isolated staging after explicitly authorizing SQL test deployment.
- It forces initial connection status to `pending`, removes broad browser
  UPDATE/DELETE access, and adds narrow recipient-response/requester-cancel RPCs.
- Before releasing, wire the Member Directory inbox and notifications to the new
  RPCs. Surface pending, accepted, declined, and cancel states. Block/mute
  semantics need a separate signed-off design.
- Ensure a recipient cannot approve a request they sent, a requester cannot
  self-approve, and neither side can mutate connection identities or timestamps.

**C. Direct Message / Founder visibility decision.**

- Confirm whether Founder access to all member-to-member messages is intended.
  Record rationale, access disclosure, audit log and retention policy. Prefer
  participant-only access and narrowly scoped, logged administrative exceptions.
- Apply a tested backend change only after checking moderation/support use cases.

## Release gates

- [ ] Isolated staging database and accounts available; never test on member data.
- [ ] Private fields unreadable from member-to-member REST/select requests.
- [ ] Own Profile and Founder Admin CRUD still work under the new authorization model.
- [ ] Pending / approved / revoked member negative authorization cases pass.
- [ ] Connection transitions and role-state spoofing tests pass.
- [ ] Member directory avatars, messaging shortcuts and status labels still render.
- [ ] Existing RLS, storage, trigger and SECURITY DEFINER callers checked; no
      anonymous or excessive privileged access introduced.
- [ ] Browser interaction and mobile smoke tests completed with staging accounts.
- [ ] Rollback and deployment owner documented; release explicitly approved.
- [ ] Only then consider production SQL + website deployment with monitoring.

## Review artifacts

- Read-only catalog inspection:
  `scripts/security/agent-os-privacy-baseline.READ-ONLY.review.sql`
- Non-executed connection remediation candidate:
  `scripts/security/member-connection-integrity.DO-NOT-RUN.review.sql`
- Static regression tests:
  `tests/agent-os-p0-privacy-review.test.mjs`

## References

- Supabase guidance: https://supabase.com/docs/guides/database/postgres/column-level-security
- RLS security invoker views: https://supabase.com/docs/guides/database/postgres/row-level-security

**This document does not certify production security. No production SQL has
been executed, no user records examined, and no production merge performed.**
