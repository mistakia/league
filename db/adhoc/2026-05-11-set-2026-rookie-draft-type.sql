-- Backfill the 2026 rookie draft pacing fields on the seasons row for the
-- main league (lid=1, year=2026). The 2026-05-06 set-2026-season-dates
-- migration set draft_start but left draft_type/draft_hour_min/draft_hour_max
-- null. The frontend selector get_rookie_draft_next_pick only computes a
-- draftWindow when both draft_start AND draft_type are set, so the missing
-- draft_type caused getTeamEvents to push an event with date=undefined,
-- crashing the league-schedule sort with "Cannot read properties of
-- undefined (reading 'unix')".
--
-- Values mirror the 2022-2025 seasons (day-paced rookie draft, picks open
-- 24h/day) which is the established pattern for this league.

UPDATE seasons SET
  draft_type     = 'day',
  draft_hour_min = 0,
  draft_hour_max = 24
WHERE lid = 1 AND year = 2026;
