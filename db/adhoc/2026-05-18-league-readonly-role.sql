-- Read-only Postgres role used by scripts/data-view-regression-check.mjs to
-- execute fixture queries against production without any possibility of
-- mutating state. The script also wraps each query in `SET TRANSACTION READ
-- ONLY`, but that is convention; a role with only SELECT is enforcement.
--
-- Apply with: yarn db:exec db/adhoc/2026-05-18-league-readonly-role.sql
--
-- The role is created without a password. After applying this migration, set
-- the password out of band, e.g.:
--   ssh league "psql -U league_user -h localhost league_production -c \\
--     \"ALTER ROLE league_readonly PASSWORD '<value>'\""
-- so the secret never enters version control.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_readonly') THEN
    CREATE ROLE league_readonly LOGIN;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE league_production TO league_readonly;
GRANT USAGE ON SCHEMA public TO league_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO league_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO league_readonly;

-- Cover tables created after this migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO league_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO league_readonly;

-- Belt-and-suspenders: the role's default transaction mode is read-only so
-- any DML attempted via this login fails before reaching a table.
ALTER ROLE league_readonly SET default_transaction_read_only = on;
