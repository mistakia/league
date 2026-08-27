-- Destructive half of the projection-period cutover. Companion to the two
-- additive files applied earlier today:
--   db/adhoc/2026-08-26-projection-period-tables.sql
--   db/adhoc/2026-08-26-projection-period-salary-variants-and-baselines.sql
--
-- Those created the five period tables and migrated the sentinel rows into
-- them. This file takes the schema to its end state: it deletes the sentinel
-- rows that still sit in the week tables, narrows `week` to smallint NOT NULL
-- with a 1..18 CHECK on the four tables that carried the overload, renames the
-- weekly `projected_points_added` to `projected_points_added_net` (the weekly
-- points-added is one signed number, so it is the net variant), drops the
-- weekly `market_salary`, rebuilds the projection-value history table without
-- its week-0 / 'ros' / 'ros_net' rows, and renames `ros_projections` to
-- `rest_of_season_projections`.
--
-- This file MUST NOT land before the reader/writer/SPA sweep is deployed: it
-- renames columns the deployed code still names. The sweep ships in the SAME
-- commit as this file's apply + the schema export + the regenerated types, and
-- the deploy is immediately behind it, timed outside the hourly :30 pipeline
-- cycle.
--
-- THE SENTINELS ARE REMNANTS, NOT LIVE DATA. All their values were migrated
-- to the period tables by the additive files, and the deployed writer now
-- writes weeks 1..18 to the week tables and the periods to their own tables.
-- Nothing re-enters these week sentinels.
--
-- WEEK IS NOW A REAL FANTASY WEEK ON FOUR TABLES. The overload lived in the
-- `week` column of scoring_format_player_projection_points,
-- league_format_player_projection_values, its history mirror, and
-- league_baselines (whose week='0' rows were folded into league_season_baselines
-- by the operator ruling 2026-08-26). All four narrow to smallint NOT NULL with
-- a 1..18 CHECK, so neither the string 'ros' nor a bare 0 can ever be written
-- into any of them again. This reverses the varchar(10) widening made by step
-- (4) of db/adhoc/2026-05-16-restructure-points-added-pipeline.sql; that file
-- is left as audit trail.
--
-- THE WEEKLY MARKET SALARY IS DROPPED, NOT REPOINTED. A price is a
-- season-context quantity -- a share of the discretionary cap for the year --
-- so a per-week one was never a useful number. The writers' weekly insert and
-- the weekly history value_columns drop it in the same coordinate sweep, and
-- the data-view column `player_week_projected_market_salary` was already
-- retired in the sweep rather than repointed.
--
-- THE HISTORY REBUILD IS A REBUILD, NOT A DELETE. Dropping ~5.4M of ~8.4M rows
-- in place would leave bloat needing a full VACUUM on a ~1.8 GB table, so the
-- week-0 and 'ros'/'ros_net' rows are excluded by construction: create a fresh
-- table, insert only weeks 1..18, drop the old relation, rename the new one
-- into place. Verified lossless against production 2026-08-26: the latest
-- week-0 observation per grain is a tombstone on every one of its 29,058
-- grains, so the sealed season value already lives in
-- league_format_player_season_projection_values and discarding the churn loses
-- nothing.
--
-- Oracles below are computed FROM the source rows at apply time, never
-- hardcoded -- row counts move whenever the pipeline runs. `anomalies` within
-- the DO block, then these checks run; each pre-narrow table asserts it holds
-- nothing outside numeric weeks 1..18 before the USING smallint cast and the
-- CHECK reject any row.
--
-- The rebuilt history needs ANALYZE in this same file (a fresh relation has no
-- statistics). The three ALTER-narrowed tables keep their existing indexes --
-- Postgres rebuilds them as part of the retype.
--
-- No BEGIN/COMMIT: yarn db:exec wraps the file in one transaction. The
-- statement_timeout / lock_timeout overrides below are transaction-local and
-- revert when it ends; the server's default statement_timeout is 40s and would
-- cancel the history rebuild partway with no rollback message from a scratch
-- rehearsal.
-- STATUS: APPLIED 2026-08-27 against league_production

SET lock_timeout = '30s';
SET statement_timeout = 0;

-- ---------------------------------------------------------------------------
-- 1. Delete the sentinel rows that remain in the week tables.
-- ---------------------------------------------------------------------------

DELETE FROM public.scoring_format_player_projection_points
WHERE week IN ('0', 'ros');

DELETE FROM public.league_format_player_projection_values
WHERE week IN ('0', 'ros', 'ros_net');

DELETE FROM public.league_baselines
WHERE week = '0';

