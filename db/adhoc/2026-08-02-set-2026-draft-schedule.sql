-- STATUS: APPLIED 2026-08-02 against league_production
-- 2026 rookie draft: move draft_start to immediately after RFA closes and
-- switch from a 1-hour to a 4-hour pick clock, coast-fair daily window.
--
-- Why: RFA now closes Tue Aug 11 4:59pm ET (restricted_free_agency_period_end
-- = 1786481999), so the draft should start Wed Aug 12, not the previously
-- configured Sat Aug 22 (draft_start = 1787371200). At the hourly cadence set
-- by db/adhoc/2026-07-28-set-2026-hourly-draft-windows.sql, 58 picks would
-- finish in under 5 days, leaving most of the Aug 12 - Sep 2 (free agency
-- period start) runway unused and managers with ~1 hour of reaction time per
-- pick.
--
-- Commissioner election (operator-approved 2026-08-02, recorded in
-- user:text/home-dynasty-league/league-management/governance-reference.md):
-- daily window 11am-11pm ET (8am-8pm PT) -- the overlap of "reasonable waking
-- hours" (8am-11pm local) for both coasts -- and a 4-hour pick clock via the
-- newly-added draft_pick_interval (db/adhoc/2026-08-02-add-draft-pick-interval.sql).
--
-- Verified against libs-shared/get-draft-window.mjs + get-draft-dates.mjs:
--   pick 1   window opens  Wed 2026-08-12 11:00 ET
--   pick 58  window opens  Mon 2026-08-31 11:00 ET
--   draftEnd (hard deadline)     Mon 2026-08-31 23:59 ET
--   waiverEnd (undrafted -> PS waivers)  Tue 2026-09-01 23:59 ET
--
-- That clears practice-squad protection opening (Tue Sep 8, per the
-- companion practice_squad_protection_start fix) and the free-agency period
-- start (Wed Sep 2 23:59:59 ET) with several days of buffer, while using
-- nearly the entire Aug 12 - Sep 1 runway.
--
-- yarn db:exec db/adhoc/2026-08-02-set-2026-draft-schedule.sql

UPDATE seasons
SET
  draft_start          = EXTRACT(EPOCH FROM (TIMESTAMP '2026-08-12 00:00:00' AT TIME ZONE 'America/New_York'))::bigint,
  draft_type           = 'hour',
  draft_pick_interval  = 4,
  draft_hour_min       = 11,
  draft_hour_max       = 23
WHERE lid = 1
  AND year = 2026;
