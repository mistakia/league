-- STATUS: APPLIED 2026-07-31 against league_production
--
-- Restructure keeptradecut_rankings (EAV) into keeptradecut_valuations (wide),
-- and conform keeptradecut_liquidity in the same pass.
--
-- Task: user:task/league/restructure-keeptradecut-rankings-table.md
--
-- WHAT CHANGES
--   keeptradecut_rankings  ->  keeptradecut_valuations
--     three metrics behind a `type` discriminator with one polymorphic `v`
--     column become three named columns on one row per observation
--     d integer (epoch)     ->  observed_at timestamptz
--     qb smallint (1|2)     ->  is_superflex boolean
--   keeptradecut_liquidity
--     d integer (epoch)     ->  observed_at timestamptz
--     superflex             ->  is_superflex   (conform to the is_ prefix)
--
-- THE OLD TABLE IS RENAMED, NOT DROPPED. scripts/db-exec.sh runs this file as
-- one non-interactive transaction and exits, so there is no post-commit
-- recovery short of a full-database restore. keeptradecut_rankings survives as
-- keeptradecut_rankings_pre_valuations until a dated follow-up drops it, after
-- the task's Phase 5 verification passes.
--
-- ORACLE ORDERING IS LOAD-BEARING. Every DO block below runs BEFORE the
-- ALTER TABLE ... RENAME, because an assertion that reads keeptradecut_rankings
-- after the rename raises 42P01 and would abort a correct migration.
--
-- Counts are derived from the source in this same transaction, never written as
-- literals: the table is written daily by the 04:30 ET importer, so any figure
-- hard-coded at authoring time is stale by apply time.
--
-- db-exec.sh invokes psql --single-transaction --set ON_ERROR_STOP=1, so a
-- RAISE EXCEPTION in any block below stops the file, rolls back the whole
-- transaction, and exits non-zero -- which also leaves this STATUS banner at
-- PENDING, so the audit trail cannot claim an apply that did not land.

-- The swap takes ACCESS EXCLUSIVE on a table serving ~43M index scans. Without
-- this it would queue behind any in-flight read and then block every new reader
-- behind it. Fail fast instead of stalling the API.
SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1. Build the wide table
-- ---------------------------------------------------------------------------

-- max() is EXACT here, not arbitrary: idx_24623_player_value is
-- UNIQUE (pid, d, qb, type), so each (pid, d, qb) group holds at most one row
-- per type and the FILTER'd aggregate sees a single value or none.
CREATE TABLE keeptradecut_valuations AS
SELECT
  pid,
  (qb = 2) AS is_superflex,
  to_timestamp(d) AS observed_at,
  max(v) FILTER (WHERE type = 1)::integer  AS keeptradecut_value,
  max(v) FILTER (WHERE type = 2)::smallint AS position_rank,
  max(v) FILTER (WHERE type = 3)::smallint AS overall_rank
FROM keeptradecut_rankings
GROUP BY pid, d, qb;

-- ---------------------------------------------------------------------------
-- 2. Oracle -- all assertions run while keeptradecut_rankings still exists
-- ---------------------------------------------------------------------------

-- 2a. Row count equals the source's distinct (pid, d, qb) group count.
DO $$
DECLARE
  source_groups bigint;
  target_rows   bigint;
BEGIN
  SELECT count(*) INTO source_groups
    FROM (SELECT 1 FROM keeptradecut_rankings GROUP BY pid, d, qb) g;
  SELECT count(*) INTO target_rows FROM keeptradecut_valuations;

  IF source_groups <> target_rows THEN
    RAISE EXCEPTION
      'row count mismatch: source has % distinct (pid, d, qb) groups, target has % rows',
      source_groups, target_rows;
  END IF;
END $$;

-- 2b. keeptradecut_value is universal -- every group carries a type = 1 row.
--     This is what makes the NOT NULL below safe, and it is asserted rather
--     than assumed because the three vendor arrays are parsed independently.
DO $$
DECLARE
  missing_value bigint;
