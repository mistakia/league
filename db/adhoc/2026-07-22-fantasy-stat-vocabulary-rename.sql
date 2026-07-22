-- Fantasy-stat vocabulary rename: one full-word fantasy-scoring vocabulary end
-- to end (user:task/league/redesign-league-database-schema.md, fantasy-stat
-- cluster). Metadata-only ALTER RENAME COLUMN across the 9 in-scope tables
-- (parent rename cascades to every partition); the ratified old->new map lives
-- in db/adhoc/fantasy-stat-renames.mjs (FANTASY_STAT_RENAMES), the exact
-- per-table intersection is generated from it. NO compat view, NO reverse map:
-- code is repointed to the new names in the same coordinated cutover, applied in
-- the offseason writer-free window (identity-crosswalk dimension precedent).
--
-- Section 2 rewrites user_data_views.table_state JSON for the 36 EXPANDED
-- nfl_team_seasonlogs_<code> data-view field ids (the only field-id family that
-- embeds a raw short code). Each REPLACE is double-quote-anchored so it matches
-- the whole JSON string value and cannot partial-substring-match a longer key
-- (precedent db/adhoc/2026-05-16-restructure-points-added-pipeline.sql).
--
-- Runs in a single transaction via yarn db:exec (ON_ERROR_STOP=1). The renames
-- are catalog-only and instant even on the 10M-row partitioned families, but the
-- timeout is disabled for the whole batch out of caution.

SET LOCAL statement_timeout = 0;

------------------------------------------------------------------------
-- Section 1: column renames (generated per-table intersection of the map)
------------------------------------------------------------------------
-- league_scoring_formats (23 columns)
ALTER TABLE public.league_scoring_formats RENAME COLUMN pa TO passing_attempts;
ALTER TABLE public.league_scoring_formats RENAME COLUMN pc TO passing_completions;
ALTER TABLE public.league_scoring_formats RENAME COLUMN py TO passing_yards;
ALTER TABLE public.league_scoring_formats RENAME COLUMN ints TO passing_interceptions;
ALTER TABLE public.league_scoring_formats RENAME COLUMN tdp TO passing_touchdowns;
ALTER TABLE public.league_scoring_formats RENAME COLUMN ra TO rushing_attempts;
ALTER TABLE public.league_scoring_formats RENAME COLUMN ry TO rushing_yards;
ALTER TABLE public.league_scoring_formats RENAME COLUMN tdr TO rushing_touchdowns;
ALTER TABLE public.league_scoring_formats RENAME COLUMN rush_first_down TO rushing_first_downs;
ALTER TABLE public.league_scoring_formats RENAME COLUMN trg TO targets;
ALTER TABLE public.league_scoring_formats RENAME COLUMN rec TO receptions;
ALTER TABLE public.league_scoring_formats RENAME COLUMN recy TO receiving_yards;
ALTER TABLE public.league_scoring_formats RENAME COLUMN rec_first_down TO receiving_first_downs;
ALTER TABLE public.league_scoring_formats RENAME COLUMN tdrec TO receiving_touchdowns;
ALTER TABLE public.league_scoring_formats RENAME COLUMN fuml TO fumbles_lost;
ALTER TABLE public.league_scoring_formats RENAME COLUMN twoptc TO two_point_conversions;
ALTER TABLE public.league_scoring_formats RENAME COLUMN prtd TO punt_return_touchdowns;
ALTER TABLE public.league_scoring_formats RENAME COLUMN krtd TO kickoff_return_touchdowns;
ALTER TABLE public.league_scoring_formats RENAME COLUMN fum_ret_td TO fumble_return_touchdowns;
ALTER TABLE public.league_scoring_formats RENAME COLUMN rbrec TO running_back_reception;
ALTER TABLE public.league_scoring_formats RENAME COLUMN wrrec TO wide_receiver_reception;
ALTER TABLE public.league_scoring_formats RENAME COLUMN terec TO tight_end_reception;
ALTER TABLE public.league_scoring_formats RENAME COLUMN exclude_qb_kneels TO exclude_quarterback_kneels;

