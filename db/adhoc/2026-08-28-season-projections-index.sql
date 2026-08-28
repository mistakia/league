-- STATUS: APPLIED 2026-08-28 against league_production
-- Split the season-long current-state projection out of the week = 0 sentinel in
-- projections_index into its own table, season_projections_index, keyed
-- (source_id, pid, season_year).
--
-- ADDITIVE HALF ONLY. This file creates the table and populates it. Nothing reads
-- it yet. It does NOT delete the week = 0 rows and does NOT narrow week -- those
-- are destructive and live in a companion adhoc that runs only after the writer
-- and reader repoint is DEPLOYED, because cron keeps writing week = 0 rows until
-- then (server/crontab-main/league-imports.cron runs hourly at :30).
--
-- The defect being removed: the season-long projection has no week, so it was
-- stored under a week = 0 sentinel on a table whose every other row is a real
-- fantasy week. That makes the season row reachable -- and therefore amputable --
-- by any week predicate. At 2026-08-04 04:00 UTC it was amputated for real:
-- get_player_projections had the NFL week as its floor, the floor stepped from 0
-- to 1 in the preseason, `week >= floor` removed every season row, the consensus
-- was computed over an empty source set and written all-NULL, and market_salary
-- priced at $0 on 22 of 23 league formats with nothing failing. Fixed in
-- b72d26333; this table makes it structurally impossible rather than guarded.
--
-- This is the CURRENT-STATE counterpart to season_projections_history
-- (2026-08-26-season-projections-history.sql), and deliberately mirrors its shape
-- and its exclusions. The two differ in exactly two ways, both forced by their
-- source tables: this one has no generated_at (it is current state, not a
-- series), and it carries receiving_first_downs / rushing_first_downs, which
-- exist on projections_index and do NOT exist on projections_history.
--
-- Unpartitioned on purpose. Roughly 50,000 rows; partitioning buys nothing here,
-- nothing performs a partition-wise operation on it, and
-- scripts/create-season-partitions.mjs holds a hand-maintained registry that a new
-- partitioned table would silently need to join. Precedent is
-- rest_of_season_projections -- same grain, different period, unpartitioned.

SET lock_timeout = '30s';
SET statement_timeout = 0;

--
-- (1) The table. No week, no season_type, no nfl_week_id, no user_id.
--
--   week / season_type / nfl_week_id: the whole point of the split is that this
--     projection has no week. A column that cannot hold a sentinel beats one
--     constrained not to, and its absence is what makes the read-path amputation
--     impossible rather than merely guarded. season_type is 'REG' on every week=0
--     row (checked with IS DISTINCT FROM, so a NULL would have been caught: 0
--     rows), and nfl_week_id is GENERATED from week and season_type -- so every
--     week-0 row today persists a literal YYYY_REG_WEEK_0 that
--     validate_nfl_week_identifier rejects (libs-shared/nfl-week-identifier.mjs
--     requires week >= 1). Those identifiers stop existing.
--   user_id: operator ruling of 2026-08-26 -- the 27 user-authored rows are
--     deleted, not carried. They all sit at week = 0, source_id = 0,
--     season_year = 2020, and they COLLIDE on this key (2 duplicate groups
--     unfiltered, 0 filtered), so the unique index below cannot be created
--     without the user_id = 0 filter in the populate.
--
-- Column names, types, precisions and defaults below are transcribed from
-- public.projections_index in db/schema.postgres.sql, read from the file rather
-- than derived from a grep window.
--

CREATE TABLE public.season_projections_index (
  pid character varying(25) NOT NULL,
  source_id integer DEFAULT 0 NOT NULL,
  season_year smallint NOT NULL,
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
  punt_return_touchdowns numeric(4,1),
  receiving_first_downs numeric(2,1) DEFAULT 0 NOT NULL,
  rushing_first_downs numeric(2,1) DEFAULT 0 NOT NULL
);

COMMENT ON TABLE public.season_projections_index IS
  'Season-long current-state projections per source, keyed (source_id, pid, season_year). Carries no week column by construction, so no week predicate can reach or amputate a season row. Split out of the projections_index week = 0 sentinel.';

CREATE UNIQUE INDEX idx_season_projections_index_natural_key
  ON public.season_projections_index
  USING btree (source_id, pid, season_year);

CREATE INDEX idx_season_projections_index_pid
  ON public.season_projections_index
  USING btree (pid);

