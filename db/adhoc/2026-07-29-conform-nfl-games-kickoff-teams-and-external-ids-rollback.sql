-- STATUS: PENDING
--
-- Rollback for db/adhoc/2026-07-29-conform-nfl-games-kickoff-teams-and-external-ids.sql
--
-- Reverses the nfl_games / nfl_game_coaches conform. Renames are exactly
-- invertible. The kickoff_at retype is invertible WITHOUT data loss for every
-- row in production: the source values were whole-second epochs, so
-- EXTRACT(epoch FROM kickoff_at)::integer reproduces them exactly.
--
-- The one asymmetry worth stating plainly: timestamptz carries sub-second
-- precision that integer epoch cannot. Nothing writes a fractional second to
-- this column today (it is fed from epoch integers), but if this rollback runs
-- AFTER new writes have landed through a code path that supplies sub-second or
-- out-of-int-range values, those rows lose precision or overflow. Check before
-- running late:
--
--   SELECT count(*) FROM nfl_games
--    WHERE kickoff_at IS NOT NULL
--      AND (date_part('microseconds', kickoff_at)::int % 1000000) <> 0;
--   -- expect 0
--
--   SELECT count(*) FROM nfl_games
--    WHERE kickoff_at IS NOT NULL
--      AND EXTRACT(epoch FROM kickoff_at) NOT BETWEEN -2147483648 AND 2147483647;
--   -- expect 0
--
-- Null rows stay null in both directions.

BEGIN;

ALTER TABLE public.nfl_game_coaches RENAME COLUMN nfl_team TO team;

ALTER TABLE public.nfl_games RENAME COLUMN ngs_site_id TO site_ngsid;
ALTER TABLE public.nfl_games RENAME COLUMN away_ngs_team_id TO away_ngsid;
ALTER TABLE public.nfl_games RENAME COLUMN home_ngs_team_id TO home_ngsid;

ALTER TABLE public.nfl_games RENAME COLUMN detail_v3_game_id TO detailid_v3;
ALTER TABLE public.nfl_games RENAME COLUMN detail_v1_game_id TO detailid_v1;
ALTER TABLE public.nfl_games RENAME COLUMN pfr_game_id TO pfrid;
ALTER TABLE public.nfl_games RENAME COLUMN shield_game_id TO shieldid;
ALTER TABLE public.nfl_games RENAME COLUMN ngs_game_id TO ngsid;
ALTER TABLE public.nfl_games RENAME COLUMN espn_game_id TO espnid;
ALTER TABLE public.nfl_games RENAME COLUMN gsis_game_id TO gsisid;

ALTER TABLE public.nfl_games RENAME COLUMN home_nfl_team TO h;
ALTER TABLE public.nfl_games RENAME COLUMN away_nfl_team TO v;

ALTER TABLE public.nfl_games
  ALTER COLUMN kickoff_at TYPE integer USING EXTRACT(epoch FROM kickoff_at)::integer;
ALTER TABLE public.nfl_games RENAME COLUMN kickoff_at TO "timestamp";

COMMIT;