-- nfl_team_seasonlogs (40 columns)
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN pa TO passing_attempts;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN pc TO passing_completions;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN py TO passing_yards;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN ints TO passing_interceptions;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN tdp TO passing_touchdowns;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN ra TO rushing_attempts;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN ry TO rushing_yards;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN ry_excluding_kneels TO rushing_yards_excluding_kneels;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN tdr TO rushing_touchdowns;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN rush_first_down TO rushing_first_downs;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN trg TO targets;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN rec TO receptions;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN recy TO receiving_yards;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN rec_first_down TO receiving_first_downs;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN tdrec TO receiving_touchdowns;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN fuml TO fumbles_lost;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN twoptc TO two_point_conversions;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN prtd TO punt_return_touchdowns;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN krtd TO kickoff_return_touchdowns;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN fum_ret_td TO fumble_return_touchdowns;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN fgm TO field_goals_made;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN fgy TO field_goal_yards;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN fg19 TO field_goals_made_0_19_yards;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN fg29 TO field_goals_made_20_29_yards;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN fg39 TO field_goals_made_30_39_yards;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN fg49 TO field_goals_made_40_49_yards;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN fg50 TO field_goals_made_50_plus_yards;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN xpm TO extra_points_made;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN dsk TO defensive_sacks;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN dint TO defensive_interceptions;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN dff TO defensive_forced_fumbles;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN drf TO defensive_recovered_fumbles;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN dtno TO defensive_three_and_outs;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN dfds TO defensive_fourth_down_stops;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN dpa TO defensive_points_against;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN dya TO defensive_yards_against;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN dblk TO defensive_blocked_kicks;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN dsf TO defensive_safeties;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN dtpr TO defensive_two_point_returns;
ALTER TABLE public.nfl_team_seasonlogs RENAME COLUMN dtd TO defensive_touchdowns;

-- player_gamelogs (40 columns)
ALTER TABLE public.player_gamelogs RENAME COLUMN pa TO passing_attempts;
ALTER TABLE public.player_gamelogs RENAME COLUMN pc TO passing_completions;
ALTER TABLE public.player_gamelogs RENAME COLUMN py TO passing_yards;
ALTER TABLE public.player_gamelogs RENAME COLUMN ints TO passing_interceptions;
ALTER TABLE public.player_gamelogs RENAME COLUMN tdp TO passing_touchdowns;
ALTER TABLE public.player_gamelogs RENAME COLUMN ra TO rushing_attempts;
ALTER TABLE public.player_gamelogs RENAME COLUMN ry TO rushing_yards;
ALTER TABLE public.player_gamelogs RENAME COLUMN ry_excluding_kneels TO rushing_yards_excluding_kneels;
ALTER TABLE public.player_gamelogs RENAME COLUMN tdr TO rushing_touchdowns;
ALTER TABLE public.player_gamelogs RENAME COLUMN rush_first_down TO rushing_first_downs;
ALTER TABLE public.player_gamelogs RENAME COLUMN trg TO targets;
ALTER TABLE public.player_gamelogs RENAME COLUMN rec TO receptions;
ALTER TABLE public.player_gamelogs RENAME COLUMN recy TO receiving_yards;
ALTER TABLE public.player_gamelogs RENAME COLUMN rec_first_down TO receiving_first_downs;
ALTER TABLE public.player_gamelogs RENAME COLUMN tdrec TO receiving_touchdowns;
ALTER TABLE public.player_gamelogs RENAME COLUMN fuml TO fumbles_lost;
ALTER TABLE public.player_gamelogs RENAME COLUMN twoptc TO two_point_conversions;
ALTER TABLE public.player_gamelogs RENAME COLUMN prtd TO punt_return_touchdowns;
ALTER TABLE public.player_gamelogs RENAME COLUMN krtd TO kickoff_return_touchdowns;
ALTER TABLE public.player_gamelogs RENAME COLUMN fum_ret_td TO fumble_return_touchdowns;
ALTER TABLE public.player_gamelogs RENAME COLUMN fgm TO field_goals_made;
ALTER TABLE public.player_gamelogs RENAME COLUMN fgy TO field_goal_yards;
ALTER TABLE public.player_gamelogs RENAME COLUMN fg19 TO field_goals_made_0_19_yards;
ALTER TABLE public.player_gamelogs RENAME COLUMN fg29 TO field_goals_made_20_29_yards;
ALTER TABLE public.player_gamelogs RENAME COLUMN fg39 TO field_goals_made_30_39_yards;
ALTER TABLE public.player_gamelogs RENAME COLUMN fg49 TO field_goals_made_40_49_yards;
ALTER TABLE public.player_gamelogs RENAME COLUMN fg50 TO field_goals_made_50_plus_yards;
ALTER TABLE public.player_gamelogs RENAME COLUMN xpm TO extra_points_made;
ALTER TABLE public.player_gamelogs RENAME COLUMN dsk TO defensive_sacks;
ALTER TABLE public.player_gamelogs RENAME COLUMN dint TO defensive_interceptions;
ALTER TABLE public.player_gamelogs RENAME COLUMN dff TO defensive_forced_fumbles;
ALTER TABLE public.player_gamelogs RENAME COLUMN drf TO defensive_recovered_fumbles;
ALTER TABLE public.player_gamelogs RENAME COLUMN dtno TO defensive_three_and_outs;
ALTER TABLE public.player_gamelogs RENAME COLUMN dfds TO defensive_fourth_down_stops;
ALTER TABLE public.player_gamelogs RENAME COLUMN dpa TO defensive_points_against;
ALTER TABLE public.player_gamelogs RENAME COLUMN dya TO defensive_yards_against;
ALTER TABLE public.player_gamelogs RENAME COLUMN dblk TO defensive_blocked_kicks;
ALTER TABLE public.player_gamelogs RENAME COLUMN dsf TO defensive_safeties;
ALTER TABLE public.player_gamelogs RENAME COLUMN dtpr TO defensive_two_point_returns;
ALTER TABLE public.player_gamelogs RENAME COLUMN dtd TO defensive_touchdowns;

