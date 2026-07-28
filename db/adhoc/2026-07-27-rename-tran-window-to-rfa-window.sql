-- Rename seasons.tran_start / seasons.tran_end to name what they actually gate.
--
-- These columns read as a "transaction window" but they are not one. They are
-- the Restricted Free Agency window: libs-server/context-docs/league-calendar.mjs
-- labels them "Restricted Free Agency Begins" / "Restricted Free Agency Ends",
-- and every functional call site is RFA logic (announce-restricted-free-agent,
-- process-restricted-free-agency-bids, verify-restricted-free-agency,
-- api/routes/teams/restricted-free-agency, Roster restricted-tag handling).
--
-- The old names have already produced a wrong answer: a session read the
-- 2026 window (Aug 1 - Aug 21) as the trade window and reported trades closed
-- until August. Trades are gated only by seasons.tddate
-- (api/routes/leagues/trades.mjs rejects when now is after league.tddate);
-- there is no offseason trade window at all.
--
-- New names match the existing conventions on this table: the sibling window
-- free_agency_period_start / free_agency_period_end, and the RFA-prefixed
-- restricted_free_agency_announcement_hour / restricted_free_agency_processing_hour.
--
-- No indexes, constraints, defaults, or views reference either column.

ALTER TABLE seasons RENAME COLUMN tran_start TO restricted_free_agency_period_start;
ALTER TABLE seasons RENAME COLUMN tran_end TO restricted_free_agency_period_end;
