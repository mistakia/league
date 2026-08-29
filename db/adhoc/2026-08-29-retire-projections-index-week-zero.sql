-- STATUS: PENDING
-- Retire the week = 0 season-long slot from projections_index: delete the rows
-- and narrow week to CHECK (week >= 1), so the sentinel is unwritable rather
-- than merely unwritten.
--
-- DESTRUCTIVE HALF. The additive half shipped 2026-08-28
-- (2026-08-28-season-projections-index.sql), and the writer and reader repoint
-- is DEPLOYED. Confirm the deployed host is at the PHASE C commit before
-- running this -- not Phase B's. A host still at Phase B writes week 0, and
-- server/crontab-main/league-imports.cron runs hourly at :30, so this CHECK
-- would fail every projection writer within the hour.
--
-- After this file, `week = 0` on projections_index means the fantasy offseason
-- and nothing else -- which is to say it means nothing here, because a
-- projection week is always a real game week. The season-long projection lives
-- in season_projections_index, keyed (source_id, pid, season_year) with no week
-- column at all, so no week predicate can reach or amputate it. That is the
-- 2026-08-04 outage made structurally impossible rather than guarded: the week
-- floor stepped from 0 to 1 in the preseason, `week >= floor` removed every
-- season row, the consensus was written all-NULL and market_salary priced at $0
-- on 22 of 23 league formats with nothing failing.
--
-- THE ORACLE IS KEY COVERAGE, NOT EQUALITY, AND THE PLAN SAID EQUALITY.
-- The plan's Phase C step was "re-run the preservation oracle" -- the
-- full-column EXCEPT in both directions that Phase A used. That oracle is now
-- guaranteed to fail, and correctly so. Phase B's writers flipped first, so
-- projections_index week 0 has been a FROZEN snapshot since ~15:50 on
-- 2026-08-29 while season_projections_index is refreshed hourly. The two tables
-- are SUPPOSED to disagree on values by now; asserting they do not would report
-- a healthy convergence as corruption. The same finding retired the Phase B
-- re-populate.
--
-- What must still hold is that deleting week 0 loses no KEY that is not being
-- actively maintained. Measured 2026-08-29: 50,185 week-0 keys, 50,187 season
-- keys, 7 week-0 keys absent from the season table and 9 season keys absent
-- from week 0. All 16 are season_year 2026 and all belong to sources that are
-- writing the season table every hour -- players a source has since dropped
-- from or added to its set, which is exactly the churn signature of a frozen
-- snapshot beside a live table. Every year before 2026 is covered exactly, and
-- that is the limb below that must stay at zero.

SET lock_timeout = '30s';
SET statement_timeout = 0;

