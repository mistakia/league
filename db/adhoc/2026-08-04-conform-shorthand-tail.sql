-- STATUS: PENDING
--
-- Shorthand conformance: the remaining tables
--
-- Retires 153 of the 234 shorthand violations reported by
-- db/adhoc/audit-schema-conformance.mjs at ruler league 74b1366cd, in 157
-- statements. The extra four are `losses` on league_team_careerlogs,
-- league_team_seasonlogs, league_user_careerlogs and pff_team_seasonlogs:
-- NOT audit violations (six characters clears the bare-name threshold), but
-- renaming their `wins`/`ties` siblings without them would leave each of those
-- four tables naming one member of an obvious trio differently from the other
-- two. Verified as genuine counts, so the coherent end state is to rename all
-- three per table rather than to ship the split.
--
-- Expands abbreviated column names to full words. Every (table, column) here
-- was verified present in information_schema, and every proposed name verified
-- NOT already taken on its table, against production before this file was
-- authored.
--
-- Spread across 46 tables, none partitioned.
--
-- EXCLUDED: pff_team_gamelogs.wins and .ties. The map originally renamed them
-- to win_count/tie_count; verification against production showed they are
-- mutually exclusive per-game outcome FLAGS (only value 1; exactly one of
-- wins/losses/ties set per row), not counts. Ruled 2026-08-04: DROP, together
-- with the unflagged `losses` sibling, in
-- db/adhoc/2026-08-04-drop-pff-team-gamelog-outcome-flags.sql. That file is
-- owned separately and applies behind this one. Note the same three columns on
-- pff_team_seasonlogs ARE real counts (0-18) and are renamed here.
--
-- ORDERING: apply only AFTER the boolean-prefix sweep
-- (db/adhoc/2026-08-04-conform-boolean-prefix-*.sql) has landed its DDL and
-- committed its consumer sweep.
--
-- Source of truth for the mapping:
--   db/adhoc/shorthand-rename-map.json

-- config (1)
ALTER TABLE public.config RENAME COLUMN value TO config_value;

-- draft (1)
ALTER TABLE public.draft RENAME COLUMN otid TO original_team_id;

-- espn_player_win_rates_history (2)
ALTER TABLE public.espn_player_win_rates_history RENAME COLUMN plays TO total_plays;
ALTER TABLE public.espn_player_win_rates_history RENAME COLUMN wins TO line_win_count;

-- espn_player_win_rates_index (2)
ALTER TABLE public.espn_player_win_rates_index RENAME COLUMN plays TO total_plays;
ALTER TABLE public.espn_player_win_rates_index RENAME COLUMN wins TO line_win_count;

-- espn_receiving_metrics_history (1)
ALTER TABLE public.espn_receiving_metrics_history RENAME COLUMN pos TO player_position;

-- league_baselines (1)
ALTER TABLE public.league_baselines RENAME COLUMN pos TO player_position;

-- league_format_draft_pick_value (1)
ALTER TABLE public.league_format_draft_pick_value RENAME COLUMN rank TO draft_pick_rank;

-- league_formats (10)
ALTER TABLE public.league_formats RENAME COLUMN bench TO bench_slot_count;
ALTER TABLE public.league_formats RENAME COLUMN ps TO practice_squad_slot_count;
ALTER TABLE public.league_formats RENAME COLUMN sdst TO starter_slots_dst;
ALTER TABLE public.league_formats RENAME COLUMN sk TO starter_slots_k;
ALTER TABLE public.league_formats RENAME COLUMN sqb TO starter_slots_qb;
ALTER TABLE public.league_formats RENAME COLUMN srb TO starter_slots_rb;
ALTER TABLE public.league_formats RENAME COLUMN srbwr TO starter_slots_rb_wr_flex;
ALTER TABLE public.league_formats RENAME COLUMN ste TO starter_slots_te;
ALTER TABLE public.league_formats RENAME COLUMN swr TO starter_slots_wr;
ALTER TABLE public.league_formats RENAME COLUMN swrte TO starter_slots_wr_te_flex;

-- league_nfl_team_seasonlogs (1)
ALTER TABLE public.league_nfl_team_seasonlogs RENAME COLUMN rank TO points_rank;

