-- league-app cluster, Wave 2 (user:task/league/redesign-league-database-schema.md).
-- Metadata ALTER RENAME COLUMN across the three fantasy standings/career rollup
-- tables: league_team_seasonlogs, league_team_careerlogs, league_user_careerlogs.
-- Larger consumer surface than Wave 1 (context-doc generators, simulation
-- forecasters, the external-league import adapter, several frontend pages,
-- calculate-standings.mjs) but still metadata-only: these tables have periodic-
-- batch writers only (process-matchups, calculate-league-careerlogs,
-- process-playoffs, external-league import), no continuous PM2 writer, so a
-- coordinated flip with no compat view is safe (fantasy-stat-vocab precedent).
--
-- APP-class, NOT CONTRACT: re-verified none of these columns is a data-view
-- field id (grep of libs-server/data-views-column-definitions and
-- app/core/data-views-fields is empty for all three tables), so no
-- user_data_views saved-view migration is required. No FUNCTION/VIEW references
-- these tables (verified), so no plpgsql body rewrite. No index/constraint name
-- embeds a renamed token (the pkeys/unique carry lid/tid/userid/year only), so
-- this is pure column renames. `year` on these core league tables is EXCLUDED
-- (separate schema-wide season_year sweep, pending operator decision), so the
-- league_team_seasonlogs pkey/index on `year` are untouched.
--
-- pSlot*/pPos* accumulate points.total (a POINTS SUM per lineup slot / per
-- starting position, verified in libs-shared/calculate-standings.mjs), NOT a
-- slot label or a positional count -- the names say "points" explicitly.
-- pw/pl/pmax/pmin/pdev/div names ratified with the operator (match the existing
-- potential_points* / all_play sibling vocabulary on these same tables).
-- Runs single-txn via yarn db:exec.

SET LOCAL statement_timeout = 0;

------------------------------------------------------------------------
-- league_team_seasonlogs
------------------------------------------------------------------------
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "apWins" TO all_play_wins;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "apLosses" TO all_play_losses;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "apTies" TO all_play_ties;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN pf TO points_for;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN pa TO points_against;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN pdiff TO point_differential;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN pw TO potential_wins;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN pl TO potential_losses;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN pmax TO highest_weekly_score;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN pmin TO lowest_weekly_score;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN pdev TO weekly_score_deviation;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN div TO division;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot1" TO starter_slot_1_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot2" TO starter_slot_2_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot3" TO starter_slot_3_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot4" TO starter_slot_4_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot5" TO starter_slot_5_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot6" TO starter_slot_6_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot7" TO starter_slot_7_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot8" TO starter_slot_8_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot9" TO starter_slot_9_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot10" TO starter_slot_10_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot11" TO starter_slot_11_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot12" TO starter_slot_12_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot13" TO starter_slot_13_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot14" TO starter_slot_14_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot15" TO starter_slot_15_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot16" TO starter_slot_16_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot17" TO starter_slot_17_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pSlot18" TO starter_slot_18_points;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pPosQB" TO starter_points_qb;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pPosRB" TO starter_points_rb;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pPosWR" TO starter_points_wr;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pPosTE" TO starter_points_te;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pPosK" TO starter_points_k;
ALTER TABLE public.league_team_seasonlogs RENAME COLUMN "pPosDST" TO starter_points_dst;

------------------------------------------------------------------------
-- league_team_careerlogs (no pdev, no div, no pSlot/pPos on this table)
------------------------------------------------------------------------
ALTER TABLE public.league_team_careerlogs RENAME COLUMN "apWins" TO all_play_wins;
ALTER TABLE public.league_team_careerlogs RENAME COLUMN "apLosses" TO all_play_losses;
ALTER TABLE public.league_team_careerlogs RENAME COLUMN "apTies" TO all_play_ties;
ALTER TABLE public.league_team_careerlogs RENAME COLUMN pf TO points_for;
ALTER TABLE public.league_team_careerlogs RENAME COLUMN pa TO points_against;
ALTER TABLE public.league_team_careerlogs RENAME COLUMN pdiff TO point_differential;
ALTER TABLE public.league_team_careerlogs RENAME COLUMN pw TO potential_wins;
ALTER TABLE public.league_team_careerlogs RENAME COLUMN pl TO potential_losses;
ALTER TABLE public.league_team_careerlogs RENAME COLUMN pmax TO highest_weekly_score;
ALTER TABLE public.league_team_careerlogs RENAME COLUMN pmin TO lowest_weekly_score;

------------------------------------------------------------------------
-- league_user_careerlogs (identical shape to careerlogs, keyed by userid)
------------------------------------------------------------------------
ALTER TABLE public.league_user_careerlogs RENAME COLUMN "apWins" TO all_play_wins;
ALTER TABLE public.league_user_careerlogs RENAME COLUMN "apLosses" TO all_play_losses;
ALTER TABLE public.league_user_careerlogs RENAME COLUMN "apTies" TO all_play_ties;
ALTER TABLE public.league_user_careerlogs RENAME COLUMN pf TO points_for;
ALTER TABLE public.league_user_careerlogs RENAME COLUMN pa TO points_against;
ALTER TABLE public.league_user_careerlogs RENAME COLUMN pdiff TO point_differential;
ALTER TABLE public.league_user_careerlogs RENAME COLUMN pw TO potential_wins;
ALTER TABLE public.league_user_careerlogs RENAME COLUMN pl TO potential_losses;
ALTER TABLE public.league_user_careerlogs RENAME COLUMN pmax TO highest_weekly_score;
ALTER TABLE public.league_user_careerlogs RENAME COLUMN pmin TO lowest_weekly_score;
