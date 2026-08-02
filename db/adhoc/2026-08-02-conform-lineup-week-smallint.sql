-- STATUS: APPLIED 2026-08-02 against league_production
--
-- Conform the lineup week columns to smallint, matching their sibling
-- league_team_lineups.week.
--
-- DEFECT: scripts/project-lineups.mjs writes three sibling tables in one pass, and
-- they disagree on the type of `week`:
--
--   league_team_lineups.week                    smallint
--   league_team_lineup_starters.week            character varying(3)
--   league_team_lineup_contribution_weeks.week  character varying(3)
--
-- The disagreement has produced two live bugs, both silent:
--
--   1. libs-server/get-league-rosters-from-database.mjs matches starters to lineups
--      with `l.week === lineup.week`. pg hands back a JS number for the smallint and
--      a JS string for the varchar, so the strict compare is ALWAYS false and every
--      roster payload carries `starter_pids: []`. Confirmed live 2026-08-02 against
--      1,411 starter rows for lid=1/year=2026.
--   2. The same file filters starters with `.where('week', '>=', min_week)`. The bound
--      parameter is untyped, so pg resolves the comparison as TEXT: '10' >= '2' is
--      false. The week floor has been silently wrong for every multi-digit week.
--
-- Fixing either in JS means coercing at the read site -- a shim over a schema defect
-- that would have to be repeated at every future read. Conform the columns instead.
--
-- SAFETY: every value in both columns is a plain integer week (verified 2026-08-02:
-- '1'..'17' only, no 'ros'/'0' sentinels -- optimizeLineup emits a numeric week range),
-- so the USING cast cannot fail. No view or matview depends on either table. The two
-- unique indexes (idx_24680_contribution, idx_24686_starter) are rebuilt by ALTER TYPE
-- automatically; both keep week as their trailing key column.
--
-- Runs via `yarn db:exec` as one transaction; a cast failure rolls the whole thing back.

ALTER TABLE public.league_team_lineup_starters
  ALTER COLUMN week TYPE smallint USING week::smallint;

ALTER TABLE public.league_team_lineup_contribution_weeks
  ALTER COLUMN week TYPE smallint USING week::smallint;