--
-- (1) The oracle. Every limb RAISES, so a failure aborts the transaction before
--     a single row is deleted.
--
DO $$
DECLARE
  v_week0_rows            bigint;
  v_week0_user_rows       bigint;
  v_non_reg               bigint;
  v_lost_historical       bigint;
  v_lost_current          bigint;
  v_sources_wiped         bigint;
  v_current_keys          bigint;
  v_current_year          smallint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM season_projections_index) THEN
    RAISE EXCEPTION 'season_projections_index is EMPTY -- the reader repoint is not deployed, or Phase A was rolled back. Refusing to delete week 0.';
  END IF;

  -- The year whose source set is still being rewritten, and therefore the one
  -- year allowed to differ. Derived from the data rather than transcribed: a
  -- literal would be wrong on arrival next August.
  --
  -- READ FROM THE WEEK-0 SET, NOT FROM season_projections_index, and the
  -- difference is a hole this oracle had until the red battery found it. Taking
  -- max(season_year) from the season table lets the table under suspicion
  -- define which year is exempt: wipe every 2026 season row and the current
  -- year reads 2025, so the 2026 week-0 keys are neither "before the current
  -- year" nor "the current year" and fall through BOTH limbs silently. The
  -- oracle reported clean on the exact input it exists to refuse. Anchoring on
  -- the rows being DELETED cannot be moved by the state being checked.
  SELECT max(season_year) INTO v_current_year FROM projections_index WHERE week = 0;

  SELECT count(*) INTO v_week0_rows FROM projections_index WHERE week = 0;
  IF v_week0_rows = 0 THEN
    RAISE EXCEPTION 'no week = 0 rows found. Either this file already ran, or the pattern matched nothing -- and a confident zero here would let every limb below pass vacuously.';
  END IF;

  -- The 27 user rows. They carry source_id = 0, season_year = 2020 and collide
  -- on the new key, which is why Phase A filtered them out rather than copying
  -- them. Operator ruling of 2026-08-26: they are deleted and the feature is
  -- rebuilt from scratch later.
  SELECT count(*) INTO v_week0_user_rows FROM projections_index WHERE week = 0 AND user_id <> 0;
  IF v_week0_user_rows <> 27 THEN
    RAISE EXCEPTION 'expected 27 user-projection week-0 rows, found %. The ruling that deletes them was scoped to a population this no longer matches.', v_week0_user_rows;
  END IF;
  IF EXISTS (SELECT 1 FROM projections_index WHERE user_id <> 0 AND week <> 0) THEN
    RAISE EXCEPTION 'a user-projection row exists OUTSIDE week 0. Deleting week 0 would leave user_id non-constant, which the drop below assumes.';
  END IF;

  -- Every week-0 row is REG. Checked with IS DISTINCT FROM so a NULL is caught
  -- rather than silently passing a `<> ''REG''` comparison.
  SELECT count(*) INTO v_non_reg FROM projections_index WHERE week = 0 AND season_type IS DISTINCT FROM 'REG';
  IF v_non_reg <> 0 THEN
    RAISE EXCEPTION 'found % week-0 rows that are not REG. A season-long projection is a REG quantity and season_projections_index has no season_type to hold anything else.', v_non_reg;
  END IF;

  -- THE LOAD-BEARING LIMB. No year other than the live one may lose a key.
  SELECT count(*) INTO v_lost_historical
  FROM (
    SELECT source_id, pid, season_year FROM projections_index WHERE week = 0 AND user_id = 0 AND season_year < v_current_year
    EXCEPT
    SELECT source_id, pid, season_year FROM season_projections_index
  ) x;
  IF v_lost_historical <> 0 THEN
    RAISE EXCEPTION 'deleting week 0 would lose % key(s) from a season year before %, which nothing rewrites. Those rows are not recoverable from any importer.', v_lost_historical, v_current_year;
  END IF;

  -- The live year is allowed to differ, but only by churn. A whole source
  -- disappearing is not churn, and that is the shape a broken importer makes.
  SELECT count(*) INTO v_lost_current
  FROM (
    SELECT source_id, pid, season_year FROM projections_index WHERE week = 0 AND user_id = 0 AND season_year = v_current_year
    EXCEPT
    SELECT source_id, pid, season_year FROM season_projections_index
  ) x;

  SELECT count(*) INTO v_sources_wiped
  FROM (
    SELECT DISTINCT source_id FROM projections_index WHERE week = 0 AND user_id = 0 AND season_year = v_current_year
    EXCEPT
    SELECT DISTINCT source_id FROM season_projections_index WHERE season_year = v_current_year
  ) x;
  IF v_sources_wiped <> 0 THEN
    RAISE EXCEPTION '% source(s) have week-0 rows for % but NO rows at all in season_projections_index for that year. That is a dead importer, not churn, and deleting week 0 would take the last copy.', v_sources_wiped, v_current_year;
  END IF;

  -- Every source keeping SOME rows is not enough. A source that kept ten of two
  -- thousand players passes the limb above while having effectively collapsed,
  -- so the shortfall is also bounded proportionally. Measured on production
  -- 2026-08-29: 7 uncovered keys out of 12,760 for the live year, or 0.05%. Five
  -- percent is two orders of magnitude of headroom over real churn and still
  -- refuses anything that looks like a partial import.
  SELECT count(*) INTO v_current_keys
  FROM projections_index WHERE week = 0 AND user_id = 0 AND season_year = v_current_year;
  IF v_current_keys > 0 AND v_lost_current::numeric / v_current_keys > 0.05 THEN
    -- round(), not a %.2f placeholder: RAISE takes no printf precision, and the
    -- literal ".2f" was printed verbatim in the middle of the number.
    RAISE EXCEPTION 'deleting week 0 would lose % of % keys for the live year % (% percent), which is past the churn bound. Some importer wrote a partial season set.',
      v_lost_current, v_current_keys, v_current_year, round(100.0 * v_lost_current / v_current_keys, 2);
  END IF;

  RAISE NOTICE 'oracle clean: % week-0 rows (% user rows), current year %, % live-year key(s) not carried forward as source churn, 0 historical.',
    v_week0_rows, v_week0_user_rows, v_current_year, v_lost_current;
