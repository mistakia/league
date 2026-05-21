-- Fix the previously-inserted trades_players rows where I used the receiving
-- team (per the transactions ledger) instead of the giving team (per the
-- walker convention).
--
-- Adhoc 2026-05-21-backfill-missing-trades-players-legs.sql inserted:
--   (tradeid=130, tid=4, pid=ROBE-WOOD-...)  -- WRONG, should be tid=5 (giver)
--   (tradeid=155, tid=3, pid=KYLE-ALLE-...)  -- WRONG, should be tid=5 (giver)
--
-- Per walk-transactions.mjs:754-761 the walker treats trades_players.tid as
-- the from_tid (giving team); to_tid is the OTHER team in the trade
-- (propose vs accept).
--
-- Sibling rows confirm the convention:
--   Tyreek Hill (trade 130): trades_players.tid=4, transactions ts=2022-09-16
--     shows Hill type=4 on tid=5 -> walker correctly reads `from_tid=4,
--     to_tid=5` matching reality (Hill went from tid=4 to tid=5).
--   DeVonta Smith (trade 155): trades_players.tid=3, transactions ts=2022-11-26
--     shows Smith type=4 on tid=5 -> walker correctly reads `from_tid=3,
--     to_tid=5` matching reality.
--
-- Filed: user-base task #17 (Backfill Woods + Allen missing trades_players legs).

BEGIN;

UPDATE public.trades_players
   SET tid = 5
 WHERE tradeid = 130
   AND tid = 4
   AND pid = 'ROBE-WOOD-2013-1992-04-10';

UPDATE public.trades_players
   SET tid = 5
 WHERE tradeid = 155
   AND tid = 3
   AND pid = 'KYLE-ALLE-2018-1996-03-08';

COMMIT;
