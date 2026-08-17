-- STATUS: APPLIED 2026-08-17 against league_production
-- Conform the markets-and-props vocabulary to full words:
-- prob -> probability, hist -> historical, opp -> opponent, sgp -> same_game_parlay.
--
-- 70 columns across 8 tables. One apply because these tokens share the
-- props/markets writers and the nflfastR plays feed, so one consumer
-- sweep covers all four.
--
-- FOUR TARGETS THE TOKEN ALONE DOES NOT DETERMINE.
--
--   nfl_plays.home_win_prob_pre/_post and away_win_prob_pre/_post restore
--   the _ngs source qualifier: they are the NGS win-probability pair
--   (Next Gen Stats, originally home_win_prob_pre_ngs/_post_ngs until a
--   2025-07-24 "standardize variable naming" refactor stripped it), and
--   nfl_plays already carries the nflfastR family under
--   home_win_probability / home_win_probability_post / away_win_probability
--   / away_win_probability_post. A uniform prob->probability rename would
--   write home_win_probability_post OVER the live nflfastR column. The
--   _ngs suffix is the schema convention (ep_ngs, epa_ngs,
--   coverage_type_ngs) and mirrors the counting batch cov_type ->
--   coverage_type_ngs ruling. The _ngs columns carry 12,203 rows
--   (2023-2024) and no current writer or reader; they are RENAMED, not
--   dropped.
--
--   nfl_plays.xpass_prob -> expected_pass_probability per the plan coined
--   identifiers (xpass_prob becomes expected_pass_probability). Its
--   siblings xyac_first_down_prob / xyac_success_prob take the plain token
--   rename because xyac is a ratified metric token.
--
--   props_index / prop_pairings hist_edge_hard/soft + hist_rate_hard/soft
--   are the props pipeline historical edge/rate columns (triaged RENAME
--   on 2026-08-16: both tables are live) -> historical_edge_hard etc.
--
--   is_sgp -> is_same_game_parlay on selection_combination_odds_*; SGP is
--   the betting term same game parlay (cf.
--   libs-server/wager-analysis/draftkings-standardization.mjs, which
--   renders SGP(selection...)).
--
SET lock_timeout = '30s';
SET statement_timeout = 0;

-- nfl_plays (18)
ALTER TABLE public.nfl_plays RENAME COLUMN away_win_prob_post TO away_win_probability_post_ngs;
ALTER TABLE public.nfl_plays RENAME COLUMN away_win_prob_pre TO away_win_probability_pre_ngs;
ALTER TABLE public.nfl_plays RENAME COLUMN extra_point_prob TO extra_point_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN field_goal_prob TO field_goal_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN home_win_prob_post TO home_win_probability_post_ngs;
ALTER TABLE public.nfl_plays RENAME COLUMN home_win_prob_pre TO home_win_probability_pre_ngs;
ALTER TABLE public.nfl_plays RENAME COLUMN no_score_prob TO no_score_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN opp_field_goal_prob TO opponent_field_goal_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN opp_safety_prob TO opponent_safety_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN opp_touchdown_prob TO opponent_touchdown_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN pass_prob_non_tracking TO pass_probability_non_tracking;
ALTER TABLE public.nfl_plays RENAME COLUMN pass_prob_tracking TO pass_probability_tracking;
ALTER TABLE public.nfl_plays RENAME COLUMN safety_prob TO safety_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN touchdown_prob TO touchdown_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN two_conversion_prob TO two_conversion_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN xpass_prob TO expected_pass_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN xyac_first_down_prob TO xyac_first_down_probability;
ALTER TABLE public.nfl_plays RENAME COLUMN xyac_success_prob TO xyac_success_probability;

-- nfl_plays_current_week (12)
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN extra_point_prob TO extra_point_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN field_goal_prob TO field_goal_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN no_score_prob TO no_score_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN opp_field_goal_prob TO opponent_field_goal_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN opp_safety_prob TO opponent_safety_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN opp_touchdown_prob TO opponent_touchdown_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN safety_prob TO safety_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN touchdown_prob TO touchdown_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN two_conversion_prob TO two_conversion_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN xpass_prob TO expected_pass_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN xyac_first_down_prob TO xyac_first_down_probability;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN xyac_success_prob TO xyac_success_probability;

-- player_gamelogs (2)
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_low_prob TO snaps_low_probability;
ALTER TABLE public.player_gamelogs RENAME COLUMN snaps_low_prob_percentage TO snaps_low_probability_percentage;

