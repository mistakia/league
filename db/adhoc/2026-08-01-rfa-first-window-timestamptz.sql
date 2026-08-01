-- STATUS: APPLIED 2026-08-01 against league_production
-- Conform seasons.restricted_free_agency_first_window_at to timestamptz
--
-- The column shipped as a bigint epoch in
-- db/adhoc/2026-08-01-rfa-configurable-windows.sql, following its neighbours
-- restricted_free_agency_period_start / _end. The schema conformance ratchet
-- correctly flags that as new debt: a new time column has to be timestamptz
-- (see user:guideline/league/database-schema-standards.md).
--
-- The two neighbouring epoch columns stay bigint for now. They are read by the
-- SPA, the verify path and several selectors, so retyping them is its own
-- cluster rather than a rider on this one.

ALTER TABLE seasons
  ALTER COLUMN restricted_free_agency_first_window_at
  TYPE timestamptz
  USING to_timestamp(restricted_free_agency_first_window_at);
