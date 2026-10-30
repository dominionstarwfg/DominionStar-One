-- READ ONLY — post-cutover verifier for DominionStar Agent/Founder OS.
-- Run immediately after the coordinated production migrations and before deploy.
WITH checks AS (
  SELECT
    'direct_message_rpc_integrity'::text AS gate,
    (
      to_regprocedure('public.mark_my_direct_messages_read(uuid)') IS NOT NULL
      AND to_regprocedure('public.edit_my_direct_message(uuid,text)') IS NOT NULL
      AND to_regprocedure('public.delete_my_direct_message(uuid)') IS NOT NULL
      AND NOT has_table_privilege('authenticated','public.direct_messages','UPDATE')
    ) AS pass,
    jsonb_build_object(
      'auth_direct_update',has_table_privilege('authenticated','public.direct_messages','UPDATE')
    ) AS details

  UNION ALL

  SELECT
    'notification_read_rpc',
    (
      to_regprocedure('public.mark_my_executive_notifications_read(uuid)') IS NOT NULL
      AND NOT has_function_privilege('anon',to_regprocedure('public.mark_my_executive_notifications_read(uuid)'),'EXECUTE')
      AND has_function_privilege('authenticated',to_regprocedure('public.mark_my_executive_notifications_read(uuid)'),'EXECUTE')
    ),
    '{}'::jsonb

  UNION ALL

  SELECT
    'executive_event_privileges',
    (
      NOT has_table_privilege('anon','public.executive_events','SELECT')
      AND NOT has_table_privilege('anon','public.executive_events','INSERT')
      AND has_table_privilege('authenticated','public.executive_events','SELECT')
      AND has_table_privilege('authenticated','public.executive_events','INSERT')
      AND NOT has_table_privilege('authenticated','public.executive_events','UPDATE')
      AND NOT has_table_privilege('authenticated','public.executive_events','DELETE')
    ),
    jsonb_build_object(
      'auth_select',has_table_privilege('authenticated','public.executive_events','SELECT'),
      'auth_insert',has_table_privilege('authenticated','public.executive_events','INSERT'),
      'auth_update',has_table_privilege('authenticated','public.executive_events','UPDATE'),
      'anon_select',has_table_privilege('anon','public.executive_events','SELECT')
    )

  UNION ALL

  SELECT
    'communication_call_rpc_integrity',
    (
      to_regprocedure('public.start_my_communication_call(uuid,text)') IS NOT NULL
      AND to_regprocedure('public.answer_my_communication_call(uuid)') IS NOT NULL
      AND to_regprocedure('public.finish_my_communication_call(uuid,text)') IS NOT NULL
      AND has_table_privilege('authenticated','public.communication_calls','SELECT')
      AND NOT has_table_privilege('authenticated','public.communication_calls','INSERT')
      AND NOT has_table_privilege('authenticated','public.communication_calls','UPDATE')
      AND NOT has_table_privilege('authenticated','public.communication_calls','DELETE')
    ),
    '{}'::jsonb

  UNION ALL

  SELECT
    'notification_email_opt_in',
    (
      count(*) FILTER (WHERE messages_email_enabled=true)=0
      AND count(*) FILTER (WHERE community_email_enabled=true)=0
      AND NOT EXISTS(
        SELECT 1 FROM public.email_notification_outbox
        WHERE status='pending' AND created_at<now()-interval '30 days'
      )
    ),
    jsonb_build_object(
      'message_email_on',count(*) FILTER (WHERE messages_email_enabled=true),
      'community_email_on',count(*) FILTER (WHERE community_email_enabled=true),
      'stale_pending_over_30d',(
        SELECT count(*) FROM public.email_notification_outbox
        WHERE status='pending' AND created_at<now()-interval '30 days'
      )
    )
  FROM public.notification_preferences

  UNION ALL

  SELECT
    'trusted_direct_message_trigger',
    (
      EXISTS(
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid=t.tgrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public'
          AND c.relname='direct_messages'
          AND t.tgname='emit_direct_message_notification_trigger'
          AND NOT t.tgisinternal
      )
      AND EXISTS(
        SELECT 1 FROM pg_policies
        WHERE schemaname='public'
          AND tablename='executive_events'
          AND policyname='members create own executive events'
          AND cmd='INSERT'
      )
    ),
    '{}'::jsonb

  UNION ALL

  SELECT
    'web_push_foundation',
    (
      to_regclass('public.web_push_subscriptions') IS NOT NULL
      AND to_regclass('public.push_notification_outbox') IS NOT NULL
      AND to_regprocedure('public.register_my_push_subscription(text,text,text,text)') IS NOT NULL
      AND to_regprocedure('public.claim_push_notification_batch(integer)') IS NOT NULL
      AND NOT has_function_privilege('authenticated',to_regprocedure('public.claim_push_notification_batch(integer)'),'EXECUTE')
      AND has_function_privilege('service_role',to_regprocedure('public.claim_push_notification_batch(integer)'),'EXECUTE')
    ),
    jsonb_build_object(
      'subscriptions_table',to_regclass('public.web_push_subscriptions') IS NOT NULL,
      'outbox_table',to_regclass('public.push_notification_outbox') IS NOT NULL
    )

  UNION ALL

  SELECT
    'anon_non_meet_security_definer_zero',
    count(*)=0,
    jsonb_build_object('remaining',count(*))
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.prokind='f'
    AND p.prosecdef=true
    AND p.proname NOT LIKE 'meet_%'
    AND p.proname<>'queue_meeting_host_absent_notification'
    AND has_function_privilege('anon',p.oid,'EXECUTE')
)
SELECT gate,pass,details
FROM checks
ORDER BY gate;
