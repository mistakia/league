-- STATUS: APPLIED 2026-07-31 against league_production
--
-- Drop keeptradecut_rankings_pre_valuations, the pre-restructure table retained
-- by db/adhoc/2026-07-31-keeptradecut-valuations-restructure.sql.
--
-- Task: user:task/league/restructure-keeptradecut-rankings-table.md
--
-- WHY THIS IS SAFE TO RUN NOW
--   The restructure renamed rather than dropped, because db-exec.sh runs a file
--   as one non-interactive transaction and exits -- there is no post-commit
--   recovery short of a full-database restore. That retention has served its
--   purpose: the migration was reconciled against this table in BOTH directions
--   on 2026-07-31, after the apply and with the new code deployed.
--
--     - all 5,626,534 source rows reproduce exactly in keeptradecut_valuations,
--       matched on the full key AND on the value landing in the right column
--     - zero target cells lack a source row
--     - 5,626,534 source rows == 5,626,534 non-null target cells
--     - 889 distinct pids and 2,579 distinct days on both sides
--     - keeptradecut_liquidity matches the independent 2026-07-31 08:00 off-VPS
--       backup on all six values across 52,536 rows and 57 days
--
--   The off-VPS backup at
--   base-storage:/storage/backups/database-dumps/league-production/2026-07-31_08-00-full/
--   still holds the pre-migration table, so this drop is not the last copy.
--
-- WHY IT IS ALSO URGENT
--   The retained table turned check-schema-conformance-ratchet.mjs RED on master
--   (exit 1). The ratchet keys violations on table.column, so the rename minted
--   three keys the baseline had never seen -- .d and .qb as shorthand, .v as an
--   ambiguous team column. They are not new debt; they are the SAME columns the
--   baseline already carried under the old table name. Rebaselining would have
--   written entries that this drop makes stale within a day, so the gate was
--   left red and cleared here instead.
--
-- THE SCHEMA RE-EXPORT IS PART OF THIS CHANGE, NOT A FOLLOW-UP.
--   db/schema.postgres.sql currently declares this table. Dropping it without
--   re-exporting leaves the committed schema describing a table production no
--   longer has, which is the red-master side of the export window. Run
--   `yarn export:schema` and commit the regenerated schema in the SAME commit
--   as this file.

-- Cheap by comparison with the restructure -- this takes ACCESS EXCLUSIVE on a
-- table nothing reads -- but the lock is still taken, so fail fast rather than
-- queue behind a stray analytics session that is still holding the old name.
SET lock_timeout = '5s';

-- Guard: refuse to drop if the replacement is not present and populated. A drop
-- that runs against a database where the restructure did NOT apply would destroy
-- the only copy of the data.
DO $$
DECLARE
  target_rows bigint;
BEGIN
  IF to_regclass('public.keeptradecut_valuations') IS NULL THEN
    RAISE EXCEPTION
      'keeptradecut_valuations does not exist -- the restructure has not applied here, refusing to drop the source table';
  END IF;

  SELECT count(*) INTO target_rows FROM keeptradecut_valuations;
  IF target_rows = 0 THEN
    RAISE EXCEPTION
      'keeptradecut_valuations is empty -- refusing to drop the source table';
  END IF;
END $$;

-- Second guard: every remaining source group must still resolve to a target row.
-- This is oracle 2f from the restructure, re-run at drop time rather than trusted
-- from hours earlier, so a drop can never outrun its own verification.
DO $$
DECLARE
  unmatched bigint;
BEGIN
  SELECT count(*) INTO unmatched
    FROM (SELECT pid, d, qb FROM keeptradecut_rankings_pre_valuations
           GROUP BY pid, d, qb) s
    LEFT JOIN keeptradecut_valuations v
      ON v.pid = s.pid
     AND v.is_superflex = (s.qb = 2)
     AND v.observed_at = to_timestamp(s.d)
   WHERE v.pid IS NULL;

  IF unmatched <> 0 THEN
    RAISE EXCEPTION
      '% source groups still have no matching target row -- refusing to drop',
      unmatched;
  END IF;
END $$;

DROP TABLE keeptradecut_rankings_pre_valuations;
