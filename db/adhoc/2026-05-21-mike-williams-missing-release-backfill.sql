-- Backfill the two missing ROSTER_RELEASE transactions for Mike Williams on
-- tid=5 in 2020 that left orphan STILL_HELD lineage holdings.
--
-- Evidence (rosters_players, year=2020):
--   week 3 -> tid=5 slot 3 (WR starter)
--   week 5/6/7 -> tid=5 slot 3
--   week 8 -> absent from any tid
--   week 9-11 -> absent
--   week 12 -> tid=5 slot 3 (re-added)
--
-- Recorded transactions on tid=5 for Williams:
--   uid=2671 type=14 ROSTER_ADD ts=2020-09-26 12:11
--   uid=2716 type=1  ROSTER_RELEASE ts=2020-09-30 19:00
--   uid=2889 type=14 ROSTER_ADD ts=2020-10-11 17:06    <- after this, missing RELEASE before next ADD
--   uid=3068 type=14 ROSTER_ADD ts=2020-10-29 14:00    <- after this, missing RELEASE before next ADD
--   uid=3283 type=14 ROSTER_ADD ts=2020-11-25 20:00
--
-- Two synthetic RELEASE rows authorized as best-guess by user 2026-05-21
-- (Discord archive starts 2021-05-05 so direct chat corroboration is not
-- available for 2020). Timestamps chosen as Tuesday 09:00 UTC of the week
-- in which the rosters_players snapshot shows Williams absent (NFL waiver-
-- processing typical day-of-week).
--
--   Release A: 2020-10-27 09:00 UTC = epoch 1603789200, NFL week 8
--     -> closes the lineage holding opened by uid=2889
--   Release B: 2020-11-03 09:00 UTC = epoch 1604394000, NFL week 9
--     -> closes the lineage holding opened by uid=3068
--
-- userid=6 is tid=5's primary 2020 manager (326 of 330 tid=5 transactions
-- attributed to that userid). Value=0 matches all routine RELEASE rows on
-- tid=5 in 2020.
--
-- Filed: user-base task #19 (Backfill Mike Williams missing RELEASEs).
--
-- Post-execution: run
--   NODE_ENV=production node /root/league/scripts/generate-roster-asset-lineage.mjs --lid 1 --rebuild
-- and verify:
--   SELECT holding_id, tid, period_start, period_end, terminated_by
--     FROM roster_asset_holding
--    WHERE lid=1 AND player_id='MIKE-WILL-2017-1994-10-04'
--    ORDER BY period_start;
-- Expect no STILL_HELD (terminated_by=10, period_end=NULL) holdings in the
-- 2020-10/11 window; all should close with terminated_by=RELEASE (2).

BEGIN;

INSERT INTO public.transactions (userid, tid, lid, pid, type, value, week, year, timestamp)
SELECT 6, 5, 1, 'MIKE-WILL-2017-1994-10-04', 1, 0, 8, 2020, 1603789200
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions
  WHERE lid=1 AND tid=5 AND pid='MIKE-WILL-2017-1994-10-04' AND type=1 AND timestamp=1603789200
);

INSERT INTO public.transactions (userid, tid, lid, pid, type, value, week, year, timestamp)
SELECT 6, 5, 1, 'MIKE-WILL-2017-1994-10-04', 1, 0, 9, 2020, 1604394000
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions
  WHERE lid=1 AND tid=5 AND pid='MIKE-WILL-2017-1994-10-04' AND type=1 AND timestamp=1604394000
);

COMMIT;
