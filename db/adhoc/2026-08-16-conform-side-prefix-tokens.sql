-- STATUS: APPLIED 2026-08-17 against league_production
-- Conform the side-of-the-ball prefixes off / def / st to full words.
--
-- 141 columns across 9 tables. One concept -- which side of the ball a stat
-- belongs to -- so the three conform together or the schema carries two
-- spellings of it. Targets: off -> offense, def -> defense, st -> special_teams.
--
-- FOUR COLUMNS DELIBERATELY UNTOUCHED, and they are why this file is not a
-- mechanical token replace. `off` there is the ordinary English word, not the
-- side of the ball, inside a published two-word term:
--
--   nfl_plays_player.player_get_off                    NGS get-off
--   player_defender_gamelogs.pass_rush_get_off         NGS get-off (prGo)
--   player_prospect_profile.positional_factor_off_man_coverage    SIS "Off-Man"
--
-- and nfl_team_gamelogs.def_avg_get_off takes its `def` rename ONLY, landing as
-- defense_avg_get_off with the get_off intact. Renaming these writes
-- player_get_offense, which mis-documents the column rather than conforming it.
-- Carved out in db/tools/audit-schema-conformance.mjs (5097e3534).
--
-- Interim spellings are expected and correct: a column carrying a token from a
-- later batch lands its final name over two applies, always full-word for the
-- token that landed. q1_snaps_off -> q1_snaps_offense (q1 is the quarter batch),
-- off_personnel_rb_count -> offense_personnel_rb_count (rb is the format batch),
-- off_avg_time_to_throw -> offense_avg_time_to_throw (avg is the counting batch).
--
-- nfl_plays is ~80M rows across 27 partitions. A column rename is catalog-only
-- so it does not rewrite the table, but the server statement_timeout is 40s and
-- a queued ACCESS EXCLUSIVE lock blocks every new reader behind it -- so bound
-- the wait to ACQUIRE and leave execution unbounded. RENAME COLUMN on a
-- partitioned parent propagates to every child; verified post-apply against
-- pg_attribute rather than assumed.
--
-- No BEGIN/COMMIT: db-exec.sh runs the file as one transaction.

SET lock_timeout = '30s';
SET statement_timeout = 0;

-- historical_injury_index (3)
ALTER TABLE public.historical_injury_index RENAME COLUMN snaps_def TO snaps_defense;
ALTER TABLE public.historical_injury_index RENAME COLUMN snaps_off TO snaps_offense;
ALTER TABLE public.historical_injury_index RENAME COLUMN snaps_st TO snaps_special_teams;

-- nfl_game_coaches (2)
ALTER TABLE public.nfl_game_coaches RENAME COLUMN def_play_caller_id TO defense_play_caller_id;
ALTER TABLE public.nfl_game_coaches RENAME COLUMN off_play_caller_id TO offense_play_caller_id;

-- nfl_plays (17)
ALTER TABLE public.nfl_plays RENAME COLUMN def_personnel TO defense_personnel;
ALTER TABLE public.nfl_plays RENAME COLUMN def_personnel_db_count TO defense_personnel_db_count;
ALTER TABLE public.nfl_plays RENAME COLUMN def_personnel_dl_count TO defense_personnel_dl_count;
ALTER TABLE public.nfl_plays RENAME COLUMN def_personnel_lb_count TO defense_personnel_lb_count;
ALTER TABLE public.nfl_plays RENAME COLUMN def_score TO defense_score;
ALTER TABLE public.nfl_plays RENAME COLUMN def_score_post TO defense_score_post;
ALTER TABLE public.nfl_plays RENAME COLUMN def_timeouts_remaining TO defense_timeouts_remaining;
ALTER TABLE public.nfl_plays RENAME COLUMN off_formation TO offense_formation;
ALTER TABLE public.nfl_plays RENAME COLUMN off_personnel TO offense_personnel;
ALTER TABLE public.nfl_plays RENAME COLUMN off_personnel_ol_count TO offense_personnel_ol_count;
ALTER TABLE public.nfl_plays RENAME COLUMN off_personnel_qb_count TO offense_personnel_qb_count;
ALTER TABLE public.nfl_plays RENAME COLUMN off_personnel_rb_count TO offense_personnel_rb_count;
ALTER TABLE public.nfl_plays RENAME COLUMN off_personnel_rb_count_per_play TO offense_personnel_rb_count_per_play;
ALTER TABLE public.nfl_plays RENAME COLUMN off_personnel_te_count TO offense_personnel_te_count;
ALTER TABLE public.nfl_plays RENAME COLUMN off_personnel_te_count_per_play TO offense_personnel_te_count_per_play;
ALTER TABLE public.nfl_plays RENAME COLUMN off_personnel_wr_count TO offense_personnel_wr_count;
ALTER TABLE public.nfl_plays RENAME COLUMN off_personnel_wr_count_per_play TO offense_personnel_wr_count_per_play;

