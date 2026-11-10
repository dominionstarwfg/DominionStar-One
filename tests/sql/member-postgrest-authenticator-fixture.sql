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
-- PostgREST connects as the narrow authenticator and changes to
-- the JWT role for each request. No service_role impersonation allowed.
SELECT 'SYNTHETIC_HTTP_AUTHENTICATOR_READY' AS result;