--
-- (2) Populate, filtering user_id = 0.
--
-- The filter is not optional. The 27 user-authored week-0 rows all carry
-- source_id = 0, season_year = 2020 and COLLIDE on (source_id, pid, season_year)
-- -- 2 duplicate groups unfiltered, 0 filtered -- so without it the unique index
-- created above aborts this whole transaction. Operator ruling of 2026-08-26 is
-- that those rows are deleted rather than carried; the delete lives in the
-- destructive companion, not here.
--
-- ON CONFLICT DO UPDATE, not DO NOTHING. This file runs once, but the same
-- populate is re-run immediately before the Phase B deploy to close the window
-- since Phase A, and cron keeps upserting week-0 rows hourly the whole time
-- (server/crontab-main/league-imports.cron). DO NOTHING is idempotent but NOT
-- convergent: a week-0 row whose VALUE changed between the two runs would keep
-- its stale Phase A copy here, silently, and the equality oracle below would then
-- fail at Phase B with no way to tell a stale copy from a real corruption.
-- DO UPDATE is both idempotent and convergent, so re-running is always safe and
-- the oracle means the same thing on every run.
--

INSERT INTO public.season_projections_index (
    pid, source_id, season_year,
    passing_attempts, passing_completions, passing_yards, passing_interceptions,
    passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns,
    targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost,
    two_point_conversions, field_goals_made, field_goal_yards,
    field_goals_made_0_19_yards, field_goals_made_20_29_yards,
    field_goals_made_30_39_yards, field_goals_made_40_49_yards,
    field_goals_made_50_plus_yards, extra_points_made, defensive_sacks,
    defensive_interceptions, defensive_forced_fumbles, defensive_recovered_fumbles,
    defensive_three_and_outs, defensive_fourth_down_stops, defensive_points_against,
    defensive_yards_against, defensive_blocked_kicks, defensive_safeties,
    defensive_two_point_returns, defensive_touchdowns, kickoff_return_touchdowns,
    punt_return_touchdowns, receiving_first_downs, rushing_first_downs
)
SELECT
    pid, source_id, season_year,
    passing_attempts, passing_completions, passing_yards, passing_interceptions,
    passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns,
    targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost,
    two_point_conversions, field_goals_made, field_goal_yards,
    field_goals_made_0_19_yards, field_goals_made_20_29_yards,
    field_goals_made_30_39_yards, field_goals_made_40_49_yards,
    field_goals_made_50_plus_yards, extra_points_made, defensive_sacks,
    defensive_interceptions, defensive_forced_fumbles, defensive_recovered_fumbles,
    defensive_three_and_outs, defensive_fourth_down_stops, defensive_points_against,
    defensive_yards_against, defensive_blocked_kicks, defensive_safeties,
    defensive_two_point_returns, defensive_touchdowns, kickoff_return_touchdowns,
    punt_return_touchdowns, receiving_first_downs, rushing_first_downs
FROM public.projections_index
WHERE week = 0
  AND user_id = 0
ON CONFLICT (source_id, pid, season_year) DO UPDATE SET
    passing_attempts = EXCLUDED.passing_attempts,
    passing_completions = EXCLUDED.passing_completions,
    passing_yards = EXCLUDED.passing_yards,
    passing_interceptions = EXCLUDED.passing_interceptions,
    passing_touchdowns = EXCLUDED.passing_touchdowns,
    rushing_attempts = EXCLUDED.rushing_attempts,
    rushing_yards = EXCLUDED.rushing_yards,
    rushing_touchdowns = EXCLUDED.rushing_touchdowns,
    targets = EXCLUDED.targets,
    receptions = EXCLUDED.receptions,
    receiving_yards = EXCLUDED.receiving_yards,
    receiving_touchdowns = EXCLUDED.receiving_touchdowns,
    fumbles_lost = EXCLUDED.fumbles_lost,
    two_point_conversions = EXCLUDED.two_point_conversions,
    field_goals_made = EXCLUDED.field_goals_made,
    field_goal_yards = EXCLUDED.field_goal_yards,
    field_goals_made_0_19_yards = EXCLUDED.field_goals_made_0_19_yards,
    field_goals_made_20_29_yards = EXCLUDED.field_goals_made_20_29_yards,
    field_goals_made_30_39_yards = EXCLUDED.field_goals_made_30_39_yards,
    field_goals_made_40_49_yards = EXCLUDED.field_goals_made_40_49_yards,
    field_goals_made_50_plus_yards = EXCLUDED.field_goals_made_50_plus_yards,
    extra_points_made = EXCLUDED.extra_points_made,
    defensive_sacks = EXCLUDED.defensive_sacks,
    defensive_interceptions = EXCLUDED.defensive_interceptions,
    defensive_forced_fumbles = EXCLUDED.defensive_forced_fumbles,
    defensive_recovered_fumbles = EXCLUDED.defensive_recovered_fumbles,
    defensive_three_and_outs = EXCLUDED.defensive_three_and_outs,
    defensive_fourth_down_stops = EXCLUDED.defensive_fourth_down_stops,
    defensive_points_against = EXCLUDED.defensive_points_against,
    defensive_yards_against = EXCLUDED.defensive_yards_against,
    defensive_blocked_kicks = EXCLUDED.defensive_blocked_kicks,
    defensive_safeties = EXCLUDED.defensive_safeties,
    defensive_two_point_returns = EXCLUDED.defensive_two_point_returns,
    defensive_touchdowns = EXCLUDED.defensive_touchdowns,
    kickoff_return_touchdowns = EXCLUDED.kickoff_return_touchdowns,
    punt_return_touchdowns = EXCLUDED.punt_return_touchdowns,
    receiving_first_downs = EXCLUDED.receiving_first_downs,
    rushing_first_downs = EXCLUDED.rushing_first_downs;

