-- REVIEW ONLY — DO NOT RUN WITHOUT EXPLICIT PRODUCTION DATABASE APPROVAL.
-- DominionStar Agent/Founder OS RPC privilege hardening.
-- Explicitly excludes DominionStar Meet RPCs.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.member_profiles') IS NULL
     OR to_regclass('public.community_chat_messages') IS NULL
     OR to_regclass('public.notification_preferences') IS NULL
     OR to_regclass('public.email_notification_outbox') IS NULL
     OR to_regclass('public.member_appointments') IS NULL THEN
    RAISE EXCEPTION 'Required Agent/Founder OS tables are missing';
  END IF;
END;
$preflight$;

-- Replace arbitrary sender/body Community email fan-out with a persisted
-- Community Chat message id owned by the signed-in member.
CREATE OR REPLACE FUNCTION public.queue_community_message_email(
  target_message_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  message_row public.community_chat_messages%rowtype;
  recipient record;
  sender_name text;
  queued integer := 0;
  inserted integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated member required';
  END IF;

  SELECT *
    INTO message_row
  FROM public.community_chat_messages
  WHERE id=target_message_id
    AND user_id=auth.uid()
    AND is_deleted=false;

  IF message_row.id IS NULL THEN
    RAISE EXCEPTION 'Community message not found or not owned by caller';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.member_profiles p
    WHERE p.id=auth.uid() AND p.verification_status='approved'
  ) THEN
    RAISE EXCEPTION 'Approved member required';
  END IF;

  SELECT coalesce(nullif(p.preferred_name,''),nullif(p.full_name,''),p.email,'DominionStar member')
    INTO sender_name
  FROM public.member_profiles p
  WHERE p.id=auth.uid();

  FOR recipient IN
    SELECT p.id,p.email
    FROM public.member_profiles p
    LEFT JOIN public.notification_preferences np ON np.user_id=p.id
    WHERE p.id<>auth.uid()
      AND p.verification_status='approved'
      AND p.email IS NOT NULL
      AND coalesce(np.email_enabled,true)=true
      AND coalesce(np.community_email_enabled,false)=true
  LOOP
    INSERT INTO public.email_notification_outbox(
      user_id,recipient_id,recipient_email,event_type,subject,body,
      status,next_attempt_at,action_url,dedupe_key
    ) VALUES (
      recipient.id,recipient.id,recipient.email,
      'community_chat',
      'New DominionStar Community Chat Message',
      coalesce(sender_name,'DominionStar member')||
        ' posted a new message in Community Chat: '||left(message_row.body,300),
      'pending',now(),'/community-chat/',
      'community-chat:'||message_row.id::text||':'||recipient.id::text
    )
    ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

    GET DIAGNOSTICS inserted=ROW_COUNT;
    queued := queued + inserted;
  END LOOP;

  RETURN queued;
END;
$function$;