-- prop_pairings (24)
ALTER TABLE public.prop_pairings RENAME COLUMN current_season_hist_edge_hard TO current_season_historical_edge_hard;
ALTER TABLE public.prop_pairings RENAME COLUMN current_season_hist_edge_soft TO current_season_historical_edge_soft;
ALTER TABLE public.prop_pairings RENAME COLUMN current_season_hist_rate_hard TO current_season_historical_rate_hard;
ALTER TABLE public.prop_pairings RENAME COLUMN current_season_hist_rate_soft TO current_season_historical_rate_soft;
ALTER TABLE public.prop_pairings RENAME COLUMN current_season_joint_hist_rate_soft TO current_season_joint_historical_rate_soft;
ALTER TABLE public.prop_pairings RENAME COLUMN current_season_opp_allow_rate TO current_season_opponent_allow_rate;
ALTER TABLE public.prop_pairings RENAME COLUMN current_season_sum_hist_rate_hard TO current_season_sum_historical_rate_hard;
ALTER TABLE public.prop_pairings RENAME COLUMN current_season_sum_hist_rate_soft TO current_season_sum_historical_rate_soft;
ALTER TABLE public.prop_pairings RENAME COLUMN last_five_hist_edge_hard TO last_five_historical_edge_hard;
ALTER TABLE public.prop_pairings RENAME COLUMN last_five_hist_edge_soft TO last_five_historical_edge_soft;
ALTER TABLE public.prop_pairings RENAME COLUMN last_five_hist_rate_hard TO last_five_historical_rate_hard;
ALTER TABLE public.prop_pairings RENAME COLUMN last_five_hist_rate_soft TO last_five_historical_rate_soft;
ALTER TABLE public.prop_pairings RENAME COLUMN last_five_joint_hist_rate_soft TO last_five_joint_historical_rate_soft;
ALTER TABLE public.prop_pairings RENAME COLUMN last_season_hist_edge_hard TO last_season_historical_edge_hard;
ALTER TABLE public.prop_pairings RENAME COLUMN last_season_hist_edge_soft TO last_season_historical_edge_soft;
ALTER TABLE public.prop_pairings RENAME COLUMN last_season_hist_rate_hard TO last_season_historical_rate_hard;
ALTER TABLE public.prop_pairings RENAME COLUMN last_season_hist_rate_soft TO last_season_historical_rate_soft;
ALTER TABLE public.prop_pairings RENAME COLUMN last_season_joint_hist_rate_soft TO last_season_joint_historical_rate_soft;
ALTER TABLE public.prop_pairings RENAME COLUMN last_ten_hist_edge_hard TO last_ten_historical_edge_hard;
ALTER TABLE public.prop_pairings RENAME COLUMN last_ten_hist_edge_soft TO last_ten_historical_edge_soft;
ALTER TABLE public.prop_pairings RENAME COLUMN last_ten_hist_rate_hard TO last_ten_historical_rate_hard;
ALTER TABLE public.prop_pairings RENAME COLUMN last_ten_hist_rate_soft TO last_ten_historical_rate_soft;
ALTER TABLE public.prop_pairings RENAME COLUMN last_ten_joint_hist_rate_soft TO last_ten_joint_historical_rate_soft;
ALTER TABLE public.prop_pairings RENAME COLUMN market_prob TO market_probability;

-- props_index (9)
ALTER TABLE public.props_index RENAME COLUMN hist_edge_hard TO historical_edge_hard;
ALTER TABLE public.props_index RENAME COLUMN hist_edge_soft TO historical_edge_soft;
ALTER TABLE public.props_index RENAME COLUMN hist_rate_hard TO historical_rate_hard;
ALTER TABLE public.props_index RENAME COLUMN hist_rate_soft TO historical_rate_soft;
ALTER TABLE public.props_index RENAME COLUMN hits_opp TO hits_opponent;
ALTER TABLE public.props_index RENAME COLUMN market_prob TO market_probability;
ALTER TABLE public.props_index RENAME COLUMN opp_allow_rate TO opponent_allow_rate;
ALTER TABLE public.props_index RENAME COLUMN opp_hit_weeks TO opponent_hit_weeks;
ALTER TABLE public.props_index RENAME COLUMN opp_weeks TO opponent_weeks;

-- selection_combination_odds_history (1)
ALTER TABLE public.selection_combination_odds_history RENAME COLUMN is_sgp TO is_same_game_parlay;

-- selection_combination_odds_index (1)
ALTER TABLE public.selection_combination_odds_index RENAME COLUMN is_sgp TO is_same_game_parlay;

-- weekly_market_selections_analysis_cache (3)
ALTER TABLE public.weekly_market_selections_analysis_cache RENAME COLUMN current_season_hits_opp TO current_season_hits_opponent;
ALTER TABLE public.weekly_market_selections_analysis_cache RENAME COLUMN current_season_opp_hit_weeks TO current_season_opponent_hit_weeks;
ALTER TABLE public.weekly_market_selections_analysis_cache RENAME COLUMN current_season_opp_weeks_played TO current_season_opponent_weeks_played;