BEGIN
  SELECT count(*) INTO missing_value
    FROM keeptradecut_valuations WHERE keeptradecut_value IS NULL;

  IF missing_value <> 0 THEN
    RAISE EXCEPTION
      '% target rows carry a NULL keeptradecut_value; a rank exists whose (pid, d, qb) has no value row',
      missing_value;
  END IF;
END $$;

-- 2c. Each of the three metrics preserves its exact source row count.
DO $$
DECLARE
  metric        record;
  source_count  bigint;
  target_count  bigint;
BEGIN
  FOR metric IN
    SELECT * FROM (VALUES
      (1, 'keeptradecut_value'),
      (2, 'position_rank'),
      (3, 'overall_rank')
    ) AS t(type_id, column_name)
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM keeptradecut_rankings WHERE type = %s', metric.type_id
    ) INTO source_count;
    EXECUTE format(
      'SELECT count(%I) FROM keeptradecut_valuations', metric.column_name
    ) INTO target_count;

    IF source_count <> target_count THEN
      RAISE EXCEPTION
        'metric % (type %) count mismatch: source % rows, target % non-null',
        metric.column_name, metric.type_id, source_count, target_count;
    END IF;
  END LOOP;
END $$;

-- 2d. The four nullability classes account for every row, with no fifth class.
--     Derived from the source in this transaction, not from authoring-time
--     literals. A fifth class means the importer emitted a shape the wide
--     schema does not model.
DO $$
DECLARE
  unexpected bigint;
BEGIN
  SELECT count(*) INTO unexpected
    FROM keeptradecut_valuations
   WHERE NOT (
         (position_rank IS NOT NULL AND overall_rank IS NOT NULL)  -- full, non-RDP
      OR (position_rank IS NULL     AND overall_rank IS NOT NULL)  -- full, RDP pick
      OR (position_rank IS NULL     AND overall_rank IS NULL)      -- daily, value only
   );

  IF unexpected <> 0 THEN
    RAISE EXCEPTION
      '% rows fall outside the three modelled nullability classes (a position rank without an overall rank)',
      unexpected;
  END IF;
END $$;

-- 2e. Temporal bounds are preserved exactly under to_timestamp.
DO $$
DECLARE
  source_min timestamptz;
  source_max timestamptz;
  target_min timestamptz;
  target_max timestamptz;
BEGIN
  SELECT to_timestamp(min(d)), to_timestamp(max(d))
    INTO source_min, source_max FROM keeptradecut_rankings;
  SELECT min(observed_at), max(observed_at)
    INTO target_min, target_max FROM keeptradecut_valuations;

  IF source_min <> target_min OR source_max <> target_max THEN
    RAISE EXCEPTION
      'observed_at bounds moved: source [%, %], target [%, %]',
      source_min, source_max, target_min, target_max;
  END IF;
END $$;

-- 2f. Every source group resolves to exactly one target row, matched on the
--     full key rather than on counts alone -- 2a would pass if two groups
--     collided and a third vanished.
DO $$
DECLARE
  unmatched bigint;
BEGIN
  SELECT count(*) INTO unmatched
    FROM (SELECT pid, d, qb FROM keeptradecut_rankings GROUP BY pid, d, qb) s
    LEFT JOIN keeptradecut_valuations v
      ON v.pid = s.pid
     AND v.is_superflex = (s.qb = 2)
     AND v.observed_at = to_timestamp(s.d)
   WHERE v.pid IS NULL;

  IF unmatched <> 0 THEN
    RAISE EXCEPTION '% source groups have no matching target row', unmatched;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Constraints, indexes, grants
-- ---------------------------------------------------------------------------

ALTER TABLE keeptradecut_valuations
  ALTER COLUMN pid                SET NOT NULL,
  ALTER COLUMN is_superflex       SET NOT NULL,
  ALTER COLUMN observed_at        SET NOT NULL,
  ALTER COLUMN keeptradecut_value SET NOT NULL;