-- ---------------------------------------------------------------------------
-- 2. Refuse to narrow any table that still carries a non-numeric or
--    out-of-range week. The USING cast would fail too, but on an opaque 22P02;
--    these name the rows.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  offending_count bigint;
  offending_sample text;
BEGIN
  SELECT count(*), string_agg(DISTINCT week, ', ')
  INTO offending_count, offending_sample
  FROM public.scoring_format_player_projection_points
  WHERE week !~ '^[0-9]+$';
  IF offending_count > 0 THEN
    RAISE EXCEPTION
      'refusing to narrow scoring_format_player_projection_points.week: % rows carry a non-numeric week (%)',
      offending_count, offending_sample;
  END IF;
END
$$;

DO $$
DECLARE
  offending_count bigint;
  offending_sample text;
BEGIN
  SELECT count(*), string_agg(DISTINCT week, ', ')
  INTO offending_count, offending_sample
  FROM public.scoring_format_player_projection_points
  WHERE week::int NOT BETWEEN 1 AND 18;
  IF offending_count > 0 THEN
    RAISE EXCEPTION
      'refusing to narrow scoring_format_player_projection_points.week: % rows carry a week outside 1..18 (%)',
      offending_count, offending_sample;
  END IF;
END
$$;

DO $$
DECLARE
  offending_count bigint;
  offending_sample text;
BEGIN
  SELECT count(*), string_agg(DISTINCT week, ', ')
  INTO offending_count, offending_sample
  FROM public.league_format_player_projection_values
  WHERE week !~ '^[0-9]+$';
  IF offending_count > 0 THEN
    RAISE EXCEPTION
      'refusing to narrow league_format_player_projection_values.week: % rows carry a non-numeric week (%)',
      offending_count, offending_sample;
  END IF;
END
$$;

DO $$
DECLARE
  offending_count bigint;
  offending_sample text;
BEGIN
  SELECT count(*), string_agg(DISTINCT week, ', ')
  INTO offending_count, offending_sample
  FROM public.league_format_player_projection_values
  WHERE week::int NOT BETWEEN 1 AND 18;
  IF offending_count > 0 THEN
    RAISE EXCEPTION
      'refusing to narrow league_format_player_projection_values.week: % rows carry a week outside 1..18 (%)',
      offending_count, offending_sample;
  END IF;
END
$$;

DO $$
DECLARE
  offending_count bigint;
  offending_sample text;
BEGIN
  SELECT count(*), string_agg(DISTINCT week, ', ')
  INTO offending_count, offending_sample
  FROM public.league_baselines
  WHERE week !~ '^[0-9]+$';
  IF offending_count > 0 THEN
    RAISE EXCEPTION
      'refusing to narrow league_baselines.week: % rows carry a non-numeric week (%)',
      offending_count, offending_sample;
  END IF;
END
$$;

DO $$
DECLARE
  offending_count bigint;
  offending_sample text;
BEGIN
  SELECT count(*), string_agg(DISTINCT week, ', ')
  INTO offending_count, offending_sample
  FROM public.league_baselines
  WHERE week::int NOT BETWEEN 1 AND 18;
  IF offending_count > 0 THEN
    RAISE EXCEPTION
      'refusing to narrow league_baselines.week: % rows carry a week outside 1..18 (%)',
      offending_count, offending_sample;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. Rename the weekly points-added column to its variant-vocabulary name.
--    The weekly board emits one signed number per player-week, which is the
--    NET variant; this renames rather than adds because positive would be a
--    deration (GREATEST(net, 0)) on this table.
-- ---------------------------------------------------------------------------

ALTER TABLE public.league_format_player_projection_values
  RENAME COLUMN projected_points_added TO projected_points_added_net;

-- ---------------------------------------------------------------------------
-- 4. Drop the weekly market salary.
-- ---------------------------------------------------------------------------

ALTER TABLE public.league_format_player_projection_values
  DROP COLUMN market_salary;

-- ---------------------------------------------------------------------------
-- 5. Narrow week on the three non-history tables.
-- ---------------------------------------------------------------------------

ALTER TABLE public.scoring_format_player_projection_points
  ALTER COLUMN week TYPE smallint USING week::smallint,
  ALTER COLUMN week SET NOT NULL;

ALTER TABLE public.scoring_format_player_projection_points
  ADD CONSTRAINT scoring_format_player_projection_points_week_is_fantasy_week
  CHECK (week BETWEEN 1 AND 18);

ALTER TABLE public.league_format_player_projection_values
  ALTER COLUMN week TYPE smallint USING week::smallint,
  ALTER COLUMN week SET NOT NULL;

