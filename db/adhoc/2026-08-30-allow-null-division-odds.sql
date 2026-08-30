-- STATUS: APPLIED 2026-08-30 against league_production
--
-- league_team_forecast.division_odds must be allowed to be absent.
--
-- The column has been NOT NULL since it was created, which is why the season
-- forecast wrote the bye flag into it rather than leaving it empty -- a league
-- with no Divisions has no division title to forecast, and a 0 there is a claim
-- the team lost one. League 1 is undivided at ten teams (Article V Section 13
-- subsection (a)), so this is the live case, not a hypothetical.
--
-- Consumers already tolerate null: api/swagger/config.mjs declares it
-- nullable: true, app/core/teams/team.js defaults it to null, and the API
-- serializer at api/routes/leagues/teams.mjs passes it through unchanged. The
-- three sibling _with_win / _with_loss division columns are already nullable.
--
-- Existing rows keep their values; nothing is backfilled to null, because a
-- historical row's stored number is what that forecast reported at the time.

ALTER TABLE public.league_team_forecast
  ALTER COLUMN division_odds DROP NOT NULL;
