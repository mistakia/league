-- Rename the top-level `splits` key to `row_axes` in every saved view's
-- table_state, completing the data-views `splits` -> `row_axes` vocabulary
-- rename on the persistence layer.
--
-- Background: the data-views time-axis row-expansion field (`['year']` /
-- `['year','week']` / `[]`) was renamed from `splits` to `row_axes` across
-- server, libs-shared, react-table, and the league client (see
-- `text/league/data-views/source-bridge-architecture.md` and task
-- `task/league/data-views/rename-splits-to-row-axes.md`). The renamed
-- validators reject the legacy `splits` key, so every persisted saved view
-- must carry `row_axes` instead or it will fail to parse on load.
--
-- Rewrite: for each row whose table_state has a top-level `splits` key, copy
-- its value verbatim under `row_axes` and drop `splits`. The value is moved
-- as-is, so `null`, empty-array (`[]`), and populated cases
-- (`['year']`, `['year','week']`) are all preserved. `row_grain` and every
-- other table_state field are untouched.
--
-- Scope note: only the TOP-LEVEL `splits` key is persisted in table_state.
-- Column-def `splits`/`row_axes` is library-side metadata and is NOT written
-- into persisted `table_state.columns[]` (those are column references --
-- strings or `{column_id, params}` -- verified by source grep). If a
-- deploy-time production check
-- (`SELECT count(*) FROM user_data_views WHERE table_state::text LIKE '%"columns"%splits%';`)
-- finds legacy nested shapes, extend this migration with a nested-path rewrite
-- before running.
--
-- Idempotency: the WHERE clause and the assertion both key on the presence of
-- the top-level `splits` key, so re-running on an already-migrated database is
-- a no-op.

BEGIN;

UPDATE user_data_views
SET table_state = (
  ((table_state::jsonb) - 'splits')
  || jsonb_build_object('row_axes', (table_state::jsonb) -> 'splits')
)::json
WHERE (table_state::jsonb) ? 'splits';

-- Verify zero rows retain the legacy top-level `splits` key before committing.
-- A non-zero count (mid-flight write, partial prior migration) aborts the
-- transaction so nothing is changed.
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT count(*) INTO remaining
    FROM user_data_views
   WHERE (table_state::jsonb) ? 'splits';
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'expected 0 user_data_views retaining top-level splits key, got %', remaining;
  END IF;
END$$;

COMMIT;