-- Appointment emails remain a signed-in RPC but explicitly reject anonymous
-- callers before any owner/founder checks. Queue records are deduplicated by
-- appointment update version.
CREATE OR REPLACE FUNCTION public.queue_appointment_email(
  target_appointment_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  appointment_row public.member_appointments%rowtype;
  destination text;
  queued_id uuid;
  subject_text text;
  body_text text;
  dedupe text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated member required';
  END IF;

  SELECT *
    INTO appointment_row
  FROM public.member_appointments
  WHERE id=target_appointment_id;

  IF appointment_row.id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF NOT public.is_dominionstar_founder()
     AND appointment_row.member_id<>auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT p.email
    INTO destination
  FROM public.member_profiles p
  WHERE p.id=appointment_row.member_id
    AND p.verification_status='approved'
    AND p.email IS NOT NULL;

  IF destination IS NULL THEN
    RETURN NULL;
  END IF;

  subject_text := CASE
    WHEN appointment_row.status='confirmed' THEN 'DominionStar appointment confirmed'
    WHEN appointment_row.status='rescheduled' THEN 'DominionStar appointment rescheduled'
    WHEN appointment_row.status='cancelled' THEN 'DominionStar appointment cancelled'
    WHEN appointment_row.status='completed' THEN 'DominionStar appointment completed'
    ELSE 'DominionStar appointment updated'
  END;

  body_text :=
    subject_text||
    E'\n\nStatus: '||appointment_row.status||
    CASE WHEN appointment_row.confirmed_start IS NOT NULL
      THEN E'\nDate: '||to_char(appointment_row.confirmed_start,'Mon DD, YYYY at HH12:MI AM')
      ELSE '' END||
    CASE WHEN appointment_row.meeting_location IS NOT NULL
      THEN E'\nLocation: '||appointment_row.meeting_location
      ELSE '' END||
    CASE WHEN appointment_row.founder_notes IS NOT NULL
      THEN E'\nNote: '||appointment_row.founder_notes
      ELSE '' END;

  dedupe := 'appointment:'||appointment_row.id::text||':'||
    appointment_row.updated_at::text;

  INSERT INTO public.email_notification_outbox(
    user_id,recipient_id,recipient_email,event_type,subject,body,
    status,next_attempt_at,dedupe_key
  ) VALUES (
    appointment_row.member_id,appointment_row.member_id,destination,
    'appointment',subject_text,body_text,'pending',now(),dedupe
  )
  ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
  RETURNING id INTO queued_id;

  RETURN queued_id;
END;
$function$;

-- Remove mutable search_path warnings from simple timestamp trigger helpers.
ALTER FUNCTION public.touch_updated_at() SET search_path='';
ALTER FUNCTION public.set_presence_updated_at() SET search_path='';

-- Client-facing Agent/Founder RPCs. Remove inherited PUBLIC/anon execution and
-- grant only signed-in/browser and service roles.
DO $client$
DECLARE
  p record;
  client_names text[] := ARRAY[
    'assign_exclusive_founding_number',
    'community_chat_mark_seen',
    'community_chat_unread_count',
    'community_mark_chat_read',
    'community_mark_seen',
    'community_set_presence',
    'community_set_typing',
    'community_toggle_reaction',
    'community_unread_count',
    'dominionstar_relationship_health',
    'dominionstar_release_health',
    'dominionstar_v65_health',
    'ensure_default_milestones',
    'ensure_member_profile',
    'ensure_my_founding_member_number',
    'founder_analytics',
    'founder_delete_mindset_content',
    'founder_list_appointments',
    'founder_member_summary',
    'founder_moderate_community_post',
    'founder_set_milestone',
    'founder_update_appointment',
    'founder_update_member',
    'is_dominionstar_founder',
    'is_group_member',
    'list_community_chat',
    'list_community_feed',
    'log_system_activity',
    'mark_all_notifications_read',
    'mark_announcement_read',
    'production_self_test',
    'queue_appointment_email',
    'queue_community_message_email',
    'set_maintenance_mode',
    'set_maintenance_mode_v651a',
    'update_own_contact_profile',
    'update_own_professional_profile'
  ];
BEGIN
  FOR p IN
    SELECT pr.oid::regprocedure AS signature
    FROM pg_proc pr
    JOIN pg_namespace ns ON ns.oid=pr.pronamespace
    WHERE ns.nspname='public'
      AND pr.prosecdef=true
      AND pr.proname=ANY(client_names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',p.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',p.signature);
  END LOOP;
END;
$client$;

-- Internal/server-only helpers. These must not be browser RPC endpoints.
DO $internal$
DECLARE
  p record;
  service_names text[] := ARRAY[
    'claim_email_notification_batch',
    'queue_email_notification',
    'queue_community_email_notifications',
    'dominionstar_test_notification'
  ];
BEGIN
  FOR p IN
    SELECT pr.oid::regprocedure AS signature
    FROM pg_proc pr
    JOIN pg_namespace ns ON ns.oid=pr.pronamespace
    WHERE ns.nspname='public'
      AND pr.prosecdef=true
      AND pr.proname=ANY(service_names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',p.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',p.signature);
  END LOOP;
END;
$internal$;

-- Trigger/retired helpers have no direct API caller.
DO $trigger_only$
DECLARE
  p record;
  trigger_names text[] := ARRAY[
    'handle_new_member',
    'queue_member_event_email',
    'community_notify_mentions'
  ];
BEGIN
  FOR p IN
    SELECT pr.oid::regprocedure AS signature
    FROM pg_proc pr
    JOIN pg_namespace ns ON ns.oid=pr.pronamespace
    WHERE ns.nspname='public'
      AND pr.prosecdef=true
      AND pr.proname=ANY(trigger_names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',p.signature);
  END LOOP;
END;
$trigger_only$;

DO $verify$
DECLARE
  exposed integer;
  old_community_oid oid:=to_regprocedure('public.queue_community_email_notifications(uuid,text)');
  new_community_oid oid:=to_regprocedure('public.queue_community_message_email(uuid)');
  appointment_oid oid:=to_regprocedure('public.queue_appointment_email(uuid)');
BEGIN
  SELECT count(*)
    INTO exposed
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.prosecdef=true
    AND p.proname NOT LIKE 'meet_%'
    AND p.proname<>'queue_meeting_host_absent_notification'
    AND has_function_privilege('anon',p.oid,'EXECUTE');

  IF exposed<>0 THEN
    RAISE EXCEPTION 'Anonymous Agent/Founder SECURITY DEFINER execution remains: %',exposed;
  END IF;

  IF old_community_oid IS NULL OR new_community_oid IS NULL OR appointment_oid IS NULL THEN
    RAISE EXCEPTION 'Expected email RPCs are missing';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN ('touch_updated_at','set_presence_updated_at')
      AND coalesce(array_to_string(p.proconfig,','),'') NOT LIKE '%search_path=%'
  ) THEN
    RAISE EXCEPTION 'Timestamp trigger search_path hardening missing';
  END IF;

  IF has_function_privilege('authenticated',old_community_oid,'EXECUTE')
     OR NOT has_function_privilege('authenticated',new_community_oid,'EXECUTE')
     OR NOT has_function_privilege('authenticated',appointment_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected email RPC privileges';
  END IF;
END;
$verify$;

COMMIT;

-- Post-approval verification:
-- 1. Anonymous calls to Agent/Founder SECURITY DEFINER RPCs are denied.
-- 2. Approved Community member can queue email only for their persisted chat row.
-- 3. Replaying the same Community message does not duplicate recipient outbox rows.
-- 4. Anonymous appointment email queue is denied.
-- 5. Founder appointment save still queues one email for the updated version.
-- 6. Internal queue helpers are not executable by authenticated browser clients.
-- 7. Re-run Supabase Security Advisor; non-Meet anon SECURITY DEFINER count should be zero.
