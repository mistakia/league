-- Rename view_trade_asset_flow.market_value_at_trade to keeptradecut_value_at_trade.
--
-- The 2026-08-02 rename (db/adhoc/2026-08-02-rename-lineage-composite-market-value.sql)
-- swept roster_asset_holding.composite_market_value_at_{acquisition,termination} to
-- keeptradecut_value_at_*, but not the view over it -- which promptly re-aliased the
-- renamed column back to a market-value spelling and carried it out to the trade-review
-- API and the SPA. This is the half that rename missed.
--
-- The value is one vendor's index, not a multi-source composite.
-- user:task/league/rebuild-dynasty-asset-valuation.md introduces composite_trade_value
-- as a genuine composite, so the two must not share a spelling.
--
-- ALTER VIEW ... RENAME COLUMN, not CREATE OR REPLACE VIEW: replacing a view cannot
-- rename an output column (`ERROR: cannot change name of view column`), and a rename is
-- the honest statement of the change anyway -- restating the whole SELECT to move one
-- alias invites the restated body drifting from what is live.
--
-- No BEGIN/COMMIT: db-exec.sh already wraps the file in a single transaction, and a
-- nested BEGIN only emits `WARNING: there is already a transaction in progress`.
--
-- This IS a breaking change to the trade-review API response shape: apply it together
-- with the consumer sweep and the frontend deploy, not ahead of them.
--
-- STATUS: APPLIED 2026-08-04 against league_production

ALTER VIEW public.view_trade_asset_flow
  RENAME COLUMN market_value_at_trade TO keeptradecut_value_at_trade;

COMMENT ON VIEW public.view_trade_asset_flow IS
  'One row per trade leg: which team gave up which asset to whom, and what that asset was worth when it moved. keeptradecut_value_at_trade is the source holding''s KeepTradeCut value at the moment it left, in the league''s own market format class. Join target_holding_id to view_roster_asset_lineage_walk.originating_holding_id to follow what the asset later became.';
