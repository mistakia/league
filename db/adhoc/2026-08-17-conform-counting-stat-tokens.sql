-- STATUS: APPLIED 2026-08-17 against league_production
-- Conform the counting-stat vocabulary to full words:
-- avg comp yds yd cov td tds fg pen rec recs los att.
--
-- 148 columns across 19 tables. Grouped into one apply because these tokens
-- share writers -- the gamelog and seasonlog generators, the plays importers and
-- the college feeds -- so one consumer sweep covers all thirteen.
--
-- comp is sequenced in this batch deliberately. The pct conform left
-- `completion` on the college tables and `comp` everywhere else, so the schema
-- has carried two spellings of one concept since 2026-08-15; this closes it.
--
-- THREE TARGETS THE TOKEN ALONE DOES NOT DETERMINE.
--
--   nfl_plays.cov_type / nfl_plays_current_week.cov_type -> coverage_type_ngs.
--   The mechanical target is TAKEN: nfl_plays already carries a coverage_type of
--   enum type public.coverage_type, written from the PlayerProfiler charting
--   mapping (libs-server/charting-data/field-mapping.mjs, coverageScheme). The
--   column being renamed here is the NGS free-text value
--   (private/libs-server/ngs.mjs, play.defense.coverageType) and was itself named
--   cov_type_ngs before an earlier rename -- libs-shared/data-views-saved-view-migration.mjs
--   still carries that rule. Restoring the source qualifier keeps the three
--   coverage-scheme columns distinguishable and matches the sibling
--   cov_type_charted, which takes the plain expansion.
--
--   roster_asset_holding.weeks_cov -> weeks_covid_reserve. This `cov` is the
--   COVID reserve roster slot (roster_slot_types.COV, spelled COVID IR in
--   libs-shared/format-nfl-injury-status.mjs), not pass coverage. A uniform
--   token rename writes weeks_coverage on a column counting weeks a player spent
--   on the COVID list. `covid` was admitted to the vocabulary in its own commit
--   beforehand, proven inert at 454.
--
--   dvoa_team_seasonlogs_history/_index.fg_xp_dvoa -> field_goal_extra_point_dvoa,
--   per the 2026-08-16 triage ruling. This expands `xp` as well as `fg`, which
--   does not split a family: both `xp` findings in the whole schema are these two
--   columns, so the token closes here rather than waiting for the long tail.
--
-- ONE OF THE THIRTEEN TOKENS WAS INVISIBLE TO THE AUDIT UNTIL THIS BATCH.
-- `tds` sat in the vocabulary's english_words, bootstrapped from the system
-- dictionary, while `td` flagged on 11 columns -- so
-- player_defender_gamelogs.recv_tds_nearest_defender was never reported for it,
-- even though its direct sibling recs_nearest_defender on the same table is in
-- this batch. Renaming one and not the other splits an NGS nearest-defender pair
-- across two spellings on one table, which is the same failure `te` and `k`
-- produced two batches ago. Repaired in its own commit beforehand; the repo-wide
-- total did not move, because that column was already reported for `recv`.
--
-- COUNTS RENDER PLURAL WHERE THE COLUMN COUNTS DISCRETE EVENTS, following the
-- reference batch's own precedent (drive_fds -> drive_first_downs plural,
-- two_conv_prob -> two_conversion_prob singular). So the college tables take
-- pass_touchdowns, receiving_touchdowns, false_start_penalties, holding_penalties
-- and holding_penalties_drawn, matching their existing receptions and
-- total_touchdowns siblings, while td_nfl_team, touchdown_prob and
-- is_turnover_touchdown stay singular because they describe one event.
--
-- INTERIM SPELLINGS, deliberately. Sixteen of these columns carry a second token
-- a later batch or another task owns, so they land their final name over two
-- applies and none of them carries a half-spelling: recv (owner task,
-- recv_yards / recv_average_target_separation / espn_rtm_recv_yards), prob and
-- opp (markets batch, touchdown_prob / field_goal_prob / opp_field_goal_prob /
-- opp_touchdown_prob), and ep (long tail, field_goal_ep_kicker). The audit
-- therefore falls 454 -> 323, a drop of 131 rather than 148, and the added
-- finding keys are exactly those columns under their new spellings.
--
-- NO PL/pgSQL BODY NAMES ANY OF THESE COLUMNS. All 12 plpgsql bodies in
-- league_production were fetched and grepped against the 86 distinct old names;
-- the oracle was proven to discriminate first, by confirming it finds
-- starter_slots_quarterback in cmv_classify_league_format. So this file carries
-- renames only -- unlike the position-code batch, which needed a CREATE OR REPLACE.
--
-- Every source column was confirmed present and every target confirmed free
-- against league_production before this file was written.
--
-- No BEGIN/COMMIT: db-exec.sh runs the file as one transaction. nfl_plays is
-- ~80M rows across 27 partitions, so the server's 40s statement_timeout would
-- cancel an unqualified run -- a scratch rehearsal is structurally blind to that,
-- since it carries the schema and none of the rows.

