-- Disposable Postgres final privacy enforcement assertions.
-- Run ONLY after member-public-projection-enforce against synthetic data.
\set ON_ERROR_STOP on
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);
DO $verify_owner_vs_peer$
BEGIN
  IF (SELECT count(*) FROM public.member_profiles
      WHERE id='00000000-0000-4000-8000-000000000001'
        AND account_notes='PRIVATE-SYNTHETIC-NOTES')<>1
  THEN RAISE EXCEPTION 'Member cannot read their own private profile'; END IF;

  IF EXISTS(SELECT 1 FROM public.member_profiles
      WHERE id='00000000-0000-4000-8000-000000000003')
  THEN RAISE EXCEPTION 'P0: approved member can still read peer profile'; END IF;

  IF (SELECT count(*) FROM public.member_public_profiles
      WHERE id='00000000-0000-4000-8000-000000000003'
        AND full_name='Annabelle')<>1
  THEN RAISE EXCEPTION 'Public-safe peer professional directory not available'; END IF;

  IF EXISTS(SELECT 1 FROM public.member_public_profiles
      WHERE id='00000000-0000-4000-8000-000000000002')
  THEN RAISE EXCEPTION 'Explicitly opted-out member was published'; END IF;
END;
$verify_owner_vs_peer$;

-- Another regular member must not see A's email, Agent Code, phone or notes
-- through the original member_profiles table, regardless of which columns
-- they request. This is an actual synthetic SQL row-access check.
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',false);
DO $verify_other_side$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.member_profiles
    WHERE id='00000000-0000-4000-8000-000000000001'
      AND (
        email LIKE '%example.invalid' OR agent_code LIKE 'SYN-%'
        OR phone IS NOT NULL OR account_notes IS NOT NULL
      )
  ) THEN RAISE EXCEPTION 'P0: peer can read private member PII'; END IF;

  IF (SELECT count(*) FROM public.member_public_profiles
      WHERE id='00000000-0000-4000-8000-000000000001')<>1
  THEN RAISE EXCEPTION 'Safe directory hides opted-in approved member'; END IF;
END;
$verify_other_side$;

-- Founder still sees owner-managed private account rows but the public-safe
-- projection itself must not contain private or pending member identities.
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000010',false);
DO $verify_founder$
BEGIN
  IF (SELECT count(*) FROM public.member_profiles
      WHERE id='00000000-0000-4000-8000-000000000004'
        AND account_notes='PRIVATE-SYNTHETIC-NOTES')<>1
  THEN RAISE EXCEPTION 'Founder lost managed private member read'; END IF;
  IF (SELECT count(*) FROM public.member_profiles
      WHERE id='00000000-0000-4000-8000-000000000005')<>1
  THEN RAISE EXCEPTION 'Founder lost pending member read'; END IF;
  IF EXISTS(SELECT 1 FROM public.member_public_profiles
      WHERE id IN(
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000004',
        '00000000-0000-4000-8000-000000000005'
      ))
  THEN RAISE EXCEPTION 'Public projection contains private/pending identity'; END IF;
END;
$verify_founder$;

-- Only authorized approval can make a pending member visible; Founder update
-- uses the existing scoped policy and the projection trigger.
UPDATE public.member_profiles SET verification_status='approved'
WHERE id='00000000-0000-4000-8000-000000000005';
DO $verify_approval$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.member_public_profiles
      WHERE id='00000000-0000-4000-8000-000000000005')
  THEN RAISE EXCEPTION 'Approval did not synchronize directory'; END IF;
END;
$verify_approval$;

-- Newly approved member can now see public directory but not member source.
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000005',false);
DO $verify_newly_approved$
BEGIN
  IF EXISTS(SELECT 1 FROM public.member_profiles
      WHERE id='00000000-0000-4000-8000-000000000003')
  THEN RAISE EXCEPTION 'Newly approved member can read a peer private source row'; END IF;
  IF (SELECT count(*) FROM public.member_public_profiles WHERE
      id='00000000-0000-4000-8000-000000000003')<>1
  THEN RAISE EXCEPTION 'Newly approved member cannot use directory'; END IF;
END;
$verify_newly_approved$;

RESET ROLE;
SELECT 'MEMBER_PROJECTION_ENFORCE_POSTGRES_PASS' AS result;