END $$;

--
-- (2) Delete. The user rows go first and separately so the count is its own
--     statement in the log rather than folded into a 50k delete.
--
DELETE FROM projections_index WHERE week = 0 AND user_id <> 0;
DELETE FROM projections_index WHERE week = 0;

--
-- (3) The constraint, NOT VALID then VALIDATE per partition.
--
-- A plain validating ADD CONSTRAINT holds ACCESS EXCLUSIVE across a full scan of
-- every partition. NOT VALID takes the lock only long enough to record the
-- constraint; VALIDATE CONSTRAINT then takes SHARE UPDATE EXCLUSIVE, which does
-- not block reads or writes. `SET lock_timeout` above bounds lock ACQUISITION,
-- not HOLD, so it does nothing for the plain form -- an earlier draft of the
-- plan cited it as if it did.
--
-- No upper bound, deliberately diverging from the sibling period tables'
-- BETWEEN 1 AND 18: this table carries POST rows keyed by nfl_seas_week, and the
-- era-aware bound already lives in get_max_weeks_for_season_type. Duplicating it
-- as a literal creates a second source of truth that drifts. Operator approved
-- 2026-08-26.
ALTER TABLE public.projections_index
  ADD CONSTRAINT projections_index_week_is_fantasy_week CHECK (week >= 1) NOT VALID;

-- Eight partitions, not nine: _y2020..._y2026 plus _default.
ALTER TABLE public.projections_index_y2020 VALIDATE CONSTRAINT projections_index_week_is_fantasy_week;
ALTER TABLE public.projections_index_y2021 VALIDATE CONSTRAINT projections_index_week_is_fantasy_week;
ALTER TABLE public.projections_index_y2022 VALIDATE CONSTRAINT projections_index_week_is_fantasy_week;
ALTER TABLE public.projections_index_y2023 VALIDATE CONSTRAINT projections_index_week_is_fantasy_week;
ALTER TABLE public.projections_index_y2024 VALIDATE CONSTRAINT projections_index_week_is_fantasy_week;
ALTER TABLE public.projections_index_y2025 VALIDATE CONSTRAINT projections_index_week_is_fantasy_week;
ALTER TABLE public.projections_index_y2026 VALIDATE CONSTRAINT projections_index_week_is_fantasy_week;
ALTER TABLE public.projections_index_default VALIDATE CONSTRAINT projections_index_week_is_fantasy_week;
ALTER TABLE public.projections_index VALIDATE CONSTRAINT projections_index_week_is_fantasy_week;

--
-- (4) Post-conditions, asserted rather than eyeballed.
--
DO $$
DECLARE
  v_remaining bigint;
  v_min_week  smallint;
  v_ids       bigint;
BEGIN
  SELECT count(*) INTO v_remaining FROM projections_index WHERE week = 0;
  IF v_remaining <> 0 THEN
    RAISE EXCEPTION '% week-0 rows survived the delete.', v_remaining;
  END IF;

  SELECT min(week) INTO v_min_week FROM projections_index;
  IF v_min_week < 1 THEN
    RAISE EXCEPTION 'min(week) is % after the delete.', v_min_week;
  END IF;

  -- Scoped to week-0 identifiers on purpose. validate_nfl_week_identifier is
  -- NOT a general post-migration oracle: 2025_POST_WEEK_5 exists on 42 rows and
  -- legitimately fails it, because get_max_weeks_for_season_type returns 4 for
  -- POST 2025. Those rows carry week = 5, so nothing here touches them, and
  -- asserting the general form would report a false failure after a perfect
  -- migration.
  SELECT count(*) INTO v_ids FROM projections_index WHERE nfl_week_id LIKE '%\_WEEK\_0';
  IF v_ids <> 0 THEN
    RAISE EXCEPTION '% rows still carry a YYYY_REG_WEEK_0 identifier.', v_ids;
  END IF;

  RAISE NOTICE 'post-conditions clean: 0 week-0 rows, min(week) = %, 0 week-0 identifiers.', v_min_week;
END $$;
