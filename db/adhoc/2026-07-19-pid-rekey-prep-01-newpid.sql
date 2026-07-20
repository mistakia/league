-- Immutable player-id (pid) re-key -- additive prep, step 1 of 2.
--
-- Adds the dedicated opaque-serial sequence and a `new_pid` staging column on
-- `player`, then populates `new_pid = FNAM-LNAM-<serial>` for every person row
-- while leaving team/unit pseudo-rows (DST etc.) with `new_pid = pid`. While
-- `player` carries both `pid` (old) and `new_pid` it IS the old->new map that the
-- prep-02 remap driver and the cutover consume -- no separate map artifact.
--
-- This step is additive and safe to run live, ahead of the cutover window. It is
-- idempotent: guarded creates, and the populate only touches rows whose `new_pid`
-- is still NULL, so a re-run after a partial run completes the remainder.
--
-- Operational note: this runs as one transaction (guard -> populate -> postcondition).
-- Under READ COMMITTED, a player row inserted by a concurrent importer AFTER the
-- populate UPDATE but BEFORE the postcondition would be seen as NULL new_pid and abort
-- the transaction. That is self-healing -- just re-run (the re-run fills only the new
-- NULL row) -- but prefer a low-churn window (not mid-waivers/draft), or pause
-- pid-writing importers, to avoid a spurious abort.
--
-- Run order:
--   1. yarn db:exec db/adhoc/2026-07-19-pid-rekey-prep-01-newpid.sql   (this file)
--   2. NODE_ENV=production node db/adhoc/pid-rekey-prep-02-remap.mjs   (per-partition)
--   3. (cutover window) NODE_ENV=production node db/adhoc/scan-embedded-pids.mjs --apply
--   4. (cutover window) yarn db:exec db/adhoc/2026-07-19-pid-rekey-cutover.sql
--   5. NODE_ENV=production node db/adhoc/check-pid-rekey-coverage.mjs   (must exit 0)
--
-- pid shapes referenced throughout the re-key:
--   person (old): ^[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}$   (FNAM-LNAM-YEAR-DOB)
--   person (new): ^[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{6,}$                             (FNAM-LNAM-serial)
--   team / unit : ^[A-Z]{2,3}(-(OFF|DEF|DST))?$                                 (never re-keyed)

-- 1. Dedicated serial sequence: an opaque monotonic ordinal, one nextval per mint.
--    The same sequence backs this migration backfill and every future runtime mint
--    (create-player.mjs), so serials never overlap.
CREATE SEQUENCE IF NOT EXISTS player_pid_serial_seq AS bigint START WITH 1;

-- 2. Staging column (dropped-in-swap: renamed to `pid` at cutover).
ALTER TABLE player ADD COLUMN IF NOT EXISTS new_pid character varying(25);

-- 2a. Prep-02 sentinel: the single source of truth for "which pid-bearing table has
--     been pre-remapped and verified clean LIVE, outside the downtime window". prep-02
--     upserts one row per table it handles (every partition child + every standalone
--     leaf over the size threshold); the cutover reads it to prove coverage with a cheap
--     catalog lookup instead of re-scanning multi-million-row tables inside the swap.
--     Transient migration scaffolding -- the cutover DROPs it on success.
CREATE TABLE IF NOT EXISTS _pid_rekey_prep_sentinel (
  table_name text PRIMARY KEY,
  row_estimate bigint NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);

-- 2b. Identity no longer depends on dob / nfl_draft_year, so a college-only person
--     with neither is representable. Relax their NOT NULL (idempotent). Retyping dob
--     from varchar to date is out of scope (handled by the schema redesign).
ALTER TABLE player ALTER COLUMN dob DROP NOT NULL;
ALTER TABLE player ALTER COLUMN nfl_draft_year DROP NOT NULL;

-- 3. Pre-condition guard: every existing pid must match exactly one known shape,
--    so a surprise pid is never silently mis-handled by the CASE below.
DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count
  FROM player
  WHERE pid !~ '^[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND pid !~ '^[A-Z]{2,3}(-(OFF|DEF|DST))?$';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'pid-rekey prep-01: % player row(s) have a pid matching neither the person nor the team/unit shape; resolve before re-keying', bad_count;
  END IF;
END $$;

-- 4. Populate new_pid. Person rows -> FNAM-LNAM-<zero-padded serial> (matching the
--    JS generator: strip non-letters, uppercase, first four, X-pad to four; serial
--    lpad to six). Team/unit rows keep their pid. Only NULL rows are touched.
UPDATE player
SET new_pid = CASE
  WHEN pid ~ '^[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  THEN format(
    '%s-%s-%s',
    rpad(left(upper(regexp_replace(fname, '[^a-zA-Z]', '', 'g')), 4), 4, 'X'),
    rpad(left(upper(regexp_replace(lname, '[^a-zA-Z]', '', 'g')), 4), 4, 'X'),
    lpad(nextval('player_pid_serial_seq')::text, 6, '0')
  )
  ELSE pid
END
WHERE new_pid IS NULL;

-- 5. Post-conditions: no NULL new_pid, new_pid globally unique, every value matches
--    an accepted shape. Any failure aborts the transaction (no partial commit).
DO $$
DECLARE
  null_count integer;
  dup_count integer;
  bad_format integer;
BEGIN
  SELECT count(*) INTO null_count FROM player WHERE new_pid IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'pid-rekey prep-01: % row(s) still have NULL new_pid', null_count;
  END IF;

  SELECT count(*) INTO dup_count
  FROM (SELECT new_pid FROM player GROUP BY new_pid HAVING count(*) > 1) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'pid-rekey prep-01: % duplicate new_pid value(s)', dup_count;
  END IF;

  SELECT count(*) INTO bad_format FROM player
  WHERE new_pid !~ '^[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{6,}$'
    AND new_pid !~ '^[A-Z]{2,3}(-(OFF|DEF|DST))?$';
  IF bad_format > 0 THEN
    RAISE EXCEPTION 'pid-rekey prep-01: % new_pid value(s) match no accepted shape', bad_format;
  END IF;

  RAISE NOTICE 'pid-rekey prep-01 OK: new_pid populated, all non-null, unique, and shape-conforming';
END $$;