-- player_seasonlogs (40 columns)
ALTER TABLE public.player_seasonlogs RENAME COLUMN pa TO passing_attempts;
ALTER TABLE public.player_seasonlogs RENAME COLUMN pc TO passing_completions;
ALTER TABLE public.player_seasonlogs RENAME COLUMN py TO passing_yards;
ALTER TABLE public.player_seasonlogs RENAME COLUMN ints TO passing_interceptions;
ALTER TABLE public.player_seasonlogs RENAME COLUMN tdp TO passing_touchdowns;
ALTER TABLE public.player_seasonlogs RENAME COLUMN ra TO rushing_attempts;
ALTER TABLE public.player_seasonlogs RENAME COLUMN ry TO rushing_yards;
ALTER TABLE public.player_seasonlogs RENAME COLUMN ry_excluding_kneels TO rushing_yards_excluding_kneels;
ALTER TABLE public.player_seasonlogs RENAME COLUMN tdr TO rushing_touchdowns;
ALTER TABLE public.player_seasonlogs RENAME COLUMN rush_first_down TO rushing_first_downs;
ALTER TABLE public.player_seasonlogs RENAME COLUMN trg TO targets;
ALTER TABLE public.player_seasonlogs RENAME COLUMN rec TO receptions;
ALTER TABLE public.player_seasonlogs RENAME COLUMN recy TO receiving_yards;
ALTER TABLE public.player_seasonlogs RENAME COLUMN rec_first_down TO receiving_first_downs;
ALTER TABLE public.player_seasonlogs RENAME COLUMN tdrec TO receiving_touchdowns;
ALTER TABLE public.player_seasonlogs RENAME COLUMN fuml TO fumbles_lost;
ALTER TABLE public.player_seasonlogs RENAME COLUMN twoptc TO two_point_conversions;
ALTER TABLE public.player_seasonlogs RENAME COLUMN prtd TO punt_return_touchdowns;
ALTER TABLE public.player_seasonlogs RENAME COLUMN krtd TO kickoff_return_touchdowns;
ALTER TABLE public.player_seasonlogs RENAME COLUMN fum_ret_td TO fumble_return_touchdowns;
ALTER TABLE public.player_seasonlogs RENAME COLUMN fgm TO field_goals_made;
ALTER TABLE public.player_seasonlogs RENAME COLUMN fgy TO field_goal_yards;
ALTER TABLE public.player_seasonlogs RENAME COLUMN fg19 TO field_goals_made_0_19_yards;
ALTER TABLE public.player_seasonlogs RENAME COLUMN fg29 TO field_goals_made_20_29_yards;
ALTER TABLE public.player_seasonlogs RENAME COLUMN fg39 TO field_goals_made_30_39_yards;
ALTER TABLE public.player_seasonlogs RENAME COLUMN fg49 TO field_goals_made_40_49_yards;
ALTER TABLE public.player_seasonlogs RENAME COLUMN fg50 TO field_goals_made_50_plus_yards;
ALTER TABLE public.player_seasonlogs RENAME COLUMN xpm TO extra_points_made;
ALTER TABLE public.player_seasonlogs RENAME COLUMN dsk TO defensive_sacks;
ALTER TABLE public.player_seasonlogs RENAME COLUMN dint TO defensive_interceptions;
ALTER TABLE public.player_seasonlogs RENAME COLUMN dff TO defensive_forced_fumbles;
ALTER TABLE public.player_seasonlogs RENAME COLUMN drf TO defensive_recovered_fumbles;
ALTER TABLE public.player_seasonlogs RENAME COLUMN dtno TO defensive_three_and_outs;
ALTER TABLE public.player_seasonlogs RENAME COLUMN dfds TO defensive_fourth_down_stops;
ALTER TABLE public.player_seasonlogs RENAME COLUMN dpa TO defensive_points_against;
ALTER TABLE public.player_seasonlogs RENAME COLUMN dya TO defensive_yards_against;
ALTER TABLE public.player_seasonlogs RENAME COLUMN dblk TO defensive_blocked_kicks;
ALTER TABLE public.player_seasonlogs RENAME COLUMN dsf TO defensive_safeties;
ALTER TABLE public.player_seasonlogs RENAME COLUMN dtpr TO defensive_two_point_returns;
ALTER TABLE public.player_seasonlogs RENAME COLUMN dtd TO defensive_touchdowns;

