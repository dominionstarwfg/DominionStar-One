-- POSTGREST HTTP HARNESS ONLY. Disposal-only synthetic PostgreSQL service.
-- Do not execute against Supabase or a connected/persistent database.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
  IF current_database()<>'synthetic_agent_privacy' THEN
    RAISE EXCEPTION 'HTTP harness may only run against synthetic_agent_privacy';
  END IF;
END;
$guard$;
CREATE ROLE ds_http_authenticator LOGIN NOINHERIT
  PASSWORD 'SYNTHETIC_HTTP_REVIEW_PASSWORD_ONLY';
GRANT anon,authenticated TO ds_http_authenticator;
GRANT USAGE ON SCHEMA public TO ds_http_authenticator;

-- The legacy fixture auth.uid() reads request.jwt.claim.sub because SQL-only
-- tests SET that GUC directly. Modern PostgREST sends claims as a JSON GUC
-- instead. Support BOTH forms ONLY in this disposable HTTP job; this is not
-- a migration and does not edit a real Supabase auth schema.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $func$
 SELECT pg_catalog.coalesce(
   pg_catalog.nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),''),
   pg_catalog.nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb->>'sub'
 )::uuid;
$func$;

-- PostgREST connects as the narrow authenticator and changes to
-- the JWT role for each request. No service_role impersonation allowed.
SELECT 'SYNTHETIC_HTTP_AUTHENTICATOR_READY' AS result;
