-- REVIEW ONLY — DO NOT RUN WITHOUT EXPLICIT PRODUCTION DATABASE APPROVAL.
-- Focused notification read-state gate for the Agent Dashboard.
-- This does not change DominionStar Meet.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.executive_events') IS NULL THEN
    RAISE EXCEPTION 'public.executive_events is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='executive_events'
      AND policyname='members read own executive events'
  ) THEN
    RAISE EXCEPTION 'Expected owner SELECT policy is missing; re-audit';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.mark_my_executive_notifications_read(
  target_event_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  changed integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated member required';
  END IF;

  UPDATE public.executive_events
     SET read_at=coalesce(read_at,now())
   WHERE member_id=auth.uid()
     AND read_at IS NULL
     AND (target_event_id IS NULL OR id=target_event_id);

  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mark_my_executive_notifications_read(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_my_executive_notifications_read(uuid)
  TO authenticated;

DO $verify$
DECLARE
  fn_oid oid := to_regprocedure('public.mark_my_executive_notifications_read(uuid)');
BEGIN
  IF fn_oid IS NULL
     OR has_function_privilege('anon',fn_oid,'EXECUTE')
     OR NOT has_function_privilege('authenticated',fn_oid,'EXECUTE')
  THEN
    RAISE EXCEPTION 'Unexpected read-state function privileges; abort';
  END IF;
END;
$verify$;

COMMIT;

-- Post-approval verification:
-- 1. Signed-out call rejected.
-- 2. Signed-in member can mark one of their own rows.
-- 3. Passing another member's event ID changes 0 rows.
-- 4. Passing NULL marks only the signed-in member's unread rows.
-- 5. Re-read the Agent Dashboard and confirm bell/count/drawer agree.