-- projections (36 columns)
ALTER TABLE public.projections RENAME COLUMN pa TO passing_attempts;
ALTER TABLE public.projections RENAME COLUMN pc TO passing_completions;
ALTER TABLE public.projections RENAME COLUMN py TO passing_yards;
ALTER TABLE public.projections RENAME COLUMN ints TO passing_interceptions;
ALTER TABLE public.projections RENAME COLUMN tdp TO passing_touchdowns;
ALTER TABLE public.projections RENAME COLUMN ra TO rushing_attempts;
ALTER TABLE public.projections RENAME COLUMN ry TO rushing_yards;
ALTER TABLE public.projections RENAME COLUMN tdr TO rushing_touchdowns;
ALTER TABLE public.projections RENAME COLUMN trg TO targets;
ALTER TABLE public.projections RENAME COLUMN rec TO receptions;
ALTER TABLE public.projections RENAME COLUMN recy TO receiving_yards;
ALTER TABLE public.projections RENAME COLUMN tdrec TO receiving_touchdowns;
ALTER TABLE public.projections RENAME COLUMN fuml TO fumbles_lost;
ALTER TABLE public.projections RENAME COLUMN twoptc TO two_point_conversions;
ALTER TABLE public.projections RENAME COLUMN prtd TO punt_return_touchdowns;
ALTER TABLE public.projections RENAME COLUMN krtd TO kickoff_return_touchdowns;
ALTER TABLE public.projections RENAME COLUMN fgm TO field_goals_made;
ALTER TABLE public.projections RENAME COLUMN fgy TO field_goal_yards;
ALTER TABLE public.projections RENAME COLUMN fg19 TO field_goals_made_0_19_yards;
ALTER TABLE public.projections RENAME COLUMN fg29 TO field_goals_made_20_29_yards;
ALTER TABLE public.projections RENAME COLUMN fg39 TO field_goals_made_30_39_yards;
ALTER TABLE public.projections RENAME COLUMN fg49 TO field_goals_made_40_49_yards;
ALTER TABLE public.projections RENAME COLUMN fg50 TO field_goals_made_50_plus_yards;
ALTER TABLE public.projections RENAME COLUMN xpm TO extra_points_made;
ALTER TABLE public.projections RENAME COLUMN dsk TO defensive_sacks;
ALTER TABLE public.projections RENAME COLUMN dint TO defensive_interceptions;
ALTER TABLE public.projections RENAME COLUMN dff TO defensive_forced_fumbles;
ALTER TABLE public.projections RENAME COLUMN drf TO defensive_recovered_fumbles;
ALTER TABLE public.projections RENAME COLUMN dtno TO defensive_three_and_outs;
ALTER TABLE public.projections RENAME COLUMN dfds TO defensive_fourth_down_stops;
ALTER TABLE public.projections RENAME COLUMN dpa TO defensive_points_against;
ALTER TABLE public.projections RENAME COLUMN dya TO defensive_yards_against;
ALTER TABLE public.projections RENAME COLUMN dblk TO defensive_blocked_kicks;
ALTER TABLE public.projections RENAME COLUMN dsf TO defensive_safeties;
ALTER TABLE public.projections RENAME COLUMN dtpr TO defensive_two_point_returns;
ALTER TABLE public.projections RENAME COLUMN dtd TO defensive_touchdowns;

