-- Clear stale Franchise (tag=2) and Rookie (tag=3) tags carried forward from
-- 2025 to year=2026 week=0 by the rosters generator. Verified via the
-- `transactions` table (lid=1, year=2026, type IN (10,11,12) -> 0 rows) that
-- no team has manually applied a 2026 tag through the now-active UI, so all
-- matched rows are pure carry-forwards safe to reset to REGULAR (tag=1).
--
-- The companion fix at scripts/generate-rosters.mjs:79-106 prevents this on
-- future year rollovers; this is a one-time backfill for the already-existing
-- 2026 row, which was generated before that fix landed.
--
-- Affected: 6 Franchise + 5 Rookie = 11 rows.

UPDATE rosters_players
SET tag = 1
WHERE lid = 1
  AND year = 2026
  AND week = 0
  AND tag IN (2, 3);
