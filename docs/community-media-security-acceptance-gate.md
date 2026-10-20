# DominionStar Community Media — Security Acceptance Gate (Review only)

**Status:** local draft preview exists on the GitHub review branch. Upload, persistence, public links and playback of published media are **NOT implemented**. This document is a specification, not a deployed migration or authorization.

## Existing code (verified 2026-10-20)

- `community/index.html` includes Photo / Flyer / Video draft selectors, a local file input, preview tray and persistent “Local preview only” warning.
- `assets/js/community-media-draft-review.js` validates declared MIME, extension and first-byte signatures, limits attachments to four, total draft to 100 MiB, and disables Publish while files remain in the tray. It creates local blob URLs, revokes them when removed/page-hidden, and does **not** call Storage or database upload APIs.
- `assets/css/community-media-draft-review.css` styles responsive local attachment cards.
- `tests/community-media-draft-review.test.mjs` includes contract tests (not evidence of real browser or database authorization).
- Browser-level preview validation is an ergonomic filter, **not malware scanning or trusted authorization**. A malicious client can bypass the browser. A production service must verify bytes and authorization itself.

## Locked experience and copy

- Composer: agent avatar and “Share an update…” entry; buttons **Photo**, **Flyer (PDF)**, **Video**; numbered cards with preview, size, accessible remove control, live validation text.
- Allowed initial formats: JPEG / PNG / WebP, PDF, MP4 / WebM. Reject executable HTML/SVG, animated dangerous embeddings, archives and arbitrary URL embeds.
- Limits (proposed): 15 MiB per image, 12 MiB per PDF, 80 MiB per video; four total media items with 100 MiB overall. **Storage limits must be applied to the private bucket and server as well**; browser caps are not enforcement.
- Publishing only enables after each media item has verified protected storage ownership and a transactional server-side association with an approved post. Failed uploads must not create a misleading published post or orphaned public files.
- Published feed: responsive aspect ratio, image lightbox, flyer PDF preview/download only after permission checks, video poster and user-initiated playback (autoplay off), Like/Comment/Repost/Share beneath each post.
- User experience: keyboard/touch support, loading skeletons, progress, cancel and retry, accessible error explanations and low-bandwidth layouts. No training or client-sensitive documents.

## Backend design required before activation

1. **Private bucket** `community-media` with explicit bucket MIME/size limits; not public, not reusing public avatars. Avoid permanent public URLs. Supabase docs: https://supabase.com/docs/guides/storage/buckets/creating-buckets
2. **Metadata** in `community_post_media`: opaque media ID; post UUID; owner UUID; safe object key; MIME, bytes, width/height/duration (if applicable); processing/scan state; created/updated timestamps; optional poster key and alt text. Foreign keys to actual existing community post IDs must be checked against staging schema; do not invent migrations on assumption.
3. **Ownership path** `<auth.uid()>/<uuid>.<extension>`; prevent overwrite/upsert and path traversal. Do not grant write/delete based on user-modifiable JWT `raw_user_meta_data`.
4. **Authorization**: every read requires approved member status *and* permission to view associated non-deleted post. Every insert requires an approved, verified member, matching owner and valid pending draft. Delete allowed to legitimate owner subject to retention rules or Founder moderator via server-verified role. Other members, pending/suspended/removed users and anonymous sessions must be denied regardless of guessed IDs or URLs. Storage RLS on `storage.objects` and relational RLS must both agree.
5. **Processing**: signature and MIME re-validation in trusted backend; malware scanning and EXIF metadata hygiene; safe image re-encode; video type/transcode/poster checks; PDF safe preview policy. Quarantine and reject until processing succeeds.
6. **Private URLs**: issue short-lived signed URLs only after checking *current* access, acknowledge that issued signed URLs remain usable until expiry even if the viewer loses access; consider a proxy for stricter immediate revocation.
7. **Consistency**: validate post+media ownership transactionally; pending, scanned, ready and rejected states; cleanup abandoned drafts and deleted-post objects using audited jobs, without exposing privileged keys to the browser.
8. **Abuse controls**: verified upload quotas, rate-limits, storage and bandwidth budgets, safe filenames, content moderation/reporting and retention policies.
9. **Failure controls**: SELECT RLS may be needed even after INSERT for returned object metadata; do not bypass RLS with unreviewed SECURITY DEFINER functions. See https://supabase.com/docs/guides/troubleshooting/storage-error-403-forbidden-new-row-violates-row-level-security-policy-on-upload-a94384
10. **Production gates**: separate staging Supabase, authorized schema inspection, passing policy matrices, simulated approval revocation, media scanning verification, user acceptance, budget review, explicit deployment authorization. **Do not enable or deploy against production now.**

## Required red-team matrix

| Identity / scenario | Media read | Upload | Delete | Repost media |
| --- | --- | --- | --- | --- |
| Anonymous | Deny | Deny | Deny | Deny |
| Registered pending | Deny | Deny | Deny | Deny |
| Rejected / suspended | Deny | Deny | Deny | Deny |
| Approved unrelated member | Allow only published viewable ready media | Allow own draft | Deny others | Only through allowed repost workflow |
| Approved owner | Allow own ready media | Allow own draft | Allow own authorized media | Allowed workflow |
| Founder | Allow as authorized moderator | Allow own draft | Moderation under audit | Moderation under audit |
| Former approved member | Deny new read & access grants immediately | Deny | Deny | Deny |
| Malicious client with guessed key | Deny unless exact membership+post authorization | Deny path/owner spoof | Deny | Deny |
| Post hidden / deleted / processing rejected | Deny | N/A | Server cleanup only | Deny |
| Modified MIME, size or magic bytes | Deny quarantine | Deny | N/A | Deny |

**Decision needed before any implementation against Supabase:** a safe isolated non-production environment (no billable branch provisioned or charged without new authorization), full schema/RLS inspection, and migration/release approval.
