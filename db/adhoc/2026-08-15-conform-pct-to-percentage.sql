-- STATUS: APPLIED 2026-08-15 against league_production
--
-- Conform every pct column in the league schema to the full-word percentage
-- spelling, in one transaction, with each column landing its FINAL name.
--
-- THE RULING. percentage, never pct -- operator, 2026-08-13, reaffirmed
-- 2026-08-14 against the ratified-abbreviation test in
-- guideline/nfl/league/database-schema-standards.md. The full-word rule admits
-- exactly one closed list of ratified abbreviations, and that list is id and
-- url; pct is not on it. Legibility is explicitly NOT the test -- avg, min,
-- max, num and qty are equally readable and equally forbidden. Never cite a
-- count as the reason for a name: a partition-inflated count is what produced
-- the wrong 2026-08-13 rename, reverted the same day in
-- db/adhoc/2026-08-13-revert-deep-route-pct.sql.
--
-- This file also rewrites 725 percentiles.field VALUES at the end, because that
-- column stores a physical column name as data; see the note above that
-- statement for why it belongs in the same transaction.
--
-- SCOPE: 194 renames across 20 logical tables -- 192 pct columns plus 2 apy
-- siblings on player, already one of those 20, pulled in so that three-column
-- family does not split. The 756 partition children of player_gamelogs follow
-- their parent automatically and need no DDL of their own.
--
-- SCOPE CORRECTION, from the 165 columns across 19 tables previously on record.
-- That figure was measured with relkind = 'r' and not relispartition, which
-- excludes partition CHILDREN correctly and ALSO excludes partitioned PARENTS,
-- which are relkind = 'p'. It therefore dropped player_gamelogs and its 27 pct
-- columns. The root cause was an arithmetic slip: player_gamelogs has 28
-- partitions carrying 756 child columns and the parent carries 27, and
-- 756 + 27 = 783 is the exact figure the guideline dismissed as "783 of the pct
-- hits are player_gamelogs partitions" -- so the parent was discarded as
-- partition noise and the corrective filter encoded that mistake permanently.
-- db/tools/schema-partitions.mjs is the repo's correct derivation; it reads
-- membership from the dump's ATTACH PARTITION lines and self-checks against
-- pg_class.relispartition. Cite that, never hand-rolled relkind SQL.
--
-- NAMING RULES, applied in order:
--   1. pct -> percentage, in place. All 192 carry pct as a standalone
--      underscore token, so substitution is unambiguous. The POSITION is
--      ratified rather than chosen: player_prospect_profile already spells
--      stat_positive_percentage_run_behind, so pos_pct_gap becomes
--      positive_percentage_gap, never pos_gap_percentage.
--   2. Expand a second abbreviation token only where this cluster can land
--      EVERY member of that token on that table, pulling in the non-pct
--      siblings when the whole remainder sits on the same table. That yields
--      pos -> positive (24), comp -> completion (6) and alt -> alternate (2),
--      all confined to player_college_careerlogs and player_college_seasonlogs,
--      plus apy -> average_annual_value (3) on player. Every other second token
--      keeps its spelling for the uniform pass owned by
--      task/league/conform-league-schema-abbreviation-tokens.md -- for each of
--      them the non-pct members outnumber the ones this cluster touches
--      (off 14 against 60, def 14 against 53, recv 4 against 37, prob 1 against
--      33, comp 8 against 26 schema-wide).
--
-- TWO NAMES HERE ARE PLAN-DERIVED, NOT OPERATOR-RULED. Stated explicitly so a
-- later reader does not mistake them for settled rulings:
--
--   p_comp_pct -> expected_completion_percentage
--     The DIRECTION is established by data: across the 20
--     player_college_seasonlogs rows carrying all three values,
--     p_comp_pct_plus_minus tracks comp_pct - p_comp_pct at 11 of 20 exact,
--     0 of 20 reversed, 20 of 20 within one rounding unit at 2dp. That settles
--     that p_comp_pct is the BASELINE and not which WORD names it -- the SIS
--     source key is pCompPct (private/libs-server/sis.mjs:475) and the
--     2026-07-22 glossary header decodes TPTS, FBI, POA, HOB, ATD, Pos% and ST
--     but has no entry for p. The word comes from the schema's own vocabulary:
--     expected_pass_comp already exists on nfl_team_seasonlogs and
--     player_passing_gamelogs for exactly this concept.
--
--   p_comp_pct_plus_minus -> completion_percentage_plus_minus, NOT
--   _over_expected
--     db/adhoc/2026-07-22-player-prospect-profile-sis-conform.sql:103,133
--     already ruled this shape, on this vendor, in this importer: it renamed
--     stat_target_pct_plus_minus -> stat_target_percentage_plus_minus and
--     stat_pressure_pct_plus_minus -> stat_pressure_percentage_plus_minus,
--     applying pct -> percentage in place and KEEPING _plus_minus. That file is
--     this cluster's cited authority for the pos expansion and cannot be
--     authority for one rename while ignored for the other. Separately,
--     _over_expected would split the _plus_minus family INSIDE the tables being
--     conformed: each college table carries four such columns
--     (p_comp_pct_plus_minus, pressure_pct_plus_minus, snap_to_throw_plus_minus,
--     throw_air_time_plus_minus) and only the first would move. The objection is
--     the family split, NOT a name collision -- the schema already reuses a
--     concept name across differently-sourced tables (catch_rate_over_expected,
--     rush_yards_over_expected).
--
-- The resulting family on each college table reads completion_percentage,
-- expected_completion_percentage, completion_percentage_plus_minus -- coherent
-- internally, and matching pressure_percentage_plus_minus beside it.
--
-- DELIBERATELY NOT HERE: q1-q4 (8 columns plus 8 count siblings). The quarter
-- concept is spelled two ways today, q1-q4 on player_gamelogs and qtr on six
-- nfl_plays columns, so ruling one without the other splits it across tables.
-- One uniform quarter pass belongs to the token task.
--
-- TIMEOUTS. RENAME COLUMN is catalog-only, so no table rewrite -- but the
-- server pins statement_timeout to 40s in postgresql.conf with no role- or
-- database-level override, and nothing outside this file can raise it. A
-- scratch-database rehearsal is structurally blind to this (it carries the
-- schema and none of the rows, so every rehearsed DDL is instant by
-- construction), so mitigate rather than verify. 30s to ACQUIRE and unlimited
-- to EXECUTE is the asymmetry league CLAUDE.md prescribes for any apply against
-- hot tables like player and player_gamelogs: an unbounded wait to acquire
-- ACCESS EXCLUSIVE blocks every new reader behind it, which is strictly worse
-- than failing.
--
-- No BEGIN/COMMIT here: db-exec.sh supplies the transaction via
-- --single-transaction with ON_ERROR_STOP=1, and an explicit COMMIT inside it
-- would end the outer transaction early and cost every later statement its
-- rollback. No non-blocking index build is needed, so this file must stay
-- transactional.

