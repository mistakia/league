-- 2026 rookie draft: switch pick windows from daily to hourly, with real hour
-- bounds, so the draft completes before free agency opens.
--
-- Why: the draft was scheduled to finish after free agency. Under draft_type
-- 'day' a stalled draft advances one pick per day, so 58 picks from Sat Aug 22
-- ran to Sun Oct 18 -- past the Sep 2 free-agency open, the Sep 6 auction, and
-- Sep 10 Opening Day. The league wanted draft-before-FA order restored.
--
-- The lever previously reached for did not work. seasons.draft_pick_clock_hours
-- (set to 12 by db/adhoc/2026-07-16-add-draft-pick-clock.sql as the "12-hour
-- pick cadence" commissioner election) gates nothing: it was read only by
-- scripts/notifications-draft.mjs to compose message text. What actually gates
-- picking is getDraftWindow, which takes no clock-hours parameter. That field
-- is now unread by all code -- notifications-draft.mjs derives the deadline
-- from getDraftWindow directly -- and is left in place pending a separate
-- migration to drop it.
--
-- draft_hour_max is EXCLUSIVE. [9, 22) opens thirteen windows a day, 09:00
-- through 21:00 Eastern. Combined with hourly advancement:
--
--   pick 1  window opens  Sat Aug 22 09:00 ET
--   pick 58 window opens  Wed Aug 26 14:00 ET   (6.4 days before FA opens)
--   draft hard-end        Wed Aug 26 23:59 ET
--
-- Note the hard end: getDraftDates derives it from the same cadence, and the
-- draft route refuses selections past it, so any pick unmade by end of Aug 26
-- is forfeited and its rookies fall to practice-squad waivers. That is a much
-- firmer deadline than the prior Oct 19 and is the point of the change.
--
-- The previous bounds (0/24) made every hour valid, which under hourly
-- advancement would have opened every remaining pick's window within ~2.4 days
-- and left pick order effectively unenforced.
--
-- draft_start is deliberately unchanged: the published calendar's draft start
-- date does not move. The first window opens at 09:00 rather than midnight
-- because midnight falls outside the new daily window.
--
-- Scoped to the 2026 season only. Constitution Article XI Section 8 is
-- conditional on window length and a sub-24h window is precedented, but a
-- permanent sub-24h default would need a ratified amendment.

UPDATE seasons
SET
  draft_type     = 'hour',
  draft_hour_min = 9,
  draft_hour_max = 22
WHERE lid = 1
  AND year = 2026;
