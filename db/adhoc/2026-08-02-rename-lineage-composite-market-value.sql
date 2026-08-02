-- STATUS: APPLIED 2026-08-02 against league_production
--
-- Rename roster_asset_holding.composite_market_value_at_{acquisition,termination}
-- to keeptradecut_value_at_{acquisition,termination}.
--
-- The columns have never held a composite value. compute-snapshots-bulk.mjs
-- reads keeptradecut_valuations directly for players and ktc_pick_at for picks;
-- it has never referenced composite_market_value_daily, the actual blended
-- index (KTC + ADP + rankings + props, calibrated onto the KTC axis), which
-- shipped one day after the lineage tables. The name promised a fused
-- multi-source signal and delivered a single vendor's quote.
--
-- Renaming rather than rewiring is deliberate. Pointing these columns at the
-- real composite would silently restate every historical grade in the table --
-- a change to what the numbers MEAN, dressed as a bug fix. It is also not a
-- drop-in: composite_market_value_daily emits no pick rows at all (v1 defers
-- the slot-to-otid mapping), so picks would still need the KTC path and the
-- column would then mix two bases across asset types, which is worse than
-- honestly naming one. If a genuine composite snapshot is wanted later it
-- should be an additional column, so the two bases stay comparable.
--
-- Consumers swept in the same commit: compute-snapshots-bulk.mjs,
-- generate-roster-asset-lineage.mjs, view_trade_asset_flow,
-- test/scripts.import.keeptradecut-valuations.spec.mjs.
--
-- Runs in a single transaction via yarn db:exec (ON_ERROR_STOP=1).
-- Post-execution: yarn export:schema and commit the schema diff.

BEGIN;

-- view_trade_asset_flow selects the termination column, so it must be dropped
-- and rebuilt around the rename.
DROP VIEW IF EXISTS public.view_trade_asset_flow;

ALTER TABLE roster_asset_holding
  RENAME COLUMN composite_market_value_at_acquisition TO keeptradecut_value_at_acquisition;

ALTER TABLE roster_asset_holding
  RENAME COLUMN composite_market_value_at_termination TO keeptradecut_value_at_termination;

COMMENT ON COLUMN roster_asset_holding.keeptradecut_value_at_acquisition IS
  'KeepTradeCut superflex value at period_start. Players resolve against keeptradecut_valuations; picks against the KTCPICK tier series via ktc_pick_at. Single-source by design -- not the composite_market_value_daily blend.';

COMMENT ON COLUMN roster_asset_holding.keeptradecut_value_at_termination IS
  'KeepTradeCut superflex value at period_end; NULL while the holding is open.';

CREATE VIEW public.view_trade_asset_flow AS
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
       src.keeptradecut_value_at_termination AS market_value_at_trade,
       src.salary_paid AS salary_paid_at_trade,
       src.realized_pts_added_net_through_termination AS pts_added_before_trade,
       tgt.terminated_by AS post_trade_terminated_by,
       tgt.period_end AS post_trade_period_end
  FROM roster_asset_transformation t
  JOIN roster_asset_holding src ON src.holding_id = t.source_holding_id
  JOIN roster_asset_holding tgt ON tgt.holding_id = t.target_holding_id
 WHERE t.transformation_type = 1;

COMMENT ON VIEW public.view_trade_asset_flow IS
  'One row per trade leg: which team gave up which asset to whom, and what that asset was worth when it moved. market_value_at_trade is the source holding''s KTC value at the moment it left. Join target_holding_id to view_roster_asset_lineage_walk.originating_holding_id to follow what the asset later became.';

COMMIT;
