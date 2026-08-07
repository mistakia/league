-- STATUS: APPLIED 2026-08-07 against league_production
--
-- Per-league pause for restricted free agency bid PROCESSING
--
-- Adds a data-level, per-league hold that scripts/process-restricted-free-agency-bids.mjs
-- honors, replacing the only lever that existed before: commenting out the
-- crontab line on league-production. That lever has five defects, and the
-- reason for each column below is one of them.
--
-- 1. It needs root SSH, so it is not an action a commissioner can take.
-- 2. The job goes DARK. `service:league-process-restricted-free-agency-bids`
--    self-reports a `*/5 * * * *` cadence to the runs ledger, so a commented
--    cron line reads to the staleness sweep exactly like a broken job. A
--    paused league must still let the job run and report success, which is
--    why the pause lives in the data the job reads rather than in whether the
--    job runs at all.
-- 3. It is not in version control -- the deployed crontab is machine-built
--    from server/crontab-main/, so the next `server/deploy-crontab.sh` run
--    silently resumes processing.
-- 4. It is all-or-nothing across every league. Hence per-(lid, season_year),
--    which is the grain the rest of the window configuration already uses.
-- 5. Nothing records who paused it, why, or when it ends.
--
-- WHY `paused_until` RATHER THAN A BOOLEAN `is_paused`
--
-- A boolean is the thing you forget to turn off, and a forgotten pause does
-- not fail loudly -- it silently freezes every remaining auction of the
-- period, which for league 1 is a four-day window. A timestamp forces the
-- operator to name an end at pause time and self-heals when that passes, so
-- the failure mode of forgetting is a pause that expires rather than an
-- auction period that never resumes.
--
-- There is deliberately NO indefinite pause. An operator wanting a long hold
-- names a long timestamp, which is a reviewable value in the row; an
-- indefinite hold would be an unreviewable one. This is the same reasoning
-- that made restricted_free_agency_period_end a real timestamp rather than a
-- flag.
--
-- THE CHECK CONSTRAINT
--
-- Both columns move together, so a pause can never exist without a stated
-- reason. The reason is the whole audit trail -- there is no separate log --
-- and a nullable reason beside a set `paused_until` would decay to null on
-- the first hurried pause.
--
-- NOTE ON ORDERING: this pause is what creates the multi-window backlog
-- condition, and processing order across a backlog was defective before this
-- change (bids were selected by highest amount rather than by window order,
-- and the tiebreak sort was a no-op on string pids). That fix ships in the
-- same commit as this file; the pause is not safe without it.

ALTER TABLE public.seasons
  ADD COLUMN restricted_free_agency_processing_paused_until timestamp with time zone,
  ADD COLUMN restricted_free_agency_processing_paused_reason text,
  ADD CONSTRAINT rfa_processing_pause_states_a_reason
    CHECK (
      (restricted_free_agency_processing_paused_until IS NULL
        AND restricted_free_agency_processing_paused_reason IS NULL)
      OR
      (restricted_free_agency_processing_paused_until IS NOT NULL
        AND restricted_free_agency_processing_paused_reason IS NOT NULL)
    );

COMMENT ON COLUMN public.seasons.restricted_free_agency_processing_paused_until IS
  'When set and in the future, restricted free agency bid processing is held for this league-season. The processing job still runs and still reports success; it treats the league as having no due bids. Null means not paused.';

COMMENT ON COLUMN public.seasons.restricted_free_agency_processing_paused_reason IS
  'Why processing is paused. Moves with restricted_free_agency_processing_paused_until via the rfa_processing_pause_states_a_reason constraint.';
