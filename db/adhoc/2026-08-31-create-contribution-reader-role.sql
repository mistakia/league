-- Create league_contribution_reader, the login role the contribution
-- reproduction substrate connects as when it re-executes a reported query
-- against production to confirm a bug.
--
-- STATUS: NOT YET APPLIED
--
-- WHO RUNS THIS. Not `yarn db:exec`, which connects as league_writer. CREATE
-- ROLE needs a superuser, so this file is applied by hand on the league host:
--
--     psql -U postgres --dbname=league_production --single-transaction \
--          --set ON_ERROR_STOP=1 -f <this file>
--
-- THE PASSWORD IS NOT IN THIS FILE AND MUST NEVER BE. This repository is
-- public. The role is created with PASSWORD NULL, which cannot authenticate;
-- set the real one in the same psql session with the interactive meta-command,
-- which prompts without echoing and never puts the value on a command line or
-- in shell history:
--
--     \password league_contribution_reader
--
-- Then author the same value into config/config-production.json under
-- `postgres_contribution_sandbox` per user:guideline/homelab/sops-age-authoring.md.
-- A pg_hba.conf entry is also required before this role can authenticate
-- remotely, exactly as it was for league_data_view_reader.
--
-- WHY NOT REUSE league_data_view_reader. Measured 2026-08-31 against the 280
-- stored data-view fixtures: all 280 fail that tier's statement guard, 227 on
-- its alias contract and 53 on relations outside its allowlist. That guard and
-- that allowlist encode the threat model of a caller that WROTE the statement.
-- The reproduction path re-executes SQL the repo's own query builder generated
-- from a captured table_state, which is a different threat model, and forcing
-- it through the other tier's contract would mean widening a user-facing
-- control for an unrelated reason.
--
-- WHY NOT league_reader. It is a member of pg_read_all_data, so no per-table
-- REVOKE can narrow it: it reads `config` (third-party API credentials and the
-- Discord webhook), every other submitter's `contribution_submissions`, and
-- every table added tomorrow. An agent acting on an ANONYMOUS bug report holds
-- this credential, which is what makes that unacceptable rather than untidy.
--
-- HOW THIS LIST DIFFERS from league_data_view_reader's: three relations, and
-- nothing else. `opening_days` and `nfl_year_week_timestamp` are materialized
-- views the registry's generated SQL joins against; `rosters_players` backs the
-- viewer-scoped roster tags. All three are excluded from the data-view tier for
-- reasons that do not apply here -- the reproduction path re-runs a query a
-- visitor already ran, so it reaches nothing that visitor could not see.
--
-- The GRANT list is generated, not hand-written. Regenerate and diff with:
--
--     node db/tools/generate-reader-role-grants.mjs --role league_contribution_reader --report
--
-- The two PUBLIC write classes (TEMP, the large-object write functions) were
-- already closed by 2026-08-28-create-data-view-reader-role.sql and are
-- deliberately not repeated here.

CREATE ROLE league_contribution_reader WITH LOGIN PASSWORD NULL CONNECTION LIMIT 2;

-- CONNECTION LIMIT is server-side and cannot be raised from inside a session,
-- which is what makes it the real bound on a runaway agent. It is set to 2
-- because that is the measured concurrency cap for reproduction workloads: a
-- single representative data-view aggregate read 3.2 GB in 18.4s on 2026-08-31.
--
-- statement_timeout set on a role is USERSET -- the agent can raise it on its
-- own connection -- so it bounds mistakes, not loops. The execution path issues
-- its own SET LOCAL statement_timeout inside a READ ONLY transaction, which the
-- agent's own connection does not get. See libs-server/sandboxed-read.mjs.
ALTER ROLE league_contribution_reader SET statement_timeout = '20s';

-- work_mem is lowered from the server's 256MB. A reproduction query can carry
-- several sort or hash nodes and up to max_parallel_workers_per_gather workers,
-- each entitled to work_mem, on a host with 16 GiB available.
ALTER ROLE league_contribution_reader SET work_mem = '64MB';

