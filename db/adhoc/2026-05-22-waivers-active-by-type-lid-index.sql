-- Partial composite index supporting the oracle stuck-row counts in
-- process-poaching-waivers.mjs and process-waivers-free-agency.mjs (both
-- variants). Each oracle runs:
--   SELECT ... FROM waivers
--   WHERE type = $type AND processed IS NULL AND cancelled IS NULL
--     [AND lid IN ($pre_snapshot_leagues)]
-- twice per invocation (pre-snapshot, post-check). The table is presently
-- small (~22 rows) but grows substantially during waiver-claim windows;
-- a partial index keyed on the live unprocessed working set keeps the
-- oracle path constant-time regardless of historical row growth.

CREATE INDEX IF NOT EXISTS idx_waivers_active_by_type_lid
  ON public.waivers (type, lid)
  WHERE processed IS NULL AND cancelled IS NULL;
