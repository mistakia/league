-- Conform the PFF/NGS tables to the full-word vocabulary end state, and
-- eliminate pff_game_id_map into a new nfl_games.pff_game_id column.
--
-- Vendor table/column NAMES stay pff_/ngs_ (operator ruling 2026-07-22:
-- obfuscation dropped -- the vendor is self-evident and the code was unused).
-- Surviving conformance only:
--   * year -> season_year on the 5 pff season/game-grain tables (+ index/
--     constraint "year" tokens).
--   * epoch-int timestamp columns -> timestamptz. Upserted current-state log
--     rows use updated_at; the append-only ngs_prospect_scores_history uses
--     observed_at (matching the misc-timeseries _history convention);
--     retype-in-place where the name is already correct (ngs _index.updated_at,
--     pff_unresolved_players.first_seen/last_seen).
--   * pff_game_id_map ELIMINATED -> nfl_games.pff_game_id (1:1, 100% resolved
--     in prod: 6139 rows, all present in nfl_games, esbid unique). The map's
--     only unique datum is pff_game_id<->esbid; season/home/away are all
--     reconstructable from nfl_games (year/h/v) and PFF franchise_id->team is a
--     stable global 1:1 (32 franchises), so the dimension carries no vendor
--     scratch.
--
-- Data-integrity precheck (prod, 2026-07-23): every retyped epoch column holds
--   SECONDS (max ~1.78e9). Each epoch column carries DEFAULT EXTRACT(epoch FROM
--   now()); the DEFAULT must be dropped before the TYPE change (it will not cast
--   to timestamptz) and re-set to now().
-- nfl_games.esbid is integer; pff_game_id_map.esbid is varchar -> cast in backfill.

BEGIN;

-- ===========================================================================
-- 1. year -> season_year (columns, then dependent index/constraint names)
-- ===========================================================================
ALTER TABLE public.pff_player_facet_seasonlogs RENAME COLUMN year TO season_year;
ALTER TABLE public.pff_player_seasonlogs        RENAME COLUMN year TO season_year;
ALTER TABLE public.pff_team_gamelogs            RENAME COLUMN year TO season_year;
ALTER TABLE public.pff_team_seasonlogs          RENAME COLUMN year TO season_year;
ALTER TABLE public.pff_unresolved_players       RENAME COLUMN year TO season_year;

ALTER INDEX public.idx_pff_team_gamelogs_team_year      RENAME TO idx_pff_team_gamelogs_team_season_year;
ALTER INDEX public.idx_pff_team_gamelogs_team_year_week RENAME TO idx_pff_team_gamelogs_team_season_year_week;
ALTER INDEX public.idx_pff_team_gamelogs_year_week      RENAME TO idx_pff_team_gamelogs_season_year_week;
ALTER INDEX public.idx_pff_team_seasonlogs_team_year    RENAME TO idx_pff_team_seasonlogs_team_season_year;
ALTER INDEX public.idx_pff_team_seasonlogs_year         RENAME TO idx_pff_team_seasonlogs_season_year;
ALTER INDEX public.pff_player_facet_seasonlogs_franchise_year_facet_idx RENAME TO pff_player_facet_seasonlogs_franchise_season_year_facet_idx;
ALTER INDEX public.pff_player_facet_seasonlogs_pid_year_idx             RENAME TO pff_player_facet_seasonlogs_pid_season_year_idx;
ALTER INDEX public.pff_player_facet_seasonlogs_year_facet_idx           RENAME TO pff_player_facet_seasonlogs_season_year_facet_idx;
ALTER INDEX public.pff_unresolved_players_year_idx      RENAME TO pff_unresolved_players_season_year_idx;

ALTER TABLE public.pff_team_gamelogs   RENAME CONSTRAINT pff_team_gamelogs_nfl_team_year_week_key TO pff_team_gamelogs_nfl_team_season_year_week_key;
ALTER TABLE public.pff_team_seasonlogs RENAME CONSTRAINT pff_team_seasonlogs_nfl_team_year_key      TO pff_team_seasonlogs_nfl_team_season_year_key;

