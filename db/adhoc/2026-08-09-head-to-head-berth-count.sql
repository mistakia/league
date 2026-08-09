-- STATUS: APPLIED 2026-08-09 against league_production
--
-- Add a record-berth step between the division-winner guarantee and the
-- at-large ladder.
--
-- The 2026-08-02 playoff format columns can express "division winners are
-- berthed, then the rest go on points for" and nothing between. That is a
-- silent hole in a league with no divisions: the guarantee selects nobody, so
-- EVERY place below the byes falls through to the at-large metric and a team
-- can lead the league in head-to-head record and miss the post-season
-- entirely. head_to_head_berth_count is how many of those places go to the
-- best remaining teams on the standings ladder first.
--
-- A count rather than a "where there are no divisions" rule, because the
-- format columns are per-league configuration and the code must serve any
-- league. A league whose divisions already carry the claim on record leaves
-- this at 0, which is the default and reproduces today's behavior exactly.
--
-- smallint with a CHECK against the places below the byes rather than a
-- trigger: the same shape as seasons_bye_count_within_playoff_field, and
-- get_playoff_seeding throws on the pair, so an unconstrained value would
-- reach the standings run as a blanked page rather than a rejected write.

ALTER TABLE public.seasons
  ADD COLUMN head_to_head_berth_count smallint DEFAULT 0 NOT NULL;

ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_head_to_head_berth_count_within_field
  CHECK (
    head_to_head_berth_count >= 0
    AND head_to_head_berth_count <= playoff_team_count - bye_count
  );

COMMENT ON COLUMN public.seasons.head_to_head_berth_count IS 'How many places below the byes go to the best remaining teams on the standings ladder before the at-large ladder fills the rest.';

-- League 1, 2026: Amendment XL Article XVI Section 3(b) gives two of the four
-- wildcard berths to the highest head-to-head records where the LEAGUE has no
-- Divisions, and the last two to Total Points For.
UPDATE public.seasons
  SET head_to_head_berth_count = 2
  WHERE lid = 1 AND season_year = 2026;
