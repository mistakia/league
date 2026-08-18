-- STATUS: APPLIED 2026-08-18 against league_production
--
-- Retire `uid` from six low-traffic tables, the first window of
-- [[user:task/league/retire-uid-surrogate-key-column.md]].
--
--   jobs.uid                 -> job_id                 (+ primary key)
--   pff_team_gamelogs.uid    -> pff_team_gamelog_id
--   pff_team_seasonlogs.uid  -> pff_team_seasonlog_id
--   playoffs.uid             -> playoff_week_number
--   league_notifications.uid -> notification_id
--   super_priority.uid       -> super_priority_id
--
-- This is the plan's batches 1, 1b and 2 collapsed into one window. They were
-- split only because `seasonlog` was absent from the token vocabulary and
-- shipping `pff_team_seasonlog_id` ahead of the admission would have turned
-- check-schema-conformance-ratchet red on new unbaselined debt. The sibling
-- campaign landed that admission (league 81809fc31), so the reason for the
-- split is gone and one window replaces three.
--
-- ---------------------------------------------------------------------------
-- `playoffs.uid` is NOT a key, and takes a name that says so
-- ---------------------------------------------------------------------------
--
-- It is a playoff-week ordinal. The writer's own comments read
-- `uid: 1 // wildcard round uid`, `uid: 2 // championship round uid`,
-- `uid: 3 // championship round uid` (scripts/process-playoffs.mjs:46,230,238),
-- and consumers read `p.uid === 1` as the wildcard round and `p.uid > 1` as the
-- championship round. So `playoff_round` would be a SECOND wrong name -- 2 and
-- 3 are the same round. It is also not derivable from `week`: one season ran
-- weeks 14/15/16 while five ran 15/16/17. Hence `playoff_week_number`.
--
-- ---------------------------------------------------------------------------
-- `jobs` gets a primary key it has never had
-- ---------------------------------------------------------------------------
--
-- `jobs.uid` has carried a sequence default since the MySQL migration with no
-- unique constraint behind it, so the sequence was an unenforced convention and
-- two values collided. db/adhoc/2026-08-17-repair-duplicate-jobs-uid.sql
-- reassigns them and MUST have been applied before this file runs; the guard in
-- step 0 below refuses rather than letting ADD CONSTRAINT raise a bare
-- duplicate-key error that reads like a bug in this file.
--
-- ---------------------------------------------------------------------------
-- The sequences move with their columns
-- ---------------------------------------------------------------------------
--
-- `ALTER TABLE ... RENAME COLUMN` moves the column and NOTHING else, so leaving
-- `jobs_uid_seq` behind `jobs.job_id` would be exactly the legacy remnant
-- [[user:guideline/design-toward-clean-end-state.md]] forbids. Five of the six
-- tables carry a `<table>_uid_seq`; `playoffs.uid` has no default at all.
--
-- The four owned sequences rewrite their column default automatically as part
-- of the rename, because the dependency is on the sequence OID rather than on
-- its name. `pff_team_gamelogs_uid_seq` and `pff_team_seasonlogs_uid_seq` have
-- NO ownership dependency -- they are wired through a plain default -- so they
-- rewrite for the same reason (regclass is an OID) but nothing would ever
-- cascade to them, which is why they are renamed explicitly here rather than
-- assumed to follow.
--
-- No index is renamed in this batch: none of the six tables carries an index
-- whose NAME contains `uid`. `playoffs.idx_24910_tid` and `playoffs_pkey` both
-- index the renamed column and follow it automatically.
--
-- db:exec wraps this file in a single transaction; no explicit BEGIN here.

-- ---------------------------------------------------------------------------
-- Step 0 -- refuse if the jobs duplicate repair has not run
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  duplicate_count bigint;
  null_count bigint;
BEGIN
  SELECT count(*) INTO duplicate_count
  FROM (SELECT uid FROM jobs GROUP BY uid HAVING count(*) > 1) duplicated;

  SELECT count(*) INTO null_count FROM jobs WHERE uid IS NULL;

  IF duplicate_count > 0 OR null_count > 0 THEN
    RAISE EXCEPTION
      'REFUSING: jobs carries % duplicate uid values and % nulls. Apply '
      'db/adhoc/2026-08-17-repair-duplicate-jobs-uid.sql first -- the primary '
      'key below cannot be established until it has run.',
      duplicate_count, null_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 1 -- rename the columns