-- nfl_plays_current_week (17)
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN def_personnel TO defense_personnel;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN def_personnel_db_count TO defense_personnel_db_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN def_personnel_dl_count TO defense_personnel_dl_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN def_personnel_lb_count TO defense_personnel_lb_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN def_score TO defense_score;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN def_score_post TO defense_score_post;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN def_timeouts_remaining TO defense_timeouts_remaining;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN off_formation TO offense_formation;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN off_personnel TO offense_personnel;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN off_personnel_ol_count TO offense_personnel_ol_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN off_personnel_qb_count TO offense_personnel_qb_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN off_personnel_rb_count TO offense_personnel_rb_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN off_personnel_rb_count_per_play TO offense_personnel_rb_count_per_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN off_personnel_te_count TO offense_personnel_te_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN off_personnel_te_count_per_play TO offense_personnel_te_count_per_play;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN off_personnel_wr_count TO offense_personnel_wr_count;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN off_personnel_wr_count_per_play TO offense_personnel_wr_count_per_play;

-- nfl_plays_player (1)
ALTER TABLE public.nfl_plays_player RENAME COLUMN is_st_play TO is_special_teams_play;

-- nfl_team_gamelogs (75)
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_avg_get_off TO defense_avg_get_off;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_avg_target_separation TO defense_avg_target_separation;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_avg_time_to_pressure TO defense_avg_time_to_pressure;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_avg_time_to_throw TO defense_avg_time_to_throw;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_blitz_rate TO defense_blitz_rate;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_pass_epa TO defense_pass_epa;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_pass_epa_per_play TO defense_pass_epa_per_play;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_pass_percentage TO defense_pass_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_pass_plays TO defense_pass_plays;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_pass_touchdowns TO defense_pass_touchdowns;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_pass_yards TO defense_pass_yards;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_pass_yards_per_play TO defense_pass_yards_per_play;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_pressure_rate TO defense_pressure_rate;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_pressures TO defense_pressures;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_run_percentage TO defense_run_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_run_plays TO defense_run_plays;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_attempts_inside_tackles_percentage TO defense_rush_attempts_inside_tackles_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_attempts_light_box_percentage TO defense_rush_attempts_light_box_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_attempts_outside_tackles_percentage TO defense_rush_attempts_outside_tackles_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_attempts_stacked_box_percentage TO defense_rush_attempts_stacked_box_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_epa TO defense_rush_epa;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_epa_per_play TO defense_rush_epa_per_play;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_stuffed_percentage TO defense_rush_stuffed_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_touchdowns TO defense_rush_touchdowns;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_yards TO defense_rush_yards;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_yards_10_plus TO defense_rush_yards_10_plus;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_yards_after_contact_per_attempt TO defense_rush_yards_after_contact_per_attempt;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_yards_before_contact_per_attempt TO defense_rush_yards_before_contact_per_attempt;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_yards_over_expected TO defense_rush_yards_over_expected;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_yards_over_expected_per_attempt TO defense_rush_yards_over_expected_per_attempt;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_yards_per_play TO defense_rush_yards_per_play;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_sack_percentage TO defense_sack_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_sack_yards TO defense_sack_yards;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_sacks TO defense_sacks;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_tight_window_percentage TO defense_tight_window_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_yards_after_catch TO defense_yards_after_catch;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_yards_after_catch_over_expected TO defense_yards_after_catch_over_expected;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_avg_target_separation TO offense_avg_target_separation;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_avg_time_to_pressure TO offense_avg_time_to_pressure;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_avg_time_to_throw TO offense_avg_time_to_throw;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_blitz_rate TO offense_blitz_rate;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pass_attempts TO offense_pass_attempts;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pass_epa TO offense_pass_epa;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pass_epa_per_play TO offense_pass_epa_per_play;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pass_percentage TO offense_pass_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pass_plays TO offense_pass_plays;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pass_touchdowns TO offense_pass_touchdowns;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pass_yards TO offense_pass_yards;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pass_yards_per_play TO offense_pass_yards_per_play;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_play_action_percentage TO offense_play_action_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pressure_rate TO offense_pressure_rate;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pressures TO offense_pressures;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_run_percentage TO offense_run_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_run_plays TO offense_run_plays;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_attempts_inside_tackles_percentage TO offense_rush_attempts_inside_tackles_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_attempts_light_box_percentage TO offense_rush_attempts_light_box_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_attempts_outside_tackles_percentage TO offense_rush_attempts_outside_tackles_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_attempts_stacked_box_percentage TO offense_rush_attempts_stacked_box_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_attempts_stuffed_percentage TO offense_rush_attempts_stuffed_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_epa TO offense_rush_epa;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_epa_per_play TO offense_rush_epa_per_play;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_success_percentage TO offense_rush_success_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_touchdowns TO offense_rush_touchdowns;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_yards TO offense_rush_yards;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_yards_10_plus TO offense_rush_yards_10_plus;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_yards_after_contact_per_attempt TO offense_rush_yards_after_contact_per_attempt;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_yards_before_contact_per_attempt TO offense_rush_yards_before_contact_per_attempt;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_yards_over_expected TO offense_rush_yards_over_expected;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_yards_over_expected_per_attempt TO offense_rush_yards_over_expected_per_attempt;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_yards_per_play TO offense_rush_yards_per_play;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_sack_rate TO offense_sack_rate;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_sack_yards TO offense_sack_yards;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_sacks TO offense_sacks;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_yards_after_catch TO offense_yards_after_catch;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_yards_after_catch_over_expected TO offense_yards_after_catch_over_expected;