SET lock_timeout = '30s';
SET statement_timeout = 0;

-- dvoa_team_seasonlogs_history (1)
ALTER TABLE public.dvoa_team_seasonlogs_history RENAME COLUMN fg_xp_dvoa TO field_goal_extra_point_dvoa;

-- dvoa_team_seasonlogs_index (1)
ALTER TABLE public.dvoa_team_seasonlogs_index RENAME COLUMN fg_xp_dvoa TO field_goal_extra_point_dvoa;

-- espn_receiving_metrics_history (1)
ALTER TABLE public.espn_receiving_metrics_history RENAME COLUMN espn_rtm_recv_yds TO espn_rtm_recv_yards;

-- nfl_matchup_stats (1)
ALTER TABLE public.nfl_matchup_stats RENAME COLUMN defense_avg_time_to_pressure TO defense_average_time_to_pressure;

-- nfl_plays (37)
ALTER TABLE public.nfl_plays RENAME COLUMN avg_height TO average_height;
ALTER TABLE public.nfl_plays RENAME COLUMN avg_pass_rusher_distance_to_quarterback TO average_pass_rusher_distance_to_quarterback;
ALTER TABLE public.nfl_plays RENAME COLUMN broken_tackles_rec TO broken_tackles_receiving;
ALTER TABLE public.nfl_plays RENAME COLUMN comp_air_epa TO completion_air_epa;
ALTER TABLE public.nfl_plays RENAME COLUMN comp_air_wpa TO completion_air_wpa;
ALTER TABLE public.nfl_plays RENAME COLUMN comp_yac_epa TO completion_yac_epa;
ALTER TABLE public.nfl_plays RENAME COLUMN comp_yac_wpa TO completion_yac_wpa;
ALTER TABLE public.nfl_plays RENAME COLUMN cov_type TO coverage_type_ngs;
ALTER TABLE public.nfl_plays RENAME COLUMN cov_type_charted TO coverage_type_charted;
ALTER TABLE public.nfl_plays RENAME COLUMN drive_yds TO drive_yards;
ALTER TABLE public.nfl_plays RENAME COLUMN drive_yds_penalized TO drive_yards_penalized;
ALTER TABLE public.nfl_plays RENAME COLUMN fg_prob TO field_goal_prob;
ALTER TABLE public.nfl_plays RENAME COLUMN fg_result TO field_goal_result;
ALTER TABLE public.nfl_plays RENAME COLUMN fg_result_detail TO field_goal_result_detail;
ALTER TABLE public.nfl_plays RENAME COLUMN kickoff_yds TO kickoff_yards;
ALTER TABLE public.nfl_plays RENAME COLUMN opp_fg_prob TO opp_field_goal_prob;
ALTER TABLE public.nfl_plays RENAME COLUMN opp_td_prob TO opp_touchdown_prob;
ALTER TABLE public.nfl_plays RENAME COLUMN pass_yds TO pass_yards;
ALTER TABLE public.nfl_plays RENAME COLUMN pen_team TO penalty_team;
ALTER TABLE public.nfl_plays RENAME COLUMN pen_yds TO penalty_yards;
ALTER TABLE public.nfl_plays RENAME COLUMN punt_yds TO punt_yards;
ALTER TABLE public.nfl_plays RENAME COLUMN recv_yds TO recv_yards;
ALTER TABLE public.nfl_plays RENAME COLUMN return_yds TO return_yards;
ALTER TABLE public.nfl_plays RENAME COLUMN rush_yds TO rush_yards;
ALTER TABLE public.nfl_plays RENAME COLUMN td_nfl_team TO touchdown_nfl_team;
ALTER TABLE public.nfl_plays RENAME COLUMN td_prob TO touchdown_prob;
ALTER TABLE public.nfl_plays RENAME COLUMN total_away_comp_air_epa TO total_away_completion_air_epa;
ALTER TABLE public.nfl_plays RENAME COLUMN total_away_comp_air_wpa TO total_away_completion_air_wpa;
ALTER TABLE public.nfl_plays RENAME COLUMN total_away_comp_yac_epa TO total_away_completion_yac_epa;
ALTER TABLE public.nfl_plays RENAME COLUMN total_away_comp_yac_wpa TO total_away_completion_yac_wpa;
ALTER TABLE public.nfl_plays RENAME COLUMN total_home_comp_air_epa TO total_home_completion_air_epa;
ALTER TABLE public.nfl_plays RENAME COLUMN total_home_comp_air_wpa TO total_home_completion_air_wpa;
ALTER TABLE public.nfl_plays RENAME COLUMN total_home_comp_yac_epa TO total_home_completion_yac_epa;
ALTER TABLE public.nfl_plays RENAME COLUMN total_home_comp_yac_wpa TO total_home_completion_yac_wpa;
ALTER TABLE public.nfl_plays RENAME COLUMN xyac_mean_yds TO xyac_mean_yards;
ALTER TABLE public.nfl_plays RENAME COLUMN xyac_median_yds TO xyac_median_yards;
ALTER TABLE public.nfl_plays RENAME COLUMN yds_gained TO yards_gained;

