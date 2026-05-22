-- Partial composite index supporting two oracle paths:
--   1. reset-player-restricted-free-agency-tags.mjs:
--        whereNotExists subquery filtering restricted_free_agency_bids
--        on (year, lid, cancelled IS NULL).
--   2. process-restricted-free-agency-bids.mjs:
--        stuck_bids check filtering on (year, lid via join, processed IS NULL,
--        cancelled IS NULL, announced IS NOT NULL).
-- The table is currently empty in the offseason snapshot but accumulates
-- through the RFA bid window. A partial index over (lid, year) WHERE
-- cancelled IS NULL serves both queries (the additional processed IS NULL
-- and announced IS NOT NULL filters are residuals after key probe and
-- remain cheap because the per-(lid, year) cardinality is small).

CREATE INDEX IF NOT EXISTS idx_rfa_bids_lid_year_active
  ON public.restricted_free_agency_bids (lid, year)
  WHERE cancelled IS NULL;