SET lock_timeout = '30s';
SET statement_timeout = 0;

--
-- dvoa_team_unit_seasonlogs_history
--
ALTER TABLE public.dvoa_team_unit_seasonlogs_history RENAME COLUMN team_rush_left_end_pct TO team_rush_left_end_percentage;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history RENAME COLUMN team_rush_left_tackle_pct TO team_rush_left_tackle_percentage;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history RENAME COLUMN team_rush_mid_guard_pct TO team_rush_mid_guard_percentage;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history RENAME COLUMN team_rush_right_end_pct TO team_rush_right_end_percentage;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history RENAME COLUMN team_rush_right_tackle_pct TO team_rush_right_tackle_percentage;

--
-- dvoa_team_unit_seasonlogs_index
--
ALTER TABLE public.dvoa_team_unit_seasonlogs_index RENAME COLUMN team_rush_left_end_pct TO team_rush_left_end_percentage;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index RENAME COLUMN team_rush_left_tackle_pct TO team_rush_left_tackle_percentage;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index RENAME COLUMN team_rush_mid_guard_pct TO team_rush_mid_guard_percentage;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index RENAME COLUMN team_rush_right_end_pct TO team_rush_right_end_percentage;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index RENAME COLUMN team_rush_right_tackle_pct TO team_rush_right_tackle_percentage;

