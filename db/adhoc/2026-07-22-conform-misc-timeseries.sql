-- Conform misc BATCH time-series clusters to the full-word vocabulary end state:
--   year -> season_year; epoch-int timestamp columns -> timestamptz
--   (observed_at for append-only feed history; created_at/inserted_at/updated_at retyped in place).
-- Scope: historical_injury_index (+17 partitions), keeptradecut_pick,
--   player_adp_history/_index, player_rankings_history/_index,
--   nfl_draft_rankings_history/_index.
-- EXCLUDES ngs_prospect_scores_* (fused into the vendor-obfuscation cluster).
-- Data-integrity precheck (prod, 2026-07-22): all retyped columns hold epoch SECONDS
--   (max ~1.78e9, well under the 1e11 ms threshold); nfl_draft_rankings_* are empty.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. historical_injury_index (partitioned parent + 17 yearly partitions 2009-2025)
-- ---------------------------------------------------------------------------
-- Large partitioned table; lift the statement timeout for the epoch->tstz rewrite.
SET LOCAL statement_timeout = '60min';

ALTER TABLE public.historical_injury_index RENAME COLUMN year TO season_year;

ALTER TABLE public.historical_injury_index
  ALTER COLUMN inserted_at TYPE timestamptz USING to_timestamp(inserted_at),
  ALTER COLUMN updated_at TYPE timestamptz USING to_timestamp(updated_at);

-- Parent-level partitioned index names that embed "year".
ALTER INDEX public.idx_historical_injury_index_pid_year
  RENAME TO idx_historical_injury_index_pid_season_year;
ALTER INDEX public.idx_historical_injury_index_year_week
  RENAME TO idx_historical_injury_index_season_year_week;

-- Each partition-child index was auto-named from the old column list at creation and is
-- NOT renamed by the parent ALTER INDEX above -- rename all 34 (17 partitions x 2 indexes).
DO $$
DECLARE
  yr int;
BEGIN
  FOR yr IN 2009..2025 LOOP
    EXECUTE format(
      'ALTER INDEX public.historical_injury_index_%s_pid_year_idx RENAME TO historical_injury_index_%s_pid_season_year_idx',
      yr, yr);
    EXECUTE format(
      'ALTER INDEX public.historical_injury_index_%s_year_week_idx RENAME TO historical_injury_index_%s_season_year_week_idx',
      yr, yr);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. keeptradecut_pick
-- ---------------------------------------------------------------------------
ALTER TABLE public.keeptradecut_pick RENAME COLUMN year TO season_year;

ALTER TABLE public.keeptradecut_pick
  ALTER COLUMN created_at TYPE timestamptz USING to_timestamp(created_at),
  ALTER COLUMN updated_at TYPE timestamptz USING to_timestamp(updated_at);

ALTER INDEX public.idx_keeptradecut_pick_yrs RENAME TO idx_keeptradecut_pick_season_years;

-- ---------------------------------------------------------------------------
-- 3. player_adp_history / player_adp_index
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_adp_history RENAME COLUMN year TO season_year;
ALTER TABLE public.player_adp_history
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.player_adp_history RENAME COLUMN "timestamp" TO observed_at;

ALTER TABLE public.player_adp_index RENAME COLUMN year TO season_year;

ALTER INDEX public.idx_player_adp_history_timestamp RENAME TO idx_player_adp_history_observed_at;
ALTER INDEX public.idx_player_adp_index_year RENAME TO idx_player_adp_index_season_year;

-- ---------------------------------------------------------------------------
-- 4. player_rankings_history / player_rankings_index
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_rankings_history RENAME COLUMN year TO season_year;
ALTER TABLE public.player_rankings_history
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.player_rankings_history RENAME COLUMN "timestamp" TO observed_at;

ALTER TABLE public.player_rankings_index RENAME COLUMN year TO season_year;
-- (no indexes on _history; _index unique constraint name does not embed "year")

-- ---------------------------------------------------------------------------
-- 5. nfl_draft_rankings_history / nfl_draft_rankings_index (dead, retained per operator ruling)
-- ---------------------------------------------------------------------------
ALTER TABLE public.nfl_draft_rankings_history RENAME COLUMN year TO season_year;
ALTER TABLE public.nfl_draft_rankings_history
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.nfl_draft_rankings_history RENAME COLUMN "timestamp" TO observed_at;

ALTER TABLE public.nfl_draft_rankings_index RENAME COLUMN year TO season_year;
ALTER TABLE public.nfl_draft_rankings_index
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.nfl_draft_rankings_index RENAME COLUMN "timestamp" TO observed_at;

COMMIT;