-- nfl_plays_current_week (31)
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN comp_air_epa TO completion_air_epa;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN comp_air_wpa TO completion_air_wpa;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN comp_yac_epa TO completion_yac_epa;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN comp_yac_wpa TO completion_yac_wpa;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN cov_type TO coverage_type_ngs;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN cov_type_charted TO coverage_type_charted;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN drive_yds TO drive_yards;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN drive_yds_penalized TO drive_yards_penalized;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN fg_prob TO field_goal_prob;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN fg_result TO field_goal_result;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN opp_fg_prob TO opp_field_goal_prob;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN opp_td_prob TO opp_touchdown_prob;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pass_yds TO pass_yards;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pen_team TO penalty_team;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pen_yds TO penalty_yards;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN recv_yds TO recv_yards;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN return_yds TO return_yards;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN rush_yds TO rush_yards;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN td_nfl_team TO touchdown_nfl_team;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN td_prob TO touchdown_prob;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN total_away_comp_air_epa TO total_away_completion_air_epa;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN total_away_comp_air_wpa TO total_away_completion_air_wpa;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN total_away_comp_yac_epa TO total_away_completion_yac_epa;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN total_away_comp_yac_wpa TO total_away_completion_yac_wpa;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN total_home_comp_air_epa TO total_home_completion_air_epa;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN total_home_comp_air_wpa TO total_home_completion_air_wpa;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN total_home_comp_yac_epa TO total_home_completion_yac_epa;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN total_home_comp_yac_wpa TO total_home_completion_yac_wpa;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN xyac_mean_yds TO xyac_mean_yards;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN xyac_median_yds TO xyac_median_yards;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN yds_gained TO yards_gained;

-- nfl_plays_passer (3)
ALTER TABLE public.nfl_plays_passer RENAME COLUMN avg_passing_speed TO average_passing_speed;
ALTER TABLE public.nfl_plays_passer RENAME COLUMN is_turnover_td TO is_turnover_touchdown;
ALTER TABLE public.nfl_plays_passer RENAME COLUMN passing_zone_los_distance TO passing_zone_line_of_scrimmage_distance;

-- nfl_plays_rusher (4)
ALTER TABLE public.nfl_plays_rusher RENAME COLUMN speed_at_los TO speed_at_line_of_scrimmage;
ALTER TABLE public.nfl_plays_rusher RENAME COLUMN time_to_los TO time_to_line_of_scrimmage;
ALTER TABLE public.nfl_plays_rusher RENAME COLUMN x_at_los TO x_at_line_of_scrimmage;
ALTER TABLE public.nfl_plays_rusher RENAME COLUMN y_at_los TO y_at_line_of_scrimmage;

-- nfl_team_gamelogs (7)
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN defense_avg_get_off TO defense_average_get_off;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN defense_avg_target_separation TO defense_average_target_separation;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN defense_avg_time_to_pressure TO defense_average_time_to_pressure;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN defense_avg_time_to_throw TO defense_average_time_to_throw;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN offense_avg_target_separation TO offense_average_target_separation;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN offense_avg_time_to_pressure TO offense_average_time_to_pressure;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN offense_avg_time_to_throw TO offense_average_time_to_throw;

