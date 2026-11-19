-- Disposable PostgreSQL-only tests, executed AFTER projection preparation.
-- No production Supabase login, accounts, or PII.
\set ON_ERROR_STOP on

DO $verify_setup$
DECLARE total integer;
BEGIN
  IF EXISTS(SELECT 1 FROM public.member_public_profiles
    WHERE id IN ('00000000-0000-4000-8000-000000000002',
                 '00000000-0000-4000-8000-000000000004',
                 '00000000-0000-4000-8000-000000000005'))
  THEN RAISE EXCEPTION 'Legacy opt-out, private or pending member was published'; END IF;

  IF (SELECT profile_visibility FROM public.member_profiles
    WHERE id='00000000-0000-4000-8000-000000000002')<>'private'
  THEN RAISE EXCEPTION 'Legacy metadata opt-out was not respected'; END IF;

  SELECT count(*) INTO total FROM public.member_public_profiles
  WHERE id='00000000-0000-4000-8000-000000000003';
  IF total<>1 THEN RAISE EXCEPTION 'Visible member projection missing'; END IF;

  IF EXISTS(
    SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='member_public_profiles'
      AND column_name IN (
        'email','phone','address_line1','address_line2','agent_code',
        'smd_name','account_notes','postal_code','role','is_founder')
  ) THEN RAISE EXCEPTION 'A sensitive member column was projected'; END IF;
END;
$verify_setup$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);
DO $verify_visible_before_enforcement$
BEGIN
  -- Known prior vulnerability: broad approved-member RLS can expose other
  -- members' sensitive columns until final enforcement. It MUST disappear.
  IF (SELECT count(*) FROM public.member_profiles WHERE
       id='00000000-0000-4000-8000-000000000003'
       AND account_notes='PRIVATE-SYNTHETIC-NOTES')<>1
  THEN RAISE EXCEPTION 'Expected pre-enforcement broad policy not reproduced'; END IF;

  IF (SELECT count(*) FROM public.member_public_profiles WHERE
       id='00000000-0000-4000-8000-000000000003')<>1
  THEN RAISE EXCEPTION 'Approved member cannot read safe professional peer'; END IF;

  IF (SELECT count(*) FROM public.member_public_profiles
       WHERE id='00000000-0000-4000-8000-000000000002')<>0
  THEN RAISE EXCEPTION 'Legacy opted-out member leaked to approved viewer'; END IF;

  IF (SELECT count(*) FROM public.list_community_feed()
      WHERE id='11000000-0000-4000-8000-000000000001'
       AND author_full_name IS NULL)<>1
  THEN RAISE EXCEPTION 'Opted-out Feed author identity was disclosed'; END IF;
  IF (SELECT count(*) FROM public.list_community_feed()
      WHERE id='11000000-0000-4000-8000-000000000002'
       AND author_full_name='Annabelle')<>1
  THEN RAISE EXCEPTION 'Visible Feed author metadata missing'; END IF;

  IF (SELECT count(*) FROM public.list_community_chat()
      WHERE id='12000000-0000-4000-8000-000000000001'
       AND author_full_name IS NULL)<>1
  THEN RAISE EXCEPTION 'Opted-out chat author identity was disclosed'; END IF;
END;
$verify_visible_before_enforcement$;

-- C chooses private through the server RPC; auto-projection must disappear.
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',false);
DO $check_member_visibility$
DECLARE state text;
BEGIN
  SELECT public.set_my_member_directory_visibility('private') INTO state;
  IF state<>'private' THEN RAISE EXCEPTION 'Private preference was not persisted'; END IF;
  IF EXISTS (SELECT 1 FROM public.member_public_profiles
    WHERE id='00000000-0000-4000-8000-000000000003')
  THEN RAISE EXCEPTION 'Private member still appears in projection'; END IF;
  SELECT public.set_my_member_directory_visibility('members') INTO state;
  IF state<>'members' THEN RAISE EXCEPTION 'Directory re-enable failed'; END IF;
  IF (SELECT count(*) FROM public.member_public_profiles
    WHERE id='00000000-0000-4000-8000-000000000003')<>1
  THEN RAISE EXCEPTION 'Member not restored in projection'; END IF;
END;
$check_member_visibility$;

-- B explicitly changes the previously imported opt-out preference to members.
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',false);
DO $check_legacy_reoptin$
BEGIN
  IF public.set_my_member_directory_visibility('members')<>'members'
  THEN RAISE EXCEPTION 'Explicit re-opt-in failed'; END IF;
  IF (SELECT count(*) FROM public.member_public_profiles WHERE
    id='00000000-0000-4000-8000-000000000002')<>1
  THEN RAISE EXCEPTION 'Explicit opt-in did not restore projection'; END IF;
  IF public.set_my_member_directory_visibility('private')<>'private'
  THEN RAISE EXCEPTION 'Privacy opt-out failed'; END IF;
END;
$check_legacy_reoptin$;

SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000005',false);
DO $verify_pending_projection$
BEGIN
  IF EXISTS(SELECT 1 FROM public.member_public_profiles)
  THEN RAISE EXCEPTION 'Pending member can read professional directory'; END IF;
  IF EXISTS(SELECT 1 FROM public.list_community_feed())
  THEN RAISE EXCEPTION 'Pending member can use privileged Feed RPC'; END IF;
  IF EXISTS(SELECT 1 FROM public.list_community_chat())
  THEN RAISE EXCEPTION 'Pending member can use privileged chat RPC'; END IF;
  BEGIN
    PERFORM public.set_my_member_directory_visibility('members');
    RAISE EXCEPTION 'Pending account can change server-owned visibility';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Approved membership required'
    THEN RAISE; END IF;
  END;
END;
$verify_pending_projection$;

RESET ROLE;
SET ROLE anon;
DO $verify_anon$
BEGIN
  BEGIN
    PERFORM 1 FROM public.member_public_profiles;
    RAISE EXCEPTION 'Anonymous role can read directory';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.set_my_member_directory_visibility('members');
    RAISE EXCEPTION 'Anonymous role can change directory visibility';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$verify_anon$;
RESET ROLE;

SELECT 'MEMBER_PROJECTION_PREPARE_POSTGRES_PASS' AS result;