-- projections_archive (36 columns)
ALTER TABLE public.projections_archive RENAME COLUMN pa TO passing_attempts;
ALTER TABLE public.projections_archive RENAME COLUMN pc TO passing_completions;
ALTER TABLE public.projections_archive RENAME COLUMN py TO passing_yards;
ALTER TABLE public.projections_archive RENAME COLUMN ints TO passing_interceptions;
ALTER TABLE public.projections_archive RENAME COLUMN tdp TO passing_touchdowns;
ALTER TABLE public.projections_archive RENAME COLUMN ra TO rushing_attempts;
ALTER TABLE public.projections_archive RENAME COLUMN ry TO rushing_yards;
ALTER TABLE public.projections_archive RENAME COLUMN tdr TO rushing_touchdowns;
ALTER TABLE public.projections_archive RENAME COLUMN trg TO targets;
ALTER TABLE public.projections_archive RENAME COLUMN rec TO receptions;
ALTER TABLE public.projections_archive RENAME COLUMN recy TO receiving_yards;
ALTER TABLE public.projections_archive RENAME COLUMN tdrec TO receiving_touchdowns;
ALTER TABLE public.projections_archive RENAME COLUMN fuml TO fumbles_lost;
ALTER TABLE public.projections_archive RENAME COLUMN twoptc TO two_point_conversions;
ALTER TABLE public.projections_archive RENAME COLUMN prtd TO punt_return_touchdowns;
ALTER TABLE public.projections_archive RENAME COLUMN krtd TO kickoff_return_touchdowns;
ALTER TABLE public.projections_archive RENAME COLUMN fgm TO field_goals_made;
ALTER TABLE public.projections_archive RENAME COLUMN fgy TO field_goal_yards;
ALTER TABLE public.projections_archive RENAME COLUMN fg19 TO field_goals_made_0_19_yards;
ALTER TABLE public.projections_archive RENAME COLUMN fg29 TO field_goals_made_20_29_yards;
ALTER TABLE public.projections_archive RENAME COLUMN fg39 TO field_goals_made_30_39_yards;
ALTER TABLE public.projections_archive RENAME COLUMN fg49 TO field_goals_made_40_49_yards;
ALTER TABLE public.projections_archive RENAME COLUMN fg50 TO field_goals_made_50_plus_yards;
ALTER TABLE public.projections_archive RENAME COLUMN xpm TO extra_points_made;
ALTER TABLE public.projections_archive RENAME COLUMN dsk TO defensive_sacks;
ALTER TABLE public.projections_archive RENAME COLUMN dint TO defensive_interceptions;
ALTER TABLE public.projections_archive RENAME COLUMN dff TO defensive_forced_fumbles;
ALTER TABLE public.projections_archive RENAME COLUMN drf TO defensive_recovered_fumbles;
ALTER TABLE public.projections_archive RENAME COLUMN dtno TO defensive_three_and_outs;
ALTER TABLE public.projections_archive RENAME COLUMN dfds TO defensive_fourth_down_stops;
ALTER TABLE public.projections_archive RENAME COLUMN dpa TO defensive_points_against;
ALTER TABLE public.projections_archive RENAME COLUMN dya TO defensive_yards_against;
ALTER TABLE public.projections_archive RENAME COLUMN dblk TO defensive_blocked_kicks;
ALTER TABLE public.projections_archive RENAME COLUMN dsf TO defensive_safeties;
ALTER TABLE public.projections_archive RENAME COLUMN dtpr TO defensive_two_point_returns;
ALTER TABLE public.projections_archive RENAME COLUMN dtd TO defensive_touchdowns;