--
-- espn_player_win_rates_history
--
ALTER TABLE public.espn_player_win_rates_history RENAME COLUMN double_team_pct TO double_team_percentage;

--
-- espn_player_win_rates_index
--
ALTER TABLE public.espn_player_win_rates_index RENAME COLUMN double_team_pct TO double_team_percentage;

--
-- league_team_careerlogs
--
ALTER TABLE public.league_team_careerlogs RENAME COLUMN best_season_all_play_pct TO best_season_all_play_percentage;
ALTER TABLE public.league_team_careerlogs RENAME COLUMN best_season_win_pct TO best_season_win_percentage;
ALTER TABLE public.league_team_careerlogs RENAME COLUMN potential_points_pct TO potential_points_percentage;

--
-- league_team_seasonlogs
--
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN potential_points_pct TO potential_points_percentage;

--
-- league_user_careerlogs
--
ALTER TABLE public.league_user_careerlogs RENAME COLUMN best_season_all_play_pct TO best_season_all_play_percentage;
ALTER TABLE public.league_user_careerlogs RENAME COLUMN best_season_win_pct TO best_season_win_percentage;
ALTER TABLE public.league_user_careerlogs RENAME COLUMN potential_points_pct TO potential_points_percentage;

--
-- nfl_team_gamelogs
--
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_pass_pct TO def_pass_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_run_pct TO def_run_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_attempts_inside_tackles_pct TO def_rush_attempts_inside_tackles_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_attempts_light_box_pct TO def_rush_attempts_light_box_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_attempts_outside_tackles_pct TO def_rush_attempts_outside_tackles_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_attempts_stacked_box_pct TO def_rush_attempts_stacked_box_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_stuffed_pct TO def_rush_stuffed_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_sack_pct TO def_sack_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_tight_window_pct TO def_tight_window_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pass_pct TO off_pass_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_play_action_pct TO off_play_action_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_run_pct TO off_run_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_attempts_inside_tackles_pct TO off_rush_attempts_inside_tackles_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_attempts_light_box_pct TO off_rush_attempts_light_box_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_attempts_outside_tackles_pct TO off_rush_attempts_outside_tackles_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_attempts_stacked_box_pct TO off_rush_attempts_stacked_box_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_attempts_stuffed_pct TO off_rush_attempts_stuffed_percentage;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_success_pct TO off_rush_success_percentage;

--
-- nfl_team_seasonlogs
--
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN deep_pass_att_pct TO deep_pass_att_percentage;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN pass_comp_pct TO pass_comp_percentage;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN pass_yards_after_catch_pct TO pass_yards_after_catch_percentage;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN play_action_pct TO play_action_percentage;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN recv_deep_target_pct TO recv_deep_target_percentage;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN recv_tight_window_pct TO recv_tight_window_percentage;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN rush_attempts_inside_tackles_pct TO rush_attempts_inside_tackles_percentage;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN rush_attempts_stacked_box_pct TO rush_attempts_stacked_box_percentage;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN rush_attempts_under_center_pct TO rush_attempts_under_center_percentage;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN tight_window_pct TO tight_window_percentage;

--
-- pff_player_facet_gamelogs
--
ALTER TABLE public.pff_player_facet_gamelogs RENAME COLUMN pressure_pct TO pressure_percentage;