-- league_team_careerlogs (3)
ALTER TABLE public.league_team_careerlogs RENAME COLUMN losses TO regular_season_losses;
ALTER TABLE public.league_team_careerlogs RENAME COLUMN ties TO regular_season_ties;
ALTER TABLE public.league_team_careerlogs RENAME COLUMN wins TO regular_season_wins;

-- league_team_lineup_contribution_weeks (2)
ALTER TABLE public.league_team_lineup_contribution_weeks RENAME COLUMN bp TO bench_plus_points;
ALTER TABLE public.league_team_lineup_contribution_weeks RENAME COLUMN sp TO starter_plus_points;

-- league_team_lineup_contributions (2)
ALTER TABLE public.league_team_lineup_contributions RENAME COLUMN bp TO bench_plus_points;
ALTER TABLE public.league_team_lineup_contributions RENAME COLUMN sp TO starter_plus_points;

-- league_team_lineups (1)
ALTER TABLE public.league_team_lineups RENAME COLUMN total TO optimal_total;

-- league_team_seasonlogs (3)
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN losses TO regular_season_losses;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN ties TO regular_season_ties;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN wins TO regular_season_wins;

-- league_user_careerlogs (3)
ALTER TABLE public.league_user_careerlogs RENAME COLUMN losses TO regular_season_losses;
ALTER TABLE public.league_user_careerlogs RENAME COLUMN ties TO regular_season_ties;
ALTER TABLE public.league_user_careerlogs RENAME COLUMN wins TO regular_season_wins;

-- matchups (6)
ALTER TABLE public.matchups RENAME COLUMN aid TO away_team_id;
ALTER TABLE public.matchups RENAME COLUMN ap TO away_points;
ALTER TABLE public.matchups RENAME COLUMN app TO away_potential_points;
ALTER TABLE public.matchups RENAME COLUMN hid TO home_team_id;
ALTER TABLE public.matchups RENAME COLUMN hp TO home_points;
ALTER TABLE public.matchups RENAME COLUMN hpp TO home_potential_points;

-- nfl_games (5)
ALTER TABLE public.nfl_games RENAME COLUMN clock TO game_clock;
ALTER TABLE public.nfl_games RENAME COLUMN stad TO stadium_name;
ALTER TABLE public.nfl_games RENAME COLUMN surf TO playing_surface;
ALTER TABLE public.nfl_games RENAME COLUMN temp TO temperature_fahrenheit;
ALTER TABLE public.nfl_games RENAME COLUMN wind TO wind_speed_mph;

-- nfl_team_seasonlogs (2)
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN cpoe TO completion_percentage_over_expected;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN sacks TO sacks_taken;

-- percentiles (9)
ALTER TABLE public.percentiles RENAME COLUMN max TO maximum_value;
ALTER TABLE public.percentiles RENAME COLUMN min TO minimum_value;
ALTER TABLE public.percentiles RENAME COLUMN p25 TO percentile_25;
ALTER TABLE public.percentiles RENAME COLUMN p50 TO percentile_50;
ALTER TABLE public.percentiles RENAME COLUMN p75 TO percentile_75;
ALTER TABLE public.percentiles RENAME COLUMN p90 TO percentile_90;
ALTER TABLE public.percentiles RENAME COLUMN p95 TO percentile_95;
ALTER TABLE public.percentiles RENAME COLUMN p98 TO percentile_98;
ALTER TABLE public.percentiles RENAME COLUMN p99 TO percentile_99;

-- pff_player_facet_gamelogs (5)
ALTER TABLE public.pff_player_facet_gamelogs RENAME COLUMN grade TO pff_grade;
ALTER TABLE public.pff_player_facet_gamelogs RENAME COLUMN pbe TO pass_blocking_efficiency;
ALTER TABLE public.pff_player_facet_gamelogs RENAME COLUMN snaps TO snap_count;
ALTER TABLE public.pff_player_facet_gamelogs RENAME COLUMN tds TO facet_touchdowns;
ALTER TABLE public.pff_player_facet_gamelogs RENAME COLUMN yards TO facet_yards;

