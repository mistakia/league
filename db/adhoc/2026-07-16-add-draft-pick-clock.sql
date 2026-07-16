-- Add a per-season draft pick clock so notifications-draft.mjs derives the
-- on-clock window length from data instead of a hardcoded constant.
--
-- Default 24 preserves Amendment XXXI's standing 24-hour window for every
-- existing and future season; a shorter clock is a per-draft commissioner
-- election (Article XI Section 8 leaves the window length to the commissioner).
--
-- Additive and idempotent (ADD COLUMN IF NOT EXISTS + DEFAULT). db:exec wraps
-- this in a single transaction.
--
-- yarn db:exec db/adhoc/2026-07-16-add-draft-pick-clock.sql

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS draft_pick_clock_hours smallint DEFAULT 24 NOT NULL;

-- 2026 commissioner election: 12-hour draft windows for the home dynasty
-- league (lid=1) to fit the rookie draft before the season starts.
UPDATE public.seasons
  SET draft_pick_clock_hours = 12
  WHERE lid = 1 AND year = 2026;
