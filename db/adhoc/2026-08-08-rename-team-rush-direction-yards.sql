-- STATUS: APPLIED 2026-08-08 against league_production
--
-- Rename the five run-direction metric columns and their five rank siblings from
-- _dvoa to _yards, on both dvoa_team_unit_seasonlogs_history and _index -- 20
-- renames total.
--
-- These columns hold RUSHING YARDS BY DIRECTION, not DVOA, and have since they
-- were created. Measured 2026-08-08: ARI 2020 offense team_rush_left_end_dvoa is
-- 1.59589861272592, exactly the drive-stats workbook's L.End yards figure for
-- that team-season, and the five span roughly 1.6-6.6 -- the same magnitude as
-- team_adjusted_line_yards (2.28-5.68) sitting beside them -- while genuine DVOA
-- columns on this table are fractions spanning about -0.44 to 0.39. The name has
-- been lying about the unit.
--
-- The _pct siblings (team_rush_left_end_pct and friends) are NOT touched: those
-- are genuinely percentages -- the share of rushes going that direction -- and
-- are correctly named.
--
-- This is SPA-VISIBLE. The five metric names are values of the dvoa_type column
-- param on the team_unit_dvoa data-view column
-- (app/core/data-views-fields/team-dvoa-table-fields.js), so the frontend deploy
-- is part of this apply rather than a follow-up: sequence
-- yarn build && yarn deploy:dist && yarn deploy:sourcemaps immediately behind
-- the DDL. Between the apply and that deploy a user with one of these five
-- selected gets a failing query. Measured exposure is small but not zero: 0
-- saved views and 0 share URLs carry any of the five values today (positive
-- control: 7 URLs carry team_unit_dvoa at all), so the window only reaches
-- someone actively choosing one from the dropdown.
--
-- Applied BEFORE the companion unit-block fold-in, which writes these columns
-- under their new names.

ALTER TABLE public.dvoa_team_unit_seasonlogs_history
    RENAME COLUMN team_rush_left_end_dvoa TO team_rush_left_end_yards;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history
    RENAME COLUMN team_rush_left_end_dvoa_rank TO team_rush_left_end_yards_rank;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history
    RENAME COLUMN team_rush_left_tackle_dvoa TO team_rush_left_tackle_yards;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history
    RENAME COLUMN team_rush_left_tackle_dvoa_rank TO team_rush_left_tackle_yards_rank;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history
    RENAME COLUMN team_rush_mid_guard_dvoa TO team_rush_mid_guard_yards;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history
    RENAME COLUMN team_rush_mid_guard_dvoa_rank TO team_rush_mid_guard_yards_rank;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history
    RENAME COLUMN team_rush_right_tackle_dvoa TO team_rush_right_tackle_yards;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history
    RENAME COLUMN team_rush_right_tackle_dvoa_rank TO team_rush_right_tackle_yards_rank;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history
    RENAME COLUMN team_rush_right_end_dvoa TO team_rush_right_end_yards;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history
    RENAME COLUMN team_rush_right_end_dvoa_rank TO team_rush_right_end_yards_rank;

ALTER TABLE public.dvoa_team_unit_seasonlogs_index
    RENAME COLUMN team_rush_left_end_dvoa TO team_rush_left_end_yards;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index
    RENAME COLUMN team_rush_left_end_dvoa_rank TO team_rush_left_end_yards_rank;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index
    RENAME COLUMN team_rush_left_tackle_dvoa TO team_rush_left_tackle_yards;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index
    RENAME COLUMN team_rush_left_tackle_dvoa_rank TO team_rush_left_tackle_yards_rank;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index
    RENAME COLUMN team_rush_mid_guard_dvoa TO team_rush_mid_guard_yards;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index
    RENAME COLUMN team_rush_mid_guard_dvoa_rank TO team_rush_mid_guard_yards_rank;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index
    RENAME COLUMN team_rush_right_tackle_dvoa TO team_rush_right_tackle_yards;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index
    RENAME COLUMN team_rush_right_tackle_dvoa_rank TO team_rush_right_tackle_yards_rank;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index
    RENAME COLUMN team_rush_right_end_dvoa TO team_rush_right_end_yards;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index
    RENAME COLUMN team_rush_right_end_dvoa_rank TO team_rush_right_end_yards_rank;
