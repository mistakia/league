-- view_roster_asset_holding_current_salary
--
-- `roster_asset_holding.salary_paid` follows the cap-attribution rule
-- (`leagues.salary_attribution_rule = START_TEAM_BEARS`): only the team
-- holding the player at season start is charged the season salary, so a
-- mid-season trade-acquired holding records `salary_paid = 0`. That is the
-- correct cap-accounting value but it is not the player's contract salary,
-- which by league rule carries forward through trades (only RELEASE and
-- RFA loss reset salary).
--
-- This view exposes `current_salary`: for any player holding, return the
-- holding's own `salary_paid` when non-zero, otherwise walk back through
-- TRADE transformations to the first salary-bearing source. Multi-hop
-- chains (player traded N times mid-season) are handled by the recursive
-- CTE; the walk halts at depth 20 (matches view_roster_asset_lineage_walk).
--
-- Consumers wanting "player's current contract salary" should read
-- `current_salary` from this view. Cap-attribution consumers continue to
-- read `roster_asset_holding.salary_paid` directly.

CREATE OR REPLACE VIEW view_roster_asset_holding_current_salary AS
WITH RECURSIVE chain AS (
  SELECT h.holding_id AS target_holding_id,
         h.holding_id AS walk_holding_id,
         h.salary_paid AS walk_salary,
         0 AS depth
    FROM roster_asset_holding h
   WHERE h.asset_type = 1
  UNION ALL
  SELECT c.target_holding_id,
         t.source_holding_id,
         prior.salary_paid,
         c.depth + 1
    FROM chain c
    JOIN roster_asset_transformation t
      ON t.target_holding_id = c.walk_holding_id
     AND t.transformation_type = 1  -- TRADE
    JOIN roster_asset_holding prior
      ON prior.holding_id = t.source_holding_id
   WHERE COALESCE(c.walk_salary, 0) = 0
     AND c.depth < 20
),
best AS (
  SELECT DISTINCT ON (target_holding_id)
         target_holding_id,
         walk_salary AS inherited_salary
    FROM chain
   WHERE walk_salary IS NOT NULL
     AND walk_salary > 0
   ORDER BY target_holding_id, depth ASC
)
SELECT h.holding_id,
       h.lid,
       h.tid,
       h.player_id,
       h.period_start,
       h.period_end,
       h.salary_basis,
       h.terminated_by,
       h.salary_paid AS raw_salary_paid,
       COALESCE(NULLIF(h.salary_paid, 0), b.inherited_salary, 0) AS current_salary,
       CASE
         WHEN h.salary_paid IS NOT NULL AND h.salary_paid > 0 THEN 'self'
         WHEN b.inherited_salary IS NOT NULL THEN 'trade_inherited'
         ELSE 'zero'
       END AS current_salary_source
  FROM roster_asset_holding h
  LEFT JOIN best b ON b.target_holding_id = h.holding_id
 WHERE h.asset_type = 1;

COMMENT ON VIEW view_roster_asset_holding_current_salary IS
  'Per-holding contract salary that carries forward across TRADE chains. Use current_salary for "what is this player''s salary while held by this team"; use roster_asset_holding.salary_paid directly for START_TEAM_BEARS cap attribution.';
