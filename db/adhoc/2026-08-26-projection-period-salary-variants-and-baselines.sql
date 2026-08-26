-- Give each projection period table BOTH priced variants, and hoist the
-- league_baselines season sentinel into its own period table. ADDITIVE ONLY --
-- companion to db/adhoc/2026-08-26-projection-period-tables.sql, which created
-- the five period tables earlier today. Nothing here deletes a sentinel row,
-- narrows a week column, or touches a table the deployed code reads.
--
-- The column renames below are safe despite the apply-to-commit-window rule in
-- docs/guides/schema.md, because the three tables being renamed were created
-- hours ago by that companion file and NO committed code names them yet. The
-- rule exists to stop a rename removing something deployed code still reads;
-- there is no such reader here. Verified: grep for these table names outside
-- db/ returns only the adhoc that created them.
--
-- WHY A SECOND SALARY COLUMN. calculate-player-values-rest-of-season.mjs:45-53
-- calls calculatePrices once per aggregate key, so 'ros' and 'ros_net' EACH
-- carry a market_salary and they are different numbers. The first companion
-- file dropped the net one on the argument that calculate-prices floors every
-- price at zero. That argument was wrong in a way worth recording, because it
-- counted the floored players and ignored the ones the column is about.
--
-- Measured 2026-08-26 across the 27,810 grains carrying both keys:
--     2,253 have a POSITIVE ros_net salary
--     1,254 of those DIFFER from the same player's ros salary
--     avg $22.72 against $22.29 for ros, max $111.00
-- So it is a distinct valuation for ~2,250 players, not a duplicate column and
-- not a structurally empty one. Operator ruled 2026-08-26: do not drop it.
--
-- WHAT THE TWO SALARIES MEAN. Both are a player's share of a pool, and the
-- pool is what differs -- get_positive_part_total (calculate-prices.mjs:71-80)
-- builds the denominator from POSITIVE values only, for every aggregate key:
--
--     market_salary_positive = cap * ros_p     / sum of positive ros values
--     market_salary_net      = cap * ros_net_p / sum of positive ros_net values
--
-- The token names WHICH POOL the share is of. It does not assert a sign: the
-- net salary is still floored at zero by calculate-prices.mjs:121-124, so a
-- below-replacement player prices at $0 under both. Naming approved by the
-- operator 2026-08-26 over the more explicit
-- market_salary_share_of_{positive,net}_pool.
--
-- WHICH EXISTING COLUMN IS WHICH. Not symmetric between the two tables, and
-- getting it backwards would silently mislabel every value:
--   season table   -- migrated from week='0', whose pts_added is SIGNED
--                     (calculate-values.mjs:37-39 floors nothing), so its
--                     salary was priced off the net aggregate -> market_salary_net
--   rest-of-season -- migrated from week='ros', which IS the floored positive
--                     aggregate -> market_salary_positive
--
-- THE HISTORY BACKFILL IS AS-OF, for the same reason the original collapse was.
-- 'ros' and 'ros_net' are not written at paired instants, so an equality join
-- on observed_at would leave ~67 percent of the net salaries NULL. At instant T
-- the net salary is the latest 'ros_net' observation at or before T -- the same
-- rule the positive columns were populated under, so the two stay consistent.
--
-- LEAGUE_BASELINES. Folded into this cutover by operator ruling 2026-08-26; it
-- was previously a recorded scope-gap owned by nobody. It carries 23 week='0'
-- rows meaning the season-long baseline, alongside numeric weeks 1..18 -- the
-- same overload, three orders of magnitude smaller. Its week column is
-- character varying(3) with no non-numeric values, so the string type is a
-- latent opening rather than an active sentinel carrier.
--
--   The new table FIXES A KEY DEFECT rather than mirroring it. The existing
--   unique index idx_24626_baseline is (lid, week, player_position, type) and
--   omits season_year, so one (lid, position, type) can hold only ONE row
--   across all years -- each season silently overwrites the last. Live proof:
--   lid=1 carries a 2022 'historical' QB row and a 2026 'starter' QB row, which
--   coexist only because their `type` differs. The season table keys on
--   (lid, season_year, player_position, type). Verified the 23 migrating rows
--   are unique under it.
--
--   Two `type` values with different column population ride along unchanged:
--   'historical' rows carry a pid and NULL points, 'starter' rows carry points
--   and (for 2026) a NULL pid. That inconsistency is pre-existing and is not
--   this file's to resolve.
--
-- No BEGIN/COMMIT: yarn db:exec already wraps the file in one transaction.
-- STATUS: APPLIED 2026-08-26 against league_production

