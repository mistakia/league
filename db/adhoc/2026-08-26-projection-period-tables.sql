-- Hoist the period sentinels out of the week column on
-- scoring_format_player_projection_points and league_format_player_projection_values
-- into dedicated period tables, and split the projection-value history table by
-- period. ADDITIVE HALF ONLY -- this file creates the five new tables and
-- migrates the existing sentinel rows into them. It does NOT delete the sentinel
-- rows, does NOT narrow week to smallint, does NOT rename any column or table,
-- and does NOT prune the week-0 history. Those are destructive and live in the
-- companion adhoc that runs AFTER the reader/writer sweep is deployed.
--
-- Why split in two: this is the same circularity the Step 2 companion file
--   db/adhoc/2026-07-30-league-player-period-projection-tables.sql resolved for
--   league_player_projection_values, and it is resolved the same way. The
--   apply-to-commit-window rule in docs/guides/schema.md says a drop or a rename
--   removes something committed code still names, so the sweep must ship first --
--   but the new readers have nothing to read until these tables exist. An
--   additive-only schema is a superset of what the deployed code needs, so this
--   file breaks nothing and is safe to land and deploy against at any time.
--
-- The defect being removed: week encodes three non-week periods as literal
--   strings alongside numeric weeks 1..18 -- '0' (season snapshot), 'ros'
--   (rest-of-season, positive-only) and 'ros_net' (rest-of-season, signed). The
--   column is character varying(3) on the scoring-format table and character
--   varying(10) on the league-format pair, widened by
--   db/adhoc/2026-05-16-restructure-points-added-pipeline.sql step (4)
--   specifically to fit 'ros_net'. That widening is what the companion adhoc
--   reverses. Leave that earlier file untouched as audit trail.
--
-- Measured in league_production 2026-08-26, immediately before authoring:
--     scoring_format_player_projection_points          week='0'        60,839
--                                                      week='ros'      35,934
--     league_format_player_projection_values           week='0'        35,827
--                                                      week='ros'      29,167
--                                                      week='ros_net'  27,810
--     league_format_player_projection_values_history   week='0'     5,424,775
--                                                      week='ros'      93,852
--                                                      week='ros_net' 279,731
--
-- WHICH VARIANT EACH SENTINEL CARRIES -- measured, not assumed. This is the
--   fact the column names below rest on, and it is not visible from the schema:
--     week='0'        signed   min -999.00  max 405.82
--     week='ros'      positive min    0.00  max 352.07
--     week='ros_net'  signed   min -327.87  max 352.07
--   libs-shared/calculate-values.mjs:37-39 writes player_week_points - baseline
--   with no floor, so every NUMERIC week key including 0 is signed. Only 'ros' is
--   floored, by the `if (pts_added < 0) continue` in
--   libs-shared/calculate-player-values-rest-of-season.mjs:33-35. So the season
--   table's migrated column is the NET one and it has no positive counterpart to
--   migrate -- projected_points_added_positive is created here and left NULL for
--   the writer to fill on its next run.
--
-- The -999 floor in week='0' is libs-shared/constants/source-constants.mjs:104
--   `default_points_added`, assigned to every player the valuation could not
--   initialize. It migrates as-is rather than being nulled here: it is the value
--   the deployed readers see today, and changing it is a writer question, not a
--   migration question.
--
-- ONE MARKET SALARY, NOT TWO. Both 'ros' and 'ros_net' carry a market_salary,
--   because calculate-player-values-rest-of-season.mjs calls calculatePrices once
--   per aggregate key. The rest-of-season table takes the 'ros' one and drops the
--   'ros_net' one. calculate-prices.mjs:121-124 floors every price at zero, so a
--   salary priced off a signed aggregate asserts a signed variant it cannot carry
--   -- 23,783 of its 26,036 non-null values are already 0. This is the same call,
--   on the same reasoning, that dropped salary_adj_points_added_net from the
--   league_player period tables rather than renaming it.
--
-- THE HISTORY COLLAPSE IS AN AS-OF JOIN, NOT AN EQUALITY JOIN. Change-only
--   capture evaluates each week key independently, so 'ros' and 'ros_net' are not
--   written at paired instants and cannot be joined on observed_at. Measured
--   2026-08-26: 93,852 'ros' rows against 279,731 'ros_net', with only ~89,310
--   sharing an observed_at -- roughly 67 percent of 'ros_net' rows have no 'ros'
--   partner at all. 'ros' is floored at zero so it sits unchanged for long
--   stretches; 'ros_net' is signed and moves on nearly every recompute. A FULL
--   OUTER JOIN on observed_at would emit ~178,000 rows with a NULL positive
--   column, which is not a point-in-time record of anything. At instant T the
--   positive value is the LATEST 'ros' observation at or before T.
--
--   Note the base-table collapse further down is a different problem with a
--   different answer: that table holds exactly one row per (grain, week key), so
--   a FULL OUTER JOIN on the grain is correct there. Do not unify the two.
--
-- Grain: (pid, format_id, season_year) on the four period tables, plus
--   observed_at on the history table. Column types, the pid index and the
--   league_reader grant mirror the existing week tables exactly.
--
-- Identifier lengths were counted, not eyeballed: Postgres truncates at 63
--   SILENTLY, which is how two indexes collide on one truncated name.
--   league_format_player_rest_of_season_projection_values_history is 61, and its
--   two indexes only fit under the abbreviated idx_lf_player_* prefix the
--   existing history indexes already use -- 60 and 62 characters.
--
-- No BEGIN/COMMIT: yarn db:exec already wraps the file in one transaction.
-- STATUS: APPLIED 2026-08-26 against league_production

