-- Create league_data_view_reader, the login role the sandboxed-SQL data-view
-- tier connects as, and close the two PUBLIC write classes that no SELECT
-- grant touches.
--
-- STATUS: APPLIED 2026-08-28 against league_production
--
-- Banner set by hand rather than by `yarn db:exec`, which owns it for every
-- other file here but could not run this one -- see WHO RUNS THIS below.
--
-- ONE THING THIS FILE COULD NOT DO. A role also needs a pg_hba.conf entry
-- before it can authenticate, and the cluster grants remote access per-role
-- rather than by a catch-all, so the first connection attempt failed with "no
-- pg_hba.conf entry" until one was added and the config reloaded. That file is
-- server configuration and is not in this repository; the entry made, and why
-- it is narrower than the one beside it, is recorded in the knowledge base with
-- the rest of the decrypt and access topology.
--
-- WHO RUNS THIS. Not `yarn db:exec`, which connects as league_writer. CREATE
-- ROLE and REVOKE ... ON DATABASE need a superuser (or the database owner for
-- the REVOKE), so this file is applied by hand on the league host:
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
--     \password league_data_view_reader
--
-- Then author the same value into config/config-production.json under
-- `postgres_data_view_sandbox` per user:guideline/homelab/sops-age-authoring.md.
--
-- WHY A SEPARATE ROLE AT ALL. league_reader is a member of pg_read_all_data, so
-- no per-table REVOKE can narrow it -- it can read `users`, `config` and every
-- table added tomorrow. This role is deliberately NOT a member of that group
-- and deliberately receives NO equivalent of the standing ALTER DEFAULT
-- PRIVILEGES grants that league_reader holds. There are TWO of those in
-- db/schema.postgres.sql, the SEQUENCES arm and the TABLES arm, and this role
-- must avoid BOTH: every future table and every future sequence is then denied
-- until someone adds a line to db/tools/generate-reader-role-grants.mjs
-- and grants it. The allowlist ratchets in the safe direction.
--
-- WHY THE THREE PUBLIC LINES BELOW. A 2026-08-28 review against the live
-- cluster confirmed that role GRANTs alone stop every confidentiality attack on
-- this path -- multi-statement injection, CTE-hidden writes, COPY ... TO
-- PROGRAM, the pg_read_file family, FOR UPDATE, non-allowlisted reads, the
-- system-administration functions -- with one exception, and it is a WRITE
-- class rather than a read. TEMP is granted to PUBLIC on league_production, and
-- lo_put / lo_from_bytea carry PUBLIC EXECUTE. temp_file_limit bounds sort
-- spill, not temp tables and not large objects, so a looping agent holding this
-- role's credential could fill the disk with nothing to stop it.
--
-- THOSE THREE LINES REACH BEYOND THIS FEATURE. They alter PUBLIC privileges on
-- league_production and therefore affect every role that is not separately
-- granted. league_writer owns the objects and holds its privileges directly, so
-- it is unaffected; verify that before applying if anything else has since been
-- given a login.
--
-- The GRANT list is generated, not hand-written, and is not a broad sweep minus
-- an exclusion list -- that method is what produced the gaps the same review
-- found (public.config, the ballot-content table, a second saved-views table,
-- and seven others). Regenerate and diff with:
--
--     node db/tools/generate-reader-role-grants.mjs --role league_data_view_reader --report
--
-- 316 relations in public at authoring time: 273 granted below, 43 excluded
-- with a stated reason in that tool.

CREATE ROLE league_data_view_reader WITH LOGIN PASSWORD NULL CONNECTION LIMIT 4;

-- CONNECTION LIMIT is server-side and cannot be raised from inside a session,
-- which is what makes it the real bound on a runaway agent. statement_timeout
-- set on a role is USERSET -- the agent can raise it on its own connection --
-- so it bounds mistakes, not loops, and is recorded here as such rather than as
-- a control. The execution path issues its own SET LOCAL statement_timeout
-- inside a READ ONLY transaction, which the agent's own connection does not get.
ALTER ROLE league_data_view_reader SET statement_timeout = '20s';

