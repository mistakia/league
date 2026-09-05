-- Roles that db/schema.postgres.sql GRANTs to but the official postgres image
-- does not create. Mounted into /docker-entrypoint-initdb.d by compose.test.yaml
-- and run once on first container init (empty data dir). Idempotent so a manual
-- re-run is harmless.
--
-- These mirror the production role split (2026-07-01): league_writer owns the
-- objects and is the source of the schema's ALTER DEFAULT PRIVILEGES, while
-- league_reader is the read-only grantee. The suite itself connects as the
-- league_test superuser (compose.test.yaml), so these roles only need to exist
-- for the schema's GRANT / default-privilege statements to resolve at load.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres SUPERUSER;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'league_writer') THEN
    CREATE ROLE league_writer;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'league_reader') THEN
    CREATE ROLE league_reader;
  END IF;
  -- The sandboxed-SQL data-view role. It entered the schema dump on 2026-08-28
  -- as 273 GRANT statements, so the schema no longer LOADS without it -- this is
  -- not optional decoration. test/data-view-sql-sandbox.spec.mjs gives it LOGIN,
  -- a password and its grants; here it only has to exist.
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'league_data_view_reader') THEN
    CREATE ROLE league_data_view_reader;
  END IF;
  -- The contribution reproduction role. It enters the schema dump the same way
  -- once db/adhoc/2026-08-31-create-contribution-reader-role.sql is applied to
  -- production and the schema is re-exported; created here ahead of that so the
  -- load does not start failing on the commit that exports it.
  --
  -- This script runs ONLY on first initialization of an empty data volume, so a
  -- container whose volume predates this line will never have the role. If a
  -- spec fails with 28000 or an unresolvable GRANT, recreate the volume rather
  -- than assuming this ran.
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'league_contribution_reader') THEN
    CREATE ROLE league_contribution_reader;
  END IF;
END
$$;

-- Disposability marker. db/guard-destructive-target.mjs REQUIRES this comment
-- before it will let anything drop tables here, so a database without it is
-- simply not a destructive target.
--
-- Why a marker and not the database NAME: the guard's other conditions are the
-- name and "is the host loopback", and neither can tell two loopback servers
-- apart. This machine runs the test container on :5433 and a Homebrew Postgres
-- on :5432; a `league_test` on EITHER satisfies name-plus-loopback, so the name
-- test would have permitted dropping every table on the wrong server. Only the
-- server itself can say "I was created to be thrown away", so we ask it.
--
-- Set on current_database() rather than a literal name, because the same script
-- stamps league_test (docker init and CI) and scripts/test-isolated.sh stamps
-- each per-run league_test_<slug>.
--
-- A COMMENT survives the suite's own teardown by construction: test/global.mjs
-- drops tables WHERE schemaname = 'public', and a database comment is not a
-- table. A marker table in public would delete itself on the first run.
--
-- Keep this string byte-identical to DISPOSABLE_DATABASE_MARKER in
-- db/guard-destructive-target.mjs; test/db.guard-destructive-target.spec.mjs
-- fails if they drift.
DO $$
BEGIN
  EXECUTE format(
    'COMMENT ON DATABASE %I IS %L',
    current_database(),
    'league:disposable-test-database'
  );
END
$$;
