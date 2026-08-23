-- STATUS: APPLIED 2026-08-23 against league_production
--
-- Backfill prop_markets_index.season_year from the game the row is already
-- linked to.
--
-- Three importers never wrote season_year at all: Caesars
-- (private/scripts/import-caesars-odds-v4.mjs), BetMGM
-- (private/scripts/import-betmgm-odds.mjs) and BetRivers, which is dormant
-- (last observation 2024-07-17) and so is repaired here but not in code.
-- DraftKings and FanDuel write it today; their NULLs predate the column. Every
-- one of these rows resolved an esbid correctly, so the season is present in
-- the row's own join target and was simply never copied across.
--
-- The consequence is not a blank column, it is invisibility. Consumers filter
-- markets by season_year (api/routes/markets.mjs year filter,
-- libs-server/data-views-column-definitions/player-betting-market-column-definitions.mjs,
-- libs-server/prop-market-settlement/prop-market-utils.mjs), and several join
-- nfl_games on esbid AND season_year together -- so a NULL drops the row from
-- an inner join silently rather than surfacing as a missing value. All 451,674
-- Caesars rows and all 58,168 BetMGM rows have been unreachable through every
-- one of those paths for their whole lives.
--
-- The derivation is exact rather than inferred: season_year is functionally
-- determined by esbid (a game belongs to exactly one season), which is the same
-- reasoning that kept season_year out of
-- idx_prop_markets_index_esbid_time_type. Checked before writing this: of the
-- ~1.4M rows carrying BOTH an esbid and a season_year, ZERO disagree with
-- nfl_games.season_year, so the rule being applied here already holds
-- everywhere it can be observed.
--
-- Scope is exactly the rows with an esbid. A row with no esbid has no honest
-- source for a season and is deliberately left NULL -- do not reach for
-- observed_at as a substitute, since futures markets are observed year-round
-- and would be assigned a season by the accident of when they were scraped.
--
-- Expected: 210,731 rows at time of writing (BETRIVERS 82,671, DRAFTKINGS
-- 57,312, CAESARS 31,303, FANDUEL 24,017, BETMGM 15,428). The count may drift
-- upward before this is applied, since the Caesars and BetMGM importers keep
-- writing NULLs until their fix deploys.

UPDATE public.prop_markets_index p
SET season_year = g.season_year
FROM public.nfl_games g
WHERE g.esbid = p.esbid
  AND p.season_year IS NULL;
