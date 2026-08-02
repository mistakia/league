-- STATUS: PENDING
--
-- Make the playoff format per-league configuration instead of constants baked
-- into shared code.
--
-- Field size, bye count and whether division winners are guaranteed a berth
-- were hardcoded across libs-shared/calculate-standings.mjs,
-- libs-server/simulation/simulate-season-forecast.mjs and app/core/selectors.js
-- as league 1's rules. They belong on `seasons`, which is already the
-- per-league-per-year format table and already carries wildcard_round and
-- championship_round.
--
-- Not on `league_formats`: that table is a shared, deduplicated catalog whose
-- UNIQUE config tuple IS its identity, so adding columns there would re-key
-- every existing format.
--
-- Defaults reproduce the shape every hosted league runs today (6-team field,
-- 2 byes), so applying this is a no-op for current behavior.
-- division_winners_qualify defaults to false, matching what the code did in
-- practice: the previous implementation guaranteed division leaders berths only
-- as an artifact of a 2-division assumption, and no league relied on it at any
-- other division count.

ALTER TABLE public.seasons
  ADD COLUMN playoff_team_count smallint DEFAULT 6 NOT NULL,
  ADD COLUMN bye_count smallint DEFAULT 2 NOT NULL,
  ADD COLUMN division_winners_qualify boolean DEFAULT false NOT NULL;

ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_bye_count_within_playoff_field
  CHECK (bye_count >= 0 AND bye_count <= playoff_team_count);

COMMENT ON COLUMN public.seasons.playoff_team_count IS 'Number of teams that qualify for the post-season.';
COMMENT ON COLUMN public.seasons.bye_count IS 'How many of the top seeds skip the first playoff round.';
COMMENT ON COLUMN public.seasons.division_winners_qualify IS 'When true, each division winner is guaranteed a playoff berth ahead of better-recorded non-winners; when false, seeding ignores divisions entirely.';
