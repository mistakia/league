-- STATUS: APPLIED 2026-08-03 against league_production
--
-- Per-league fingerprint of the roster-asset-lineage input tables, so the
-- refresh watcher can tell whether a rebuild is owed.
--
-- Until now the lineage graph was written by exactly one nightly cron
-- (generate-roster-asset-lineage.mjs --all, 05:00 ET), so it lagged live
-- activity by up to 24 hours. That is a correctness bug rather than a latency
-- one: the player_extended_salary data-view column left-joins
-- roster_asset_holding on (player_id, lid, tid) with period_end IS NULL, so
-- after a trade the open holding still carries the old tid, the join misses,
-- and COALESCE(s.salary_paid, 0) renders the player's salary as $0.
--
-- scripts/refresh-roster-asset-lineage.mjs closes that window. It hashes the
-- eight tables walk-transactions.mjs reads and rebuilds the league when the
-- hash moves. This table holds the comparison point.
--
-- Why a content hash rather than a MAX(transactions.uid) watermark: the walker
-- reads trades, trades_transactions, trades_players, trades_picks, draft,
-- restricted_free_agency_bids and seasons alongside transactions, and several
-- db/adhoc repair files UPDATE transaction rows in place (see
-- 2026-05-21-fix-kyle-allen-release-tid.sql). A watermark sees none of that; a
-- hash sees all of it, and measures at 22.8ms for league 1.
--
-- refreshed_at doubles as the pipeline's freshness oracle -- a row whose
-- refreshed_at has stopped advancing while its league is active means the
-- watcher has stopped working.

CREATE TABLE roster_asset_lineage_refresh_state (
  lid integer PRIMARY KEY,
  input_hash text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE roster_asset_lineage_refresh_state IS
  'Per-league fingerprint of the roster-asset-lineage input tables; drives incremental refresh in scripts/refresh-roster-asset-lineage.mjs.';

COMMENT ON COLUMN roster_asset_lineage_refresh_state.input_hash IS
  'md5 over the eight source tables walk-transactions.mjs reads. Changing the walker''s read set requires changing this fingerprint in lockstep.';

GRANT SELECT ON roster_asset_lineage_refresh_state TO league_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON roster_asset_lineage_refresh_state TO league_writer;
