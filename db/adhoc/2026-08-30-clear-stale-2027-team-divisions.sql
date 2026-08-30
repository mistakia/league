-- STATUS: APPLIED 2026-08-30 against league_production
--
-- Clear the 2027 division assignments for league 1.
--
-- The 2027 teams rows carry divisions 1 and 2 with five teams each, carried
-- over from a clear that covered 2026 only -- and there is no 2027 seasons row
-- at all. At ten teams Article V Section 13 subsection (a) says the LEAGUE has
-- no Divisions, so this data contradicts the constitution for a season that has
-- not been configured.
--
-- Left in place it is not inert. Now that the season forecast derives real
-- division winners rather than aliasing the bye flag, a 2027 forecast would
-- read two divisions off these rows and publish a non-null division_odds for a
-- season that has none.
--
-- AUTHORIZED by the operator 2026-08-30: the rows are stale and 2027 is
-- unsettled.
--
-- Reversible by re-running generate-seasons for 2027 once that season's format
-- is actually decided.

UPDATE public.teams
   SET division = NULL
 WHERE lid = 1
   AND season_year = 2027
   AND division IS NOT NULL;
