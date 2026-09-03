-- STATUS: APPLIED 2026-09-03 against league_production
-- Record that a finished generation's agent session has been torn down.
--
-- A generation is one-shot, but base launches every session as an interactive
-- REPL and retired its headless one-shot path, so the agent sits at an idle
-- prompt after answering and nothing reclaims it. League tears it down instead
-- (generation-collector.mjs), and this column is what stops that being a
-- forever-loop: the collector runs every 5 seconds and keeps a terminal job in
-- its working set for an hour, so without a marker one job would be re-killed up
-- to 720 times.
--
-- Nullable and no default, because it is a record of an ATTEMPT rather than a
-- state: it is stamped whether the teardown succeeded or base refused, since a
-- refusal that keeps being retried is the same runaway the column exists to
-- prevent. "Never attempted" and "attempted" are the two states worth
-- distinguishing; whether base was reachable at that instant is not one league
-- can act on later.

ALTER TABLE public.data_view_generation_jobs
  ADD COLUMN IF NOT EXISTS session_reaped_at timestamp with time zone;

COMMENT ON COLUMN public.data_view_generation_jobs.session_reaped_at IS
  'When league last attempted to tear down this generation''s agent session. Set on the attempt, not on its success, so a refusal cannot loop.';

-- Backfill every job that is already terminal. Their sessions are gone --
-- killed by hand on 2026-09-03 or never started -- and stamping them keeps the
-- collector from firing a teardown at a thread base no longer has the moment
-- this ships.
UPDATE public.data_view_generation_jobs
   SET session_reaped_at = now()
 WHERE status IN ('completed', 'failed', 'expired')
   AND session_reaped_at IS NULL;
