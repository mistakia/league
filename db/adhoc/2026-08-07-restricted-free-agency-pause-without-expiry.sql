-- STATUS: APPLIED 2026-08-07 against league_production
--
-- Let a restricted free agency processing pause be held open-ended
--
-- Follow-up to db/adhoc/2026-08-07-restricted-free-agency-processing-pause.sql,
-- applied earlier today. That file required every pause to name an end, on the
-- reasoning that a boolean flag is the thing you forget to turn off and a
-- forgotten hold silently freezes the rest of the auction period.
--
-- That reasoning was wrong about which failure is worse here.
--
-- A mandatory expiry does not make a pause safer, it makes the RESUME
-- unattended: the timer lapses and bids settle -- signing players, moving cap
-- space, writing transactions -- with nobody watching. Settlement is
-- irreversible, so auto-resuming it is a strictly worse outcome than a hold
-- that stays held. And an operator who does not yet know how long they need
-- has only two ways to satisfy a mandatory field, both bad: guess short and
-- get an early settlement mid-decision, or type a date past the period end,
-- which is an indefinite pause wearing a bounded one's clothes.
--
-- The original concern is also much smaller than it looked. A pause cannot
-- outlive restricted_free_agency_period_end, after which nothing is due
-- anyway -- four days for league 1's 2026 period. "Frozen forever" was never
-- reachable.
--
-- SHAPE
--
-- `paused_at` is the state: set means held, null means running. `paused_until`
-- becomes an OPTIONAL auto-expiry for the case where the operator does know
-- the end ("hold until the next window opens"), and null means held until
-- someone resumes it. Splitting the two stops one column from having to answer
-- both "is it paused" and "when does it stop", which is what forced the
-- expiry to be mandatory in the first place.
--
-- `paused_at` also carries real audit value the previous shape had nowhere to
-- put: how long a hold has been running. The processing job logs that on every
-- run, which is what replaces the expiry as the guard against a forgotten
-- pause -- surfacing it every five minutes rather than silently ending it.
--
-- The reason stays mandatory. It is the whole audit trail, and unlike an end
-- time the operator always knows it at pause time.
--
-- Nothing is paused in production right now (these columns have never been
-- written), so this restructures cleanly with no backfill and leaves no
-- transitional state behind.

ALTER TABLE public.seasons
  ADD COLUMN restricted_free_agency_processing_paused_at timestamp with time zone;

ALTER TABLE public.seasons
  DROP CONSTRAINT rfa_processing_pause_states_a_reason;

ALTER TABLE public.seasons
  ADD CONSTRAINT rfa_processing_pause_states_a_reason
    CHECK (
      -- Not paused: nothing set.
      (restricted_free_agency_processing_paused_at IS NULL
        AND restricted_free_agency_processing_paused_reason IS NULL
        AND restricted_free_agency_processing_paused_until IS NULL)
      OR
      -- Paused: a start and a reason, with an end only if one is known.
      (restricted_free_agency_processing_paused_at IS NOT NULL
        AND restricted_free_agency_processing_paused_reason IS NOT NULL)
    );

COMMENT ON COLUMN public.seasons.restricted_free_agency_processing_paused_at IS
  'When the current hold on restricted free agency bid processing began. Set means processing is held for this league-season; null means it is running. The processing job still runs and still reports success while held.';

COMMENT ON COLUMN public.seasons.restricted_free_agency_processing_paused_until IS
  'Optional auto-expiry for the hold. Null while paused means held until someone resumes it, which is the normal case -- an unattended resume settles bids irreversibly, so an end is only set when it is genuinely known.';
