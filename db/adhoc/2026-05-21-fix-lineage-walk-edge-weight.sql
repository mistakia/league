-- Fix latent double-penalty in v_roster_asset_lineage_walk edge weight.
--
-- The original DDL (db/adhoc/2026-05-20-add-roster-asset-lineage.sql:177)
-- multiplies cumulative_weight by (source_share * target_share) at each
-- recursive step. This double-counts the source-side fractional split: along
-- a chain, the source_share of leg N+1 already equals the target_share that
-- leg N's recipient holds (they describe the same fractional ownership at
-- the same node). Multiplying both at each hop compounds the fraction twice.
--
-- Correct form: w.cumulative_weight * t.target_share.
--
-- The bug is currently latent on lid=1: all transformations have
-- source_share=target_share=1.0 (verified 2026-05-21). It will surface as
-- soon as composite-market-value-driven multi-leg trade weighting ships.
--
-- Filed: user-base task/league/fix-roster-asset-lineage-walk-edge-weight-double-penalty.md
--
-- Post-execution: yarn export:schema and commit the schema diff.

BEGIN;

DROP VIEW IF EXISTS public.v_roster_asset_lineage_walk;

CREATE VIEW public.v_roster_asset_lineage_walk AS
WITH RECURSIVE walk AS (
  SELECT h.holding_id AS originating_holding_id,
         h.holding_id AS current_holding_id,
         1.0::numeric AS cumulative_weight,
         0 AS depth,
         'salary'::text AS root_kind
    FROM roster_asset_holding h
   WHERE h.salary_paid > 0
  UNION ALL
  SELECT h.holding_id,
         h.holding_id,
         1.0::numeric,
         0,
         'endowment'::text
    FROM roster_asset_holding h
    JOIN roster_asset_transformation t ON t.target_holding_id = h.holding_id
   WHERE t.transformation_type = 15
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

COMMENT ON VIEW public.v_roster_asset_lineage_walk IS
  'Recursive walk anchored at salary-bearing holdings (root_kind=salary) and standings-endowed picks (root_kind=endowment). Composite edge weight along a path = product of target_share values along the chain (source_share is the same fraction one hop earlier; multiplying both double-counts). Depth capped at 20.';

COMMIT;
