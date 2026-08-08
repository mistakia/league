-- STATUS: APPLIED 2026-08-08 against league_production
--
-- Fold the footballoutsiders 2020 weeks 4-10 DRIVE block into
-- dvoa_team_drive_seasonlogs: 224 wide source rows (offense and defense in one
-- row) become 448 unit rows, 32 teams x 7 weeks x 2 units.
--
-- observed_at is synthesized from the nfl_year_week_timestamp matview, read
-- as-is. That matview is REG-only and covers all seven weeks (verified: 2020
-- weeks 4-10 all present). A week with no matview row would drop its rows
-- silently through the INNER JOIN, so the file asserts the 448 count at the end.
--
-- SCALING: the drive block is NOT scaled. It is already fractional at source --
-- odrvsucc spans 0.617-0.844 against the workbook's own 0.7956 -- unlike the
-- rate columns in the companion unit-block file, which are percentages and do
-- need a divide-by-100. Applying the /100 here would be a silent 100x error that
-- passes every row-count and not-null check.
--
-- TIME OF POSSESSION is the one column where the source is markedly coarser than
-- the workbook. otoppdrv/dtoppdrv are varchar holding only '2' or '3' across all
-- 224 rows -- whole MINUTES, truncated by the dead scraper, not mm:ss. The
-- workbook gives seconds with sub-second precision (186.75 = 3:06.75). Stored in
-- seconds via x60, so these 448 rows are correct to the minute and no finer.
-- That is faithful to the source rather than fabricated.
--
-- Source drive columns and their destinations (19 pairs, all accounted for):
--   odrv/ddrv           -> drives
--   oypdrv/dypdrv       -> yards_per_drive
--   optspdrv/dptspdrv   -> points_per_drive
--   otdpdrv/dtdpdrv     -> touchdowns_per_drive
--   ofgpdrv/dfgpdrv     -> field_goals_per_drive
--   opntpdrv/dpntpdrv   -> punts_per_drive
--   otopdrv/dtopdrv     -> turnovers_per_drive
--   ointpdrv/dintpdrv   -> interceptions_per_drive
--   ofumpdrv/dfumpdrv   -> fumbles_per_drive
--   olospdrv/dlospdrv   -> line_of_scrimmage_per_drive
--   o3opdrv/d3opdrv     -> three_and_outs_per_drive
--   oplypdrv/dplypdrv   -> plays_per_drive
--   otoppdrv/dtoppdrv   -> time_of_possession_per_drive_seconds (x60)
--   odrvsucc/ddrvsucc   -> drive_success_rate
--   otdfg/dtdfg         -> touchdown_to_field_goal_ratio
--   olosko/dlosko       -> line_of_scrimmage_after_kickoff_return
--   optsprz/dptsprz     -> points_per_red_zone_trip
--   otdprz/dtdprz       -> touchdowns_per_red_zone_trip
--   oavgld/davgld       -> average_lead
--
-- Destination columns with NO footballoutsiders source, left NULL for the
-- rebuild's 1993-2023 backfill to fill: stops_per_drive, scores_per_drive,
-- predicted_points, predicted_points_per_drive.

INSERT INTO public.dvoa_team_drive_seasonlogs (
    season_year,
    week,
    nfl_team,
    team_unit,
    observed_at,
    drives,
    yards_per_drive,
    points_per_drive,
    touchdowns_per_drive,
    field_goals_per_drive,
    punts_per_drive,
    turnovers_per_drive,
    interceptions_per_drive,
    fumbles_per_drive,
    line_of_scrimmage_per_drive,
    three_and_outs_per_drive,
    plays_per_drive,
    time_of_possession_per_drive_seconds,
    drive_success_rate,
    touchdown_to_field_goal_ratio,
    line_of_scrimmage_after_kickoff_return,
    points_per_red_zone_trip,
    touchdowns_per_red_zone_trip,
    average_lead
)
SELECT
    fo.year,
    fo.week,
    fo.team,
    'OFFENSE'::public.team_unit,
    to_timestamp(wk.week_timestamp),
    fo.odrv,
    fo.oypdrv,
    fo.optspdrv,
    fo.otdpdrv,
    fo.ofgpdrv,
    fo.opntpdrv,
    fo.otopdrv,
    fo.ointpdrv,
    fo.ofumpdrv,
    fo.olospdrv,
    fo.o3opdrv,
    fo.oplypdrv,
    fo.otoppdrv::numeric * 60,
    fo.odrvsucc,
    fo.otdfg,
    fo.olosko,
    fo.optsprz,
    fo.otdprz,
    fo.oavgld
FROM public.footballoutsiders fo
JOIN public.nfl_year_week_timestamp wk
  ON wk.year = fo.year AND wk.week = fo.week

UNION ALL

SELECT
    fo.year,
    fo.week,
    fo.team,
    'DEFENSE'::public.team_unit,
    to_timestamp(wk.week_timestamp),
    fo.ddrv,
    fo.dypdrv,
    fo.dptspdrv,
    fo.dtdpdrv,
    fo.dfgpdrv,
    fo.dpntpdrv,
    fo.dtopdrv,
    fo.dintpdrv,
    fo.dfumpdrv,
    fo.dlospdrv,
    fo.d3opdrv,
    fo.dplypdrv,
    fo.dtoppdrv::numeric * 60,
    fo.ddrvsucc,
    fo.dtdfg,
    fo.dlosko,
    fo.dptsprz,
    fo.dtdprz,
    fo.davgld
FROM public.footballoutsiders fo
JOIN public.nfl_year_week_timestamp wk
  ON wk.year = fo.year AND wk.week = fo.week;

-- Guard: exactly 448 rows for 2020 weeks 4-10, both units, 32 teams. A missing
-- matview week would silently drop rows through the INNER JOIN above, so assert
-- rather than trust.
DO $$
DECLARE
    row_count integer;
    team_count integer;
    week_count integer;
    unit_count integer;
BEGIN
    SELECT count(*), count(DISTINCT nfl_team), count(DISTINCT week), count(DISTINCT team_unit)
      INTO row_count, team_count, week_count, unit_count
      FROM public.dvoa_team_drive_seasonlogs
     WHERE season_year = 2020 AND week BETWEEN 4 AND 10;

    IF row_count <> 448 THEN
        RAISE EXCEPTION 'expected 448 folded drive rows, got %', row_count;
    END IF;
    IF team_count <> 32 THEN
        RAISE EXCEPTION 'expected 32 teams, got %', team_count;
    END IF;
    IF week_count <> 7 THEN
        RAISE EXCEPTION 'expected 7 weeks, got %', week_count;
    END IF;
    IF unit_count <> 2 THEN
        RAISE EXCEPTION 'expected 2 team units, got %', unit_count;
    END IF;
END $$;

ANALYZE public.dvoa_team_drive_seasonlogs;
