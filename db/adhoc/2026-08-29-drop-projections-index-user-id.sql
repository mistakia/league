-- STATUS: APPLIED 2026-08-29 against league_production
-- Drop projections_index.user_id, the second and last step of retiring it.
--
-- RUN THIS ONLY AFTER the user_id-free writers are DEPLOYED. The first step
-- (2026-08-29-retire-projections-index-week-zero.sql) created
-- idx_projections_index_natural_key_no_user beside the old six-column key, so
-- from that point both ON CONFLICT shapes resolve and there is no window in
-- which a projection write has no matching unique index. Dropping the column
-- here removes the old index with it and closes the overlap.
--
-- Confirm before running:
--   ssh league 'cd /root/league && git rev-parse --short HEAD'
-- must be at or past the commit that removes user_id from the five ON CONFLICT
-- target lists (process-projections, generate-dst-market-projections,
-- import-fbg, import-ffn, save-projections). A host still naming user_id in its
-- target list fails every projection write on its next hourly run at :30.
--
-- Why the column is dead rather than merely unused: the user-authored
-- projection feature was removed end to end in 31d596b99, the arm of
-- weight-projections that consumed it went with it, and the only 27 rows that
-- ever carried a non-zero value were the week-0 rows the first step deleted.
-- Everything left was an ON CONFLICT member or a `user_id = 0` filter matching
-- every row.
--
-- SCOPED TO projections_index. projections_history keeps its user_id here, and
-- that is deliberate rather than an oversight: it still holds the same 27
-- non-zero rows, its natural key is a 9.9M-row partitioned index, and the table
-- belongs to user:task/league/split-season-series-from-projections-history.md.
-- The two tables carrying different natural keys is not a defect -- they are
-- separate tables and save_projections already passes each its own key list.
-- projections_history.user_id is DEFAULT 0 NOT NULL, so a writer that has
-- stopped naming the column still lands 0 there.

SET lock_timeout = '30s';
SET statement_timeout = 0;

DO $$
DECLARE
  v_nonzero bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_projections_index_natural_key_no_user'
  ) THEN
    RAISE EXCEPTION 'idx_projections_index_natural_key_no_user does not exist -- step one has not run. Dropping user_id now would leave every ON CONFLICT without a matching index.';
  END IF;

  SELECT count(*) INTO v_nonzero FROM projections_index WHERE user_id <> 0;
  IF v_nonzero <> 0 THEN
    RAISE EXCEPTION '% row(s) still carry a non-zero user_id. The column is not dead and dropping it would destroy data.', v_nonzero;
  END IF;

  RAISE NOTICE 'pre-conditions clean: narrow index present, user_id constant zero.';
END $$;

-- Takes the old six-column unique index with it, on the parent and on all eight
-- partitions.
ALTER TABLE public.projections_index DROP COLUMN user_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projections_index' AND column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION 'user_id survived the drop.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_projections_index_natural_key'
  ) THEN
    RAISE EXCEPTION 'the old six-column natural key index survived, which means it did not include the dropped column and something else is going on.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_projections_index_natural_key_no_user'
  ) THEN
    RAISE EXCEPTION 'the narrow natural key index is gone. projections_index now has no unique key at all.';
  END IF;

  RAISE NOTICE 'post-conditions clean: user_id dropped, old index gone, narrow key intact.';
END $$;