--
-- pff_player_facet_seasonlogs
--
ALTER TABLE public.pff_player_facet_seasonlogs RENAME COLUMN pressure_pct TO pressure_percentage;

--
-- player
--
ALTER TABLE public.player RENAME COLUMN contract_apy TO contract_average_annual_value;
ALTER TABLE public.player RENAME COLUMN contract_apy_cap_pct TO contract_average_annual_value_cap_percentage;
ALTER TABLE public.player RENAME COLUMN contract_inflated_apy TO contract_inflated_average_annual_value;

--
-- player_college_careerlogs
--
ALTER TABLE public.player_college_careerlogs RENAME COLUMN blitz_pct TO blitz_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN blown_block_pct_pass TO blown_block_percentage_pass;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN blown_block_pct_run TO blown_block_percentage_run;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN boom_pct TO boom_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN bounce_pct_run_behind TO bounce_percentage_run_behind;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN bounce_pct_when_run_at TO bounce_percentage_when_run_at;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN box_pct TO box_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN broken_missed_tackle_pct TO broken_missed_tackle_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN broken_tackle_pct TO broken_tackle_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN bust_pct TO bust_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN catchable_catch_pct TO catchable_catch_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN catchable_pct TO catchable_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN comp_pct TO completion_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN deep_route_pct TO deep_route_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN defensive_end_pct TO defensive_end_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN defensive_tackle_pct TO defensive_tackle_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN deserved_catch_pct TO deserved_catch_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN gap_blocking_pct TO gap_blocking_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN hand_on_ball_pct TO hand_on_ball_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN heavy_box_pct TO heavy_box_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN man_coverage_pct TO man_coverage_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN missed_tackle_pct TO missed_tackle_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN nose_tackle_pct TO nose_tackle_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN on_target_catch_pct TO on_target_catch_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN on_target_pct TO on_target_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN p_comp_pct TO expected_completion_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN p_comp_pct_plus_minus TO completion_percentage_plus_minus;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pass_rush_pct TO pass_rush_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pos_pct TO positive_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pos_pct_gap TO positive_percentage_gap;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pos_pct_hit_at_line TO positive_percentage_hit_at_line;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pos_pct_inside TO positive_percentage_inside;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pos_pct_man TO positive_percentage_man;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pos_pct_man_alt TO positive_percentage_man_alternate;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pos_pct_outside TO positive_percentage_outside;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pos_pct_run_behind TO positive_percentage_run_behind;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pos_pct_vs_man TO positive_percentage_vs_man;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pos_pct_vs_zone TO positive_percentage_vs_zone;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pos_pct_when_run_at TO positive_percentage_when_run_at;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pos_pct_zone TO positive_percentage_zone;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN press_coverage_pct TO press_coverage_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pressure_pct TO pressure_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN pressure_pct_plus_minus TO pressure_percentage_plus_minus;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN quick_pressure_pct TO quick_pressure_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN run_behind_pct TO run_behind_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN sack_pct TO sack_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN slot_pct TO slot_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN split_out_pct TO split_out_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN three_point_stance_pct TO three_point_stance_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN true_pressure_pct TO true_pressure_percentage;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN zone_blocking_pct TO zone_blocking_percentage;

