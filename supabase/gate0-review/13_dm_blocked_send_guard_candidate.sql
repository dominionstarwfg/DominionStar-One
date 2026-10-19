-- DOMINIONSTAR GATE 0 — STAGING-ONLY BLOCKED-CONNECTION SEND GUARD
-- DO NOT APPLY TO PRODUCTION OR MERGE AUTOMATICALLY.
-- Must be staged *after* 04_dm_approved_sender_policy.sql and
-- 12_connection_state_integrity_candidate.sql with synthetic JWT tests.
-- Blocked participants must not SEND to each other in either direction.
-- Existing message SELECT remains separately governed (history may remain).

BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='direct_messages'
      AND policyname='members send direct messages'
      AND cmd='INSERT'
  ) THEN
    RAISE EXCEPTION 'STOP: direct messages INSERT policy missing';
  END IF;
  IF to_regclass('public.member_connections') IS NULL THEN
    RAISE EXCEPTION 'STOP: member_connections table missing';
  END IF;
END
$preflight$;

ALTER POLICY "members send direct messages" ON public.direct_messages
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.member_profiles sender
    WHERE sender.id=auth.uid()
      AND sender.verification_status='approved'
  )
  AND EXISTS (
    SELECT 1 FROM public.member_profiles recipient
    WHERE recipient.id=direct_messages.recipient_id
      AND recipient.verification_status='approved'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.member_connections relationship
    WHERE relationship.status='blocked'
      AND (
        (relationship.requester_id=auth.uid()
          AND relationship.recipient_id=direct_messages.recipient_id)
        OR
        (relationship.recipient_id=auth.uid()
          AND relationship.requester_id=direct_messages.recipient_id)
      )
  )
);

DO $verify$
DECLARE expr text;
BEGIN
  SELECT with_check INTO expr
  FROM pg_policies WHERE schemaname='public'
    AND tablename='direct_messages'
    AND policyname='members send direct messages';
  IF expr IS NULL
     OR expr NOT ILIKE '%sender.verification_status%'
     OR expr NOT ILIKE '%recipient.verification_status%'
     OR expr NOT ILIKE '%relationship.status%'
     OR expr NOT ILIKE '%blocked%' THEN
    RAISE EXCEPTION 'STOP: approved sender/recipient and blocked relationship checks missing';
  END IF;
END
$verify$;
COMMIT;

-- Required synthetic staging QA:
-- A approved -> B approved without block: sends successfully.
-- A BLOCKS B: A -> B and B -> A both denied for TEXT/VOICE/FORWARD.
-- B BLOCKS A: A -> B and B -> A both denied.
-- Reciprocal A->B and B->A relationship rows behave consistently.
-- A/B may still read prior messages unless separately specified.
-- Pending or suspended senders denied even without blocked relationship.
-- Third-party C cannot send as A or access A/B history.
-- Preserve call/voice actions with explicit graceful errors.
-- Confirm no RLS self-reference recursion or client notification leak.
