-- STATUS: APPLIED 2026-08-17 against league_production
-- Conform the position codes qb / rb / wr / te / ol / dl / lb / db / dst / k to
-- full words.
--
-- 65 columns across 12 tables, in three groups the plan deliberately applies
-- together because they share one consumer sweep:
--
--   LEAGUE FORMAT AND SETTINGS (25) -- seasons, league_formats,
--   league_team_seasonlogs, adp_format. Highest user-visible risk in the whole
--   campaign: starter_slots_qb is read in 7 SPA files and
--   franchise_tag_salary_qb in 4, so the window between this apply and the
--   FRONTEND deploy is a live outage for logged-in users (the leagues.hosted
--   precedent). The frontend deploy is part of this apply, not a follow-up.
--
--   PLAYS-FAMILY POSITION COLUMNS (35) -- the personnel-count family plus
--   db_blitzers, qb_epa, qb_position, qb_position_tracking, qb_scramble_side,
--   separation_to_qb, time_to_qb_hurry, is_lined_up_as_qb and
--   avg_pass_rusher_distance_to_qb. They share the personnel vocabulary with the
--   off/def conform, so one sweep of the plays surface covers both.
--
--   THE db SENSE SPLIT (2) -- pass_epa_per_db on nfl_team_seasonlogs and
--   player_passing_gamelogs is NGS gamelog.epaDb, rendered EPA/DB. It is per
--   DROPBACK, not defensive back, so it lands as pass_epa_per_dropback while
--   def_personnel_db_count and db_blitzers take defensive_back. A uniform token
--   rename silently mis-documents a column three SPA files read.
--
-- RATIFIED AND UNTOUCHED, deliberately: the 24 is_qb_* charting booleans (a
-- SHAPE carve-out -- "QB hit" and "QB pressure" are the published charting stat
-- names) and the role-pid columns nfl_plays.qb_pid, nfl_games.away_qb_pid and
-- home_qb_pid. Neither appears below; both are asserted absent post-apply.
--
-- THE TRIGGER IS WHY THIS FILE IS NOT JUST RENAMES. A PL/pgSQL body is stored as
-- TEXT, so ALTER TABLE ... RENAME COLUMN does not rewrite it and no grep of the
-- repo can find it -- it keeps compiling and throws at call time.
-- cmv_classify_league_format reads NEW.starter_slots_qb and is attached to
-- league_formats as trg_cmv_classify_league_format, so without the replacement
-- below every league_formats write fails after this rename, find_or_create_format
-- and the external-league import included. Checked against production: it is the
-- only one of the 12 plpgsql bodies naming a column this file moves.
--
-- The league_formats full-tuple UNIQUE index needs no rebuild: Postgres rewrites
-- the parsed trees behind indexes and constraints on a column rename. Asserted
-- post-apply rather than assumed.
--
-- No BEGIN/COMMIT: db-exec.sh runs the file as one transaction.

SET lock_timeout = '30s';
SET statement_timeout = 0;

-- adp_format (1)
ALTER TABLE public.adp_format RENAME COLUMN num_qb TO num_quarterback;

-- format_category_signal_mapping (1)
ALTER TABLE public.format_category_signal_mapping RENAME COLUMN ktc_qb_axis TO ktc_quarterback_axis;

-- league_formats (8)
ALTER TABLE public.league_formats RENAME COLUMN starter_slots_dst TO starter_slots_defense_special_teams;
ALTER TABLE public.league_formats RENAME COLUMN starter_slots_k TO starter_slots_kicker;
ALTER TABLE public.league_formats RENAME COLUMN starter_slots_qb TO starter_slots_quarterback;
ALTER TABLE public.league_formats RENAME COLUMN starter_slots_rb TO starter_slots_running_back;
ALTER TABLE public.league_formats RENAME COLUMN starter_slots_rb_wr_flex TO starter_slots_running_back_wide_receiver_flex;
ALTER TABLE public.league_formats RENAME COLUMN starter_slots_te TO starter_slots_tight_end;
ALTER TABLE public.league_formats RENAME COLUMN starter_slots_wr TO starter_slots_wide_receiver;
ALTER TABLE public.league_formats RENAME COLUMN starter_slots_wr_te_flex TO starter_slots_wide_receiver_tight_end_flex;

-- league_team_seasonlogs (6)
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN starter_points_dst TO starter_points_defense_special_teams;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN starter_points_k TO starter_points_kicker;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN starter_points_qb TO starter_points_quarterback;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN starter_points_rb TO starter_points_running_back;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN starter_points_te TO starter_points_tight_end;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN starter_points_wr TO starter_points_wide_receiver;