-- pff_player_facet_seasonlogs (5)
ALTER TABLE public.pff_player_facet_seasonlogs RENAME COLUMN grade TO pff_grade;
ALTER TABLE public.pff_player_facet_seasonlogs RENAME COLUMN pbe TO pass_blocking_efficiency;
ALTER TABLE public.pff_player_facet_seasonlogs RENAME COLUMN snaps TO snap_count;
ALTER TABLE public.pff_player_facet_seasonlogs RENAME COLUMN tds TO facet_touchdowns;
ALTER TABLE public.pff_player_facet_seasonlogs RENAME COLUMN yards TO facet_yards;

-- pff_player_seasonlogs (3)
ALTER TABLE public.pff_player_seasonlogs RENAME COLUMN pass TO pass_grade;
ALTER TABLE public.pff_player_seasonlogs RENAME COLUMN run TO run_grade;
ALTER TABLE public.pff_player_seasonlogs RENAME COLUMN speed TO speed_rating;

-- pff_team_seasonlogs (3)
ALTER TABLE public.pff_team_seasonlogs RENAME COLUMN losses TO loss_count;
ALTER TABLE public.pff_team_seasonlogs RENAME COLUMN ties TO tie_count;
ALTER TABLE public.pff_team_seasonlogs RENAME COLUMN wins TO win_count;

-- player_adp_history (2)
ALTER TABLE public.player_adp_history RENAME COLUMN adp TO average_draft_position;
ALTER TABLE public.player_adp_history RENAME COLUMN pos TO player_position;

-- player_adp_index (2)
ALTER TABLE public.player_adp_index RENAME COLUMN adp TO average_draft_position;
ALTER TABLE public.player_adp_index RENAME COLUMN pos TO player_position;

-- player_college_careerlogs (11)
ALTER TABLE public.player_college_careerlogs RENAME COLUMN adoc TO average_depth_of_completion;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN adot TO average_depth_of_target;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN arms TO arm_length;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN bench TO bench_press;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN drops TO dropped_passes;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN games TO games_played;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN hands TO hand_size;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN hits TO quarterback_hits;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN sacks TO defensive_sacks;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN snaps TO snap_count;
ALTER TABLE public.player_college_careerlogs RENAME COLUMN td TO total_touchdowns;

-- player_college_seasonlogs (11)
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN adoc TO average_depth_of_completion;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN adot TO average_depth_of_target;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN arms TO arm_length;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN bench TO bench_press;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN drops TO dropped_passes;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN games TO games_played;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN hands TO hand_size;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN hits TO quarterback_hits;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN sacks TO defensive_sacks;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN snaps TO snap_count;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN td TO total_touchdowns;

-- player_defender_gamelogs (2)
ALTER TABLE public.player_defender_gamelogs RENAME COLUMN ints TO defensive_interceptions;
ALTER TABLE public.player_defender_gamelogs RENAME COLUMN sacks TO defensive_sacks;

-- player_dfs_ownership (1)
ALTER TABLE public.player_dfs_ownership RENAME COLUMN fpts TO fantasy_points;

-- player_passing_gamelogs (2)
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN cpoe TO completion_percentage_over_expected;
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN sacks TO passing_sacks;

-- player_rankings_history (5)
ALTER TABLE public.player_rankings_history RENAME COLUMN avg TO average_rank;
ALTER TABLE public.player_rankings_history RENAME COLUMN max TO max_rank;
ALTER TABLE public.player_rankings_history RENAME COLUMN min TO min_rank;
ALTER TABLE public.player_rankings_history RENAME COLUMN pos TO player_position;
ALTER TABLE public.player_rankings_history RENAME COLUMN std TO rank_standard_deviation;

-- player_rankings_index (5)
ALTER TABLE public.player_rankings_index RENAME COLUMN avg TO average_rank;
ALTER TABLE public.player_rankings_index RENAME COLUMN max TO max_rank;
ALTER TABLE public.player_rankings_index RENAME COLUMN min TO min_rank;
ALTER TABLE public.player_rankings_index RENAME COLUMN pos TO player_position;
ALTER TABLE public.player_rankings_index RENAME COLUMN std TO rank_standard_deviation;

-- player_seasonlogs (1)
ALTER TABLE public.player_seasonlogs RENAME COLUMN pos TO player_position;