--
-- (3) Preservation oracle. Every threshold is COMPUTED AT RUN TIME from the
-- source table inside this same transaction, never a literal transcribed from a
-- plan. A hardcoded count is wrong the moment cron upserts a row, and the plan
-- this file implements carried three different figures for this population
-- (50,064 / 50,074 / 50,214) across three revisions -- which is the argument.
--
-- Four assertions, each of which ABORTS the transaction:
--   (a) the source assumptions still hold (all REG, no NULL week, no collisions
--       after the user_id filter);
--   (b) row count matches the filtered source count exactly;
--   (c) full-column EXCEPT in BOTH directions is empty -- (b) alone cannot see a
--       value corruption that preserves cardinality;
--   (d) the user rows were excluded rather than silently absorbed.
--
-- Which limbs were PROVED able to fail, dry-run 2026-08-28 on a scratch database
-- seeded to reproduce the production shapes. Stated precisely, because "the check
-- is written" and "the check can report" are different claims:
--
--   PROVED RED, then clean again after each restore:
--     (a) non-REG    -- planted a week-0 POST row
--     (b) cardinality -- planted a missing row, then an extra row
--     (c) equality    -- planted a value corruption that PRESERVES cardinality,
--                        and separately a NULL-to-value change, which is the
--                        case (b) alone cannot see and the reason (c) exists
--
--   STRUCTURALLY UNREACHABLE, kept as backstops, NOT proved and not provable:
--     the week IS NULL limb -- projections_index.week is smallint NOT NULL, so
--       the column cannot hold the value this limb looks for.
--     the post-filter collision limb -- the source natural key is
--       (source_id, pid, user_id, week, season_year, season_type); with week = 0
--       and user_id = 0 fixed, the only dimension left free beyond the new key is
--       season_type, so a collision here REQUIRES a non-REG week-0 row, which the
--       (a) limb catches first. An attempt to plant one is rejected by the source
--       table's own unique index before it can reach this check.
--   Both are cheap and both become reachable if the source schema is ever relaxed,
--   which is why they stay. Do not report them as verified.
--
-- Separately proved: the user_id = 0 filter is load-bearing, not defensive. The
-- same INSERT without it fails on
-- idx_season_projections_index_natural_key -- Key (source_id, pid, season_year) =
-- (0, ..., 2020) already exists -- and aborts the entire transaction; with the
-- filter the identical statement succeeds.
--

DO $$
DECLARE
  v_bad_season_type bigint;
  v_null_week bigint;
  v_dup_groups bigint;
  v_source_rows bigint;
  v_dest_rows bigint;
  v_missing bigint;
  v_extra bigint;
  v_user_rows bigint;
