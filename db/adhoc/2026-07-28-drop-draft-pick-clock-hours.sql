-- Drop seasons.draft_pick_clock_hours. The column gated nothing and is now read
-- by no code.
--
-- Added 2026-07-16 to record a 12-hour pick clock commissioner election, but
-- getDraftWindow — the function that actually decides when a pick may be made —
-- never took a clock-hours parameter. The column only ever fed notification
-- message text, so the league ran twelve days believing in a 12-hour clock that
-- did not exist. As of a9846b7e the notification derives its deadline from
-- getDraftWindow directly.
--
-- The real deadline is not a scalar: it is getDraftWindow(pick + 1), ~1 hour
-- mid-day and ~11.5 hours across the overnight gap under the 2026 settings. Any
-- single-number column here is a lie waiting to drift back, which is why this
-- drops rather than repairs.
--
-- No behavior change: nothing reads the column. db/adhoc/2026-07-16-add-draft-
-- pick-clock.sql stays in place as accurate history.
--
-- yarn db:exec db/adhoc/2026-07-28-drop-draft-pick-clock-hours.sql

ALTER TABLE public.seasons
  DROP COLUMN IF EXISTS draft_pick_clock_hours;
