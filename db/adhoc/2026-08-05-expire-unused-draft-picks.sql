-- STATUS: APPLIED 2026-08-05 against league_production
--
-- Materialize draft-pick expiry
--
-- Adds draft.expired_at and backfills it, so that "this pick is still an
-- outstanding asset" becomes a stored fact rather than something every
-- consumer re-derives.
--
-- BACKGROUND
--
-- Per the 2023-09-03 commissioner ruling, a pick not used before the draft
-- window closes expires to free agency: no compensation, no successor asset.
-- Until now that rule lived in exactly one place -- the roster-asset-lineage
-- walker (libs-server/roster-asset-lineage/walk-transactions.mjs), which
-- synthesizes a `rookie_draft_completed` event in memory and closes the
-- holding with EXPIRED_TO_FA. It never wrote the fact back, and the `draft`
-- table had no column for it.
--
-- Everything else therefore inferred "outstanding" from `pid IS NULL`, which
-- is silent about expiry. That predicate held only by accident: every
-- historical unused pick carried a garbage pid ('0'/'1') until
-- db/adhoc/2026-08-05-dedupe-residual-round-3.sql correctly de-attributed
-- five of them, at which point four expired 2021/2023 picks began rendering
-- as live assets on team 1's page and -- worse -- passing trade validation in
-- api/routes/leagues/trades.mjs, which filters by uid and pid only.
--
-- The de-attribution was right. `pid IS NULL` genuinely means "no player was
-- selected"; it simply does not distinguish "not yet" from "never will be".
-- This file adds the column that does.
--
-- WHAT COUNTS AS UNUSED
--
-- Verified against production before writing this file: for every affected
-- league-year, the count of type-8 (DRAFT) transactions equals the count of
-- picks carrying a pid, and all five unselected picks have a NULL
-- selection_timestamp. No player was ever selected with them, so there is no
-- lost attribution to recover -- only an expiry to record.
--
-- SCOPE
--
-- League 1 is the only league with pre-2026 draft rows. Five picks expire
-- (2021 rounds 4-5, 2023 round 4) and five league-years get an explicit
-- completion timestamp they never received.
--
-- 2026 IS DELIBERATELY EXCLUDED. Its draft is live -- 59 picks on the board,
-- none yet made -- and stamping it would expire the entire class. Every
-- statement below is bounded by `year < 2026` for that reason. 2027 picks are
-- endowments for a draft that has not been scheduled and are likewise out of
-- scope.
--
-- ORACLE FOR THE CLOSE TIMESTAMP
--
-- seasons.rookie_draft_completed_at where populated, else MAX(selection_
-- timestamp) for that league-year. That is the same resolution order the
-- lineage walker already applies, so this backfill materializes what lineage
-- has been assuming rather than introducing a new judgment. Re-running the
-- lineage refresh across this change should produce identical output; that is
-- the intended verification.
--
-- The column is only ever written for a league-year whose draft has concluded.
-- Going forward libs-server/close-rookie-draft.mjs owns the write, called both
-- when the final pick is made and by a scheduled sweep for drafts that end
-- with picks unmade -- the case that produced this defect, and the reason
-- rookie_draft_completed_at was populated for 2025 alone.

ALTER TABLE public.draft ADD COLUMN expired_at integer;

COMMENT ON COLUMN public.draft.expired_at IS
  'Unix seconds at which this pick''s draft window closed with no selection made. NULL for picks that were used and for picks whose draft is still open. Mutually exclusive with pid.';

-- A pick cannot be both selected and expired. This is the invariant the whole
-- change exists to make checkable.
ALTER TABLE public.draft
  ADD CONSTRAINT draft_not_both_selected_and_expired
  CHECK (pid IS NULL OR expired_at IS NULL);

-- ---------------------------------------------------------------------------
-- Backfill 1 -- record when each concluded draft actually ended.
-- ---------------------------------------------------------------------------

UPDATE seasons s
SET rookie_draft_completed_at = sub.max_selection_timestamp
FROM (
  SELECT lid, year, MAX(selection_timestamp) AS max_selection_timestamp
  FROM draft
  WHERE year < 2026
  GROUP BY lid, year
  HAVING MAX(selection_timestamp) IS NOT NULL
) sub
WHERE s.lid = sub.lid
  AND s.year = sub.year
  AND s.rookie_draft_completed_at IS NULL;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM seasons s
  JOIN (SELECT DISTINCT lid, year FROM draft WHERE year < 2026) d
    ON d.lid = s.lid AND d.year = s.year
  WHERE s.rookie_draft_completed_at IS NULL;
  IF n <> 0 THEN
    RAISE EXCEPTION '% concluded league-years still have no completion timestamp', n;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Backfill 2 -- expire every unselected pick in a concluded draft.
-- ---------------------------------------------------------------------------

UPDATE draft d
SET expired_at = s.rookie_draft_completed_at
FROM seasons s
WHERE s.lid = d.lid
  AND s.year = d.year
  AND d.year < 2026
  AND d.pid IS NULL
  AND d.expired_at IS NULL
  AND s.rookie_draft_completed_at IS NOT NULL;

DO $$
DECLARE
  expired_count int;
  leaked int;
BEGIN
  SELECT count(*) INTO expired_count FROM draft WHERE expired_at IS NOT NULL;
  IF expired_count <> 5 THEN
    RAISE EXCEPTION 'expected 5 expired picks, got % -- population has shifted', expired_count;
  END IF;

  -- Nothing in a live or unscheduled draft may have been touched.
  SELECT count(*) INTO leaked FROM draft WHERE expired_at IS NOT NULL AND year >= 2026;
  IF leaked <> 0 THEN
    RAISE EXCEPTION '% picks in an open draft were expired', leaked;
  END IF;

  -- Every concluded league-year must now be fully resolved: each pick either
  -- selected or expired, with nothing left ambiguous.
  SELECT count(*) INTO leaked
  FROM draft
  WHERE year < 2026 AND pid IS NULL AND expired_at IS NULL;
  IF leaked <> 0 THEN
    RAISE EXCEPTION '% picks in a concluded draft are neither selected nor expired', leaked;
  END IF;
END $$;
