-- REVIEW ONLY — DO NOT RUN. NOT APPROVED FOR PRODUCTION.
-- DominionStar Agent OS / Members: connection request authorization hardening.
-- Requires isolated staging with two approved member identities and one pending identity.
-- Explicitly excludes DominionStar Meet, message tables, and member-profile privacy cutover.
-- Do not execute this as part of a GitHub Actions, Netlify, or Supabase deployment.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.member_connections') IS NULL
     OR to_regclass('public.member_profiles') IS NULL
     OR to_regclass('public.member_public_profiles') IS NULL THEN
    RAISE EXCEPTION 'Expected Agent OS member tables are missing; refusing cutover';
  END IF;
  -- The existing directional UNIQUE(requester_id,recipient_id) cannot stop
  -- two opposite pending invites (A→B and B→A) racing each other. Halt
  -- instead of silently choosing which existing member record to destroy.
  IF EXISTS (
    SELECT 1 FROM public.member_connections
    GROUP BY LEAST(requester_id,recipient_id),
             GREATEST(requester_id,recipient_id)
    HAVING count(*)>1
  ) THEN RAISE EXCEPTION
    'Existing reciprocal/duplicate connection pairs require explicit reconciliation';
  END IF;
END;
$preflight$;

-- Enforce ONE relationship per unordered pair, regardless of who sent first.
-- This prevents duplicate pending/accepted links under simultaneous requests.
-- Keep existing directional UNIQUE for compatibility; this index adds safety.
CREATE UNIQUE INDEX member_connections_unordered_pair_once_idx
  ON public.member_connections (
    (LEAST(requester_id,recipient_id)),
    (GREATEST(requester_id,recipient_id))
  );

-- Only approved members can invite another approved, directory-visible member.
-- The existing policy permits requester_id=auth.uid() but does not restrict
-- the initial status; a browser could otherwise insert an already accepted row.
DROP POLICY IF EXISTS "members request connections" ON public.member_connections;
CREATE POLICY "approved members create pending connection requests"
ON public.member_connections FOR INSERT TO authenticated
WITH CHECK (
  requester_id=(select auth.uid())
  AND recipient_id<>(select auth.uid())
  AND status='pending'
  AND EXISTS (
    SELECT 1 FROM public.member_profiles p
    WHERE p.id=(select auth.uid()) AND p.verification_status='approved'
  )
  AND EXISTS (
    -- Peer approval/visibility must be checked through the public-safe
    -- projection. Raw member_profiles is owner/Founder-only after the
    -- privacy enforcement gate and must not be reopened for connections.
    SELECT 1 FROM public.member_public_profiles p
    WHERE p.id=recipient_id AND p.verification_status='approved'
  )
);

-- A recipient can accept or decline an existing PENDING invitation only.
-- Never accept requester/recipient ids, names, or client-generated timestamps.
CREATE OR REPLACE FUNCTION public.respond_my_member_connection(
  target_connection_id uuid, target_status text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE changed integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF target_status NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'Unsupported connection response';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.member_profiles p
    WHERE p.id=auth.uid() AND p.verification_status='approved'
  ) THEN RAISE EXCEPTION 'Approved membership required'; END IF;
  UPDATE public.member_connections
  SET status=target_status, updated_at=now()
  WHERE id=target_connection_id
    AND recipient_id=auth.uid()
    AND status='pending';
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed=1;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.respond_my_member_connection(uuid,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_my_member_connection(uuid,text)
  TO authenticated, service_role;

-- Requesters may withdraw only their own pending invitations.
-- Deliberately do not overload declined/blocked status to mean cancellation.
CREATE OR REPLACE FUNCTION public.cancel_my_member_connection(
  target_connection_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE changed integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM public.member_connections
  WHERE id=target_connection_id
    AND requester_id=auth.uid()
    AND status='pending';
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed=1;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.cancel_my_member_connection(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_member_connection(uuid)
  TO authenticated, service_role;

-- Remove direct browser writes to status AND identity columns. Connection
-- transitions go exclusively through the scoped functions above.
DROP POLICY IF EXISTS "members respond to connections" ON public.member_connections;
REVOKE UPDATE, DELETE ON TABLE public.member_connections
  FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id,requester_id,recipient_id,status,created_at,updated_at)
  ON public.member_connections FROM PUBLIC, anon, authenticated;

DO $verify$
BEGIN
  IF has_table_privilege('authenticated','public.member_connections','UPDATE')
    OR has_table_privilege('authenticated','public.member_connections','DELETE')
    OR has_column_privilege('authenticated','public.member_connections','status','UPDATE')
    OR has_column_privilege('authenticated','public.member_connections','requester_id','UPDATE')
    OR has_function_privilege('anon',
        'public.respond_my_member_connection(uuid,text)'::regprocedure,'EXECUTE')
    OR has_function_privilege('anon',
        'public.cancel_my_member_connection(uuid)'::regprocedure,'EXECUTE')
    OR NOT has_function_privilege('authenticated',
        'public.respond_my_member_connection(uuid,text)'::regprocedure,'EXECUTE')
    OR NOT has_function_privilege('authenticated',
        'public.cancel_my_member_connection(uuid)'::regprocedure,'EXECUTE') THEN
    RAISE EXCEPTION 'Connection privilege hardening incomplete';
  END IF;
END;
$verify$;
COMMIT;

-- REQUIRED TESTS IN ISOLATED STAGING BEFORE ANY APPROVED RELEASE:
-- Approved A creates pending invitation to visible approved B: allowed.
-- Private/unlisted recipients cannot be invited from the member directory.
-- A tries to insert accepted/blocked status: rejected.
-- Pending/unapproved A tries to invite approved B: rejected.
-- C cannot send the reciprocal invitation while A->C already exists,
-- even if both accounts are approved and both direction-specific IDs differ.
-- Existing reciprocal pairs must be reconciled before this index is applied.
-- A tries to accept own sent invitation: rejected.
-- Unrelated C tries to respond, cancel, or modify either identity: rejected.
-- B accepts or declines a pending invitation once: allowed.
-- B tries to modify an accepted/declined invitation: rejected.
-- A cancels a pending invitation: allowed; A cannot cancel accepted connection.
-- Anonymous functions: execute denied. Direct browser UPDATE/DELETE: denied.
-- Confirm member directory, notification display, and approval flows in staging.
-- Do not merge or execute without explicit release approval and rollback plan.
