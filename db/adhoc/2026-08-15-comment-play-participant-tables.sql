-- STATUS: APPLIED 2026-08-15 against league_production
--
-- Record why the four play-participant tables are retained, at the point where
-- the question gets asked.
--
-- These carry per-player play-by-play detail: one row per (play, participant),
-- against nfl_plays' one row per play. Three of the four have NO analytics
-- consumer today -- a table-anchored inventory returns zero readers over a
-- sparse, recent-seasons-only table, which is indistinguishable from an
-- accidental leftover. A 2026-08-15 consumer inventory reached exactly that
-- conclusion and proposed dropping two of them.
--
-- They are retained deliberately: this is the per-player play-by-play surface
-- to be expanded once the data pipeline supports it. The absence of consumers
-- is a statement about the pipeline, not about the tables.
--
-- The comment is the canonical home for that fact rather than a doc, because
-- it lands in db/schema.postgres.sql -- which every consumer gate, rename sweep
-- and \d already reads -- and because the sweeping session is the one that
-- needs it and is exactly the session that would not open a doc. Deliberately
-- carries no row counts or season ranges: those decay, the intent does not.

COMMENT ON TABLE public.nfl_plays_passer IS
    'Per-player play-by-play detail for the passer on a play, keyed (esbid, play_id, season_year, gsis_it_player_id). RETAINED DELIBERATELY: this is per-player play-by-play data to be expanded once the data pipeline supports it. It has no analytics consumer today and that is expected -- do not read the absence of readers, or sparse season coverage, as evidence the table is abandoned. See db/adhoc/2026-08-15-comment-play-participant-tables.sql.';

COMMENT ON TABLE public.nfl_plays_rusher IS
    'Per-player play-by-play detail for the ball carrier on a rush, keyed (esbid, play_id, season_year, gsis_it_player_id). RETAINED DELIBERATELY: this is per-player play-by-play data to be expanded once the data pipeline supports it. It has no analytics consumer today and that is expected -- do not read the absence of readers, or sparse season coverage, as evidence the table is abandoned. See db/adhoc/2026-08-15-comment-play-participant-tables.sql.';

COMMENT ON TABLE public.nfl_plays_receiver IS
    'Per-player play-by-play detail for a targeted or routed receiver, keyed (esbid, play_id, gsis_player_id). RETAINED DELIBERATELY: this is per-player play-by-play data to be expanded once the data pipeline supports it. It is the only participant table with a live analytics consumer -- the player_routes data-view column and its rate-type denominator CTE count route rows here, which is the one route source that can serve sub-game periods (half/quarter/drive/series). Season-grain route totals belong to pff_player_seasonlogs.routes and game-grain to player_receiving_gamelogs.routes; this table is not their substitute and they are not its. See db/adhoc/2026-08-15-comment-play-participant-tables.sql.';

COMMENT ON TABLE public.nfl_plays_player IS
    'Per-player play-by-play participation detail covering every participant rather than a single named role, keyed (esbid, play_id, season_year, gsis_it_player_id). RETAINED DELIBERATELY: this is per-player play-by-play data to be expanded once the data pipeline supports it. It has no analytics consumer today and that is expected -- do not read the absence of readers, or sparse season coverage, as evidence the table is abandoned. Written by scripts/process-nfl-plays-player.mjs. See db/adhoc/2026-08-15-comment-play-participant-tables.sql.';
