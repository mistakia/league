-- Set 2026 trade deadline (tddate) for the main league (lid=1).
-- Per league rule: midnight Saturday during the 12th week of the regular season,
-- encoded end-of-day per the existing seasons-row convention (matches ext_date /
-- tran_end 23:59:59 pattern). Locks before Sunday games.
--
-- Week 12 of 2026 = Tue 2026-12-08 -> Mon 2026-12-14 (regular_season_start +
-- 11..12 weeks). Saturday in that span = Sat 2026-12-12.
--
--   tddate  Sat 2026-12-12 23:59:59 EST  -> 1797137999

UPDATE seasons SET tddate = 1797137999 WHERE lid = 1 AND year = 2026;
