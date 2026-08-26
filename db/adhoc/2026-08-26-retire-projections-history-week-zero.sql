-- STATUS: PENDING
-- Retire the week = 0 sentinel from projections_history.
--
-- DESTRUCTIVE HALF. The companion additive file
-- db/adhoc/2026-08-26-season-projections-history.sql created
-- season_projections_history and populated it; this one tops that extract up,
-- proves it is still lossless, deletes the week = 0 rows, and constrains the
-- column so the sentinel cannot come back.
--
-- DO NOT RUN THIS UNTIL ALL THREE HOLD:
--   1. The writer repoint (league db34ec0b2) is DEPLOYED to both hosts. Until
--      then cron keeps writing week = 0 rows, and the top-up below would race
--      the delete -- rows written between the two statements survive the delete
--      and then violate the CHECK, aborting the whole file.
--   2. One process-projections run has completed since that deploy and its
--      season observations landed in season_projections_history rather than
--      here.
--   3. The season-board regression (projected_points_added_positive = -999) is
--      fixed and shipped. Not a data dependency -- a lane dependency. Two
--      destructive windows open at once in the same lane is how a rollback
--      stops being attributable.
--
-- Time it OFF THE CRON. process-projections runs hourly at :30 and takes about
-- nine minutes; the 2026-08-18 incident in docs/guides/ship.md is a collision of
-- exactly that shape. This file takes ACCESS EXCLUSIVE on every partition to add
-- its constraint, so a collision blocks the importer rather than merely racing it.
--
-- VACUUM IS NOT IN THIS FILE. db-exec.sh runs the whole file as ONE transaction
-- and VACUUM cannot run inside a transaction block. Run it separately, after
-- this commits, against each partition:
--   VACUUM (ANALYZE) public.projections_history_y2020;  -- ... through _y2026
-- Deleting 2.43M rows of a 9.87M-row 2.25 GB table leaves a lot of dead tuples.

SET lock_timeout = '30s';
SET statement_timeout = 0;

--
-- (1) Top up the change-only extract.
--
-- Identical to the populate in the additive file. Idempotent: the change
-- detection is computed over the whole series, and because the importer only
-- ever appends at the MAXIMUM generated_at, a row that was kept on the first
-- run is still kept on this one. ON CONFLICT DO NOTHING absorbs the overlap.
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

ANALYZE public.season_projections_history;

--
-- (2) THE GATE. Re-prove losslessness against the rows about to be deleted.
--
-- This is the whole justification for discarding roughly 95 percent of them, and
-- it is re-run here rather than trusted from the additive apply because the
-- source has grown since. Two independent assertions:
--
--   a. Every distinct VALUE STATE in the week-0 rows exists in the extract.
--   b. The point-in-time board reconstruction returns identical values from
--      both sides, at every instant that appears in the series.
--
-- (b) is the one that matters and the one a row count cannot see. It is
-- evaluated at EVERY distinct generated_at rather than at a sample, because
-- after this file runs the source is gone and there is no second chance.
--
-- A failure RAISES and rolls the whole file back, deletes included.
--

DO $gate$
DECLARE
  missing_states bigint;
  fabricated_states bigint;
  board_mismatches bigint;
  unmatched_rows bigint;