-- The PK absorbs both idx_24623_player_value (the upsert conflict probe --
-- Postgres infers the constraint by column SET, not order, so an onConflict
-- naming these three in any order resolves here) and
-- idx_keeptradecut_rankings_pid_qb_type_d.
ALTER TABLE keeptradecut_valuations
  ADD CONSTRAINT keeptradecut_valuations_pkey
  PRIMARY KEY (pid, is_superflex, observed_at);

-- Replaces idx_keeptradecut_rankings_qb_type_d_pid (the date-range scan path).
-- idx_keeptradecut_rankings_type_qb_d_v is deliberately NOT replaced: its
-- leading column ceases to exist, and it read ~28,700 tuples per scan --
-- a full-table proxy wearing an index's name.
CREATE INDEX idx_keeptradecut_valuations_is_superflex_observed_at_pid
  ON keeptradecut_valuations (is_superflex, observed_at, pid);

GRANT SELECT ON TABLE keeptradecut_valuations TO league_reader;

-- ---------------------------------------------------------------------------
-- 4. Conform keeptradecut_liquidity
-- ---------------------------------------------------------------------------

-- Capture the pre-retype shape so the assertion after it is a real comparison
-- rather than a non-emptiness check. Temp table, so it dies with the session.
CREATE TEMP TABLE liquidity_pre_retype AS
SELECT count(*) AS rows_before, count(DISTINCT d) AS days_before
  FROM keeptradecut_liquidity;

ALTER TABLE keeptradecut_liquidity RENAME COLUMN superflex TO is_superflex;

ALTER TABLE keeptradecut_liquidity DROP CONSTRAINT keeptradecut_liquidity_pkey;

ALTER TABLE keeptradecut_liquidity
  ALTER COLUMN d TYPE timestamptz USING to_timestamp(d);

ALTER TABLE keeptradecut_liquidity RENAME COLUMN d TO observed_at;

ALTER TABLE keeptradecut_liquidity
  ADD CONSTRAINT keeptradecut_liquidity_pkey
  PRIMARY KEY (pid, is_superflex, observed_at);

-- Effectively unused: tens of scans against millions for the rankings indexes,
-- and liquidity has no read consumer besides the importer's own write path.
DROP INDEX IF EXISTS idx_keeptradecut_liquidity_d_superflex;

-- 4a. The retype is in-place, so both the row count and the distinct-day count
--     must be identical to what they were before it. A collision between two
--     epochs mapping to one timestamptz would show up as a lost day here.
DO $$
DECLARE
  -- Deliberately NOT named rows_before/days_before: a PL/pgSQL variable sharing
  -- a name with a selected column is an ambiguous reference and errors out.
  prior_rows bigint;
  prior_days bigint;
  final_rows bigint;
  final_days bigint;
BEGIN
  SELECT rows_before, days_before INTO prior_rows, prior_days
    FROM liquidity_pre_retype;
  SELECT count(*), count(DISTINCT observed_at) INTO final_rows, final_days
    FROM keeptradecut_liquidity;

  IF prior_rows <> final_rows OR prior_days <> final_days THEN
    RAISE EXCEPTION
      'keeptradecut_liquidity retype was lossy: % rows / % days before, % rows / % days after',
      prior_rows, prior_days, final_rows, final_days;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Retire the old table -- LAST, after every assertion above has passed
-- ---------------------------------------------------------------------------

ALTER TABLE keeptradecut_rankings RENAME TO keeptradecut_rankings_pre_valuations;

ALTER INDEX idx_24623_player_value
  RENAME TO idx_keeptradecut_rankings_pre_valuations_pid_d_qb_type;
ALTER INDEX idx_keeptradecut_rankings_pid_qb_type_d
  RENAME TO idx_keeptradecut_rankings_pre_valuations_pid_qb_type_d;
ALTER INDEX idx_keeptradecut_rankings_qb_type_d_pid
  RENAME TO idx_keeptradecut_rankings_pre_valuations_qb_type_d_pid;
ALTER INDEX idx_keeptradecut_rankings_type_qb_d_v
  RENAME TO idx_keeptradecut_rankings_pre_valuations_type_qb_d_v;
