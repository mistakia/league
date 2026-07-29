-- STATUS: APPLIED 2026-07-29 against league_production
--
-- Add external_leagues.has_individual_defensive_players and backfill it from
-- the retained roster_positions payload.
--
-- PURPOSE. This is an EXCLUSION criterion for the value fit, not a curiosity,
-- which is why it earns a promoted column rather than being re-derived from
-- jsonb at every read. Individual defensive players (DT, DB, LB) are largely
-- absent from our player table, so their trade legs land with a NULL pid. An
-- unresolved leg is not merely incomplete, it is BIASED: the side whose
-- received bundle is missing a player looks cheaper than it actually was, and
-- that error runs in one direction only, so it does not average out across
-- trades the way symmetric noise would. Feeding IDP leagues into the fit
-- therefore skews the scale rather than just widening its error bars.
--
-- WHY A COLUMN RATHER THAN A jsonb PREDICATE. roster_positions is retained
-- precisely so a dimension we did not think to promote can be derived later --
-- this is that case arriving. The selection query runs on every import run and
-- wants a plain boolean it can index; a jsonb_array_elements_text scan in the
-- appetite filter would be re-evaluated per row per run forever. Derived once
-- at parse time by derive_has_individual_defensive_players, and backfilled here
-- from the payloads already stored, so no league has to be re-fetched.
--
-- NOT NULL DEFAULT false is safe: the backfill below sets every existing row
-- from its own retained payload, and every future row is written by the parser.
--
-- yarn db:exec db/adhoc/2026-07-29-add-external-leagues-idp-flag.sql
-- yarn export:schema

ALTER TABLE public.external_leagues
  ADD COLUMN has_individual_defensive_players boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.external_leagues.has_individual_defensive_players IS
  'League starts individual defensive players. Excluded from the value fit: IDP legs resolve to a NULL pid, which biases the affected side cheap in a one-directional way.';

-- Mirrors INDIVIDUAL_DEFENSIVE_PLAYER_SLOTS in
-- libs-server/external-league-trades/sleeper-trade-parser.mjs. COALESCE guards
-- the rows whose payload predates the column being retained.
UPDATE public.external_leagues
SET has_individual_defensive_players = EXISTS (
  SELECT 1
  FROM jsonb_array_elements_text(COALESCE(roster_positions, '[]'::jsonb)) AS slot
  WHERE slot IN ('DL', 'LB', 'DB', 'DE', 'DT', 'CB', 'SS', 'FS', 'IDP_FLEX')
);

-- Serves the import-selection appetite filter, which reads dynasty +
-- superflex-matching + non-IDP + non-best-ball leagues that are not yet synced.
CREATE INDEX idx_external_leagues_import_appetite
  ON public.external_leagues (
    platform,
    league_format,
    is_superflex,
    has_individual_defensive_players,
    is_best_ball
  );
