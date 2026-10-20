# Gate 2 — Community media drafts and authorization contract

**Status: REVIEW BRANCH ONLY. There is no live media publishing, Storage bucket, or database migration in this phase. Netlify main and production Supabase remain unchanged.**

## Implemented and safely held

- \`community/index.html\` contains actual Photo, Flyer (PDF), and Video chooser controls.
- \`assets/js/community-media-draft-review.js\` mounts the composer automatically on the Community page, stages selected files **only in browser memory**, makes image and video previews using object URLs, lists PDF flyers by name, supports removal, and revokes object URLs on remove and pagehide.
- Accepts only JPEG, PNG, WebP, PDF, MP4, and WebM. Validates filename extension, supplied MIME, file size, and recognizable file header before preview. Caps: four files, 100 MB combined; 15 MB per image, 12 MB per PDF, 80 MB per video.
- The app intentionally **disables Publish Post while any attachment is selected**, and uses a capture-phase submit guard to prevent the existing text-only publish listener from posting a misleading text-only item. Removing all attachments restores text/link publishing.
- Text and links remain on the existing Community backend. No Supabase upload SDK calls are made. No claim that browser signature checks are adequate server-side verification.
- Visual preview may use illustrative photos/flyers/video placeholders and sample accounts; it is separate from authenticated application behavior.
- Regression: \`node --test tests/community-media-draft-review.test.mjs\`. Source-script syntax and 8 sample file-signature cases were also checked in an isolated JavaScript evaluator during this phase. Browser/integration tests remain unexecuted for the GitHub branch.

## Required backend contract before enabling Publish With Media

This is a **design contract**, NOT a migration to copy into production.

1. Create a private, not public, bucket (suggested id \`community-post-media\`) in an approved disposable Supabase test project. Configure bucket allowlisted MIME types and maximum file size; enforce more stringent video limits server-side. Bucket owners and MIME headers alone are insufficient access control.
2. Design \`community_post_media\` records: \`id\` (UUID), \`post_id\` (FK to authorized community post), \`owner_id\` (auth.uid), \`storage_key\`, \`mime_type\`, \`byte_count\`, \`media_kind\`, \`status\` (pending/approved/rejected), \`created_at\`, plus moderation metadata where necessary.
3. Require approved and active membership in *every* SELECT, INSERT and DELETE policy. Authenticate with \`auth.uid()\`; verify the post's author matches the uploader, and guard against changing \`owner_id\`, \`post_id\`, \`storage_key\` via UPDATE. Prefer insert-only and controlled delete over overwrites.
4. Use private Storage RLS on \`storage.objects\` with an ownership prefix \`<auth.uid()>/<random UUID>.<allowlisted extension>\`, verified against current auth identity and approved membership. For read, allow only approved members viewing an authorized, non-deleted published post. Do not expose storage object listings or drafts to unrelated users. Avoid broad grants to \`PUBLIC\`, \`anon\`, or all \`authenticated\`.
5. Tie metadata to object references atomically where feasible, or maintain an orphan-cleanup procedure for partial failures and abandoned drafts. Server-side verification must ensure approved MIME from file contents, size, malware scan (especially PDFs), media dimensions, EXIF/location removal, and audio/video transcode or constrained streaming before publication.
6. For private media reads, use short-lived signed URLs **only after a checked authorization lookup**. Signed URLs may remain usable until expiration even after approval is revoked. Make the lifetime as short as practical, disable public caching for sensitive media, and verify access on each refresh.
7. Implement quotas, reporting/moderation, abuse rate limits, video transcoding/thumbnail generation, keyboard access, explicit upload progress, cancellation/retry, and rollback before release.
8. Verify ALL operations for synthetic users: anonymous, pending, approved uploader, approved unrelated member, suspended uploader, Founder, and a member revoked mid-session. Test foreign-user paths, deleted posts, draft links, JWT expiry, forged metadata, large files and multipart interruption. No production data may be used.
9. Require **explicit owner approval** for billable staging services. Do not create a Supabase branch with hourly billing automatically. Do not treat a browser feature flag as server authorization.
10. Once secure test cases pass, implement transaction-controlled uploads, metadata writes, and read rendering in both Community and dashboard. Only then enable publishing media in the user interface, and obtain separate deployment approval.

## Reference material

- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase bucket access model: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase JS uploads: https://supabase.com/docs/reference/javascript/file-buckets-upload
- Supabase Storage ownership: https://supabase.com/docs/guides/storage/security/ownership

**No database SQL was executed, no Storage files uploaded, and no production or billable staging resources created.**
