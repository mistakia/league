-- STATUS: APPLIED 2026-08-15 against league_production
--
-- Add the draft-pick half of a team's dynasty trade value to
-- league_team_daily_values.
--
-- ktc_value / ktc_share keep their existing meaning -- the value of a team's
-- PLAYERS and that team's share of the day's player total. The SPA reads
-- ktc_share directly (app/core/selectors.js), so redefining it in place would
-- silently change what that chart is showing.
--
-- pick_value is the same point-in-time keeptradecut valuation applied to the
-- picks the team holds that day, total_value is the sum of the two, and
-- total_share is the team's share of the day's total. total_share is the
-- Article XXII deposit divisor: it is the one that prices a rebuilding team
-- holding three first-rounders as the asset-rich team it is.
--
-- total_share is numeric(6,5) rather than numeric(5,5) for the reason
-- ktc_share already is -- scale equal to precision cannot represent 1.0, and a
-- day on which a single team holds all the value produces exactly that.

ALTER TABLE public.league_team_daily_values
  ADD COLUMN pick_value integer,
  ADD COLUMN total_value integer,
  ADD COLUMN total_share numeric(6,5);

COMMENT ON COLUMN public.league_team_daily_values.ktc_value IS 'Sum of the keeptradecut value of the team''s PLAYERS at the end of this date. Excludes draft picks; see pick_value.';
COMMENT ON COLUMN public.league_team_daily_values.ktc_share IS 'This team''s share of the day''s player-only total. Excludes draft picks; see total_share.';
COMMENT ON COLUMN public.league_team_daily_values.pick_value IS 'Sum of the keeptradecut value of the draft picks the team holds at the end of this date. Ownership comes from roster_asset_holding; rounds 5 and beyond have no keeptradecut series and contribute zero.';
COMMENT ON COLUMN public.league_team_daily_values.total_value IS 'ktc_value + pick_value: the team''s whole dynasty trade value for this date.';
COMMENT ON COLUMN public.league_team_daily_values.total_share IS 'This team''s share of the day''s total_value across the league. The Article XXII deposit divisor.';