-- ---------------------------------------------------------------------------
-- Scoring-format period tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.scoring_format_player_season_projection_points (
    pid character varying(25) NOT NULL,
    scoring_format_id text NOT NULL,
    season_year smallint NOT NULL,
    projected_points_total numeric(5,2),
    CONSTRAINT scoring_format_player_season_projection_points_pkey
        UNIQUE (pid, scoring_format_id, season_year)
);

CREATE INDEX idx_scoring_format_player_season_projection_points_pid
    ON public.scoring_format_player_season_projection_points USING btree (pid);

GRANT SELECT ON TABLE public.scoring_format_player_season_projection_points TO league_reader;

CREATE TABLE public.scoring_format_player_rest_of_season_projection_points (
    pid character varying(25) NOT NULL,
    scoring_format_id text NOT NULL,
    season_year smallint NOT NULL,
    projected_points_total numeric(5,2),
    CONSTRAINT scoring_format_player_rest_of_season_projection_points_pkey
        UNIQUE (pid, scoring_format_id, season_year)
);

CREATE INDEX idx_scoring_format_player_rest_of_season_projection_points_pid
    ON public.scoring_format_player_rest_of_season_projection_points USING btree (pid);

GRANT SELECT ON TABLE public.scoring_format_player_rest_of_season_projection_points TO league_reader;

-- ---------------------------------------------------------------------------
-- League-format period tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.league_format_player_season_projection_values (
    pid character varying(25) NOT NULL,
    league_format_id text NOT NULL,
    season_year smallint NOT NULL,
    projected_points_added_positive numeric(7,2),
    projected_points_added_net numeric(7,2),
    market_salary numeric(6,2),
    CONSTRAINT league_format_player_season_projection_values_pkey
        UNIQUE (pid, league_format_id, season_year)
);

CREATE INDEX idx_league_format_player_season_projection_values_pid
    ON public.league_format_player_season_projection_values USING btree (pid);

GRANT SELECT ON TABLE public.league_format_player_season_projection_values TO league_reader;

CREATE TABLE public.league_format_player_rest_of_season_projection_values (
    pid character varying(25) NOT NULL,
    league_format_id text NOT NULL,
    season_year smallint NOT NULL,
    projected_points_added_positive numeric(7,2),
    projected_points_added_net numeric(7,2),
    market_salary numeric(6,2),
    CONSTRAINT league_format_player_rest_of_season_projection_values_pkey
        UNIQUE (pid, league_format_id, season_year)
);

CREATE INDEX idx_league_format_player_rest_of_season_projection_values_pid
    ON public.league_format_player_rest_of_season_projection_values USING btree (pid);

GRANT SELECT ON TABLE public.league_format_player_rest_of_season_projection_values TO league_reader;

-- ---------------------------------------------------------------------------
-- Rest-of-season history table
--
-- No season-period history table. The season table is already one row per
-- (pid, league_format_id, season_year) and the operator ruled 2026-08-26 that
-- its history is a single sealed value -- the final preseason observation. A
-- mirror would record exactly the preseason re-upserts that ruling discards.
-- Verified 2026-08-26 that discarding week-0 history is lossless: of its 29,058
-- latest-per-grain observations, 27,168 match a base week=0 row with ZERO value
-- or salary disagreement and all 1,890 unmatched are tombstones, so the sealed
-- value already lives in league_format_player_season_projection_values above.
-- The 5.4M week-0 history rows are dropped with the old table by the companion
-- adhoc, not migrated here.
-- ---------------------------------------------------------------------------

