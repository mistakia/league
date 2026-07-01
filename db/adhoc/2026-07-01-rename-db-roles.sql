-- 2026-07-01 role rename: league_user -> league_writer, league_readonly -> league_reader
--
-- Recorded after the fact. The rename was applied directly to production
-- (league_production on host league) at ~00:00 EDT 2026-07-01 with no committed
-- migration; this file reconstructs it for reproducibility and fresh-DB parity.
-- It is NOT the verbatim script that was run, but applying it to a database
-- holding the old roles produces the verified live end-state (confirmed
-- 2026-07-01 via pg_roles, \ddp, and information_schema.role_table_grants).
--
-- Mechanism (inferred, consistent with every observation): the two existing
-- roles were RENAMED in place, not dropped and recreated. That is why passwords
-- were NOT rotated -- league_writer authenticates with the former league_user
-- password and league_reader with the former league_readonly password (set out
-- of band on 2026-05-18, see 2026-05-18-league-readonly-role.sql). A rename
-- carries every grant, ownership, membership, and role-level SET, so no re-grant
-- is needed: league_reader keeps default_transaction_read_only=on and its
-- SELECT-only footprint over all public tables/sequences, league_writer keeps
-- search_path=public and object ownership. (Passwords survive the rename because
-- they are stored as scram-sha-256, which -- unlike md5 -- is not salted with
-- the role name.)
--
-- pg_hba.conf on host league was edited in the same change so only
--   host all league_writer 0.0.0.0/0 md5
-- (plus the loopback/peer rules) remains; there is no league_user line and the
-- role no longer exists in pg_roles.
--
-- Apply with: yarn db:exec db/adhoc/2026-07-01-rename-db-roles.sql

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_user')
     AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_writer') THEN
    ALTER ROLE league_user RENAME TO league_writer;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_readonly')
     AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_reader') THEN
    ALTER ROLE league_readonly RENAME TO league_reader;
  END IF;
END
$$;

-- Post-conditions (verified live 2026-07-01):
--   league_writer : LOGIN, search_path=public, owner of the public objects
--   league_reader : LOGIN, default_transaction_read_only=on, SELECT on all
--                   public tables and sequences (explicit ALL-grant plus the
--                   ALTER DEFAULT PRIVILEGES FOR ROLE league_writer in
--                   db/schema.postgres.sql covering objects created later)
--   league_user / league_readonly : no longer exist
