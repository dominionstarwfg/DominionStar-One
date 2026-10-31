-- READ ONLY — production preflight for DominionStar Agent/Founder OS cutover.
-- Safe to run repeatedly. It performs no INSERT/UPDATE/DELETE/DDL.
WITH required_tables(name) AS (
  VALUES
    ('member_profiles'),('direct_messages'),('executive_events'),
    ('communication_calls'),('notification_preferences'),
    ('email_notification_outbox'),('community_chat_messages'),
    ('member_appointments')
),
required_columns(table_name,column_name) AS (
  VALUES
    ('direct_messages','updated_at'),
    ('direct_messages','read_at'),
    ('direct_messages','is_deleted'),
    ('executive_events','read_at'),
    ('executive_events','priority'),
    ('communication_calls','caller_id'),
    ('communication_calls','recipient_id'),
    ('communication_calls','call_type'),
    ('communication_calls','status'),
    ('communication_calls','metadata'),
    ('notification_preferences','messages_email_enabled'),
    ('notification_preferences','community_email_enabled'),
    ('notification_preferences','appointments_email_enabled'),
    ('notification_preferences','announcements_email_enabled'),
    ('email_notification_outbox','dedupe_key'),
    ('email_notification_outbox','status')
),
checks AS (
  SELECT
    'required_tables'::text AS gate,
    bool_and(to_regclass('public.'||name) IS NOT NULL) AS pass,
    jsonb_agg(jsonb_build_object('table',name,'exists',to_regclass('public.'||name) IS NOT NULL) ORDER BY name) AS details
  FROM required_tables

  UNION ALL

  SELECT
    'required_columns',
    bool_and(exists(
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public'
        AND c.table_name=rc.table_name
        AND c.column_name=rc.column_name
    )),
    jsonb_agg(jsonb_build_object(
      'table',rc.table_name,
      'column',rc.column_name,
      'exists',exists(
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema='public'
          AND c.table_name=rc.table_name
          AND c.column_name=rc.column_name
      )
    ) ORDER BY rc.table_name,rc.column_name)
  FROM required_columns rc

  UNION ALL

  SELECT
    'no_active_communication_calls',
    count(*) FILTER (WHERE status IN ('ringing','connected'))=0,
    jsonb_build_object(
      'ringing',count(*) FILTER (WHERE status='ringing'),
      'connected',count(*) FILTER (WHERE status='connected')
    )
  FROM public.communication_calls

  UNION ALL

  SELECT
    'email_queue_not_processing',
    count(*) FILTER (WHERE status='processing')=0,
    jsonb_build_object(
      'pending',count(*) FILTER (WHERE status='pending'),
      'processing',count(*) FILTER (WHERE status='processing'),
      'failed',count(*) FILTER (WHERE status='failed'),
      'stale_pending_over_30d',count(*) FILTER (
        WHERE status='pending' AND created_at < now()-interval '30 days'
      )
    )
  FROM public.email_notification_outbox

  UNION ALL

  SELECT
    'expected_pre_cutover_policies',
    (
      EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='direct_messages' AND policyname='members update received direct messages')
      AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='executive_events' AND policyname='members create executive events')
      AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='communication_calls' AND policyname='caller creates calls')
    ),
    jsonb_build_object(
      'direct_message_update_policy',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='direct_messages' AND policyname='members update received direct messages'),
      'executive_event_insert_policy',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='executive_events' AND policyname='members create executive events'),
      'communication_call_insert_policy',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='communication_calls' AND policyname='caller creates calls')
    )

  UNION ALL

  SELECT
    'email_trigger_present',
    EXISTS(
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE n.nspname='public'
        AND c.relname='executive_events'
        AND t.tgname='queue_member_event_email_trigger'
        AND p.proname='queue_member_event_email'
        AND NOT t.tgisinternal
    ),
    jsonb_build_object('trigger','queue_member_event_email_trigger')

  UNION ALL

  SELECT
    'notification_preference_snapshot',
    true,
    jsonb_build_object(
      'rows',count(*),
      'message_email_on',count(*) FILTER (WHERE messages_email_enabled=true),
      'community_email_on',count(*) FILTER (WHERE community_email_enabled=true),
      'appointment_email_on',count(*) FILTER (WHERE appointments_email_enabled=true),
      'announcement_email_on',count(*) FILTER (WHERE announcements_email_enabled=true)
    )
  FROM public.notification_preferences

  UNION ALL

  SELECT
    'security_definer_snapshot',
    true,
    jsonb_build_object(
      'anon_non_meet_security_definer_count',count(*)
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.prokind='f'
    AND p.prosecdef=true
    AND p.proname NOT LIKE 'meet_%'
    AND has_function_privilege('anon',p.oid,'EXECUTE')
)
SELECT gate,pass,details
FROM checks
ORDER BY gate;
