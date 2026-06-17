-- Roles that db/schema.postgres.sql GRANTs to but the official postgres image
-- does not create. Mounted into /docker-entrypoint-initdb.d by compose.test.yaml
-- and run once on first container init (empty data dir). Idempotent so a manual
-- re-run is harmless.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres SUPERUSER;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'league_user') THEN
    CREATE ROLE league_user;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'league_readonly') THEN
    CREATE ROLE league_readonly;
  END IF;
END
$$;
