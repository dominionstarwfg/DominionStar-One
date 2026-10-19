-- DOMINIONSTAR GATE 0 -- VOICE MEDIA PREFLIGHT ONLY
-- Read-only metadata / aggregate counts. Safe to review; NOT a fix.
-- No raw voice message contents, signed URLs or object names are returned.
-- Before rollout, run on intended environment with authorized database role.
BEGIN TRANSACTION READ ONLY;

-- Aggregate count of legacy voice notes (no message content selected).
SELECT
  count(*) FILTER (WHERE body LIKE '[voice-note]%') AS voice_messages,
  count(*) FILTER (WHERE body LIKE '[voice-note]https:%') AS voice_messages_with_url,
  count(*) FILTER (WHERE body LIKE '[voice-note:v2]%') AS voice_messages_v2
FROM public.direct_messages;

-- Only aggregate object count; no object name or member identifier returned.
SELECT count(*) AS voice_objects
FROM storage.objects
WHERE bucket_id = 'direct-message-media';

-- Check bucket remains private and restricted to supported MIME types.
SELECT id, public AS publicly_readable, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id='direct-message-media';

-- Confirm ALL permissive storage policies before removing any old rule.
-- PostgreSQL combines applicable permissive policies using OR.
SELECT policyname, cmd, permissive, roles::text AS roles,qual,with_check
FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
  AND (
    coalesce(qual,'') LIKE '%direct-message-media%'
    OR coalesce(with_check,'') LIKE '%direct-message-media%'
  )
ORDER BY policyname;

COMMIT;

-- Negative-access tests require real synthetic JWTs, not these SQL counts.
-- Do not re-use audit-time zero counts without running preflight again.
