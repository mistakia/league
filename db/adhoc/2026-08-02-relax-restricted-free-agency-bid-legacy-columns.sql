-- STATUS: APPLIED 2026-08-02 against league_production
--
-- Release `restricted_free_agency_bids.player_tid` from NOT NULL so the writers
-- can stop populating it ahead of the column being dropped.
--
-- This is the first half of the contract. The columns `player_tid`, `nominated`,
-- `announced` and `reason` are all superseded -- the first three by
-- `restricted_free_agency_nominations`, the last by `outcome` -- and the code
-- that reads them is swept. But dropping them here would break PRODUCTION,
-- which is still running the pre-sweep code until the deploy lands: a dropped
-- column that committed code still names is a 42703 on every RFA route and on
-- the processing cron.
--
-- So the ordering is relax, deploy, then drop, and the drop is
-- 2026-08-02-drop-restricted-free-agency-bid-legacy-columns.sql. Relaxing is
-- safe in both directions: code that still writes `player_tid` keeps working,
-- and code that omits it no longer violates the constraint. The transitional
-- state exists only between this apply and that one; it is not a shim anything
-- reads.

ALTER TABLE public.restricted_free_agency_bids
  ALTER COLUMN player_tid DROP NOT NULL;
