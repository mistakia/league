-- STATUS: APPLIED 2026-08-21 against league_production
--
-- Index nfl_play_stats for the (stat_id, is_valid) lookups the from-plays
-- fantasy-points CTE issues eight times per data-view query.
--
-- nfl_play_stats carries 5.76M rows / 825 MB and its only indexes are the
-- unique (esbid, play_id, stat_id, player_name) and a bare (play_id). Nothing
-- supports `stat_id IN (...) AND is_valid`, so every one of the eight probes in
-- add-player-stats-play-by-play-with-statement's fantasy-points CTE reads the
-- whole table: five as a parallel sequential scan, three as a full scan of the
-- unique index driven by a non-leading Index Cond. Measured on production
-- 2026-08-21 against the three slow signatures (126394/126395/126396), those
-- eight probes are 2.0-4.5s of a 3.5-6.0s CTE.
--
-- The key is deliberately narrow. esbid and play_id are in it so the return-TD
-- EXISTS gate -- the single largest probe, re-evaluated once per nfl_plays
-- partition -- becomes an index-only scan; stat_yards, gsis_player_id and
-- smart_player_id are left out because including them roughly quadruples the
-- index (~600 MB against ~160 MB) to save heap fetches on at most 35k rows per
-- arm, which a bitmap heap scan already reads in page order.
--
-- Additive and reversible: DROP INDEX CONCURRENTLY IF EXISTS
-- idx_nfl_play_stats_stat_id_is_valid_esbid_play_id;
--
-- Requires --no-transaction: the index is built without blocking the plays
-- worker's writes, which cannot run inside a transaction block. Every statement
-- here is independently re-runnable. The server's 40s statement_timeout would
-- cancel the build partway, so it is lifted for this session only.

SET statement_timeout = 0;
SET lock_timeout = '30s';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nfl_play_stats_stat_id_is_valid_esbid_play_id
  ON public.nfl_play_stats (stat_id, is_valid, esbid, play_id);

ANALYZE public.nfl_play_stats;
