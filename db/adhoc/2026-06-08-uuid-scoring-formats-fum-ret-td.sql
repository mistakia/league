\set ON_ERROR_STOP on

BEGIN;

-- Normalize fum_ret_td on all UUID scoring format rows from 0 to 6.
-- These rows were created before fum_ret_td was a meaningful scoring field
-- and inherited the schema DEFAULT of 0. The semantic intent for every
-- user-created format is the universal rule: fumble-return TDs are worth 6 pts.
-- Named slug rows were already corrected in 2026-05-29-named-format-catalog-normalize.sql.

UPDATE league_scoring_formats
SET fum_ret_td = 6
WHERE id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND fum_ret_td = 0;

-- Verify: no UUID rows should remain with fum_ret_td = 0
DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM league_scoring_formats
  WHERE id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND fum_ret_td = 0;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Post-update check failed: % UUID rows still have fum_ret_td=0', remaining;
  END IF;
END $$;

COMMIT;