-- position_game_outcome_defaults (1)
ALTER TABLE public.position_game_outcome_defaults RENAME COLUMN pos TO player_position;

-- practice (8)
ALTER TABLE public.practice RENAME COLUMN f TO friday_practice_status;
ALTER TABLE public.practice RENAME COLUMN inj TO injury_type;
ALTER TABLE public.practice RENAME COLUMN m TO monday_practice_status;
ALTER TABLE public.practice RENAME COLUMN s TO saturday_practice_status;
ALTER TABLE public.practice RENAME COLUMN su TO sunday_practice_status;
ALTER TABLE public.practice RENAME COLUMN th TO thursday_practice_status;
ALTER TABLE public.practice RENAME COLUMN tu TO tuesday_practice_status;
ALTER TABLE public.practice RENAME COLUMN w TO wednesday_practice_status;

-- props (3)
ALTER TABLE public.props RENAME COLUMN ln TO prop_line;
ALTER TABLE public.props RENAME COLUMN o TO over_odds_decimal;
ALTER TABLE public.props RENAME COLUMN u TO under_odds_decimal;

-- props_index (4)
ALTER TABLE public.props_index RENAME COLUMN ln TO prop_line;
ALTER TABLE public.props_index RENAME COLUMN o TO over_odds_decimal;
ALTER TABLE public.props_index RENAME COLUMN risk TO risk_amount;
ALTER TABLE public.props_index RENAME COLUMN u TO under_odds_decimal;

-- restricted_free_agency_bids (1)
ALTER TABLE public.restricted_free_agency_bids RENAME COLUMN bid TO bid_amount;

-- rosters_players (2)
ALTER TABLE public.rosters_players RENAME COLUMN pos TO player_position;
ALTER TABLE public.rosters_players RENAME COLUMN rid TO roster_id;

-- scoring_format_player_careerlogs (1)
ALTER TABLE public.scoring_format_player_careerlogs RENAME COLUMN games TO games_played;

-- scoring_format_player_projection_points (1)
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN total TO projected_points_total;

-- scoring_format_player_seasonlogs (1)
ALTER TABLE public.scoring_format_player_seasonlogs RENAME COLUMN games TO games_played;

-- seasons (14)
ALTER TABLE public.seasons RENAME COLUMN faab TO starting_faab_budget;
ALTER TABLE public.seasons RENAME COLUMN fqb TO franchise_tag_salary_qb;
ALTER TABLE public.seasons RENAME COLUMN frb TO franchise_tag_salary_rb;
ALTER TABLE public.seasons RENAME COLUMN fte TO franchise_tag_salary_te;
ALTER TABLE public.seasons RENAME COLUMN fwr TO franchise_tag_salary_wr;
ALTER TABLE public.seasons RENAME COLUMN mdst TO max_roster_dst;
ALTER TABLE public.seasons RENAME COLUMN mk TO max_roster_k;
ALTER TABLE public.seasons RENAME COLUMN mqb TO max_roster_qb;
ALTER TABLE public.seasons RENAME COLUMN mrb TO max_roster_rb;
ALTER TABLE public.seasons RENAME COLUMN mte TO max_roster_te;
ALTER TABLE public.seasons RENAME COLUMN mwr TO max_roster_wr;
ALTER TABLE public.seasons RENAME COLUMN tag2 TO franchise_tag_limit;
ALTER TABLE public.seasons RENAME COLUMN tag3 TO rookie_tag_limit;
ALTER TABLE public.seasons RENAME COLUMN tag4 TO restricted_free_agency_tag_limit;

-- teams (4)
ALTER TABLE public.teams RENAME COLUMN abbrv TO abbreviation;
ALTER TABLE public.teams RENAME COLUMN cap TO salary_cap;
ALTER TABLE public.teams RENAME COLUMN div TO division;
ALTER TABLE public.teams RENAME COLUMN faab TO faab_balance;

-- transactions (1)
ALTER TABLE public.transactions RENAME COLUMN value TO player_salary;

-- waivers (2)
ALTER TABLE public.waivers RENAME COLUMN bid TO bid_amount;
ALTER TABLE public.waivers RENAME COLUMN po TO priority_order;
