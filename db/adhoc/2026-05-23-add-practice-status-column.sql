-- Adds a per-week practice_status column to the practice table.
--
-- Motivation: nflverse injuries.csv carries a single weekly practice
-- participation value per (pid, season, week). Routing that into our
-- existing day-of-week columns (m/tu/w/th/f/s/su) would fabricate
-- day-specific data we do not have. None of the existing columns
-- (game_designation, roster_status, source_status) carry weekly
-- practice participation -- they carry game-day designation, NFL roster
-- enum, and raw source labels respectively.
--
-- The new practice_status column stores the weekly-aggregate practice
-- token (DNP / LP / FP). nflverse-backfill rows populate it for 2009-2019;
-- Rotowire writes can later be upgraded to derive it from the last
-- non-NULL of the day columns, unifying both sources behind a single
-- queryable field.
--
-- Revert: ALTER TABLE practice DROP COLUMN practice_status;

ALTER TABLE practice ADD COLUMN IF NOT EXISTS practice_status varchar(20);
