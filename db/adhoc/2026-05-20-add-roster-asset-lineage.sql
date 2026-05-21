-- Roster asset lineage attribution graph at (lid, asset, ownership-period) grain.
--
-- Two-table append-only primitive (holdings + transformations) plus a small
-- companion table denormalizing extension-count state per (lid, tid, pid).
-- Enables retrospective grading of every roster decision by tracing realized
-- and projected production back to the originating salary commitment via
-- lineage walks. Generalizes across xo.football leagues via permissive
-- transformation-type enum, nullable rule-specific columns, and per-league
-- leagues.salary_attribution_rule dispatch (v1 implements START_TEAM_BEARS only).
--
-- Naming: player_id (full-word, external-id convention) is intentionally
-- distinct from codebase pid; JOINs against existing tables alias on
-- r.pid = h.player_id. See guideline/write-software.md.
--
-- salary_basis enum: 1=auction, 2=extension, 3=rfa, 4=franchise_tag,
--   5=rookie_tag, 6=rookie_contract (drafted rookies; no separate draft basis),
--   7=ps_salary.
--
-- Runs in a single transaction via yarn db:exec (ON_ERROR_STOP=1).

CREATE TABLE roster_asset_holding (
  holding_id bigserial PRIMARY KEY,
  lid integer NOT NULL,
  tid integer NOT NULL,
  asset_type smallint NOT NULL,
  player_id varchar(25),
  pick_year smallint,
  pick_round smallint,
  pick_original_owner_tid integer,
  pick_draft_overall_position smallint,
  period_start timestamp NOT NULL,
  period_end timestamp,
  league_format_hash varchar(64) NOT NULL,
  salary_paid integer,
  salary_basis smallint,
  initial_slot_type smallint,
  ps_slot_subtype smallint,
  weeks_active smallint NOT NULL DEFAULT 0,
  weeks_practice_squad smallint NOT NULL DEFAULT 0,
  weeks_reserve_short_term smallint NOT NULL DEFAULT 0,
  weeks_reserve_long_term smallint NOT NULL DEFAULT 0,
  weeks_cov smallint NOT NULL DEFAULT 0,
  weeks_started smallint NOT NULL DEFAULT 0,
  projected_pts_added_at_acquisition numeric(6,1),
  realized_pts_added_net_through_termination numeric(6,1),
  realized_pts_added_earned_through_termination numeric(6,1),
  realized_pts_added_net_in_active_slot numeric(6,1),
  realized_pts_added_net_in_started_slot numeric(6,1),
  realized_pts_added_net_in_practice_squad_slot numeric(6,1),
  projected_pts_added_remaining_at_termination numeric(6,1),
  composite_market_value_at_acquisition numeric(8,1),
  composite_market_value_at_termination numeric(8,1),
  extension_count_at_acquisition smallint,
  franchise_tag_consecutive_count_at_acquisition smallint,
  is_rookie_tag boolean NOT NULL DEFAULT false,
  protected_for_year smallint,
  super_priority_until timestamp,
  audit_corrected boolean NOT NULL DEFAULT false,
  correction_note text,
  terminated_by smallint,
  UNIQUE (lid, tid, asset_type, player_id, pick_year, pick_round, pick_original_owner_tid, period_start)
);

CREATE INDEX roster_asset_holding_asset_lookup_idx
  ON roster_asset_holding (lid, asset_type, player_id, pick_year, pick_round, pick_original_owner_tid, period_start);

CREATE INDEX roster_asset_holding_team_period_idx
  ON roster_asset_holding (lid, tid, period_start);

COMMENT ON TABLE roster_asset_holding IS
  'Append-only node table for the roster-asset lineage graph at (lid, asset, ownership-period) grain. One row per contiguous ownership period of a player or pick by a team. Salary attribution follows leagues.salary_attribution_rule; START_TEAM_BEARS populates salary_paid only on the start-team row. Corrections never overwrite history -- they append a new row with audit_corrected=true and the prior row remains for forensic walk.';

COMMENT ON COLUMN roster_asset_holding.asset_type IS
  'Enum ASSET_TYPE: 1=player, 2=pick.';

COMMENT ON COLUMN roster_asset_holding.player_id IS
  'Full-word external-ID name; aliases to existing pid at JOIN boundaries (JOIN rosters_players r ON r.pid = h.player_id). Populated when asset_type=player.';

COMMENT ON COLUMN roster_asset_holding.salary_basis IS
  'Enum: 1=auction, 2=extension, 3=rfa, 4=franchise_tag, 5=rookie_tag, 6=rookie_contract (drafted rookies; no separate draft basis), 7=ps_salary.';

COMMENT ON COLUMN roster_asset_holding.initial_slot_type IS
  'Enum mirroring roster-constants.mjs slot-family groupings: 1=active (starting + BENCH), 2=practice_squad (PS/PSP/PSD/PSDP), 3=reserve_short_term, 4=reserve_long_term, 5=cov. No taxi slot exists in this system.';

COMMENT ON COLUMN roster_asset_holding.ps_slot_subtype IS
  'Enum derived from PS sub-families: 1=drafted_ps (PSD+PSDP), 2=signed_ps (PS+PSP). NULL if not in PS family.';