BEGIN
  SELECT count(*) INTO missing_states FROM (
    SELECT DISTINCT passing_attempts, passing_completions, passing_yards, passing_interceptions, passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns, targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost, two_point_conversions, field_goals_made, field_goal_yards, field_goals_made_0_19_yards, field_goals_made_20_29_yards, field_goals_made_30_39_yards, field_goals_made_40_49_yards, field_goals_made_50_plus_yards, extra_points_made, defensive_sacks, defensive_interceptions, defensive_forced_fumbles, defensive_recovered_fumbles, defensive_three_and_outs, defensive_fourth_down_stops, defensive_points_against, defensive_yards_against, defensive_blocked_kicks, defensive_safeties, defensive_two_point_returns, defensive_touchdowns, kickoff_return_touchdowns, punt_return_touchdowns FROM public.projections_history WHERE week = 0 AND user_id = 0
    EXCEPT
    SELECT DISTINCT passing_attempts, passing_completions, passing_yards, passing_interceptions, passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns, targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost, two_point_conversions, field_goals_made, field_goal_yards, field_goals_made_0_19_yards, field_goals_made_20_29_yards, field_goals_made_30_39_yards, field_goals_made_40_49_yards, field_goals_made_50_plus_yards, extra_points_made, defensive_sacks, defensive_interceptions, defensive_forced_fumbles, defensive_recovered_fumbles, defensive_three_and_outs, defensive_fourth_down_stops, defensive_points_against, defensive_yards_against, defensive_blocked_kicks, defensive_safeties, defensive_two_point_returns, defensive_touchdowns, kickoff_return_touchdowns, punt_return_touchdowns FROM public.season_projections_history
  ) x;

  SELECT count(*) INTO fabricated_states FROM (
    SELECT DISTINCT passing_attempts, passing_completions, passing_yards, passing_interceptions, passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns, targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost, two_point_conversions, field_goals_made, field_goal_yards, field_goals_made_0_19_yards, field_goals_made_20_29_yards, field_goals_made_30_39_yards, field_goals_made_40_49_yards, field_goals_made_50_plus_yards, extra_points_made, defensive_sacks, defensive_interceptions, defensive_forced_fumbles, defensive_recovered_fumbles, defensive_three_and_outs, defensive_fourth_down_stops, defensive_points_against, defensive_yards_against, defensive_blocked_kicks, defensive_safeties, defensive_two_point_returns, defensive_touchdowns, kickoff_return_touchdowns, punt_return_touchdowns FROM public.season_projections_history
    EXCEPT
    SELECT DISTINCT passing_attempts, passing_completions, passing_yards, passing_interceptions, passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns, targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost, two_point_conversions, field_goals_made, field_goal_yards, field_goals_made_0_19_yards, field_goals_made_20_29_yards, field_goals_made_30_39_yards, field_goals_made_40_49_yards, field_goals_made_50_plus_yards, extra_points_made, defensive_sacks, defensive_interceptions, defensive_forced_fumbles, defensive_recovered_fumbles, defensive_three_and_outs, defensive_fourth_down_stops, defensive_points_against, defensive_yards_against, defensive_blocked_kicks, defensive_safeties, defensive_two_point_returns, defensive_touchdowns, kickoff_return_touchdowns, punt_return_touchdowns FROM public.projections_history WHERE week = 0 AND user_id = 0
  ) x;

  -- Agreement at every SOURCE OBSERVATION INSTANT, which is equivalent to
  -- agreement at every possible cutoff D: a cutoff between two instants selects
  -- the same row as a cutoff at the greatest instant at or before it, on BOTH
  -- sides. So this is the full claim, not a sample of it.
  --
  -- Written as a per-row LATERAL rather than as a cutoff cross join. The cross
  -- join form is what the additive-phase probe used at 8 hand-picked cutoffs;
  -- run over all ~1,350 instants it is instants x grains and takes hours. This
  -- form is one index lookup per source row on the extract's unique key.
  SELECT count(*) INTO board_mismatches
  FROM public.projections_history h
  CROSS JOIN LATERAL (
    SELECT passing_attempts, passing_completions, passing_yards, passing_interceptions, passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns, targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost, two_point_conversions, field_goals_made, field_goal_yards, field_goals_made_0_19_yards, field_goals_made_20_29_yards, field_goals_made_30_39_yards, field_goals_made_40_49_yards, field_goals_made_50_plus_yards, extra_points_made, defensive_sacks, defensive_interceptions, defensive_forced_fumbles, defensive_recovered_fumbles, defensive_three_and_outs, defensive_fourth_down_stops, defensive_points_against, defensive_yards_against, defensive_blocked_kicks, defensive_safeties, defensive_two_point_returns, defensive_touchdowns, kickoff_return_touchdowns, punt_return_touchdowns
    FROM public.season_projections_history e
    WHERE e.source_id = h.source_id
      AND e.pid = h.pid
      AND e.season_year = h.season_year
      AND e.generated_at <= h.generated_at
    ORDER BY e.generated_at DESC
    LIMIT 1
  ) e
  WHERE h.week = 0
    AND h.user_id = 0
    AND ROW(h.passing_attempts, h.passing_completions, h.passing_yards, h.passing_interceptions, h.passing_touchdowns, h.rushing_attempts, h.rushing_yards, h.rushing_touchdowns, h.targets, h.receptions, h.receiving_yards, h.receiving_touchdowns, h.fumbles_lost, h.two_point_conversions, h.field_goals_made, h.field_goal_yards, h.field_goals_made_0_19_yards, h.field_goals_made_20_29_yards, h.field_goals_made_30_39_yards, h.field_goals_made_40_49_yards, h.field_goals_made_50_plus_yards, h.extra_points_made, h.defensive_sacks, h.defensive_interceptions, h.defensive_forced_fumbles, h.defensive_recovered_fumbles, h.defensive_three_and_outs, h.defensive_fourth_down_stops, h.defensive_points_against, h.defensive_yards_against, h.defensive_blocked_kicks, h.defensive_safeties, h.defensive_two_point_returns, h.defensive_touchdowns, h.kickoff_return_touchdowns, h.punt_return_touchdowns) IS DISTINCT FROM ROW(e.passing_attempts, e.passing_completions, e.passing_yards, e.passing_interceptions, e.passing_touchdowns, e.rushing_attempts, e.rushing_yards, e.rushing_touchdowns, e.targets, e.receptions, e.receiving_yards, e.receiving_touchdowns, e.fumbles_lost, e.two_point_conversions, e.field_goals_made, e.field_goal_yards, e.field_goals_made_0_19_yards, e.field_goals_made_20_29_yards, e.field_goals_made_30_39_yards, e.field_goals_made_40_49_yards, e.field_goals_made_50_plus_yards, e.extra_points_made, e.defensive_sacks, e.defensive_interceptions, e.defensive_forced_fumbles, e.defensive_recovered_fumbles, e.defensive_three_and_outs, e.defensive_fourth_down_stops, e.defensive_points_against, e.defensive_yards_against, e.defensive_blocked_kicks, e.defensive_safeties, e.defensive_two_point_returns, e.defensive_touchdowns, e.kickoff_return_touchdowns, e.punt_return_touchdowns);

  -- A CROSS JOIN LATERAL drops a source row that finds no partner, so a grain
  -- absent from the extract would read as ZERO mismatches. Count it separately
  -- or the check above fails toward a confident green.
  SELECT count(*) INTO unmatched_rows
  FROM public.projections_history h
  WHERE h.week = 0
    AND h.user_id = 0
    AND NOT EXISTS (
      SELECT 1 FROM public.season_projections_history e
      WHERE e.source_id = h.source_id
        AND e.pid = h.pid
        AND e.season_year = h.season_year
        AND e.generated_at <= h.generated_at
    );

  RAISE NOTICE 'losslessness gate: missing_states=% fabricated_states=% board_mismatches=% unmatched_rows=%',
    missing_states, fabricated_states, board_mismatches, unmatched_rows;

  IF missing_states <> 0 OR fabricated_states <> 0 OR board_mismatches <> 0
     OR unmatched_rows <> 0 THEN
    RAISE EXCEPTION 'REFUSING TO DELETE -- extract is not lossless: % missing states, % fabricated states, % board mismatches, % unmatched rows',
      missing_states, fabricated_states, board_mismatches, unmatched_rows;
  END IF;