-- ---------------------------------------------------------------------------

ALTER TABLE jobs RENAME COLUMN uid TO job_id;
ALTER TABLE pff_team_gamelogs RENAME COLUMN uid TO pff_team_gamelog_id;
ALTER TABLE pff_team_seasonlogs RENAME COLUMN uid TO pff_team_seasonlog_id;
ALTER TABLE playoffs RENAME COLUMN uid TO playoff_week_number;
ALTER TABLE league_notifications RENAME COLUMN uid TO notification_id;
ALTER TABLE super_priority RENAME COLUMN uid TO super_priority_id;

-- ---------------------------------------------------------------------------
-- Step 2 -- rename the sequences to match
-- ---------------------------------------------------------------------------

ALTER SEQUENCE jobs_uid_seq RENAME TO jobs_job_id_seq;
ALTER SEQUENCE pff_team_gamelogs_uid_seq RENAME TO pff_team_gamelogs_pff_team_gamelog_id_seq;
ALTER SEQUENCE pff_team_seasonlogs_uid_seq RENAME TO pff_team_seasonlogs_pff_team_seasonlog_id_seq;
ALTER SEQUENCE league_notifications_uid_seq RENAME TO league_notifications_notification_id_seq;
ALTER SEQUENCE super_priority_uid_seq RENAME TO super_priority_super_priority_id_seq;

-- ---------------------------------------------------------------------------
-- Step 3 -- establish the missing primary key on jobs
-- ---------------------------------------------------------------------------
--
-- Built rather than promoted: `jobs` has no unique index to promote, unlike
-- `leagues` and `trades` in the later batches.

ALTER TABLE jobs ALTER COLUMN job_id SET NOT NULL;
ALTER TABLE jobs ADD CONSTRAINT jobs_pkey PRIMARY KEY (job_id);

-- ---------------------------------------------------------------------------
-- Step 4 -- prove the batch landed, on both surfaces
-- ---------------------------------------------------------------------------
--
-- The conformance audit reads only CREATE TABLE column bodies, so it is
-- structurally blind to sequence and index names and cannot be the oracle here.
-- These two checks are: information_schema for the columns, pg_class for
-- everything around them.

DO $$
DECLARE
  surviving_columns bigint;
  surviving_objects bigint;
  new_columns bigint;
  jobs_key bigint;
BEGIN
  SELECT count(*) INTO surviving_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('jobs', 'pff_team_gamelogs', 'pff_team_seasonlogs',
                       'playoffs', 'league_notifications', 'super_priority')
    AND column_name = 'uid';

  IF surviving_columns > 0 THEN
    RAISE EXCEPTION 'REFUSING: % uid columns survive on the batch tables.',
      surviving_columns;
  END IF;

  SELECT count(*) INTO new_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (table_name, column_name) IN (
      ('jobs', 'job_id'),
      ('pff_team_gamelogs', 'pff_team_gamelog_id'),
      ('pff_team_seasonlogs', 'pff_team_seasonlog_id'),
      ('playoffs', 'playoff_week_number'),
      ('league_notifications', 'notification_id'),
      ('super_priority', 'super_priority_id')
    );

  IF new_columns <> 6 THEN
    RAISE EXCEPTION 'REFUSING: % of 6 renamed columns present.', new_columns;
  END IF;

  SELECT count(*) INTO surviving_objects
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname ~ 'uid'
    AND (c.relname LIKE 'jobs%' OR c.relname LIKE 'pff_team_gamelogs%'
         OR c.relname LIKE 'pff_team_seasonlogs%' OR c.relname LIKE 'playoffs%'
         OR c.relname LIKE 'league_notifications%' OR c.relname LIKE 'super_priority%');

  IF surviving_objects > 0 THEN
    RAISE EXCEPTION 'REFUSING: % uid-named objects survive on the batch tables.',
      surviving_objects;
  END IF;

  SELECT count(*) INTO jobs_key
  FROM pg_constraint WHERE conrelid = 'jobs'::regclass AND contype = 'p';

  IF jobs_key <> 1 THEN
    RAISE EXCEPTION 'REFUSING: jobs carries % primary keys, expected 1.', jobs_key;
  END IF;

  RAISE NOTICE
    'uid retirement batch 1: 6 columns renamed, 5 sequences renamed, jobs_pkey established.';
END $$;
