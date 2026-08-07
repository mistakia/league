-- STATUS: APPLIED 2026-08-07 against league_production
--
-- Point the pause-reason comment at the column it actually moves with
--
-- db/adhoc/2026-08-07-restricted-free-agency-pause-without-expiry.sql made
-- `paused_at` the pause state and demoted `paused_until` to an optional
-- auto-expiry, but left this comment saying the reason moves with
-- `paused_until`. It moves with `paused_at` -- a hold with an end is now the
-- exception rather than the rule, so the old sentence describes a constraint
-- that no longer exists.
--
-- Worth its own file rather than left to rot: a column comment is the one
-- piece of schema documentation that travels with the database into every
-- reader's `\d+`, and a generated-doc sweep keyed on it would carry the wrong
-- claim forward.

COMMENT ON COLUMN public.seasons.restricted_free_agency_processing_paused_reason IS
  'Why processing is paused. Mandatory whenever restricted_free_agency_processing_paused_at is set, via the rfa_processing_pause_states_a_reason constraint -- it is the entire audit trail for the hold.';
