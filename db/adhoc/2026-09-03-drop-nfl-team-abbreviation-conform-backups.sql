-- STATUS: APPLIED 2026-09-03 against league_production
--
-- Drop the seven pre-conform backup tables created by
-- db/adhoc/2026-09-02-conform-nfl-team-abbreviations-to-current.sql and its
-- pre-2000 sibling, both applied 2026-09-03.
--
-- They were the rollback mechanism for a conform that is NOT invertible by map
-- or by season, so dropping them makes that conform permanent. Operator
-- approved the cleanup after the result was verified three independent ways:
-- the possession invariant fell from 5,575 to 2 through a join the conform
-- never performs, per-season game counts are unchanged, and whole-corpus
-- non-conforming slots fell from 324,818 to the 4 empty-string rows that were
-- predicted before the apply.
--
-- 727 MB reclaimed, 721 MB of it nfl_play_stats_preconform_20260902, which had
-- to be a full physical copy because that table has no usable row handle.
--
-- NO SCHEMA EXPORT ACCOMPANIES THIS, and that is correct rather than an
-- omission: these tables were created after the last `yarn export:schema` and
-- never entered db/schema.postgres.sql, so dropping them leaves the export
-- exactly as it already is. Verified with a grep for `preconform_20260902`
-- against the export, which returns zero.
--
-- db/tools/generate-nfl-team-conform-sql.mjs does name these tables, and that
-- is not a dependency: it holds the CREATE statements that MADE them, as the
-- generator for two already-applied files, so it describes history rather than
-- reading anything at runtime. Nothing queries them.

SET lock_timeout = '30s';

DROP TABLE IF EXISTS nfl_games_preconform_20260902;
DROP TABLE IF EXISTS nfl_games_preconform_pre2000_20260902;
DROP TABLE IF EXISTS nfl_plays_preconform_20260902;
DROP TABLE IF EXISTS nfl_play_stats_preconform_20260902;
DROP TABLE IF EXISTS player_gamelogs_preconform_20260902;
DROP TABLE IF EXISTS player_preconform_20260902;
DROP TABLE IF EXISTS player_preconform_pre2000_20260902;

-- Post-condition: none survive. An IF EXISTS drop is a success against a table
-- that was never there, so the count is the only thing that distinguishes
-- "dropped seven" from "dropped nothing and said fine".
DO $$
DECLARE remaining int;
BEGIN
  SELECT count(*) INTO remaining FROM pg_tables
   WHERE tablename LIKE '%preconform_20260902%';
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'expected 0 preconform tables to remain, found %', remaining;
  END IF;
  RAISE NOTICE 'all preconform backup tables dropped';
END $$;
