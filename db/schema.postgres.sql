--
-- PostgreSQL database dump
--

-- Dumped from database version 16.3 (Ubuntu 16.3-1.pgdg20.04+1)
-- Dumped by pg_dump version 16.3 (Ubuntu 16.3-1.pgdg20.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
SET search_path TO public;

DROP INDEX IF EXISTS idx_23727_lid;
DROP INDEX IF EXISTS idx_23723_waiverid_pid;
DROP INDEX IF EXISTS idx_23723_waiverid;
DROP INDEX IF EXISTS idx_23717_userid;
DROP INDEX IF EXISTS idx_23714_userid;
DROP INDEX IF EXISTS idx_23714_sourceid;
DROP INDEX IF EXISTS idx_23703_email;
DROP INDEX IF EXISTS idx_23694_table_view;
DROP INDEX IF EXISTS idx_23690_transitionid;
DROP INDEX IF EXISTS idx_23690_pid;
DROP INDEX IF EXISTS idx_23684_lid;
DROP INDEX IF EXISTS idx_23679_uid;
DROP INDEX IF EXISTS idx_23679_teamid;
DROP INDEX IF EXISTS idx_23679_pid;
DROP INDEX IF EXISTS idx_23679_lid;
DROP INDEX IF EXISTS idx_23675_transaction;
DROP INDEX IF EXISTS idx_23672_tradeid;
DROP INDEX IF EXISTS idx_23672_pid;
DROP INDEX IF EXISTS idx_23669_tradeid;
DROP INDEX IF EXISTS idx_23669_pick;
DROP INDEX IF EXISTS idx_23665_uid;
DROP INDEX IF EXISTS idx_23661_tradeid;
DROP INDEX IF EXISTS idx_23661_pid;
DROP INDEX IF EXISTS idx_23651_team_year;
DROP INDEX IF EXISTS idx_23651_lid;
DROP INDEX IF EXISTS idx_23605_team;
DROP INDEX IF EXISTS idx_23588_season;
DROP INDEX IF EXISTS idx_23585_player_league_points;
DROP INDEX IF EXISTS idx_23585_pid;
DROP INDEX IF EXISTS idx_23580_gid;
DROP INDEX IF EXISTS idx_23575_rid;
DROP INDEX IF EXISTS idx_23575_player_team;
DROP INDEX IF EXISTS idx_23575_pid;
DROP INDEX IF EXISTS idx_23571_tid;
DROP INDEX IF EXISTS idx_23571_teamid;
DROP INDEX IF EXISTS idx_23566_sourceid;
DROP INDEX IF EXISTS idx_23566_pid;
DROP INDEX IF EXISTS idx_23563_ranking;
DROP INDEX IF EXISTS idx_23557_prop;
DROP INDEX IF EXISTS idx_23557_hits_soft;
DROP INDEX IF EXISTS idx_23550_prop;
DROP INDEX IF EXISTS idx_23550_hits_soft;
DROP INDEX IF EXISTS idx_23546_prop;
DROP INDEX IF EXISTS idx_23543_week;
DROP INDEX IF EXISTS idx_23543_total_games;
DROP INDEX IF EXISTS idx_23543_team;
DROP INDEX IF EXISTS idx_23543_source_id;
DROP INDEX IF EXISTS idx_23543_size;
DROP INDEX IF EXISTS idx_23543_risk_total;
DROP INDEX IF EXISTS idx_23543_opp_allow_rate;
DROP INDEX IF EXISTS idx_23543_market_prob;
DROP INDEX IF EXISTS idx_23543_lowest_payout;
DROP INDEX IF EXISTS idx_23543_joint_hist_rate;
DROP INDEX IF EXISTS idx_23543_hist_rate_soft;
DROP INDEX IF EXISTS idx_23543_hist_edge_soft;
DROP INDEX IF EXISTS idx_23543_highest_payout;
DROP INDEX IF EXISTS idx_23540_pairing_prop;
DROP INDEX IF EXISTS idx_23535_market;
DROP INDEX IF EXISTS idx_23530_market;
DROP INDEX IF EXISTS idx_23525_market;
DROP INDEX IF EXISTS idx_23520_market_selection;
DROP INDEX IF EXISTS idx_23514_projection;
DROP INDEX IF EXISTS idx_23514_pid;
DROP INDEX IF EXISTS idx_23508_projection;
DROP INDEX IF EXISTS idx_23508_pid;
DROP INDEX IF EXISTS idx_23502_projection;
DROP INDEX IF EXISTS idx_23502_pid;
DROP INDEX IF EXISTS idx_23499_pid;
DROP INDEX IF EXISTS idx_23493_lid;
DROP INDEX IF EXISTS idx_23489_poachid;
DROP INDEX IF EXISTS idx_23489_pid;
DROP INDEX IF EXISTS idx_23486_tid;
DROP INDEX IF EXISTS idx_23486_lid;
DROP INDEX IF EXISTS idx_23481_status;
DROP INDEX IF EXISTS idx_23481_pid;
DROP INDEX IF EXISTS idx_23478_pid;
DROP INDEX IF EXISTS idx_23431_pid;
DROP INDEX IF EXISTS idx_23390_pid;
DROP INDEX IF EXISTS idx_23390_idx_player_gamelogs_esbid_tm_pid;
DROP INDEX IF EXISTS idx_23380_alias;
DROP INDEX IF EXISTS idx_23374_yahoo_id;
DROP INDEX IF EXISTS idx_23374_sportradar_id;
DROP INDEX IF EXISTS idx_23374_sleeper_id;
DROP INDEX IF EXISTS idx_23374_rotoworld_id;
DROP INDEX IF EXISTS idx_23374_rotowire_id;
DROP INDEX IF EXISTS idx_23374_pid;
DROP INDEX IF EXISTS idx_23374_pfr_id;
DROP INDEX IF EXISTS idx_23374_name;
DROP INDEX IF EXISTS idx_23374_lname;
DROP INDEX IF EXISTS idx_23374_keeptradecut_id;
DROP INDEX IF EXISTS idx_23374_gsispid;
DROP INDEX IF EXISTS idx_23374_gsisid;
DROP INDEX IF EXISTS "idx_23374_gsisItId";
DROP INDEX IF EXISTS idx_23374_fname;
DROP INDEX IF EXISTS idx_23374_fantasy_data_id;
DROP INDEX IF EXISTS idx_23374_espn_id;
DROP INDEX IF EXISTS idx_23374_esbid;
DROP INDEX IF EXISTS idx_23369_play;
DROP INDEX IF EXISTS idx_23361_wager;
DROP INDEX IF EXISTS idx_23361_userid;
DROP INDEX IF EXISTS idx_23361_placed_at;
DROP INDEX IF EXISTS idx_23357_percentile_key;
DROP INDEX IF EXISTS idx_23317_stat;
DROP INDEX IF EXISTS idx_23314_snap;
DROP INDEX IF EXISTS "idx_23314_playId";
DROP INDEX IF EXISTS idx_23311_snap;
DROP INDEX IF EXISTS "idx_23311_playId";
DROP INDEX IF EXISTS "idx_23306_playId";
DROP INDEX IF EXISTS "idx_23306_gamePlay";
DROP INDEX IF EXISTS idx_23306_esbid;
DROP INDEX IF EXISTS idx_23301_trg_pid;
DROP INDEX IF EXISTS idx_23301_psr_pid;
DROP INDEX IF EXISTS "idx_23301_playId";
DROP INDEX IF EXISTS idx_23301_idx_seas_type;
DROP INDEX IF EXISTS idx_23301_idx_play_type;
DROP INDEX IF EXISTS idx_23301_idx_off;
DROP INDEX IF EXISTS idx_23301_idx_nfl_plays_year_esbid;
DROP INDEX IF EXISTS idx_23301_idx_nfl_plays_target;
DROP INDEX IF EXISTS "idx_23301_gamePlay";
DROP INDEX IF EXISTS idx_23301_esbid;
DROP INDEX IF EXISTS idx_23301_bc_pid;
DROP INDEX IF EXISTS idx_23298_play_stat;
DROP INDEX IF EXISTS "idx_23298_playId";
DROP INDEX IF EXISTS idx_23295_play_stat;
DROP INDEX IF EXISTS "idx_23295_playId";
DROP INDEX IF EXISTS idx_23283_game;
DROP INDEX IF EXISTS idx_23283_esbid;
DROP INDEX IF EXISTS idx_23275_lid;
DROP INDEX IF EXISTS idx_23275_aid;
DROP INDEX IF EXISTS idx_23269_uid;
DROP INDEX IF EXISTS idx_23269_commishid;
DROP INDEX IF EXISTS idx_23265_lineup;
DROP INDEX IF EXISTS idx_23262_starter;
DROP INDEX IF EXISTS idx_23259_contribution;
DROP INDEX IF EXISTS idx_23256_contribution;
DROP INDEX IF EXISTS idx_23253_team_forecast_day;
DROP INDEX IF EXISTS idx_23250_league_team;
DROP INDEX IF EXISTS idx_23247_scoring_format_hash;
DROP INDEX IF EXISTS idx_23244_pid;
DROP INDEX IF EXISTS idx_23241_player_value;
DROP INDEX IF EXISTS idx_23241_pid;
DROP INDEX IF EXISTS idx_23238_league_stat;
DROP INDEX IF EXISTS idx_23223_league_format_hash;
DROP INDEX IF EXISTS idx_23220_pid;
DROP INDEX IF EXISTS idx_23217_player_value;
DROP INDEX IF EXISTS idx_23217_pid;
DROP INDEX IF EXISTS idx_23214_pid;
DROP INDEX IF EXISTS idx_23211_pid;
DROP INDEX IF EXISTS idx_23208_pick;
DROP INDEX IF EXISTS idx_23205_tid_pid;
DROP INDEX IF EXISTS idx_23205_teamid;
DROP INDEX IF EXISTS idx_23205_pid;
DROP INDEX IF EXISTS idx_23202_baseline;
DROP INDEX IF EXISTS idx_23199_player_value;
DROP INDEX IF EXISTS idx_23189_team;
DROP INDEX IF EXISTS idx_23184_tid;
DROP INDEX IF EXISTS idx_23184_pick;
DROP INDEX IF EXISTS idx_23184_lid;
ALTER TABLE IF EXISTS ONLY waivers DROP CONSTRAINT IF EXISTS "idx_23727_PRIMARY";
ALTER TABLE IF EXISTS ONLY users DROP CONSTRAINT IF EXISTS "idx_23703_PRIMARY";
ALTER TABLE IF EXISTS ONLY user_table_views DROP CONSTRAINT IF EXISTS "idx_23694_PRIMARY";
ALTER TABLE IF EXISTS ONLY transition_bids DROP CONSTRAINT IF EXISTS "idx_23684_PRIMARY";
ALTER TABLE IF EXISTS ONLY sources DROP CONSTRAINT IF EXISTS "idx_23599_PRIMARY";
ALTER TABLE IF EXISTS ONLY rosters DROP CONSTRAINT IF EXISTS "idx_23571_PRIMARY";
ALTER TABLE IF EXISTS ONLY props_index_new DROP CONSTRAINT IF EXISTS "idx_23557_PRIMARY";
ALTER TABLE IF EXISTS ONLY props_index DROP CONSTRAINT IF EXISTS "idx_23550_PRIMARY";
ALTER TABLE IF EXISTS ONLY prop_pairings DROP CONSTRAINT IF EXISTS "idx_23543_PRIMARY";
ALTER TABLE IF EXISTS ONLY poaches DROP CONSTRAINT IF EXISTS "idx_23493_PRIMARY";
ALTER TABLE IF EXISTS ONLY player_changelog DROP CONSTRAINT IF EXISTS "idx_23384_PRIMARY";
ALTER TABLE IF EXISTS ONLY placed_wagers DROP CONSTRAINT IF EXISTS "idx_23361_PRIMARY";
ALTER TABLE IF EXISTS ONLY matchups DROP CONSTRAINT IF EXISTS "idx_23275_PRIMARY";
ALTER TABLE IF EXISTS ONLY league_migrations_lock DROP CONSTRAINT IF EXISTS "idx_23234_PRIMARY";
ALTER TABLE IF EXISTS ONLY league_migrations DROP CONSTRAINT IF EXISTS "idx_23228_PRIMARY";
ALTER TABLE IF EXISTS ONLY draft DROP CONSTRAINT IF EXISTS "idx_23184_PRIMARY";
ALTER TABLE IF EXISTS waivers ALTER COLUMN uid DROP DEFAULT;
ALTER TABLE IF EXISTS users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS user_table_views ALTER COLUMN view_id DROP DEFAULT;
ALTER TABLE IF EXISTS transition_bids ALTER COLUMN uid DROP DEFAULT;
ALTER TABLE IF EXISTS transactions ALTER COLUMN uid DROP DEFAULT;
ALTER TABLE IF EXISTS trades ALTER COLUMN uid DROP DEFAULT;
ALTER TABLE IF EXISTS teams ALTER COLUMN uid DROP DEFAULT;
ALTER TABLE IF EXISTS sources ALTER COLUMN uid DROP DEFAULT;
ALTER TABLE IF EXISTS rosters ALTER COLUMN uid DROP DEFAULT;
ALTER TABLE IF EXISTS props_index_new ALTER COLUMN prop_id DROP DEFAULT;
ALTER TABLE IF EXISTS props_index ALTER COLUMN prop_id DROP DEFAULT;
ALTER TABLE IF EXISTS poaches ALTER COLUMN uid DROP DEFAULT;
ALTER TABLE IF EXISTS player_changelog ALTER COLUMN uid DROP DEFAULT;
ALTER TABLE IF EXISTS placed_wagers ALTER COLUMN wager_id DROP DEFAULT;
ALTER TABLE IF EXISTS matchups ALTER COLUMN uid DROP DEFAULT;
ALTER TABLE IF EXISTS leagues ALTER COLUMN uid DROP DEFAULT;
ALTER TABLE IF EXISTS league_migrations_lock ALTER COLUMN index DROP DEFAULT;
ALTER TABLE IF EXISTS league_migrations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS jobs ALTER COLUMN uid DROP DEFAULT;
ALTER TABLE IF EXISTS draft ALTER COLUMN uid DROP DEFAULT;
DROP SEQUENCE IF EXISTS waivers_uid_seq;
DROP TABLE IF EXISTS waivers;
DROP TABLE IF EXISTS waiver_releases;
DROP TABLE IF EXISTS users_teams;
DROP TABLE IF EXISTS users_sources;
DROP SEQUENCE IF EXISTS users_id_seq;
DROP TABLE IF EXISTS users;
DROP SEQUENCE IF EXISTS user_table_views_view_id_seq;
DROP TABLE IF EXISTS user_table_views;
DROP TABLE IF EXISTS transition_releases;
DROP SEQUENCE IF EXISTS transition_bids_uid_seq;
DROP TABLE IF EXISTS transition_bids;
DROP SEQUENCE IF EXISTS transactions_uid_seq;
DROP TABLE IF EXISTS transactions;
DROP SEQUENCE IF EXISTS trades_uid_seq;
DROP TABLE IF EXISTS trades_transactions;
DROP TABLE IF EXISTS trades_players;
DROP TABLE IF EXISTS trades_picks;
DROP TABLE IF EXISTS trades;
DROP TABLE IF EXISTS trade_releases;
DROP SEQUENCE IF EXISTS teams_uid_seq;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS team_stats;
DROP SEQUENCE IF EXISTS sources_uid_seq;
DROP TABLE IF EXISTS sources;
DROP TABLE IF EXISTS seasons;
DROP TABLE IF EXISTS scoring_format_player_projection_points;
DROP TABLE IF EXISTS schedule;
DROP SEQUENCE IF EXISTS rosters_uid_seq;
DROP TABLE IF EXISTS rosters_players;
DROP TABLE IF EXISTS rosters;
DROP TABLE IF EXISTS ros_projections;
DROP TABLE IF EXISTS rankings;
DROP SEQUENCE IF EXISTS props_index_prop_id_seq;
DROP SEQUENCE IF EXISTS props_index_new_prop_id_seq;
DROP TABLE IF EXISTS props_index_new;
DROP TABLE IF EXISTS props_index;
DROP TABLE IF EXISTS props;
DROP TABLE IF EXISTS prop_pairings;
DROP TABLE IF EXISTS prop_pairing_props;
DROP TABLE IF EXISTS prop_markets_index;
DROP TABLE IF EXISTS prop_markets_history;
DROP TABLE IF EXISTS prop_market_selections_index;
DROP TABLE IF EXISTS prop_market_selections_history;
DROP TABLE IF EXISTS projections_index;
DROP TABLE IF EXISTS projections_archive;
DROP TABLE IF EXISTS projections;
DROP TABLE IF EXISTS practice;
DROP SEQUENCE IF EXISTS poaches_uid_seq;
DROP TABLE IF EXISTS poaches;
DROP TABLE IF EXISTS poach_releases;
DROP TABLE IF EXISTS playoffs;
DROP TABLE IF EXISTS players_status;
DROP TABLE IF EXISTS player_snaps_game;
DROP TABLE IF EXISTS player_seasonlogs;
DROP TABLE IF EXISTS player_gamelogs;
DROP SEQUENCE IF EXISTS player_changelog_uid_seq;
DROP TABLE IF EXISTS player_changelog;
DROP TABLE IF EXISTS player_aliases;
DROP TABLE IF EXISTS player;
DROP TABLE IF EXISTS play_changelog;
DROP SEQUENCE IF EXISTS placed_wagers_wager_id_seq;
DROP TABLE IF EXISTS placed_wagers;
DROP TABLE IF EXISTS percentiles;
DROP TABLE IF EXISTS nfl_team_seasonlogs;
DROP TABLE IF EXISTS nfl_snaps_current_week;
DROP TABLE IF EXISTS nfl_snaps;
DROP TABLE IF EXISTS nfl_plays_current_week;
DROP TABLE IF EXISTS nfl_plays;
DROP TABLE IF EXISTS nfl_play_stats_current_week;
DROP TABLE IF EXISTS nfl_play_stats;
DROP TABLE IF EXISTS nfl_games_changelog;
DROP TABLE IF EXISTS nfl_games;
DROP SEQUENCE IF EXISTS matchups_uid_seq;
DROP TABLE IF EXISTS matchups;
DROP SEQUENCE IF EXISTS leagues_uid_seq;
DROP TABLE IF EXISTS leagues;
DROP TABLE IF EXISTS league_team_lineups;
DROP TABLE IF EXISTS league_team_lineup_starters;
DROP TABLE IF EXISTS league_team_lineup_contributions;
DROP TABLE IF EXISTS league_team_lineup_contribution_weeks;
DROP TABLE IF EXISTS league_team_forecast;
DROP TABLE IF EXISTS league_team_daily_values;
DROP TABLE IF EXISTS league_scoring_formats;
DROP TABLE IF EXISTS league_player_seasonlogs;
DROP TABLE IF EXISTS league_player_projection_values;
DROP TABLE IF EXISTS league_nfl_team_seasonlogs;
DROP SEQUENCE IF EXISTS league_migrations_lock_index_seq;
DROP TABLE IF EXISTS league_migrations_lock;
DROP SEQUENCE IF EXISTS league_migrations_id_seq;
DROP TABLE IF EXISTS league_migrations;
DROP TABLE IF EXISTS league_formats;
DROP TABLE IF EXISTS league_format_player_seasonlogs;
DROP TABLE IF EXISTS league_format_player_projection_values;
DROP TABLE IF EXISTS league_format_player_gamelogs;
DROP TABLE IF EXISTS league_format_player_careerlogs;
DROP TABLE IF EXISTS league_format_draft_pick_value;
DROP TABLE IF EXISTS league_cutlist;
DROP TABLE IF EXISTS league_baselines;
DROP TABLE IF EXISTS keeptradecut_rankings;
DROP SEQUENCE IF EXISTS jobs_uid_seq;
DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS footballoutsiders;
DROP SEQUENCE IF EXISTS draft_uid_seq;
DROP TABLE IF EXISTS draft;
DROP TYPE IF EXISTS props_index_time_type;
DROP TYPE IF EXISTS props_index_source_id;
DROP TYPE IF EXISTS prop_pairings_source_id;
DROP TYPE IF EXISTS prop_markets_index_time_type;
DROP TYPE IF EXISTS prop_markets_index_source_id;
DROP TYPE IF EXISTS prop_markets_history_source_id;
DROP TYPE IF EXISTS prop_market_selections_index_time_type;
DROP TYPE IF EXISTS prop_market_selections_index_source_id;
DROP TYPE IF EXISTS prop_market_selections_index_result;
DROP TYPE IF EXISTS prop_market_selections_history_source_id;
DROP TYPE IF EXISTS placed_wagers_wager_type;
DROP TYPE IF EXISTS placed_wagers_wager_status;
DROP TYPE IF EXISTS placed_wagers_selection_9_status;
DROP TYPE IF EXISTS placed_wagers_selection_8_status;
DROP TYPE IF EXISTS placed_wagers_selection_7_status;
DROP TYPE IF EXISTS placed_wagers_selection_6_status;
DROP TYPE IF EXISTS placed_wagers_selection_5_status;
DROP TYPE IF EXISTS placed_wagers_selection_4_status;
DROP TYPE IF EXISTS placed_wagers_selection_3_status;
DROP TYPE IF EXISTS placed_wagers_selection_2_status;
DROP TYPE IF EXISTS placed_wagers_selection_1_status;
DROP TYPE IF EXISTS placed_wagers_selection_12_status;
DROP TYPE IF EXISTS placed_wagers_selection_11_status;
DROP TYPE IF EXISTS placed_wagers_selection_10_status;
DROP TYPE IF EXISTS placed_wagers_book_id;
DROP TYPE IF EXISTS nfl_plays_play_type;
DROP TYPE IF EXISTS nfl_plays_current_week_play_type;
DROP TYPE IF EXISTS nfl_games_surf;
DROP TYPE IF EXISTS nfl_games_roof;
-- DROP SCHEMA IF EXISTS league_production;
--
-- Name: league_production; Type: SCHEMA; Schema: -; Owner: -
--

-- CREATE SCHEMA league_production;


--
-- Name: nfl_games_roof; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE nfl_games_roof AS ENUM (
    'dome',
    'outdoors',
    'closed',
    'open'
);


--
-- Name: nfl_games_surf; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE nfl_games_surf AS ENUM (
    'grass',
    'astroturf',
    'fieldturf',
    'dessograss',
    'astroplay',
    'matrixturf',
    'sportturf',
    'a_turf'
);


--
-- Name: nfl_plays_current_week_play_type; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE nfl_plays_current_week_play_type AS ENUM (
    'CONV',
    'FGXP',
    'KOFF',
    'NOPL',
    'PASS',
    'PUNT',
    'RUSH'
);


--
-- Name: nfl_plays_play_type; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE nfl_plays_play_type AS ENUM (
    'CONV',
    'FGXP',
    'KOFF',
    'NOPL',
    'PASS',
    'PUNT',
    'RUSH'
);


--
-- Name: placed_wagers_book_id; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_book_id AS ENUM (
    'DRAFTKINGS',
    'FANDUEL'
);


--
-- Name: placed_wagers_selection_10_status; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_selection_10_status AS ENUM (
    'OPEN',
    'WON',
    'LOST',
    'PUSH',
    'CANCELLED'
);


--
-- Name: placed_wagers_selection_11_status; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_selection_11_status AS ENUM (
    'OPEN',
    'WON',
    'LOST',
    'PUSH',
    'CANCELLED'
);


--
-- Name: placed_wagers_selection_12_status; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_selection_12_status AS ENUM (
    'OPEN',
    'WON',
    'LOST',
    'PUSH',
    'CANCELLED'
);


--
-- Name: placed_wagers_selection_1_status; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_selection_1_status AS ENUM (
    'OPEN',
    'WON',
    'LOST',
    'PUSH',
    'CANCELLED'
);


--
-- Name: placed_wagers_selection_2_status; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_selection_2_status AS ENUM (
    'OPEN',
    'WON',
    'LOST',
    'PUSH',
    'CANCELLED'
);


--
-- Name: placed_wagers_selection_3_status; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_selection_3_status AS ENUM (
    'OPEN',
    'WON',
    'LOST',
    'PUSH',
    'CANCELLED'
);


--
-- Name: placed_wagers_selection_4_status; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_selection_4_status AS ENUM (
    'OPEN',
    'WON',
    'LOST',
    'PUSH',
    'CANCELLED'
);


--
-- Name: placed_wagers_selection_5_status; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_selection_5_status AS ENUM (
    'OPEN',
    'WON',
    'LOST',
    'PUSH',
    'CANCELLED'
);


--
-- Name: placed_wagers_selection_6_status; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_selection_6_status AS ENUM (
    'OPEN',
    'WON',
    'LOST',
    'PUSH',
    'CANCELLED'
);


--
-- Name: placed_wagers_selection_7_status; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_selection_7_status AS ENUM (
    'OPEN',
    'WON',
    'LOST',
    'PUSH',
    'CANCELLED'
);


--
-- Name: placed_wagers_selection_8_status; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_selection_8_status AS ENUM (
    'OPEN',
    'WON',
    'LOST',
    'PUSH',
    'CANCELLED'
);


--
-- Name: placed_wagers_selection_9_status; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_selection_9_status AS ENUM (
    'OPEN',
    'WON',
    'LOST',
    'PUSH',
    'CANCELLED'
);


--
-- Name: placed_wagers_wager_status; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_wager_status AS ENUM (
    'OPEN',
    'WON',
    'LOST',
    'PUSH',
    'CANCELLED'
);


--
-- Name: placed_wagers_wager_type; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE placed_wagers_wager_type AS ENUM (
    'SINGLE',
    'PARLAY',
    'ROUND_ROBIN'
);


--
-- Name: prop_market_selections_history_source_id; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE prop_market_selections_history_source_id AS ENUM (
    'BETONLINE',
    'BETMGM',
    'BETRIVERS',
    'BOVADA',
    'CAESARS',
    'DRAFTKINGS',
    'FANDUEL',
    'GAMBET',
    'PRIZEPICKS'
);


--
-- Name: prop_market_selections_index_result; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE prop_market_selections_index_result AS ENUM (
    'PENDING',
    'WON',
    'LOST',
    'PUSH',
    'CANCELLED'
);


--
-- Name: prop_market_selections_index_source_id; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE prop_market_selections_index_source_id AS ENUM (
    'BETONLINE',
    'BETMGM',
    'BETRIVERS',
    'BOVADA',
    'CAESARS',
    'DRAFTKINGS',
    'FANDUEL',
    'GAMBET',
    'PRIZEPICKS'
);


--
-- Name: prop_market_selections_index_time_type; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE prop_market_selections_index_time_type AS ENUM (
    'OPEN',
    'CLOSE'
);


--
-- Name: prop_markets_history_source_id; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE prop_markets_history_source_id AS ENUM (
    'BETONLINE',
    'BETMGM',
    'BETRIVERS',
    'BOVADA',
    'CAESARS',
    'DRAFTKINGS',
    'FANDUEL',
    'GAMBET',
    'PRIZEPICKS'
);


--
-- Name: prop_markets_index_source_id; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE prop_markets_index_source_id AS ENUM (
    'BETONLINE',
    'BETMGM',
    'BETRIVERS',
    'BOVADA',
    'CAESARS',
    'DRAFTKINGS',
    'FANDUEL',
    'GAMBET',
    'PRIZEPICKS'
);


--
-- Name: prop_markets_index_time_type; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE prop_markets_index_time_type AS ENUM (
    'OPEN',
    'CLOSE'
);


--
-- Name: prop_pairings_source_id; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE prop_pairings_source_id AS ENUM (
    'BETONLINE',
    'BETMGM',
    'BETRIVERS',
    'BOVADA',
    'CAESARS',
    'DRAFTKINGS',
    'FANDUEL',
    'GAMBET',
    'PRIZEPICKS'
);


--
-- Name: props_index_source_id; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE props_index_source_id AS ENUM (
    'BETONLINE',
    'BETMGM',
    'BETRIVERS',
    'BOVADA',
    'CAESARS',
    'DRAFTKINGS',
    'FANDUEL',
    'GAMBET',
    'PRIZEPICKS'
);


--
-- Name: props_index_time_type; Type: TYPE; Schema: league_production; Owner: -
--

CREATE TYPE props_index_time_type AS ENUM (
    'OPEN',
    'CLOSE'
);


SET default_table_access_method = heap;

--
-- Name: draft; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE draft (
    uid bigint NOT NULL,
    pid character varying(25),
    round smallint NOT NULL,
    comp boolean DEFAULT false NOT NULL,
    pick smallint,
    pick_str character varying(4),
    tid integer NOT NULL,
    otid integer NOT NULL,
    lid integer NOT NULL,
    year smallint,
    selection_timestamp integer
);


--
-- Name: draft_uid_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE draft_uid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: draft_uid_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE draft_uid_seq OWNED BY draft.uid;


--
-- Name: footballoutsiders; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE footballoutsiders (
    week smallint NOT NULL,
    year smallint,
    team character varying(3) NOT NULL,
    ork smallint,
    drk smallint,
    odvoa numeric(3,1),
    ddvoa numeric(3,1),
    olw smallint,
    dlw smallint,
    odave numeric(3,1),
    ddave numeric(3,1),
    opass numeric(3,1),
    dpass numeric(3,1),
    orun numeric(3,1),
    drun numeric(3,1),
    olrunaly numeric(4,2),
    dlrunaly numeric(4,2),
    olrby numeric(4,2),
    dlrby numeric(4,2),
    olpwr integer,
    dlpwr integer,
    olstf integer,
    dlstf integer,
    olrun2y numeric(4,2),
    dlrun2y numeric(4,2),
    olrunofy numeric(4,2),
    dlrunofy numeric(4,2),
    olpassrk smallint,
    dlpassrk smallint,
    olskrk smallint,
    dlskrk smallint,
    olskrt numeric(3,1),
    dlskrt numeric(3,1),
    olrunley numeric(4,2),
    dlrunley numeric(4,2),
    olrunlty numeric(4,2),
    dlrunlty numeric(4,2),
    olrunmgy numeric(4,2),
    dlrunmgy numeric(4,2),
    olrunrty numeric(4,2),
    dlrunrty numeric(4,2),
    olrunrey numeric(4,2),
    dlrunrey numeric(4,2),
    odrv integer,
    ddrv integer,
    oypdrv numeric(4,2),
    dypdrv numeric(4,2),
    optspdrv numeric(3,2),
    dptspdrv numeric(3,2),
    otopdrv numeric(4,3),
    dtopdrv numeric(4,3),
    ointpdrv numeric(4,3),
    dintpdrv numeric(4,3),
    ofumpdrv numeric(4,3),
    dfumpdrv numeric(4,3),
    olospdrv numeric(4,2),
    dlospdrv numeric(4,2),
    oplypdrv numeric(4,2),
    dplypdrv numeric(4,2),
    otoppdrv character varying(10),
    dtoppdrv character varying(10),
    odrvsucc numeric(4,3),
    ddrvsucc numeric(4,3),
    otdpdrv numeric(4,3),
    dtdpdrv numeric(4,3),
    ofgpdrv numeric(4,3),
    dfgpdrv numeric(4,3),
    opntpdrv numeric(4,3),
    dpntpdrv numeric(4,3),
    o3opdrv numeric(4,3),
    d3opdrv numeric(4,3),
    olosko numeric(4,2),
    dlosko numeric(4,2),
    otdfg numeric(5,2),
    dtdfg numeric(5,2),
    optsprz numeric(3,2),
    dptsprz numeric(3,2),
    otdprz numeric(4,3),
    dtdprz numeric(4,3),
    oavgld numeric(4,2),
    davgld numeric(4,2)
);


--
-- Name: jobs; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE jobs (
    uid integer NOT NULL,
    type smallint NOT NULL,
    succ boolean NOT NULL,
    reason text,
    "timestamp" integer NOT NULL
);


--
-- Name: jobs_uid_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE jobs_uid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jobs_uid_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE jobs_uid_seq OWNED BY jobs.uid;


--
-- Name: keeptradecut_rankings; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE keeptradecut_rankings (
    pid character varying(25),
    qb smallint NOT NULL,
    d integer NOT NULL,
    v integer NOT NULL,
    type smallint NOT NULL
);


--
-- Name: league_baselines; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_baselines (
    lid integer NOT NULL,
    week character varying(3) NOT NULL,
    year smallint,
    pid character varying(25),
    type character varying(10) NOT NULL,
    pos character varying(3) NOT NULL
);


--
-- Name: league_cutlist; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_cutlist (
    pid character varying(25),
    tid integer NOT NULL,
    "order" smallint NOT NULL
);


--
-- Name: league_format_draft_pick_value; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_format_draft_pick_value (
    league_format_hash character varying(64) NOT NULL,
    rank smallint NOT NULL,
    median_best_season_points_added_per_game numeric(3,1),
    median_career_points_added_per_game numeric(3,1)
);


--
-- Name: league_format_player_careerlogs; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_format_player_careerlogs (
    pid character varying(25) NOT NULL,
    league_format_hash character varying(64) NOT NULL,
    draft_rank smallint,
    startable_games smallint,
    points numeric(6,1),
    points_per_game numeric(3,1),
    points_added numeric(6,1),
    points_added_per_game numeric(3,1),
    best_season_points_added_per_game numeric(3,1),
    points_added_first_three_seas numeric(6,1),
    points_added_first_four_seas numeric(6,1),
    points_added_first_five_seas numeric(6,1),
    points_added_first_seas numeric(6,1),
    points_added_second_seas numeric(6,1),
    points_added_third_seas numeric(6,1),
    games smallint,
    top_3 smallint,
    top_6 smallint,
    top_12 smallint,
    top_24 smallint,
    top_36 smallint
);


--
-- Name: league_format_player_gamelogs; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_format_player_gamelogs (
    pid character varying(25) NOT NULL,
    esbid integer NOT NULL,
    league_format_hash character varying(64) NOT NULL,
    points numeric(6,3),
    points_added numeric(4,1),
    pos_rnk smallint
);


--
-- Name: league_format_player_projection_values; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_format_player_projection_values (
    pid character varying(25) NOT NULL,
    week character varying(3) NOT NULL,
    year smallint NOT NULL,
    league_format_hash character varying(64) NOT NULL,
    pts_added numeric(5,2),
    market_salary numeric(6,2)
);


--
-- Name: league_format_player_seasonlogs; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_format_player_seasonlogs (
    pid character varying(25) NOT NULL,
    year smallint NOT NULL,
    league_format_hash character varying(64) NOT NULL,
    startable_games smallint,
    points numeric(4,1),
    points_per_game numeric(3,1),
    points_added numeric(4,1),
    points_added_per_game numeric(3,1),
    games smallint,
    points_rnk smallint,
    points_pos_rnk smallint,
    points_added_rnk smallint,
    points_added_pos_rnk smallint
);


--
-- Name: league_formats; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_formats (
    league_format_hash character varying(64) NOT NULL,
    scoring_format_hash character varying(64) NOT NULL,
    num_teams smallint NOT NULL,
    sqb smallint NOT NULL,
    srb smallint NOT NULL,
    swr smallint NOT NULL,
    ste smallint NOT NULL,
    srbwr smallint NOT NULL,
    srbwrte smallint NOT NULL,
    sqbrbwrte smallint NOT NULL,
    swrte smallint NOT NULL,
    sdst smallint NOT NULL,
    sk smallint NOT NULL,
    bench smallint NOT NULL,
    ps smallint NOT NULL,
    ir smallint NOT NULL,
    cap integer NOT NULL,
    min_bid smallint DEFAULT '0'::smallint,
    pts_base_week_qb numeric(3,1),
    pts_base_week_rb numeric(3,1),
    pts_base_week_wr numeric(3,1),
    pts_base_week_te numeric(3,1),
    pts_base_week_k numeric(3,1),
    pts_base_week_dst numeric(3,1),
    pts_base_season_qb numeric(3,1),
    pts_base_season_rb numeric(3,1),
    pts_base_season_wr numeric(3,1),
    pts_base_season_te numeric(3,1),
    pts_base_season_k numeric(3,1),
    pts_base_season_dst numeric(3,1)
);


--
-- Name: COLUMN league_formats.pts_base_week_qb; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN league_formats.pts_base_week_qb IS 'qb pts/game baseline';


--
-- Name: COLUMN league_formats.pts_base_week_rb; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN league_formats.pts_base_week_rb IS 'rb pts/game baseline';


--
-- Name: COLUMN league_formats.pts_base_week_wr; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN league_formats.pts_base_week_wr IS 'wr pts/game baseline';


--
-- Name: COLUMN league_formats.pts_base_week_te; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN league_formats.pts_base_week_te IS 'te pts/game baseline';


--
-- Name: COLUMN league_formats.pts_base_week_k; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN league_formats.pts_base_week_k IS 'k pts/game baseline';


--
-- Name: COLUMN league_formats.pts_base_week_dst; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN league_formats.pts_base_week_dst IS 'dst pts/game baseline';


--
-- Name: COLUMN league_formats.pts_base_season_qb; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN league_formats.pts_base_season_qb IS 'qb pts/season baseline';


--
-- Name: COLUMN league_formats.pts_base_season_rb; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN league_formats.pts_base_season_rb IS 'rb pts/season baseline';


--
-- Name: COLUMN league_formats.pts_base_season_wr; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN league_formats.pts_base_season_wr IS 'wr pts/season baseline';


--
-- Name: COLUMN league_formats.pts_base_season_te; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN league_formats.pts_base_season_te IS 'te pts/season baseline';


--
-- Name: COLUMN league_formats.pts_base_season_k; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN league_formats.pts_base_season_k IS 'k pts/season baseline';


--
-- Name: COLUMN league_formats.pts_base_season_dst; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN league_formats.pts_base_season_dst IS 'dst pts/season baseline';


--
-- Name: league_migrations; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_migrations (
    id bigint NOT NULL,
    name character varying(255),
    batch integer,
    migration_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: league_migrations_id_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE league_migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: league_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE league_migrations_id_seq OWNED BY league_migrations.id;


--
-- Name: league_migrations_lock; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_migrations_lock (
    index bigint NOT NULL,
    is_locked integer
);


--
-- Name: league_migrations_lock_index_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE league_migrations_lock_index_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: league_migrations_lock_index_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE league_migrations_lock_index_seq OWNED BY league_migrations_lock.index;


--
-- Name: league_nfl_team_seasonlogs; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_nfl_team_seasonlogs (
    tm character varying(7) NOT NULL,
    stat_key character varying(100) NOT NULL,
    year integer NOT NULL,
    lid integer NOT NULL,
    pts numeric(5,1),
    rnk smallint
);


--
-- Name: league_player_projection_values; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_player_projection_values (
    pid character varying(25),
    week character varying(3) NOT NULL,
    year smallint,
    lid integer NOT NULL,
    salary_adj_pts_added numeric(5,2),
    market_salary_adj numeric(6,2)
);


--
-- Name: league_player_seasonlogs; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_player_seasonlogs (
    pid character varying(25) NOT NULL,
    year smallint NOT NULL,
    lid integer NOT NULL,
    start_tid integer,
    start_acquisition_type smallint,
    end_tid integer,
    end_acquisition_type smallint,
    salary integer
);


--
-- Name: league_scoring_formats; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_scoring_formats (
    scoring_format_hash character varying(64) NOT NULL,
    pa numeric(3,2) NOT NULL,
    pc numeric(3,2) NOT NULL,
    py numeric(3,2) NOT NULL,
    ints smallint NOT NULL,
    tdp smallint NOT NULL,
    ra numeric(2,1) NOT NULL,
    ry numeric(2,1) NOT NULL,
    tdr smallint NOT NULL,
    rec numeric(2,1) NOT NULL,
    rbrec numeric(2,1) NOT NULL,
    wrrec numeric(2,1) NOT NULL,
    terec numeric(2,1) NOT NULL,
    recy numeric(2,1) NOT NULL,
    twoptc smallint NOT NULL,
    tdrec smallint NOT NULL,
    fuml smallint NOT NULL,
    prtd smallint NOT NULL,
    krtd smallint NOT NULL
);


--
-- Name: league_team_daily_values; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_team_daily_values (
    lid integer NOT NULL,
    tid integer NOT NULL,
    date date NOT NULL,
    "timestamp" bigint NOT NULL,
    ktc_value integer,
    ktc_share numeric(5,5)
);


--
-- Name: league_team_forecast; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_team_forecast (
    tid integer NOT NULL,
    lid integer NOT NULL,
    week character varying(3) NOT NULL,
    year smallint,
    day integer NOT NULL,
    playoff_odds numeric(5,4) NOT NULL,
    division_odds numeric(5,4) NOT NULL,
    bye_odds numeric(5,4) NOT NULL,
    championship_odds numeric(5,4) NOT NULL,
    "timestamp" integer NOT NULL
);


--
-- Name: league_team_lineup_contribution_weeks; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_team_lineup_contribution_weeks (
    pid character varying(25),
    week character varying(3) NOT NULL,
    year smallint,
    tid integer NOT NULL,
    lid integer NOT NULL,
    start boolean NOT NULL,
    sp numeric(5,2) NOT NULL,
    bp numeric(5,2) NOT NULL
);


--
-- Name: league_team_lineup_contributions; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_team_lineup_contributions (
    pid character varying(25),
    year smallint,
    tid integer NOT NULL,
    lid integer NOT NULL,
    starts smallint NOT NULL,
    sp numeric(5,2) NOT NULL,
    bp numeric(5,2) NOT NULL
);


--
-- Name: league_team_lineup_starters; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_team_lineup_starters (
    pid character varying(25),
    week character varying(3) NOT NULL,
    year smallint,
    tid integer NOT NULL,
    lid integer NOT NULL
);


--
-- Name: league_team_lineups; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE league_team_lineups (
    week smallint NOT NULL,
    year smallint,
    tid integer NOT NULL,
    lid integer NOT NULL,
    total numeric(5,2),
    baseline_total numeric(5,2)
);


--
-- Name: leagues; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE leagues (
    uid bigint NOT NULL,
    commishid integer NOT NULL,
    name character varying(50) NOT NULL,
    groupme_token character varying(45),
    groupme_id character varying(26),
    discord_webhook_url character varying(255),
    hosted boolean DEFAULT false,
    processed_at integer,
    archived_at bigint,
    espn_id bigint,
    sleeper_id bigint,
    mfl_id bigint,
    fleaflicker_id bigint
);


--
-- Name: leagues_uid_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE leagues_uid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leagues_uid_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE leagues_uid_seq OWNED BY leagues.uid;


--
-- Name: matchups; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE matchups (
    uid bigint NOT NULL,
    aid integer NOT NULL,
    hid integer NOT NULL,
    lid integer NOT NULL,
    year smallint,
    week smallint NOT NULL,
    ap numeric(5,2) DEFAULT 0.00 NOT NULL,
    hp numeric(5,2) DEFAULT 0.00 NOT NULL,
    app numeric(5,2) DEFAULT 0.00 NOT NULL,
    hpp numeric(5,2) DEFAULT 0.00 NOT NULL,
    home_projection numeric(5,2),
    away_projection numeric(5,2)
);


--
-- Name: matchups_uid_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE matchups_uid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: matchups_uid_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE matchups_uid_seq OWNED BY matchups.uid;


--
-- Name: nfl_games; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE nfl_games (
    esbid integer,
    gsisid integer,
    nflverse_game_id character varying(15),
    espnid integer,
    ngsid integer,
    shieldid character varying(36),
    detailid_v3 character varying(36),
    detailid_v1 character varying(36),
    pfrid character varying(20),
    year smallint,
    week smallint NOT NULL,
    day character varying(5),
    date character varying(10),
    time_est character varying(8),
    time_tz_offset smallint,
    time_start character varying(36),
    time_end character varying(36),
    "timestamp" integer,
    v character varying(3) NOT NULL,
    h character varying(3) NOT NULL,
    seas_type character varying(10) NOT NULL,
    ot boolean,
    div boolean,
    home_team_id character varying(36),
    away_team_id character varying(36),
    home_ngsid character varying(10),
    away_ngsid character varying(10),
    home_score integer DEFAULT 0,
    away_score integer DEFAULT 0,
    stad character varying(45),
    stad_nflid character varying(36),
    site_ngsid integer,
    clock character varying(10),
    status character varying(20),
    away_rest integer,
    home_rest integer,
    home_moneyline integer,
    away_moneyline integer,
    spread_line numeric(3,1),
    total_line numeric(3,1),
    roof nfl_games_roof,
    surf nfl_games_surf,
    temp integer,
    wind integer,
    away_coach character varying(36),
    home_coach character varying(36),
    referee character varying(36),
    week_type character varying(10),
    away_qb_pid character varying(25),
    home_qb_pid character varying(25),
    away_play_caller character varying(36),
    home_play_caller character varying(36)
);


--
-- Name: nfl_games_changelog; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE nfl_games_changelog (
    esbid character varying(36) NOT NULL,
    column_name character varying(36) NOT NULL,
    prev character varying(400),
    new character varying(400),
    "timestamp" integer NOT NULL
);


--
-- Name: nfl_play_stats; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE nfl_play_stats (
    esbid integer NOT NULL,
    "playId" integer NOT NULL,
    "clubCode" character varying(10),
    "playerName" character varying(36),
    "statId" integer NOT NULL,
    yards integer,
    "gsisId" character varying(36),
    gsispid character varying(47),
    teamid character varying(36),
    valid boolean
);


--
-- Name: nfl_play_stats_current_week; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE nfl_play_stats_current_week (
    esbid integer NOT NULL,
    "playId" integer NOT NULL,
    "clubCode" character varying(10),
    "playerName" character varying(36),
    "statId" integer NOT NULL,
    yards integer,
    "gsisId" character varying(36),
    gsispid character varying(47),
    teamid character varying(36),
    valid boolean
);


--
-- Name: nfl_plays; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE nfl_plays (
    esbid integer NOT NULL,
    "playId" integer NOT NULL,
    sequence integer,
    state character varying(36),
    dwn integer,
    home_score smallint,
    special boolean,
    "desc" text,
    play_type_ngs character varying(36),
    pos_team character varying(4),
    pos_team_id character varying(36),
    qtr integer,
    year smallint NOT NULL,
    seas_type character varying(36),
    away_score smallint,
    week smallint NOT NULL,
    ydl_num integer,
    ydl_side character varying(10),
    ytg integer,
    off_formation character varying(100),
    off_personnel character varying(100),
    box_ngs integer,
    pru_ngs integer,
    def_personnel character varying(100),
    game_clock_start character varying(10),
    drive_seq integer,
    ydl_end character varying(10),
    ydl_start character varying(10),
    fd boolean,
    gtg boolean,
    next_play_type character varying(36),
    penalty boolean,
    drive_yds integer,
    drive_play_count integer,
    play_clock smallint,
    deleted boolean,
    review text,
    score boolean,
    score_type character varying(10),
    score_team character varying(4),
    special_play_type character varying(10),
    "timestamp" character varying(10),
    play_type_nfl character varying(36),
    updated integer NOT NULL,
    off character varying(3),
    def character varying(3),
    play_type nfl_plays_play_type,
    player_fuml_pid character varying(25),
    player_fuml_gsis character varying(36),
    bc_pid character varying(25),
    bc_gsis character varying(36),
    psr_pid character varying(25),
    psr_gsis character varying(36),
    trg_pid character varying(25),
    trg_gsis character varying(36),
    intp_pid character varying(25),
    intp_gsis character varying(36),
    yds_gained smallint,
    dot integer,
    yac integer,
    yaco integer,
    ret_yds integer,
    qb_pressure smallint,
    qb_hit smallint,
    qb_hurry smallint,
    high boolean,
    int_worthy boolean,
    drp boolean,
    cnb boolean,
    mbt smallint,
    fuml boolean,
    "int" boolean,
    sk boolean,
    succ boolean,
    comp boolean,
    td boolean,
    ret_td boolean,
    td_tm character varying(5),
    ret_tm character varying(5),
    charted boolean,
    hash character varying(1),
    mot character varying(2),
    yfog integer,
    tay smallint,
    crr boolean,
    avsk smallint,
    sg boolean,
    nh boolean,
    pap boolean,
    option character varying(3),
    tlook boolean,
    trick boolean,
    qbru boolean,
    sneak boolean,
    scrm boolean,
    htm boolean,
    zblz boolean,
    stnt boolean,
    oop boolean,
    phyb boolean,
    cball boolean,
    qbta boolean,
    shov boolean,
    side boolean,
    bap boolean,
    fread boolean,
    scre boolean,
    pfp boolean,
    qbsk boolean,
    ttscrm numeric(16,12),
    ttp numeric(16,12),
    ttsk numeric(16,12),
    ttpr numeric(16,12),
    back smallint,
    xlm smallint,
    db smallint,
    box smallint,
    boxdb smallint,
    pru smallint,
    blz smallint,
    dblz smallint,
    oopd character varying(2),
    cov smallint,
    cov_type_charted character varying(3),
    sep character varying(3),
    ydl_100 integer,
    drive_result character varying(30),
    drive_top character varying(10),
    drive_fds integer,
    drive_inside20 boolean,
    drive_score boolean,
    drive_start_qtr smallint,
    drive_end_qtr smallint,
    drive_yds_penalized integer,
    drive_start_transition character varying(30),
    drive_end_transition character varying(30),
    drive_game_clock_start character varying(10),
    drive_game_clock_end character varying(10),
    drive_start_ydl character varying(10),
    drive_end_ydl character varying(10),
    drive_start_play_id integer,
    drive_end_play_id integer,
    series_seq integer,
    series_suc boolean,
    series_result character varying(100),
    game_clock_end character varying(10),
    sec_rem_qtr integer,
    sec_rem_half integer,
    sec_rem_gm integer,
    fum boolean,
    incomp boolean,
    touchback boolean,
    safety boolean,
    oob boolean,
    tfl boolean,
    rush boolean,
    pass boolean,
    solo_tk boolean,
    assist_tk boolean,
    pen_team character varying(3),
    pen_yds integer,
    pass_td boolean,
    rush_td boolean,
    pass_yds smallint,
    recv_yds smallint,
    rush_yds integer,
    qbd boolean,
    qbk boolean,
    qbs boolean,
    run_location character varying(10),
    run_gap character varying(10),
    fd_rush boolean,
    fd_pass boolean,
    fd_penalty boolean,
    third_down_converted boolean,
    third_down_failed boolean,
    fourth_down_converted boolean,
    fourth_down_failed boolean,
    ep numeric(16,12),
    epa numeric(16,12),
    ep_succ boolean,
    total_home_epa numeric(16,12),
    total_away_epa numeric(16,12),
    total_home_rush_epa numeric(16,12),
    total_away_rush_epa numeric(16,12),
    total_home_pass_epa numeric(16,12),
    total_away_pass_epa numeric(16,12),
    qb_epa numeric(16,12),
    air_epa numeric(16,12),
    yac_epa numeric(16,12),
    comp_air_epa numeric(16,12),
    comp_yac_epa numeric(16,12),
    xyac_epa numeric(16,12),
    total_home_comp_air_epa numeric(16,12),
    total_away_comp_air_epa numeric(16,12),
    total_home_comp_yac_epa numeric(16,12),
    total_away_comp_yac_epa numeric(16,12),
    total_home_raw_air_epa numeric(16,12),
    total_away_raw_air_epa numeric(16,12),
    total_home_raw_yac_epa numeric(16,12),
    total_away_raw_yac_epa numeric(16,12),
    wp numeric(16,12),
    wpa numeric(16,12),
    home_wp numeric(16,12),
    away_wp numeric(16,12),
    vegas_wpa numeric(16,12),
    vegas_home_wpa numeric(16,12),
    home_wp_post numeric(16,12),
    away_wp_post numeric(16,12),
    vegas_wp numeric(16,12),
    vegas_home_wp numeric(16,12),
    total_home_rush_wpa numeric(16,12),
    total_away_rush_wpa numeric(16,12),
    total_home_pass_wpa numeric(16,12),
    total_away_pass_wpa numeric(16,12),
    air_wpa numeric(16,12),
    yac_wpa numeric(16,12),
    comp_air_wpa numeric(16,12),
    comp_yac_wpa numeric(16,12),
    total_home_comp_air_wpa numeric(16,12),
    total_away_comp_air_wpa numeric(16,12),
    total_home_comp_yac_wpa numeric(16,12),
    total_away_comp_yac_wpa numeric(16,12),
    total_home_raw_air_wpa numeric(16,12),
    total_away_raw_air_wpa numeric(16,12),
    total_home_raw_yac_wpa numeric(16,12),
    total_away_raw_yac_wpa numeric(16,12),
    xyac_mean_yds numeric(16,12),
    xyac_median_yds numeric(16,12),
    xyac_succ_prob numeric(16,12),
    xyac_fd_prob numeric(16,12),
    ep_att boolean,
    two_att boolean,
    fg_att boolean,
    kickoff_att boolean,
    punt_att boolean,
    fg_result character varying(10),
    kick_distance integer,
    ep_result character varying(10),
    tp_result character varying(10),
    punt_blocked boolean,
    home_to_rem smallint,
    away_to_rem smallint,
    pos_to_rem smallint,
    def_to_rem smallint,
    "to" boolean,
    to_team character varying(3),
    pos_score smallint,
    def_score smallint,
    score_diff smallint,
    pos_score_post smallint,
    def_score_post smallint,
    score_diff_post smallint,
    no_score_prob numeric(16,12),
    opp_fg_prob numeric(16,12),
    opp_safety_prob numeric(16,12),
    opp_td_prob numeric(16,12),
    fg_prob numeric(16,12),
    safety_prob numeric(16,12),
    td_prob numeric(16,12),
    extra_point_prob numeric(16,12),
    two_conv_prob numeric(16,12),
    xpass_prob numeric(16,12),
    pass_oe numeric(16,12),
    cp numeric(16,12),
    cpoe numeric(16,12),
    air_yards_ngs numeric(8,4),
    time_to_throw_ngs numeric(8,4),
    route_ngs character varying(100),
    man_zone_ngs character varying(100),
    cov_type_ngs character varying(100),
    qb_pressure_ngs smallint
);


--
-- Name: COLUMN nfl_plays.special; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.special IS 'special teams';


--
-- Name: COLUMN nfl_plays.fd; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.fd IS 'first down';


--
-- Name: COLUMN nfl_plays.gtg; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.gtg IS 'Binary indicator for whether or not the posteam is in a goal down situation.';


--
-- Name: COLUMN nfl_plays.penalty; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.penalty IS 'penalty';


--
-- Name: COLUMN nfl_plays.score; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.score IS 'Binary indicator for whether or not a score occurred on the play.';


--
-- Name: COLUMN nfl_plays.high; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.high IS 'Highlight pass, Perfect pass that only the receiver can reach. Features perfect placement in a tight window.';


--
-- Name: COLUMN nfl_plays.int_worthy; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.int_worthy IS 'interception worthy';


--
-- Name: COLUMN nfl_plays.drp; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.drp IS 'dropped pass';


--
-- Name: COLUMN nfl_plays.cnb; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.cnb IS 'contested ball, Passes into close coverage that involve a physical battle between receiver and defender for control of the ball.';


--
-- Name: COLUMN nfl_plays.mbt; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.mbt IS 'missed or broken tackles';


--
-- Name: COLUMN nfl_plays.fuml; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.fuml IS 'fumble lost';


--
-- Name: COLUMN nfl_plays."int"; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays."int" IS 'interception';


--
-- Name: COLUMN nfl_plays.sk; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.sk IS 'sack';


--
-- Name: COLUMN nfl_plays.succ; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.succ IS 'successful play';


--
-- Name: COLUMN nfl_plays.comp; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.comp IS 'completion';


--
-- Name: COLUMN nfl_plays.td; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.td IS 'touchdown';


--
-- Name: COLUMN nfl_plays.ret_td; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.ret_td IS 'return touchdown';


--
-- Name: COLUMN nfl_plays.tay; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.tay IS 'true air yards, Distance ball travels in the air from point of throw to a receivers hands; back of endzone or sideline.';


--
-- Name: COLUMN nfl_plays.crr; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.crr IS 'Created Reception, Difficult catches that require exceptional body control; hands; acrobatics, or any combination thereof.';


--
-- Name: COLUMN nfl_plays.avsk; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.avsk IS 'number of avoided sacks';


--
-- Name: COLUMN nfl_plays.sg; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.sg IS 'shotgun';


--
-- Name: COLUMN nfl_plays.nh; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.nh IS 'no huddle';


--
-- Name: COLUMN nfl_plays.pap; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.pap IS 'play action pass';


--
-- Name: COLUMN nfl_plays.tlook; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.tlook IS 'trick look';


--
-- Name: COLUMN nfl_plays.trick; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.trick IS 'trick play';


--
-- Name: COLUMN nfl_plays.qbru; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.qbru IS 'QB run, a designed running play for the QB. These are only marked on runs by a natural QB where he lined up as a QB. Also, sneaks and kneel-downs are not counted.';


--
-- Name: COLUMN nfl_plays.sneak; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.sneak IS 'QB sneak';


--
-- Name: COLUMN nfl_plays.scrm; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.scrm IS 'QB scramble';


--
-- Name: COLUMN nfl_plays.htm; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.htm IS 'hindered throwing motion';


--
-- Name: COLUMN nfl_plays.zblz; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.zblz IS 'zone blitz, at least one Off-Ball LB rushed the passer instead of a DL who dropped into coverage';


--
-- Name: COLUMN nfl_plays.stnt; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.stnt IS 'stunt, when any two pass rushers cross, trading pass rush lanes on a passing down';


--
-- Name: COLUMN nfl_plays.oop; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.oop IS 'out of pocket pass';


--
-- Name: COLUMN nfl_plays.phyb; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.phyb IS 'physical ball, Pass target takes significant punishment whether the pass is caught or not. Most Contested Balls will also be a Physical Ball.';


--
-- Name: COLUMN nfl_plays.cball; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.cball IS 'catchable ball, A pass in which an eligible receiver has the opportunity to get his hands on the football with reasonable movement, timing, and opportunity.';


--
-- Name: COLUMN nfl_plays.qbta; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.qbta IS 'QB Throw Away';


--
-- Name: COLUMN nfl_plays.shov; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.shov IS 'Shovel/Touch Pass';


--
-- Name: COLUMN nfl_plays.side; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.side IS 'Sideline pass, Balls outside of the field but catchable when the receiver extends body/arms.';


--
-- Name: COLUMN nfl_plays.bap; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.bap IS 'batted pass';


--
-- Name: COLUMN nfl_plays.fread; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.fread IS 'first read';


--
-- Name: COLUMN nfl_plays.scre; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.scre IS 'screen pass';


--
-- Name: COLUMN nfl_plays.pfp; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.pfp IS 'pain free play, Ball carrier is only lightly touched by a defender on the field (ie QB slide) or runs out of bounds with little or no physical contact with the defender or sideline personnel/equipment. Includes TDs';


--
-- Name: COLUMN nfl_plays.qbsk; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.qbsk IS 'qb sack, QB was to blame for the sack: held ball too long; missed wide open receiver etc';


--
-- Name: COLUMN nfl_plays.xlm; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.xlm IS 'extra men on the line, Number of players lined up on either side of the Offensive Tackles - usually a Tight End.';


--
-- Name: COLUMN nfl_plays.pru; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.pru IS 'pass rushers';


--
-- Name: COLUMN nfl_plays.blz; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.blz IS 'number of LBs and DBs blitzing';


--
-- Name: COLUMN nfl_plays.dblz; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.dblz IS 'Number of DBs blitzing';


--
-- Name: COLUMN nfl_plays.cov; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.cov IS 'coverage on target, Uncovered is 0, single coverage is 1, double is 2.';


--
-- Name: COLUMN nfl_plays.drive_inside20; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.drive_inside20 IS 'Binary indicator if the offense was able to get inside the opponents 20 yard line.';


--
-- Name: COLUMN nfl_plays.drive_score; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.drive_score IS 'Binary indicator the drive ended with a score.';


--
-- Name: COLUMN nfl_plays.drive_start_qtr; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.drive_start_qtr IS 'Numeric value indicating in which quarter the given drive has started.';


--
-- Name: COLUMN nfl_plays.drive_end_qtr; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.drive_end_qtr IS 'Numeric value indicating in which quarter the given drive has ended.';


--
-- Name: COLUMN nfl_plays.series_suc; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.series_suc IS '1: scored touchdown, gained enough yards for first down.';


--
-- Name: COLUMN nfl_plays.fum; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.fum IS 'fumble occurred';


--
-- Name: COLUMN nfl_plays.incomp; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.incomp IS 'incompletion';


--
-- Name: COLUMN nfl_plays.touchback; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.touchback IS 'touchback';


--
-- Name: COLUMN nfl_plays.safety; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.safety IS 'safety';


--
-- Name: COLUMN nfl_plays.oob; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.oob IS '1 if play description contains ran ob, pushed ob, or sacked ob; 0 otherwise.';


--
-- Name: COLUMN nfl_plays.tfl; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.tfl IS 'Binary indicator for whether or not a tackle for loss on a run play occurred.';


--
-- Name: COLUMN nfl_plays.rush; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.rush IS 'Binary indicator for if the play was a run.';


--
-- Name: COLUMN nfl_plays.pass; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.pass IS 'Binary indicator for if the play was a pass attempt (includes sacks).';


--
-- Name: COLUMN nfl_plays.solo_tk; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.solo_tk IS 'Binary indicator if the play had a solo tackle (could be multiple due to fumbles).';


--
-- Name: COLUMN nfl_plays.assist_tk; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.assist_tk IS 'Binary indicator for if an assist tackle occurred.';


--
-- Name: COLUMN nfl_plays.pass_td; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.pass_td IS 'passing touchdown';


--
-- Name: COLUMN nfl_plays.rush_td; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.rush_td IS 'rushing touchdown';


--
-- Name: COLUMN nfl_plays.qbd; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.qbd IS 'QB dropped back on the play (pass attempt, sack, or scrambled).';


--
-- Name: COLUMN nfl_plays.qbk; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.qbk IS 'QB took a knee.';


--
-- Name: COLUMN nfl_plays.qbs; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.qbs IS 'QB spiked the ball.';


--
-- Name: COLUMN nfl_plays.fd_rush; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.fd_rush IS 'Binary indicator for if a running play converted the first down.';


--
-- Name: COLUMN nfl_plays.fd_pass; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.fd_pass IS 'Binary indicator for if a passing play converted the first down.';


--
-- Name: COLUMN nfl_plays.fd_penalty; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.fd_penalty IS 'Binary indicator for if a penalty converted the first down.';


--
-- Name: COLUMN nfl_plays.third_down_converted; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.third_down_converted IS 'Binary indicator for if the first down was converted on third down.';


--
-- Name: COLUMN nfl_plays.third_down_failed; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.third_down_failed IS 'Binary indicator for if the posteam failed to convert first down on third down.';


--
-- Name: COLUMN nfl_plays.fourth_down_converted; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.fourth_down_converted IS 'Binary indicator for if the first down was converted on fourth down.';


--
-- Name: COLUMN nfl_plays.fourth_down_failed; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.fourth_down_failed IS 'Binary indicator for if the posteam failed to convert first down on fourth down.';


--
-- Name: COLUMN nfl_plays.home_to_rem; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.home_to_rem IS 'Numeric timeouts remaining in the half for the home team';


--
-- Name: COLUMN nfl_plays.away_to_rem; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.away_to_rem IS 'Numeric timeouts remaining in the half for the away team';


--
-- Name: COLUMN nfl_plays.pos_to_rem; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.pos_to_rem IS 'Number of timeouts remaining for the possession team';


--
-- Name: COLUMN nfl_plays.def_to_rem; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays.def_to_rem IS 'Number of timeouts remaining for the team on defense';


--
-- Name: nfl_plays_current_week; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE nfl_plays_current_week (
    esbid integer NOT NULL,
    "playId" integer NOT NULL,
    sequence integer,
    state character varying(36),
    week smallint NOT NULL,
    dwn integer,
    qtr integer,
    year smallint NOT NULL,
    seas_type character varying(36),
    "desc" text,
    ydl_num integer,
    ydl_side character varying(10),
    ydl_start character varying(10),
    ydl_end character varying(10),
    ydl_100 integer,
    hash character varying(1),
    mot character varying(2),
    ytg integer,
    yfog integer,
    off_formation character varying(100),
    off_personnel character varying(100),
    def_personnel character varying(36),
    box_ngs integer,
    pru_ngs integer,
    drive_seq integer,
    drive_yds integer,
    drive_play_count integer,
    drive_result character varying(30),
    drive_top character varying(10),
    drive_fds integer,
    drive_inside20 boolean,
    drive_score boolean,
    drive_start_qtr smallint,
    drive_end_qtr smallint,
    drive_yds_penalized integer,
    drive_start_transition character varying(30),
    drive_end_transition character varying(30),
    drive_game_clock_start character varying(10),
    drive_game_clock_end character varying(10),
    drive_start_ydl character varying(10),
    drive_end_ydl character varying(10),
    drive_start_play_id integer,
    drive_end_play_id integer,
    series_seq integer,
    series_suc boolean,
    series_result character varying(100),
    gtg boolean,
    score boolean,
    score_type character varying(10),
    score_team character varying(4),
    "timestamp" character varying(10),
    play_clock smallint,
    game_clock_start character varying(10),
    game_clock_end character varying(10),
    sec_rem_qtr integer,
    sec_rem_half integer,
    sec_rem_gm integer,
    pos_team character varying(4),
    pos_team_id character varying(36),
    off character varying(3),
    def character varying(3),
    deleted boolean,
    review text,
    play_type nfl_plays_current_week_play_type,
    play_type_nfl character varying(36),
    play_type_ngs character varying(36),
    next_play_type character varying(36),
    player_fuml_pid character varying(25),
    player_fuml_gsis character varying(36),
    bc_pid character varying(25),
    bc_gsis character varying(36),
    psr_pid character varying(25),
    psr_gsis character varying(36),
    trg_pid character varying(25),
    trg_gsis character varying(36),
    intp_pid character varying(25),
    intp_gsis character varying(36),
    yds_gained smallint,
    fum boolean,
    fuml boolean,
    "int" boolean,
    sk boolean,
    succ boolean,
    comp boolean,
    incomp boolean,
    trick boolean,
    touchback boolean,
    safety boolean,
    penalty boolean,
    oob boolean,
    tfl boolean,
    rush boolean,
    pass boolean,
    solo_tk boolean,
    assist_tk boolean,
    special boolean,
    special_play_type character varying(10),
    pen_team character varying(3),
    pen_yds integer,
    td boolean,
    ret_td boolean,
    pass_td boolean,
    rush_td boolean,
    td_tm character varying(5),
    pass_yds smallint,
    recv_yds integer,
    rush_yds integer,
    dot integer,
    tay smallint,
    yac integer,
    yaco integer,
    ret_yds integer,
    ret_tm character varying(5),
    sg boolean,
    nh boolean,
    pap boolean,
    qbd boolean,
    qbk boolean,
    qbs boolean,
    qbru boolean,
    sneak boolean,
    scrm boolean,
    qb_pressure smallint,
    qb_hit smallint,
    qb_hurry smallint,
    int_worthy boolean,
    cball boolean,
    qbta boolean,
    shov boolean,
    side boolean,
    high boolean,
    drp boolean,
    cnb boolean,
    crr boolean,
    mbt smallint,
    avsk smallint,
    run_location character varying(10),
    run_gap character varying(10),
    option character varying(3),
    tlook boolean,
    fd boolean,
    fd_rush boolean,
    fd_pass boolean,
    fd_penalty boolean,
    third_down_converted boolean,
    third_down_failed boolean,
    fourth_down_converted boolean,
    fourth_down_failed boolean,
    htm boolean,
    zblz boolean,
    stnt boolean,
    oop boolean,
    phyb boolean,
    bap boolean,
    fread boolean,
    scre boolean,
    pfp boolean,
    qbsk boolean,
    ttscrm numeric(16,12),
    ttp numeric(16,12),
    ttsk numeric(16,12),
    ttpr numeric(16,12),
    back smallint,
    xlm smallint,
    db smallint,
    box smallint,
    boxdb smallint,
    pru smallint,
    blz smallint,
    dblz smallint,
    oopd character varying(2),
    cov smallint,
    ep numeric(16,12),
    epa numeric(16,12),
    ep_succ boolean,
    total_home_epa numeric(16,12),
    total_away_epa numeric(16,12),
    total_home_rush_epa numeric(16,12),
    total_away_rush_epa numeric(16,12),
    total_home_pass_epa numeric(16,12),
    total_away_pass_epa numeric(16,12),
    qb_epa numeric(16,12),
    air_epa numeric(16,12),
    yac_epa numeric(16,12),
    comp_air_epa numeric(16,12),
    comp_yac_epa numeric(16,12),
    xyac_epa numeric(16,12),
    total_home_comp_air_epa numeric(16,12),
    total_away_comp_air_epa numeric(16,12),
    total_home_comp_yac_epa numeric(16,12),
    total_away_comp_yac_epa numeric(16,12),
    total_home_raw_air_epa numeric(16,12),
    total_away_raw_air_epa numeric(16,12),
    total_home_raw_yac_epa numeric(16,12),
    total_away_raw_yac_epa numeric(16,12),
    wp numeric(16,12),
    wpa numeric(16,12),
    home_wp numeric(16,12),
    away_wp numeric(16,12),
    vegas_wpa numeric(16,12),
    vegas_home_wpa numeric(16,12),
    home_wp_post numeric(16,12),
    away_wp_post numeric(16,12),
    vegas_wp numeric(16,12),
    vegas_home_wp numeric(16,12),
    total_home_rush_wpa numeric(16,12),
    total_away_rush_wpa numeric(16,12),
    total_home_pass_wpa numeric(16,12),
    total_away_pass_wpa numeric(16,12),
    air_wpa numeric(16,12),
    yac_wpa numeric(16,12),
    comp_air_wpa numeric(16,12),
    comp_yac_wpa numeric(16,12),
    total_home_comp_air_wpa numeric(16,12),
    total_away_comp_air_wpa numeric(16,12),
    total_home_comp_yac_wpa numeric(16,12),
    total_away_comp_yac_wpa numeric(16,12),
    total_home_raw_air_wpa numeric(16,12),
    total_away_raw_air_wpa numeric(16,12),
    total_home_raw_yac_wpa numeric(16,12),
    total_away_raw_yac_wpa numeric(16,12),
    xyac_mean_yds numeric(16,12),
    xyac_median_yds numeric(16,12),
    xyac_succ_prob numeric(16,12),
    xyac_fd_prob numeric(16,12),
    ep_att boolean,
    two_att boolean,
    fg_att boolean,
    kickoff_att boolean,
    punt_att boolean,
    fg_result character varying(10),
    kick_distance integer,
    ep_result character varying(10),
    tp_result character varying(10),
    punt_blocked boolean,
    home_to_rem smallint,
    away_to_rem smallint,
    pos_to_rem smallint,
    def_to_rem smallint,
    "to" boolean,
    to_team character varying(3),
    home_score smallint,
    away_score smallint,
    pos_score smallint,
    def_score smallint,
    score_diff smallint,
    pos_score_post smallint,
    def_score_post smallint,
    score_diff_post smallint,
    no_score_prob numeric(16,12),
    opp_fg_prob numeric(16,12),
    opp_safety_prob numeric(16,12),
    opp_td_prob numeric(16,12),
    fg_prob numeric(16,12),
    safety_prob numeric(16,12),
    td_prob numeric(16,12),
    extra_point_prob numeric(16,12),
    two_conv_prob numeric(16,12),
    xpass_prob numeric(16,12),
    pass_oe numeric(16,12),
    cp numeric(16,12),
    cpoe numeric(16,12),
    charted boolean,
    updated integer NOT NULL,
    air_yards_ngs numeric(8,4),
    time_to_throw_ngs numeric(8,4),
    route_ngs character varying(100),
    man_zone_ngs character varying(100),
    cov_type_ngs character varying(100),
    qb_pressure_ngs smallint
);


--
-- Name: COLUMN nfl_plays_current_week.drive_inside20; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.drive_inside20 IS 'Binary indicator if the offense was able to get inside the opponents 20 yard line.';


--
-- Name: COLUMN nfl_plays_current_week.drive_score; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.drive_score IS 'Binary indicator the drive ended with a score.';


--
-- Name: COLUMN nfl_plays_current_week.drive_start_qtr; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.drive_start_qtr IS 'Numeric value indicating in which quarter the given drive has started.';


--
-- Name: COLUMN nfl_plays_current_week.drive_end_qtr; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.drive_end_qtr IS 'Numeric value indicating in which quarter the given drive has ended.';


--
-- Name: COLUMN nfl_plays_current_week.series_suc; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.series_suc IS '1: scored touchdown, gained enough yards for first down.';


--
-- Name: COLUMN nfl_plays_current_week.gtg; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.gtg IS 'Binary indicator for whether or not the posteam is in a goal down situation.';


--
-- Name: COLUMN nfl_plays_current_week.score; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.score IS 'Binary indicator for whether or not a score occurred on the play.';


--
-- Name: COLUMN nfl_plays_current_week.fum; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.fum IS 'fumble occurred';


--
-- Name: COLUMN nfl_plays_current_week.fuml; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.fuml IS 'fumble lost';


--
-- Name: COLUMN nfl_plays_current_week."int"; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week."int" IS 'interception';


--
-- Name: COLUMN nfl_plays_current_week.sk; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.sk IS 'sack';


--
-- Name: COLUMN nfl_plays_current_week.succ; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.succ IS 'successful play';


--
-- Name: COLUMN nfl_plays_current_week.comp; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.comp IS 'completion';


--
-- Name: COLUMN nfl_plays_current_week.incomp; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.incomp IS 'incompletion';


--
-- Name: COLUMN nfl_plays_current_week.trick; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.trick IS 'trick play';


--
-- Name: COLUMN nfl_plays_current_week.touchback; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.touchback IS 'touchback';


--
-- Name: COLUMN nfl_plays_current_week.safety; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.safety IS 'safety';


--
-- Name: COLUMN nfl_plays_current_week.penalty; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.penalty IS 'penalty';


--
-- Name: COLUMN nfl_plays_current_week.oob; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.oob IS '1 if play description contains ran ob, pushed ob, or sacked ob; 0 otherwise.';


--
-- Name: COLUMN nfl_plays_current_week.tfl; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.tfl IS 'Binary indicator for whether or not a tackle for loss on a run play occurred.';


--
-- Name: COLUMN nfl_plays_current_week.rush; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.rush IS 'Binary indicator for if the play was a run.';


--
-- Name: COLUMN nfl_plays_current_week.pass; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.pass IS 'Binary indicator for if the play was a pass attempt (includes sacks).';


--
-- Name: COLUMN nfl_plays_current_week.solo_tk; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.solo_tk IS 'Binary indicator if the play had a solo tackle (could be multiple due to fumbles).';


--
-- Name: COLUMN nfl_plays_current_week.assist_tk; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.assist_tk IS 'Binary indicator for if an assist tackle occurred.';


--
-- Name: COLUMN nfl_plays_current_week.special; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.special IS 'special teams';


--
-- Name: COLUMN nfl_plays_current_week.td; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.td IS 'touchdown';


--
-- Name: COLUMN nfl_plays_current_week.ret_td; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.ret_td IS 'return touchdown';


--
-- Name: COLUMN nfl_plays_current_week.pass_td; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.pass_td IS 'passing touchdown';


--
-- Name: COLUMN nfl_plays_current_week.rush_td; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.rush_td IS 'rushing touchdown';


--
-- Name: COLUMN nfl_plays_current_week.tay; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.tay IS 'true air yards, Distance ball travels in the air from point of throw to a receivers hands; back of endzone or sideline.';


--
-- Name: COLUMN nfl_plays_current_week.sg; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.sg IS 'shotgun';


--
-- Name: COLUMN nfl_plays_current_week.nh; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.nh IS 'no huddle';


--
-- Name: COLUMN nfl_plays_current_week.pap; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.pap IS 'play action pass';


--
-- Name: COLUMN nfl_plays_current_week.qbd; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.qbd IS 'QB dropped back on the play (pass attempt, sack, or scrambled).';


--
-- Name: COLUMN nfl_plays_current_week.qbk; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.qbk IS 'QB took a knee.';


--
-- Name: COLUMN nfl_plays_current_week.qbs; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.qbs IS 'QB spiked the ball.';


--
-- Name: COLUMN nfl_plays_current_week.qbru; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.qbru IS 'QB run, a designed running play for the QB. These are only marked on runs by a natural QB where he lined up as a QB. Also, sneaks and kneel-downs are not counted.';


--
-- Name: COLUMN nfl_plays_current_week.sneak; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.sneak IS 'QB sneak';


--
-- Name: COLUMN nfl_plays_current_week.scrm; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.scrm IS 'QB scramble';


--
-- Name: COLUMN nfl_plays_current_week.int_worthy; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.int_worthy IS 'interception worthy';


--
-- Name: COLUMN nfl_plays_current_week.cball; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.cball IS 'catchable ball, A pass in which an eligible receiver has the opportunity to get his hands on the football with reasonable movement, timing, and opportunity.';


--
-- Name: COLUMN nfl_plays_current_week.qbta; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.qbta IS 'QB Throw Away';


--
-- Name: COLUMN nfl_plays_current_week.shov; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.shov IS 'Shovel/Touch Pass';


--
-- Name: COLUMN nfl_plays_current_week.side; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.side IS 'Sideline pass, Balls outside of the field but catchable when the receiver extends body/arms.';


--
-- Name: COLUMN nfl_plays_current_week.high; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.high IS 'Highlight pass, Perfect pass that only the receiver can reach. Features perfect placement in a tight window.';


--
-- Name: COLUMN nfl_plays_current_week.drp; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.drp IS 'dropped pass';


--
-- Name: COLUMN nfl_plays_current_week.cnb; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.cnb IS 'contested ball, Passes into close coverage that involve a physical battle between receiver and defender for control of the ball.';


--
-- Name: COLUMN nfl_plays_current_week.crr; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.crr IS 'Created Reception, Difficult catches that require exceptional body control; hands; acrobatics, or any combination thereof.';


--
-- Name: COLUMN nfl_plays_current_week.mbt; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.mbt IS 'missed or broken tackles';


--
-- Name: COLUMN nfl_plays_current_week.avsk; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.avsk IS 'number of avoided sacks';


--
-- Name: COLUMN nfl_plays_current_week.tlook; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.tlook IS 'trick look';


--
-- Name: COLUMN nfl_plays_current_week.fd; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.fd IS 'first down';


--
-- Name: COLUMN nfl_plays_current_week.fd_rush; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.fd_rush IS 'Binary indicator for if a running play converted the first down.';


--
-- Name: COLUMN nfl_plays_current_week.fd_pass; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.fd_pass IS 'Binary indicator for if a passing play converted the first down.';


--
-- Name: COLUMN nfl_plays_current_week.fd_penalty; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.fd_penalty IS 'Binary indicator for if a penalty converted the first down.';


--
-- Name: COLUMN nfl_plays_current_week.third_down_converted; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.third_down_converted IS 'Binary indicator for if the first down was converted on third down.';


--
-- Name: COLUMN nfl_plays_current_week.third_down_failed; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.third_down_failed IS 'Binary indicator for if the posteam failed to convert first down on third down.';


--
-- Name: COLUMN nfl_plays_current_week.fourth_down_converted; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.fourth_down_converted IS 'Binary indicator for if the first down was converted on fourth down.';


--
-- Name: COLUMN nfl_plays_current_week.fourth_down_failed; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.fourth_down_failed IS 'Binary indicator for if the posteam failed to convert first down on fourth down.';


--
-- Name: COLUMN nfl_plays_current_week.htm; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.htm IS 'hindered throwing motion';


--
-- Name: COLUMN nfl_plays_current_week.zblz; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.zblz IS 'zone blitz, at least one Off-Ball LB rushed the passer instead of a DL who dropped into coverage';


--
-- Name: COLUMN nfl_plays_current_week.stnt; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.stnt IS 'stunt, when any two pass rushers cross, trading pass rush lanes on a passing down';


--
-- Name: COLUMN nfl_plays_current_week.oop; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.oop IS 'out of pocket pass';


--
-- Name: COLUMN nfl_plays_current_week.phyb; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.phyb IS 'physical ball, Pass target takes significant punishment whether the pass is caught or not. Most Contested Balls will also be a Physical Ball.';


--
-- Name: COLUMN nfl_plays_current_week.bap; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.bap IS 'batted pass';


--
-- Name: COLUMN nfl_plays_current_week.fread; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.fread IS 'first read';


--
-- Name: COLUMN nfl_plays_current_week.scre; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.scre IS 'screen pass';


--
-- Name: COLUMN nfl_plays_current_week.pfp; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.pfp IS 'pain free play, Ball carrier is only lightly touched by a defender on the field (ie QB slide) or runs out of bounds with little or no physical contact with the defender or sideline personnel/equipment. Includes TDs';


--
-- Name: COLUMN nfl_plays_current_week.qbsk; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.qbsk IS 'qb sack, QB was to blame for the sack: held ball too long; missed wide open receiver etc';


--
-- Name: COLUMN nfl_plays_current_week.xlm; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.xlm IS 'extra men on the line, Number of players lined up on either side of the Offensive Tackles - usually a Tight End.';


--
-- Name: COLUMN nfl_plays_current_week.pru; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.pru IS 'pass rushers';


--
-- Name: COLUMN nfl_plays_current_week.blz; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.blz IS 'number of LBs and DBs blitzing';


--
-- Name: COLUMN nfl_plays_current_week.dblz; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.dblz IS 'Number of DBs blitzing';


--
-- Name: COLUMN nfl_plays_current_week.cov; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.cov IS 'coverage on target, Uncovered is 0, single coverage is 1, double is 2.';


--
-- Name: COLUMN nfl_plays_current_week.home_to_rem; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.home_to_rem IS 'Numeric timeouts remaining in the half for the home team';


--
-- Name: COLUMN nfl_plays_current_week.away_to_rem; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.away_to_rem IS 'Numeric timeouts remaining in the half for the away team';


--
-- Name: COLUMN nfl_plays_current_week.pos_to_rem; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.pos_to_rem IS 'Number of timeouts remaining for the possession team';


--
-- Name: COLUMN nfl_plays_current_week.def_to_rem; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_plays_current_week.def_to_rem IS 'Number of timeouts remaining for the team on defense';


--
-- Name: nfl_snaps; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE nfl_snaps (
    esbid integer NOT NULL,
    "playId" integer NOT NULL,
    "nflId" integer NOT NULL
);


--
-- Name: COLUMN nfl_snaps."nflId"; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN nfl_snaps."nflId" IS 'ngs nflId/gsisItId';


--
-- Name: nfl_snaps_current_week; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE nfl_snaps_current_week (
    esbid integer NOT NULL,
    "playId" integer NOT NULL,
    "nflId" integer NOT NULL
);


--
-- Name: nfl_team_seasonlogs; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE nfl_team_seasonlogs (
    tm character varying(7) NOT NULL,
    stat_key character varying(100) NOT NULL,
    year integer NOT NULL,
    pa numeric(5,2) DEFAULT 0.00,
    pc numeric(5,2) DEFAULT 0.00,
    py numeric(6,2) DEFAULT 0.00,
    ints numeric(4,2) DEFAULT 0.00,
    tdp numeric(4,2) DEFAULT 0.00,
    ra numeric(5,2) DEFAULT 0.00,
    ry numeric(6,2) DEFAULT 0.00,
    tdr numeric(4,2) DEFAULT 0.00,
    fuml numeric(4,2) DEFAULT 0.00,
    trg numeric(5,2) DEFAULT 0.00,
    rec numeric(5,2) DEFAULT 0.00,
    recy numeric(6,2) DEFAULT 0.00,
    tdrec numeric(4,2) DEFAULT 0.00,
    twoptc numeric(4,2) DEFAULT 0.00,
    prtd numeric(4,2) DEFAULT 0.00,
    krtd numeric(4,2) DEFAULT 0.00,
    snp numeric(6,2) DEFAULT 0.00,
    fgm numeric(4,2) DEFAULT 0.00,
    fgy numeric(6,2) DEFAULT 0.00,
    fg19 numeric(4,2) DEFAULT 0.00,
    fg29 numeric(4,2) DEFAULT 0.00,
    fg39 numeric(4,2) DEFAULT 0.00,
    fg49 numeric(4,2) DEFAULT 0.00,
    fg50 numeric(4,2) DEFAULT 0.00,
    xpm numeric(5,2) DEFAULT 0.00,
    dsk numeric(5,2) DEFAULT 0.00,
    dint numeric(5,2) DEFAULT 0.00,
    dff numeric(5,2) DEFAULT 0.00,
    drf numeric(5,2) DEFAULT 0.00,
    dtno numeric(5,2) DEFAULT 0.00,
    dfds numeric(5,2) DEFAULT 0.00,
    dpa numeric(5,2) DEFAULT 0.00,
    dya numeric(8,2) DEFAULT 0.00,
    dblk numeric(5,2) DEFAULT 0.00,
    dsf numeric(5,2) DEFAULT 0.00,
    dtpr numeric(5,2) DEFAULT 0.00,
    dtd numeric(5,2) DEFAULT 0.00
);


--
-- Name: percentiles; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE percentiles (
    percentile_key character varying(100) NOT NULL,
    field character varying(100) NOT NULL,
    p25 numeric(8,2) NOT NULL,
    p50 numeric(8,2) NOT NULL,
    p75 numeric(8,2) NOT NULL,
    p90 numeric(8,2) NOT NULL,
    p95 numeric(8,2) NOT NULL,
    p98 numeric(8,2) NOT NULL,
    p99 numeric(8,2) NOT NULL,
    min numeric(8,2) NOT NULL,
    max numeric(8,2) NOT NULL
);


--
-- Name: placed_wagers; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE placed_wagers (
    wager_id integer NOT NULL,
    userid integer NOT NULL,
    public smallint DEFAULT '0'::smallint,
    wager_type placed_wagers_wager_type NOT NULL,
    placed_at integer NOT NULL,
    bet_count smallint NOT NULL,
    selection_count smallint NOT NULL,
    wager_status placed_wagers_wager_status NOT NULL,
    bet_wager_amount numeric(7,2) NOT NULL,
    total_wager_amount numeric(7,2) NOT NULL,
    wager_returned_amount numeric(12,2) NOT NULL,
    book_id placed_wagers_book_id NOT NULL,
    book_wager_id character varying(255) NOT NULL,
    selection_1_id character varying(255),
    selection_1_odds integer,
    selection_1_status placed_wagers_selection_1_status,
    selection_2_id character varying(255),
    selection_2_odds integer,
    selection_2_status placed_wagers_selection_2_status,
    selection_3_id character varying(255),
    selection_3_odds integer,
    selection_3_status placed_wagers_selection_3_status,
    selection_4_id character varying(255),
    selection_4_odds integer,
    selection_4_status placed_wagers_selection_4_status,
    selection_5_id character varying(255),
    selection_5_odds integer,
    selection_5_status placed_wagers_selection_5_status,
    selection_6_id character varying(255),
    selection_6_odds integer,
    selection_7_id character varying(255),
    selection_7_odds integer,
    selection_8_id character varying(255),
    selection_8_odds integer,
    selection_9_id character varying(255),
    selection_9_odds integer,
    selection_10_id character varying(255),
    selection_10_odds integer,
    selection_lost smallint DEFAULT '0'::smallint,
    selection_6_status placed_wagers_selection_6_status,
    selection_7_status placed_wagers_selection_7_status,
    selection_8_status placed_wagers_selection_8_status,
    selection_9_status placed_wagers_selection_9_status,
    selection_10_status placed_wagers_selection_10_status,
    selection_11_id character varying(255),
    selection_11_status placed_wagers_selection_11_status,
    selection_11_odds integer,
    selection_12_id character varying(255),
    selection_12_status placed_wagers_selection_12_status,
    selection_12_odds integer
);


--
-- Name: placed_wagers_wager_id_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE placed_wagers_wager_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: placed_wagers_wager_id_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE placed_wagers_wager_id_seq OWNED BY placed_wagers.wager_id;


--
-- Name: play_changelog; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE play_changelog (
    esbid bigint NOT NULL,
    "playId" bigint NOT NULL,
    prop character varying(100) NOT NULL,
    prev character varying(400) NOT NULL,
    new character varying(400),
    "timestamp" integer NOT NULL
);


--
-- Name: player; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE player (
    pid character varying(25) NOT NULL,
    fname character varying(20) NOT NULL,
    lname character varying(25) NOT NULL,
    pname character varying(25) NOT NULL,
    formatted character varying(30) NOT NULL,
    pos character varying(4) NOT NULL,
    pos1 character varying(4) NOT NULL,
    pos2 character varying(4),
    height smallint DEFAULT NULL,
    weight bigint DEFAULT NULL,
    dob character varying(10) DEFAULT NULL,
    forty numeric(3,2),
    bench smallint,
    vertical numeric(3,1),
    broad integer,
    shuttle numeric(3,2),
    cone numeric(3,2),
    arm numeric(5,3),
    hand numeric(5,3),
    dpos integer,
    round smallint,
    col character varying(255),
    dv character varying(35),
    start integer NOT NULL,
    current_nfl_team character varying(3) DEFAULT 'INA'::character varying NOT NULL,
    posd character varying(8),
    jnum smallint,
    dcp smallint,
    nflid integer,
    esbid character varying(10),
    gsisid character varying(15),
    gsispid character varying(47),
    "gsisItId" integer,
    status character varying(255),
    nfl_status character varying(50),
    injury_status character varying(12),
    high_school character varying(255),
    sleeper_id character varying(11),
    rotoworld_id integer,
    rotowire_id integer,
    sportradar_id character varying(36),
    espn_id integer,
    fantasy_data_id integer,
    yahoo_id integer,
    keeptradecut_id integer,
    pfr_id character varying(10)
);


--
-- Name: COLUMN player.pid; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.pid IS 'player id';


--
-- Name: COLUMN player.fname; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.fname IS 'first name';


--
-- Name: COLUMN player.lname; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.lname IS 'last name';


--
-- Name: COLUMN player.pname; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.pname IS 'f.last name';


--
-- Name: COLUMN player.formatted; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.formatted IS 'formatted name';


--
-- Name: COLUMN player.pos; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.pos IS 'primary position';


--
-- Name: COLUMN player.pos1; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.pos1 IS 'secondary position';


--
-- Name: COLUMN player.pos2; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.pos2 IS 'tertiary position';


--
-- Name: COLUMN player.height; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.height IS 'height in inches';


--
-- Name: COLUMN player.weight; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.weight IS 'weight in pounds';


--
-- Name: COLUMN player.dob; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.dob IS 'date of birth';


--
-- Name: COLUMN player.forty; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.forty IS '40-yard dash time';


--
-- Name: COLUMN player.bench; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.bench IS 'bench press reps';


--
-- Name: COLUMN player.vertical; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.vertical IS 'vertical jump height';


--
-- Name: COLUMN player.broad; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.broad IS 'broad jump distance';


--
-- Name: COLUMN player.shuttle; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.shuttle IS 'shuttle run time';


--
-- Name: COLUMN player.cone; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.cone IS '3-cone drill time';


--
-- Name: COLUMN player.arm; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.arm IS 'arm length';


--
-- Name: COLUMN player.hand; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.hand IS 'hand size';


--
-- Name: COLUMN player.dpos; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.dpos IS 'draft position';


--
-- Name: COLUMN player.round; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.round IS 'draft round';


--
-- Name: COLUMN player.col; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.col IS 'college';


--
-- Name: COLUMN player.dv; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.dv IS 'college division';


--
-- Name: COLUMN player.start; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.start IS 'starting nfl year';


--
-- Name: COLUMN player.current_nfl_team; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.current_nfl_team IS 'current nfl team';


--
-- Name: COLUMN player.posd; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.posd IS 'position depth';


--
-- Name: COLUMN player.jnum; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player.jnum IS 'jersey number';


--
-- Name: player_aliases; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE player_aliases (
    pid character varying(25) NOT NULL,
    formatted_alias character varying(100) NOT NULL
);


--
-- Name: player_changelog; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE player_changelog (
    uid integer NOT NULL,
    pid character varying(25),
    prop character varying(100) NOT NULL,
    prev character varying(400) NOT NULL,
    new character varying(400),
    "timestamp" integer NOT NULL
);


--
-- Name: player_changelog_uid_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE player_changelog_uid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: player_changelog_uid_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE player_changelog_uid_seq OWNED BY player_changelog.uid;


--
-- Name: player_gamelogs; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE player_gamelogs (
    esbid integer NOT NULL,
    pid character varying(25),
    opp character varying(3) NOT NULL,
    tm character varying(3) DEFAULT ''::character varying NOT NULL,
    pos character varying(3) NOT NULL,
    jnum smallint,
    active boolean,
    started boolean,
    pa smallint DEFAULT '0'::smallint,
    pc smallint DEFAULT '0'::smallint,
    py integer DEFAULT 0,
    ints smallint DEFAULT '0'::smallint,
    tdp smallint DEFAULT '0'::smallint,
    ra smallint DEFAULT '0'::smallint,
    ry integer DEFAULT 0,
    tdr smallint DEFAULT '0'::smallint,
    fuml smallint DEFAULT '0'::smallint,
    trg smallint DEFAULT '0'::smallint,
    rec smallint DEFAULT '0'::smallint,
    recy integer DEFAULT 0,
    tdrec smallint DEFAULT '0'::smallint,
    twoptc smallint DEFAULT '0'::smallint,
    prtd smallint DEFAULT '0'::smallint,
    krtd smallint DEFAULT '0'::smallint,
    snp smallint DEFAULT '0'::smallint,
    fgm smallint DEFAULT '0'::smallint,
    fgy integer DEFAULT 0,
    fg19 smallint DEFAULT '0'::smallint,
    fg29 smallint DEFAULT '0'::smallint,
    fg39 smallint DEFAULT '0'::smallint,
    fg49 smallint DEFAULT '0'::smallint,
    fg50 smallint DEFAULT '0'::smallint,
    xpm smallint DEFAULT '0'::smallint,
    dsk smallint DEFAULT '0'::smallint,
    dint smallint DEFAULT '0'::smallint,
    dff smallint DEFAULT '0'::smallint,
    drf smallint DEFAULT '0'::smallint,
    dtno smallint DEFAULT '0'::smallint,
    dfds smallint DEFAULT '0'::smallint,
    dpa smallint DEFAULT '0'::smallint,
    dya integer DEFAULT 0,
    dblk smallint DEFAULT '0'::smallint,
    dsf smallint DEFAULT '0'::smallint,
    dtpr smallint DEFAULT '0'::smallint,
    dtd smallint DEFAULT '0'::smallint
);


--
-- Name: player_seasonlogs; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE player_seasonlogs (
    pid character varying(25) NOT NULL,
    year smallint NOT NULL,
    seas_type character varying(10) NOT NULL,
    pos character varying(3) NOT NULL,
    pa smallint DEFAULT '0'::smallint,
    pc smallint DEFAULT '0'::smallint,
    py integer DEFAULT 0,
    ints smallint DEFAULT '0'::smallint,
    tdp smallint DEFAULT '0'::smallint,
    ra smallint DEFAULT '0'::smallint,
    ry integer DEFAULT 0,
    tdr smallint DEFAULT '0'::smallint,
    fuml smallint DEFAULT '0'::smallint,
    trg smallint DEFAULT '0'::smallint,
    rec smallint DEFAULT '0'::smallint,
    recy integer DEFAULT 0,
    tdrec smallint DEFAULT '0'::smallint,
    twoptc smallint DEFAULT '0'::smallint,
    prtd smallint DEFAULT '0'::smallint,
    krtd smallint DEFAULT '0'::smallint,
    snp smallint DEFAULT '0'::smallint,
    fgm smallint DEFAULT '0'::smallint,
    fgy integer DEFAULT 0,
    fg19 smallint DEFAULT '0'::smallint,
    fg29 smallint DEFAULT '0'::smallint,
    fg39 smallint DEFAULT '0'::smallint,
    fg49 smallint DEFAULT '0'::smallint,
    fg50 smallint DEFAULT '0'::smallint,
    xpm smallint DEFAULT '0'::smallint,
    dsk smallint DEFAULT '0'::smallint,
    dint smallint DEFAULT '0'::smallint,
    dff smallint DEFAULT '0'::smallint,
    drf smallint DEFAULT '0'::smallint,
    dtno smallint DEFAULT '0'::smallint,
    dfds smallint DEFAULT '0'::smallint,
    dpa smallint DEFAULT '0'::smallint,
    dya integer DEFAULT 0,
    dblk smallint DEFAULT '0'::smallint,
    dsf smallint DEFAULT '0'::smallint,
    dtpr smallint DEFAULT '0'::smallint,
    dtd smallint DEFAULT '0'::smallint,
    espn_open_score integer DEFAULT 0,
    espn_catch_score integer DEFAULT 0,
    espn_overall_score integer DEFAULT 0,
    espn_yac_score integer DEFAULT 0,
    espn_rtm_routes integer DEFAULT 0,
    espn_rtm_targets integer DEFAULT 0,
    espn_rtm_recv_yds integer DEFAULT 0
);


--
-- Name: player_snaps_game; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE player_snaps_game (
    esbid integer NOT NULL,
    pid character varying(25) NOT NULL,
    snaps_off smallint,
    snaps_def smallint,
    snaps_st smallint,
    snaps_pass smallint,
    snaps_run smallint
);


--
-- Name: COLUMN player_snaps_game.snaps_off; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player_snaps_game.snaps_off IS 'Offensive snaps';


--
-- Name: COLUMN player_snaps_game.snaps_def; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player_snaps_game.snaps_def IS 'Defensive snaps';


--
-- Name: COLUMN player_snaps_game.snaps_st; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player_snaps_game.snaps_st IS 'Special teams snaps';


--
-- Name: COLUMN player_snaps_game.snaps_pass; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player_snaps_game.snaps_pass IS 'Passing snaps (Pass attempts, sacks, scrambles)';


--
-- Name: COLUMN player_snaps_game.snaps_run; Type: COMMENT; Schema: league_production; Owner: -
--

COMMENT ON COLUMN player_snaps_game.snaps_run IS 'Rushing snaps';


--
-- Name: players_status; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE players_status (
    pid character varying(25),
    mfl_id character varying(11),
    sleeper_id character varying(11),
    active boolean,
    depth_chart_order character varying(255),
    depth_chart_position character varying(255),
    details character varying(255),
    exp_return character varying(255),
    injury_body_part character varying(255),
    injury_start_date character varying(255),
    injury_status character varying(255),
    injury_notes character varying(255),
    practice_participation character varying(255),
    practice_description character varying(255),
    status character varying(255),
    formatted_status character varying(100),
    search_rank integer,
    "timestamp" integer NOT NULL
);


--
-- Name: playoffs; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE playoffs (
    uid integer NOT NULL,
    tid integer NOT NULL,
    lid integer NOT NULL,
    year smallint,
    week smallint NOT NULL,
    points numeric(7,2),
    points_manual numeric(7,2),
    projection numeric(5,2)
);


--
-- Name: poach_releases; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE poach_releases (
    poachid integer NOT NULL,
    pid character varying(25)
);


--
-- Name: poaches; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE poaches (
    uid bigint NOT NULL,
    pid character varying(25),
    userid integer NOT NULL,
    tid integer NOT NULL,
    player_tid integer NOT NULL,
    lid integer NOT NULL,
    submitted integer NOT NULL,
    reason text,
    processed integer,
    succ boolean
);


--
-- Name: poaches_uid_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE poaches_uid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: poaches_uid_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE poaches_uid_seq OWNED BY poaches.uid;


--
-- Name: practice; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE practice (
    pid character varying(25),
    week smallint NOT NULL,
    year smallint,
    status character varying(100),
    formatted_status character varying(100),
    inj character varying(100),
    m character varying(20),
    tu character varying(20),
    w character varying(20),
    th character varying(20),
    f character varying(20),
    s character varying(20),
    su character varying(20)
);


--
-- Name: projections; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE projections (
    pid character varying(25),
    sourceid integer DEFAULT 0 NOT NULL,
    userid integer DEFAULT 0 NOT NULL,
    pa numeric(5,1),
    pc numeric(5,1),
    py numeric(5,1),
    ints numeric(3,1),
    tdp numeric(3,1),
    ra numeric(4,1),
    ry numeric(5,1),
    tdr numeric(3,1),
    trg numeric(4,1),
    rec numeric(4,1),
    recy numeric(5,1),
    tdrec numeric(3,1),
    fuml numeric(3,1),
    snp numeric(5,1),
    twoptc numeric(3,1),
    week smallint,
    year smallint,
    "timestamp" timestamp with time zone NOT NULL,
    fgm numeric(4,1),
    fgy integer DEFAULT 0,
    fg19 numeric(3,1),
    fg29 numeric(3,1),
    fg39 numeric(3,1),
    fg49 numeric(3,1),
    fg50 numeric(3,1),
    xpm numeric(3,1),
    dsk numeric(4,1),
    dint numeric(4,1),
    dff numeric(4,1),
    drf numeric(4,1),
    dtno numeric(4,1),
    dfds numeric(4,1),
    dpa numeric(4,1),
    dya numeric(5,1),
    dblk numeric(4,1),
    dsf numeric(4,1),
    dtpr numeric(4,1),
    dtd numeric(4,1),
    krtd numeric(4,1),
    prtd numeric(4,1)
);


--
-- Name: projections_archive; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE projections_archive (
    pid character varying(25),
    sourceid integer DEFAULT 0 NOT NULL,
    userid integer DEFAULT 0 NOT NULL,
    pa numeric(5,1),
    pc numeric(5,1),
    py numeric(5,1),
    ints numeric(3,1),
    tdp numeric(3,1),
    ra numeric(4,1),
    ry numeric(5,1),
    tdr numeric(3,1),
    trg numeric(4,1),
    rec numeric(4,1),
    recy numeric(5,1),
    tdrec numeric(3,1),
    fuml numeric(3,1),
    snp numeric(5,1),
    twoptc numeric(3,1),
    week smallint,
    year smallint,
    "timestamp" timestamp with time zone NOT NULL,
    fgm numeric(4,1),
    fgy integer DEFAULT 0,
    fg19 numeric(3,1),
    fg29 numeric(3,1),
    fg39 numeric(3,1),
    fg49 numeric(3,1),
    fg50 numeric(3,1),
    xpm numeric(3,1),
    dsk numeric(4,1),
    dint numeric(4,1),
    dff numeric(4,1),
    drf numeric(4,1),
    dtno numeric(4,1),
    dfds numeric(4,1),
    dpa numeric(4,1),
    dya numeric(5,1),
    dblk numeric(4,1),
    dsf numeric(4,1),
    dtpr numeric(4,1),
    dtd numeric(4,1),
    krtd numeric(4,1),
    prtd numeric(4,1)
);


--
-- Name: projections_index; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE projections_index (
    pid character varying(25) NOT NULL,
    sourceid integer DEFAULT 0 NOT NULL,
    userid integer DEFAULT 0 NOT NULL,
    week smallint NOT NULL,
    year smallint NOT NULL,
    pa numeric(5,1),
    pc numeric(5,1),
    py numeric(5,1),
    ints numeric(3,1),
    tdp numeric(3,1),
    ra numeric(4,1),
    ry numeric(5,1),
    tdr numeric(3,1),
    trg numeric(4,1),
    rec numeric(4,1),
    recy numeric(5,1),
    tdrec numeric(3,1),
    fuml numeric(3,1),
    snp numeric(5,1),
    twoptc numeric(3,1),
    fgm numeric(4,1),
    fgy integer DEFAULT 0,
    fg19 numeric(3,1),
    fg29 numeric(3,1),
    fg39 numeric(3,1),
    fg49 numeric(3,1),
    fg50 numeric(3,1),
    xpm numeric(3,1),
    dsk numeric(4,1),
    dint numeric(4,1),
    dff numeric(4,1),
    drf numeric(4,1),
    dtno numeric(4,1),
    dfds numeric(4,1),
    dpa numeric(4,1),
    dya numeric(5,1),
    dblk numeric(4,1),
    dsf numeric(4,1),
    dtpr numeric(4,1),
    dtd numeric(4,1),
    krtd numeric(4,1),
    prtd numeric(4,1)
);


--
-- Name: prop_market_selections_history; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE prop_market_selections_history (
    source_id prop_market_selections_history_source_id NOT NULL,
    source_market_id character varying(255) NOT NULL,
    source_selection_id character varying(255) NOT NULL,
    selection_name character varying(255),
    selection_metric_line numeric(6,1),
    odds_decimal numeric(15,3),
    odds_american integer,
    "timestamp" integer NOT NULL
);


--
-- Name: prop_market_selections_index; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE prop_market_selections_index (
    source_id prop_market_selections_index_source_id NOT NULL,
    source_market_id character varying(255) NOT NULL,
    source_selection_id character varying(255) NOT NULL,
    selection_pid character varying(25),
    selection_name character varying(255),
    selection_metric_line numeric(6,1),
    odds_decimal numeric(15,3),
    odds_american integer,
    result prop_market_selections_index_result,
    "timestamp" integer NOT NULL,
    time_type prop_market_selections_index_time_type NOT NULL
);


--
-- Name: prop_markets_history; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE prop_markets_history (
    source_id prop_markets_history_source_id NOT NULL,
    source_market_id character varying(255) NOT NULL,
    source_market_name character varying(500),
    open boolean,
    live boolean,
    selection_count integer NOT NULL,
    "timestamp" integer NOT NULL
);


--
-- Name: prop_markets_index; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE prop_markets_index (
    market_type character varying(50),
    source_id prop_markets_index_source_id NOT NULL,
    source_market_id character varying(255) NOT NULL,
    source_market_name character varying(500),
    esbid bigint,
    source_event_id character varying(255),
    source_event_name character varying(255),
    open boolean,
    live boolean,
    selection_count integer NOT NULL,
    settled boolean,
    winning_selection_id character varying(255),
    metric_result_value numeric(6,1),
    time_type prop_markets_index_time_type NOT NULL,
    "timestamp" integer NOT NULL
);


--
-- Name: prop_pairing_props; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE prop_pairing_props (
    pairing_id character varying(30) NOT NULL,
    prop_id bigint NOT NULL
);


--
-- Name: prop_pairings; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE prop_pairings (
    pairing_id character varying(30) NOT NULL,
    source_id prop_pairings_source_id NOT NULL,
    name character varying(150),
    team character varying(3),
    week smallint NOT NULL,
    size smallint NOT NULL,
    market_prob numeric(5,4),
    risk_total numeric(6,3),
    payout_total numeric(7,3),
    hist_rate_soft numeric(5,4),
    hist_rate_hard numeric(5,4),
    opp_allow_rate numeric(5,4),
    total_games smallint,
    week_last_hit smallint,
    week_first_hit smallint,
    joint_hist_rate numeric(5,4),
    joint_games smallint,
    hist_edge_soft numeric(6,5),
    hist_edge_hard numeric(6,5),
    is_pending smallint,
    is_success smallint,
    highest_payout integer,
    lowest_payout integer,
    second_lowest_payout integer,
    sum_hist_rate_soft numeric(5,4),
    sum_hist_rate_hard numeric(5,4)
);


--
-- Name: props; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE props (
    pid character varying(25),
    esbid bigint,
    week smallint NOT NULL,
    year smallint,
    id character varying(100) NOT NULL,
    ln numeric(4,1),
    o numeric(5,2),
    o_am integer,
    u numeric(5,2),
    u_am integer,
    sourceid integer NOT NULL,
    "timestamp" integer NOT NULL,
    active boolean,
    live boolean,
    prop_type character varying(50)
);


--
-- Name: props_index; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE props_index (
    pid character varying(25),
    esbid bigint,
    week smallint NOT NULL,
    year smallint NOT NULL,
    prop_type character varying(50),
    ln numeric(4,1),
    o numeric(5,2),
    u numeric(5,2),
    o_am integer,
    u_am integer,
    source_id props_index_source_id NOT NULL,
    "timestamp" integer NOT NULL,
    time_type props_index_time_type NOT NULL,
    name character varying(50),
    team character varying(3),
    opp character varying(3),
    pos character varying(3),
    hits_soft smallint,
    hit_weeks_soft json,
    hits_hard smallint,
    hit_weeks_hard json,
    hits_opp smallint,
    opp_hit_weeks json,
    hist_rate_soft numeric(5,4),
    hist_rate_hard numeric(5,4),
    opp_allow_rate numeric(5,4),
    hist_edge_soft numeric(6,5),
    hist_edge_hard numeric(6,5),
    market_prob numeric(5,4),
    is_pending smallint,
    is_success smallint,
    risk numeric(7,4),
    payout numeric(7,4),
    all_weeks json,
    opp_weeks json,
    prop_id bigint NOT NULL
);


--
-- Name: props_index_new; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE props_index_new (
    prop_id bigint NOT NULL,
    pid character varying(25) NOT NULL,
    prop_type character varying(50),
    ln numeric(4,1),
    o numeric(5,2),
    u numeric(5,2),
    o_am integer,
    u_am integer,
    sourceid integer NOT NULL,
    "timestamp" integer NOT NULL,
    time_type smallint NOT NULL,
    name character varying(50),
    team character varying(3),
    opp character varying(3),
    esbid bigint,
    pos character varying(3),
    hits_soft smallint,
    hit_weeks_soft json,
    hits_hard smallint,
    hit_weeks_hard json,
    hits_opp smallint,
    opp_hit_weeks json,
    hist_rate_soft numeric(5,4),
    hist_rate_hard numeric(5,4),
    opp_allow_rate numeric(5,4),
    hist_edge_soft numeric(6,5),
    hist_edge_hard numeric(6,5),
    market_prop numeric(5,4),
    is_pending smallint,
    is_success smallint,
    risk numeric(7,4),
    payout numeric(7,4),
    all_weeks json,
    opp_weeks json
);


--
-- Name: props_index_new_prop_id_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE props_index_new_prop_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: props_index_new_prop_id_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE props_index_new_prop_id_seq OWNED BY props_index_new.prop_id;


--
-- Name: props_index_prop_id_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE props_index_prop_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: props_index_prop_id_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE props_index_prop_id_seq OWNED BY props_index.prop_id;


--
-- Name: rankings; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE rankings (
    pid character varying(25),
    pos character varying(3) NOT NULL,
    week smallint NOT NULL,
    year smallint,
    min integer,
    max integer,
    avg numeric(5,2),
    std numeric(5,2),
    ornk integer,
    prnk integer,
    type integer NOT NULL,
    adp smallint NOT NULL,
    ppr integer NOT NULL,
    sf boolean NOT NULL,
    dynasty boolean NOT NULL,
    rookie smallint NOT NULL,
    sourceid integer NOT NULL,
    "timestamp" integer NOT NULL
);


--
-- Name: ros_projections; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE ros_projections (
    pid character varying(25),
    sourceid integer NOT NULL,
    pa numeric(5,1),
    pc numeric(5,1),
    py numeric(5,1),
    ints numeric(3,1),
    tdp numeric(3,1),
    ra numeric(4,1),
    ry numeric(5,1),
    tdr numeric(3,1),
    trg numeric(4,1),
    rec numeric(4,1),
    recy numeric(5,1),
    tdrec numeric(3,1),
    fuml numeric(3,1),
    twoptc numeric(3,1),
    snp numeric(5,1),
    fgm numeric(4,1),
    fgy integer DEFAULT 0,
    fg19 numeric(3,1),
    fg29 numeric(3,1),
    fg39 numeric(3,1),
    fg49 numeric(3,1),
    fg50 numeric(3,1),
    xpm numeric(3,1),
    dsk numeric(4,1),
    dint numeric(4,1),
    dff numeric(4,1),
    drf numeric(4,1),
    dtno numeric(4,1),
    dfds numeric(4,1),
    dpa numeric(4,1),
    dya numeric(5,1),
    dblk numeric(4,1),
    dsf numeric(4,1),
    dtpr numeric(4,1),
    dtd numeric(4,1),
    krtd numeric(4,1),
    prtd numeric(4,1),
    year smallint,
    "timestamp" timestamp with time zone NOT NULL
);


--
-- Name: rosters; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE rosters (
    uid bigint NOT NULL,
    tid integer NOT NULL,
    lid integer NOT NULL,
    week smallint NOT NULL,
    year smallint NOT NULL,
    last_updated integer
);


--
-- Name: rosters_players; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE rosters_players (
    rid integer NOT NULL,
    slot integer NOT NULL,
    pid character varying(25) NOT NULL,
    pos character varying(3) NOT NULL,
    tag smallint DEFAULT '1'::smallint NOT NULL,
    extensions smallint DEFAULT '0'::smallint NOT NULL,
    tid bigint NOT NULL,
    lid bigint NOT NULL,
    week smallint NOT NULL,
    year bigint NOT NULL
);


--
-- Name: rosters_uid_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE rosters_uid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rosters_uid_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE rosters_uid_seq OWNED BY rosters.uid;


--
-- Name: schedule; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE schedule (
    gid integer NOT NULL,
    seas integer NOT NULL,
    wk smallint NOT NULL,
    day character varying(3) NOT NULL,
    date text NOT NULL,
    v character varying(3) NOT NULL,
    h character varying(3) NOT NULL,
    stad character varying(45) NOT NULL,
    surf character varying(30) NOT NULL
);


--
-- Name: scoring_format_player_projection_points; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE scoring_format_player_projection_points (
    pid character varying(25) NOT NULL,
    week character varying(3) NOT NULL,
    year smallint NOT NULL,
    scoring_format_hash character varying(64) NOT NULL,
    total numeric(5,2),
    pa numeric(5,1),
    pc numeric(5,1),
    py numeric(5,1),
    ints numeric(3,1),
    tdp numeric(4,1),
    ra numeric(4,1),
    ry numeric(5,1),
    tdr numeric(3,1),
    trg numeric(4,1),
    rec numeric(4,1),
    recy numeric(5,1),
    tdrec numeric(3,1),
    fuml numeric(3,1),
    twoptc numeric(3,1),
    snp numeric(5,1),
    fgm numeric(4,1),
    fg19 numeric(3,1),
    fg29 numeric(3,1),
    fg39 numeric(3,1),
    fg49 numeric(3,1),
    fg50 numeric(3,1),
    xpm numeric(3,1),
    dsk numeric(4,1),
    dint numeric(4,1),
    dff numeric(4,1),
    drf numeric(4,1),
    dtno numeric(4,1),
    dfds numeric(4,1),
    dpa numeric(4,1),
    dya numeric(5,1),
    dblk numeric(4,1),
    dsf numeric(4,1),
    dtpr numeric(4,1),
    dtd numeric(4,1),
    krtd numeric(4,1),
    prtd numeric(4,1)
);


--
-- Name: seasons; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE seasons (
    lid integer NOT NULL,
    year smallint,
    season_started_at bigint,
    league_format_hash character varying(64) NOT NULL,
    scoring_format_hash character varying(64) NOT NULL,
    fqb integer,
    frb integer,
    fwr integer,
    fte integer,
    tran_start bigint,
    tran_end bigint,
    ext_date bigint,
    draft_start bigint,
    free_agency_period_start bigint,
    free_agency_period_end bigint,
    free_agency_live_auction_start bigint,
    tddate bigint,
    draft_type character varying(10),
    draft_hour_min smallint,
    draft_hour_max smallint,
    mqb smallint NOT NULL,
    mrb smallint NOT NULL,
    mwr smallint NOT NULL,
    mte smallint NOT NULL,
    mdst smallint NOT NULL,
    mk smallint NOT NULL,
    faab integer NOT NULL,
    tag2 smallint DEFAULT '1'::smallint NOT NULL,
    tag3 smallint DEFAULT '1'::smallint NOT NULL,
    tag4 smallint DEFAULT '2'::smallint NOT NULL,
    ext1 integer DEFAULT 5,
    ext2 integer DEFAULT 10,
    ext3 integer DEFAULT 20,
    ext4 integer DEFAULT 35,
    season_due_amount bigint
);


--
-- Name: sources; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE sources (
    uid integer NOT NULL,
    name character varying(50) DEFAULT ''::character varying NOT NULL,
    url character varying(60) DEFAULT ''::character varying NOT NULL
);


--
-- Name: sources_uid_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE sources_uid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sources_uid_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE sources_uid_seq OWNED BY sources.uid;


--
-- Name: team_stats; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE team_stats (
    lid integer NOT NULL,
    tid integer NOT NULL,
    div smallint,
    year smallint,
    wins smallint DEFAULT '0'::smallint,
    losses smallint DEFAULT '0'::smallint,
    ties smallint DEFAULT '0'::smallint,
    "apWins" smallint DEFAULT '0'::smallint,
    "apLosses" smallint DEFAULT '0'::smallint,
    "apTies" smallint DEFAULT '0'::smallint,
    pf numeric(6,2) DEFAULT 0.00,
    pa numeric(6,2) DEFAULT 0.00,
    pdiff numeric(6,2) DEFAULT 0.00,
    pp numeric(6,2) DEFAULT 0.00,
    ppp numeric(6,2) DEFAULT 0.00,
    pw smallint DEFAULT '0'::smallint,
    pl smallint DEFAULT '0'::smallint,
    pp_pct numeric(5,2) DEFAULT 0.00,
    pmax numeric(5,2) DEFAULT 0.00,
    pmin numeric(5,2) DEFAULT 0.00,
    pdev numeric(5,2) DEFAULT 0.00,
    doi numeric(4,2) DEFAULT 0.00,
    "pSlot1" numeric(6,2) DEFAULT 0.00,
    "pSlot2" numeric(6,2) DEFAULT 0.00,
    "pSlot3" numeric(6,2) DEFAULT 0.00,
    "pSlot4" numeric(6,2) DEFAULT 0.00,
    "pSlot5" numeric(6,2) DEFAULT 0.00,
    "pSlot6" numeric(6,2) DEFAULT 0.00,
    "pSlot7" numeric(6,2) DEFAULT 0.00,
    "pSlot8" numeric(6,2) DEFAULT 0.00,
    "pSlot9" numeric(6,2) DEFAULT 0.00,
    "pSlot10" numeric(6,2) DEFAULT 0.00,
    "pSlot11" numeric(6,2) DEFAULT 0.00,
    "pSlot12" numeric(6,2) DEFAULT 0.00,
    "pSlot13" numeric(6,2) DEFAULT 0.00,
    "pSlot14" numeric(6,2) DEFAULT 0.00,
    "pSlot15" numeric(6,2) DEFAULT 0.00,
    "pSlot16" numeric(6,2),
    "pSlot17" numeric(6,2),
    "pPosQB" numeric(6,2) DEFAULT 0.00,
    "pPosRB" numeric(6,2) DEFAULT 0.00,
    "pPosWR" numeric(6,2) DEFAULT 0.00,
    "pPosTE" numeric(6,2) DEFAULT 0.00,
    "pPosK" numeric(6,2) DEFAULT 0.00,
    "pPosDST" numeric(6,2) DEFAULT 0.00,
    division_finish smallint DEFAULT '0'::smallint,
    regular_season_finish smallint DEFAULT '0'::smallint,
    post_season_finish smallint DEFAULT '0'::smallint
);


--
-- Name: teams; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE teams (
    uid integer NOT NULL,
    year smallint NOT NULL,
    lid integer NOT NULL,
    div smallint,
    name character varying(50) NOT NULL,
    abbrv character varying(5) DEFAULT ''::character varying NOT NULL,
    image character varying(500) DEFAULT ''::character varying,
    waiver_order smallint,
    draft_order smallint,
    cap integer DEFAULT 0 NOT NULL,
    faab integer DEFAULT 0 NOT NULL,
    pc character varying(6),
    ac character varying(6)
);


--
-- Name: teams_uid_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE teams_uid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: teams_uid_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE teams_uid_seq OWNED BY teams.uid;


--
-- Name: trade_releases; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE trade_releases (
    tradeid integer NOT NULL,
    tid integer NOT NULL,
    pid character varying(25)
);


--
-- Name: trades; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE trades (
    uid bigint NOT NULL,
    propose_tid integer NOT NULL,
    accept_tid integer NOT NULL,
    lid integer NOT NULL,
    userid integer NOT NULL,
    year smallint,
    offered integer NOT NULL,
    accepted integer,
    cancelled integer,
    rejected integer,
    vetoed integer
);


--
-- Name: trades_picks; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE trades_picks (
    tradeid integer NOT NULL,
    tid integer NOT NULL,
    pickid integer NOT NULL
);


--
-- Name: trades_players; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE trades_players (
    tradeid integer NOT NULL,
    tid integer NOT NULL,
    pid character varying(25)
);


--
-- Name: trades_transactions; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE trades_transactions (
    tradeid integer NOT NULL,
    transactionid integer NOT NULL
);


--
-- Name: trades_uid_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE trades_uid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trades_uid_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE trades_uid_seq OWNED BY trades.uid;


--
-- Name: transactions; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE transactions (
    uid bigint NOT NULL,
    userid integer NOT NULL,
    tid integer NOT NULL,
    lid integer NOT NULL,
    pid character varying(25),
    type smallint NOT NULL,
    value integer NOT NULL,
    week smallint NOT NULL,
    year smallint,
    "timestamp" integer NOT NULL,
    waiverid integer
);


--
-- Name: transactions_uid_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE transactions_uid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions_uid_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE transactions_uid_seq OWNED BY transactions.uid;


--
-- Name: transition_bids; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE transition_bids (
    uid integer NOT NULL,
    pid character varying(25),
    userid integer NOT NULL,
    bid integer,
    tid integer NOT NULL,
    year smallint,
    player_tid integer NOT NULL,
    lid integer NOT NULL,
    succ boolean,
    reason text,
    submitted integer NOT NULL,
    processed integer,
    cancelled integer
);


--
-- Name: transition_bids_uid_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE transition_bids_uid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transition_bids_uid_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE transition_bids_uid_seq OWNED BY transition_bids.uid;


--
-- Name: transition_releases; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE transition_releases (
    transitionid integer NOT NULL,
    pid character varying(25)
);


--
-- Name: user_table_views; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE user_table_views (
    view_id bigint NOT NULL,
    view_name character varying(30) NOT NULL,
    view_description text,
    table_name character varying(255) NOT NULL,
    table_state json,
    user_id bytea NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_table_views_view_id_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE user_table_views_view_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_table_views_view_id_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE user_table_views_view_id_seq OWNED BY user_table_views.view_id;


--
-- Name: users; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE users (
    id bigint NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(50) DEFAULT ''::character varying NOT NULL,
    password character varying(60) DEFAULT ''::character varying NOT NULL,
    vbaseline character varying(9) DEFAULT 'default'::character varying NOT NULL,
    watchlist text,
    lastvisit timestamp with time zone,
    qbb character varying(7),
    rbb character varying(7),
    wrb character varying(7),
    teb character varying(7),
    phone character varying(12),
    text boolean DEFAULT true NOT NULL,
    voice boolean DEFAULT true NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE users_id_seq OWNED BY users.id;


--
-- Name: users_sources; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE users_sources (
    userid integer NOT NULL,
    sourceid integer NOT NULL,
    weight numeric(2,2) NOT NULL
);


--
-- Name: users_teams; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE users_teams (
    userid integer NOT NULL,
    tid integer NOT NULL,
    teamtext boolean DEFAULT true NOT NULL,
    teamvoice boolean DEFAULT true NOT NULL,
    leaguetext boolean DEFAULT true NOT NULL
);


--
-- Name: waiver_releases; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE waiver_releases (
    waiverid integer NOT NULL,
    pid character varying(25)
);


--
-- Name: waivers; Type: TABLE; Schema: league_production; Owner: -
--

CREATE TABLE waivers (
    uid integer NOT NULL,
    userid integer NOT NULL,
    pid character varying(25),
    tid integer NOT NULL,
    lid integer NOT NULL,
    submitted integer NOT NULL,
    bid integer,
    po integer DEFAULT 0,
    type smallint NOT NULL,
    succ boolean,
    reason text,
    processed integer,
    cancelled integer
);


--
-- Name: waivers_uid_seq; Type: SEQUENCE; Schema: league_production; Owner: -
--

CREATE SEQUENCE waivers_uid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: waivers_uid_seq; Type: SEQUENCE OWNED BY; Schema: league_production; Owner: -
--

ALTER SEQUENCE waivers_uid_seq OWNED BY waivers.uid;


--
-- Name: draft uid; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY draft ALTER COLUMN uid SET DEFAULT nextval('draft_uid_seq'::regclass);


--
-- Name: jobs uid; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY jobs ALTER COLUMN uid SET DEFAULT nextval('jobs_uid_seq'::regclass);


--
-- Name: league_migrations id; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY league_migrations ALTER COLUMN id SET DEFAULT nextval('league_migrations_id_seq'::regclass);


--
-- Name: league_migrations_lock index; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY league_migrations_lock ALTER COLUMN index SET DEFAULT nextval('league_migrations_lock_index_seq'::regclass);


--
-- Name: leagues uid; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY leagues ALTER COLUMN uid SET DEFAULT nextval('leagues_uid_seq'::regclass);


--
-- Name: matchups uid; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY matchups ALTER COLUMN uid SET DEFAULT nextval('matchups_uid_seq'::regclass);


--
-- Name: placed_wagers wager_id; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY placed_wagers ALTER COLUMN wager_id SET DEFAULT nextval('placed_wagers_wager_id_seq'::regclass);


--
-- Name: player_changelog uid; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY player_changelog ALTER COLUMN uid SET DEFAULT nextval('player_changelog_uid_seq'::regclass);


--
-- Name: poaches uid; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY poaches ALTER COLUMN uid SET DEFAULT nextval('poaches_uid_seq'::regclass);


--
-- Name: props_index prop_id; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY props_index ALTER COLUMN prop_id SET DEFAULT nextval('props_index_prop_id_seq'::regclass);


--
-- Name: props_index_new prop_id; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY props_index_new ALTER COLUMN prop_id SET DEFAULT nextval('props_index_new_prop_id_seq'::regclass);


--
-- Name: rosters uid; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY rosters ALTER COLUMN uid SET DEFAULT nextval('rosters_uid_seq'::regclass);


--
-- Name: sources uid; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY sources ALTER COLUMN uid SET DEFAULT nextval('sources_uid_seq'::regclass);


--
-- Name: teams uid; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY teams ALTER COLUMN uid SET DEFAULT nextval('teams_uid_seq'::regclass);


--
-- Name: trades uid; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY trades ALTER COLUMN uid SET DEFAULT nextval('trades_uid_seq'::regclass);


--
-- Name: transactions uid; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY transactions ALTER COLUMN uid SET DEFAULT nextval('transactions_uid_seq'::regclass);


--
-- Name: transition_bids uid; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY transition_bids ALTER COLUMN uid SET DEFAULT nextval('transition_bids_uid_seq'::regclass);


--
-- Name: user_table_views view_id; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY user_table_views ALTER COLUMN view_id SET DEFAULT nextval('user_table_views_view_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY users ALTER COLUMN id SET DEFAULT nextval('users_id_seq'::regclass);


--
-- Name: waivers uid; Type: DEFAULT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY waivers ALTER COLUMN uid SET DEFAULT nextval('waivers_uid_seq'::regclass);


--
-- Name: draft idx_23184_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY draft
    ADD CONSTRAINT "idx_23184_PRIMARY" PRIMARY KEY (uid);


--
-- Name: league_migrations idx_23228_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY league_migrations
    ADD CONSTRAINT "idx_23228_PRIMARY" PRIMARY KEY (id);


--
-- Name: league_migrations_lock idx_23234_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY league_migrations_lock
    ADD CONSTRAINT "idx_23234_PRIMARY" PRIMARY KEY (index);


--
-- Name: matchups idx_23275_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY matchups
    ADD CONSTRAINT "idx_23275_PRIMARY" PRIMARY KEY (uid);


--
-- Name: placed_wagers idx_23361_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY placed_wagers
    ADD CONSTRAINT "idx_23361_PRIMARY" PRIMARY KEY (wager_id);


--
-- Name: player_changelog idx_23384_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY player_changelog
    ADD CONSTRAINT "idx_23384_PRIMARY" PRIMARY KEY (uid);


--
-- Name: poaches idx_23493_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY poaches
    ADD CONSTRAINT "idx_23493_PRIMARY" PRIMARY KEY (uid);


--
-- Name: prop_pairings idx_23543_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY prop_pairings
    ADD CONSTRAINT "idx_23543_PRIMARY" PRIMARY KEY (pairing_id);


--
-- Name: props_index idx_23550_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY props_index
    ADD CONSTRAINT "idx_23550_PRIMARY" PRIMARY KEY (prop_id);


--
-- Name: props_index_new idx_23557_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY props_index_new
    ADD CONSTRAINT "idx_23557_PRIMARY" PRIMARY KEY (prop_id);


--
-- Name: rosters idx_23571_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY rosters
    ADD CONSTRAINT "idx_23571_PRIMARY" PRIMARY KEY (uid);


--
-- Name: sources idx_23599_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY sources
    ADD CONSTRAINT "idx_23599_PRIMARY" PRIMARY KEY (uid);


--
-- Name: transition_bids idx_23684_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY transition_bids
    ADD CONSTRAINT "idx_23684_PRIMARY" PRIMARY KEY (uid);


--
-- Name: user_table_views idx_23694_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY user_table_views
    ADD CONSTRAINT "idx_23694_PRIMARY" PRIMARY KEY (view_id);


--
-- Name: users idx_23703_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY users
    ADD CONSTRAINT "idx_23703_PRIMARY" PRIMARY KEY (id);


--
-- Name: waivers idx_23727_PRIMARY; Type: CONSTRAINT; Schema: league_production; Owner: -
--

ALTER TABLE ONLY waivers
    ADD CONSTRAINT "idx_23727_PRIMARY" PRIMARY KEY (uid);


--
-- Name: idx_23184_lid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23184_lid ON draft USING btree (lid);


--
-- Name: idx_23184_pick; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23184_pick ON draft USING btree (round, pick, lid, year);


--
-- Name: idx_23184_tid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23184_tid ON draft USING btree (tid);


--
-- Name: idx_23189_team; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23189_team ON footballoutsiders USING btree (team, week, year);


--
-- Name: idx_23199_player_value; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23199_player_value ON keeptradecut_rankings USING btree (pid, d, qb, type);


--
-- Name: idx_23202_baseline; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23202_baseline ON league_baselines USING btree (lid, week, pos, type);


--
-- Name: idx_23205_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23205_pid ON league_cutlist USING btree (pid);


--
-- Name: idx_23205_teamid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23205_teamid ON league_cutlist USING btree (tid);


--
-- Name: idx_23205_tid_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23205_tid_pid ON league_cutlist USING btree (tid, pid);


--
-- Name: idx_23208_pick; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23208_pick ON league_format_draft_pick_value USING btree (rank, league_format_hash);


--
-- Name: idx_23211_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23211_pid ON league_format_player_careerlogs USING btree (pid, league_format_hash);


--
-- Name: idx_23214_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23214_pid ON league_format_player_gamelogs USING btree (pid, esbid, league_format_hash);


--
-- Name: idx_23217_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23217_pid ON league_format_player_projection_values USING btree (pid);


--
-- Name: idx_23217_player_value; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23217_player_value ON league_format_player_projection_values USING btree (pid, league_format_hash, week, year);


--
-- Name: idx_23220_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23220_pid ON league_format_player_seasonlogs USING btree (pid, year, league_format_hash);


--
-- Name: idx_23223_league_format_hash; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23223_league_format_hash ON league_formats USING btree (league_format_hash);


--
-- Name: idx_23238_league_stat; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23238_league_stat ON league_nfl_team_seasonlogs USING btree (lid, stat_key, year, tm);


--
-- Name: idx_23241_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23241_pid ON league_player_projection_values USING btree (pid);


--
-- Name: idx_23241_player_value; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23241_player_value ON league_player_projection_values USING btree (pid, lid, week, year);


--
-- Name: idx_23244_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23244_pid ON league_player_seasonlogs USING btree (pid, year, lid);


--
-- Name: idx_23247_scoring_format_hash; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23247_scoring_format_hash ON league_scoring_formats USING btree (scoring_format_hash);


--
-- Name: idx_23250_league_team; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23250_league_team ON league_team_daily_values USING btree (lid, tid, date);


--
-- Name: idx_23253_team_forecast_day; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23253_team_forecast_day ON league_team_forecast USING btree (tid, year, week, day);


--
-- Name: idx_23256_contribution; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23256_contribution ON league_team_lineup_contribution_weeks USING btree (lid, pid, year, week);


--
-- Name: idx_23259_contribution; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23259_contribution ON league_team_lineup_contributions USING btree (lid, pid, year);


--
-- Name: idx_23262_starter; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23262_starter ON league_team_lineup_starters USING btree (lid, pid, year, week);


--
-- Name: idx_23265_lineup; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23265_lineup ON league_team_lineups USING btree (tid, year, week);


--
-- Name: idx_23269_commishid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23269_commishid ON leagues USING btree (commishid);


--
-- Name: idx_23269_uid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23269_uid ON leagues USING btree (uid);


--
-- Name: idx_23275_aid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23275_aid ON matchups USING btree (aid, hid, year, week);


--
-- Name: idx_23275_lid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23275_lid ON matchups USING btree (lid);


--
-- Name: idx_23283_esbid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23283_esbid ON nfl_games USING btree (esbid);


--
-- Name: idx_23283_game; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23283_game ON nfl_games USING btree (v, h, week, year, seas_type);


--
-- Name: idx_23295_playId; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX "idx_23295_playId" ON nfl_play_stats USING btree ("playId");


--
-- Name: idx_23295_play_stat; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23295_play_stat ON nfl_play_stats USING btree (esbid, "playId", "statId", "playerName");


--
-- Name: idx_23298_playId; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX "idx_23298_playId" ON nfl_play_stats_current_week USING btree ("playId");


--
-- Name: idx_23298_play_stat; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23298_play_stat ON nfl_play_stats_current_week USING btree (esbid, "playId", "statId", "playerName");


--
-- Name: idx_23301_bc_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23301_bc_pid ON nfl_plays USING btree (bc_pid);


--
-- Name: idx_23301_esbid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23301_esbid ON nfl_plays USING btree (esbid);


--
-- Name: idx_23301_gamePlay; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX "idx_23301_gamePlay" ON nfl_plays USING btree (esbid, "playId");


--
-- Name: idx_23301_idx_nfl_plays_target; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23301_idx_nfl_plays_target ON nfl_plays USING btree (play_type, seas_type, trg_pid, off, esbid);


--
-- Name: idx_23301_idx_nfl_plays_year_esbid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23301_idx_nfl_plays_year_esbid ON nfl_plays USING btree (year, esbid);


--
-- Name: idx_23301_idx_off; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23301_idx_off ON nfl_plays USING btree (off);


--
-- Name: idx_23301_idx_play_type; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23301_idx_play_type ON nfl_plays USING btree (play_type);


--
-- Name: idx_23301_idx_seas_type; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23301_idx_seas_type ON nfl_plays USING btree (seas_type);


--
-- Name: idx_23301_playId; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX "idx_23301_playId" ON nfl_plays USING btree ("playId");


--
-- Name: idx_23301_psr_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23301_psr_pid ON nfl_plays USING btree (psr_pid);


--
-- Name: idx_23301_trg_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23301_trg_pid ON nfl_plays USING btree (trg_pid);


--
-- Name: idx_23306_esbid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23306_esbid ON nfl_plays_current_week USING btree (esbid);


--
-- Name: idx_23306_gamePlay; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX "idx_23306_gamePlay" ON nfl_plays_current_week USING btree (esbid, "playId");


--
-- Name: idx_23306_playId; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX "idx_23306_playId" ON nfl_plays_current_week USING btree ("playId");


--
-- Name: idx_23311_playId; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX "idx_23311_playId" ON nfl_snaps USING btree ("playId");


--
-- Name: idx_23311_snap; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23311_snap ON nfl_snaps USING btree (esbid, "playId", "nflId");


--
-- Name: idx_23314_playId; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX "idx_23314_playId" ON nfl_snaps_current_week USING btree ("playId");


--
-- Name: idx_23314_snap; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23314_snap ON nfl_snaps_current_week USING btree ("playId", "nflId", esbid);


--
-- Name: idx_23317_stat; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23317_stat ON nfl_team_seasonlogs USING btree (stat_key, year, tm);


--
-- Name: idx_23357_percentile_key; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23357_percentile_key ON percentiles USING btree (percentile_key, field);


--
-- Name: idx_23361_placed_at; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23361_placed_at ON placed_wagers USING btree (placed_at);


--
-- Name: idx_23361_userid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23361_userid ON placed_wagers USING btree (userid);


--
-- Name: idx_23361_wager; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23361_wager ON placed_wagers USING btree (book_wager_id);


--
-- Name: idx_23369_play; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23369_play ON play_changelog USING btree (esbid, "playId", prop, "timestamp");


--
-- Name: idx_23374_esbid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23374_esbid ON player USING btree (esbid);


--
-- Name: idx_23374_espn_id; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23374_espn_id ON player USING btree (espn_id);


--
-- Name: idx_23374_fantasy_data_id; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23374_fantasy_data_id ON player USING btree (fantasy_data_id);


--
-- Name: idx_23374_fname; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23374_fname ON player USING btree (fname);


--
-- Name: idx_23374_gsisItId; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX "idx_23374_gsisItId" ON player USING btree ("gsisItId");


--
-- Name: idx_23374_gsisid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23374_gsisid ON player USING btree (gsisid);


--
-- Name: idx_23374_gsispid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23374_gsispid ON player USING btree (gsispid);


--
-- Name: idx_23374_keeptradecut_id; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23374_keeptradecut_id ON player USING btree (keeptradecut_id);


--
-- Name: idx_23374_lname; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23374_lname ON player USING btree (lname);


--
-- Name: idx_23374_name; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23374_name ON player USING btree (fname, lname);


--
-- Name: idx_23374_pfr_id; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23374_pfr_id ON player USING btree (pfr_id);


--
-- Name: idx_23374_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23374_pid ON player USING btree (pid);


--
-- Name: idx_23374_rotowire_id; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23374_rotowire_id ON player USING btree (rotowire_id);


--
-- Name: idx_23374_rotoworld_id; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23374_rotoworld_id ON player USING btree (rotoworld_id);


--
-- Name: idx_23374_sleeper_id; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23374_sleeper_id ON player USING btree (sleeper_id);


--
-- Name: idx_23374_sportradar_id; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23374_sportradar_id ON player USING btree (sportradar_id);


--
-- Name: idx_23374_yahoo_id; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23374_yahoo_id ON player USING btree (yahoo_id);


--
-- Name: idx_23380_alias; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23380_alias ON player_aliases USING btree (pid, formatted_alias);


--
-- Name: idx_23390_idx_player_gamelogs_esbid_tm_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23390_idx_player_gamelogs_esbid_tm_pid ON player_gamelogs USING btree (esbid, tm, pid);


--
-- Name: idx_23390_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23390_pid ON player_gamelogs USING btree (pid, esbid);


--
-- Name: idx_23431_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23431_pid ON player_seasonlogs USING btree (pid, year, seas_type);


--
-- Name: idx_23478_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23478_pid ON player_snaps_game USING btree (pid, esbid);


--
-- Name: idx_23481_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23481_pid ON players_status USING btree (pid);


--
-- Name: idx_23481_status; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23481_status ON players_status USING btree (pid, "timestamp");


--
-- Name: idx_23486_lid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23486_lid ON playoffs USING btree (lid);


--
-- Name: idx_23486_tid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23486_tid ON playoffs USING btree (tid, uid, year);


--
-- Name: idx_23489_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23489_pid ON poach_releases USING btree (poachid, pid);


--
-- Name: idx_23489_poachid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23489_poachid ON poach_releases USING btree (poachid);


--
-- Name: idx_23493_lid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23493_lid ON poaches USING btree (lid);


--
-- Name: idx_23499_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23499_pid ON practice USING btree (pid, week, year);


--
-- Name: idx_23502_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23502_pid ON projections USING btree (pid);


--
-- Name: idx_23502_projection; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23502_projection ON projections USING btree (sourceid, pid, userid, "timestamp", week, year);


--
-- Name: idx_23508_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23508_pid ON projections_archive USING btree (pid);


--
-- Name: idx_23508_projection; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23508_projection ON projections_archive USING btree (sourceid, pid, userid, week, year, "timestamp");


--
-- Name: idx_23514_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23514_pid ON projections_index USING btree (pid);


--
-- Name: idx_23514_projection; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23514_projection ON projections_index USING btree (sourceid, pid, userid, week, year);


--
-- Name: idx_23520_market_selection; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23520_market_selection ON prop_market_selections_history USING btree (source_id, source_market_id, source_selection_id, "timestamp");


--
-- Name: idx_23525_market; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23525_market ON prop_market_selections_index USING btree (source_id, source_market_id, source_selection_id, time_type);


--
-- Name: idx_23530_market; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23530_market ON prop_markets_history USING btree (source_id, source_market_id, "timestamp");


--
-- Name: idx_23535_market; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23535_market ON prop_markets_index USING btree (source_id, source_market_id, time_type);


--
-- Name: idx_23540_pairing_prop; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23540_pairing_prop ON prop_pairing_props USING btree (pairing_id, prop_id);


--
-- Name: idx_23543_highest_payout; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23543_highest_payout ON prop_pairings USING btree (highest_payout);


--
-- Name: idx_23543_hist_edge_soft; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23543_hist_edge_soft ON prop_pairings USING btree (hist_edge_soft);


--
-- Name: idx_23543_hist_rate_soft; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23543_hist_rate_soft ON prop_pairings USING btree (hist_rate_soft);


--
-- Name: idx_23543_joint_hist_rate; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23543_joint_hist_rate ON prop_pairings USING btree (joint_hist_rate);


--
-- Name: idx_23543_lowest_payout; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23543_lowest_payout ON prop_pairings USING btree (lowest_payout);


--
-- Name: idx_23543_market_prob; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23543_market_prob ON prop_pairings USING btree (market_prob);


--
-- Name: idx_23543_opp_allow_rate; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23543_opp_allow_rate ON prop_pairings USING btree (opp_allow_rate);


--
-- Name: idx_23543_risk_total; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23543_risk_total ON prop_pairings USING btree (risk_total);


--
-- Name: idx_23543_size; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23543_size ON prop_pairings USING btree (size);


--
-- Name: idx_23543_source_id; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23543_source_id ON prop_pairings USING btree (source_id);


--
-- Name: idx_23543_team; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23543_team ON prop_pairings USING btree (team);


--
-- Name: idx_23543_total_games; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23543_total_games ON prop_pairings USING btree (total_games);


--
-- Name: idx_23543_week; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23543_week ON prop_pairings USING btree (week);


--
-- Name: idx_23546_prop; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23546_prop ON props USING btree (sourceid, id, pid, week, year, ln, "timestamp");


--
-- Name: idx_23550_hits_soft; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23550_hits_soft ON props_index USING btree (hits_soft);


--
-- Name: idx_23550_prop; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23550_prop ON props_index USING btree (source_id, pid, week, year, prop_type, ln, time_type);


--
-- Name: idx_23557_hits_soft; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23557_hits_soft ON props_index_new USING btree (hits_soft);


--
-- Name: idx_23557_prop; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23557_prop ON props_index_new USING btree (sourceid, pid, esbid, prop_type, ln, time_type);


--
-- Name: idx_23563_ranking; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23563_ranking ON rankings USING btree (pid, sourceid, type, adp, ppr, sf, dynasty, rookie, "timestamp", week, year);


--
-- Name: idx_23566_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23566_pid ON ros_projections USING btree (pid);


--
-- Name: idx_23566_sourceid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23566_sourceid ON ros_projections USING btree (sourceid, pid, year);


--
-- Name: idx_23571_teamid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23571_teamid ON rosters USING btree (tid, week, year);


--
-- Name: idx_23571_tid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23571_tid ON rosters USING btree (tid);


--
-- Name: idx_23575_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23575_pid ON rosters_players USING btree (rid, pid);


--
-- Name: idx_23575_player_team; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23575_player_team ON rosters_players USING btree (pid, week, year, tid);


--
-- Name: idx_23575_rid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23575_rid ON rosters_players USING btree (rid);


--
-- Name: idx_23580_gid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23580_gid ON schedule USING btree (gid);


--
-- Name: idx_23585_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23585_pid ON scoring_format_player_projection_points USING btree (pid);


--
-- Name: idx_23585_player_league_points; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23585_player_league_points ON scoring_format_player_projection_points USING btree (pid, scoring_format_hash, week, year);


--
-- Name: idx_23588_season; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23588_season ON seasons USING btree (lid, year);


--
-- Name: idx_23605_team; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23605_team ON team_stats USING btree (tid, year);


--
-- Name: idx_23651_lid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23651_lid ON teams USING btree (lid);


--
-- Name: idx_23651_team_year; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23651_team_year ON teams USING btree (uid, year);


--
-- Name: idx_23661_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23661_pid ON trade_releases USING btree (tradeid, pid);


--
-- Name: idx_23661_tradeid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23661_tradeid ON trade_releases USING btree (tradeid);


--
-- Name: idx_23665_uid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23665_uid ON trades USING btree (uid);


--
-- Name: idx_23669_pick; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23669_pick ON trades_picks USING btree (tradeid, pickid);


--
-- Name: idx_23669_tradeid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23669_tradeid ON trades_picks USING btree (tradeid);


--
-- Name: idx_23672_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23672_pid ON trades_players USING btree (tradeid, pid);


--
-- Name: idx_23672_tradeid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23672_tradeid ON trades_players USING btree (tradeid);


--
-- Name: idx_23675_transaction; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23675_transaction ON trades_transactions USING btree (tradeid, transactionid);


--
-- Name: idx_23679_lid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23679_lid ON transactions USING btree (lid);


--
-- Name: idx_23679_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23679_pid ON transactions USING btree (pid);


--
-- Name: idx_23679_teamid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23679_teamid ON transactions USING btree (tid);


--
-- Name: idx_23679_uid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23679_uid ON transactions USING btree (uid);


--
-- Name: idx_23684_lid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23684_lid ON transition_bids USING btree (lid);


--
-- Name: idx_23690_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23690_pid ON transition_releases USING btree (transitionid, pid);


--
-- Name: idx_23690_transitionid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23690_transitionid ON transition_releases USING btree (transitionid);


--
-- Name: idx_23694_table_view; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23694_table_view ON user_table_views USING btree (view_name, user_id);


--
-- Name: idx_23703_email; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23703_email ON users USING btree (email);


--
-- Name: idx_23714_sourceid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23714_sourceid ON users_sources USING btree (userid, sourceid);


--
-- Name: idx_23714_userid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23714_userid ON users_sources USING btree (userid);


--
-- Name: idx_23717_userid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23717_userid ON users_teams USING btree (userid, tid);


--
-- Name: idx_23723_waiverid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23723_waiverid ON waiver_releases USING btree (waiverid);


--
-- Name: idx_23723_waiverid_pid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE UNIQUE INDEX idx_23723_waiverid_pid ON waiver_releases USING btree (waiverid, pid);


--
-- Name: idx_23727_lid; Type: INDEX; Schema: league_production; Owner: -
--

CREATE INDEX idx_23727_lid ON waivers USING btree (lid);


--
-- PostgreSQL database dump complete
--