-- player_college_careerlogs (2)
ALTER TABLE public.player_college_careerlogs RENAME COLUMN run_def_points TO run_defense_points;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN run_def_points_rating TO run_defense_points_rating;

-- player_college_seasonlogs (2)
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN run_def_points TO run_defense_points;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN run_def_points_rating TO run_defense_points_rating;

-- player_gamelogs (22)
ALTER TABLE public.player_gamelogs RENAME COLUMN q1_snaps_def TO q1_snaps_defense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q1_snaps_def_percentage TO q1_snaps_defense_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q1_snaps_off TO q1_snaps_offense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q1_snaps_off_percentage TO q1_snaps_offense_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q2_snaps_def TO q2_snaps_defense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q2_snaps_def_percentage TO q2_snaps_defense_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q2_snaps_off TO q2_snaps_offense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q2_snaps_off_percentage TO q2_snaps_offense_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q3_snaps_def TO q3_snaps_defense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q3_snaps_def_percentage TO q3_snaps_defense_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q3_snaps_off TO q3_snaps_offense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q3_snaps_off_percentage TO q3_snaps_offense_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q4_snaps_def TO q4_snaps_defense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q4_snaps_def_percentage TO q4_snaps_defense_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q4_snaps_off TO q4_snaps_offense;
ALTER TABLE public.player_gamelogs RENAME COLUMN q4_snaps_off_percentage TO q4_snaps_offense_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_def TO snaps_defense;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_def_percentage TO snaps_defense_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_off TO snaps_offense;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_off_percentage TO snaps_offense_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_st TO snaps_special_teams;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_st_percentage TO snaps_special_teams_percentage;