--
-- player_college_seasonlogs
--
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN blitz_pct TO blitz_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN blown_block_pct_pass TO blown_block_percentage_pass;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN blown_block_pct_run TO blown_block_percentage_run;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN boom_pct TO boom_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN bounce_pct_run_behind TO bounce_percentage_run_behind;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN bounce_pct_when_run_at TO bounce_percentage_when_run_at;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN box_pct TO box_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN broken_missed_tackle_pct TO broken_missed_tackle_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN broken_tackle_pct TO broken_tackle_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN bust_pct TO bust_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN catchable_catch_pct TO catchable_catch_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN catchable_pct TO catchable_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN comp_pct TO completion_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN deep_route_pct TO deep_route_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN defensive_end_pct TO defensive_end_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN defensive_tackle_pct TO defensive_tackle_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN deserved_catch_pct TO deserved_catch_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN gap_blocking_pct TO gap_blocking_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN hand_on_ball_pct TO hand_on_ball_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN heavy_box_pct TO heavy_box_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN man_coverage_pct TO man_coverage_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN missed_tackle_pct TO missed_tackle_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN nose_tackle_pct TO nose_tackle_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN on_target_catch_pct TO on_target_catch_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN on_target_pct TO on_target_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN p_comp_pct TO expected_completion_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN p_comp_pct_plus_minus TO completion_percentage_plus_minus;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pass_rush_pct TO pass_rush_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pos_pct TO positive_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pos_pct_gap TO positive_percentage_gap;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pos_pct_hit_at_line TO positive_percentage_hit_at_line;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pos_pct_inside TO positive_percentage_inside;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pos_pct_man TO positive_percentage_man;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pos_pct_man_alt TO positive_percentage_man_alternate;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pos_pct_outside TO positive_percentage_outside;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pos_pct_run_behind TO positive_percentage_run_behind;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pos_pct_vs_man TO positive_percentage_vs_man;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pos_pct_vs_zone TO positive_percentage_vs_zone;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pos_pct_when_run_at TO positive_percentage_when_run_at;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pos_pct_zone TO positive_percentage_zone;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN press_coverage_pct TO press_coverage_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pressure_pct TO pressure_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN pressure_pct_plus_minus TO pressure_percentage_plus_minus;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN quick_pressure_pct TO quick_pressure_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN run_behind_pct TO run_behind_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN sack_pct TO sack_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN slot_pct TO slot_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN split_out_pct TO split_out_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN three_point_stance_pct TO three_point_stance_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN true_pressure_pct TO true_pressure_percentage;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN zone_blocking_pct TO zone_blocking_percentage;

--
-- player_defender_gamelogs
--
ALTER TABLE public.player_defender_gamelogs RENAME COLUMN ball_hawk_pct TO ball_hawk_percentage;
ALTER TABLE public.player_defender_gamelogs RENAME COLUMN tight_window_forced_pct TO tight_window_forced_percentage;

--
-- player_dfs_ownership
--
ALTER TABLE public.player_dfs_ownership RENAME COLUMN ownership_pct TO ownership_percentage;

--
-- player_gamelogs
--
ALTER TABLE public.player_gamelogs RENAME COLUMN q1_snaps_def_pct TO q1_snaps_def_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q1_snaps_off_pct TO q1_snaps_off_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q2_snaps_def_pct TO q2_snaps_def_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q2_snaps_off_pct TO q2_snaps_off_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q3_snaps_def_pct TO q3_snaps_def_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q3_snaps_off_pct TO q3_snaps_off_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q4_snaps_def_pct TO q4_snaps_def_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN q4_snaps_off_pct TO q4_snaps_off_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_def_pct TO snaps_def_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_inside_five_yards_pct TO snaps_inside_five_yards_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_inside_ten_yards_pct TO snaps_inside_ten_yards_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_inside_twenty_yards_pct TO snaps_inside_twenty_yards_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_leading_pct TO snaps_leading_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_low_prob_pct TO snaps_low_prob_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_neutral_early_down_pct TO snaps_neutral_early_down_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_neutral_late_down_pct TO snaps_neutral_late_down_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_neutral_long_pct TO snaps_neutral_long_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_neutral_pct TO snaps_neutral_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_neutral_short_pct TO snaps_neutral_short_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_no_huddle_pct TO snaps_no_huddle_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_off_pct TO snaps_off_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_pass_pct TO snaps_pass_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_rush_pct TO snaps_rush_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_st_pct TO snaps_st_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_trailing_pct TO snaps_trailing_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_under_five_minutes_pct TO snaps_under_five_minutes_percentage;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_under_two_minutes_pct TO snaps_under_two_minutes_percentage;

