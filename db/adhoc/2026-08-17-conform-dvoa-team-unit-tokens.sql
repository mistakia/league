-- STATUS: APPLIED 2026-08-17 against league_production
-- Conform the DVOA team-unit pair's abbreviation tokens to full words.
--
-- 31 renames per table across dvoa_team_unit_seasonlogs_history and _index,
-- which are structurally identical: 62 audit findings, one per (table, column).
-- Operator ruled KEEP on both tables (2026-08-16), which discharged the
-- deferral these columns sat behind.
--
-- Every column here is a published Football Outsiders name, so the SENSE CALLS
-- are the whole risk and they are settled per column rather than per token:
--   ot   -> overtime
--   rb   -> running_back        te -> tight_end        wrN -> wide_receiver_N
--   mid  -> THREE targets by sense:
--             second_and_mid / third_and_mid -> _medium  (distance to go)
--             team_rush_mid_guard            -> middle_guard (interior gap)
--             mid_zone                       -> KEPT, the published blocking
--                                               scheme; carved in the oracle by
--                                               table.column, and deliberately
--                                               ABSENT from this file. A uniform
--                                               `mid` rename corrupts it.
--
-- No BEGIN/COMMIT: db-exec.sh runs the file as one transaction.
-- Both tables are small (1,157 history / 197 index rows at last count), so the
-- statement_timeout override is belt-and-braces rather than load-bearing.
SET lock_timeout = '30s';
SET statement_timeout = 0;

-- dvoa_team_unit_seasonlogs_history
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN fourth_quarter_ot_dvoa TO fourth_quarter_overtime_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN fourth_quarter_ot_dvoa_rank TO fourth_quarter_overtime_dvoa_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_points_allowed_per_game_rb TO pass_points_allowed_per_game_running_back;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_points_allowed_per_game_te TO pass_points_allowed_per_game_tight_end;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_points_allowed_per_game_wr1 TO pass_points_allowed_per_game_wide_receiver_1;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_points_allowed_per_game_wr2 TO pass_points_allowed_per_game_wide_receiver_2;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_points_allowed_per_game_wr3 TO pass_points_allowed_per_game_wide_receiver_3;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_rb_dvoa TO pass_running_back_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_rb_dvoa_rank TO pass_running_back_dvoa_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_te_dvoa TO pass_tight_end_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_te_dvoa_rank TO pass_tight_end_dvoa_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_wr1_dvoa TO pass_wide_receiver_1_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_wr1_dvoa_rank TO pass_wide_receiver_1_dvoa_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_wr2_dvoa TO pass_wide_receiver_2_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_wr2_dvoa_rank TO pass_wide_receiver_2_dvoa_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_wr3_dvoa TO pass_wide_receiver_3_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_wr3_dvoa_rank TO pass_wide_receiver_3_dvoa_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_yards_allowed_per_game_rb TO pass_yards_allowed_per_game_running_back;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_yards_allowed_per_game_te TO pass_yards_allowed_per_game_tight_end;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_yards_allowed_per_game_wr1 TO pass_yards_allowed_per_game_wide_receiver_1;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_yards_allowed_per_game_wr2 TO pass_yards_allowed_per_game_wide_receiver_2;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN pass_yards_allowed_per_game_wr3 TO pass_yards_allowed_per_game_wide_receiver_3;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN second_and_mid_dvoa TO second_and_medium_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN second_and_mid_dvoa_rank TO second_and_medium_dvoa_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN team_rb_yards TO team_running_back_yards;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN team_rb_yards_rank TO team_running_back_yards_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN team_rush_mid_guard_percentage TO team_rush_middle_guard_percentage;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN team_rush_mid_guard_yards TO team_rush_middle_guard_yards;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN team_rush_mid_guard_yards_rank TO team_rush_middle_guard_yards_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN third_and_mid_dvoa TO third_and_medium_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_history RENAME COLUMN third_and_mid_dvoa_rank TO third_and_medium_dvoa_rank;

-- dvoa_team_unit_seasonlogs_index
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN fourth_quarter_ot_dvoa TO fourth_quarter_overtime_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN fourth_quarter_ot_dvoa_rank TO fourth_quarter_overtime_dvoa_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_points_allowed_per_game_rb TO pass_points_allowed_per_game_running_back;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_points_allowed_per_game_te TO pass_points_allowed_per_game_tight_end;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_points_allowed_per_game_wr1 TO pass_points_allowed_per_game_wide_receiver_1;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_points_allowed_per_game_wr2 TO pass_points_allowed_per_game_wide_receiver_2;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_points_allowed_per_game_wr3 TO pass_points_allowed_per_game_wide_receiver_3;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_rb_dvoa TO pass_running_back_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_rb_dvoa_rank TO pass_running_back_dvoa_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_te_dvoa TO pass_tight_end_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_te_dvoa_rank TO pass_tight_end_dvoa_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_wr1_dvoa TO pass_wide_receiver_1_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_wr1_dvoa_rank TO pass_wide_receiver_1_dvoa_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_wr2_dvoa TO pass_wide_receiver_2_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_wr2_dvoa_rank TO pass_wide_receiver_2_dvoa_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_wr3_dvoa TO pass_wide_receiver_3_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_wr3_dvoa_rank TO pass_wide_receiver_3_dvoa_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_yards_allowed_per_game_rb TO pass_yards_allowed_per_game_running_back;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_yards_allowed_per_game_te TO pass_yards_allowed_per_game_tight_end;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_yards_allowed_per_game_wr1 TO pass_yards_allowed_per_game_wide_receiver_1;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_yards_allowed_per_game_wr2 TO pass_yards_allowed_per_game_wide_receiver_2;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN pass_yards_allowed_per_game_wr3 TO pass_yards_allowed_per_game_wide_receiver_3;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN second_and_mid_dvoa TO second_and_medium_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN second_and_mid_dvoa_rank TO second_and_medium_dvoa_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN team_rb_yards TO team_running_back_yards;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN team_rb_yards_rank TO team_running_back_yards_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN team_rush_mid_guard_percentage TO team_rush_middle_guard_percentage;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN team_rush_mid_guard_yards TO team_rush_middle_guard_yards;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN team_rush_mid_guard_yards_rank TO team_rush_middle_guard_yards_rank;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN third_and_mid_dvoa TO third_and_medium_dvoa;
ALTER TABLE dvoa_team_unit_seasonlogs_index RENAME COLUMN third_and_mid_dvoa_rank TO third_and_medium_dvoa_rank;

