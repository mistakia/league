-- STATUS: APPLIED 2026-08-15 against league_production
--
-- Create pff_player_gamelogs: PFF's own player game-grain measurements, typed.
--
-- Why this table exists. pff_player_facet_gamelogs stores one row per
-- (pid, esbid, facet) with the whole vendor row in a jsonb facet_payload and a
-- set of promoted scalar columns that were never populated -- all 654,696 rows
-- carry NULL in every one of them. Data views cannot read jsonb, so the entire
-- game grain of the PFF archive is unreachable from the analytics surface it
-- was ingested for. This table is the typed home: one row per (pid, esbid),
-- merging the six game-level summary facets.
--
-- Source separation. Every column here is PFF's own measurement. Nothing is
-- reconciled against nfl_plays, player_gamelogs or any NGS-derived table, and
-- no column here is written by any non-PFF importer. Where PFF and another
-- vendor measure the same concept -- routes being the live case, where PFF and
-- player_receiving_gamelogs.routes agree exactly on only 7,850 of 24,636
-- overlapping player-games -- the two stay separately named and separately
-- sourced, and the consumer picks.
--
-- Column naming, derived from measurement rather than assumed:
--
--   * Fields that appear in more than one facet were tested for agreement
--     across facets over the 2024 season. Sixteen grade fields plus penalties,
--     declined_penalties, routes, yards_per_route_run and scrambles agree on
--     every one of their multi-facet player-games (0 disagreements over 7,275
--     for penalties, 7,123 for grades_offense, 1,642 for routes), so each gets
--     ONE column.
--   * Everything else collides and is namespaced by unit. `yards` disagrees on
--     2,423 of 2,457 multi-facet player-games because it is passing yards,
--     receiving yards, rushing yards, punt yards and coverage yards allowed
--     depending on the facet. Same for first_downs, longest, attempts,
--     touchdowns, targets, receptions, drops, fumbles and the rest.
--   * `sacks` is namespaced despite showing 0 disagreements: it appears in only
--     2 overlapping player-games, and passing sacks (taken) versus defense
--     sacks (made) are opposite facts. A 2-row sample is not evidence.
--   * The defense facet's coverage line is suffixed _allowed, because targets
--     and receptions there are charged against the defender.
--   * Grades take a grade_ prefix rather than mirroring pff_player_seasonlogs'
--     bare `offense` / `pass_block` / `coverage`: those names are exactly what
--     the schema naming convention discourages, and `pass` and `run` would fail
--     the five-character floor outright on a new table.
--
-- Types are sized from the observed range and scale of every field across all
-- 654,696 rows, not from assumption. Notable: rushing_elusive_rating spans
-- -400 to 16200 and needs numeric(6,1); every other rate fits numeric(4,1).
--
-- See user:task/league/repoint-analytics-at-pff-facet-tables.md.

