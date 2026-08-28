-- STATUS: APPLIED 2026-08-28 against league_production
-- Grant SELECT on season_projections_index to league_data_view_reader.
--
-- A correction to 2026-08-28-season-projections-index.sql, written as a new file
-- because db/adhoc is append-only and an applied file is never edited.
--
-- What was missed and why. league_data_view_reader is the login role the
-- sandboxed-SQL data-view tier connects as, and its GRANT list is explicit and
-- enumerated in 2026-08-28-create-data-view-reader-role.sql rather than granted
-- by a schema-wide default. season_projections_index was created AFTER that file
-- ran, so it inherited league_reader (which does come from a default) and not
-- league_data_view_reader. Every peer projection table carries both:
--
--   projections_index             -> league_reader, league_data_view_reader
--   rest_of_season_projections    -> league_reader, league_data_view_reader
--   season_projections_history    -> league_reader, league_data_view_reader
--   season_projections_index      -> league_reader ONLY, before this file
--
-- Why it matters, and when it would have bitten. Nothing reads this table yet, so
-- production is unaffected today. The Phase B cutover routes the data-view season
-- prefix at it; without this grant that arm raises a permission error at query
-- time for every season-projected column. The failure would have appeared in the
-- cutover deploy rather than in the migration that caused it.
--
-- No gate covers this. There is no check anywhere in db/gates that reconciles the
-- data-view reader's GRANT list against the tables the column definitions
-- reference, so a new data-view-readable table can only be caught by hand or by
-- the runtime error. Recorded as a gap on the task rather than fixed here.

SET lock_timeout = '30s';

GRANT SELECT ON public.season_projections_index TO league_data_view_reader;

DO $$
DECLARE
  v_has_grant boolean;
BEGIN
  SELECT has_table_privilege('league_data_view_reader', 'public.season_projections_index', 'SELECT')
    INTO v_has_grant;
  IF NOT v_has_grant THEN
    RAISE EXCEPTION 'ABORT: league_data_view_reader still cannot SELECT season_projections_index.';
  END IF;
  RAISE NOTICE 'league_data_view_reader can SELECT season_projections_index.';
END $$;
