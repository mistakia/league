-- STATUS: PENDING
--
-- Rollback for db/adhoc/2026-07-29-conform-nfl-games-teams-and-external-ids.sql
--
-- Pure renames in both directions, so this is exactly invertible with no data
-- transformation and no precision or range concerns. Reverses in the mirror
-- order of the apply.

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

COMMIT;
