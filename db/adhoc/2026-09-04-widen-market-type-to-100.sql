-- STATUS: APPLIED 2026-09-04 against league_production
--
-- Widen market_type to 100 characters, because the vocabulary already exceeds
-- the column.
--
-- `season_high_totals_types` carries two constants at 51 characters --
-- SEASON_LEAGUE_HIGH_SINGLE_GAME_RECEIVING_TOUCHDOWNS and
-- SEASON_LEAGUE_HIGH_SINGLE_GAME_INTERCEPTIONS_THROWN, both also present in
-- player_prop_types -- against a varchar(50). Any write of either fails the
-- whole insert with "value too long for type character varying(50)", which
-- takes the entire Caesars import down rather than the one market: the index
-- rows go in as a single multi-row insert.
--
-- It had never fired because the only Caesars tab publishing those templates
-- was one of ten whose fetch failed on an unrelated cache-key defect, fixed in
-- the commit this file ships with. That is the second time in this task a fix
-- has unmasked a latent fault rather than caused one -- the first being the
-- cache-key correction that turned a silent two-season futures gap into a hard
-- importer outage.
--
-- 100 rather than 51: the bound should sit clear of the vocabulary rather than
-- flush against its current longest member, or the next honest constant name
-- reopens this. Widening a varchar is a catalog-only change in Postgres and
-- rewrites no rows, so no statement_timeout override is needed here.
--
-- Both columns move together. Leaving the analysis cache narrow would only move
-- the same failure downstream to whatever next writes one of these types into
-- it.

ALTER TABLE prop_markets_index
  ALTER COLUMN market_type TYPE character varying(100);

ALTER TABLE weekly_market_selections_analysis_cache
  ALTER COLUMN market_type TYPE character varying(100);