--
-- player_passing_gamelogs
--
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN deep_pass_att_pct TO deep_pass_att_percentage;
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN pass_comp_pct TO pass_comp_percentage;
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN pass_yards_after_catch_pct TO pass_yards_after_catch_percentage;
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN play_action_pct TO play_action_percentage;
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN tight_window_pct TO tight_window_percentage;

--
-- player_receiving_gamelogs
--
ALTER TABLE public.player_receiving_gamelogs RENAME COLUMN recv_deep_target_pct TO recv_deep_target_percentage;
ALTER TABLE public.player_receiving_gamelogs RENAME COLUMN recv_tight_window_pct TO recv_tight_window_percentage;

--
-- player_rushing_gamelogs
--
ALTER TABLE public.player_rushing_gamelogs RENAME COLUMN rush_attempts_inside_tackles_pct TO rush_attempts_inside_tackles_percentage;
ALTER TABLE public.player_rushing_gamelogs RENAME COLUMN rush_attempts_stacked_box_pct TO rush_attempts_stacked_box_percentage;
ALTER TABLE public.player_rushing_gamelogs RENAME COLUMN rush_attempts_under_center_pct TO rush_attempts_under_center_percentage;

--
-- percentiles.field -- data, not an identifier
--
-- scripts/generate-nfl-team-seasonlogs.mjs:283 format_percentile_inserts
-- derives this column's VALUES from the seasonlog row's object keys, so the
-- moment that writer is swept its next run emits the new spelling and every
-- pre-existing row is stranded under the old one. 725 rows carry the old names
-- today across ten fields (20 each for the four team-level fields, 125 each for
-- the six position-split ones), and app/core/player-fields.js reads them back
-- through its percentile_field entries.
--
-- The live precedent for NOT doing this is cpoe: that column was renamed to
-- completion_percentage_over_expected, its 20 percentile rows were never
-- migrated, and player-fields.js carries a comment documenting the resulting
-- divergence as still unfixed. Ten more of those is not an end state anyone
-- would choose building from scratch.
--
-- The VALUES list is the WHOLE 121-name rename map rather than the ten names
-- that happen to carry rows right now, so a percentile row appearing for any
-- other renamed column between authoring and apply is carried too. Verified
-- collision-free: the map is injective (no old name maps to two new names) and
-- zero rows already carry a target name.

