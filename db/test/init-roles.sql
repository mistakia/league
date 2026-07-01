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
END
$$;
