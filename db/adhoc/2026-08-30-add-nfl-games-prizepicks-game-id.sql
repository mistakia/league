-- STATUS: APPLIED 2026-08-30 against league_production
-- Add nfl_games.prizepicks_game_id, the crosswalk from PrizePicks' own game
-- identifier to our game row.
--
-- WHY: prop_markets_index.esbid is currently re-derived from ambient state on
-- every PrizePicks import -- the games of current_season.nfl_seas_week, matched
-- to a market by the player's CURRENT team -- and then overwritten in place.
-- Both inputs move after first observation, so a market re-observed in a later
-- week, or belonging to a traded player, is re-stamped onto a different game.
-- 9,160 markets carry a different esbid on their OPEN row than on their CLOSE
-- row as a result, and settlement grades against whichever stamp was last
-- written. Persisting the book's own game id removes the ambient derivation:
-- the import looks the game up by an identifier that does not move.
--
-- WHY A COLUMN ON nfl_games rather than a crosswalk table: nfl_games already
-- carries eleven vendor game-id columns (gsis_game_id, nflverse_game_id,
-- espn_game_id, ngs_game_id, shield_game_id, detail_v3_game_id,
-- detail_v1_game_id, pfr_game_id, sportradar_game_id, pff_game_id, and esbid
-- itself). A twelfth conforms; a separate table would be the only mapping of
-- its kind held outside the game row. The one asymmetry worth naming is that
-- the existing eleven are data PROVIDERS and PrizePicks is a BOOK -- but the
-- pattern is "an external system's identifier for this game", and only
-- PrizePicks needs one because only PrizePicks lacks a usable event-to-game
-- mapping. Generalize if a second book ever needs it, not before.
--
-- UNIQUE, unlike its peers. nflverse_game_id and sportradar_game_id carry plain
-- btree indexes, but this column is READ as a resolver -- the import looks a
-- game up by it and stamps the result onto a market -- so two games sharing one
-- PrizePicks id is precisely the corruption this task exists to stop, and the
-- index is what makes it unrepresentable rather than merely unlikely. NULLs do
-- not collide in Postgres, so the 14,900-odd unmapped rows are unaffected.
--
-- Nullable with no default, and null means "no crosswalk entry" -- the importer
-- falls back to the existing team-based match and writes the resolution back.
-- The backfill is therefore allowed to be incomplete; see the companion file
-- 2026-08-30-backfill-nfl-games-prizepicks-game-id.sql for the 685 entries it
-- populates and the ten event ids it deliberately leaves null.
--
-- Cheap: 15,622 rows and 8.7 MB. Adding a nullable column with no default is a
-- catalog-only change in Postgres 11+, so there is no table rewrite, and the
-- index build over 15.6k rows needs no non-blocking build strategy.
--
-- Ships with the schema dump, the regenerated types, scripts/import-prizepicks-odds.mjs
-- and libs-server/insert-prop-markets.mjs, per the repo rule that DDL, the
-- export and the dependent code land in one commit.

alter table nfl_games add column prizepicks_game_id character varying;

create unique index nfl_games_prizepicks_game_id_idx
  on nfl_games (prizepicks_game_id);

comment on column nfl_games.prizepicks_game_id is
  'PrizePicks'' own identifier for this game, as carried on a projection''s attributes.game_id (for example NFL_game_O0Bbd8YaAfhi417H0Zeb0wTF). Resolves a prop market to its game without re-deriving from the current week and the player''s current team. Null means no crosswalk entry and the importer falls back to the team-based match.';
