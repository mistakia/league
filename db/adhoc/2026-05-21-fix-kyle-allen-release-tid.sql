-- Correct the mis-coded tid on transactions.uid=7580 (Kyle Allen RELEASE,
-- 2022-11-27 14:20). The row currently records tid=5 but the canonical
-- narrative is that tid=3 released Allen the day after the 2022-11-26 trade
-- that brought him to tid=3.
--
-- Evidence:
--   - 2022-11-23 transactions.uid=7544 type=14 on tid=5: Allen joins tid=5.
--   - 2022-11-26 trades.uid=155 propose=5 accept=3 + transactions.uid=7570
--     type=4 on tid=3: TRADE sends Allen from tid=5 to tid=3
--     (trades_players.tid=giver convention; backfilled 2026-05-21
--     adhocs 703d9914 + 33736b43).
--   - 2022-11-27 transactions.uid=7580 type=1 on tid=5: this RELEASE row is
--     the suspect. Allen was on tid=3, not tid=5, at this moment.
--   - 2022-11-30 transactions.uid=7607 type=13 on tid=5: tid=5 PS-waivers
--     Allen back (matches rosters_players week 13 = tid=5 slot 12).
--   - 2022-12-06 transactions.uid=7644 type=5 on tid=3: tid=3 poaches Allen
--     from tid=5 PS (matches rosters_players week 14 = tid=3 slot 11).
--
-- With uid=7580.tid corrected to 3, the roster-asset-lineage walker will
-- close holding 69530 (tid=3, period_start=2022-11-26) at 2022-11-27 with
-- terminated_by=RELEASE, then open a fresh holding on tid=5 for the 11-30
-- PRACTICE_ADD, then close it for the 12-06 POACH back to tid=3.
--
-- Filed: user-base task #18 (Correct Kyle Allen mis-coded RELEASE tid).
--
-- Post-execution: run
--   NODE_ENV=production node /root/league/scripts/generate-roster-asset-lineage.mjs --lid 1 --rebuild
-- and verify:
--   SELECT holding_id, tid, period_start, period_end, terminated_by
--     FROM roster_asset_holding
--    WHERE lid=1 AND player_id='KYLE-ALLE-2018-1996-03-08'
--    ORDER BY period_start;
-- Expect no STILL_HELD (terminated_by=10, period_end=NULL) holdings; the
-- chain should be tid=5 -> tid=3 -> tid=5 -> tid=3 -> released, all closed.

BEGIN;

UPDATE public.transactions
   SET tid = 3
 WHERE uid = 7580
   AND lid = 1
   AND pid = 'KYLE-ALLE-2018-1996-03-08'
   AND type = 1
   AND tid = 5
   AND timestamp = 1669559049;

COMMIT;