ALTER TABLE public.league_format_player_projection_values
  ADD CONSTRAINT league_format_player_projection_values_week_is_fantasy_week
  CHECK (week BETWEEN 1 AND 18);

ALTER TABLE public.league_baselines
  ALTER COLUMN week TYPE smallint USING week::smallint,
  ALTER COLUMN week SET NOT NULL;

ALTER TABLE public.league_baselines
  ADD CONSTRAINT league_baselines_week_is_fantasy_week
  CHECK (week BETWEEN 1 AND 18);

-- ---------------------------------------------------------------------------
-- 6. Rebuild the history table without the sentinel rows and without the
--    weekly market salary. Identifier names are counted, not guessed -- the
--    abbreviated idx_lf_player_* prefix the existing history indexes already
--    use keeps every name under Postgres's silent 63-char truncation point.
-- ---------------------------------------------------------------------------

CREATE TABLE public.league_format_player_projection_values_history_new (
    pid character varying(25) NOT NULL,
    league_format_id text NOT NULL,
    week smallint NOT NULL,
    season_year smallint NOT NULL,
    projected_points_added_net numeric(7,2),
    is_removed boolean DEFAULT false NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    -- Abbreviated to lf_player_* like the table's own indexes and FK; the
    -- spelled-out league_format_ prefix would exceed the 63-char truncation
    -- point and land in the export bearing a silently cut name.
    CONSTRAINT lf_player_projection_values_history_week_is_fantasy_week
      CHECK (week BETWEEN 1 AND 18)
);

INSERT INTO public.league_format_player_projection_values_history_new
    (pid, league_format_id, week, season_year,
     projected_points_added_net, is_removed, observed_at)
SELECT
    pid,
    league_format_id,
    week::smallint,
    season_year,
    projected_points_added,
    is_removed,
    observed_at
FROM public.league_format_player_projection_values_history
WHERE week ~ '^[0-9]+$' AND week::int BETWEEN 1 AND 18;

DO $$
DECLARE
  src bigint;
  dst bigint;
  bad bigint;
BEGIN
  SELECT count(*) INTO src
  FROM public.league_format_player_projection_values_history
  WHERE week ~ '^[0-9]+$' AND week::int BETWEEN 1 AND 18;
  SELECT count(*) INTO dst
  FROM public.league_format_player_projection_values_history_new;
  IF dst <> src THEN
    RAISE EXCEPTION
      'history rebuild mismatch: % qualifying source rows, % rebuilt', src, dst;
  END IF;
  SELECT count(*) INTO bad
  FROM public.league_format_player_projection_values_history_new
  WHERE week NOT BETWEEN 1 AND 18;
  IF bad <> 0 THEN
    RAISE EXCEPTION 'history rebuild contains % rows with week outside 1..18', bad;
  END IF;
  RAISE NOTICE 'history rebuilt: % rows (weeks 1..18)', dst;
END
$$;

DROP TABLE public.league_format_player_projection_values_history;

ALTER TABLE public.league_format_player_projection_values_history_new
  RENAME TO league_format_player_projection_values_history;

CREATE UNIQUE INDEX idx_lf_player_projection_values_history_natural_key
  ON public.league_format_player_projection_values_history
  USING btree (pid, league_format_id, season_year, week, observed_at);

CREATE INDEX idx_lf_player_projection_values_history_as_of
  ON public.league_format_player_projection_values_history
  USING btree (league_format_id, season_year, observed_at);

ALTER TABLE ONLY public.league_format_player_projection_values_history
  ADD CONSTRAINT lf_player_projection_values_history_league_format_id_fkey
  FOREIGN KEY (league_format_id)
  REFERENCES public.league_formats(id) ON UPDATE CASCADE;

GRANT SELECT ON TABLE public.league_format_player_projection_values_history
  TO league_reader;

ANALYZE public.league_format_player_projection_values_history;

-- ---------------------------------------------------------------------------
-- 7. Rename ros_projections to rest_of_season_projections. Postgres carries
--    grants and indexes across a table rename, so no replay is needed -- but it
--    carries the index NAMES too, which would leave the retired `ros` spelling
--    in the export on a table that no longer bears it. The pid index is renamed
--    with the table (34 chars, well inside the 63-char truncation point). The
--    sibling unique index is named idx_24990_sourceid, a numbered remnant of the
--    MySQL import that spans the whole database; it is left to that cluster.
-- ---------------------------------------------------------------------------

ALTER TABLE public.ros_projections RENAME TO rest_of_season_projections;

ALTER INDEX public.idx_ros_projections_pid
  RENAME TO idx_rest_of_season_projections_pid;
