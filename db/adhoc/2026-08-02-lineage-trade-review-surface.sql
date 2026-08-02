-- STATUS: APPLIED 2026-08-02 against league_production
--
-- Make roster-asset-lineage usable as the primary trade-review tool.
--
-- Three changes, all additive to the existing append-only graph:
--
-- 1. roster_asset_transformation.trade_uid -- trade legs were previously only
--    reconstructible by matching (lid, transformation_type=1, occurred_at) back
--    against to_timestamp(trades.accepted). That join is fragile (two trades
--    accepted in the same second collide) and undocumented. transaction_id is
--    explicitly NULL for trade edges (walk-transactions.mjs apply_trade), so a
--    dedicated column is the honest home for the link.
--
-- 2. view_roster_asset_lineage_walk generalized to root at EVERY holding rather
--    than only salary-bearing holdings and standings endowments. The anchored
--    form could not answer "what did the asset I acquired in trade X become?"
--    because a holding minted by a trade is typically neither salary-bearing
--    nor an endowment target, so it never appeared as an origin. Full closure
--    over lid=1 is 10,645 rows (vs 6,808 anchored) at max depth 12 -- the
--    generalization is nearly free. root_kind is now computed on the ROOT
--    holding, so `WHERE root_kind IN ('salary','endowment')` reproduces the
--    previous view exactly.
--
-- 3. view_trade_asset_flow -- one row per trade leg with both sides' team,
--    asset identity, and the market value each side gave up, so a per-trade
--    rollup no longer requires hand-written recursive SQL.
--
-- Runs in a single transaction via yarn db:exec (ON_ERROR_STOP=1).
-- Post-execution: yarn export:schema and commit the schema diff, then
-- `node scripts/generate-roster-asset-lineage.mjs --lid 1 --rebuild` to
-- backfill trade_uid on existing rows.

BEGIN;

-- 1. Trade linkage -----------------------------------------------------------

ALTER TABLE roster_asset_transformation
  ADD COLUMN trade_uid integer;

CREATE INDEX roster_asset_transformation_trade_uid_idx
  ON roster_asset_transformation (trade_uid)
  WHERE trade_uid IS NOT NULL;

COMMENT ON COLUMN roster_asset_transformation.trade_uid IS
  'trades.uid for TRADE-type (transformation_type=1) edges; NULL for every other transformation type. Populated by the walker rather than joined on occurred_at, which is ambiguous when two trades are accepted in the same second.';

-- 2. General lineage closure -------------------------------------------------

DROP VIEW IF EXISTS public.view_roster_asset_lineage_walk;

CREATE VIEW public.view_roster_asset_lineage_walk AS
WITH RECURSIVE root AS (
  SELECT h.holding_id,
         CASE
           WHEN h.salary_paid > 0 THEN 'salary'
           WHEN EXISTS (
             SELECT 1
               FROM roster_asset_transformation t
              WHERE t.target_holding_id = h.holding_id
                AND t.transformation_type = 15
           ) THEN 'endowment'
           ELSE 'derived'
         END AS root_kind
    FROM roster_asset_holding h
), walk AS (
  SELECT r.holding_id AS originating_holding_id,
         r.holding_id AS current_holding_id,
         1.0::numeric AS cumulative_weight,
         0 AS depth,
         r.root_kind
    FROM root r
  UNION ALL
  SELECT w.originating_holding_id,
         t.target_holding_id,
         w.cumulative_weight * t.target_share,
         w.depth + 1,
         w.root_kind
    FROM walk w
    JOIN roster_asset_transformation t ON t.source_holding_id = w.current_holding_id
   WHERE t.target_holding_id IS NOT NULL
     AND w.depth < 20
)
SELECT * FROM walk;

COMMENT ON VIEW public.view_roster_asset_lineage_walk IS
  'Transitive closure of the lineage graph rooted at every holding. root_kind labels the ORIGIN holding: salary (salary-bearing), endowment (standings-allocated pick), or derived (minted by a trade, conversion, or other transformation). Filter root_kind IN (''salary'',''endowment'') for cost-attribution walks; leave unfiltered to walk forward from an arbitrary holding such as one acquired in a trade. Edge weight along a path = product of target_share (source_share is the same fraction one hop earlier; multiplying both double-counts). Depth capped at 20.';

-- 3. Per-trade asset flow ----------------------------------------------------

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
       src.composite_market_value_at_termination AS market_value_at_trade,
       src.salary_paid AS salary_paid_at_trade,
       src.realized_pts_added_net_through_termination AS pts_added_before_trade,
       tgt.terminated_by AS post_trade_terminated_by,
       tgt.period_end AS post_trade_period_end
  FROM roster_asset_transformation t
  JOIN roster_asset_holding src ON src.holding_id = t.source_holding_id
  JOIN roster_asset_holding tgt ON tgt.holding_id = t.target_holding_id
 WHERE t.transformation_type = 1;

COMMENT ON VIEW public.view_trade_asset_flow IS
  'One row per trade leg: which team gave up which asset to whom, and what that asset was worth when it moved. market_value_at_trade is the source holding''s termination snapshot (its value at the moment it left). Join target_holding_id to view_roster_asset_lineage_walk.originating_holding_id to follow what the asset later became.';

COMMIT;
