-- Remove orphan team pseudo-player rows from `player`.
-- These three encodings (XXX-TM, XXX-OFF, XXX-DEF for pos IN ('TEAM','OFF','DEF'))
-- are undocumented placeholder rows. As of 2026-05-14 they are referenced by
-- zero rows in any pid-bearing table (nfl_plays.*_pid, player_gamelogs.pid,
-- player_seasonlogs.pid, rosters_players.pid, props_index.pid, transactions.pid,
-- super_priority.pid, player_changelog.pid, keeptradecut_rankings.pid,
-- player_aliases.pid, ngs_prospect_scores_{index,history}.pid).
-- See task/league/data-views/migrate-to-identity-model.md #22.
-- Applied: 2026-05-14
-- yarn db:exec db/adhoc/2026-05-14-remove-orphan-team-pseudo-players.sql
-- yarn export:schema

DO $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM player
   WHERE pos IN ('TEAM','OFF','DEF')
     AND pid ~ '^[A-Z]+-(TM|OFF|DEF)$';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count <> 96 THEN
    RAISE EXCEPTION 'Expected 96 pseudo-player rows, deleted %', deleted_count;
  END IF;
END$$;
