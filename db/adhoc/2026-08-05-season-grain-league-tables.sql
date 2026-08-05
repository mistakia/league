-- STATUS: APPLIED 2026-08-05 against league_production
--
-- Conform the season_grain class to season_year across the 27 league
-- application tables. Retires the largest remaining conformance class that has
-- no owning task: whole-schema violations go 93 -> 66 at ruler 74b1366cd, and
-- season_grain goes 28 -> 1.
--
-- The surviving member is footballoutsiders, which is CARVED OUT by operator
-- ruling of 2026-07-22 and must not be renamed here. It carries 24 of the 93
-- whole-schema violations and is retired by DROP under the DVOA consolidation
-- task, so spending this window on it would be wasted work.
--
-- No BEGIN/COMMIT: db-exec.sh already runs this file under --single-transaction
-- with ON_ERROR_STOP=1. A COMMIT here would end the outer transaction early and
-- every statement after it would lose its rollback. Three reviewed, committed
-- files in this directory shipped that defect; they are not the pattern.
--
-- All 27 are unpartitioned ordinary relations, so each rename is a catalog-only
-- ACCESS EXCLUSIVE lock with no table rewrite. No non-blocking index build is
-- needed anywhere in this file, and the whole thing must stay atomic.
--
-- Constraints are deliberately untouched. Postgres rewrites a constraint's
-- internal column reference automatically on RENAME COLUMN, and no constraint
-- on these 27 tables embeds `year` in its NAME -- all 255 such constraint names
-- in the schema belong to other tables (nfl_plays and player_gamelogs
-- partitions, dvoa, pff, and the player_* gamelog family). Verified against
-- db/schema.postgres.sql on 2026-08-05.

ALTER TABLE public.seasons RENAME COLUMN year TO season_year;
ALTER TABLE public.league_divisions RENAME COLUMN year TO season_year;
ALTER TABLE public.teams RENAME COLUMN year TO season_year;
ALTER TABLE public.users_teams RENAME COLUMN year TO season_year;
ALTER TABLE public.rosters RENAME COLUMN year TO season_year;
ALTER TABLE public.rosters_players RENAME COLUMN year TO season_year;
ALTER TABLE public.transactions RENAME COLUMN year TO season_year;
ALTER TABLE public.trades RENAME COLUMN year TO season_year;
ALTER TABLE public.draft RENAME COLUMN year TO season_year;
ALTER TABLE public.restricted_free_agency_bids RENAME COLUMN year TO season_year;
ALTER TABLE public.matchups RENAME COLUMN year TO season_year;
ALTER TABLE public.playoffs RENAME COLUMN year TO season_year;
ALTER TABLE public.league_team_forecast RENAME COLUMN year TO season_year;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN year TO season_year;
ALTER TABLE public.league_team_player_seasonlogs RENAME COLUMN year TO season_year;
ALTER TABLE public.league_player_seasonlogs RENAME COLUMN year TO season_year;
ALTER TABLE public.league_team_lineups RENAME COLUMN year TO season_year;
ALTER TABLE public.league_team_lineup_starters RENAME COLUMN year TO season_year;
ALTER TABLE public.league_team_lineup_contributions RENAME COLUMN year TO season_year;
ALTER TABLE public.league_team_lineup_contribution_weeks RENAME COLUMN year TO season_year;
ALTER TABLE public.league_baselines RENAME COLUMN year TO season_year;
ALTER TABLE public.league_format_player_projection_values RENAME COLUMN year TO season_year;
ALTER TABLE public.league_format_player_projection_values_history RENAME COLUMN year TO season_year;
ALTER TABLE public.league_format_player_seasonlogs RENAME COLUMN year TO season_year;
ALTER TABLE public.league_player_projection_values RENAME COLUMN year TO season_year;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN year TO season_year;
ALTER TABLE public.scoring_format_player_seasonlogs RENAME COLUMN year TO season_year;

-- The 11 indexes whose NAME embeds `year`. The 16 whose DEFINITION references
-- the column but whose name does not are deliberately left alone -- Postgres
-- follows the column rename on its own, and renaming them would be noise.

ALTER INDEX public.idx_25075_team_year RENAME TO idx_25075_team_season_year;
ALTER INDEX public.idx_25141_userid_tid_year RENAME TO idx_25141_userid_tid_season_year;
ALTER INDEX public.idx_rosters_tid_week_year RENAME TO idx_rosters_tid_week_season_year;
ALTER INDEX public.idx_rosters_players_year_week_lid_pid RENAME TO idx_rosters_players_season_year_week_lid_pid;
ALTER INDEX public.idx_rfa_bids_lid_year_active RENAME TO idx_rfa_bids_lid_season_year_active;
ALTER INDEX public.league_team_player_seasonlogs_lid_pid_year_idx RENAME TO league_team_player_seasonlogs_lid_pid_season_year_idx;
ALTER INDEX public.league_team_player_seasonlogs_lid_tid_year_idx RENAME TO league_team_player_seasonlogs_lid_tid_season_year_idx;
ALTER INDEX public.idx_league_format_player_seasonlogs_pid_year_id RENAME TO idx_league_format_player_seasonlogs_pid_season_year_id;
ALTER INDEX public.idx_scoring_format_player_seasonlogs_pid_year_id RENAME TO idx_scoring_format_player_seasonlogs_pid_season_year_id;

-- These last two DROP the redundant `idx_` prefix rather than keeping it.
-- Substituting season_year for year makes the prefixed forms 66 and 67
-- characters, and Postgres truncates an identifier over 63 bytes with only a
-- NOTICE -- so the prefixed spelling would appear to succeed while producing a
-- name that does not match what this file says, which reads as schema drift on
-- the next export. The unprefixed names are 62 and 63 characters.

ALTER INDEX public.idx_league_format_player_projection_values_pid_id_week_year RENAME TO league_format_player_projection_values_pid_id_week_season_year;
ALTER INDEX public.idx_scoring_format_player_projection_points_pid_id_week_year RENAME TO scoring_format_player_projection_points_pid_id_week_season_year;