END
$gate$;

--
-- (3) The 27 user-authored rows.
--
-- Deleted rather than migrated. They collide on the season key without user_id
-- (2 duplicate groups), the season table has no user_id column to separate them
-- with, and the user-authored projection feature was removed end to end in
-- league f3b96590c -- so nothing reads or writes them and nothing will.
--

DELETE FROM public.projections_history WHERE week = 0 AND user_id <> 0;

--
-- (4) The sentinel rows.
--

DELETE FROM public.projections_history WHERE week = 0;

--
-- (5) Constrain the column so the sentinel cannot return.
--
-- NOT VALID then VALIDATE per partition, deliberately. A plain validating
-- ADD CONSTRAINT holds ACCESS EXCLUSIVE across a full scan of a 2.25 GB parent;
-- the two-step takes the exclusive lock only for the catalog change and does the
-- scan under SHARE UPDATE EXCLUSIVE, which readers and writers tolerate. Note
-- SET lock_timeout bounds lock ACQUISITION, not how long a lock is held.
--
-- week is currently NULLABLE. SET NOT NULL normally rescans the whole table, so
-- it goes the same route: a validated CHECK (week IS NOT NULL) lets Postgres
-- skip the scan (PG 12+).
--

ALTER TABLE public.projections_history
  ADD CONSTRAINT projections_history_week_is_a_real_week
  CHECK (week >= 1) NOT VALID;