-- nfl_plays (17)
ALTER TABLE public.nfl_plays RENAME COLUMN avg_pass_rusher_distance_to_qb TO avg_pass_rusher_distance_to_quarterback;
ALTER TABLE public.nfl_plays RENAME COLUMN db_blitzers TO defensive_back_blitzers;
ALTER TABLE public.nfl_plays RENAME COLUMN defense_personnel_db_count TO defense_personnel_defensive_back_count;
ALTER TABLE public.nfl_plays RENAME COLUMN defense_personnel_dl_count TO defense_personnel_defensive_line_count;
ALTER TABLE public.nfl_plays RENAME COLUMN defense_personnel_lb_count TO defense_personnel_linebacker_count;
ALTER TABLE public.nfl_plays RENAME COLUMN offense_personnel_ol_count TO offense_personnel_offensive_line_count;
ALTER TABLE public.nfl_plays RENAME COLUMN offense_personnel_qb_count TO offense_personnel_quarterback_count;
ALTER TABLE public.nfl_plays RENAME COLUMN offense_personnel_rb_count TO offense_personnel_running_back_count;
ALTER TABLE public.nfl_plays RENAME COLUMN offense_personnel_rb_count_per_play TO offense_personnel_running_back_count_per_play;
ALTER TABLE public.nfl_plays RENAME COLUMN offense_personnel_te_count TO offense_personnel_tight_end_count;
ALTER TABLE public.nfl_plays RENAME COLUMN offense_personnel_te_count_per_play TO offense_personnel_tight_end_count_per_play;
ALTER TABLE public.nfl_plays RENAME COLUMN offense_personnel_wr_count TO offense_personnel_wide_receiver_count;
ALTER TABLE public.nfl_plays RENAME COLUMN offense_personnel_wr_count_per_play TO offense_personnel_wide_receiver_count_per_play;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_epa TO quarterback_epa;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_position TO quarterback_position;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_position_tracking TO quarterback_position_tracking;
ALTER TABLE public.nfl_plays RENAME COLUMN qb_scramble_side TO quarterback_scramble_side;

-- nfl_plays_current_week (15)
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN db_blitzers TO defensive_back_blitzers;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN defense_personnel_db_count TO defense_personnel_defensive_back_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN defense_personnel_dl_count TO defense_personnel_defensive_line_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN defense_personnel_lb_count TO defense_personnel_linebacker_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN offense_personnel_ol_count TO offense_personnel_offensive_line_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN offense_personnel_qb_count TO offense_personnel_quarterback_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN offense_personnel_rb_count TO offense_personnel_running_back_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN offense_personnel_rb_count_per_play TO offense_personnel_running_back_count_per_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN offense_personnel_te_count TO offense_personnel_tight_end_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN offense_personnel_te_count_per_play TO offense_personnel_tight_end_count_per_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN offense_personnel_wr_count TO offense_personnel_wide_receiver_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN offense_personnel_wr_count_per_play TO offense_personnel_wide_receiver_count_per_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_epa TO quarterback_epa;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_position TO quarterback_position;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN qb_scramble_side TO quarterback_scramble_side;

-- nfl_plays_player (3)
ALTER TABLE public.nfl_plays_player RENAME COLUMN is_lined_up_as_qb TO is_lined_up_as_quarterback;
ALTER TABLE public.nfl_plays_player RENAME COLUMN separation_to_qb TO separation_to_quarterback;
ALTER TABLE public.nfl_plays_player RENAME COLUMN time_to_qb_hurry TO time_to_quarterback_hurry;

-- nfl_team_seasonlogs (1)
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN pass_epa_per_db TO pass_epa_per_dropback;

-- player_college_careerlogs (1)
ALTER TABLE public.player_college_careerlogs RENAME COLUMN qb_rating TO quarterback_rating;

-- player_college_seasonlogs (1)
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN qb_rating TO quarterback_rating;

-- player_passing_gamelogs (1)
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN pass_epa_per_db TO pass_epa_per_dropback;

-- seasons (10)
ALTER TABLE public.seasons RENAME COLUMN franchise_tag_salary_qb TO franchise_tag_salary_quarterback;
ALTER TABLE public.seasons RENAME COLUMN franchise_tag_salary_rb TO franchise_tag_salary_running_back;
ALTER TABLE public.seasons RENAME COLUMN franchise_tag_salary_te TO franchise_tag_salary_tight_end;
ALTER TABLE public.seasons RENAME COLUMN franchise_tag_salary_wr TO franchise_tag_salary_wide_receiver;
ALTER TABLE public.seasons RENAME COLUMN max_roster_dst TO max_roster_defense_special_teams;
ALTER TABLE public.seasons RENAME COLUMN max_roster_k TO max_roster_kicker;
ALTER TABLE public.seasons RENAME COLUMN max_roster_qb TO max_roster_quarterback;
ALTER TABLE public.seasons RENAME COLUMN max_roster_rb TO max_roster_running_back;
ALTER TABLE public.seasons RENAME COLUMN max_roster_te TO max_roster_tight_end;
ALTER TABLE public.seasons RENAME COLUMN max_roster_wr TO max_roster_wide_receiver;

-- Follows the league_formats rename above; see the header.
CREATE OR REPLACE FUNCTION public.cmv_classify_league_format()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  rec_val numeric;
BEGIN
  SELECT receptions INTO rec_val FROM league_scoring_formats WHERE id = NEW.scoring_format_id;
  NEW.format_category := cmv_derive_format_category(NEW.starter_slots_quarterback, NEW.sqbrbwrte, rec_val);
  RETURN NEW;
END;
$function$;
