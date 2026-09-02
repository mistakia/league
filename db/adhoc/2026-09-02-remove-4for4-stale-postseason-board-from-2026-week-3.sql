-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Remove the 21 4for4 rows sitting at season_year 2026, week 3, which are not
-- week 3 projections at all.
--
-- WHY. `import-4for4-projections.mjs` derived the week it wrote from
-- `current_season.nfl_seas_week`, which in PRESEASON names the week AFTER the
-- one being played -- it returned 3 on 2026-09-02 while the week fantasy
-- operations target was 1. That alone would be a mislabel. The rows are worse
-- than mislabelled, because 4for4's weekly endpoint is a single fixed url out of
-- `config.4for4_config.weekly_projections_url` and the `week` argument never
-- reaches it (`libs-server/4for4.mjs`): the feed answers with whatever board it
-- currently publishes, and on 2026-09-02 that was still the prior postseason's
-- Super Bowl slot -- `Season: 2026, Week: 22`, 21 rows, empty `Opp`. So the
-- stored rows are a stale playoff board filed under a regular-season week that
-- has not been played.
--
-- Left in place they would feed `process-projections` a 21-row 4for4 slice for
-- week 3 until the real week 3 import overwrites them around 2026-09-22.
--
-- SCOPED BY (source_id, season_year), NOT BY week. Every 4FOR4 row for 2026 is
-- from this one bad run -- verified before writing: 21 rows total for the
-- source in 2026, all at season_type REG week 3, and none at any other week.
-- Naming the season rather than the week means a re-run under the fixed code,
-- which will write week 1, cannot be caught by this file if it is ever replayed.
--
-- WRAPPED IN A DO BLOCK THAT FAILS CLOSED, because both halves of the obvious
-- one-line form are silent when wrong. `sources` has columns (source_id, name,
-- url) and the row reads `4for4`, not `4FOR4`: a subselect on a misremembered
-- column or spelling returns NULL, the DELETE matches nothing, and the run
-- reports success having done nothing. The block raises instead, and asserts the
-- row count it removes so a scope that has drifted since this was written aborts
-- rather than deleting a different set.
--
-- `projections_history` IS DELIBERATELY NOT TOUCHED. It is the append-only
-- record of what a source said and when, and "4for4 served this board on
-- 2026-09-02" remains true however wrong the index row was. Its 21 matching rows
-- stay.
--
-- The cause is fixed in the same change: the importer now takes the fantasy week
-- outside POST, and refuses to write at all when the Season/Week the feed
-- carries is not the slice the run asked for. Correcting only the week getter
-- would have been WORSE than the current state -- it would have relabelled this
-- same stale Super Bowl board as 2026 week 1.

DO $$
DECLARE
  v_source_id integer;
  v_deleted integer;
BEGIN
  SELECT source_id INTO v_source_id FROM sources WHERE name = '4for4';
  IF v_source_id IS NULL THEN
    RAISE EXCEPTION 'no sources row named 4for4; refusing to delete';
  END IF;

  DELETE FROM projections_index
   WHERE season_year = 2026
     AND source_id = v_source_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RAISE NOTICE 'deleted % projections_index rows for 4for4 (source_id %) season_year 2026',
    v_deleted, v_source_id;

  IF v_deleted <> 21 THEN
    RAISE EXCEPTION 'expected to delete 21 rows, deleted % -- scope has drifted, rolling back',
      v_deleted;
  END IF;
END $$;