UPDATE public.percentiles p
SET field = m.new_name
FROM (VALUES
  ('ball_hawk_pct', 'ball_hawk_percentage'),
  ('best_season_all_play_pct', 'best_season_all_play_percentage'),
  ('best_season_win_pct', 'best_season_win_percentage'),
  ('blitz_pct', 'blitz_percentage'),
  ('blown_block_pct_pass', 'blown_block_percentage_pass'),
  ('blown_block_pct_run', 'blown_block_percentage_run'),
  ('boom_pct', 'boom_percentage'),
  ('bounce_pct_run_behind', 'bounce_percentage_run_behind'),
  ('bounce_pct_when_run_at', 'bounce_percentage_when_run_at'),
  ('box_pct', 'box_percentage'),
  ('broken_missed_tackle_pct', 'broken_missed_tackle_percentage'),
  ('broken_tackle_pct', 'broken_tackle_percentage'),
  ('bust_pct', 'bust_percentage'),
  ('catchable_catch_pct', 'catchable_catch_percentage'),
  ('catchable_pct', 'catchable_percentage'),
  ('comp_pct', 'completion_percentage'),
  ('contract_apy', 'contract_average_annual_value'),
  ('contract_apy_cap_pct', 'contract_average_annual_value_cap_percentage'),
  ('contract_inflated_apy', 'contract_inflated_average_annual_value'),
  ('deep_pass_att_pct', 'deep_pass_att_percentage'),
  ('deep_route_pct', 'deep_route_percentage'),
  ('def_pass_pct', 'def_pass_percentage'),
  ('def_run_pct', 'def_run_percentage'),
  ('def_rush_attempts_inside_tackles_pct', 'def_rush_attempts_inside_tackles_percentage'),
  ('def_rush_attempts_light_box_pct', 'def_rush_attempts_light_box_percentage'),
  ('def_rush_attempts_outside_tackles_pct', 'def_rush_attempts_outside_tackles_percentage'),
  ('def_rush_attempts_stacked_box_pct', 'def_rush_attempts_stacked_box_percentage'),
  ('def_rush_stuffed_pct', 'def_rush_stuffed_percentage'),
  ('def_sack_pct', 'def_sack_percentage'),
  ('def_tight_window_pct', 'def_tight_window_percentage'),
  ('defensive_end_pct', 'defensive_end_percentage'),
  ('defensive_tackle_pct', 'defensive_tackle_percentage'),
  ('deserved_catch_pct', 'deserved_catch_percentage'),
  ('double_team_pct', 'double_team_percentage'),
  ('gap_blocking_pct', 'gap_blocking_percentage'),
  ('hand_on_ball_pct', 'hand_on_ball_percentage'),
  ('heavy_box_pct', 'heavy_box_percentage'),
  ('man_coverage_pct', 'man_coverage_percentage'),
  ('missed_tackle_pct', 'missed_tackle_percentage'),
  ('nose_tackle_pct', 'nose_tackle_percentage'),
  ('off_pass_pct', 'off_pass_percentage'),
  ('off_play_action_pct', 'off_play_action_percentage'),
  ('off_run_pct', 'off_run_percentage'),
  ('off_rush_attempts_inside_tackles_pct', 'off_rush_attempts_inside_tackles_percentage'),
  ('off_rush_attempts_light_box_pct', 'off_rush_attempts_light_box_percentage'),
  ('off_rush_attempts_outside_tackles_pct', 'off_rush_attempts_outside_tackles_percentage'),
  ('off_rush_attempts_stacked_box_pct', 'off_rush_attempts_stacked_box_percentage'),
  ('off_rush_attempts_stuffed_pct', 'off_rush_attempts_stuffed_percentage'),
  ('off_rush_success_pct', 'off_rush_success_percentage'),
  ('on_target_catch_pct', 'on_target_catch_percentage'),
  ('on_target_pct', 'on_target_percentage'),
  ('ownership_pct', 'ownership_percentage'),
  ('p_comp_pct', 'expected_completion_percentage'),
  ('p_comp_pct_plus_minus', 'completion_percentage_plus_minus'),
  ('pass_comp_pct', 'pass_comp_percentage'),
  ('pass_rush_pct', 'pass_rush_percentage'),
  ('pass_yards_after_catch_pct', 'pass_yards_after_catch_percentage'),
  ('play_action_pct', 'play_action_percentage'),
  ('pos_pct', 'positive_percentage'),
  ('pos_pct_gap', 'positive_percentage_gap'),
  ('pos_pct_hit_at_line', 'positive_percentage_hit_at_line'),
  ('pos_pct_inside', 'positive_percentage_inside'),
  ('pos_pct_man', 'positive_percentage_man'),
  ('pos_pct_man_alt', 'positive_percentage_man_alternate'),
  ('pos_pct_outside', 'positive_percentage_outside'),
  ('pos_pct_run_behind', 'positive_percentage_run_behind'),
  ('pos_pct_vs_man', 'positive_percentage_vs_man'),
  ('pos_pct_vs_zone', 'positive_percentage_vs_zone'),
  ('pos_pct_when_run_at', 'positive_percentage_when_run_at'),
  ('pos_pct_zone', 'positive_percentage_zone'),
  ('potential_points_pct', 'potential_points_percentage'),
  ('press_coverage_pct', 'press_coverage_percentage'),
  ('pressure_pct', 'pressure_percentage'),
  ('pressure_pct_plus_minus', 'pressure_percentage_plus_minus'),
  ('q1_snaps_def_pct', 'q1_snaps_def_percentage'),
  ('q1_snaps_off_pct', 'q1_snaps_off_percentage'),
  ('q2_snaps_def_pct', 'q2_snaps_def_percentage'),
  ('q2_snaps_off_pct', 'q2_snaps_off_percentage'),
  ('q3_snaps_def_pct', 'q3_snaps_def_percentage'),
  ('q3_snaps_off_pct', 'q3_snaps_off_percentage'),
  ('q4_snaps_def_pct', 'q4_snaps_def_percentage'),
  ('q4_snaps_off_pct', 'q4_snaps_off_percentage'),
  ('quick_pressure_pct', 'quick_pressure_percentage'),
  ('recv_deep_target_pct', 'recv_deep_target_percentage'),
  ('recv_tight_window_pct', 'recv_tight_window_percentage'),
  ('run_behind_pct', 'run_behind_percentage'),
  ('rush_attempts_inside_tackles_pct', 'rush_attempts_inside_tackles_percentage'),
  ('rush_attempts_stacked_box_pct', 'rush_attempts_stacked_box_percentage'),
  ('rush_attempts_under_center_pct', 'rush_attempts_under_center_percentage'),
  ('sack_pct', 'sack_percentage'),
  ('slot_pct', 'slot_percentage'),
  ('snaps_def_pct', 'snaps_def_percentage'),
  ('snaps_inside_five_yards_pct', 'snaps_inside_five_yards_percentage'),
  ('snaps_inside_ten_yards_pct', 'snaps_inside_ten_yards_percentage'),
  ('snaps_inside_twenty_yards_pct', 'snaps_inside_twenty_yards_percentage'),
  ('snaps_leading_pct', 'snaps_leading_percentage'),
  ('snaps_low_prob_pct', 'snaps_low_prob_percentage'),
  ('snaps_neutral_early_down_pct', 'snaps_neutral_early_down_percentage'),
  ('snaps_neutral_late_down_pct', 'snaps_neutral_late_down_percentage'),
  ('snaps_neutral_long_pct', 'snaps_neutral_long_percentage'),
  ('snaps_neutral_pct', 'snaps_neutral_percentage'),
  ('snaps_neutral_short_pct', 'snaps_neutral_short_percentage'),
  ('snaps_no_huddle_pct', 'snaps_no_huddle_percentage'),
  ('snaps_off_pct', 'snaps_off_percentage'),
  ('snaps_pass_pct', 'snaps_pass_percentage'),
  ('snaps_rush_pct', 'snaps_rush_percentage'),
  ('snaps_st_pct', 'snaps_st_percentage'),
  ('snaps_trailing_pct', 'snaps_trailing_percentage'),
  ('snaps_under_five_minutes_pct', 'snaps_under_five_minutes_percentage'),
  ('snaps_under_two_minutes_pct', 'snaps_under_two_minutes_percentage'),
  ('split_out_pct', 'split_out_percentage'),
  ('team_rush_left_end_pct', 'team_rush_left_end_percentage'),
  ('team_rush_left_tackle_pct', 'team_rush_left_tackle_percentage'),
  ('team_rush_mid_guard_pct', 'team_rush_mid_guard_percentage'),
  ('team_rush_right_end_pct', 'team_rush_right_end_percentage'),
  ('team_rush_right_tackle_pct', 'team_rush_right_tackle_percentage'),
  ('three_point_stance_pct', 'three_point_stance_percentage'),
  ('tight_window_forced_pct', 'tight_window_forced_percentage'),
  ('tight_window_pct', 'tight_window_percentage'),
  ('true_pressure_pct', 'true_pressure_percentage'),
  ('zone_blocking_pct', 'zone_blocking_percentage')
) AS m(old_name, new_name)
WHERE p.field = m.old_name;
