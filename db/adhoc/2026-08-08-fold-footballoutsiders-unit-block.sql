-- STATUS: APPLIED 2026-08-08 against league_production
--
-- Fold the footballoutsiders 2020 weeks 4-10 DVOA / OL-DL block into
-- dvoa_team_unit_seasonlogs_history: 224 wide source rows become 448 unit rows.
--
-- Applied AFTER 2026-08-08-rename-team-rush-direction-yards.sql, which is what
-- gives the five run-direction columns the _yards names this file writes.
--
-- No collision with existing data: the history table holds only 2020 week 17 for
-- that season, so weeks 4-10 are free. Plain INSERT rather than an upsert on
-- purpose -- if a row did exist, a silent merge would be the wrong outcome and
-- the unique index should say so loudly.
--
-- ============================ SCALING ============================
-- footballoutsiders stores RATES AS PERCENTAGES; this table stores FRACTIONS.
-- SEVEN pairs are divided by 100. This is a 100x error that passes every
-- row-count and not-null check, so it is the single most important line here.
--
-- Measured 2026-08-08, source range vs destination range:
--   odvoa   -43.0 .. 34.6   vs total_dvoa              -0.44 .. 0.39
--   olpwr    25   .. 100    vs team_power_success       0    .. 1
--   olstf     6   .. 35     vs team_stuffed_rate        0.06 .. 0.38
--   olskrt    2.0 .. 12.4   vs team_adjusted_sack_rate  0.017 .. 0.183
--   odave   -23.5 .. 23.5   vs (new) total_dave -- same scale as odvoa
--
-- total_dave is scaled for the same reason it is named total_dave: it is a
-- variant of the total_dvoa beside it, and an unscaled DAVE would sit 100x off
-- the column it exists to be compared against. The plan said six pairs; DAVE is
-- the seventh, and its scaling was never stated because it was enumerated
-- separately as the homeless pair.
--
-- The NINE yards pairs are NOT scaled -- they are already in yards.
-- The companion drive-block file is NOT scaled either.
--
-- ================= ALL 78 NON-KEY SOURCE COLUMNS =================
-- 39 pairs. Every one is either written below or listed here with its reason.
--
-- SCALED /100 (7 pairs):
--   odvoa/ddvoa     -> total_dvoa
--   opass/dpass     -> pass_dvoa
--   orun/drun       -> rush_dvoa
--   olpwr/dlpwr     -> team_power_success
--   olstf/dlstf     -> team_stuffed_rate
--   olskrt/dlskrt   -> team_adjusted_sack_rate
--   odave/ddave     -> total_dave
--
-- YARDS, written as-is (9 pairs):
--   olrunaly/dlrunaly   -> team_adjusted_line_yards
--   olrby/dlrby         -> team_rb_yards
--   olrun2y/dlrun2y     -> team_second_level_yards
--   olrunofy/dlrunofy   -> team_open_field_yards
--   olrunley/dlrunley   -> team_rush_left_end_yards
--   olrunlty/dlrunlty   -> team_rush_left_tackle_yards
--   olrunmgy/dlrunmgy   -> team_rush_mid_guard_yards
--   olrunrty/dlrunrty   -> team_rush_right_tackle_yards
--   olrunrey/dlrunrey   -> team_rush_right_end_yards
--
-- RANKS, written as-is (2 pairs):
--   ork/drk         -> total_dvoa_rank
--   olskrk/dlskrk   -> team_sacks_rank
--
-- NOT FOLDED (2 pairs), with reasons:
--   olw/dlw       -- NOT DATA. These are last week's DVOA rank, not line data:
--                    olw[week] equals ork[week-1] on 192 of 192 comparable rows,
--                    and dlw/drk likewise. Zero unique information, so folding
--                    them would manufacture a column out of a lag.
--   olpassrk/dlpassrk -- pass-protection rank. The destination carries no rank
--                    for team_adjusted_sack_rate, and team_sacks_rank is taken
--                    by olskrk. Derivable by ranking team_adjusted_sack_rate
--                    within (season_year, week, team_unit), so storing it would
--                    add a column no other source can populate.
--
-- DRIVE BLOCK (19 pairs) -- companion file
-- 2026-08-08-fold-footballoutsiders-drive-block.sql.
--
-- 7 + 9 + 2 + 2 + 19 = 39 pairs = 78 columns. Fully accounted for.

