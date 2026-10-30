-- REVIEW ONLY — DO NOT RUN WITHOUT EXPLICIT PRODUCTION ROLLBACK APPROVAL.
-- EMERGENCY COMPATIBILITY ROLLBACK.
-- Use only if production code must be rolled back to the pre-cutover Agent OS
-- AFTER the hardening migrations have already been applied.
-- This intentionally restores only the minimum authenticated-browser behavior
-- required by the old code. It does NOT restore anonymous RPC exposure.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.direct_messages') IS NULL
     OR to_regclass('public.executive_events') IS NULL THEN
    RAISE EXCEPTION 'Required messaging tables are missing';
  END IF;
END;
$preflight$;

-- Prevent duplicate message.received events when old browser code resumes
-- cross-member ExecutiveCore publication.
DROP TRIGGER IF EXISTS emit_direct_message_notification_trigger
  ON public.direct_messages;

-- Restore the pre-cutover Direct Message browser mutation path for authenticated
-- members only. Anonymous table access remains revoked.
DROP POLICY IF EXISTS "members update received direct messages"
  ON public.direct_messages;
CREATE POLICY "members update received direct messages"
  ON public.direct_messages
  FOR UPDATE TO authenticated
  USING (
    recipient_id=auth.uid()
    OR sender_id=auth.uid()
    OR public.is_dominionstar_founder()
  )
  WITH CHECK (
    recipient_id=auth.uid()
    OR sender_id=auth.uid()
    OR public.is_dominionstar_founder()
  );
GRANT UPDATE ON TABLE public.direct_messages TO authenticated;
REVOKE ALL ON TABLE public.direct_messages FROM anon;

-- Restore the old browser-authored cross-member event policy. Keep anonymous
-- access revoked and keep table privileges narrower than the historical live
-- state.
DROP POLICY IF EXISTS "members create own executive events"
  ON public.executive_events;
DROP POLICY IF EXISTS "members create executive events"
  ON public.executive_events;
CREATE POLICY "members create executive events"
  ON public.executive_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id=auth.uid()
    AND member_id IS NOT NULL
  );

-- Old dashboard marks its own notifications read directly.
DROP POLICY IF EXISTS "members update own executive events"
  ON public.executive_events;
CREATE POLICY "members update own executive events"
  ON public.executive_events
  FOR UPDATE TO authenticated
  USING (member_id=auth.uid())
  WITH CHECK (member_id=auth.uid());

REVOKE ALL ON TABLE public.executive_events FROM anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.executive_events TO authenticated;

-- Old Community Chat browser code calls this legacy RPC. Do not restore anon.
DO $community$
DECLARE fn oid:=to_regprocedure('public.queue_community_email_notifications(uuid,text)');
BEGIN
  IF fn IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.queue_community_email_notifications(uuid,text)
      FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.queue_community_email_notifications(uuid,text)
      TO authenticated, service_role;
  END IF;
END;
$community$;

DO $verify$
BEGIN
  IF has_table_privilege('anon','public.direct_messages','SELECT')
     OR has_table_privilege('anon','public.executive_events','SELECT')
     OR NOT has_table_privilege('authenticated','public.direct_messages','UPDATE')
     OR NOT has_table_privilege('authenticated','public.executive_events','UPDATE')
     OR NOT EXISTS(
       SELECT 1 FROM pg_policies
       WHERE schemaname='public'
         AND tablename='executive_events'
         AND policyname='members create executive events'
         AND cmd='INSERT'
     )
     OR EXISTS(
       SELECT 1 FROM pg_trigger t
       JOIN pg_class c ON c.oid=t.tgrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public'
         AND c.relname='direct_messages'
         AND t.tgname='emit_direct_message_notification_trigger'
         AND NOT t.tgisinternal
     )
  THEN
    RAISE EXCEPTION 'Emergency compatibility rollback verification failed';
  END IF;
END;
$verify$;

COMMIT;

-- Recovery notes:
-- 1. This is a temporary compatibility state, not the desired steady state.
-- 2. Keep webPush=false.
-- 3. If the current flag file is still deployed, keep trustedMessageEvents=false.
-- 4. Fix the code forward, then reapply the hardened migrations and post-cutover verifier.
-- 5. Do not restore anonymous SECURITY DEFINER execution.
