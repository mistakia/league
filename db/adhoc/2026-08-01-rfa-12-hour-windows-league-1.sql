-- STATUS: APPLIED 2026-08-01 against league_production
-- League 1, 2026: move restricted free agency to 12-hour nomination windows
--
-- Announcements at 5:00 PM and 5:00 AM ET; bids processed one hour before the
-- next announcement, so at 4:00 AM and 4:00 PM ET.
--
-- 5 PM / 5 AM ET is the pair that best splits waking hours across the league's
-- east- and west-coast managers. Taking "reachable" as 8 AM - 11 PM local, the
-- evening window gives an ET manager 6 waking hours and a PT manager 9; the day
-- window mirrors it at 9 and 6. Boundaries placed inside the waking band (noon
-- or 11 PM ET) would cram nearly all waking time into one window and leave the
-- other dead for both coasts.
--
-- restricted_free_agency_period_start is NOT changed: the period is already open
-- (Aug 1 00:00 ET) and teams have live nominations in. Only the window anchor
-- moves, so the first announcement lands at 5 PM ET today rather than 9 PM.
--
-- period_end moves from Aug 21 to Aug 11 16:59:59 ET. At two nominations a day,
-- 10 teams x 2 tags = 20 windows run from Aug 1 5 PM through Aug 11 5 AM, whose
-- bids process at Aug 11 4 PM. Ending just before the 21st window would open
-- keeps the schedule exactly 20 windows long while leaving an hour of slack for
-- the processing job, which polls every 5 minutes.

UPDATE seasons SET
  restricted_free_agency_first_window_at =
    EXTRACT(EPOCH FROM (TIMESTAMP '2026-08-01 17:00:00' AT TIME ZONE 'America/New_York'))::bigint,
  restricted_free_agency_period_end =
    EXTRACT(EPOCH FROM (TIMESTAMP '2026-08-11 16:59:59' AT TIME ZONE 'America/New_York'))::bigint,
  restricted_free_agency_window_hours = 12,
  restricted_free_agency_processing_lead_hours = 1
WHERE lid = 1 AND year = 2026;
