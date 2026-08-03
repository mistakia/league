-- STATUS: APPLIED 2026-08-03 against league_production
--
-- Drop twelve single-column indexes on prop_pairings, 2,884 MB in total. None
-- of them can be the driving access path for the table's only reader, at any
-- time of year.
--
-- Requires `yarn db:exec --no-transaction` -- DROP INDEX CONCURRENTLY cannot run
-- inside a transaction block, and db-exec.sh applies --single-transaction by
-- default. CONCURRENTLY rather than a plain DROP because a plain DROP INDEX
-- takes ACCESS EXCLUSIVE on the table: the unlink is fast, but the lock REQUEST
-- queues behind any in-flight reader and blocks every query arriving after it.
--
-- Like the market_settled partial index dropped earlier today, this is argued
-- structurally and NOT from idx_scan = 0. Eleven of the twelve report zero
-- scans, but the current stats window tracks the 2026-05-22 postmaster start
-- and contains no in-season activity, and prop_pairings is written and read by
-- seasonal scripts. A zero over that window proves nothing on its own.
--
--
-- The consumers, in full
--
-- Exactly two files in the repository name prop_pairings or prop_pairing_props:
--
--   scripts/generate-prop-pairings.mjs -- the WRITER. Reads nothing from
--   prop_pairings. Its two upserts target onConflict('pairing_id') and
--   onConflict(['pairing_id','source_market_id','source_selection_id']), which
--   are arbitrated by idx_24967_PRIMARY and prop_pairing_props_unique. Both of
--   those survive; neither is in this file.
--
--   scripts/filter-prop-pairings.mjs -- the only READER. Every read goes
--   through build_prop_pairing_query (line 556), whose shape is fixed:
--
--     .where('source_id', source).where('week', week)
--     .orderBy('current_season_hist_rate_hard', 'DESC')
--     .orderBy('current_season_hist_rate_soft', 'DESC')
--     .orderBy('current_season_hist_edge_soft', 'DESC')
--     .orderBy('current_season_sum_hist_rate_soft', 'DESC')
--     .orderBy('lowest_payout', 'DESC')
--
--   plus up to fourteen optional `>= threshold` conjuncts and an optional
--   nfl_team whereIn/whereNotIn.
--
--
-- Why no single-column index here can be the driving path
--
-- The two equality predicates are the only ones that could seed an index scan,
-- and only `week` is worth seeding from. Measured on the live table:
--
--   source_id  n_distinct = 2, and 12,354,346 of 12,794,891 rows (96.6%) are
--              FANDUEL. Filtering on it removes essentially nothing.
--   week       n_distinct = 9, correlation 0.947. The largest partition
--              (FANDUEL week 9) is 2,256,338 rows, 17.6% of the table.
--
-- So a (source_id, week) composite would select almost exactly what `week`
-- alone selects, which is why none is added here. The planner already chooses
-- idx_prop_pairings_week and applies source_id as a heap filter; that is the
-- correct plan and idx_prop_pairings_week is deliberately RETAINED.
--
-- The threshold columns cannot displace it. Every one is a `>=` conjunct
-- applied ALONGSIDE week = N, never instead of it, and there is no composite
-- pairing week with any of them. For a single-column index on a threshold
-- column to be chosen it would have to out-select week's 17.6%. Measured with
-- current_season_hist_rate_soft >= 0.6, the most selective threshold in the
-- default configuration: 119,035 of 451,268 rows removed, 26.4%. It is not
-- close, and the cardinalities say why -- these are bucketed rates, not
-- continuous measures:
--
--   risk_total                           n_distinct = 1      (355 MB)
--   current_season_total_games           n_distinct = 15     (102 MB)
--   current_season_opp_allow_rate        n_distinct = 23     (357 MB)
--   size                                 n_distinct = 3      (112 MB)
--   current_season_hist_rate_soft        n_distinct = 62     (369 MB)
--   current_season_joint_hist_rate_soft  n_distinct = 69     (366 MB)
--   lowest_payout                        n_distinct = 252    (114 MB)
--   highest_payout                       n_distinct = 309    (115 MB)
--   current_season_hist_edge_soft        n_distinct = 51,875 (400 MB)
--
-- risk_total is the clearest case in the set and a stronger one than this
-- morning's 89% partial: 355 MB indexing a column that holds ONE distinct value
-- across 12.79M rows. It cannot discriminate anything, ever.
--
-- Nor can any of them serve the ORDER BY. A single-column index can only supply
-- the FIRST sort key, and the first key is current_season_hist_rate_hard, which
-- has no index at all -- so the sort is a top-N heapsort under every possible
-- subset of these indexes. Confirmed by EXPLAIN ANALYZE on the reader's exact
-- shape: Parallel Index Scan using idx_prop_pairings_week, every threshold
-- applied as a heap Filter, Sort Method: top-N heapsort.
--
-- Two of the twelve are dropped on a slightly weaker argument and are called
-- out rather than buried:
--
--   idx_prop_pairings_market_prob (352 MB) is named by NO predicate, threshold
--   or sort key in either consumer. It is unreferenced rather than unusable.
--
--   idx_prop_pairings_nfl_team (129 MB, n_distinct = 32) is the one with a
--   nonzero count (20 scans). It backs apply_team_player_filters, but that is
--   an optional secondary filter beside week = N and both default to empty; the
--   whereNotIn form cannot use an index at all. If a future season shows the
--   include_teams path is hot, the right answer is a (week, nfl_team)
--   composite, not this.
--
-- Checked before dropping, for all twelve: indisunique = false,
-- indisprimary = false, and pg_constraint.conindid returns no rows, so none
-- backs a UNIQUE, PRIMARY KEY or EXCLUDE constraint and DROP INDEX is legal
-- without touching a constraint definition. prop_pairings.relreplident = 'd',
-- so none is a replica identity.
--
-- Write-side saving is real beyond the 2,884 MB: generate-prop-pairings.mjs
-- rebuilds this table per week per source, and each of these twelve indexes was
-- being maintained on every insert and non-HOT update for no read benefit.

DROP INDEX CONCURRENTLY IF EXISTS idx_prop_pairings_risk_total;

DROP INDEX CONCURRENTLY IF EXISTS idx_prop_pairings_hist_edge_soft;

DROP INDEX CONCURRENTLY IF EXISTS idx_prop_pairings_hist_rate_soft;

DROP INDEX CONCURRENTLY IF EXISTS idx_prop_pairings_joint_hist_rate;

DROP INDEX CONCURRENTLY IF EXISTS idx_prop_pairings_opp_allow_rate;

DROP INDEX CONCURRENTLY IF EXISTS idx_prop_pairings_market_prob;

DROP INDEX CONCURRENTLY IF EXISTS idx_prop_pairings_highest_payout;

DROP INDEX CONCURRENTLY IF EXISTS idx_prop_pairings_lowest_payout;

DROP INDEX CONCURRENTLY IF EXISTS idx_prop_pairings_source_id;

DROP INDEX CONCURRENTLY IF EXISTS idx_prop_pairings_size;

DROP INDEX CONCURRENTLY IF EXISTS idx_prop_pairings_total_games;

DROP INDEX CONCURRENTLY IF EXISTS idx_prop_pairings_nfl_team;
