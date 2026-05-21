-- Backfill missing trades_players legs that were lost upstream of the
-- roster-asset-lineage walker, causing STILL_HELD orphan player holdings on
-- lid=1.
--
-- The transactions ledger has type=4 (TRADE) rows for both players showing
-- the receiving team and exact accepted-trade timestamp. The trades_players
-- leg-table is missing them, so the walker doesn't see the trade-out from
-- the giving team and the prior holding remains terminated_by=STILL_HELD.
--
-- Robert Woods
--   transactions.uid=6978: tid=4, type=4 TRADE, ts=2022-09-16 14:00:18
--   trades.uid=130: propose_tid=5, accept_tid=4, accepted=2022-09-16 14:00:18
--   Existing trades_players legs for tradeid=130: Tyreek Hill (to tid=4 only).
--   Missing leg: Woods to tid=4.
--   Orphan: roster_asset_holding.holding_id=59711 (tid=5, period_start=2022-09-08).
--
-- Kyle Allen
--   transactions.uid=7570: tid=3, type=4 TRADE, ts=2022-11-26 21:06:14
--   trades.uid=155: propose_tid=5, accept_tid=3, accepted=2022-11-26 21:06:14
--   Existing trades_players legs for tradeid=155: DeVonta Smith (to tid=3),
--     Darius Slay / Romeo Doubs / Tyquan Thornton (to tid=5).
--   Missing leg: Allen to tid=3.
--   Orphan: roster_asset_holding.holding_id (search lid=1, Allen, tid=5,
--     period_end=NULL) — will be re-walked on next rebuild.
--
-- Filed: user-base task #16 (Investigate orphan STILL_HELD player holdings).
--
-- Post-execution: run
--   NODE_ENV=production node /root/league/scripts/generate-roster-asset-lineage.mjs --lid 1 --rebuild
-- and re-run the orphan audit:
--   SELECT h.holding_id, h.tid, p.fname||' '||p.lname AS name
--     FROM roster_asset_holding h JOIN player p ON p.pid=h.player_id
--    WHERE h.lid=1 AND h.asset_type=1 AND h.terminated_by=10 AND h.period_end IS NULL
--      AND h.player_id IN ('ROBE-WOOD-2013-1992-04-10','KYLE-ALLE-2018-1996-03-08');
-- Expect 0 rows.

-- Note: trades_players has no PK or UNIQUE constraint, so ON CONFLICT cannot
-- be used. Use WHERE NOT EXISTS guards for idempotency.

BEGIN;

INSERT INTO public.trades_players (tradeid, tid, pid)
SELECT 130, 4, 'ROBE-WOOD-2013-1992-04-10'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trades_players
  WHERE tradeid=130 AND tid=4 AND pid='ROBE-WOOD-2013-1992-04-10'
);

INSERT INTO public.trades_players (tradeid, tid, pid)
SELECT 155, 3, 'KYLE-ALLE-2018-1996-03-08'
WHERE NOT EXISTS (
  SELECT 1 FROM public.trades_players
  WHERE tradeid=155 AND tid=3 AND pid='KYLE-ALLE-2018-1996-03-08'
);

COMMIT;