-- nfl_team_seasonlogs (12)
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN air_yards_per_pass_att TO air_yards_per_pass_attempt;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN avg_route_depth TO average_route_depth;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN avg_target_separation TO average_target_separation;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN avg_time_to_pressure TO average_time_to_pressure;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN avg_time_to_sack TO average_time_to_sack;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN avg_time_to_throw TO average_time_to_throw;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN deep_pass_att_percentage TO deep_pass_attempt_percentage;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN endzone_recs TO endzone_receptions;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN expected_pass_comp TO expected_pass_completion;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN pass_comp_percentage TO pass_completion_percentage;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN recv_avg_target_separation TO recv_average_target_separation;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN rush_avg_time_to_line_of_scrimmage TO rush_average_time_to_line_of_scrimmage;

-- pff_player_seasonlogs (1)
ALTER TABLE public.pff_player_seasonlogs RENAME COLUMN fg_ep_kicker TO field_goal_ep_kicker;

-- player_college_careerlogs (16)
ALTER TABLE public.player_college_careerlogs RENAME COLUMN false_start_pen TO false_start_penalties;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN forty_yd_dash TO forty_yard_dash;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN forty_yd_dash_is_pro_day TO forty_yard_dash_is_pro_day;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN forty_yd_dash_is_unofficial TO forty_yard_dash_is_unofficial;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN holding_pen TO holding_penalties;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN holding_pen_drawn TO holding_penalties_drawn;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pass_cov_points TO pass_coverage_points;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pass_cov_points_press TO pass_coverage_points_press;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pass_cov_points_rating TO pass_coverage_points_rating;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pass_cov_points_slot TO pass_coverage_points_slot;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pass_cov_points_wide TO pass_coverage_points_wide;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pass_td TO pass_touchdowns;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN rec_epa TO receiving_epa;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN rec_epa_per_target TO receiving_epa_per_target;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN rec_td TO receiving_touchdowns;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN rec_yards TO receiving_yards;

-- player_college_seasonlogs (16)
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN false_start_pen TO false_start_penalties;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN forty_yd_dash TO forty_yard_dash;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN forty_yd_dash_is_pro_day TO forty_yard_dash_is_pro_day;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN forty_yd_dash_is_unofficial TO forty_yard_dash_is_unofficial;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN holding_pen TO holding_penalties;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN holding_pen_drawn TO holding_penalties_drawn;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pass_cov_points TO pass_coverage_points;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pass_cov_points_press TO pass_coverage_points_press;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pass_cov_points_rating TO pass_coverage_points_rating;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pass_cov_points_slot TO pass_coverage_points_slot;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pass_cov_points_wide TO pass_coverage_points_wide;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pass_td TO pass_touchdowns;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN rec_epa TO receiving_epa;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN rec_epa_per_target TO receiving_epa_per_target;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN rec_td TO receiving_touchdowns;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN rec_yards TO receiving_yards;

-- player_defender_gamelogs (3)
ALTER TABLE public.player_defender_gamelogs RENAME COLUMN avg_target_separation_allowed TO average_target_separation_allowed;
ALTER TABLE public.player_defender_gamelogs RENAME COLUMN recs_nearest_defender TO receptions_nearest_defender;
ALTER TABLE public.player_defender_gamelogs RENAME COLUMN recv_tds_nearest_defender TO recv_touchdowns_nearest_defender;

-- player_passing_gamelogs (8)
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN air_yards_per_pass_att TO air_yards_per_pass_attempt;
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN avg_target_separation TO average_target_separation;
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN avg_time_to_pressure TO average_time_to_pressure;
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN avg_time_to_sack TO average_time_to_sack;
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN avg_time_to_throw TO average_time_to_throw;
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN deep_pass_att_percentage TO deep_pass_attempt_percentage;
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN expected_pass_comp TO expected_pass_completion;
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN pass_comp_percentage TO pass_completion_percentage;

-- player_receiving_gamelogs (3)
ALTER TABLE public.player_receiving_gamelogs RENAME COLUMN avg_route_depth TO average_route_depth;
ALTER TABLE public.player_receiving_gamelogs RENAME COLUMN endzone_recs TO endzone_receptions;
ALTER TABLE public.player_receiving_gamelogs RENAME COLUMN recv_avg_target_separation TO recv_average_target_separation;

-- player_rushing_gamelogs (1)
ALTER TABLE public.player_rushing_gamelogs RENAME COLUMN rush_avg_time_to_line_of_scrimmage TO rush_average_time_to_line_of_scrimmage;

-- player_seasonlogs (1)
ALTER TABLE public.player_seasonlogs RENAME COLUMN espn_rtm_recv_yds TO espn_rtm_recv_yards;

-- roster_asset_holding (1)
ALTER TABLE public.roster_asset_holding RENAME COLUMN weeks_cov TO weeks_covid_reserve;
