-- STATUS: APPLIED 2026-08-08 against league_production
--
-- Create dvoa_team_drive_seasonlogs, the canonical home for team drive-level
-- DVOA metrics at (season_year, week, nfl_team, team_unit) grain.
--
-- The column set is derived from the drive-stats-1993-2023 workbook, which is a
-- SUPERSET of the footballoutsiders drive block, NOT from footballoutsiders
-- alone. That is deliberate: the DVOA rebuild backfills 1993-2023 into this
-- table later, and deriving the columns from the narrower source would hand it a
-- table it has to ALTER. The crosswalk settling each column is at
-- user:scratch/league/dvoa-domain-consolidation/drive-stats-crosswalk.md.
--
-- Four columns (stops_per_drive, scores_per_drive, predicted_points,
-- predicted_points_per_drive) have no footballoutsiders source and stay NULL on
-- the 448 rows folded in by the companion file; the backfill fills them.
--
-- No season_type: both sources are regular-season only.
--
-- Ranks are deliberately NOT persisted. The workbook carries a Rank beside 22 of
-- its 23 metrics, every one derivable by ranking the value within
-- (season_year, week, team_unit), and footballoutsiders carries no per-metric
-- rank at all -- so storing them would add 22 columns only one source could ever
-- populate.
--
-- week is as-of-week. Season-final backfill rows carry each era's terminal REG
-- week; footballoutsiders' 2020 weeks 4-10 supply the only genuine mid-season
-- weeks. That separation is what keeps the two row kinds from colliding.

CREATE TABLE public.dvoa_team_drive_seasonlogs (
    season_year integer NOT NULL,
    week smallint NOT NULL,
    nfl_team character varying(3) NOT NULL,
    team_unit public.team_unit NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    drives integer,
    yards_per_drive numeric,
    points_per_drive numeric,
    touchdowns_per_drive numeric,
    field_goals_per_drive numeric,
    punts_per_drive numeric,
    turnovers_per_drive numeric,
    interceptions_per_drive numeric,
    fumbles_per_drive numeric,
    line_of_scrimmage_per_drive numeric,
    stops_per_drive numeric,
    three_and_outs_per_drive numeric,
    plays_per_drive numeric,
    scores_per_drive numeric,
    time_of_possession_per_drive_seconds numeric,
    drive_success_rate numeric,
    touchdown_to_field_goal_ratio numeric,
    line_of_scrimmage_after_kickoff_return numeric,
    points_per_red_zone_trip numeric,
    touchdowns_per_red_zone_trip numeric,
    predicted_points numeric,
    predicted_points_per_drive numeric,
    average_lead numeric
);

-- Purpose-form name (docs/database-index-naming.md idx_table_column_purpose)
-- because the column form is unavoidably over the 63-byte identifier limit:
-- idx_dvoa_team_drive_seasonlogs_season_year_nfl_team_team_unit_week is 66
-- bytes and Postgres would truncate it silently. "grain" is this codebase's
-- word for the key tuple, and the tuple IS the whole key here.
CREATE UNIQUE INDEX idx_dvoa_team_drive_seasonlogs_grain
    ON public.dvoa_team_drive_seasonlogs (season_year, nfl_team, team_unit, week);

GRANT SELECT ON TABLE public.dvoa_team_drive_seasonlogs TO league_reader;
