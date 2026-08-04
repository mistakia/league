-- Constrain every in-scope position column to the canonical vocabulary
-- STATUS: APPLIED 2026-08-04 against league_production
--
-- This is the gate. normalize_position throwing at the write site gives a
-- usable stack, but only the database makes an unmapped value impossible --
-- and CI cannot substitute, because it runs against an empty Postgres with no
-- production data.
--
-- Additive CHECK only. No column is retyped and no value is rewritten, which
-- is the safe DDL class; the dangerous ones are renames and drops. An enum is
-- not an option -- ALTER TYPE ADD VALUE is the pattern the adp_format
-- dimension was built to eliminate.
--
-- player_gamelogs is one partitioned parent with 28 leaves, so its ALTER
-- recurses in a single statement.
--
-- Two exemptions:
--   pff_unresolved_players.position  staging table for players PFF could not
--                                    resolve; its ST is a special-teams
--                                    catch-all, not a position
--   player.position_depth            depth-chart slot with its own vocabulary
--                                    (INA, RWR, LCB, PK), not a roster position
--   nfl_plays_player.ngs_position*   alignment (SLOT_WR, HIGH_SAFETY), not a
--                                    roster position
--
-- The three empty tables (pff_player_facet_gamelogs, nfl_draft_rankings_index,
-- nfl_draft_rankings_history) are constrained too. Validation is instant and
-- leaving a position column unconstrained is exactly the gap this closes.

-- db:exec wraps the whole file in one transaction, so no explicit BEGIN here.

ALTER TABLE public.player
  ADD CONSTRAINT player_primary_position_vocabulary
  CHECK (primary_position IS NULL OR primary_position = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.player
  ADD CONSTRAINT player_secondary_position_vocabulary
  CHECK (secondary_position IS NULL OR secondary_position = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.player
  ADD CONSTRAINT player_tertiary_position_vocabulary
  CHECK (tertiary_position IS NULL OR tertiary_position = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.player_gamelogs
  ADD CONSTRAINT player_gamelogs_pos_vocabulary
  CHECK (pos IS NULL OR pos = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.player_seasonlogs
  ADD CONSTRAINT player_seasonlogs_pos_vocabulary
  CHECK (pos IS NULL OR pos = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.player_rankings_index
  ADD CONSTRAINT player_rankings_index_pos_vocabulary
  CHECK (pos IS NULL OR pos = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.player_rankings_history
  ADD CONSTRAINT player_rankings_history_pos_vocabulary
  CHECK (pos IS NULL OR pos = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.player_adp_index
  ADD CONSTRAINT player_adp_index_pos_vocabulary
  CHECK (pos IS NULL OR pos = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.player_adp_history
  ADD CONSTRAINT player_adp_history_pos_vocabulary
  CHECK (pos IS NULL OR pos = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.nfl_plays_player
  ADD CONSTRAINT nfl_plays_player_player_position_vocabulary
  CHECK (player_position IS NULL OR player_position = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.nfl_plays_player
  ADD CONSTRAINT nfl_plays_player_position_group_vocabulary
  CHECK (position_group IS NULL OR position_group = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.pff_player_seasonlogs
  ADD CONSTRAINT pff_player_seasonlogs_position_vocabulary
  CHECK (position IS NULL OR position = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.pff_player_seasonlogs
  ADD CONSTRAINT pff_player_seasonlogs_grade_position_vocabulary
  CHECK (grade_position IS NULL OR grade_position = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.pff_player_facet_seasonlogs
  ADD CONSTRAINT pff_player_facet_seasonlogs_position_vocabulary
  CHECK (position IS NULL OR position = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.pff_player_facet_gamelogs
  ADD CONSTRAINT pff_player_facet_gamelogs_position_vocabulary
  CHECK (position IS NULL OR position = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.player_prospect_profile
  ADD CONSTRAINT player_prospect_profile_primary_position_vocabulary
  CHECK (primary_position IS NULL OR primary_position = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.player_archetypes
  ADD CONSTRAINT player_archetypes_primary_position_vocabulary
  CHECK (primary_position IS NULL OR primary_position = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.rosters_players
  ADD CONSTRAINT rosters_players_pos_vocabulary
  CHECK (pos IS NULL OR pos = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.espn_receiving_metrics_history
  ADD CONSTRAINT espn_receiving_metrics_history_pos_vocabulary
  CHECK (pos IS NULL OR pos = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.league_baselines
  ADD CONSTRAINT league_baselines_pos_vocabulary
  CHECK (pos IS NULL OR pos = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.position_game_outcome_defaults
  ADD CONSTRAINT position_game_outcome_defaults_pos_vocabulary
  CHECK (pos IS NULL OR pos = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.weekly_market_selections_analysis_cache
  ADD CONSTRAINT weekly_market_selections_analysis_cache_player_position_vocabul
  CHECK (player_position IS NULL OR player_position = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.props_index
  ADD CONSTRAINT props_index_player_position_vocabulary
  CHECK (player_position IS NULL OR player_position = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.nfl_draft_rankings_index
  ADD CONSTRAINT nfl_draft_rankings_index_position_vocabulary
  CHECK (position IS NULL OR position = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));

ALTER TABLE public.nfl_draft_rankings_history
  ADD CONSTRAINT nfl_draft_rankings_history_position_vocabulary
  CHECK (position IS NULL OR position = ANY (ARRAY['QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'T', 'G', 'C', 'DL', 'DE', 'DT', 'NT', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'DST']::character varying[]));
