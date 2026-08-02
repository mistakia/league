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
-- Bye selection is two axes, not one. Which teams are eligible for a bye
-- (bye_candidate_pool) is independent of what ladder ranks them
-- (bye_selection_method), and neither is expressible as a comparator over the
-- whole league. A league can restrict byes to division winners while still
-- seeding the rest of its field on overall record.
--
-- Text with a CHECK rather than an enum type: ALTER TYPE ... ADD VALUE is the
-- pattern the adp_format dimension was built to eliminate, and a new pool or
-- method should be a one-line constraint change.
--
-- Defaults reproduce the shape every hosted league runs today -- 6-team field,
-- 2 byes, byes to the top of the whole league on head-to-head record, no
-- division-winner guarantee -- so applying this is a no-op for current
-- behavior. A league that wants All Play byes or division-winner byes sets
-- them explicitly.

ALTER TABLE public.seasons
  ADD COLUMN playoff_team_count smallint DEFAULT 6 NOT NULL,
  ADD COLUMN bye_count smallint DEFAULT 2 NOT NULL,
  ADD COLUMN bye_candidate_pool text DEFAULT 'league' NOT NULL,
  ADD COLUMN bye_selection_method text DEFAULT 'head_to_head' NOT NULL,
  ADD COLUMN at_large_selection_method text DEFAULT 'head_to_head' NOT NULL,
  ADD COLUMN has_division_winner_berths boolean DEFAULT false NOT NULL;

ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_bye_count_within_playoff_field
  CHECK (bye_count >= 0 AND bye_count <= playoff_team_count);

ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_bye_candidate_pool_known
  CHECK (bye_candidate_pool IN ('league', 'division_winners'));

ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_bye_selection_method_known
  CHECK (bye_selection_method IN ('head_to_head', 'all_play'));

ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_at_large_selection_method_known
  CHECK (at_large_selection_method IN ('head_to_head', 'all_play', 'points_for'));

COMMENT ON COLUMN public.seasons.playoff_team_count IS 'Number of teams that qualify for the post-season.';
COMMENT ON COLUMN public.seasons.bye_count IS 'How many of the top seeds skip the first playoff round.';
COMMENT ON COLUMN public.seasons.bye_candidate_pool IS 'Which teams are eligible for a bye: the whole league, or one winner per division.';
COMMENT ON COLUMN public.seasons.bye_selection_method IS 'Ladder that ranks the bye candidates: head-to-head record, or All Play win percentage.';
COMMENT ON COLUMN public.seasons.has_division_winner_berths IS 'When true, every division winner is guaranteed a place in the playoff field (a berth, not a seed); when false, berths are won on record alone.';
