-- Settle the position / player_position contradiction the two 2026-07-24 cutover
-- clusters left behind, in favour of player_position.
--
-- ############################################################################
-- ## RULED AND APPLIED 2026-07-25 (262f91d7), in favour of player_position.  ##
-- ## Verified applied: props_index.player_position is present in             ##
-- ## db/schema.postgres.sql. This is no longer an open decision -- do not    ##
-- ## reopen it from this file. Retained as append-only audit history.        ##
-- ############################################################################
--
-- The contradiction: betting-props-timeseries renamed pos -> position on
-- props_index and weekly_market_selections_analysis_cache, while nfl-plays-snaps
-- renamed position -> player_position on nfl_plays_player, each landing the same
-- day. Those two betting columns are the whole betting residual (2 flags).
--
-- Why player_position wins, on the project's own evidence rather than taste:
--
--   1. position is a reserved word. pg_dump quotes it in all eight places it
--      appears in db/schema.postgres.sql, and the quoting is what the audit's
--      quoted_camelcase rule detects. Both betting columns are flagged by it
--      today. player_position is flagged by nothing.
--   2. The betting conform did not adopt a convention -- it added two instances
--      of a hazard already present on six tables (nfl_draft_rankings_history,
--      nfl_draft_rankings_index, pff_player_facet_gamelogs,
--      pff_player_facet_seasonlogs, pff_player_seasonlogs, pff_unresolved_players),
--      all of which are in still-unconformed clusters and all of which the audit
--      flags for the same reason.
--   3. 37 tables still carry the unconformed `pos`. Whichever spelling is ruled
--      here is the target every one of those inherits, so ruling for `position`
--      means deliberately choosing to author 37 more quoted identifiers.
--   4. player_position also matches the shape the plays family already uses for
--      the neighbouring columns it kept (position_group, ngs_position).
--
-- SCOPE IS SMALLER THAN IT LOOKS -- only ONE of the two columns is real work:
--
--   weekly_market_selections_analysis_cache.position -- 2 code sites, both in
--     scripts: calculate-weekly-market-selections-analysis.mjs:264 writes it
--     (`position: player_row.primary_position` in the row literal; note the
--     surrounding local is misleadingly named props_index_inserts but the write
--     target is this cache table), and filter-prop-pairings.mjs:270 reads it
--     (`${single_prop.position}_AGAINST_ADJ`, off a
--     `weekly_market_selections_analysis_cache.*` select). Nothing else in
--     libs-server, libs-shared, app, api, or jobs touches either table.
--
--   props_index.position -- ZERO code consumers, and the table is already slated
--     to be retired under the 2026-07-24 operator ruling on the props/props_index
--     archive (migrate into canonical, verify, then drop). If that retirement
--     lands first this statement is unnecessary; it is included so the audit
--     reaches 0 either way, and should be dropped from the file if props_index
--     goes away first.
--
-- No index, constraint, or default references either column, so both are pure
-- metadata renames -- no rewrite, no lock beyond the catalog update, despite
-- props_index being 100 MB and the cache table 25 MB.
--
-- Apply order if ruled: land the two scripts' repoint in the same deploy as this
-- DDL. Neither script is a live API path -- both are cron-invoked -- so the
-- exposure window is until the next scheduled run rather than immediate.
--
-- Post-apply: yarn export:schema, then re-run
--   node db/adhoc/audit-schema-conformance.mjs
-- and confirm the betting residual reaches 0 (quoted_camelcase drops 13 -> 11,
-- the remaining 6 being the pff/draft-rankings tables in their own clusters).

BEGIN;

ALTER TABLE public.weekly_market_selections_analysis_cache
  RENAME COLUMN "position" TO player_position;

ALTER TABLE public.props_index
  RENAME COLUMN "position" TO player_position;

COMMIT;
