-- Phase A4: rename mislabeled FantasyPros dynasty rows to redraft.
--
-- Pre-fix libs-server/fantasypros.mjs ignored the `dynasty` flag, so every
-- dynasty cron call hit type=draft. Every PPR_DYNASTY / PPR_SUPERFLEX_DYNASTY
-- row in player_rankings_history with timestamp < fix_epoch is actually
-- type=draft (redraft) data. format_ranking_type destructured `superflex`
-- correctly, so the rename map is exact:
--   PPR_DYNASTY           -> PPR_REDRAFT           (position=ALL, scoring=PPR)
--   PPR_SUPERFLEX_DYNASTY -> PPR_SUPERFLEX_REDRAFT (position=OP,  scoring=PPR)
--
-- fix_epoch = 1779000000. Last pre-fix DYNASTY row is 1778914802; earliest
-- 2026-05-18 manual --year backfill row is 1779066293. No DYNASTY rows
-- exist after the cutoff yet (next dynasty cron Wed 2026-05-20 04:00 will
-- produce the first real-dynasty data).
--
-- player_rankings_history has no PK/unique index on (timestamp, ranking_type,
-- pid), so UPDATE ranking_type cannot collide.
-- player_rankings_index PK is (year, source_id, ranking_type, pid); we delete
-- the DYNASTY label entries entirely so the next cron repopulates with real
-- dynasty data. We do NOT merge into REDRAFT index — the existing
-- PPR_REDRAFT / PPR_SUPERFLEX_REDRAFT index already holds the latest pre-fix
-- draft-cron snapshot, which is the authoritative redraft latest.
--
-- db-exec.sh wraps this in --single-transaction with ON_ERROR_STOP=1.

\set fix_epoch 1779000000

\echo === BEFORE: history counts ===
SELECT ranking_type, COUNT(*) AS n
FROM player_rankings_history
WHERE source_id = 'FANTASYPROS'
  AND ranking_type IN ('PPR_DYNASTY','PPR_SUPERFLEX_DYNASTY','PPR_REDRAFT','PPR_SUPERFLEX_REDRAFT')
GROUP BY ranking_type
ORDER BY ranking_type;

\echo === BEFORE: index counts ===
SELECT ranking_type, COUNT(*) AS n
FROM player_rankings_index
WHERE source_id = 'FANTASYPROS'
  AND ranking_type IN ('PPR_DYNASTY','PPR_SUPERFLEX_DYNASTY','PPR_REDRAFT','PPR_SUPERFLEX_REDRAFT')
GROUP BY ranking_type
ORDER BY ranking_type;

\echo === BEFORE: in-scope rows to rename ===
SELECT ranking_type, COUNT(*) AS n
FROM player_rankings_history
WHERE source_id = 'FANTASYPROS'
  AND ranking_type IN ('PPR_DYNASTY','PPR_SUPERFLEX_DYNASTY')
  AND timestamp < :fix_epoch
GROUP BY ranking_type
ORDER BY ranking_type;

\echo === UPDATE PPR_DYNASTY -> PPR_REDRAFT ===
UPDATE player_rankings_history
SET ranking_type = 'PPR_REDRAFT'
WHERE source_id = 'FANTASYPROS'
  AND ranking_type = 'PPR_DYNASTY'
  AND timestamp < :fix_epoch;

\echo === UPDATE PPR_SUPERFLEX_DYNASTY -> PPR_SUPERFLEX_REDRAFT ===
UPDATE player_rankings_history
SET ranking_type = 'PPR_SUPERFLEX_REDRAFT'
WHERE source_id = 'FANTASYPROS'
  AND ranking_type = 'PPR_SUPERFLEX_DYNASTY'
  AND timestamp < :fix_epoch;

\echo === DELETE stale DYNASTY index rows (next cron repopulates) ===
DELETE FROM player_rankings_index
WHERE source_id = 'FANTASYPROS'
  AND ranking_type IN ('PPR_DYNASTY','PPR_SUPERFLEX_DYNASTY');

\echo === AFTER: history counts ===
SELECT ranking_type, COUNT(*) AS n
FROM player_rankings_history
WHERE source_id = 'FANTASYPROS'
  AND ranking_type IN ('PPR_DYNASTY','PPR_SUPERFLEX_DYNASTY','PPR_REDRAFT','PPR_SUPERFLEX_REDRAFT')
GROUP BY ranking_type
ORDER BY ranking_type;

\echo === AFTER: index counts ===
SELECT ranking_type, COUNT(*) AS n
FROM player_rankings_index
WHERE source_id = 'FANTASYPROS'
  AND ranking_type IN ('PPR_DYNASTY','PPR_SUPERFLEX_DYNASTY','PPR_REDRAFT','PPR_SUPERFLEX_REDRAFT')
GROUP BY ranking_type
ORDER BY ranking_type;

\echo === ASSERT: zero DYNASTY history rows remain pre-fix ===
SELECT 'remaining_dynasty_history' AS check, COUNT(*) AS n
FROM player_rankings_history
WHERE source_id = 'FANTASYPROS'
  AND ranking_type IN ('PPR_DYNASTY','PPR_SUPERFLEX_DYNASTY')
  AND timestamp < :fix_epoch;

\echo === ASSERT: zero DYNASTY index rows remain ===
SELECT 'remaining_dynasty_index' AS check, COUNT(*) AS n
FROM player_rankings_index
WHERE source_id = 'FANTASYPROS'
  AND ranking_type IN ('PPR_DYNASTY','PPR_SUPERFLEX_DYNASTY');
