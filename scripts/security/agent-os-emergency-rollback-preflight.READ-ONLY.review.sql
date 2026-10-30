-- READ ONLY — emergency compatibility rollback preflight.
-- Safe to run repeatedly. Performs no mutations.
WITH checks AS (
  SELECT
    'required_objects'::text AS gate,
    (
      to_regclass('public.direct_messages') IS NOT NULL
      AND to_regclass('public.executive_events') IS NOT NULL
      AND to_regprocedure('public.is_dominionstar_founder()') IS NOT NULL
      AND to_regprocedure('public.queue_community_email_notifications(uuid,text)') IS NOT NULL
    ) AS pass,
    jsonb_build_object(
      'direct_messages',to_regclass('public.direct_messages') IS NOT NULL,
      'executive_events',to_regclass('public.executive_events') IS NOT NULL,
      'founder_fn',to_regprocedure('public.is_dominionstar_founder()') IS NOT NULL,
      'legacy_community_email_fn',to_regprocedure('public.queue_community_email_notifications(uuid,text)') IS NOT NULL
    ) AS details

  UNION ALL

  SELECT
    'no_active_calls',
    count(*) FILTER (WHERE status IN ('ringing','connected'))=0,
    jsonb_build_object(
      'ringing',count(*) FILTER (WHERE status='ringing'),
      'connected',count(*) FILTER (WHERE status='connected')
    )
  FROM public.communication_calls

  UNION ALL

  SELECT
    'trusted_message_trigger_state',
    true,
    jsonb_build_object(
      'present',exists(
        select 1 from pg_trigger t
        join pg_class c on c.oid=t.tgrelid
        join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public'
          and c.relname='direct_messages'
          and t.tgname='emit_direct_message_notification_trigger'
          and not t.tgisinternal
      )
    )

  UNION ALL

  SELECT
    'policy_snapshot',
    true,
    jsonb_build_object(
      'old_dm_update_policy',exists(
        select 1 from pg_policies
        where schemaname='public' and tablename='direct_messages'
          and policyname='members update received direct messages'
      ),
      'old_event_insert_policy',exists(
        select 1 from pg_policies
        where schemaname='public' and tablename='executive_events'
          and policyname='members create executive events'
      ),
      'hardened_event_insert_policy',exists(
        select 1 from pg_policies
        where schemaname='public' and tablename='executive_events'
          and policyname='members create own executive events'
      )
    )
)
SELECT gate,pass,details
FROM checks
ORDER BY gate;
