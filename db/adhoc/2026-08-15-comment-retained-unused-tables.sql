-- STATUS: APPLIED 2026-08-16 against league_production
--
-- Make the retained-but-unused-schema convention repo-wide (item 9 of
-- user:task/league/repoint-analytics-at-pff-facet-tables.md, approved 2026-08-15):
--
-- 1. Backfill the RETAINED DELIBERATELY marker onto the two dead
--    nfl_draft_rankings_* tables, whose retention was recorded only in the
--    prose of db/adhoc/2026-07-22-conform-misc-timeseries.sql -- invisible to
--    \d and to a table-anchored inventory, which is exactly the surface where
--    a sweeping session would propose dropping them.
-- 2. Correct the nfl_plays_player comment: it claimed "Written by
--    scripts/process-nfl-plays-player.mjs", but that script reads the table
--    (and is itself orphaned); nothing in the repo writes the table today.
--    The retention marker must not carry a false factual claim, so the writer
--    sentence is removed. The other three play-participant comments are
--    unchanged and the receiver comment stays as-is per approved scope.
--
-- Same comment convention as db/adhoc/2026-08-15-comment-play-participant-tables.sql:
-- the schema comment is the canonical home for "retained deliberately" because
-- it lands in db/schema.postgres.sql, which every consumer gate, rename sweep
-- and \d reads. Deliberately carries no row counts or season ranges: those
-- decay, the intent does not.

COMMENT ON TABLE public.nfl_draft_rankings_history IS
    'Point-in-time NFL draft rankings (big-board and positional, per mock draft source), keyed (pid, source_id, season_year). RETAINED DELIBERATELY: dead per operator ruling 2026-07-22, retained as-is -- it has no consumers and that is expected -- do not read the absence of readers as evidence the table is abandoned. See db/adhoc/2026-07-22-conform-misc-timeseries.sql and db/adhoc/2026-08-15-comment-retained-unused-tables.sql.';

COMMENT ON TABLE public.nfl_draft_rankings_index IS
    'Point-in-time NFL draft rankings (big-board and positional, per mock draft source), keyed (pid, source_id, season_year). RETAINED DELIBERATELY: dead per operator ruling 2026-07-22, retained as-is -- it has no consumers and that is expected -- do not read the absence of readers as evidence the table is abandoned. See db/adhoc/2026-07-22-conform-misc-timeseries.sql and db/adhoc/2026-08-15-comment-retained-unused-tables.sql.';

COMMENT ON TABLE public.nfl_plays_player IS
    'Per-player play-by-play participation detail covering every participant rather than a single named role, keyed (esbid, play_id, season_year, gsis_it_player_id). RETAINED DELIBERATELY: this is per-player play-by-play data to be expanded once the data pipeline supports it. It has no analytics consumer today and that is expected -- do not read the absence of readers, or sparse season coverage, as evidence the table is abandoned. See db/adhoc/2026-08-15-comment-play-participant-tables.sql.';
