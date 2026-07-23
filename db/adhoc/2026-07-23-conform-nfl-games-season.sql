-- Conform nfl_games season-grain columns to the full-word vocabulary (schema-redesign Section B1).
--   year      -> season_year
--   seas_type -> season_type
--
-- Pure metadata renames (no data movement, no type change). The STORED generated
-- column nfl_week_id and all indexes/constraints that reference these columns
-- (idx_24707_game unique, idx_nfl_games_year_seas_type_esbid,
-- idx_nfl_games_year_seas_type_week_esbid) track columns by attribute number, so
-- the rename rewires them automatically — verified against the full candidate schema
-- on the :5433 test DB. Only the two indexes whose NAMES embed the old column tokens
-- are renamed for naming conformance.
--
-- DEFERRED (not in this adhoc): nfl_games."timestamp" (integer epoch-seconds kickoff
-- time) — a semantic epoch-int->timestamptz retype with JS-arithmetic consumers and a
-- live finalize-game writer path, plus a naming decision (kickoff_at). Its own later pass.
--
-- yarn db:exec db/adhoc/2026-07-23-conform-nfl-games-season.sql
-- yarn export:schema

BEGIN;

ALTER TABLE public.nfl_games RENAME COLUMN year TO season_year;
ALTER TABLE public.nfl_games RENAME COLUMN seas_type TO season_type;

ALTER INDEX public.idx_nfl_games_year_seas_type_esbid
  RENAME TO idx_nfl_games_season_year_season_type_esbid;
ALTER INDEX public.idx_nfl_games_year_seas_type_week_esbid
  RENAME TO idx_nfl_games_season_year_season_type_week_esbid;

COMMIT;
