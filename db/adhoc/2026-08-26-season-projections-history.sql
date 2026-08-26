-- STATUS: APPLIED 2026-08-26 against league_production
-- Split the season-long raw projection series out of the week = 0 sentinel in
-- projections_history into its own table, season_projections_history, keyed
-- (source_id, pid, season_year, generated_at).
--
-- ADDITIVE HALF ONLY. This file creates the table and populates it. It does NOT
-- delete the week = 0 rows and does NOT narrow week. Those are destructive and
-- live in a companion adhoc that runs only after the writer repoint is deployed,
-- because cron keeps writing week = 0 rows until then.
--
-- The defect being removed: the season-long projection has no week, so it was
-- stored under a week = 0 sentinel. That makes every one of these rows carry a
-- generated nfl_week_id of the form YYYY_REG_WEEK_0, which is not a week
-- identifier the season vocabulary admits, and it forces week to stay nullable
-- and unconstrained on a table where every legitimate row is week >= 1.
--
-- Stored CHANGE-ONLY, per operator ruling. 2,430,340 non-user week = 0 rows
-- across 44,474 (source, player, season) grains collapse to one row per distinct
-- VALUE RUN -- the first generated_at at which a forecast took each value. About
-- 95 percent of the source rows are the same value restamped by a re-running
-- importer, which is importer cadence rather than projection data.
--
-- Losslessness for the only named consumer: the points-added valuation board
-- reconstructs a point-in-time board as
--   DISTINCT ON (source_id, pid) ... WHERE generated_at <= D ORDER BY generated_at DESC
-- which returns an identical value against change-only storage, because the row
-- it selects is the last value CHANGE at or before D either way.
--
-- Unpartitioned on purpose. At roughly 119,000 rows partitioning buys nothing,
-- nothing here performs a partition-wise operation on it, and
-- scripts/create-season-partitions.mjs holds a hand-maintained registry that a
-- new partitioned table would silently need to join.

SET lock_timeout = '30s';
SET statement_timeout = 0;

--
-- (1) The table. No week, no season_type, no nfl_week_id, no user_id.
--
--   week / season_type / nfl_week_id: the whole point of the split is that this
--     series has no week. season_type is 'REG' on every one of the 2,430,367
--     source rows (checked with IS DISTINCT FROM, so a NULL would have been
--     caught), and nfl_week_id is generated from the two.
--   user_id: the 27 user-authored rows are excluded below rather than carried.
--     They all sit at week = 0, source_id = 0, season_year = 2020, and they
--     COLLIDE on this key -- 2 duplicate groups unfiltered, 0 filtered -- so the
--     unique index below cannot be created without the filter.
--

CREATE TABLE public.season_projections_history (
  pid character varying(25) NOT NULL,
  source_id integer DEFAULT 0 NOT NULL,
  season_year smallint NOT NULL,
  generated_at timestamp with time zone NOT NULL,
  passing_attempts numeric(5,1),
  passing_completions numeric(5,1),
  passing_yards numeric(5,1),
  passing_interceptions numeric(3,1),
  passing_touchdowns numeric(3,1),
  rushing_attempts numeric(4,1),
  rushing_yards numeric(5,1),
  rushing_touchdowns numeric(3,1),
  targets numeric(4,1),
  receptions numeric(4,1),
  receiving_yards numeric(5,1),
  receiving_touchdowns numeric(3,1),
  fumbles_lost numeric(3,1),
  two_point_conversions numeric(3,1),
  field_goals_made numeric(4,1),
  field_goal_yards integer DEFAULT 0,
  field_goals_made_0_19_yards numeric(3,1),
  field_goals_made_20_29_yards numeric(3,1),
  field_goals_made_30_39_yards numeric(3,1),
  field_goals_made_40_49_yards numeric(3,1),
  field_goals_made_50_plus_yards numeric(3,1),
  extra_points_made numeric(3,1),
  defensive_sacks numeric(4,1),
  defensive_interceptions numeric(4,1),
  defensive_forced_fumbles numeric(4,1),
  defensive_recovered_fumbles numeric(4,1),
  defensive_three_and_outs numeric(4,1),
  defensive_fourth_down_stops numeric(4,1),
  defensive_points_against numeric(4,1),
  defensive_yards_against numeric(5,1),
  defensive_blocked_kicks numeric(4,1),
  defensive_safeties numeric(4,1),
  defensive_two_point_returns numeric(4,1),
  defensive_touchdowns numeric(4,1),
  kickoff_return_touchdowns numeric(4,1),
  punt_return_touchdowns numeric(4,1)
);

COMMENT ON TABLE public.season_projections_history IS
  'Season-long raw projections per source, stored change-only: one row per distinct value run, stamped with the first generated_at at which the forecast took that value. Split out of the projections_history week = 0 sentinel.';

CREATE UNIQUE INDEX idx_season_projections_history_natural_key
  ON public.season_projections_history
  USING btree (source_id, pid, season_year, generated_at);

CREATE INDEX idx_season_projections_history_pid
  ON public.season_projections_history
  USING btree (pid);

--
-- (2) Change-only populate.
--
-- Keep a row when it is the FIRST observation of its grain, or when its stat
-- tuple differs from the immediately preceding observation of the same grain.
-- ROW(...) IS DISTINCT FROM ROW(...) compares field by field and is NULL-safe,
-- so a stat moving to or from NULL counts as a change.
--
-- The rn = 1 arm is not redundant with the IS DISTINCT FROM arm. lag() returns
-- a bare NULL at the start of each partition, and a row whose 36 stats are ALL
-- NULL is not distinct from that bare NULL -- so without rn = 1 an all-NULL
-- first observation would be dropped. No grain is in that state today (measured:
-- 0), which is exactly why the guard has to be written rather than discovered.
--