INSERT INTO public.dvoa_team_unit_seasonlogs_history (
    season_year,
    week,
    nfl_team,
    team_unit,
    observed_at,
    total_dvoa,
    total_dvoa_rank,
    total_dave,
    pass_dvoa,
    rush_dvoa,
    team_adjusted_line_yards,
    team_rb_yards,
    team_power_success,
    team_stuffed_rate,
    team_second_level_yards,
    team_open_field_yards,
    team_adjusted_sack_rate,
    team_sacks_rank,
    team_rush_left_end_yards,
    team_rush_left_tackle_yards,
    team_rush_mid_guard_yards,
    team_rush_right_tackle_yards,
    team_rush_right_end_yards
)
SELECT
    fo.year,
    fo.week,
    fo.team,
    'OFFENSE'::public.team_unit,
    to_timestamp(wk.week_timestamp),
    fo.odvoa / 100,
    fo.ork,
    fo.odave / 100,
    fo.opass / 100,
    fo.orun / 100,
    fo.olrunaly,
    fo.olrby,
    fo.olpwr / 100.0,
    fo.olstf / 100.0,
    fo.olrun2y,
    fo.olrunofy,
    fo.olskrt / 100,
    fo.olskrk,
    fo.olrunley,
    fo.olrunlty,
    fo.olrunmgy,
    fo.olrunrty,
    fo.olrunrey
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
    fo.ddvoa / 100,
    fo.drk,
    fo.ddave / 100,
    fo.dpass / 100,
    fo.drun / 100,
    fo.dlrunaly,
    fo.dlrby,
    fo.dlpwr / 100.0,
    fo.dlstf / 100.0,
    fo.dlrun2y,
    fo.dlrunofy,
    fo.dlskrt / 100,
    fo.dlskrk,
    fo.dlrunley,
    fo.dlrunlty,
    fo.dlrunmgy,
    fo.dlrunrty,
    fo.dlrunrey
FROM public.footballoutsiders fo
JOIN public.nfl_year_week_timestamp wk
  ON wk.year = fo.year AND wk.week = fo.week;

-- Guards. The count guard catches a dropped matview week; the RANGE guards are
-- what catch the scaling error, which no count can see. olpwr and olstf are
-- integer columns at source, so they are divided by 100.0 rather than 100 --
-- integer division would floor every one of them to 0 silently.
--
-- The power-success bound is < 0, NOT <= 0: both endpoints are legitimately
-- attained in this data and an exclusive bound produces a false failure. dlpwr
-- is 0 on exactly one row (a defense that allowed no power-run conversions that
-- week) and 100 on seven, olpwr 100 on eight. A rehearsal against the real 224
-- rows is what surfaced this -- the first draft used <= 0 and aborted the fold.
DO $$
DECLARE
    row_count integer;
    bad_dvoa integer;
    bad_dave integer;
    bad_line_yards integer;
    bad_power integer;
BEGIN
    SELECT count(*) INTO row_count
      FROM public.dvoa_team_unit_seasonlogs_history
     WHERE season_year = 2020 AND week BETWEEN 4 AND 10;
    IF row_count <> 448 THEN
        RAISE EXCEPTION 'expected 448 folded unit rows, got %', row_count;
    END IF;

    -- Scaled columns must land in fraction range.
    SELECT count(*) INTO bad_dvoa
      FROM public.dvoa_team_unit_seasonlogs_history
     WHERE season_year = 2020 AND week BETWEEN 4 AND 10
       AND (total_dvoa < -1 OR total_dvoa > 1);
    IF bad_dvoa > 0 THEN
        RAISE EXCEPTION 'total_dvoa outside -1..1 on % folded rows -- scaling error', bad_dvoa;
    END IF;

    SELECT count(*) INTO bad_dave
      FROM public.dvoa_team_unit_seasonlogs_history
     WHERE season_year = 2020 AND week BETWEEN 4 AND 10
       AND (total_dave < -1 OR total_dave > 1);
    IF bad_dave > 0 THEN
        RAISE EXCEPTION 'total_dave outside -1..1 on % folded rows -- scaling error', bad_dave;
    END IF;

    SELECT count(*) INTO bad_power
      FROM public.dvoa_team_unit_seasonlogs_history
     WHERE season_year = 2020 AND week BETWEEN 4 AND 10
       AND (team_power_success < 0 OR team_power_success > 1);
    IF bad_power > 0 THEN
        RAISE EXCEPTION 'team_power_success outside 0..1 on % folded rows -- integer division or scaling error', bad_power;
    END IF;

    -- Unscaled columns must NOT have been scaled.
    SELECT count(*) INTO bad_line_yards
      FROM public.dvoa_team_unit_seasonlogs_history
     WHERE season_year = 2020 AND week BETWEEN 4 AND 10
       AND (team_adjusted_line_yards < 1 OR team_adjusted_line_yards > 7);
    IF bad_line_yards > 0 THEN
        RAISE EXCEPTION 'team_adjusted_line_yards outside 1..7 on % folded rows -- wrongly scaled', bad_line_yards;
    END IF;
END $$;

ANALYZE public.dvoa_team_unit_seasonlogs_history;
