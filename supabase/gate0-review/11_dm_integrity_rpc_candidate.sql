-- DOMINIONSTAR GATE 0 — PROPOSED DIRECT-MESSAGE INTEGRITY MIGRATION
-- REVIEW ONLY. This is NOT under supabase/migrations and has NOT been applied.
-- Requires approved synthetic-JWT staging tests and matching client migration.
-- Preserves existing rows and does NOT alter Founder-wide SELECT/DM governance.
-- DB policies control row visibility; table UPDATE grants otherwise permit
-- callers to alter columns in any RLS-visible row. Replace browser UPDATE
-- with narrow, audited SECURITY DEFINER operations.

BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.direct_messages') IS NULL THEN
    RAISE EXCEPTION 'STOP: direct_messages relation missing';
  END IF;
  IF to_regprocedure('public.dm_mark_read(uuid)') IS NOT NULL
      OR to_regprocedure('public.dm_edit_own_message(uuid,text)') IS NOT NULL
      OR to_regprocedure('public.dm_soft_delete_own_message(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: one of the proposed RPCs already exists';
  END IF;
END
$preflight$;

CREATE FUNCTION public.dm_mark_read(target_sender_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $body$
DECLARE changed_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.member_profiles p
    WHERE p.id=auth.uid() AND p.verification_status='approved'
  ) THEN
    RAISE EXCEPTION 'Approved member required' USING ERRCODE='42501';
  END IF;
  IF target_sender_id IS NULL OR target_sender_id=auth.uid() THEN
    RAISE EXCEPTION 'Invalid conversation sender' USING ERRCODE='22023';
  END IF;

  -- A recipient can mark only incoming messages addressed to their account.
  UPDATE public.direct_messages
     SET read_at=now(), updated_at=now()
   WHERE sender_id=target_sender_id AND recipient_id=auth.uid()
     AND read_at IS NULL AND is_deleted=false;

  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN changed_count;
END
$body$;

CREATE FUNCTION public.dm_edit_own_message(target_message_id uuid, new_body text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $body$
DECLARE cleaned text;
DECLARE changed_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.member_profiles p
    WHERE p.id=auth.uid() AND p.verification_status='approved'
  ) THEN
    RAISE EXCEPTION 'Approved member required' USING ERRCODE='42501';
  END IF;

  cleaned := trim(coalesce(new_body,''));
  IF target_message_id IS NULL OR length(cleaned) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Invalid message content or ID' USING ERRCODE='22023';
  END IF;

  -- Do not forge attachment, voice, or call-event metadata through text edit.
  IF starts_with(cleaned,'[voice-note]')
    OR starts_with(cleaned,'[voice-note:v2]')
    OR starts_with(cleaned,'[attachment]')
    OR starts_with(cleaned,'[call-event]') THEN
    RAISE EXCEPTION 'System messages cannot be created by editing text'
      USING ERRCODE='22023';
  END IF;

  UPDATE public.direct_messages
     SET body=cleaned, updated_at=now()
   WHERE id=target_message_id AND sender_id=auth.uid()
     AND is_deleted=false
     AND NOT starts_with(body,'[voice-note]')
     AND NOT starts_with(body,'[voice-note:v2]')
     AND NOT starts_with(body,'[attachment]')
     AND NOT starts_with(body,'[call-event]');
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN changed_count = 1;
END
$body$;

CREATE FUNCTION public.dm_soft_delete_own_message(target_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $body$
DECLARE changed_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.member_profiles p
    WHERE p.id=auth.uid() AND p.verification_status='approved'
  ) THEN
    RAISE EXCEPTION 'Approved member required' USING ERRCODE='42501';
  END IF;
  IF target_message_id IS NULL THEN
    RAISE EXCEPTION 'Invalid message ID' USING ERRCODE='22023';
  END IF;

  UPDATE public.direct_messages
     SET is_deleted=true, updated_at=now()
   WHERE id=target_message_id AND sender_id=auth.uid()
     AND is_deleted=false;
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN changed_count = 1;
END
$body$;

-- Remove blanket row UPDATE from browser tokens; narrow functions own writes.
-- Do not restore broad table UPDATE as a rollback shortcut.
REVOKE UPDATE ON TABLE public.direct_messages FROM PUBLIC;
REVOKE UPDATE ON TABLE public.direct_messages FROM anon;
REVOKE UPDATE ON TABLE public.direct_messages FROM authenticated;

REVOKE ALL ON FUNCTION public.dm_mark_read(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dm_mark_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.dm_mark_read(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.dm_edit_own_message(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dm_edit_own_message(uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.dm_edit_own_message(uuid,text) TO authenticated;

REVOKE ALL ON FUNCTION public.dm_soft_delete_own_message(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dm_soft_delete_own_message(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.dm_soft_delete_own_message(uuid) TO authenticated;

DO $verify$
BEGIN
  IF has_table_privilege('authenticated','public.direct_messages','UPDATE')
     OR has_table_privilege('anon','public.direct_messages','UPDATE') THEN
    RAISE EXCEPTION 'STOP: direct_messages row UPDATE remains browser-accessible';
  END IF;
  IF has_function_privilege('anon','public.dm_mark_read(uuid)','EXECUTE')
    OR has_function_privilege('anon','public.dm_edit_own_message(uuid,text)','EXECUTE')
    OR has_function_privilege('anon','public.dm_soft_delete_own_message(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'STOP: anonymous role retained DM mutation RPC grants';
  END IF;
END
$verify$;

COMMIT;

-- Staging negative tests required before merging:
-- Approved A sends B; only B can mark A's sent messages read.
-- A can edit/delete A's own text; B cannot edit/delete A's message.
-- Neither can mutate sender_id, recipient_id, created_at, or read_at via
-- PostgREST direct UPDATE, or via these narrow RPCs.
-- No one can edit voice/attachment/call-event markers into arbitrary links.
-- Soft-delete hides rows as before; data stays retained for governance.
-- Anonymous/pending/suspended identities cannot execute mutations.
-- Founder READ policy requires a separate privacy/governance decision.
-- Existing E2E features, notification order and cross-device read receipts
-- MUST be regression-tested using synthetic staging accounts.