INSERT INTO public.season_projections_history (
    pid,
    source_id,
    season_year,
    generated_at,
    passing_attempts,
    passing_completions,
    passing_yards,
    passing_interceptions,
    passing_touchdowns,
    rushing_attempts,
    rushing_yards,
    rushing_touchdowns,
    targets,
    receptions,
    receiving_yards,
    receiving_touchdowns,
    fumbles_lost,
    two_point_conversions,
    field_goals_made,
    field_goal_yards,
    field_goals_made_0_19_yards,
    field_goals_made_20_29_yards,
    field_goals_made_30_39_yards,
    field_goals_made_40_49_yards,
    field_goals_made_50_plus_yards,
    extra_points_made,
    defensive_sacks,
    defensive_interceptions,
    defensive_forced_fumbles,
    defensive_recovered_fumbles,
    defensive_three_and_outs,
    defensive_fourth_down_stops,
    defensive_points_against,
    defensive_yards_against,
    defensive_blocked_kicks,
    defensive_safeties,
    defensive_two_point_returns,
    defensive_touchdowns,
    kickoff_return_touchdowns,
    punt_return_touchdowns
)
SELECT
    pid,
    source_id,
    season_year,
    generated_at,
    passing_attempts,
    passing_completions,
    passing_yards,
    passing_interceptions,
    passing_touchdowns,
    rushing_attempts,
    rushing_yards,
    rushing_touchdowns,
    targets,
    receptions,
    receiving_yards,
    receiving_touchdowns,
    fumbles_lost,
    two_point_conversions,
    field_goals_made,
    field_goal_yards,
    field_goals_made_0_19_yards,
    field_goals_made_20_29_yards,
    field_goals_made_30_39_yards,
    field_goals_made_40_49_yards,
    field_goals_made_50_plus_yards,
    extra_points_made,
    defensive_sacks,
    defensive_interceptions,
    defensive_forced_fumbles,
    defensive_recovered_fumbles,
    defensive_three_and_outs,
    defensive_fourth_down_stops,
    defensive_points_against,
    defensive_yards_against,
    defensive_blocked_kicks,
    defensive_safeties,
    defensive_two_point_returns,
    defensive_touchdowns,
    kickoff_return_touchdowns,
    punt_return_touchdowns
FROM (
  SELECT
    pid,
    source_id,
    season_year,
    generated_at,
    passing_attempts,
    passing_completions,
    passing_yards,
    passing_interceptions,
    passing_touchdowns,
    rushing_attempts,
    rushing_yards,
    rushing_touchdowns,
    targets,
    receptions,
    receiving_yards,
    receiving_touchdowns,
    fumbles_lost,
    two_point_conversions,
    field_goals_made,
    field_goal_yards,
    field_goals_made_0_19_yards,
    field_goals_made_20_29_yards,
    field_goals_made_30_39_yards,
    field_goals_made_40_49_yards,
    field_goals_made_50_plus_yards,
    extra_points_made,
    defensive_sacks,
    defensive_interceptions,
    defensive_forced_fumbles,
    defensive_recovered_fumbles,
    defensive_three_and_outs,
    defensive_fourth_down_stops,
    defensive_points_against,
    defensive_yards_against,
    defensive_blocked_kicks,
    defensive_safeties,
    defensive_two_point_returns,
    defensive_touchdowns,
    kickoff_return_touchdowns,
    punt_return_touchdowns,
    row_number() OVER w AS rn,
    ROW(passing_attempts, passing_completions, passing_yards, passing_interceptions, passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns, targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost, two_point_conversions, field_goals_made, field_goal_yards, field_goals_made_0_19_yards, field_goals_made_20_29_yards, field_goals_made_30_39_yards, field_goals_made_40_49_yards, field_goals_made_50_plus_yards, extra_points_made, defensive_sacks, defensive_interceptions, defensive_forced_fumbles, defensive_recovered_fumbles, defensive_three_and_outs, defensive_fourth_down_stops, defensive_points_against, defensive_yards_against, defensive_blocked_kicks, defensive_safeties, defensive_two_point_returns, defensive_touchdowns, kickoff_return_touchdowns, punt_return_touchdowns) AS cur,
    lag(ROW(passing_attempts, passing_completions, passing_yards, passing_interceptions, passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns, targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost, two_point_conversions, field_goals_made, field_goal_yards, field_goals_made_0_19_yards, field_goals_made_20_29_yards, field_goals_made_30_39_yards, field_goals_made_40_49_yards, field_goals_made_50_plus_yards, extra_points_made, defensive_sacks, defensive_interceptions, defensive_forced_fumbles, defensive_recovered_fumbles, defensive_three_and_outs, defensive_fourth_down_stops, defensive_points_against, defensive_yards_against, defensive_blocked_kicks, defensive_safeties, defensive_two_point_returns, defensive_touchdowns, kickoff_return_touchdowns, punt_return_touchdowns)) OVER w AS prev
  FROM public.projections_history
  WHERE week = 0
    AND user_id = 0
  WINDOW w AS (
    PARTITION BY source_id, pid, season_year
    ORDER BY generated_at
  )
) runs
WHERE rn = 1
   OR prev IS DISTINCT FROM cur
ON CONFLICT (source_id, pid, season_year, generated_at) DO NOTHING;

--
-- (3) Statistics. A freshly populated table has none, and the planner would
-- treat it as tiny regardless of its real size.
--

ANALYZE public.season_projections_history;
