-- STATUS: APPLIED 2026-07-29 against league_production
--
-- Delete keeptradecut_liquidity rows for days on which no liquidity was collected.
--
-- KTC publishes rawLiquidity/stdLiquidity/tradeCount inline on the dynasty-rankings
-- page. Intermittently it serves that page with all three fields zeroed for every
-- player; the importer wrote those zeros as if they were measurements. 15 of the 70
-- collected days (2026-06-02 through 2026-07-28, 13,812 rows) are wholly zeroed this
-- way, while a normal day carries ~790 of ~920 rows with trade_count > 0 and never
-- fewer than 769.
--
-- The rows are DELETED rather than backfilled from an adjacent day. Liquidity is a
-- point-in-time measure of how much a player circulates; carrying a neighbouring day's
-- value forward would invent a market observation that was never made. Absence of a
-- row is already a state this table has (no run on 2026-07-20), and it is the honest
-- one: after this, a stored trade_count = 0 means KTC reported zero trades for that
-- player, never "we did not collect it".
--
-- scripts/import-keeptradecut.mjs no longer writes rows on such a day (it skips the
-- write and reports a shortfall), so this is a one-shot repair of history.
--
-- Scoped by the whole-day predicate rather than a hardcoded date list: a per-row
-- `trade_count = 0` filter would also delete the ~130 rows per good day where KTC
-- genuinely reports zero trades for a deep-bench player, which is real data.

DELETE FROM keeptradecut_liquidity
WHERE d IN (
  SELECT d
  FROM keeptradecut_liquidity
  GROUP BY d
  HAVING max(trade_count) = 0
     AND max(std_liquidity) = 0
     AND max(raw_liquidity) = 0
);