ALTER TABLE public.projections_history
  ADD CONSTRAINT projections_history_week_not_null
  CHECK (week IS NOT NULL) NOT VALID;

DO $validate$
DECLARE
  partition_name text;
BEGIN
  FOR partition_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_inherits i ON i.inhrelid = c.oid
    WHERE i.inhparent = 'public.projections_history'::regclass
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I VALIDATE CONSTRAINT projections_history_week_is_a_real_week',
      partition_name
    );
    EXECUTE format(
      'ALTER TABLE public.%I VALIDATE CONSTRAINT projections_history_week_not_null',
      partition_name
    );
    RAISE NOTICE 'validated both constraints on %', partition_name;
  END LOOP;
END
$validate$;

ALTER TABLE public.projections_history
  VALIDATE CONSTRAINT projections_history_week_is_a_real_week;

ALTER TABLE public.projections_history
  VALIDATE CONSTRAINT projections_history_week_not_null;

-- Scan-free: the validated CHECK above proves there is no NULL to find.
ALTER TABLE public.projections_history ALTER COLUMN week SET NOT NULL;

--
-- (6) Post-conditions. Assert the PROPERTY, never a row count -- a dry run of
-- this file advances nothing, but the source keeps growing between the
-- rehearsal and the real apply, so any count asserted here would be stale by
-- construction.
--

DO $post$
DECLARE
  remaining_week0 bigint;
  remaining_identifiers bigint;
  rejected boolean := false;
BEGIN
  SELECT count(*) INTO remaining_week0
    FROM public.projections_history WHERE week = 0;
  SELECT count(*) INTO remaining_identifiers
    FROM public.projections_history WHERE nfl_week_id LIKE '%\_WEEK\_0';

  IF remaining_week0 <> 0 THEN
    RAISE EXCEPTION 'week = 0 rows survived the delete: %', remaining_week0;
  END IF;
  IF remaining_identifiers <> 0 THEN
    RAISE EXCEPTION 'YYYY_REG_WEEK_0 identifiers survived: %', remaining_identifiers;
  END IF;

  -- Prove the CHECK actually FIRES rather than inferring it from the catalog.
  -- A constraint that exists and a constraint that rejects are different claims.
  BEGIN
    INSERT INTO public.projections_history
      (pid, source_id, user_id, week, season_year, season_type, generated_at)
    VALUES ('GATE-PROBE-000000', 0, 0, 0, 2026, 'REG', now());
  EXCEPTION WHEN check_violation THEN
    rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION 'the week >= 1 CHECK did not reject a week = 0 insert';
  END IF;

  RAISE NOTICE 'post-conditions OK: 0 week-0 rows, 0 WEEK_0 identifiers, CHECK proven to reject';
END
$post$;
