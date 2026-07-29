-- Establish point-in-time history for the derived league-format projection values.
--
-- Context: raw `projections` is ALREADY a dated append-only store -- `generated_at`
--   sits inside its unique key, and importers upsert `projections_index` (current
--   state) while separately appending to `projections` (history). The derived grain
--   has no such split: `league_format_player_projection_values` is keyed
--   (pid, league_format_id, week, year) and both writers full-DELETE-then-reinsert
--   on every hourly `process-projections.mjs` run, so only the current state exists.
--
-- This adds the missing history side for that derived grain. It is CHANGE-ONLY
--   (slowly-changing-dimension), not a snapshot table: a row is written only when a
--   grain's value differs from its last recorded value. Measured against 30 days of
--   real raw history (2026-06-29..07-29), the player-week change rate is 7.3%
--   (336,101 observation-days collapse to 24,610 distinct versions), so this costs
--   roughly 7% of a daily full snapshot. Full daily snapshots of the 482,412-row
--   2026 grid would be ~176M rows/yr; change-only lands near ~12M/yr worst case.
--   Hourly runs add nothing extra, because an unchanged recompute inserts no row.
--
-- `removed` is a tombstone: when a grain that previously had a value drops out of
--   the computed grid, a removed=true row is written so a point-in-time read
--   resolves to "no value as of D" rather than silently returning a stale value.
--   Without it, a player who fell out of the projection set on day 50 would still
--   report his day-1 salary on day 60 -- exactly the leakage this table exists to
--   prevent.
--
-- No BEGIN/COMMIT: yarn db:exec already wraps the file in one transaction.
-- STATUS: APPLIED 2026-07-29 against league_production

CREATE TABLE public.league_format_player_projection_values_history (
    pid character varying(25) NOT NULL,
    league_format_id text NOT NULL,
    week character varying(10) NOT NULL,
    year smallint NOT NULL,
    pts_added numeric(7,2),
    market_salary numeric(6,2),
    removed boolean DEFAULT false NOT NULL,
    observed_at timestamp with time zone NOT NULL
);

-- Constraint name is abbreviated to stay under the 63-char identifier limit; the
-- unabbreviated form would be silently truncated by Postgres.
ALTER TABLE ONLY public.league_format_player_projection_values_history
    ADD CONSTRAINT lf_player_projection_values_history_league_format_id_fkey
    FOREIGN KEY (league_format_id) REFERENCES public.league_formats(id) ON UPDATE CASCADE;

-- Natural key. One row per grain per observation instant; the writer only emits an
-- observation when the value actually changed, so this stays narrow.
CREATE UNIQUE INDEX idx_lf_player_projection_values_history_natural_key
    ON public.league_format_player_projection_values_history
    USING btree (pid, league_format_id, year, week, observed_at);

-- Serves the point-in-time read: latest observation at or before D for a whole
-- format-year, which is the shape a backtest scans.
--   SELECT DISTINCT ON (pid, week) pid, week, pts_added, market_salary, removed
--   FROM league_format_player_projection_values_history
--   WHERE league_format_id = $1 AND year = $2 AND observed_at <= $3
--   ORDER BY pid, week, observed_at DESC;
CREATE INDEX idx_lf_player_projection_values_history_as_of
    ON public.league_format_player_projection_values_history
    USING btree (league_format_id, year, observed_at);
