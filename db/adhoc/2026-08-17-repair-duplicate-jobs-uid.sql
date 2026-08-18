-- STATUS: APPLIED 2026-08-18 against league_production
--
-- Reassign the duplicate `jobs.uid` values so a primary key can be established
-- on the column.
--
-- This is the hard prerequisite for the `jobs.uid` -> `jobs.job_id` batch of
-- [[user:task/league/retire-uid-surrogate-key-column.md]]. That batch adds
-- `jobs_pkey`, and the constraint raises a duplicate-key violation as written
-- until this file has run.
--
-- ---------------------------------------------------------------------------
-- Why the duplicates exist, and why a scratch rehearsal cannot see them
-- ---------------------------------------------------------------------------
--
-- `jobs.uid` has carried `nextval('jobs_uid_seq')` as its default since the
-- MySQL migration and has NEVER had a unique constraint of any kind -- the
-- table has zero constraints, which `pg_constraint` confirms. So the sequence
-- has always been an unenforced convention, and two rows collided:
--
--   uid  type  is_successful  run_at                    reason
--   ---  ----  -------------  ------------------------  -----------------------------------
--     1     2  false          2020-09-04T01:30:06.000Z  no waivers to process
--     1     3  true           2024-07-16T21:00:18.000Z  no poaching waivers to process
--     2     3  false          2020-09-04T01:30:06.000Z  no waivers to process
--     2     4  true           2024-07-16T21:00:18.000Z  no poaching claims to process
--
-- All four are genuinely distinct job runs -- different `type`, different
-- `is_successful`, four years apart. None is a duplicate record of the same
-- event, so NOTHING HERE DELETES A ROW. A job-run log must not lose history to
-- a key repair.
--
-- The full rename DDL was rehearsed on a scratch database loaded from
-- db/schema.postgres.sql and `jobs_pkey` applied there happily, because an
-- empty table satisfies every constraint vacuously. A scratch rehearsal is
-- evidence about DDL VALIDITY and never about data; this file is what covers
-- the other half.
--
-- ---------------------------------------------------------------------------
-- Why reassignment is safe
-- ---------------------------------------------------------------------------
--
-- `jobs.uid` is not referenced by anything, in the schema or in the code:
--
--   * ZERO foreign keys reference `jobs` (pg_constraint, both directions).
--   * The only writer, libs-server/report-job.mjs:147, inserts
--     type/is_successful/reason/run_at and never names `uid`, so no value is
--     persisted anywhere that a reassignment could strand.
--   * The only reader, libs-server/get-jobs.mjs, uses `uid` solely as a
--     within-`type` recency ordinal (`max(uid)` grouped by `type`) to pick the
--     latest run. Reassigning the two colliding rows to values ABOVE the
--     current sequence position preserves that ordering for every type.
--
-- ---------------------------------------------------------------------------
-- What is kept and what moves
-- ---------------------------------------------------------------------------
--
-- Within each duplicated `uid`, the EARLIEST `run_at` keeps the value -- it is
-- the row that legitimately drew it from the sequence -- and every later row is
-- reassigned a fresh `nextval`. Ties break on `ctid` so the choice is total
-- rather than arbitrary; there is no tie in today's data, since (uid, type,
-- run_at) is already distinct across all four rows.
--
-- The rule is written generally rather than against the four measured rows, so
-- a further collision arriving between authoring and apply is repaired too
-- instead of being silently skipped. `jobs` takes writes continuously, so its
-- row count is a moving target and this file never asserts an absolute one.
--
-- db:exec wraps this file in a single transaction; no explicit BEGIN here.

-- ---------------------------------------------------------------------------
-- Step 0 -- capture the pre-repair state
-- ---------------------------------------------------------------------------
--
-- Held in a temp table rather than in a literal, so the post-condition compares
-- against what was actually there at the start of THIS transaction rather than
-- against a count measured by hand hours earlier.

CREATE TEMP TABLE jobs_repair_before ON COMMIT DROP AS
SELECT
  count(*) AS total_rows,
  count(DISTINCT uid) AS distinct_uid,
  count(*) FILTER (WHERE uid IS NULL) AS null_uid
FROM jobs;

-- ---------------------------------------------------------------------------
-- Step 1 -- refuse if the table is not the shape this repair assumes
-- ---------------------------------------------------------------------------
--
-- A NULL `uid` would defeat the primary key just as a duplicate does, and this
-- file does not repair that case. Fail loudly rather than leave the batch to
-- discover it at ADD CONSTRAINT time.

DO $$
DECLARE
  null_count bigint;
BEGIN
  SELECT null_uid INTO null_count FROM jobs_repair_before;

  IF null_count > 0 THEN
    RAISE EXCEPTION
      'REFUSING: % jobs rows carry a NULL uid. This repair reassigns duplicates '
      'only and does not fill nulls; the primary key needs both fixed.',
      null_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 2 -- reassign every non-earliest row of each duplicated uid
-- ---------------------------------------------------------------------------
--
-- `nextval` is evaluated per updated row, so each reassigned row takes its own
-- fresh value. The values land above every existing uid, which is what keeps
-- get-jobs.mjs's `max(uid)` recency ordering intact.

UPDATE jobs
SET uid = nextval('jobs_uid_seq')
WHERE ctid IN (
  SELECT ctid
  FROM (
    SELECT
      ctid,
      row_number() OVER (PARTITION BY uid ORDER BY run_at, ctid) AS row_rank
    FROM jobs
    WHERE uid IN (
      SELECT uid FROM jobs GROUP BY uid HAVING count(*) > 1
    )
  ) ranked
  WHERE row_rank > 1
);

-- ---------------------------------------------------------------------------
-- Step 3 -- prove the repair did what it claims, before committing
-- ---------------------------------------------------------------------------
--
-- Three separate post-conditions, because each is blind to what the others
-- catch: a row could be lost without creating a duplicate, a duplicate could
-- survive without changing the row count, and `distinct_uid` rising by less
-- than the number of repaired rows would mean a reassignment collided with an
-- existing value.

DO $$
DECLARE
  before_total bigint;
  before_distinct bigint;
  after_total bigint;
  after_distinct bigint;
  remaining_duplicates bigint;
BEGIN
  SELECT total_rows, distinct_uid INTO before_total, before_distinct
  FROM jobs_repair_before;

  SELECT count(*), count(DISTINCT uid) INTO after_total, after_distinct
  FROM jobs;

  SELECT count(*) INTO remaining_duplicates
  FROM (SELECT uid FROM jobs GROUP BY uid HAVING count(*) > 1) duplicated;

  IF remaining_duplicates > 0 THEN
    RAISE EXCEPTION
      'REFUSING: % duplicate uid values remain after the repair.',
      remaining_duplicates;
  END IF;

  IF after_total <> before_total THEN
    RAISE EXCEPTION
      'REFUSING: jobs row count moved from % to %. This repair reassigns and '
      'never deletes, so any movement means something else ran.',
      before_total, after_total;
  END IF;

  IF after_distinct <> after_total THEN
    RAISE EXCEPTION
      'REFUSING: % rows carry only % distinct uid values, so the primary key '
      'would still fail.',
      after_total, after_distinct;
  END IF;

  RAISE NOTICE
    'jobs uid repair: % rows, distinct uid % -> %, zero duplicates remain.',
    after_total, before_distinct, after_distinct;
END $$;
