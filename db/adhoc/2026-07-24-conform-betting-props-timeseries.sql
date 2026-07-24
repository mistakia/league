-- Conform betting/prop/market/wager/combination time-series tables (schema redesign
-- cluster: betting-props-timeseries).
--
-- Transforms:
--   year -> season_year
--   epoch-int(seconds) "timestamp" -> observed_at timestamptz  (USING to_timestamp)
--   placed_wagers.placed_at epoch-int(seconds) -> timestamptz in place (name kept -- already good)
--   selection_combination_definitions.created_at/updated_at timestamp-without-tz -> timestamptz
--   team -> nfl_team ; opp -> opponent_nfl_team ; pos -> position
--   three index names that embedded old tokens renamed
--
-- Epoch unit VERIFIED = seconds (all values 10-digit, spanning 2020-2026) for every retyped
-- column, so to_timestamp() (which reads epoch-seconds) is correct.
--
-- props / props_index are a FROZEN 2020-2023 archive (unique historical player-prop data; keep
-- the rows). Per operator ruling Q1=A, conform only the audit-flagged columns; the heavy betting
-- shorthand (ln/o/u/o_am/u_am/sourceid, props_index hits_*/hist_rate_*/hist_edge_*/...) is left
-- as-is (expanding every column of a frozen dead-write archive is carrying cost with no reader
-- benefit; the audit is the deliberate frontier). Retiring the archive into the canonical
-- prop_markets*/prop_market_selections* pipeline is a separate design investigation.
--
-- Mechanism: atomic RENAME COLUMN (metadata) + ALTER COLUMN TYPE ... USING (row rewrite) in ONE
-- txn. No compat view -- a rename-only view does not shield a TYPE change, and these ARE type
-- changes (schema-standards lesson 2026-07-21). yarn db:exec already wraps this file in a single
-- transaction, so NO BEGIN/COMMIT here. Raise the 40s prod statement_timeout for the
-- multi-million-row retypes (prop_market_selections_history 36.6M, prop_markets_history 12.7M,
-- prop_market_selections_index 9.7M, props 4.14M, prop_markets_index 3.06M).
SET LOCAL statement_timeout = '60min';

-- ==== prop_markets_history (12.7M) ====
ALTER TABLE public.prop_markets_history
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.prop_markets_history RENAME COLUMN "timestamp" TO observed_at;

-- ==== prop_markets_index (3.06M) ====
ALTER TABLE public.prop_markets_index RENAME COLUMN year TO season_year;
ALTER TABLE public.prop_markets_index
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.prop_markets_index RENAME COLUMN "timestamp" TO observed_at;
ALTER INDEX public.idx_prop_markets_index_market_time_year
  RENAME TO idx_prop_markets_index_market_time_season_year;

-- ==== prop_market_selections_history (36.6M) ====
ALTER TABLE public.prop_market_selections_history
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.prop_market_selections_history RENAME COLUMN "timestamp" TO observed_at;

-- ==== prop_market_selections_index (9.7M) ====
ALTER TABLE public.prop_market_selections_index
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.prop_market_selections_index RENAME COLUMN "timestamp" TO observed_at;

-- ==== placed_wagers (64.5K): placed_at int -> timestamptz, name kept ====
ALTER TABLE public.placed_wagers
  ALTER COLUMN placed_at TYPE timestamptz USING to_timestamp(placed_at);

-- ==== selection_combination_definitions: tz-naive created_at/updated_at -> timestamptz ====
-- The naive values were written by DEFAULT now() under the prod session TimeZone
-- America/New_York (single bulk seed; all 8 rows share one created_at), so the stored wall clock
-- is New_York local -- interpret it as such to recover the true instant.
ALTER TABLE public.selection_combination_definitions
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'America/New_York',
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'America/New_York';

-- ==== selection_combination_odds_history (~172) ====
ALTER TABLE public.selection_combination_odds_history RENAME COLUMN year TO season_year;
ALTER TABLE public.selection_combination_odds_history
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.selection_combination_odds_history RENAME COLUMN "timestamp" TO observed_at;

-- ==== selection_combination_odds_index (~171) ====
ALTER TABLE public.selection_combination_odds_index RENAME COLUMN year TO season_year;
ALTER TABLE public.selection_combination_odds_index
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.selection_combination_odds_index RENAME COLUMN "timestamp" TO observed_at;
ALTER INDEX public.idx_selection_combination_odds_index_year_week
  RENAME TO idx_selection_combination_odds_index_season_year_week;

-- ==== prop_pairings: team -> nfl_team ====
ALTER TABLE public.prop_pairings RENAME COLUMN team TO nfl_team;
ALTER INDEX public.idx_prop_pairings_team RENAME TO idx_prop_pairings_nfl_team;

-- ==== weekly_market_selections_analysis_cache: team/opp/pos ====
ALTER TABLE public.weekly_market_selections_analysis_cache RENAME COLUMN team TO nfl_team;
ALTER TABLE public.weekly_market_selections_analysis_cache RENAME COLUMN opp TO opponent_nfl_team;
ALTER TABLE public.weekly_market_selections_analysis_cache RENAME COLUMN pos TO position;

-- ==== props (FROZEN archive, 4.14M): audit-flagged conforms only ====
ALTER TABLE public.props RENAME COLUMN year TO season_year;
ALTER TABLE public.props
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.props RENAME COLUMN "timestamp" TO observed_at;

-- ==== props_index (FROZEN archive, 332K): audit-flagged conforms only ====
ALTER TABLE public.props_index RENAME COLUMN year TO season_year;
ALTER TABLE public.props_index
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.props_index RENAME COLUMN "timestamp" TO observed_at;
ALTER TABLE public.props_index RENAME COLUMN team TO nfl_team;
ALTER TABLE public.props_index RENAME COLUMN opp TO opponent_nfl_team;
ALTER TABLE public.props_index RENAME COLUMN pos TO position;