-- projections_index (38 columns)
ALTER TABLE public.projections_index RENAME COLUMN pa TO passing_attempts;
ALTER TABLE public.projections_index RENAME COLUMN pc TO passing_completions;
ALTER TABLE public.projections_index RENAME COLUMN py TO passing_yards;
ALTER TABLE public.projections_index RENAME COLUMN ints TO passing_interceptions;
ALTER TABLE public.projections_index RENAME COLUMN tdp TO passing_touchdowns;
ALTER TABLE public.projections_index RENAME COLUMN ra TO rushing_attempts;
ALTER TABLE public.projections_index RENAME COLUMN ry TO rushing_yards;
ALTER TABLE public.projections_index RENAME COLUMN tdr TO rushing_touchdowns;
ALTER TABLE public.projections_index RENAME COLUMN rush_first_down TO rushing_first_downs;
ALTER TABLE public.projections_index RENAME COLUMN trg TO targets;
ALTER TABLE public.projections_index RENAME COLUMN rec TO receptions;
ALTER TABLE public.projections_index RENAME COLUMN recy TO receiving_yards;
ALTER TABLE public.projections_index RENAME COLUMN rec_first_down TO receiving_first_downs;
ALTER TABLE public.projections_index RENAME COLUMN tdrec TO receiving_touchdowns;
ALTER TABLE public.projections_index RENAME COLUMN fuml TO fumbles_lost;
ALTER TABLE public.projections_index RENAME COLUMN twoptc TO two_point_conversions;
ALTER TABLE public.projections_index RENAME COLUMN prtd TO punt_return_touchdowns;
ALTER TABLE public.projections_index RENAME COLUMN krtd TO kickoff_return_touchdowns;
ALTER TABLE public.projections_index RENAME COLUMN fgm TO field_goals_made;
ALTER TABLE public.projections_index RENAME COLUMN fgy TO field_goal_yards;
ALTER TABLE public.projections_index RENAME COLUMN fg19 TO field_goals_made_0_19_yards;
ALTER TABLE public.projections_index RENAME COLUMN fg29 TO field_goals_made_20_29_yards;
ALTER TABLE public.projections_index RENAME COLUMN fg39 TO field_goals_made_30_39_yards;
ALTER TABLE public.projections_index RENAME COLUMN fg49 TO field_goals_made_40_49_yards;
ALTER TABLE public.projections_index RENAME COLUMN fg50 TO field_goals_made_50_plus_yards;
ALTER TABLE public.projections_index RENAME COLUMN xpm TO extra_points_made;
ALTER TABLE public.projections_index RENAME COLUMN dsk TO defensive_sacks;
ALTER TABLE public.projections_index RENAME COLUMN dint TO defensive_interceptions;
ALTER TABLE public.projections_index RENAME COLUMN dff TO defensive_forced_fumbles;
ALTER TABLE public.projections_index RENAME COLUMN drf TO defensive_recovered_fumbles;
ALTER TABLE public.projections_index RENAME COLUMN dtno TO defensive_three_and_outs;
ALTER TABLE public.projections_index RENAME COLUMN dfds TO defensive_fourth_down_stops;
ALTER TABLE public.projections_index RENAME COLUMN dpa TO defensive_points_against;
ALTER TABLE public.projections_index RENAME COLUMN dya TO defensive_yards_against;
ALTER TABLE public.projections_index RENAME COLUMN dblk TO defensive_blocked_kicks;
ALTER TABLE public.projections_index RENAME COLUMN dsf TO defensive_safeties;
ALTER TABLE public.projections_index RENAME COLUMN dtpr TO defensive_two_point_returns;
ALTER TABLE public.projections_index RENAME COLUMN dtd TO defensive_touchdowns;

