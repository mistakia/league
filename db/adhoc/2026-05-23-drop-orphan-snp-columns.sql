-- Drop the orphan `snp` column from every table that carries it.
--
-- Audit: every `snp` column in every table is 0 or NULL across all
-- rows (~617k player_gamelogs rows, ~48k player_seasonlogs rows,
-- ~1M scoring_format_player_projection_points rows, etc.). No
-- source populates it. `league_scoring_formats` has no `snp`
-- column, so the scoring engine's per-snap coefficient is always
-- undefined -> 0; no league can configure snap-based scoring. 0
-- of 173 saved user_data_views reference any snp field.
--
-- Canonical per-game snap data continues to live in
-- player_gamelogs.snaps_off / snaps_def / snaps_st (plus ~37
-- splits and shares), populated by scripts/generate-player-snaps.mjs.
--
-- Investigation: user-base
-- scratch/home-dynasty-league/2026-research/snp-column-investigation.md

-- partitioned parents -- DROP COLUMN cascades to all partitions
ALTER TABLE public.player_gamelogs DROP COLUMN snp;
ALTER TABLE public.projections_index DROP COLUMN snp;

-- regular tables
ALTER TABLE public.player_seasonlogs DROP COLUMN snp;
ALTER TABLE public.nfl_team_seasonlogs DROP COLUMN snp;
ALTER TABLE public.projections DROP COLUMN snp;
ALTER TABLE public.projections_archive DROP COLUMN snp;
ALTER TABLE public.ros_projections DROP COLUMN snp;
ALTER TABLE public.scoring_format_player_projection_points DROP COLUMN snp;
