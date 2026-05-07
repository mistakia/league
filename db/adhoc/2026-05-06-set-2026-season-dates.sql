-- Set finalized 2026 offseason dates on the seasons row for the main league
-- (lid=1, year=2026). Stale 2025 values were carried forward by the seasons
-- generator; this rewrites them to the canonical 2026 schedule documented in
-- text/home-dynasty-league/league-management/offseason-schedules/2026.md.
--
-- All timestamps are unix epoch (UTC) corresponding to the listed Eastern Time
-- moments (EDT, UTC-4 throughout May-September 2026).
--
--   ext_date                       Sat 2026-05-23 23:59:59 EDT  -> 1779595199
--   tran_start                     Mon 2026-05-25 00:00:00 EDT  -> 1779681600
--   tran_end                       Sun 2026-06-14 23:59:59 EDT  -> 1781495999
--   draft_start                    Wed 2026-07-15 00:00:00 EDT  -> 1784088000
--   free_agency_period_start       Wed 2026-09-02 23:59:59 EDT  -> 1788407999
--   free_agency_live_auction_start Sun 2026-09-06 12:00:00 EDT  -> 1788710400
--   free_agency_period_end         Mon 2026-09-07 23:59:59 EDT  -> 1788839999
--
-- Stale fields cleared so they don't pollute UI: free_agency_live_auction_end
-- and rookie_draft_completed_at carry 2025 values; null them so they get set
-- by the live auction and rookie draft completion flows respectively.

UPDATE seasons SET
  ext_date                       = 1779595199,
  tran_start                     = 1779681600,
  tran_end                       = 1781495999,
  draft_start                    = 1784088000,
  free_agency_period_start       = 1788407999,
  free_agency_live_auction_start = 1788710400,
  free_agency_period_end         = 1788839999,
  free_agency_live_auction_end   = NULL,
  rookie_draft_completed_at      = NULL
WHERE lid = 1 AND year = 2026;
