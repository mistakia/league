-- Replace the NULL-permissive UNIQUE constraint on roster_asset_holding with
-- two partial unique indexes scoped per asset_type. The original constraint
-- (lid, tid, asset_type, player_id, pick_year, pick_round, pick_original_owner_tid, period_start)
-- includes pick_* columns that are NULL for asset_type=1 (player) rows and
-- includes player_id which is NULL for asset_type=2 (pick) rows. Postgres
-- treats NULLs as distinct in UNIQUE constraints by default, so the
-- constraint never fires for either asset class -- duplicate emissions slip
-- through silently.
--
-- Filed: user-base task/league/fix-roster-asset-lineage-walker-duplicates.md
--
-- Walker fix (commit 4a9d60f4) reduced lid=1 orphan-duplicate rows from
-- 7 player + 9 pick (16 total) to 5 residuals (pick conversion edge-cases
-- with legacy trades_picks ownership chains that don't match endowment-
-- derived ctx.open keys). These residuals do NOT share period_start with a
-- sibling holding, so the partial indexes below will not flag them.

ALTER TABLE public.roster_asset_holding
  DROP CONSTRAINT IF EXISTS roster_asset_holding_lid_tid_asset_type_player_id_pick_year_key;

CREATE UNIQUE INDEX roster_asset_holding_player_unique_idx
  ON public.roster_asset_holding (lid, tid, player_id, period_start)
  WHERE asset_type = 1;

-- pick_draft_overall_position is included because a team can legitimately
-- hold multiple picks in the same round with the same original_owner_tid
-- (e.g., lid=1 tid=12 2022 R4 picks 37+45 both otid=12). The overall
-- position disambiguates. It is populated at endowment time from
-- draft.pick.
CREATE UNIQUE INDEX roster_asset_holding_pick_unique_idx
  ON public.roster_asset_holding
    (lid, tid, pick_year, pick_round, pick_original_owner_tid, pick_draft_overall_position, period_start)
  WHERE asset_type = 2;
