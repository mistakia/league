-- Push GENESIS LEAGUE (lid=1) 2026 offseason deadlines back by 7 days.
-- Free agency dates intentionally NOT pushed (NFL kickoff is Sep 10; FA auction
-- stays at Sep 6, pre-kickoff). Only extension, RFA, and rookie draft dates move.
--
-- Affected columns (epoch seconds, +604800 = +7 days):
--   ext_date        2026-05-23 23:59 EDT -> 2026-05-30 23:59 EDT
--   tran_start      2026-05-25 00:00 EDT -> 2026-06-01 00:00 EDT
--   tran_end        2026-06-14 23:59 EDT -> 2026-06-21 23:59 EDT
--   draft_start     2026-07-15 00:00 EDT -> 2026-07-22 00:00 EDT

UPDATE seasons
SET
  ext_date    = ext_date    + 604800,
  tran_start  = tran_start  + 604800,
  tran_end    = tran_end    + 604800,
  draft_start = draft_start + 604800
WHERE lid = 1 AND year = 2026;
