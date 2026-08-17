-- STATUS: APPLIED 2026-08-17 against league_production
-- Conform the long-tail vocabulary to full words, one apply:
-- num, pos, rnk, vert, 100touches, 100db, int, o/u/am, cmv, str, est,
-- tz, dist, goaline, exp, ps, ext, ep, fpg.
--
-- SENSE SPLITS (settled here, the audit cannot see them):
--
--   pos on nfl_plays/current_week (pos_score, pos_score_post,
--   pos_timeouts_remaining) is the POSSESSION team -- the schema comment
--   says "Number of timeouts remaining for the possession team" and the
--   sibling defense_score/defense_timeouts_remaining anchor the sense. On
--   scoring_format_player_gamelogs/seasonlogs pos_rnk is POSITION rank,
--   which the counting batches family (points_rnk) makes unambiguous.
--
--   ep_result and field_goal_ep_kicker are the EXTRA POINT (the nfl_kick_result
--   enum and the PFF kicker role), while ep_ngs is NGS EXPECTED POINTS. Both
--   take their full-word sense rather than a uniform token rename.
--
--   nfl_games.time_est -> time_eastern (live, 15,598 rows, triage 2026-08-16)
--   and nfl_games.time_tz_offset is the DEAD column (0 rows, 0 consumers) --
--   DROPPED per the triage, not renamed.
--
--   player_pair_correlations pid_a/pid_b and nfl_team_a/nfl_team_b are pair
--   SIDE ordinals -- the schema comment says "alphabetically smaller/larger" --
--   so a/b expand to first/second, preserving meaning.
--
SET lock_timeout = '30s';
SET statement_timeout = 0;

-- adp_format (2 renames)
ALTER TABLE public.adp_format RENAME COLUMN num_quarterback TO number_quarterback;
ALTER TABLE public.adp_format RENAME COLUMN num_teams TO number_teams;

-- composite_market_value_daily (1 renames)
ALTER TABLE public.composite_market_value_daily RENAME COLUMN cmv_row_id TO composite_market_value_row_id;

-- draft (1 renames)
ALTER TABLE public.draft RENAME COLUMN pick_str TO pick_string;

-- external_league_trades (1 renames)
ALTER TABLE public.external_league_trades RENAME COLUMN num_sides TO number_sides;

-- external_leagues (1 renames)
ALTER TABLE public.external_leagues RENAME COLUMN num_teams TO number_teams;

-- league_formats (2 renames)
ALTER TABLE public.league_formats RENAME COLUMN num_teams TO number_teams;
ALTER TABLE public.league_formats RENAME COLUMN cap TO salary_cap;

-- league_team_careerlogs (2 renames)
ALTER TABLE public.league_team_careerlogs RENAME COLUMN num_byes TO number_byes;
ALTER TABLE public.league_team_careerlogs RENAME COLUMN num_seasons TO number_seasons;

-- league_user_careerlogs (2 renames)
ALTER TABLE public.league_user_careerlogs RENAME COLUMN num_byes TO number_byes;
ALTER TABLE public.league_user_careerlogs RENAME COLUMN num_seasons TO number_seasons;

-- nfl_games (1 renames)
ALTER TABLE public.nfl_games RENAME COLUMN time_est TO time_eastern;
ALTER TABLE public.nfl_games DROP COLUMN time_tz_offset;

-- nfl_plays (8 renames)
ALTER TABLE public.nfl_plays RENAME COLUMN ep_ngs TO expected_points_ngs;
ALTER TABLE public.nfl_plays RENAME COLUMN ep_result TO extra_point_result;
ALTER TABLE public.nfl_plays RENAME COLUMN num_high_safeties TO number_high_safeties;
ALTER TABLE public.nfl_plays RENAME COLUMN num_shifted_players TO number_shifted_players;
ALTER TABLE public.nfl_plays RENAME COLUMN pos_score TO possession_score;
ALTER TABLE public.nfl_plays RENAME COLUMN pos_score_post TO possession_score_post;
ALTER TABLE public.nfl_plays RENAME COLUMN pos_timeouts_remaining TO possession_timeouts_remaining;
ALTER TABLE public.nfl_plays RENAME COLUMN yard_line_num TO yard_line_number;

-- nfl_plays_current_week (5 renames)
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN ep_result TO extra_point_result;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pos_score TO possession_score;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pos_score_post TO possession_score_post;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pos_timeouts_remaining TO possession_timeouts_remaining;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN yard_line_num TO yard_line_number;