CREATE TABLE public.league_format_player_rest_of_season_projection_values_history (
    pid character varying(25) NOT NULL,
    league_format_id text NOT NULL,
    season_year smallint NOT NULL,
    projected_points_added_positive numeric(7,2),
    projected_points_added_net numeric(7,2),
    market_salary numeric(6,2),
    is_removed boolean DEFAULT false NOT NULL,
    observed_at timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX idx_lf_player_rest_of_season_projection_values_history_nat_key
    ON public.league_format_player_rest_of_season_projection_values_history
    USING btree (pid, league_format_id, season_year, observed_at);

CREATE INDEX idx_lf_player_rest_of_season_projection_values_history_as_of
    ON public.league_format_player_rest_of_season_projection_values_history
    USING btree (league_format_id, season_year, observed_at);

GRANT SELECT ON TABLE public.league_format_player_rest_of_season_projection_values_history TO league_reader;

-- ---------------------------------------------------------------------------
-- Migrate the scoring-format sentinels
-- ---------------------------------------------------------------------------

INSERT INTO public.scoring_format_player_season_projection_points
    (pid, scoring_format_id, season_year, projected_points_total)
SELECT pid, scoring_format_id, season_year, projected_points_total
FROM public.scoring_format_player_projection_points
WHERE week = '0';

INSERT INTO public.scoring_format_player_rest_of_season_projection_points
    (pid, scoring_format_id, season_year, projected_points_total)
SELECT pid, scoring_format_id, season_year, projected_points_total
FROM public.scoring_format_player_projection_points
WHERE week = 'ros';

-- ---------------------------------------------------------------------------
-- Migrate the league-format season sentinel
--
-- projected_points_added_positive is deliberately omitted from the column list:
-- week='0' carries the signed value only, so there is nothing to migrate into
-- the positive column and a copy would assert a variant the source cannot carry.
-- ---------------------------------------------------------------------------

INSERT INTO public.league_format_player_season_projection_values
    (pid, league_format_id, season_year, projected_points_added_net, market_salary)
SELECT pid, league_format_id, season_year, projected_points_added, market_salary
FROM public.league_format_player_projection_values
WHERE week = '0';

-- ---------------------------------------------------------------------------
-- Collapse the league-format rest-of-season pair
--
-- FULL OUTER JOIN on the grain, not an inner join: the base table holds exactly
-- one row per (grain, week key), but the two key populations differ -- 29,167
-- 'ros' rows against 27,810 'ros_net', and historical years carry 'ros' with no
-- 'ros_net' at all (2025 and 2023 each have one such format). An inner join
-- would silently drop those. Coalesce the key columns across both sides.
-- ---------------------------------------------------------------------------

INSERT INTO public.league_format_player_rest_of_season_projection_values
    (pid, league_format_id, season_year,
     projected_points_added_positive, projected_points_added_net, market_salary)
SELECT
    COALESCE(pos.pid, net.pid),
    COALESCE(pos.league_format_id, net.league_format_id),
    COALESCE(pos.season_year, net.season_year),
    pos.projected_points_added,
    net.projected_points_added,
    pos.market_salary
FROM (
    SELECT pid, league_format_id, season_year, projected_points_added, market_salary
    FROM public.league_format_player_projection_values
    WHERE week = 'ros'
) pos
FULL OUTER JOIN (
    SELECT pid, league_format_id, season_year, projected_points_added
    FROM public.league_format_player_projection_values
    WHERE week = 'ros_net'
) net
    ON  net.pid = pos.pid
    AND net.league_format_id = pos.league_format_id
    AND net.season_year = pos.season_year;

-- ---------------------------------------------------------------------------
-- Collapse the rest-of-season history pair, AS-OF
--
-- The instant set is the UNION of both week keys' observed_at values per grain:
-- an instant where only the net moved is a real observation and must survive.
-- At each instant, each side resolves to its latest observation at or before
-- that instant, which is what makes this a point-in-time record rather than a
-- sparse outer join. Rows before a side's first observation resolve to NULL on
-- that side, which is correct -- the value genuinely did not exist yet.
-- ---------------------------------------------------------------------------

INSERT INTO public.league_format_player_rest_of_season_projection_values_history
    (pid, league_format_id, season_year,
     projected_points_added_positive, projected_points_added_net,
     market_salary, is_removed, observed_at)
SELECT
    i.pid,
    i.league_format_id,
    i.season_year,
    pos.projected_points_added,
    net.projected_points_added,
    pos.market_salary,
    COALESCE(pos.is_removed, net.is_removed, false),
    i.observed_at
FROM (
    SELECT DISTINCT pid, league_format_id, season_year, observed_at
    FROM public.league_format_player_projection_values_history
    WHERE week IN ('ros', 'ros_net')
) i
LEFT JOIN LATERAL (
    SELECT h.projected_points_added, h.market_salary, h.is_removed
    FROM public.league_format_player_projection_values_history h
    WHERE h.week = 'ros'
      AND h.pid = i.pid
      AND h.league_format_id = i.league_format_id
      AND h.season_year = i.season_year
      AND h.observed_at <= i.observed_at
    ORDER BY h.observed_at DESC
    LIMIT 1
) pos ON true
LEFT JOIN LATERAL (
    SELECT h.projected_points_added, h.is_removed
    FROM public.league_format_player_projection_values_history h
    WHERE h.week = 'ros_net'
      AND h.pid = i.pid
      AND h.league_format_id = i.league_format_id
      AND h.season_year = i.season_year
      AND h.observed_at <= i.observed_at
    ORDER BY h.observed_at DESC
    LIMIT 1
) net ON true;

-- ---------------------------------------------------------------------------
-- Assert every migration against the SOURCE counts rather than against literals.
--
-- The row counts move whenever the pipeline runs, so a hardcoded expectation
-- would go stale between authoring this file and applying it. The failure this
-- guards is a silent partial migration, which otherwise looks like success.
--
-- The two collapses need computed oracles rather than a plain source count:
--   base    -- the FULL OUTER JOIN emits one row per DISTINCT grain across both
--              week keys, so the oracle is that distinct-grain count.
--   history -- the as-of join emits one row per DISTINCT (grain, observed_at)
--              across both week keys, so the oracle is that distinct count. A
--              cross-product from a mis-specified join inflates past it; the
--              equality join this replaces would fall short of it.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    src bigint;
    dst bigint;
BEGIN
    SELECT count(*) INTO src
        FROM public.scoring_format_player_projection_points WHERE week = '0';
    SELECT count(*) INTO dst
        FROM public.scoring_format_player_season_projection_points;
    IF dst <> src THEN
        RAISE EXCEPTION 'scoring-format season mismatch: % source rows, % migrated', src, dst;
    END IF;

    SELECT count(*) INTO src
        FROM public.scoring_format_player_projection_points WHERE week = 'ros';
    SELECT count(*) INTO dst
        FROM public.scoring_format_player_rest_of_season_projection_points;
    IF dst <> src THEN
        RAISE EXCEPTION 'scoring-format rest-of-season mismatch: % source rows, % migrated', src, dst;
    END IF;

    SELECT count(*) INTO src
        FROM public.league_format_player_projection_values WHERE week = '0';
    SELECT count(*) INTO dst
        FROM public.league_format_player_season_projection_values;
    IF dst <> src THEN
        RAISE EXCEPTION 'league-format season mismatch: % source rows, % migrated', src, dst;
    END IF;

    SELECT count(DISTINCT (pid, league_format_id, season_year)) INTO src
        FROM public.league_format_player_projection_values
        WHERE week IN ('ros', 'ros_net');
    SELECT count(*) INTO dst
        FROM public.league_format_player_rest_of_season_projection_values;
    IF dst <> src THEN
        RAISE EXCEPTION 'league-format rest-of-season collapse mismatch: % distinct source grains, % migrated', src, dst;
    END IF;

    SELECT count(DISTINCT (pid, league_format_id, season_year, observed_at)) INTO src
        FROM public.league_format_player_projection_values_history
        WHERE week IN ('ros', 'ros_net');
    SELECT count(*) INTO dst
        FROM public.league_format_player_rest_of_season_projection_values_history;
    IF dst <> src THEN
        RAISE EXCEPTION 'rest-of-season history collapse mismatch: % distinct source instants, % migrated', src, dst;
    END IF;

    RAISE NOTICE 'all five period migrations matched their source oracles';
END $$;

ANALYZE public.scoring_format_player_season_projection_points;
ANALYZE public.scoring_format_player_rest_of_season_projection_points;
ANALYZE public.league_format_player_season_projection_values;
ANALYZE public.league_format_player_rest_of_season_projection_values;
ANALYZE public.league_format_player_rest_of_season_projection_values_history;