-- ros_projections (36 columns)
ALTER TABLE public.ros_projections RENAME COLUMN pa TO passing_attempts;
ALTER TABLE public.ros_projections RENAME COLUMN pc TO passing_completions;
ALTER TABLE public.ros_projections RENAME COLUMN py TO passing_yards;
ALTER TABLE public.ros_projections RENAME COLUMN ints TO passing_interceptions;
ALTER TABLE public.ros_projections RENAME COLUMN tdp TO passing_touchdowns;
ALTER TABLE public.ros_projections RENAME COLUMN ra TO rushing_attempts;
ALTER TABLE public.ros_projections RENAME COLUMN ry TO rushing_yards;
ALTER TABLE public.ros_projections RENAME COLUMN tdr TO rushing_touchdowns;
ALTER TABLE public.ros_projections RENAME COLUMN trg TO targets;
ALTER TABLE public.ros_projections RENAME COLUMN rec TO receptions;
ALTER TABLE public.ros_projections RENAME COLUMN recy TO receiving_yards;
ALTER TABLE public.ros_projections RENAME COLUMN tdrec TO receiving_touchdowns;
ALTER TABLE public.ros_projections RENAME COLUMN fuml TO fumbles_lost;
ALTER TABLE public.ros_projections RENAME COLUMN twoptc TO two_point_conversions;
ALTER TABLE public.ros_projections RENAME COLUMN prtd TO punt_return_touchdowns;
ALTER TABLE public.ros_projections RENAME COLUMN krtd TO kickoff_return_touchdowns;
ALTER TABLE public.ros_projections RENAME COLUMN fgm TO field_goals_made;
ALTER TABLE public.ros_projections RENAME COLUMN fgy TO field_goal_yards;
ALTER TABLE public.ros_projections RENAME COLUMN fg19 TO field_goals_made_0_19_yards;
ALTER TABLE public.ros_projections RENAME COLUMN fg29 TO field_goals_made_20_29_yards;
ALTER TABLE public.ros_projections RENAME COLUMN fg39 TO field_goals_made_30_39_yards;
ALTER TABLE public.ros_projections RENAME COLUMN fg49 TO field_goals_made_40_49_yards;
ALTER TABLE public.ros_projections RENAME COLUMN fg50 TO field_goals_made_50_plus_yards;
ALTER TABLE public.ros_projections RENAME COLUMN xpm TO extra_points_made;
ALTER TABLE public.ros_projections RENAME COLUMN dsk TO defensive_sacks;
ALTER TABLE public.ros_projections RENAME COLUMN dint TO defensive_interceptions;
ALTER TABLE public.ros_projections RENAME COLUMN dff TO defensive_forced_fumbles;
ALTER TABLE public.ros_projections RENAME COLUMN drf TO defensive_recovered_fumbles;
ALTER TABLE public.ros_projections RENAME COLUMN dtno TO defensive_three_and_outs;
ALTER TABLE public.ros_projections RENAME COLUMN dfds TO defensive_fourth_down_stops;
ALTER TABLE public.ros_projections RENAME COLUMN dpa TO defensive_points_against;
ALTER TABLE public.ros_projections RENAME COLUMN dya TO defensive_yards_against;
ALTER TABLE public.ros_projections RENAME COLUMN dblk TO defensive_blocked_kicks;
ALTER TABLE public.ros_projections RENAME COLUMN dsf TO defensive_safeties;
ALTER TABLE public.ros_projections RENAME COLUMN dtpr TO defensive_two_point_returns;
ALTER TABLE public.ros_projections RENAME COLUMN dtd TO defensive_touchdowns;

-- scoring_format_player_projection_points (35 columns)
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN pa TO passing_attempts;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN pc TO passing_completions;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN py TO passing_yards;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN ints TO passing_interceptions;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN tdp TO passing_touchdowns;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN ra TO rushing_attempts;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN ry TO rushing_yards;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN tdr TO rushing_touchdowns;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN trg TO targets;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN rec TO receptions;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN recy TO receiving_yards;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN tdrec TO receiving_touchdowns;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN fuml TO fumbles_lost;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN twoptc TO two_point_conversions;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN prtd TO punt_return_touchdowns;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN krtd TO kickoff_return_touchdowns;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN fgm TO field_goals_made;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN fg19 TO field_goals_made_0_19_yards;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN fg29 TO field_goals_made_20_29_yards;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN fg39 TO field_goals_made_30_39_yards;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN fg49 TO field_goals_made_40_49_yards;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN fg50 TO field_goals_made_50_plus_yards;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN xpm TO extra_points_made;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN dsk TO defensive_sacks;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN dint TO defensive_interceptions;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN dff TO defensive_forced_fumbles;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN drf TO defensive_recovered_fumbles;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN dtno TO defensive_three_and_outs;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN dfds TO defensive_fourth_down_stops;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN dpa TO defensive_points_against;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN dya TO defensive_yards_against;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN dblk TO defensive_blocked_kicks;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN dsf TO defensive_safeties;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN dtpr TO defensive_two_point_returns;
ALTER TABLE public.scoring_format_player_projection_points RENAME COLUMN dtd TO defensive_touchdowns;