COMMENT ON COLUMN roster_asset_holding.terminated_by IS
  'Enum TERMINATED_BY: 1=trade, 2=release, 3=season_end, 4=extension, 5=expired_to_fa, 6=pick_converted, 7=auto_cap_release, 8=nullified_decommission, 9=super_priority_resign, 10=still_held.';

CREATE TABLE roster_asset_transformation (
  transformation_row_id bigserial PRIMARY KEY,
  transformation_id uuid NOT NULL,
  lid integer NOT NULL,
  transaction_id integer,
  transformation_type smallint NOT NULL,
  occurred_at timestamp NOT NULL,
  source_holding_id bigint REFERENCES roster_asset_holding (holding_id),
  target_holding_id bigint REFERENCES roster_asset_holding (holding_id),
  source_share numeric(4,3),
  target_share numeric(4,3),
  audit_corrected boolean NOT NULL DEFAULT false,
  correction_note text
);

CREATE INDEX roster_asset_transformation_id_idx
  ON roster_asset_transformation (transformation_id);

CREATE INDEX roster_asset_transformation_lid_occurred_idx
  ON roster_asset_transformation (lid, occurred_at);

CREATE INDEX roster_asset_transformation_source_idx
  ON roster_asset_transformation (source_holding_id);

CREATE INDEX roster_asset_transformation_target_idx
  ON roster_asset_transformation (target_holding_id);

COMMENT ON TABLE roster_asset_transformation IS
  'Append-only edge table for the lineage graph. Rows sharing transformation_id belong to the same underlying transaction (e.g., a multi-asset trade emits one row per leg, each with computed source_share/target_share derived from composite market value at occurred_at). Composite edge weight = source_share * target_share.';

COMMENT ON COLUMN roster_asset_transformation.transformation_type IS
  'Enum TRANSFORMATION_TYPE: 1=trade, 2=auction, 3=rfa_win, 4=franchise_tag, 5=rookie_tag, 6=extension, 7=draft, 8=waiver_claim, 9=fa_signing, 10=ps_signing, 11=poach, 12=release, 13=pick_conversion, 14=season_rollover, 15=standings_endowment, 16=decommission_reassignment, 17=super_priority_resign, 18=auto_cap_release, 19=failed_poach_sanctuary, 20=protect.';

COMMENT ON COLUMN roster_asset_transformation.source_share IS
  'This source-row share in [0,1] of its basket; NULL only for endowment (no source).';

COMMENT ON COLUMN roster_asset_transformation.target_share IS
  'This target-row share in [0,1] of its basket; NULL for terminations with no target (release, auto_cap_release, expired_to_fa, failed_poach_sanctuary, nullified_decommission).';

CREATE TABLE player_team_extension_state (
  lid integer NOT NULL,
  tid integer NOT NULL,
  pid varchar(25) NOT NULL,
  extension_count smallint NOT NULL DEFAULT 0,
  franchise_tag_history_years smallint[],
  rookie_tag_used_year smallint,
  last_reset_event smallint,
  last_refreshed_at timestamp NOT NULL,
  PRIMARY KEY (lid, tid, pid)
);

COMMENT ON TABLE player_team_extension_state IS
  'Denormalized extension/tag state per (lid, tid, pid) for fast offseason quotes. last_reset_event enum: 1=rfa_win, 2=release, 3=traded_away.';

ALTER TABLE leagues ADD COLUMN salary_attribution_rule smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN leagues.salary_attribution_rule IS
  'Enum SALARY_ATTRIBUTION_RULE: 0=NO_CAP, 1=AUCTION_BUDGET, 2=START_TEAM_BEARS, 3=CONTRACT_FOLLOWS. v1 generator implements START_TEAM_BEARS only; other values raise coverage_warning and skip.';

-- Seed home dynasty (GENESIS LEAGUE, uid=1) to START_TEAM_BEARS.
UPDATE leagues SET salary_attribution_rule = 2 WHERE uid = 1;

CREATE VIEW v_roster_asset_lineage_walk AS
WITH RECURSIVE walk AS (
  -- Anchor: salary-bearing holdings (auction / extension / RFA / etc. cost leaves)
  SELECT h.holding_id AS originating_holding_id,
         h.holding_id AS current_holding_id,
         1.0::numeric AS cumulative_weight,
         0 AS depth,
         'salary'::text AS root_kind
    FROM roster_asset_holding h
   WHERE h.salary_paid > 0
  UNION ALL
  -- Anchor: endowment-originated holdings (standings-allocated picks).
  -- Picks endowed via standings have no salary cost; the endowment IS the cost root.
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
         w.cumulative_weight * (t.source_share * t.target_share),
         w.depth + 1,
         w.root_kind
    FROM walk w
    JOIN roster_asset_transformation t ON t.source_holding_id = w.current_holding_id
   WHERE t.target_holding_id IS NOT NULL
     AND w.depth < 20
)
SELECT * FROM walk;

COMMENT ON VIEW v_roster_asset_lineage_walk IS
  'Recursive walk anchored at salary-bearing holdings (root_kind=salary) and standings-endowed picks (root_kind=endowment). Composite edge weight along a path = product of (source_share * target_share). Depth capped at 20 (sufficient for realistic trade chains).';
