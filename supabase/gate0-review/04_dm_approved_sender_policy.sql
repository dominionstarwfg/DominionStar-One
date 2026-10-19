-- DOMINIONSTAR EXECUTIVE OS — GATE 0 / CANDIDATE STAGING-ONLY PATCH
-- NEVER automatically deploy this file. It intentionally lives outside
-- supabase/migrations/. Requires isolated staging and synthetic-user tests.
--
-- Finding: "members send direct messages" currently validates sender_id
-- and an approved recipient, but not approval of the authenticated sender.
-- This patch changes only INSERT row validation. It does NOT fix the
-- separate SELECT / UPDATE / voice-media privacy findings.

BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'direct_messages'
      AND policyname = 'members send direct messages'
      AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'STOP: expected direct-message INSERT policy is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='direct_messages'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'STOP: RLS must be enabled for direct_messages';
  END IF;
END
$preflight$;

ALTER POLICY "members send direct messages" ON public.direct_messages
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.member_profiles sender_profile
    WHERE sender_profile.id = auth.uid()
      AND sender_profile.verification_status = 'approved'
  )
  AND EXISTS (
    SELECT 1
    FROM public.member_profiles recipient_profile
    WHERE recipient_profile.id = direct_messages.recipient_id
      AND recipient_profile.verification_status = 'approved'
  )
);

DO $verify$
DECLARE expression text;
BEGIN
  SELECT with_check INTO expression
  FROM pg_policies
  WHERE schemaname='public' AND tablename='direct_messages'
    AND policyname='members send direct messages';
  IF expression IS NULL
     OR expression NOT ILIKE '%sender_profile.verification_status%'
     OR expression NOT ILIKE '%recipient_profile.verification_status%'
  THEN
    RAISE EXCEPTION 'STOP: expected approved sender/recipient condition missing';
  END IF;
END
$verify$;

COMMIT;

-- REQUIRED NON-DESTRUCTIVE TEST MATRIX WITH SYNTHETIC AGENTS:
-- 1. Approved agent A -> approved agent B: INSERT succeeds.
-- 2. Pending agent P -> approved B: INSERT is denied.
-- 3. Suspended agent S -> approved B: INSERT is denied.
-- 4. Approved A -> pending P: INSERT is denied.
-- 5. Approved A with forged sender_id of B: INSERT is denied.
-- 6. Anonymous without JWT: INSERT denied.
-- 7. Founder -> approved member: functions according to approved-member status.
-- 8. Existing rows remain unchanged; old voice recordings load as before.
--
-- DO NOT infer SELECT/UPDATE or audio-storage security from INSERT tests.
-- Database RLS and storage checks, not the UI guard, are authoritative.
