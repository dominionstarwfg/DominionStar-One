-- DOMINIONSTAR GATE 0 — PROPOSED CONNECTION STATE INTEGRITY
-- STAGING-ONLY CANDIDATE. DO NOT APPLY, MERGE OR DEPLOY.
-- This file is outside supabase/migrations and has not been executed.
-- Client and RLS behavior must be tested together with approved synthetic
-- identities before any production authorization.

BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.member_connections') IS NULL THEN
    RAISE EXCEPTION 'STOP: member_connections table missing';
  END IF;
  IF to_regprocedure('public.respond_member_connection(uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: response RPC already exists';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='member_connections'
      AND policyname='members request connections'
  ) THEN
    RAISE EXCEPTION 'STOP: expected connection INSERT policy missing';
  END IF;
END
$preflight$;

-- The initiating client can only create a PENDING request from its
-- authenticated approved account to an approved distinct recipient.
-- It must not choose an already accepted/blocked status in the insert.
ALTER POLICY "members request connections" ON public.member_connections
WITH CHECK (
  requester_id=auth.uid()
  AND recipient_id <> auth.uid()
  AND status='pending'
  AND EXISTS (
    SELECT 1 FROM public.member_profiles sender
    WHERE sender.id=auth.uid() AND sender.verification_status='approved'
  )
  AND EXISTS (
    SELECT 1 FROM public.member_profiles recipient
    WHERE recipient.id=member_connections.recipient_id
      AND recipient.verification_status='approved'
  )
);

CREATE FUNCTION public.respond_member_connection(
  target_connection_id uuid,
  new_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $body$
DECLARE affected integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.member_profiles requester
    WHERE requester.id=auth.uid()
      AND requester.verification_status='approved'
  ) THEN
    RAISE EXCEPTION 'Approved member required' USING ERRCODE='42501';
  END IF;
  IF target_connection_id IS NULL
     OR new_status NOT IN ('accepted','declined','blocked')
  THEN
    RAISE EXCEPTION 'Invalid connection response' USING ERRCODE='22023';
  END IF;

  -- Only the recipient may accept/decline a pending request.
  -- Either endpoint may block their relationship. Never rewrite endpoints.
  UPDATE public.member_connections
  SET status=new_status, updated_at=now()
  WHERE id=target_connection_id AND status <> 'blocked'
    AND (
      (recipient_id=auth.uid() AND status='pending'
        AND new_status IN ('accepted','declined','blocked'))
      OR
      (new_status='blocked'
        AND (recipient_id=auth.uid() OR requester_id=auth.uid()))
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected=1;
END
$body$;

-- Replace unrestricted table UPDATE with a narrowly authorized operation.
REVOKE UPDATE ON TABLE public.member_connections FROM PUBLIC;
REVOKE UPDATE ON TABLE public.member_connections FROM anon;
REVOKE UPDATE ON TABLE public.member_connections FROM authenticated;

REVOKE ALL ON FUNCTION public.respond_member_connection(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_member_connection(uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.respond_member_connection(uuid,text)
  TO authenticated;

DO $verify$
BEGIN
  IF has_table_privilege('authenticated','public.member_connections','UPDATE')
     OR has_table_privilege('anon','public.member_connections','UPDATE') THEN
    RAISE EXCEPTION 'STOP: unrestricted connection UPDATE remains';
  END IF;
  IF has_function_privilege('anon',
      'public.respond_member_connection(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'STOP: anonymous connection RPC exposed';
  END IF;
END
$verify$;
COMMIT;

-- SERVER-SIDE BLOCK ENFORCEMENT IS A SEPARATE, COORDINATED CHANGE.
-- Merely inserting a "blocked" status does not prevent direct messaging:
-- 13_dm_blocked_send_guard_candidate.sql MUST be applied and verified
-- in an isolated staging environment with this migration.
--
-- Synthetic JWT tests:
-- * Approved A sends pending connection to approved B -> success.
-- * A cannot INSERT accepted/declined/blocked, nor requester_id=C.
-- * Pending/suspended/anonymous cannot INSERT or respond.
-- * Only B can accept or decline pending A->B, not A or unknown C.
-- * A or B can block; a blocked relationship cannot be approved by A/B.
-- * Sender/recipient IDs remain immutable through direct REST UPDATE.
-- * No direct UPDATE grants remain on member_connections.
-- * Preexisting accepted/declined connections retained unchanged.
-- * The UI still supports pending request status and duplicate detection.
