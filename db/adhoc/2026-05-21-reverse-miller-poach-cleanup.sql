-- Reverse the 2025-10-07 Kendre Miller poach (poaches.uid=247) that was
-- processed mistakenly and reversed manually but never cleanly cleaned up.
--
-- Background:
--   - poaches.uid=247: tid=5 submitted poach on 2025-10-04 17:00:19, processed
--     2025-10-07 04:00:04 with succ=true.
--   - transactions.uid=12253 (type=5 POACHED) was inserted on tid=5 at the
--     processing timestamp.
--   - At 2025-10-07 18:57:09 (14h57m later) a corrective transactions.uid=12257
--     (type=2 ROSTER_ACTIVATE) was inserted on tid=1, restoring Miller to the
--     original team.
--   - rosters_players canonically shows Miller on tid=1 weeks 5-17 of 2025
--     (slot 12 PS -> 11 BENCH -> 13 RESERVE_SHORT_TERM). No tid=5 entry exists
--     in any week.
--   - super_priority table has no row for Miller (the reversal was a manual
--     ledger correction, not a Super-Priority claim).
--   - poach_releases.poachid=247 (JUWA-JOHN-2020-1996-09-13) is kept as-is:
--     it is canonical record of the queued release-list at poach-submission
--     time. Since the poach was not executed, the queued release was not
--     auto-executed. Juwan Johnson's later 2025-10-09 release by tid=5
--     (transactions.uid=12272) was an independent decision.
--
-- Filed: user-base task/league/investigate-kendre-miller-roster-snapshot-divergence.md
--   ([finding] 2026-05-21 observation; user-confirmed 2026-05-21 that the
--    poach was processed mistakenly and reversed but not correctly cleaned up.)
--
-- Effect on roster-asset-lineage walker:
--   The walker reads `poaches.succ=true` and `transactions` type=5 rows when
--   building POACH events. With both rows corrected, the rebuild will no
--   longer branch Miller's lineage onto tid=5. The corrective
--   transactions.uid=12257 (type=2 ROSTER_ACTIVATE on tid=1) remains in place
--   so the walker still sees a continuous tid=1 ownership.
--
-- Post-execution: run
--   NODE_ENV=production node /root/league/scripts/generate-roster-asset-lineage.mjs --lid 1 --rebuild
-- and verify with:
--   SELECT holding_id, tid, period_start, period_end, terminated_by
--     FROM roster_asset_holding
--    WHERE lid=1 AND player_id='KEND-MILL-2023-2002-06-11'
--    ORDER BY period_start DESC;
-- Expect a single STILL_HELD holding on tid=1 with period_start ~2025-10-01
-- and no holding on tid=5 in 2025.

BEGIN;

UPDATE public.poaches
   SET succ = false,
       reason = COALESCE(reason || ' | ', '')
              || 'manually reversed 2025-10-07; cleanup applied 2026-05-21'
 WHERE uid = 247
   AND lid = 1
   AND pid = 'KEND-MILL-2023-2002-06-11'
   AND succ = true;

DELETE FROM public.transactions
 WHERE uid = 12253
   AND lid = 1
   AND tid = 5
   AND pid = 'KEND-MILL-2023-2002-06-11'
   AND type = 5
   AND timestamp = 1759809604;

COMMIT;
