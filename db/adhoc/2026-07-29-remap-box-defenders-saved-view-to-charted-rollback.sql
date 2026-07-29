-- STATUS: PENDING
--
-- Rollback for db/adhoc/2026-07-29-remap-box-defenders-saved-view-to-charted.sql.
--
-- Restores view c2e89abe-a2a3-4f42-b4de-ed736118aff9 ("Box Defender Rush
-- Attempts") to the `box_defenders` key, i.e. back to reading the NGS box count
-- rather than the charted one.
--
-- Run this if the remap is judged wrong -- for instance if the view's owner
-- would rather have the NGS numbers it has been returning since 2025-07-24 than
-- the charted numbers its 2025-01-15 author originally selected.
--
-- Scoped to the same single view_id. Idempotent for the same reason as the
-- forward file: the replacement contains no occurrence of the old key.
--
-- yarn db:exec db/adhoc/2026-07-29-remap-box-defenders-saved-view-to-charted-rollback.sql

BEGIN;

UPDATE public.user_data_views
SET table_state = replace(
      table_state::text,
      '"box_defenders_charted":',
      '"box_defenders":'
    )::json
WHERE view_id = 'c2e89abe-a2a3-4f42-b4de-ed736118aff9'
  AND table_state::text LIKE '%"box_defenders_charted":%';

DO $$
DECLARE
  restored int;
BEGIN
  SELECT count(*) INTO restored
  FROM public.user_data_views
  WHERE view_id = 'c2e89abe-a2a3-4f42-b4de-ed736118aff9'
    AND table_state::text LIKE '%"box_defenders":%';
  IF restored <> 1 THEN
    RAISE EXCEPTION 'expected the view to carry box_defenders after rollback';
  END IF;
END $$;

COMMIT;
