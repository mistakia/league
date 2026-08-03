-- STATUS: APPLIED 2026-08-03 against league_production
--
-- Record that a league's previous_external_league_id points at a league Sleeper
-- will not serve, so the chain walk stops paying for it once per run forever.
--
-- The walk's queue is in memory and its deadline defers whatever is left, so
-- scripts/import-sleeper-external-league-trades.mjs re-derives the outstanding
-- links each run as "referenced by an imported league and absent from
-- external_leagues". A link that is fetched normally leaves a row behind and
-- drops out of that set -- imported ones carry last_synced_at, appetite-rejected
-- ones are written as nodes with last_synced_at null. A link Sleeper answers 404
-- for leaves NO row (season_year and league_format are NOT NULL, so there is
-- nothing honest to write), so without this column it is re-derived and
-- re-requested on every subsequent run for the life of the corpus. Measured
-- 2026-08-03 at 2 of the first 20 links drained.
--
-- Stored on the CHILD rather than as a tombstone row for the missing league,
-- because the fact is a property of the EDGE: the prior season has no row to
-- carry it, and the child is what the frontier query scans.
--
-- Nullable with no backfill. Null means "not yet found unavailable", which is
-- the correct reading for every existing row.

ALTER TABLE external_leagues
  ADD COLUMN previous_external_league_unavailable_at timestamptz;