-- nfl_plays_player (1 renames)
ALTER TABLE public.nfl_plays_player RENAME COLUMN in_play_dist TO in_play_distance;

-- pff_player_seasonlogs (1 renames)
ALTER TABLE public.pff_player_seasonlogs RENAME COLUMN field_goal_ep_kicker TO field_goal_extra_point_kicker;

-- player_college_careerlogs (8 renames)
ALTER TABLE public.player_college_careerlogs RENAME COLUMN broken_missed_tackles_per_100db TO broken_missed_tackles_per_100_defensive_backs;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN broken_tackles_per_100touches TO broken_tackles_per_100_touches;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN dropped_int TO dropped_interceptions;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN fumbles_per_100touches TO fumbles_per_100_touches;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN missed_tackles_per_100touches TO missed_tackles_per_100_touches;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN vert_jump TO vertical_jump;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN vert_jump_is_pro_day TO vertical_jump_is_pro_day;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN vert_jump_is_unofficial TO vertical_jump_is_unofficial;

-- player_college_seasonlogs (8 renames)
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN broken_missed_tackles_per_100db TO broken_missed_tackles_per_100_defensive_backs;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN broken_tackles_per_100touches TO broken_tackles_per_100_touches;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN dropped_int TO dropped_interceptions;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN fumbles_per_100touches TO fumbles_per_100_touches;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN missed_tackles_per_100touches TO missed_tackles_per_100_touches;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN vert_jump TO vertical_jump;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN vert_jump_is_pro_day TO vertical_jump_is_pro_day;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN vert_jump_is_unofficial TO vertical_jump_is_unofficial;

-- player_game_outcome_correlations (3 renames)
ALTER TABLE public.player_game_outcome_correlations RENAME COLUMN leading_fpg TO leading_fantasy_points_per_game;
ALTER TABLE public.player_game_outcome_correlations RENAME COLUMN overall_fpg TO overall_fantasy_points_per_game;
ALTER TABLE public.player_game_outcome_correlations RENAME COLUMN trailing_fpg TO trailing_fantasy_points_per_game;

-- player_pair_correlations (4 renames)
ALTER TABLE public.player_pair_correlations RENAME COLUMN nfl_team_a TO nfl_team_first;
ALTER TABLE public.player_pair_correlations RENAME COLUMN nfl_team_b TO nfl_team_second;
ALTER TABLE public.player_pair_correlations RENAME COLUMN pid_a TO pid_first;
ALTER TABLE public.player_pair_correlations RENAME COLUMN pid_b TO pid_second;

-- player_rushing_gamelogs (1 renames)
ALTER TABLE public.player_rushing_gamelogs RENAME COLUMN rush_attempts_goaline TO rush_attempts_goal_line;

-- players_status (1 renames)
ALTER TABLE public.players_status RENAME COLUMN exp_return TO expected_return;

-- props (2 renames)
ALTER TABLE public.props RENAME COLUMN o_am TO over_american_odds;
ALTER TABLE public.props RENAME COLUMN u_am TO under_american_odds;

-- props_index (2 renames)
ALTER TABLE public.props_index RENAME COLUMN o_am TO over_american_odds;
ALTER TABLE public.props_index RENAME COLUMN u_am TO under_american_odds;

-- roster_asset_holding (1 renames)
ALTER TABLE public.roster_asset_holding RENAME COLUMN ps_slot_subtype TO practice_squad_slot_subtype;

-- scoring_format_player_gamelogs (1 renames)
ALTER TABLE public.scoring_format_player_gamelogs RENAME COLUMN pos_rnk TO position_rank;

-- scoring_format_player_seasonlogs (4 renames)
ALTER TABLE public.scoring_format_player_seasonlogs RENAME COLUMN points_per_game_pos_rnk TO points_per_game_position_rank;
ALTER TABLE public.scoring_format_player_seasonlogs RENAME COLUMN points_per_game_rnk TO points_per_game_rank;
ALTER TABLE public.scoring_format_player_seasonlogs RENAME COLUMN points_pos_rnk TO points_position_rank;
ALTER TABLE public.scoring_format_player_seasonlogs RENAME COLUMN points_rnk TO points_rank;

-- seasons (1 renames)
ALTER TABLE public.seasons RENAME COLUMN ext_date TO extension_deadline_at;