CREATE TABLE public.pff_player_gamelogs (
    pid character varying(25) NOT NULL,
    esbid character varying(20) NOT NULL,
    season_year smallint NOT NULL,
    pff_game_id bigint,
    pff_player_id integer,
    pff_team_id smallint,
    nfl_team character varying(3),
    player_position character varying(5),

    -- Verified identical across every facet that carries them.
    grade_offense numeric(4,1),
    grade_offense_penalty numeric(4,1),
    grade_defense numeric(4,1),
    grade_defense_penalty numeric(4,1),
    grade_pass numeric(4,1),
    grade_run numeric(4,1),
    grade_pass_block numeric(4,1),
    grade_run_block numeric(4,1),
    grade_pass_route numeric(4,1),
    grade_hands_drop numeric(4,1),
    grade_hands_fumble numeric(4,1),
    grade_coverage_defense numeric(4,1),
    grade_pass_rush_defense numeric(4,1),
    grade_run_defense numeric(4,1),
    grade_tackle numeric(4,1),
    grade_punter numeric(4,1),
    penalties smallint,
    declined_penalties smallint,
    routes smallint,
    yards_per_route_run numeric(5,2),
    scrambles smallint,

    -- offense/summary snap counts.
    snaps_offense_total smallint,
    snaps_offense_pass smallint,
    snaps_offense_run smallint,
    snaps_offense_total_pass smallint,
    snaps_offense_total_run smallint,
    snaps_pass_block smallint,
    snaps_run_block smallint,
    snaps_pass_route smallint,

    -- passing/summary.
    passing_snaps smallint,
    passing_dropbacks smallint,
    passing_attempts smallint,
    passing_completions smallint,
    passing_yards smallint,
    passing_touchdowns smallint,
    passing_interceptions smallint,
    passing_first_downs smallint,
    passing_aimed_passes smallint,
    passing_batted_passes smallint,
    passing_big_time_throws smallint,
    passing_big_time_throw_rate numeric(4,1),
    passing_turnover_worthy_plays smallint,
    passing_turnover_worthy_play_rate numeric(4,1),
    passing_accuracy_percentage numeric(4,1),
    passing_completion_percentage numeric(4,1),
    passing_drops smallint,
    passing_drop_rate numeric(4,1),
    passing_hit_as_threw smallint,
    passing_sacks smallint,
    passing_sack_percentage numeric(4,1),
    passing_spikes smallint,
    passing_throwaways smallint,
    passing_defense_generated_pressures smallint,
    passing_pressure_to_sack_rate numeric(4,1),
    passing_quarterback_rating numeric(4,1),
    passing_average_depth_of_target numeric(4,1),
    passing_average_time_to_throw numeric(4,2),
    passing_yards_per_attempt numeric(4,1),

    -- receiving/summary.
    receiving_targets smallint,
    receiving_receptions smallint,
    receiving_yards smallint,
    receiving_touchdowns smallint,
    receiving_first_downs smallint,
    receiving_longest smallint,
    receiving_drops smallint,
    receiving_drop_rate numeric(4,1),
    receiving_fumbles smallint,
    receiving_interceptions smallint,
    receiving_caught_percentage numeric(4,1),
    receiving_contested_targets smallint,
    receiving_contested_receptions smallint,
    receiving_contested_catch_rate numeric(4,1),
    receiving_avoided_tackles smallint,
    receiving_yards_after_catch smallint,
    receiving_yards_after_catch_per_reception numeric(4,1),
    receiving_yards_per_reception numeric(4,1),
    receiving_average_depth_of_target numeric(4,1),
    receiving_targeted_quarterback_rating numeric(4,1),
    receiving_pass_plays smallint,
    receiving_pass_blocks smallint,
    receiving_pass_block_rate numeric(4,1),
    receiving_route_rate numeric(4,1),
    receiving_inline_snaps smallint,
    receiving_inline_rate numeric(4,1),
    receiving_slot_snaps smallint,
    receiving_slot_rate numeric(4,1),
    receiving_wide_snaps smallint,
    receiving_wide_rate numeric(4,1),

    -- rushing/summary.
    rushing_run_plays smallint,
    rushing_attempts smallint,
    rushing_yards smallint,
    rushing_touchdowns smallint,
    rushing_first_downs smallint,
    rushing_longest smallint,
    rushing_fumbles smallint,
    rushing_drops smallint,
    rushing_designed_yards smallint,
    rushing_scramble_yards smallint,
    rushing_total_touches smallint,
    rushing_explosive smallint,
    rushing_gap_attempts smallint,
    rushing_zone_attempts smallint,
    rushing_avoided_tackles smallint,
    rushing_breakaway_attempts smallint,
    rushing_breakaway_yards smallint,
    rushing_breakaway_percentage numeric(4,1),
    rushing_elusive_rating numeric(6,1),
    rushing_elusive_receiving_missed_tackles_forced smallint,
    rushing_elusive_rushing_missed_tackles_forced smallint,
    rushing_elusive_yards_after_contact smallint,
    rushing_yards_after_contact smallint,
    rushing_yards_after_contact_per_attempt numeric(5,2),
    rushing_yards_per_attempt numeric(4,1),
    rushing_targets smallint,
    rushing_receptions smallint,
    rushing_receiving_yards smallint,

    -- defense/summary.
    defense_snaps smallint,
    defense_snaps_box smallint,
    defense_snaps_corner smallint,
    defense_snaps_coverage smallint,
    defense_snaps_defensive_line smallint,
    defense_snaps_center_guard_gap smallint,
    defense_snaps_guard_tackle_gap smallint,
    defense_snaps_defensive_line_outside_tackle smallint,
    defense_snaps_defensive_line_over_tackle smallint,
    defense_snaps_free_safety smallint,
    defense_snaps_second_level smallint,
    defense_snaps_pass_rush smallint,
    defense_snaps_run_defense smallint,
    defense_snaps_slot smallint,
    defense_tackles smallint,
    defense_assists smallint,
    defense_missed_tackles smallint,
    defense_missed_tackle_rate numeric(4,1),
    defense_tackles_for_loss smallint,
    defense_stops smallint,
    defense_sacks smallint,
    defense_hits smallint,
    defense_hurries smallint,
    defense_total_pressures smallint,
    defense_batted_passes smallint,
    defense_pass_breakups smallint,
    defense_interceptions smallint,
    defense_interception_touchdowns smallint,
    defense_forced_fumbles smallint,
    defense_fumble_recoveries smallint,
    defense_fumble_recovery_touchdowns smallint,
    defense_safeties smallint,
    defense_targets_allowed smallint,
    defense_receptions_allowed smallint,
    defense_yards_allowed smallint,
    defense_touchdowns_allowed smallint,
    defense_yards_after_catch_allowed smallint,
    defense_yards_per_reception_allowed numeric(4,1),
    defense_longest_reception_allowed smallint,
    defense_catch_rate_allowed numeric(4,1),
    defense_quarterback_rating_against numeric(4,1),

    -- punting/summary.
    punting_snaps smallint,
    punting_attempts smallint,
    punting_yards smallint,
    punting_blocks smallint,
    punting_touchbacks smallint,
    punting_inside_twenty_yard_line smallint,
    punting_downed smallint,
    punting_out_of_bounds smallint,
    punting_fair_catches smallint,
    punting_returns smallint,
    punting_return_yards smallint,
    punting_longest_punt smallint,
    punting_total_net_yards smallint,
    punting_average_net_yards numeric(5,2),
    punting_average_yards_per_attempt numeric(5,2),
    punting_average_yards_per_return numeric(4,1),
    punting_percentage_returned numeric(4,1),
    punting_attempts_with_hangtime smallint,
    punting_total_hangtime numeric(5,2),
    punting_average_hangtime numeric(4,2),

    updated_at timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT pff_player_gamelogs_pkey PRIMARY KEY (pid, esbid),
    CONSTRAINT pff_player_gamelogs_player_position_vocabulary CHECK (
      ((player_position IS NULL) OR ((player_position)::text = ANY ((ARRAY[
        'QB','RB','FB','WR','TE','OL','T','G','C','DL','DE','DT','NT','EDGE',
        'LB','OLB','ILB','MLB','DB','CB','S','K','P','LS','DST'
      ]::character varying[])::text[]))))
);

CREATE INDEX pff_player_gamelogs_esbid_index ON public.pff_player_gamelogs (esbid);
CREATE INDEX pff_player_gamelogs_season_year_index ON public.pff_player_gamelogs (season_year);
CREATE INDEX pff_player_gamelogs_pff_player_id_index ON public.pff_player_gamelogs (pff_player_id);

COMMENT ON TABLE public.pff_player_gamelogs IS
  'PFF player measurements at game grain, merged from the six PFF game-level summary facets. Every column is PFF''s own number; nothing here is reconciled against nfl_plays, player_gamelogs or NGS-derived tables. Where PFF and another vendor measure the same concept (routes), the two are separately named and separately sourced by design.';
