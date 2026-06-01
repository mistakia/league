-- nfl_coaches own-id migration -- Phase 2 (PK swap + old-column drop).
--
-- Task: user:task/league/migrate-nfl-coaches-to-own-id.md
--
-- Run AFTER Phase 1 (2026-05-31-nfl-coaches-own-id-additive.sql) has been
-- applied and the importer rewrite is staged for same-window deploy. The
-- weekly cron MUST be paused before this adhoc runs and resumed only after
-- the rewritten importer is deployed and dry-run verified.
--
-- =========================================================================
-- ROLLBACK SKETCH (Phase 2; last-resort recovery, not routine)
-- =========================================================================
--   BEGIN;
--   -- 1. Re-create old bridge columns and repopulate from coach_id.
--   ALTER TABLE nfl_game_coaches
--     ADD COLUMN head_coach_pfr_id      varchar(16),
--     ADD COLUMN off_play_caller_pfr_id varchar(16),
--     ADD COLUMN def_play_caller_pfr_id varchar(16);
--   UPDATE nfl_game_coaches b SET head_coach_pfr_id = c.pfr_coach_id
--     FROM nfl_coaches c WHERE c.coach_id = b.head_coach_id;
--   UPDATE nfl_game_coaches b SET off_play_caller_pfr_id = c.pfr_coach_id
--     FROM nfl_coaches c WHERE c.coach_id = b.off_play_caller_id;
--   UPDATE nfl_game_coaches b SET def_play_caller_pfr_id = c.pfr_coach_id
--     FROM nfl_coaches c WHERE c.coach_id = b.def_play_caller_id;
--   -- 2. Re-establish old PK and FKs on nfl_coaches.
--   --    Requires the 8 NULL-pfr_coach_id seed rows be deleted first.
--   DELETE FROM nfl_coaches WHERE pfr_coach_id IS NULL;
--   ALTER TABLE nfl_coaches
--     DROP CONSTRAINT nfl_coaches_pkey,
--     DROP CONSTRAINT nfl_coaches_pfr_coach_id_unique,
--     ALTER COLUMN pfr_coach_id SET NOT NULL,
--     ADD PRIMARY KEY (pfr_coach_id);
--   ALTER TABLE nfl_coaches
--     DROP CONSTRAINT nfl_coaches_pfr_coach_id_basename,
--     ADD CONSTRAINT nfl_coaches_pfr_coach_id_basename
--       CHECK (pfr_coach_id ~ '^[A-Za-z][A-Za-z0-9'']*[0-9]$');
--   -- 3. Re-add old FK constraints on bridge.
--   ALTER TABLE nfl_game_coaches
--     ADD CONSTRAINT nfl_game_coaches_head_coach_pfr_id_fkey
--       FOREIGN KEY (head_coach_pfr_id) REFERENCES nfl_coaches(pfr_coach_id),
--     ADD CONSTRAINT nfl_game_coaches_off_play_caller_pfr_id_fkey
--       FOREIGN KEY (off_play_caller_pfr_id) REFERENCES nfl_coaches(pfr_coach_id),
--     ADD CONSTRAINT nfl_game_coaches_def_play_caller_pfr_id_fkey
--       FOREIGN KEY (def_play_caller_pfr_id) REFERENCES nfl_coaches(pfr_coach_id);
--   COMMIT;
-- =========================================================================

BEGIN;

-- 1. Drift reconciliation: repair any cron-cycle writes to old *_pfr_id
--    columns that occurred between Phase 1 apply and Phase 2 apply. Should
--    touch at most ~32 rows per inter-phase week.
UPDATE nfl_game_coaches b
SET head_coach_id = c.coach_id
FROM nfl_coaches c
WHERE c.pfr_coach_id = b.head_coach_pfr_id
  AND b.head_coach_id IS NULL
  AND b.head_coach_pfr_id IS NOT NULL;

UPDATE nfl_game_coaches b
SET off_play_caller_id = c.coach_id
FROM nfl_coaches c
WHERE c.pfr_coach_id = b.off_play_caller_pfr_id
  AND b.off_play_caller_id IS NULL
  AND b.off_play_caller_pfr_id IS NOT NULL;

UPDATE nfl_game_coaches b
SET def_play_caller_id = c.coach_id
FROM nfl_coaches c
WHERE c.pfr_coach_id = b.def_play_caller_pfr_id
  AND b.def_play_caller_id IS NULL
  AND b.def_play_caller_pfr_id IS NOT NULL;

