-- Drop view_roster_asset_holding_current_salary.
--
-- The view existed to reconstruct per-holding contract value at read time
-- because compute-snapshots-bulk wrote `salary_paid` with cap-attribution
-- semantics (zeroed on every holding except the earliest per (tid, pid,
-- year)) and only ever looked at `league_player_seasonlogs` /
-- AUCTION_PROCESSED transactions for the value -- which missed every
-- offseason tag, extension, RFA win, and draft contract.
--
-- The lineage walker now sets `roster_asset_holding.salary_paid` at
-- acquisition time directly from the originating finalized transaction
-- value (or carries it forward across trade legs from the source holding).
-- `salary_paid` is now unambiguously the per-holding contract value;
-- consumers should read it from `roster_asset_holding` directly. Cap
-- attribution under START_TEAM_BEARS is computed by the queries that need
-- it (earliest holding per (tid, pid, year)), not baked into the row.

DROP VIEW IF EXISTS view_roster_asset_holding_current_salary;
