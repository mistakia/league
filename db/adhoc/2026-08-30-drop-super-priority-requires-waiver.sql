-- STATUS: APPLIED 2026-08-30 against league_production
--
-- Drop super_priority.requires_waiver, a write-only column.
--
-- Why. The field answered "would this team have to submit a manual waiver to
-- make room for the super priority return?" -- advance warning to the TEAM, not
-- a branch for the code. It stopped doing that on 2025-11-06 in e43c7e89e,
-- which removed the `if (!requires_waiver)` wrapper around the waiver insert
-- and said so in its message: "waivers are automatically created for all
-- eligible cases without manual intervention". From that day it gated nothing.
-- 31ea0aa9b did not retire a live field nine months later; it removed two LATER
-- reuses of an already-inert one (deriving target_slot, gating the space check),
-- neither of which was what the flag meant. d78b47da7's message says 31ea0aa9b
-- removed the last two consumers -- true of the code, but it implies the field
-- was doing its job until then, and it was not.
--
-- No consumer branches on it anywhere. The writers were process-release.mjs and
-- populate-super-priority-table.mjs; process-super-priority.mjs echoed it into
-- its return value, and BOTH callers discard that return --
-- process-waivers-free-agency-practice.mjs awaits without destructuring, and the
-- CLI main only logs the whole object. So even the echo had no reader. The
-- search was validated against a positive control (poach_timestamp, same grep
-- shape, matches ten files) so the silence is a real absence and not a broken
-- pattern.
--
-- What is discarded, and why that is a gain. 17 rows: 9 read 0, 8 read 1 (5
-- unclaimed, 3 claimed). Those 3 are the reason this is a drop rather than a
-- deprecation -- a claim succeeding while flagged is only possible if space
-- existed at claim time, so the database currently asserts "requires a manual
-- waiver" on three claims that were processed automatically, poached 2025-11-07
-- to 2025-11-12. The stored answer is not merely unread, it is wrong.
--
-- Why not rebuild it here. A stored boolean cannot answer this question: poach
-- to claim ran 24h, 59h and 140h on those three, and two of the three teams
-- moved their roster inside the window. If the advance warning is wanted back it
-- is a notification keyed on a LIVE space check, reading the same
-- has_practice_squad_space_for_position the claim will enforce, so it cannot
-- drift from what it predicts. That is new behavior and is not in scope here.
--
-- Nothing is lost operationally. A failed claim already writes its reason onto
-- the waiver in process-waivers-free-agency-practice.mjs, so the team still
-- learns their squad was full -- after the fact rather than before, which is the
-- only thing this column ever added.
--
-- Operator-ruled 2026-08-30. See
-- user:task/league/advance-codebase-review-followups.md.

SET lock_timeout = '30s';
SET statement_timeout = 0;

-- Pre-condition: fail loudly if the shape is not the one measured above, rather
-- than dropping whatever happens to be there.
DO $$
DECLARE
  total_rows integer;
  flagged_rows integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE requires_waiver = 1)
    INTO total_rows, flagged_rows
    FROM public.super_priority;

  IF total_rows <> 17 OR flagged_rows <> 8 THEN
    RAISE EXCEPTION
      'super_priority shape changed since this drop was authored: % rows, % flagged (expected 17 and 8)',
      total_rows, flagged_rows;
  END IF;
END $$;

ALTER TABLE public.super_priority
  DROP COLUMN requires_waiver;