-- ---------------------------------------------------------------------------
-- Season period table: the migrated salary is the NET one
-- ---------------------------------------------------------------------------

ALTER TABLE public.league_format_player_season_projection_values
    RENAME COLUMN market_salary TO market_salary_net;

ALTER TABLE public.league_format_player_season_projection_values
    ADD COLUMN market_salary_positive numeric(6,2);

-- market_salary_positive is left NULL deliberately. week='0' carries a single
-- signed aggregate and therefore a single price; there is no positive-variant
-- season salary anywhere in the source to migrate. The writer fills it once the
-- season aggregate becomes a sum of weekly nets rather than a period-grain
-- draw, which is the operator's 2026-08-05 ruling and a separate change.

-- ---------------------------------------------------------------------------
-- Rest-of-season period table: the migrated salary is the POSITIVE one
-- ---------------------------------------------------------------------------

ALTER TABLE public.league_format_player_rest_of_season_projection_values
    RENAME COLUMN market_salary TO market_salary_positive;

ALTER TABLE public.league_format_player_rest_of_season_projection_values
    ADD COLUMN market_salary_net numeric(6,2);

UPDATE public.league_format_player_rest_of_season_projection_values dst
SET market_salary_net = src.market_salary
FROM public.league_format_player_projection_values src
WHERE src.week = 'ros_net'
  AND src.pid = dst.pid
  AND src.league_format_id = dst.league_format_id
  AND src.season_year = dst.season_year;

-- ---------------------------------------------------------------------------
-- Rest-of-season history: same rename, as-of backfill
-- ---------------------------------------------------------------------------

ALTER TABLE public.league_format_player_rest_of_season_projection_values_history
    RENAME COLUMN market_salary TO market_salary_positive;

ALTER TABLE public.league_format_player_rest_of_season_projection_values_history
    ADD COLUMN market_salary_net numeric(6,2);

-- A correlated scalar subquery in SET, NOT `FROM LATERAL (...)`. Postgres
-- refuses to let a LATERAL subquery in an UPDATE's FROM clause reference the
-- update target ("invalid reference to FROM-clause entry for table dst"),
-- because the target is not part of the FROM list it can correlate against.
-- The SET-side subquery can, and yields the same as-of semantics.
UPDATE public.league_format_player_rest_of_season_projection_values_history dst
SET market_salary_net = (
    SELECT h.market_salary
    FROM public.league_format_player_projection_values_history h
    WHERE h.week = 'ros_net'
      AND h.pid = dst.pid
      AND h.league_format_id = dst.league_format_id
      AND h.season_year = dst.season_year
      AND h.observed_at <= dst.observed_at
    ORDER BY h.observed_at DESC
    LIMIT 1
);

-- ---------------------------------------------------------------------------
-- League baselines season period table
-- ---------------------------------------------------------------------------

CREATE TABLE public.league_season_baselines (
    lid integer NOT NULL,
    season_year smallint NOT NULL,
    pid character varying(25),
    type character varying(10) NOT NULL,
    player_position character varying(4) NOT NULL,
    points numeric(6,2),
    CONSTRAINT league_season_baselines_pkey
        UNIQUE (lid, season_year, player_position, type),
    CONSTRAINT league_season_baselines_pos_vocabulary
        CHECK (player_position IS NULL OR player_position::text = ANY (ARRAY[
            'QB','RB','FB','WR','TE','OL','T','G','C','DL','DE','DT','NT',
            'EDGE','LB','OLB','ILB','MLB','DB','CB','S','K','P','LS','DST'
        ]::text[]))
);

