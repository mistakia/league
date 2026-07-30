-- Hoist the period sentinels out of league_player_projection_values.week into
-- dedicated period tables. ADDITIVE HALF ONLY -- this file creates the two new
-- tables and migrates the existing sentinel rows into them. It does NOT drop
-- market_salary_adj, does NOT delete the sentinel rows, and does NOT narrow
-- week. Those are destructive and live in the companion adhoc that runs AFTER
-- the reader/writer sweep is deployed.
--
-- Why split in two: the league CLAUDE.md apply-to-commit-window rule says a drop
--   removes something committed code still names, so the sweep must ship first.
--   But the sweep cannot ship first here, because the new readers have nothing to
--   read until these tables exist. Additive-first resolves the circularity: a
--   schema that is a superset of what the code needs breaks nothing, so this file
--   is safe to land and deploy against at any time.
--
-- The defect being removed: week is character varying(3) and encodes two
--   non-week periods as literal strings -- '0' (season snapshot) and 'ros'
--   (rest of season) -- alongside numeric weeks 1..18. Measured in
--   league_production 2026-07-30:
--     week='0'   1,015 rows  salary_adj_pts_added non-null, market_salary_adj non-null
--     week='ros' 1,719 rows  salary_adj_pts_added non-null, market_salary_adj NULL
--     week 1..18            salary_adj_pts_added non-null, market_salary_adj NULL
--   market_salary_adj is therefore a sparse sentinel-only column: meaningful on
--   exactly one week value and NULL on the other ~31,000 rows. It is not
--   duplicated across weeks -- an earlier analysis reported ~19x redundancy from a
--   COUNT(DISTINCT) test that ignores NULLs and so cannot tell a duplicated value
--   from a sparse one. The writer gates it explicitly
--   (scripts/process-projections.mjs:514-516) and the reader matches
--   (libs-server/get-players.mjs:427-428).
--
-- These rows are NOT dead data, contrary to an earlier finding that authorized
--   deleting them. That finding proved only that the DATA-VIEW path cannot reach
--   week='ros' -- make_league_player_projection_source pins week to a numeric
--   String(week) -- and generalized from there. The API PAYLOAD path is separate
--   and live: get-players.mjs:425 assigns salary_adj_pts_added[week] with a
--   dynamic week key, so the payload carries '0' and 'ros', and
--   app/views/components/trade-player/trade-player.js:31-33 renders the 'ros'
--   value unconditionally on /trade during the regular season. Both sentinels
--   therefore MIGRATE here rather than being deleted.
--
-- One deliberate exception. Of the 1,719 week='ros' rows, 1,015 are (lid=1,
--   year=2026) and 704 are (lid=0, year=2023). lid=0 is the pseudo-league used
--   for the no-league prewarm (api/routes/players.mjs:17-19), 2023 has no
--   week='0' row at all, and get-players filters to current_season.year
--   (:417-419), so those 704 rows are unreachable through every surface. They are
--   dropped rather than carried into a new table -- operator-approved 2026-07-30.
--   They are left in place by this file and removed by the companion adhoc's
--   sentinel DELETE, so nothing is destroyed until that runs.
--
-- Grain: (pid, lid, year) on both new tables -- no week column. Column types and
--   the pid index mirror the existing week table exactly. Note the SELECT grant
--   target on this table family is league_reader, not league_readonly.
--
-- No BEGIN/COMMIT: yarn db:exec already wraps the file in one transaction.
-- STATUS: APPLIED 2026-07-30 against league_production

CREATE TABLE public.league_player_season_projection_values (
    pid character varying(25),
    lid integer NOT NULL,
    year smallint,
    salary_adj_pts_added numeric(5,2),
    market_salary_adj numeric(6,2),
    CONSTRAINT league_player_season_projection_values_pkey
        UNIQUE (pid, lid, year)
);

CREATE INDEX idx_league_player_season_projection_values_pid
    ON public.league_player_season_projection_values USING btree (pid);

GRANT SELECT ON TABLE public.league_player_season_projection_values TO league_reader;

-- market_salary_adj is intentionally absent: it is non-null only on the week='0'
-- season row, so rest-of-season has no such value to carry.
CREATE TABLE public.league_player_rest_of_season_projection_values (
    pid character varying(25),
    lid integer NOT NULL,
    year smallint,
    salary_adj_pts_added numeric(5,2),
    CONSTRAINT league_player_rest_of_season_projection_values_pkey
        UNIQUE (pid, lid, year)
);

CREATE INDEX idx_league_player_rest_of_season_projection_values_pid
    ON public.league_player_rest_of_season_projection_values USING btree (pid);

GRANT SELECT ON TABLE public.league_player_rest_of_season_projection_values TO league_reader;

INSERT INTO public.league_player_season_projection_values
    (pid, lid, year, salary_adj_pts_added, market_salary_adj)
SELECT pid, lid, year, salary_adj_pts_added, market_salary_adj
FROM public.league_player_projection_values
WHERE week = '0';

INSERT INTO public.league_player_rest_of_season_projection_values
    (pid, lid, year, salary_adj_pts_added)
SELECT pid, lid, year, salary_adj_pts_added
FROM public.league_player_projection_values
WHERE week = 'ros'
  AND NOT (lid = 0 AND year = 2023);

-- Assert the migration against the SOURCE counts rather than against literals.
-- The row counts here move whenever the pipeline runs, so a hardcoded expectation
-- would go stale between authoring this file and applying it. The failure this
-- guards is a silent partial migration, which otherwise looks like success.
DO $$
DECLARE
    src_season   bigint;
    dst_season   bigint;
    src_ros      bigint;
    dst_ros      bigint;
    abandoned    bigint;
BEGIN
    SELECT count(*) INTO src_season
        FROM public.league_player_projection_values WHERE week = '0';
    SELECT count(*) INTO dst_season
        FROM public.league_player_season_projection_values;

    SELECT count(*) INTO src_ros
        FROM public.league_player_projection_values WHERE week = 'ros';
    SELECT count(*) INTO abandoned
        FROM public.league_player_projection_values
        WHERE week = 'ros' AND lid = 0 AND year = 2023;
    SELECT count(*) INTO dst_ros
        FROM public.league_player_rest_of_season_projection_values;

    IF dst_season <> src_season THEN
        RAISE EXCEPTION
            'season migration mismatch: % source week=0 rows, % migrated',
            src_season, dst_season;
    END IF;

    IF dst_ros <> src_ros - abandoned THEN
        RAISE EXCEPTION
            'rest-of-season migration mismatch: % source ros rows less % abandoned = % expected, % migrated',
            src_ros, abandoned, src_ros - abandoned, dst_ros;
    END IF;

    RAISE NOTICE 'migrated % season rows and % rest-of-season rows (% abandoned lid=0 year=2023 rows deliberately not carried)',
        dst_season, dst_ros, abandoned;
END $$;
