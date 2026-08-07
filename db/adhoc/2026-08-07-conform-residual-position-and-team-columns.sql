-- Conform the residual reserved-word and ambiguous-team columns
-- STATUS: PENDING
--
-- Two settled precedents, no new naming decisions:
--
--   position -> player_position   ruled 2026-07-25 (262f91d7) and applied to the
--                                 betting family in
--                                 db/adhoc/2026-07-25-conform-betting-position-to-player-position.sql
--   team     -> nfl_team          ruled in the nfl_games dimension cluster, which
--                                 moved nfl_game_coaches.team the same way
--
-- db:exec wraps the whole file in one transaction, so there is no BEGIN/COMMIT
-- here. An explicit COMMIT would end the OUTER transaction early and drop
-- rollback for everything after it.
--
-- ---------------------------------------------------------------------------
-- SIX RENAMES, NOT SEVEN. pff_unresolved_players.position is deliberately NOT
-- in this file.
-- ---------------------------------------------------------------------------
--
-- That column is a ruled exemption from the position vocabulary, recorded in
-- db/adhoc/2026-08-04-constrain-position-vocabulary.sql:
--
--     pff_unresolved_players.position  staging table for players PFF could not
--                                      resolve; its ST is a special-teams
--                                      catch-all, not a position
--
-- Production data confirms it. Of 5,551 rows the column holds ST (16), and the
-- unnormalised vendor spellings DI (494), ED (354) and HB (243) -- 1,123 rows
-- outside the 25-value vocabulary. Its writer
-- (private/libs-server/pff-archive.mjs log_unresolved_player) stores the raw
-- vendor string with no normalize_position call, which is the point of the
-- table: it records what PFF emitted for a player the resolver could not match.
--
-- So the column does not hold a canonical player position, and naming it
-- player_position would assert a vocabulary it does not carry. The table
-- already spells the raw-vendor/canonical split as pff_nfl_team vs nfl_team, so
-- the consistent target is pff_position -- but that is a NEW name, not a
-- settled precedent, and it needs an operator ruling. Held out pending that.
-- The reserved_word finding on that column therefore survives this apply.
--
-- No CHECK constraint is added anywhere in this file. Five of the six
-- position columns already carry the vocabulary CHECK (added 2026-08-04); the
-- sixth is the exemption above. Adding it there would fail on 1,123 rows, and
-- widening the vocabulary to accommodate vendor spellings is the wrong remedy.
--
-- ---------------------------------------------------------------------------
-- Scope and safety
-- ---------------------------------------------------------------------------
--
-- Pure metadata renames. No index, view, materialized view, trigger, foreign
-- key or PL/pgSQL function body references any of these seven columns --
-- verified against all 13 function bodies and all 4 views in the dump. The
-- CHECK constraints are the only dependent objects, and they are renamed
-- alongside their columns so the constraint name keeps describing the column.
--
-- Row counts at authoring time: nfl_draft_rankings_history 0,
-- nfl_draft_rankings_index 0, pff_player_facet_gamelogs 0,
-- pff_player_facet_seasonlogs 21,751, pff_player_seasonlogs 34,613,
-- player_contracts 51,003. RENAME COLUMN is catalog-only, so size is
-- irrelevant -- no rewrite, no lock beyond the catalog update.
--
-- All five renamed constraint identifiers are 48-54 bytes, under the 63-byte
-- cap that would otherwise truncate with only a NOTICE.
--
-- ---------------------------------------------------------------------------
-- Consumer repoint (must land in the same window as this apply)
-- ---------------------------------------------------------------------------
--
-- Most consumers live in the `private` SUBMODULE, which is a separate git
-- repository (league-private) -- its commits cannot ride on a league branch.
-- The two repos must be pushed together.
--
--   league:
--     libs-server/data-views-column-definitions/player-pff-seasonlogs-column-definitions.mjs
--     scripts/import-player-contracts-nflverse.mjs
--   private:
--     scripts/import-pff-archive-player-facet-gamelogs.mjs
--     scripts/import-pff-archive-player-facet-seasonlogs.mjs
--     scripts/import-pff-archive-player-seasonlogs.mjs
--     scripts/import-pff-seasonlogs.mjs
--
-- The subtle one: import-pff-archive-player-seasonlogs.mjs project_row() copies
-- a PFF row key straight through when the table has a column of that name. PFF
-- emits `position`, so after this rename `columns.has('position')` is false and
-- the value is SILENTLY DROPPED -- no error, the column just stops being
-- populated. That needs a VENDOR_COLUMN_ALIASES entry, not a token rename.

ALTER TABLE public.nfl_draft_rankings_history
  RENAME COLUMN "position" TO player_position;

ALTER TABLE public.nfl_draft_rankings_history
  RENAME CONSTRAINT nfl_draft_rankings_history_position_vocabulary
                 TO nfl_draft_rankings_history_player_position_vocabulary;

ALTER TABLE public.nfl_draft_rankings_index
  RENAME COLUMN "position" TO player_position;

ALTER TABLE public.nfl_draft_rankings_index
  RENAME CONSTRAINT nfl_draft_rankings_index_position_vocabulary
                 TO nfl_draft_rankings_index_player_position_vocabulary;

ALTER TABLE public.pff_player_facet_gamelogs
  RENAME COLUMN "position" TO player_position;

ALTER TABLE public.pff_player_facet_gamelogs
  RENAME CONSTRAINT pff_player_facet_gamelogs_position_vocabulary
                 TO pff_player_facet_gamelogs_player_position_vocabulary;

ALTER TABLE public.pff_player_facet_seasonlogs
  RENAME COLUMN "position" TO player_position;

ALTER TABLE public.pff_player_facet_seasonlogs
  RENAME CONSTRAINT pff_player_facet_seasonlogs_position_vocabulary
                 TO pff_player_facet_seasonlogs_player_position_vocabulary;

ALTER TABLE public.pff_player_seasonlogs
  RENAME COLUMN "position" TO player_position;

ALTER TABLE public.pff_player_seasonlogs
  RENAME CONSTRAINT pff_player_seasonlogs_position_vocabulary
                 TO pff_player_seasonlogs_player_position_vocabulary;

ALTER TABLE public.player_contracts
  RENAME COLUMN team TO nfl_team;
