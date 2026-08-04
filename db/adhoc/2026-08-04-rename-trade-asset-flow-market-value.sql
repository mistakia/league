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
-- CREATE OR REPLACE VIEW, not a table rename, so this does not open the schema-export
-- race window that renames and drops do. It IS a breaking change to the trade-review API
-- response shape: apply it together with the frontend deploy, not ahead of it.
--
-- STATUS: PENDING

BEGIN;

CREATE OR REPLACE VIEW public.view_trade_asset_flow AS
SELECT t.lid,
       t.trade_uid,
       t.transformation_id,
       t.occurred_at,
       t.source_holding_id,
       t.target_holding_id,
       src.tid AS from_tid,
       tgt.tid AS to_tid,
       tgt.asset_type,
       tgt.player_id,
       tgt.pick_year,
       tgt.pick_round,
       tgt.pick_original_owner_tid,
       src.keeptradecut_value_at_termination AS keeptradecut_value_at_trade,
       src.salary_paid AS salary_paid_at_trade,
       src.realized_pts_added_net_through_termination AS pts_added_before_trade,
       tgt.terminated_by AS post_trade_terminated_by,
       tgt.period_end AS post_trade_period_end
  FROM roster_asset_transformation t
  JOIN roster_asset_holding src ON src.holding_id = t.source_holding_id
  JOIN roster_asset_holding tgt ON tgt.holding_id = t.target_holding_id
 WHERE t.transformation_type = 1;

COMMENT ON VIEW public.view_trade_asset_flow IS
  'One row per trade leg: which team gave up which asset to whom, and what that asset was worth when it moved. keeptradecut_value_at_trade is the source holding''s KeepTradeCut value at the moment it left, in the league''s own market format class. Join target_holding_id to view_roster_asset_lineage_walk.originating_holding_id to follow what the asset later became.';

COMMIT;