BEGIN
  -- (a) source assumptions
  SELECT count(*) INTO v_bad_season_type
    FROM public.projections_index
    WHERE week = 0 AND season_type IS DISTINCT FROM 'REG';
  IF v_bad_season_type <> 0 THEN
    RAISE EXCEPTION 'ABORT: % week-0 rows are not season_type REG. The no-season_type design premise is false; do not migrate.', v_bad_season_type;
  END IF;

  SELECT count(*) INTO v_null_week FROM public.projections_index WHERE week IS NULL;
  IF v_null_week <> 0 THEN
    RAISE EXCEPTION 'ABORT: % rows have week IS NULL and were reached by neither the week=0 nor the week>=1 arm.', v_null_week;
  END IF;

  SELECT count(*) INTO v_dup_groups FROM (
    SELECT 1 FROM public.projections_index
    WHERE week = 0 AND user_id = 0
    GROUP BY source_id, pid, season_year HAVING count(*) > 1
  ) d;
  IF v_dup_groups <> 0 THEN
    RAISE EXCEPTION 'ABORT: % (source_id, pid, season_year) groups collide even after the user_id = 0 filter. The new key is not unique over this population.', v_dup_groups;
  END IF;

  -- (b) cardinality
  SELECT count(*) INTO v_source_rows
    FROM public.projections_index WHERE week = 0 AND user_id = 0;
  SELECT count(*) INTO v_dest_rows FROM public.season_projections_index;
  IF v_source_rows <> v_dest_rows THEN
    RAISE EXCEPTION 'ABORT: row count mismatch -- % filtered source rows, % destination rows.', v_source_rows, v_dest_rows;
  END IF;

  -- (c) full-column equality, both directions
  SELECT count(*) INTO v_missing FROM (
    SELECT pid, source_id, season_year, passing_attempts, passing_completions, passing_yards, passing_interceptions, passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns, targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost, two_point_conversions, field_goals_made, field_goal_yards, field_goals_made_0_19_yards, field_goals_made_20_29_yards, field_goals_made_30_39_yards, field_goals_made_40_49_yards, field_goals_made_50_plus_yards, extra_points_made, defensive_sacks, defensive_interceptions, defensive_forced_fumbles, defensive_recovered_fumbles, defensive_three_and_outs, defensive_fourth_down_stops, defensive_points_against, defensive_yards_against, defensive_blocked_kicks, defensive_safeties, defensive_two_point_returns, defensive_touchdowns, kickoff_return_touchdowns, punt_return_touchdowns, receiving_first_downs, rushing_first_downs
      FROM public.projections_index WHERE week = 0 AND user_id = 0
    EXCEPT
    SELECT pid, source_id, season_year, passing_attempts, passing_completions, passing_yards, passing_interceptions, passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns, targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost, two_point_conversions, field_goals_made, field_goal_yards, field_goals_made_0_19_yards, field_goals_made_20_29_yards, field_goals_made_30_39_yards, field_goals_made_40_49_yards, field_goals_made_50_plus_yards, extra_points_made, defensive_sacks, defensive_interceptions, defensive_forced_fumbles, defensive_recovered_fumbles, defensive_three_and_outs, defensive_fourth_down_stops, defensive_points_against, defensive_yards_against, defensive_blocked_kicks, defensive_safeties, defensive_two_point_returns, defensive_touchdowns, kickoff_return_touchdowns, punt_return_touchdowns, receiving_first_downs, rushing_first_downs
      FROM public.season_projections_index
  ) m;
  IF v_missing <> 0 THEN
    RAISE EXCEPTION 'ABORT: % source rows have no exact full-column match in season_projections_index.', v_missing;
  END IF;

  SELECT count(*) INTO v_extra FROM (
    SELECT pid, source_id, season_year, passing_attempts, passing_completions, passing_yards, passing_interceptions, passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns, targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost, two_point_conversions, field_goals_made, field_goal_yards, field_goals_made_0_19_yards, field_goals_made_20_29_yards, field_goals_made_30_39_yards, field_goals_made_40_49_yards, field_goals_made_50_plus_yards, extra_points_made, defensive_sacks, defensive_interceptions, defensive_forced_fumbles, defensive_recovered_fumbles, defensive_three_and_outs, defensive_fourth_down_stops, defensive_points_against, defensive_yards_against, defensive_blocked_kicks, defensive_safeties, defensive_two_point_returns, defensive_touchdowns, kickoff_return_touchdowns, punt_return_touchdowns, receiving_first_downs, rushing_first_downs
      FROM public.season_projections_index
    EXCEPT
    SELECT pid, source_id, season_year, passing_attempts, passing_completions, passing_yards, passing_interceptions, passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns, targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost, two_point_conversions, field_goals_made, field_goal_yards, field_goals_made_0_19_yards, field_goals_made_20_29_yards, field_goals_made_30_39_yards, field_goals_made_40_49_yards, field_goals_made_50_plus_yards, extra_points_made, defensive_sacks, defensive_interceptions, defensive_forced_fumbles, defensive_recovered_fumbles, defensive_three_and_outs, defensive_fourth_down_stops, defensive_points_against, defensive_yards_against, defensive_blocked_kicks, defensive_safeties, defensive_two_point_returns, defensive_touchdowns, kickoff_return_touchdowns, punt_return_touchdowns, receiving_first_downs, rushing_first_downs
      FROM public.projections_index WHERE week = 0 AND user_id = 0
  ) e;
  IF v_extra <> 0 THEN
    RAISE EXCEPTION 'ABORT: % destination rows have no exact full-column match in the filtered source.', v_extra;
  END IF;

  -- (d) the user rows were excluded, not absorbed
  SELECT count(*) INTO v_user_rows
    FROM public.projections_index WHERE week = 0 AND user_id <> 0;
  RAISE NOTICE 'season_projections_index populated: % rows, full-column equal to projections_index WHERE week = 0 AND user_id = 0 in both directions. % user-authored week-0 rows deliberately excluded (deleted by the destructive companion).', v_dest_rows, v_user_rows;
END $$;

--
-- (4) Statistics. A freshly populated table has none, and the planner would treat
-- it as tiny regardless of its real size.
--

ANALYZE public.season_projections_index;