------------------------------------------------------------------------
-- Section 1b: rewrite function bodies that reference a renamed column.
-- ALTER RENAME COLUMN does NOT rewrite plpgsql function bodies, so the
-- cmv_classify_league_format trigger (fires on league_formats insert/update)
-- keeps reading the old league_scoring_formats.rec until replaced here.
-- (cmv_derive_format_category's `rec` is a local parameter, not a column, and
-- is left as-is.) UNIQUE indexes/constraints DO auto-update on rename, so the
-- league_scoring_formats_config_unique tuple needs no rebuild.
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cmv_classify_league_format() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  rec_val numeric;
BEGIN
  SELECT receptions INTO rec_val FROM league_scoring_formats WHERE id = NEW.scoring_format_id;
  NEW.format_category := cmv_derive_format_category(NEW.sqb, NEW.sqbrbwrte, rec_val);
  RETURN NEW;
END;
$$;

------------------------------------------------------------------------
-- Section 2: user_data_views.table_state field-id rewrite (36 nfl_team_
-- seasonlogs_<code> ids expanded to full words)
------------------------------------------------------------------------

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_pa"',
  '"nfl_team_seasonlogs_passing_attempts"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_pa"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_pc"',
  '"nfl_team_seasonlogs_passing_completions"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_pc"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_py"',
  '"nfl_team_seasonlogs_passing_yards"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_py"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_ints"',
  '"nfl_team_seasonlogs_passing_interceptions"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_ints"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_tdp"',
  '"nfl_team_seasonlogs_passing_touchdowns"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_tdp"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_ra"',
  '"nfl_team_seasonlogs_rushing_attempts"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_ra"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_ry"',
  '"nfl_team_seasonlogs_rushing_yards"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_ry"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_tdr"',
  '"nfl_team_seasonlogs_rushing_touchdowns"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_tdr"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_fuml"',
  '"nfl_team_seasonlogs_fumbles_lost"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_fuml"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_trg"',
  '"nfl_team_seasonlogs_targets"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_trg"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_rec"',
  '"nfl_team_seasonlogs_receptions"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_rec"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_recy"',
  '"nfl_team_seasonlogs_receiving_yards"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_recy"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_tdrec"',
  '"nfl_team_seasonlogs_receiving_touchdowns"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_tdrec"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_twoptc"',
  '"nfl_team_seasonlogs_two_point_conversions"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_twoptc"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_prtd"',
  '"nfl_team_seasonlogs_punt_return_touchdowns"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_prtd"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_krtd"',
  '"nfl_team_seasonlogs_kickoff_return_touchdowns"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_krtd"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_fgm"',
  '"nfl_team_seasonlogs_field_goals_made"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_fgm"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_fgy"',
  '"nfl_team_seasonlogs_field_goal_yards"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_fgy"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_fg19"',
  '"nfl_team_seasonlogs_field_goals_made_0_19_yards"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_fg19"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_fg29"',
  '"nfl_team_seasonlogs_field_goals_made_20_29_yards"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_fg29"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_fg39"',
  '"nfl_team_seasonlogs_field_goals_made_30_39_yards"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_fg39"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_fg49"',
  '"nfl_team_seasonlogs_field_goals_made_40_49_yards"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_fg49"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_fg50"',
  '"nfl_team_seasonlogs_field_goals_made_50_plus_yards"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_fg50"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_xpm"',
  '"nfl_team_seasonlogs_extra_points_made"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_xpm"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_dsk"',
  '"nfl_team_seasonlogs_defensive_sacks"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_dsk"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_dint"',
  '"nfl_team_seasonlogs_defensive_interceptions"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_dint"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_dff"',
  '"nfl_team_seasonlogs_defensive_forced_fumbles"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_dff"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_drf"',
  '"nfl_team_seasonlogs_defensive_recovered_fumbles"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_drf"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_dtno"',
  '"nfl_team_seasonlogs_defensive_three_and_outs"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_dtno"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_dfds"',
  '"nfl_team_seasonlogs_defensive_fourth_down_stops"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_dfds"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_dpa"',
  '"nfl_team_seasonlogs_defensive_points_against"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_dpa"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_dya"',
  '"nfl_team_seasonlogs_defensive_yards_against"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_dya"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_dblk"',
  '"nfl_team_seasonlogs_defensive_blocked_kicks"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_dblk"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_dsf"',
  '"nfl_team_seasonlogs_defensive_safeties"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_dsf"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_dtpr"',
  '"nfl_team_seasonlogs_defensive_two_point_returns"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_dtpr"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"nfl_team_seasonlogs_dtd"',
  '"nfl_team_seasonlogs_defensive_touchdowns"')::json
WHERE table_state::text LIKE '%"nfl_team_seasonlogs_dtd"%';
