-- STATUS: APPLIED 2026-07-29 against league_production
--
-- nfl_games."timestamp" (integer epoch seconds, quoted reserved word) -> kickoff_at timestamptz
--
-- Clears two schema-conformance findings at once: timestamp_type and quoted_camelcase.
--
-- USING-clause correctness, re-verified against production immediately before apply:
--   across all 15,598 rows with a non-null "timestamp",
--     to_timestamp("timestamp") AT TIME ZONE 'America/New_York' = (date || ' ' || time_est)::timestamp
--   holds with zero disagreements AND zero NULL-vacuous comparisons -- every row with a
--   non-null "timestamp" also has a non-null, non-empty date and time_est, so the agreement
--   count is a true 15,598/15,598 and not inflated by rows that compare to NULL.
--   Values span 1970-09-18 to 2027-01-04, so both DST states are exercised.
--
-- The stored epoch is therefore already a true UTC instant: to_timestamp() alone is correct
-- and NO zone shift is involved.
--
-- No dependent views, materialized views, or indexes reference this column (checked via
-- pg_depend against the column's attnum, and pg_indexes), so no drop/recreate is needed.
-- The column stays nullable: 24 rows have a NULL timestamp.

BEGIN;

ALTER TABLE nfl_games
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");

ALTER TABLE nfl_games
  RENAME COLUMN "timestamp" TO kickoff_at;

COMMIT;