-- 2. Pre-drop post-condition: every non-NULL *_pfr_id has a *_coach_id
--    counterpart. Abort if any drift was not repaired by step 1 (would
--    indicate a missing dim entry; needs Phase 0 fixture rescrape first).
DO $$
DECLARE
  bad_count int;
BEGIN
  SELECT COUNT(*) INTO bad_count FROM nfl_game_coaches
   WHERE (head_coach_pfr_id      IS NOT NULL AND head_coach_id      IS NULL)
      OR (off_play_caller_pfr_id IS NOT NULL AND off_play_caller_id IS NULL)
      OR (def_play_caller_pfr_id IS NOT NULL AND def_play_caller_id IS NULL);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'pre-drop post-condition FAILED: % rows still have *_pfr_id without *_coach_id', bad_count;
  END IF;
  RAISE NOTICE 'pre-drop post-condition OK: bridge fully reconciled';
END $$;

-- 3. Drop old FK constraints on bridge.
ALTER TABLE nfl_game_coaches
  DROP CONSTRAINT IF EXISTS nfl_game_coaches_head_coach_pfr_id_fkey,
  DROP CONSTRAINT IF EXISTS nfl_game_coaches_off_play_caller_pfr_id_fkey,
  DROP CONSTRAINT IF EXISTS nfl_game_coaches_def_play_caller_pfr_id_fkey;

-- 4. Drop old *_pfr_id columns on bridge.
ALTER TABLE nfl_game_coaches
  DROP COLUMN IF EXISTS head_coach_pfr_id,
  DROP COLUMN IF EXISTS off_play_caller_pfr_id,
  DROP COLUMN IF EXISTS def_play_caller_pfr_id;

-- 5. Add PK on coach_id. The old PK on pfr_coach_id was already dropped in
--    Phase 1 step 4b (so seed rows with NULL pfr_coach_id could be inserted);
--    the table currently has no PK and UNIQUE constraints on both
--    pfr_coach_id and coach_id.
ALTER TABLE nfl_coaches
  ALTER COLUMN coach_id SET NOT NULL,
  ADD PRIMARY KEY (coach_id);

-- The interim UNIQUE constraint added in Phase 1 is now redundant with the PK.
ALTER TABLE nfl_coaches DROP CONSTRAINT IF EXISTS nfl_coaches_coach_id_unique;

-- 6. pfr_coach_id demotion to nullable UNIQUE was completed in Phase 1
--    step 4b. Nothing to do here.

-- 7. Relax basename CHECK to NULL-tolerant.
ALTER TABLE nfl_coaches DROP CONSTRAINT nfl_coaches_pfr_coach_id_basename;
ALTER TABLE nfl_coaches
  ADD CONSTRAINT nfl_coaches_pfr_coach_id_basename
  CHECK (pfr_coach_id IS NULL OR pfr_coach_id ~ '^[A-Za-z][A-Za-z0-9'']*[0-9]$');

-- 8. Add FK constraints on bridge *_coach_id columns.
ALTER TABLE nfl_game_coaches
  ADD CONSTRAINT nfl_game_coaches_head_coach_id_fkey
    FOREIGN KEY (head_coach_id) REFERENCES nfl_coaches(coach_id),
  ADD CONSTRAINT nfl_game_coaches_off_play_caller_id_fkey
    FOREIGN KEY (off_play_caller_id) REFERENCES nfl_coaches(coach_id),
  ADD CONSTRAINT nfl_game_coaches_def_play_caller_id_fkey
    FOREIGN KEY (def_play_caller_id) REFERENCES nfl_coaches(coach_id);

-- 9. Post-condition: sample SELECT joining bridge -> dim via coach_id
--    returns a row count matching the bridge's non-NULL coach_id count.
DO $$
DECLARE
  joined int;
  bridge_count int;
BEGIN
  SELECT COUNT(*) INTO bridge_count FROM nfl_game_coaches WHERE head_coach_id IS NOT NULL;
  SELECT COUNT(*) INTO joined FROM nfl_game_coaches b
    JOIN nfl_coaches c ON c.coach_id = b.head_coach_id;
  IF joined <> bridge_count THEN
    RAISE EXCEPTION 'post-condition FAILED: head_coach_id join count % != bridge count %', joined, bridge_count;
  END IF;
  RAISE NOTICE 'post-condition OK: head_coach_id FK integrity confirmed (% rows)', joined;
END $$;

COMMIT;