-- ===========================================================================
-- 2. epoch-int -> timestamptz (drop epoch default, retype, re-default now())
-- ===========================================================================

-- 2a. Upserted current-state logs: "timestamp" -> updated_at (NOT NULL kept).
ALTER TABLE public.pff_player_facet_gamelogs
  ALTER COLUMN "timestamp" DROP DEFAULT,
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp"),
  ALTER COLUMN "timestamp" SET DEFAULT now();
ALTER TABLE public.pff_player_facet_gamelogs RENAME COLUMN "timestamp" TO updated_at;

ALTER TABLE public.pff_player_facet_seasonlogs
  ALTER COLUMN "timestamp" DROP DEFAULT,
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp"),
  ALTER COLUMN "timestamp" SET DEFAULT now();
ALTER TABLE public.pff_player_facet_seasonlogs RENAME COLUMN "timestamp" TO updated_at;

ALTER TABLE public.pff_team_gamelogs
  ALTER COLUMN "timestamp" DROP DEFAULT,
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp"),
  ALTER COLUMN "timestamp" SET DEFAULT now();
ALTER TABLE public.pff_team_gamelogs RENAME COLUMN "timestamp" TO updated_at;

ALTER TABLE public.pff_team_seasonlogs
  ALTER COLUMN "timestamp" DROP DEFAULT,
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp"),
  ALTER COLUMN "timestamp" SET DEFAULT now();
ALTER TABLE public.pff_team_seasonlogs RENAME COLUMN "timestamp" TO updated_at;

-- 2b. pff_unresolved_players first_seen/last_seen: retype in place (NOT NULL kept).
ALTER TABLE public.pff_unresolved_players
  ALTER COLUMN first_seen DROP DEFAULT,
  ALTER COLUMN first_seen TYPE timestamptz USING to_timestamp(first_seen),
  ALTER COLUMN first_seen SET DEFAULT now(),
  ALTER COLUMN last_seen DROP DEFAULT,
  ALTER COLUMN last_seen TYPE timestamptz USING to_timestamp(last_seen),
  ALTER COLUMN last_seen SET DEFAULT now();

-- 2c. ngs_prospect_scores_history: append-only history -> recorded_at renamed
--     observed_at (matches the misc-timeseries _history convention).
ALTER TABLE public.ngs_prospect_scores_history
  ALTER COLUMN recorded_at DROP DEFAULT,
  ALTER COLUMN recorded_at TYPE timestamptz USING to_timestamp(recorded_at),
  ALTER COLUMN recorded_at SET DEFAULT now();
ALTER TABLE public.ngs_prospect_scores_history RENAME COLUMN recorded_at TO observed_at;
ALTER TABLE public.ngs_prospect_scores_history
  RENAME CONSTRAINT ngs_prospect_scores_history_pid_timestamp_key TO ngs_prospect_scores_history_pid_observed_at_key;

-- 2d. ngs_prospect_scores_index.updated_at: retype in place.
ALTER TABLE public.ngs_prospect_scores_index
  ALTER COLUMN updated_at DROP DEFAULT,
  ALTER COLUMN updated_at TYPE timestamptz USING to_timestamp(updated_at),
  ALTER COLUMN updated_at SET DEFAULT now();

-- ===========================================================================
-- 3. Eliminate pff_game_id_map -> nfl_games.pff_game_id
-- ===========================================================================
ALTER TABLE public.nfl_games ADD COLUMN pff_game_id bigint;

UPDATE public.nfl_games g
   SET pff_game_id = m.pff_game_id
  FROM public.pff_game_id_map m
 WHERE m.esbid ~ '^[0-9]+$'
   AND g.esbid = m.esbid::integer;

DROP TABLE public.pff_game_id_map;

COMMIT;
