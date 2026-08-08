-- STATUS: APPLIED 2026-08-08 against league_production
--
-- Conform the PFF franchise_id family to pff_team_id, and drop the two dead
-- GroupMe columns on leagues.
--
-- FRANCHISE_ID -> PFF_TEAM_ID
--
-- franchise_id is PFF's team identifier. private/libs-server/pff-archive.mjs
-- carries the PFF_FRANCHISE_TO_NFL_TEAM map (a stable global 1:1 over 32
-- franchises) and private/scripts/import-pff-archive-team-gamelogs.mjs reads
-- teams-summary/{season}/{franchise_id}.json, so the conformed name is
-- pff_team_id.
--
-- The family was enumerated from information_schema rather than from the
-- audit's flagged list, and that found a FIFTH member the audit does not
-- report: pff_player_seasonlogs.draft_franchise_id, 21,489 of 34,613 rows
-- populated. It escapes because conforms_external accepts the bare two-token
-- shape /^[a-z0-9]+_[a-z0-9]+_id$/, which reads draft_franchise_id as
-- system=draft, entity=franchise -- a FALSE conformance, not a vocabulary gap.
-- Renaming the four flagged members and leaving it would split an obvious
-- sibling set, which is the partly-visible-set failure this program has already
-- recorded once.
--
-- draft_* is a coherent prefix family on that table (draft_league, draft_round,
-- draft_season, draft_selection, draft_type), so the role prefix is kept and
-- the conformed name is draft_pff_team_id rather than pff_draft_team_id.
--
-- Populations at authoring (prod, 2026-08-08):
--   pff_team_gamelogs.franchise_id              11,996 / 11,996
--   pff_player_facet_seasonlogs.franchise_id    21,751 / 21,751
--   pff_team_seasonlogs.franchise_id               672 / 672
--   pff_player_facet_gamelogs.franchise_id           0 / 0
--   pff_player_seasonlogs.draft_franchise_id    21,489 / 34,613
--
-- pg_proc holds no plpgsql body naming franchise_id or groupme (checked
-- 2026-08-08), so no CREATE OR REPLACE accompanies this file. One index carries
-- the token and is renamed with the column; the new name is 58 bytes, inside
-- the 63-byte identifier cap.
--
-- GROUPME DROP
--
-- Operator ruling 2026-08-08: drop rather than rename. Re-verified against
-- production immediately before authoring -- 0 of 116 leagues populate either
-- column. No writer exists (the settings POST handler is a TODO stub and the
-- league_fields whitelist excludes both), and the sole reader
-- (libs-server/send-notifications.mjs) is guarded by
-- `if (league.groupme_token && league.groupme_id)` so it has never fired. The
-- dead sender and its guarded caller are removed in the same commit.
--
-- groupme_token is an access_token rather than an identifier, so the audit
-- never flagged it; it is dead by the same evidence and goes in the same file.
--
-- No BEGIN/COMMIT -- db-exec.sh runs this under --single-transaction, and a
-- file-level COMMIT would end the outer transaction early.

-- ===========================================================================
-- 1. franchise_id -> pff_team_id
-- ===========================================================================

ALTER TABLE public.pff_team_gamelogs
  RENAME COLUMN franchise_id TO pff_team_id;

ALTER TABLE public.pff_team_seasonlogs
  RENAME COLUMN franchise_id TO pff_team_id;

ALTER TABLE public.pff_player_facet_seasonlogs
  RENAME COLUMN franchise_id TO pff_team_id;

ALTER TABLE public.pff_player_facet_gamelogs
  RENAME COLUMN franchise_id TO pff_team_id;

ALTER TABLE public.pff_player_seasonlogs
  RENAME COLUMN draft_franchise_id TO draft_pff_team_id;

-- Index names do not follow the column rename.
ALTER INDEX public.pff_player_facet_seasonlogs_franchise_season_year_facet_idx
  RENAME TO pff_player_facet_seasonlogs_pff_team_season_year_facet_idx;

-- ===========================================================================
-- 2. Drop the dead GroupMe columns
-- ===========================================================================

ALTER TABLE public.leagues
  DROP COLUMN groupme_id;

ALTER TABLE public.leagues
  DROP COLUMN groupme_token;
