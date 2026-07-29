-- STATUS: PENDING
--
-- Stop storing the AVERAGE consensus source in projection history, and remove
-- the vestigial `generated_at` column from `ros_projections`.
--
-- Deletes 61,948 rows from `projections_history` (all `sourceid = 18`, all at
-- the epoch sentinel) and drops `ros_projections.generated_at`.
--
-- WHY
--
-- `sourceid = 18` is AVERAGE, the consensus projection computed by
-- `scripts/process-projections.mjs`. Its rows in `projections_history` carry
-- exactly ONE distinct `generated_at` -- 1970-01-01, the epoch sentinel -- across
-- all 61,948 of them. The write upserted onto a unique key that contains
-- `generated_at`, so a constant timestamp meant every hourly run overwrote the
-- same row in place. The table has accumulated zero consensus history.
--
-- This is not a Postgres-era regression. Every `sourceid = 18` row in the
-- 2023-11-29 MySQL archive was zero-dated (`0000-00-00 00:00:00`) and not one
-- carried a real timestamp. The consensus has never had an observation instant
-- in either era, so nothing is being lost here -- the rows being deleted encode
-- no point in time.
--
-- Giving it a real timestamp is NOT the fix. At the hourly cadence
-- `process-projections.mjs` runs at, a genuinely dated consensus is roughly
-- 184M rows/year, and it would be entirely redundant: the consensus is exactly
-- derivable from the 13 real dated sources already in `projections_history`
-- (the 2020-2023 backfill restored their history back to 2020). To reconstruct
-- it as of an instant D, take each source's latest observation at or before D
-- and re-run `weightProjections`:
--
--   SELECT DISTINCT ON (sourceid, pid, week, season_year, season_type) *
--   FROM projections_history
--   WHERE generated_at <= D
--   ORDER BY sourceid, pid, week, season_year, season_type, generated_at DESC
--
-- NO CONSUMER BREAKS
--
-- Nothing reads `projections_history`. All 15 references across `api/`,
-- `libs-server/`, `scripts/`, and `jobs/` are `.insert()`; there are zero
-- reads. AVERAGE remains in `projections_index`, which IS the current-state read
-- path that data views and `get-players.mjs` depend on, and which this file does
-- not touch.
--
-- SCOPE OF THE DELETE
--
-- `sourceid = 18` is the only source with any epoch-dated row, and all 61,948
-- rows carry `userid = 0` -- none are user-authored projections (those come from
-- `api/routes/projections.mjs` with a real `new Date()`). 1,035 of them are
-- `season_year = 2020` and are the only pre-2024 rows that predate the backfill;
-- they are still epoch rows and still in scope.
--
-- ros_projections
--
-- `ros_projections` is AVERAGE-only (3,192 rows, 1 distinct sourceid, 1 distinct
-- `generated_at`). Unlike the history table its unique key is
-- `(sourceid, pid, season_year)` -- `generated_at` is NOT part of it. So the table
-- was already straightforwardly current-state and the epoch-pinned column was
-- pure dead weight rather than a broken key. No reader touches it: both read
-- sites (`libs-server/get-players.mjs`, `scripts/process-projections-for-scoring-format.mjs`)
-- pull whole rows but use only stat fields, and the one frontend mention
-- (`app/core/players/reducer.js`) destructures `generated_at` off in order to
-- DISCARD it, which tolerates its absence. Dropped rather than commented,
-- because a NOT NULL column pinned to a constant invites exactly the
-- "just give it a real timestamp" change this ruling exists to prevent.
--
-- ORDERING
--
-- The `scripts/process-projections.mjs` sweep that stops writing both must be
-- DEPLOYED before this file is applied. Otherwise the `30 * * * *` run
-- re-inserts the AVERAGE history rows, and the `ros_projections` insert fails on
-- a column that no longer exists.

-- `yarn db:exec` already wraps this file in a single transaction with
-- ON_ERROR_STOP=1, so no explicit BEGIN/COMMIT here.

-- Guard: if any AVERAGE row has picked up a real timestamp, then real consensus
-- history now exists and deleting on this predicate is no longer safe. Stop.
DO $$
DECLARE dated bigint;
BEGIN
  SELECT count(*) INTO dated
  FROM public.projections_history
  WHERE sourceid = 18 AND generated_at >= '1990-01-01';

  IF dated > 0 THEN
    RAISE EXCEPTION
      'projections_history holds % AVERAGE rows with a real generated_at; refusing to delete', dated;
  END IF;
END $$;

DELETE FROM public.projections_history
WHERE sourceid = 18
  AND generated_at < '1990-01-01';

ALTER TABLE public.ros_projections DROP COLUMN generated_at;