-- Fail-closed at the session level, before any explicit BEGIN. This is defence
-- in depth and NOT the control: it is defeatable from the client with
-- BEGIN READ WRITE, measured 2026-08-31 against league_reader. The control is
-- the absence of any write GRANT, plus the read-only transaction the execution
-- path opens.
ALTER ROLE league_contribution_reader SET default_transaction_read_only = on;

GRANT USAGE ON SCHEMA public TO league_contribution_reader;

GRANT SELECT ON public.adp_format TO league_contribution_reader;
GRANT SELECT ON public.composite_market_value_blend_weights TO league_contribution_reader;
GRANT SELECT ON public.composite_market_value_calibration TO league_contribution_reader;
GRANT SELECT ON public.composite_market_value_daily TO league_contribution_reader;
GRANT SELECT ON public.dfs_contests TO league_contribution_reader;
GRANT SELECT ON public.draft TO league_contribution_reader;
GRANT SELECT ON public.draftkings_category_activity TO league_contribution_reader;
GRANT SELECT ON public.dvoa_team_drive_seasonlogs TO league_contribution_reader;
GRANT SELECT ON public.dvoa_team_gamelogs TO league_contribution_reader;
GRANT SELECT ON public.dvoa_team_seasonlogs_history TO league_contribution_reader;
GRANT SELECT ON public.dvoa_team_seasonlogs_index TO league_contribution_reader;
GRANT SELECT ON public.dvoa_team_unit_seasonlogs_history TO league_contribution_reader;
GRANT SELECT ON public.dvoa_team_unit_seasonlogs_index TO league_contribution_reader;
GRANT SELECT ON public.espn_player_win_rates_history TO league_contribution_reader;
GRANT SELECT ON public.espn_player_win_rates_index TO league_contribution_reader;
GRANT SELECT ON public.espn_receiving_metrics_history TO league_contribution_reader;
GRANT SELECT ON public.espn_team_win_rates_history TO league_contribution_reader;
GRANT SELECT ON public.espn_team_win_rates_index TO league_contribution_reader;
GRANT SELECT ON public.format_category_signal_mapping TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2009 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2010 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2011 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2012 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2013 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2014 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2015 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2016 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2017 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2018 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2019 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2020 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2021 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2022 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2023 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2024 TO league_contribution_reader;
GRANT SELECT ON public.historical_injury_index_2025 TO league_contribution_reader;
GRANT SELECT ON public.keeptradecut_liquidity TO league_contribution_reader;
GRANT SELECT ON public.keeptradecut_pick TO league_contribution_reader;
GRANT SELECT ON public.keeptradecut_valuations TO league_contribution_reader;
GRANT SELECT ON public.league_baselines TO league_contribution_reader;
GRANT SELECT ON public.league_divisions TO league_contribution_reader;
GRANT SELECT ON public.league_format_draft_pick_value TO league_contribution_reader;
GRANT SELECT ON public.league_format_player_careerlogs TO league_contribution_reader;
GRANT SELECT ON public.league_format_player_gamelogs TO league_contribution_reader;
GRANT SELECT ON public.league_format_player_projection_values TO league_contribution_reader;
GRANT SELECT ON public.league_format_player_projection_values_history TO league_contribution_reader;
GRANT SELECT ON public.league_format_player_rest_of_season_projection_values TO league_contribution_reader;
GRANT SELECT ON public.league_format_player_rest_of_season_projection_values_history TO league_contribution_reader;
GRANT SELECT ON public.league_format_player_season_projection_values TO league_contribution_reader;
GRANT SELECT ON public.league_format_player_seasonlogs TO league_contribution_reader;
GRANT SELECT ON public.league_formats TO league_contribution_reader;
GRANT SELECT ON public.league_nfl_team_seasonlogs TO league_contribution_reader;
GRANT SELECT ON public.league_pauses TO league_contribution_reader;
GRANT SELECT ON public.league_player_projection_values TO league_contribution_reader;
GRANT SELECT ON public.league_player_rest_of_season_projection_values TO league_contribution_reader;
GRANT SELECT ON public.league_player_season_projection_values TO league_contribution_reader;
GRANT SELECT ON public.league_player_seasonlogs TO league_contribution_reader;
GRANT SELECT ON public.league_scoring_formats TO league_contribution_reader;
GRANT SELECT ON public.league_season_baselines TO league_contribution_reader;
GRANT SELECT ON public.league_team_careerlogs TO league_contribution_reader;
GRANT SELECT ON public.league_team_daily_values TO league_contribution_reader;
GRANT SELECT ON public.league_team_forecast TO league_contribution_reader;
GRANT SELECT ON public.league_team_lineup_contribution_weeks TO league_contribution_reader;
GRANT SELECT ON public.league_team_lineup_contributions TO league_contribution_reader;
GRANT SELECT ON public.league_team_lineup_starters TO league_contribution_reader;
GRANT SELECT ON public.league_team_lineups TO league_contribution_reader;
GRANT SELECT ON public.league_team_player_seasonlogs TO league_contribution_reader;
GRANT SELECT ON public.league_team_seasonlogs TO league_contribution_reader;
GRANT SELECT ON public.league_user_careerlogs TO league_contribution_reader;
GRANT SELECT ON public.leagues TO league_contribution_reader;
GRANT SELECT ON public.matchups TO league_contribution_reader;
GRANT SELECT ON public.nfl_coaches TO league_contribution_reader;
GRANT SELECT ON public.nfl_draft_rankings_history TO league_contribution_reader;
GRANT SELECT ON public.nfl_draft_rankings_index TO league_contribution_reader;
GRANT SELECT ON public.nfl_game_coaches TO league_contribution_reader;
GRANT SELECT ON public.nfl_games TO league_contribution_reader;
GRANT SELECT ON public.nfl_games_changelog TO league_contribution_reader;
GRANT SELECT ON public.nfl_matchup_stats TO league_contribution_reader;
GRANT SELECT ON public.nfl_play_stats TO league_contribution_reader;
GRANT SELECT ON public.nfl_play_stats_current_week TO league_contribution_reader;
GRANT SELECT ON public.nfl_player_play_charting TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_current_week TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_passer TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_player TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_receiver TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_rusher TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2000 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2001 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2002 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2003 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2004 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2005 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2006 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2007 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2008 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2009 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2010 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2011 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2012 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2013 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2014 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2015 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2016 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2017 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2018 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2019 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2020 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2021 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2022 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2023 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2024 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2025 TO league_contribution_reader;
GRANT SELECT ON public.nfl_plays_year_2026 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2000 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2001 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2002 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2003 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2004 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2005 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2006 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2007 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2008 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2009 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2010 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2011 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2012 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2013 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2014 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2015 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2016 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2017 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2018 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2019 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2020 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2021 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2022 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2023 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2024 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2025 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_2026 TO league_contribution_reader;
GRANT SELECT ON public.nfl_snaps_year_default TO league_contribution_reader;
GRANT SELECT ON public.nfl_stadium TO league_contribution_reader;
GRANT SELECT ON public.nfl_team_gamelogs TO league_contribution_reader;
GRANT SELECT ON public.nfl_team_seasonlogs TO league_contribution_reader;
GRANT SELECT ON public.nfl_year_week_timestamp TO league_contribution_reader;
GRANT SELECT ON public.ngs_prospect_scores_history TO league_contribution_reader;
GRANT SELECT ON public.ngs_prospect_scores_index TO league_contribution_reader;
GRANT SELECT ON public.opening_days TO league_contribution_reader;
GRANT SELECT ON public.percentiles TO league_contribution_reader;
GRANT SELECT ON public.pff_player_facet_gamelogs TO league_contribution_reader;
GRANT SELECT ON public.pff_player_facet_seasonlogs TO league_contribution_reader;
GRANT SELECT ON public.pff_player_gamelogs TO league_contribution_reader;
GRANT SELECT ON public.pff_player_seasonlogs TO league_contribution_reader;
GRANT SELECT ON public.pff_player_seasonlogs_changelog TO league_contribution_reader;
GRANT SELECT ON public.pff_team_gamelogs TO league_contribution_reader;
GRANT SELECT ON public.pff_team_seasonlogs TO league_contribution_reader;
GRANT SELECT ON public.pff_unresolved_players TO league_contribution_reader;
GRANT SELECT ON public.play_changelog TO league_contribution_reader;
GRANT SELECT ON public.player TO league_contribution_reader;
GRANT SELECT ON public.player_adp_history TO league_contribution_reader;
GRANT SELECT ON public.player_adp_index TO league_contribution_reader;
GRANT SELECT ON public.player_aliases TO league_contribution_reader;
GRANT SELECT ON public.player_archetypes TO league_contribution_reader;
GRANT SELECT ON public.player_changelog TO league_contribution_reader;
GRANT SELECT ON public.player_college_careerlogs TO league_contribution_reader;
GRANT SELECT ON public.player_college_seasonlogs TO league_contribution_reader;
GRANT SELECT ON public.player_contracts TO league_contribution_reader;
GRANT SELECT ON public.player_defender_gamelogs TO league_contribution_reader;
GRANT SELECT ON public.player_dfs_ownership TO league_contribution_reader;
GRANT SELECT ON public.player_game_outcome_correlations TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_default TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2000 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2001 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2002 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2003 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2004 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2005 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2006 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2007 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2008 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2009 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2010 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2011 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2012 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2013 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2014 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2015 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2016 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2017 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2018 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2019 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2020 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2021 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2022 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2023 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2024 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2025 TO league_contribution_reader;
GRANT SELECT ON public.player_gamelogs_year_2026 TO league_contribution_reader;
GRANT SELECT ON public.player_pair_correlations TO league_contribution_reader;
GRANT SELECT ON public.player_passing_gamelogs TO league_contribution_reader;
GRANT SELECT ON public.player_prospect_profile TO league_contribution_reader;
GRANT SELECT ON public.player_rankings_history TO league_contribution_reader;
GRANT SELECT ON public.player_rankings_index TO league_contribution_reader;
GRANT SELECT ON public.player_receiving_gamelogs TO league_contribution_reader;
GRANT SELECT ON public.player_rushing_gamelogs TO league_contribution_reader;
GRANT SELECT ON public.player_salaries TO league_contribution_reader;
GRANT SELECT ON public.player_seasonlogs TO league_contribution_reader;
GRANT SELECT ON public.player_team_extension_state TO league_contribution_reader;
GRANT SELECT ON public.player_variance TO league_contribution_reader;
GRANT SELECT ON public.players_status TO league_contribution_reader;
GRANT SELECT ON public.playoffs TO league_contribution_reader;
GRANT SELECT ON public.poach_releases TO league_contribution_reader;
GRANT SELECT ON public.poaches TO league_contribution_reader;
GRANT SELECT ON public.position_game_outcome_defaults TO league_contribution_reader;
GRANT SELECT ON public.position_vocabulary_backfill_audit TO league_contribution_reader;
GRANT SELECT ON public.practice TO league_contribution_reader;
GRANT SELECT ON public.projections_history TO league_contribution_reader;
GRANT SELECT ON public.projections_history_default TO league_contribution_reader;
GRANT SELECT ON public.projections_history_y2020 TO league_contribution_reader;
GRANT SELECT ON public.projections_history_y2021 TO league_contribution_reader;
GRANT SELECT ON public.projections_history_y2022 TO league_contribution_reader;
GRANT SELECT ON public.projections_history_y2023 TO league_contribution_reader;
GRANT SELECT ON public.projections_history_y2024 TO league_contribution_reader;
GRANT SELECT ON public.projections_history_y2025 TO league_contribution_reader;
GRANT SELECT ON public.projections_history_y2026 TO league_contribution_reader;
GRANT SELECT ON public.projections_index TO league_contribution_reader;
GRANT SELECT ON public.projections_index_default TO league_contribution_reader;
GRANT SELECT ON public.projections_index_y2020 TO league_contribution_reader;
GRANT SELECT ON public.projections_index_y2021 TO league_contribution_reader;
GRANT SELECT ON public.projections_index_y2022 TO league_contribution_reader;
GRANT SELECT ON public.projections_index_y2023 TO league_contribution_reader;
GRANT SELECT ON public.projections_index_y2024 TO league_contribution_reader;
GRANT SELECT ON public.projections_index_y2025 TO league_contribution_reader;
GRANT SELECT ON public.projections_index_y2026 TO league_contribution_reader;
GRANT SELECT ON public.prop_market_selections_history TO league_contribution_reader;
GRANT SELECT ON public.prop_market_selections_index TO league_contribution_reader;
GRANT SELECT ON public.prop_markets_history TO league_contribution_reader;
GRANT SELECT ON public.prop_markets_index TO league_contribution_reader;
GRANT SELECT ON public.prop_pairing_props TO league_contribution_reader;
GRANT SELECT ON public.prop_pairings TO league_contribution_reader;
GRANT SELECT ON public.props TO league_contribution_reader;
GRANT SELECT ON public.props_index TO league_contribution_reader;
GRANT SELECT ON public.rest_of_season_projections TO league_contribution_reader;
GRANT SELECT ON public.restricted_free_agency_nominations TO league_contribution_reader;
GRANT SELECT ON public.restricted_free_agency_releases TO league_contribution_reader;
GRANT SELECT ON public.roster_asset_holding TO league_contribution_reader;
GRANT SELECT ON public.roster_asset_lineage_refresh_state TO league_contribution_reader;
GRANT SELECT ON public.roster_asset_transformation TO league_contribution_reader;
GRANT SELECT ON public.rosters TO league_contribution_reader;
GRANT SELECT ON public.rosters_players TO league_contribution_reader;
GRANT SELECT ON public.scoring_format_player_careerlogs TO league_contribution_reader;
GRANT SELECT ON public.scoring_format_player_gamelogs TO league_contribution_reader;
GRANT SELECT ON public.scoring_format_player_projection_points TO league_contribution_reader;
GRANT SELECT ON public.scoring_format_player_rest_of_season_projection_points TO league_contribution_reader;
GRANT SELECT ON public.scoring_format_player_season_projection_points TO league_contribution_reader;
GRANT SELECT ON public.scoring_format_player_seasonlogs TO league_contribution_reader;
GRANT SELECT ON public.season_projections_history TO league_contribution_reader;
GRANT SELECT ON public.season_projections_index TO league_contribution_reader;
GRANT SELECT ON public.seasons TO league_contribution_reader;
GRANT SELECT ON public.selection_combination_definitions TO league_contribution_reader;
GRANT SELECT ON public.selection_combination_odds_history TO league_contribution_reader;
GRANT SELECT ON public.selection_combination_odds_index TO league_contribution_reader;
GRANT SELECT ON public.super_priority TO league_contribution_reader;
GRANT SELECT ON public.teams TO league_contribution_reader;
GRANT SELECT ON public.trade_releases TO league_contribution_reader;
GRANT SELECT ON public.trades TO league_contribution_reader;
GRANT SELECT ON public.trades_picks TO league_contribution_reader;
GRANT SELECT ON public.trades_players TO league_contribution_reader;
GRANT SELECT ON public.trades_slots TO league_contribution_reader;
GRANT SELECT ON public.trades_transactions TO league_contribution_reader;
GRANT SELECT ON public.transactions TO league_contribution_reader;
GRANT SELECT ON public.view_roster_asset_lineage_walk TO league_contribution_reader;
GRANT SELECT ON public.view_trade_asset_flow TO league_contribution_reader;
GRANT SELECT ON public.weekly_market_selections_analysis_cache TO league_contribution_reader;
