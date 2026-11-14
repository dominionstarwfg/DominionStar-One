-- REVIEW ONLY — DO NOT RUN ON PRODUCTION OR ANY CONNECTED SUPABASE PROJECT.
-- DominionStar One Agent OS connection requests: source-owned *in-app* inbox events.
-- Requires isolated member_public_profiles preparation, final privacy RLS, and
-- member-connection-integrity migration in that order. No email/push activation.
-- The current email and web-push outbox triggers intentionally refuse
-- unrecognized cross-member connection events; do NOT bypass those safeguards.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.member_connections') IS NULL
     OR to_regclass('public.executive_events') IS NULL
     OR to_regclass('public.member_public_profiles') IS NULL
     OR to_regclass('public.member_profiles') IS NULL
  THEN RAISE EXCEPTION 'Member connections notification prerequisites missing'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='agent_os_connection_events'
      AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'Connection event trigger already exists; review drift'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.executive_events
    WHERE event_type IN ('connection.request','connection.accepted')
      AND payload ? 'connection_id'
    GROUP BY member_id,event_type,(payload->>'connection_id')
    HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'Connection notification source dedupe conflict'; END IF;
END;
$preflight$;

CREATE SCHEMA IF NOT EXISTS dominionstar_private;
REVOKE ALL ON SCHEMA dominionstar_private FROM PUBLIC,anon,authenticated;

-- Source-row event uniqueness is per recipient, action, and immutable
-- connection ID. A legitimately cancelled and newly created invitation
-- receives its own ID; updating an old row cannot replay the same event.
CREATE UNIQUE INDEX executive_connection_notifications_once_idx
ON public.executive_events (
  member_id,event_type,(payload->>'connection_id')
)
WHERE event_type IN ('connection.request','connection.accepted')
  AND payload ? 'connection_id';

CREATE OR REPLACE FUNCTION dominionstar_private.emit_connection_notifications()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=''
AS $function$
BEGIN
  IF NEW.requester_id=NEW.recipient_id THEN RETURN NEW; END IF;

  IF TG_OP='INSERT' THEN
    -- Never notify for a preaccepted/spoofed initial status.
    IF NEW.status<>'pending' THEN RETURN NEW; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.member_profiles p
      WHERE p.id=NEW.requester_id AND p.verification_status='approved'
    ) OR NOT EXISTS (
      SELECT 1 FROM public.member_public_profiles p
      WHERE p.id=NEW.recipient_id AND p.verification_status='approved'
    ) THEN RETURN NEW; END IF;

    INSERT INTO public.executive_events (
      member_id,actor_id,event_type,title,description,payload,priority
    ) VALUES (
      NEW.recipient_id,NEW.requester_id,'connection.request',
      'New connection request',
      'An approved DominionStar member wants to connect with you.',
      jsonb_build_object(
        'source_type','member_connection',
        'connection_id',NEW.id::text,
        'action_url','/member-directory/'
      ),'normal'
    ) ON CONFLICT DO NOTHING;

  ELSIF TG_OP='UPDATE' THEN
    -- Notify requester exactly once, and only for a real pending -> accepted
    -- transition. Declines/cancellations do not spam or expose private actions.
    IF OLD.status<>'pending' OR NEW.status<>'accepted'
       OR NEW.requester_id IS DISTINCT FROM OLD.requester_id
       OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
    THEN RETURN NEW; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.member_profiles p
      WHERE p.id=NEW.requester_id AND p.verification_status='approved'
    ) OR NOT EXISTS (
      SELECT 1 FROM public.member_profiles p
      WHERE p.id=NEW.recipient_id AND p.verification_status='approved'
    ) THEN RETURN NEW; END IF;

    INSERT INTO public.executive_events (
      member_id,actor_id,event_type,title,description,payload,priority
    ) VALUES (
      NEW.requester_id,NEW.recipient_id,'connection.accepted',
      'Connection request accepted',
      'A DominionStar member accepted your connection request.',
      jsonb_build_object(
        'source_type','member_connection',
        'connection_id',NEW.id::text,
        'action_url','/member-directory/'
      ),'normal'
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION dominionstar_private.emit_connection_notifications()
  FROM PUBLIC,anon,authenticated;
-- This function is trigger-only, never granted to browser/API roles.
CREATE TRIGGER agent_os_connection_events
AFTER INSERT OR UPDATE OF status ON public.member_connections
FOR EACH ROW
EXECUTE FUNCTION dominionstar_private.emit_connection_notifications();

DO $verify$
BEGIN
  IF has_function_privilege(
    'anon',
    'dominionstar_private.emit_connection_notifications()'::regprocedure,
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'dominionstar_private.emit_connection_notifications()'::regprocedure,
    'EXECUTE'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgname='agent_os_connection_events'
      AND t.tgrelid='public.member_connections'::regclass
      AND NOT t.tgisinternal
  ) THEN RAISE EXCEPTION 'Connection notification trigger security gate failed'; END IF;
END;
$verify$;
COMMIT;

-- ISOLATED AUTH/POSTGREST STAGING STILL REQUIRED:
-- A -> approved, directory-visible B: exactly one B in-app request alert.
-- B -> accepted: exactly one A in-app acceptance alert; repeated status saves
-- cannot replay an event; declined/cancelled requests generate no alert.
-- Opted-out / pending recipients must not get new request events.
-- Member can only read their own executive_events, not another member's.
-- Direct client INSERT into executive_events for other members remains denied.
-- Existing cross-member email/web-push triggers filter these event types:
-- no emails or background push should be sent by this migration alone.
-- Never set actor_id to NULL to evade source checks in other trigger functions.
