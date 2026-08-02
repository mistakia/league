-- STATUS: APPLIED 2026-08-02 against league_production
-- Add seasons.draft_pick_interval: units of draft_type (cadence_unit) between
-- consecutive picks' windows.
--
-- getDraftWindow (libs-shared/get-draft-window.mjs) already accepts
-- cadence_interval, but nothing persists it, so every league/season falls
-- through to the default of 1. This resolves the open continuation
-- user:continuation/draft-pick-cadence-interval-decision.md, whose rule is
-- all-or-nothing: wire the column end to end in one change, or do not add it.
-- The single wiring point is libs-shared/get-draft-window-config.mjs, whose
-- JSDoc already anticipates this addition by this name.
--
-- Default 1 preserves current behavior exactly for every existing row. Left
-- NULLable (not NOT NULL) to match its sibling election columns draft_type /
-- draft_hour_min / draft_hour_max, which scripts/generate-seasons.mjs resets
-- to null on each season rollover -- getDraftWindow's `cadence_interval ??
-- DEFAULT_CADENCE_INTERVAL` already treats null the same as unset, so the
-- rollover reset (added alongside this column) works without a NOT NULL
-- conflict. A coarser cadence is a per-draft commissioner election, same as
-- the other three.
--
-- Additive and idempotent (ADD COLUMN IF NOT EXISTS + DEFAULT). db:exec wraps
-- this in a single transaction.
--
-- yarn db:exec db/adhoc/2026-08-02-add-draft-pick-interval.sql

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS draft_pick_interval smallint DEFAULT 1;