GRANT SELECT ON TABLE public.league_season_baselines TO league_reader;

INSERT INTO public.league_season_baselines
    (lid, season_year, pid, type, player_position, points)
SELECT lid, season_year, pid, type, player_position, points
FROM public.league_baselines
WHERE week = '0';

-- ---------------------------------------------------------------------------
-- Oracles, computed from the source rather than hardcoded
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    src bigint;
    dst bigint;
BEGIN
    -- Every 'ros_net' grain in the base table must have landed a net salary,
    -- except where the source salary is itself NULL. Comparing against the
    -- source's non-null count rather than its row count is what distinguishes
    -- "the join missed" from "the source had no value".
    SELECT count(*) INTO src
        FROM public.league_format_player_projection_values
        WHERE week = 'ros_net' AND market_salary IS NOT NULL;
    SELECT count(*) INTO dst
        FROM public.league_format_player_rest_of_season_projection_values
        WHERE market_salary_net IS NOT NULL;
    IF dst <> src THEN
        RAISE EXCEPTION 'rest-of-season net salary backfill mismatch: % source values, % populated', src, dst;
    END IF;

    -- The history oracle cannot be a source count: an as-of join populates every
    -- instant at or after the grain's FIRST 'ros_net' observation, which is more
    -- rows than the source has.
    --
    -- It also must NOT assert "every instant with any earlier non-null salary is
    -- populated". That check fails on 1,692 real instants, and the failure is
    -- correct behaviour rather than a bug: record-league-format-projection-value-history.mjs
    -- inserts the FULL row on every change (:96-105) and writes explicit NULLs on
    -- the tombstone path (:113-118), so a NULL market_salary is a genuine
    -- observed state, not "unchanged". Carrying an older value forward past it
    -- would resurrect a price the change-capture recorded as gone.
    --
    -- Two directional checks instead. Together they catch the two ways an as-of
    -- join goes wrong while staying non-tautological -- neither restates the
    -- UPDATE's own predicate.

    -- Direction 1: no value invented. A populated net salary with no qualifying
    -- source observation at or before its instant means the join fanned out.
    SELECT count(*) INTO dst
        FROM public.league_format_player_rest_of_season_projection_values_history dst_h
        WHERE dst_h.market_salary_net IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.league_format_player_projection_values_history h
              WHERE h.week = 'ros_net'
                AND h.pid = dst_h.pid
                AND h.league_format_id = dst_h.league_format_id
                AND h.season_year = dst_h.season_year
                AND h.observed_at <= dst_h.observed_at
          );
    IF dst <> 0 THEN
        RAISE EXCEPTION 'rest-of-season history invented % net salaries with no source observation', dst;
    END IF;

    -- Direction 2: no grain wholly missed. Every grain carrying a non-null net
    -- salary in the source must carry at least one in the destination.
    SELECT count(*) INTO src
        FROM (
            SELECT DISTINCT pid, league_format_id, season_year
            FROM public.league_format_player_projection_values_history
            WHERE week = 'ros_net' AND market_salary IS NOT NULL
        ) g;
    SELECT count(*) INTO dst
        FROM (
            SELECT DISTINCT pid, league_format_id, season_year
            FROM public.league_format_player_rest_of_season_projection_values_history
            WHERE market_salary_net IS NOT NULL
        ) g;
    IF dst <> src THEN
        RAISE EXCEPTION 'rest-of-season history net salary reached % grains, source has %', dst, src;
    END IF;

    SELECT count(*) INTO src
        FROM public.league_baselines WHERE week = '0';
    SELECT count(*) INTO dst
        FROM public.league_season_baselines;
    IF dst <> src THEN
        RAISE EXCEPTION 'league baselines season mismatch: % source rows, % migrated', src, dst;
    END IF;

    RAISE NOTICE 'salary variants and season baselines migrated against source oracles';
END $$;

ANALYZE public.league_format_player_season_projection_values;
ANALYZE public.league_format_player_rest_of_season_projection_values;
ANALYZE public.league_format_player_rest_of_season_projection_values_history;
ANALYZE public.league_season_baselines;