-- Fail-closed at the session level, before any explicit BEGIN. league_reader
-- carries this in rolconfig and the first draft of this role did not.
ALTER ROLE league_data_view_reader SET default_transaction_read_only = on;

-- The two PUBLIC write classes. See "THOSE THREE LINES" above.
REVOKE TEMP ON DATABASE league_production FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_put(oid, bigint, bytea) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_from_bytea(oid, bytea) FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO league_data_view_reader;

GRANT SELECT ON public.adp_format TO league_data_view_reader;
GRANT SELECT ON public.composite_market_value_blend_weights TO league_data_view_reader;
GRANT SELECT ON public.composite_market_value_calibration TO league_data_view_reader;
GRANT SELECT ON public.composite_market_value_daily TO league_data_view_reader;
GRANT SELECT ON public.dfs_contests TO league_data_view_reader;
GRANT SELECT ON public.draft TO league_data_view_reader;
GRANT SELECT ON public.draftkings_category_activity TO league_data_view_reader;
GRANT SELECT ON public.dvoa_team_drive_seasonlogs TO league_data_view_reader;
GRANT SELECT ON public.dvoa_team_gamelogs TO league_data_view_reader;
GRANT SELECT ON public.dvoa_team_seasonlogs_history TO league_data_view_reader;
GRANT SELECT ON public.dvoa_team_seasonlogs_index TO league_data_view_reader;
GRANT SELECT ON public.dvoa_team_unit_seasonlogs_history TO league_data_view_reader;
GRANT SELECT ON public.dvoa_team_unit_seasonlogs_index TO league_data_view_reader;
GRANT SELECT ON public.espn_player_win_rates_history TO league_data_view_reader;
GRANT SELECT ON public.espn_player_win_rates_index TO league_data_view_reader;
GRANT SELECT ON public.espn_receiving_metrics_history TO league_data_view_reader;
GRANT SELECT ON public.espn_team_win_rates_history TO league_data_view_reader;
GRANT SELECT ON public.espn_team_win_rates_index TO league_data_view_reader;
GRANT SELECT ON public.format_category_signal_mapping TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2009 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2010 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2011 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2012 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2013 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2014 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2015 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2016 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2017 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2018 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2019 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2020 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2021 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2022 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2023 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2024 TO league_data_view_reader;
GRANT SELECT ON public.historical_injury_index_2025 TO league_data_view_reader;
GRANT SELECT ON public.keeptradecut_liquidity TO league_data_view_reader;
GRANT SELECT ON public.keeptradecut_pick TO league_data_view_reader;
GRANT SELECT ON public.keeptradecut_valuations TO league_data_view_reader;
GRANT SELECT ON public.league_baselines TO league_data_view_reader;
GRANT SELECT ON public.league_divisions TO league_data_view_reader;
GRANT SELECT ON public.league_format_draft_pick_value TO league_data_view_reader;
GRANT SELECT ON public.league_format_player_careerlogs TO league_data_view_reader;
GRANT SELECT ON public.league_format_player_gamelogs TO league_data_view_reader;
GRANT SELECT ON public.league_format_player_projection_values TO league_data_view_reader;
GRANT SELECT ON public.league_format_player_projection_values_history TO league_data_view_reader;
GRANT SELECT ON public.league_format_player_rest_of_season_projection_values TO league_data_view_reader;
GRANT SELECT ON public.league_format_player_rest_of_season_projection_values_history TO league_data_view_reader;
GRANT SELECT ON public.league_format_player_season_projection_values TO league_data_view_reader;
GRANT SELECT ON public.league_format_player_seasonlogs TO league_data_view_reader;
GRANT SELECT ON public.league_formats TO league_data_view_reader;
GRANT SELECT ON public.league_nfl_team_seasonlogs TO league_data_view_reader;
GRANT SELECT ON public.league_pauses TO league_data_view_reader;
GRANT SELECT ON public.league_player_projection_values TO league_data_view_reader;
GRANT SELECT ON public.league_player_rest_of_season_projection_values TO league_data_view_reader;
GRANT SELECT ON public.league_player_season_projection_values TO league_data_view_reader;
GRANT SELECT ON public.league_player_seasonlogs TO league_data_view_reader;
GRANT SELECT ON public.league_scoring_formats TO league_data_view_reader;
GRANT SELECT ON public.league_season_baselines TO league_data_view_reader;
GRANT SELECT ON public.league_team_careerlogs TO league_data_view_reader;
GRANT SELECT ON public.league_team_daily_values TO league_data_view_reader;
GRANT SELECT ON public.league_team_forecast TO league_data_view_reader;
GRANT SELECT ON public.league_team_lineup_contribution_weeks TO league_data_view_reader;
GRANT SELECT ON public.league_team_lineup_contributions TO league_data_view_reader;
GRANT SELECT ON public.league_team_lineup_starters TO league_data_view_reader;
GRANT SELECT ON public.league_team_lineups TO league_data_view_reader;
GRANT SELECT ON public.league_team_player_seasonlogs TO league_data_view_reader;
GRANT SELECT ON public.league_team_seasonlogs TO league_data_view_reader;
GRANT SELECT ON public.league_user_careerlogs TO league_data_view_reader;
GRANT SELECT ON public.leagues TO league_data_view_reader;
GRANT SELECT ON public.matchups TO league_data_view_reader;
GRANT SELECT ON public.nfl_coaches TO league_data_view_reader;
GRANT SELECT ON public.nfl_draft_rankings_history TO league_data_view_reader;
GRANT SELECT ON public.nfl_draft_rankings_index TO league_data_view_reader;
GRANT SELECT ON public.nfl_game_coaches TO league_data_view_reader;
GRANT SELECT ON public.nfl_games TO league_data_view_reader;
GRANT SELECT ON public.nfl_games_changelog TO league_data_view_reader;
GRANT SELECT ON public.nfl_matchup_stats TO league_data_view_reader;
GRANT SELECT ON public.nfl_play_stats TO league_data_view_reader;
GRANT SELECT ON public.nfl_play_stats_current_week TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_current_week TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_passer TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_player TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_receiver TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_rusher TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2000 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2001 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2002 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2003 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2004 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2005 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2006 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2007 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2008 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2009 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2010 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2011 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2012 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2013 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2014 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2015 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2016 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2017 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2018 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2019 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2020 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2021 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2022 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2023 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2024 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2025 TO league_data_view_reader;
GRANT SELECT ON public.nfl_plays_year_2026 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2000 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2001 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2002 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2003 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2004 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2005 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2006 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2007 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2008 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2009 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2010 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2011 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2012 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2013 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2014 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2015 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2016 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2017 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2018 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2019 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2020 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2021 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2022 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2023 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2024 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2025 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_2026 TO league_data_view_reader;
GRANT SELECT ON public.nfl_snaps_year_default TO league_data_view_reader;
GRANT SELECT ON public.nfl_stadium TO league_data_view_reader;
GRANT SELECT ON public.nfl_team_gamelogs TO league_data_view_reader;
GRANT SELECT ON public.nfl_team_seasonlogs TO league_data_view_reader;
GRANT SELECT ON public.ngs_prospect_scores_history TO league_data_view_reader;
GRANT SELECT ON public.ngs_prospect_scores_index TO league_data_view_reader;
GRANT SELECT ON public.percentiles TO league_data_view_reader;
GRANT SELECT ON public.pff_player_facet_gamelogs TO league_data_view_reader;
GRANT SELECT ON public.pff_player_facet_seasonlogs TO league_data_view_reader;
GRANT SELECT ON public.pff_player_gamelogs TO league_data_view_reader;
GRANT SELECT ON public.pff_player_seasonlogs TO league_data_view_reader;
GRANT SELECT ON public.pff_player_seasonlogs_changelog TO league_data_view_reader;
GRANT SELECT ON public.pff_team_gamelogs TO league_data_view_reader;
GRANT SELECT ON public.pff_team_seasonlogs TO league_data_view_reader;
GRANT SELECT ON public.pff_unresolved_players TO league_data_view_reader;
GRANT SELECT ON public.play_changelog TO league_data_view_reader;
GRANT SELECT ON public.player TO league_data_view_reader;
GRANT SELECT ON public.player_adp_history TO league_data_view_reader;
GRANT SELECT ON public.player_adp_index TO league_data_view_reader;
GRANT SELECT ON public.player_aliases TO league_data_view_reader;
GRANT SELECT ON public.player_archetypes TO league_data_view_reader;
GRANT SELECT ON public.player_changelog TO league_data_view_reader;
GRANT SELECT ON public.player_college_careerlogs TO league_data_view_reader;
GRANT SELECT ON public.player_college_seasonlogs TO league_data_view_reader;
GRANT SELECT ON public.player_contracts TO league_data_view_reader;
GRANT SELECT ON public.player_defender_gamelogs TO league_data_view_reader;
GRANT SELECT ON public.player_dfs_ownership TO league_data_view_reader;
GRANT SELECT ON public.player_game_outcome_correlations TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_default TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2000 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2001 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2002 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2003 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2004 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2005 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2006 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2007 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2008 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2009 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2010 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2011 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2012 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2013 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2014 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2015 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2016 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2017 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2018 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2019 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2020 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2021 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2022 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2023 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2024 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2025 TO league_data_view_reader;
GRANT SELECT ON public.player_gamelogs_year_2026 TO league_data_view_reader;
GRANT SELECT ON public.player_pair_correlations TO league_data_view_reader;
GRANT SELECT ON public.player_passing_gamelogs TO league_data_view_reader;
GRANT SELECT ON public.player_prospect_profile TO league_data_view_reader;
GRANT SELECT ON public.player_rankings_history TO league_data_view_reader;
GRANT SELECT ON public.player_rankings_index TO league_data_view_reader;
GRANT SELECT ON public.player_receiving_gamelogs TO league_data_view_reader;
GRANT SELECT ON public.player_rushing_gamelogs TO league_data_view_reader;
GRANT SELECT ON public.player_salaries TO league_data_view_reader;
GRANT SELECT ON public.player_seasonlogs TO league_data_view_reader;
GRANT SELECT ON public.player_team_extension_state TO league_data_view_reader;
GRANT SELECT ON public.player_variance TO league_data_view_reader;
GRANT SELECT ON public.players_status TO league_data_view_reader;
GRANT SELECT ON public.playoffs TO league_data_view_reader;
GRANT SELECT ON public.poach_releases TO league_data_view_reader;
GRANT SELECT ON public.poaches TO league_data_view_reader;
GRANT SELECT ON public.position_game_outcome_defaults TO league_data_view_reader;
GRANT SELECT ON public.position_vocabulary_backfill_audit TO league_data_view_reader;
GRANT SELECT ON public.practice TO league_data_view_reader;
GRANT SELECT ON public.projections_history TO league_data_view_reader;
GRANT SELECT ON public.projections_history_default TO league_data_view_reader;
GRANT SELECT ON public.projections_history_y2020 TO league_data_view_reader;
GRANT SELECT ON public.projections_history_y2021 TO league_data_view_reader;
GRANT SELECT ON public.projections_history_y2022 TO league_data_view_reader;
GRANT SELECT ON public.projections_history_y2023 TO league_data_view_reader;
GRANT SELECT ON public.projections_history_y2024 TO league_data_view_reader;
GRANT SELECT ON public.projections_history_y2025 TO league_data_view_reader;
GRANT SELECT ON public.projections_history_y2026 TO league_data_view_reader;
GRANT SELECT ON public.projections_index TO league_data_view_reader;
GRANT SELECT ON public.projections_index_default TO league_data_view_reader;
GRANT SELECT ON public.projections_index_y2020 TO league_data_view_reader;
GRANT SELECT ON public.projections_index_y2021 TO league_data_view_reader;
GRANT SELECT ON public.projections_index_y2022 TO league_data_view_reader;
GRANT SELECT ON public.projections_index_y2023 TO league_data_view_reader;
GRANT SELECT ON public.projections_index_y2024 TO league_data_view_reader;
GRANT SELECT ON public.projections_index_y2025 TO league_data_view_reader;
GRANT SELECT ON public.projections_index_y2026 TO league_data_view_reader;
GRANT SELECT ON public.prop_market_selections_history TO league_data_view_reader;
GRANT SELECT ON public.prop_market_selections_index TO league_data_view_reader;
GRANT SELECT ON public.prop_markets_history TO league_data_view_reader;
GRANT SELECT ON public.prop_markets_index TO league_data_view_reader;
GRANT SELECT ON public.prop_pairing_props TO league_data_view_reader;
GRANT SELECT ON public.prop_pairings TO league_data_view_reader;
GRANT SELECT ON public.props TO league_data_view_reader;
GRANT SELECT ON public.props_index TO league_data_view_reader;
GRANT SELECT ON public.rest_of_season_projections TO league_data_view_reader;
GRANT SELECT ON public.restricted_free_agency_nominations TO league_data_view_reader;
GRANT SELECT ON public.restricted_free_agency_releases TO league_data_view_reader;
GRANT SELECT ON public.roster_asset_holding TO league_data_view_reader;
GRANT SELECT ON public.roster_asset_lineage_refresh_state TO league_data_view_reader;
GRANT SELECT ON public.roster_asset_transformation TO league_data_view_reader;
GRANT SELECT ON public.rosters TO league_data_view_reader;
GRANT SELECT ON public.scoring_format_player_careerlogs TO league_data_view_reader;
GRANT SELECT ON public.scoring_format_player_gamelogs TO league_data_view_reader;
GRANT SELECT ON public.scoring_format_player_projection_points TO league_data_view_reader;
GRANT SELECT ON public.scoring_format_player_rest_of_season_projection_points TO league_data_view_reader;
GRANT SELECT ON public.scoring_format_player_season_projection_points TO league_data_view_reader;
GRANT SELECT ON public.scoring_format_player_seasonlogs TO league_data_view_reader;
GRANT SELECT ON public.season_projections_history TO league_data_view_reader;
GRANT SELECT ON public.seasons TO league_data_view_reader;
GRANT SELECT ON public.selection_combination_definitions TO league_data_view_reader;
GRANT SELECT ON public.selection_combination_odds_history TO league_data_view_reader;
GRANT SELECT ON public.selection_combination_odds_index TO league_data_view_reader;
GRANT SELECT ON public.super_priority TO league_data_view_reader;
GRANT SELECT ON public.teams TO league_data_view_reader;
GRANT SELECT ON public.trade_releases TO league_data_view_reader;
GRANT SELECT ON public.trades TO league_data_view_reader;
GRANT SELECT ON public.trades_picks TO league_data_view_reader;
GRANT SELECT ON public.trades_players TO league_data_view_reader;
GRANT SELECT ON public.trades_slots TO league_data_view_reader;
GRANT SELECT ON public.trades_transactions TO league_data_view_reader;
GRANT SELECT ON public.transactions TO league_data_view_reader;
GRANT SELECT ON public.view_roster_asset_lineage_walk TO league_data_view_reader;
GRANT SELECT ON public.view_trade_asset_flow TO league_data_view_reader;
GRANT SELECT ON public.weekly_market_selections_analysis_cache TO league_data_view_reader;
