-- STATUS: APPLIED 2026-08-31 against league_production
--
-- Resolve the esbid on ONE prop_markets_index row: the CLOSE snapshot of
-- FANDUEL market 734.77171513 (Amon-Ra St. Brown receiving yards), which
-- imported with a null esbid and a null season_year and has stayed unresolvable
-- ever since.
--
--   source_id FANDUEL, source_market_id 734.77171513, time_type CLOSE
--   esbid  NULL -> 2023111208
--   season_year  NULL -> 2023
--
-- THIS IS NOT AN ESBID REWRITE. db/checks/registry.mjs
-- (prop-market-open-close-esbid-coherence) forbids rewriting an esbid to make a
-- market's two rows agree, because a drifted market has two DIFFERENT esbids and
-- nothing in the row says which one moved. That prohibition is about the drift
-- class and does not reach this row. Here one side is BLANK: the OPEN row
-- resolved, the CLOSE row never did, and there is no competing value to choose
-- between. Filling a blank is not adjudicating a disagreement.
--
-- WHY 2023111208 IS THE GAME. Four independent lines, and they do not depend on
-- each other:
--
--   1. THE VENDOR'S OWN EVENT ID IS IDENTICAL ON BOTH ROWS -- source_event_id
--      32763016 on the OPEN row and on the CLOSE row. The registry names the
--      vendor's event as the oracle for exactly this question. FanDuel is saying
--      these two snapshots are the same event; only our resolution of it failed.
--
--   2. THE CLOSE SNAPSHOT WAS TAKEN DURING THAT GAME. 2023111208 is DET @ LAC,
--      kickoff 2023-11-12 21:05:00Z. The CLOSE market row was observed at
--      2023-11-12 23:34:54Z -- two and a half hours after kickoff, inside the
--      game. Its is_live flag is true, which is the same statement from the
--      other direction.
--
--   3. THE LINE IS A LIVE LINE, WHICH IS WHY IT LOOKS ABSURD. 162.5 receiving
--      yards is not a pre-game number for any receiver; it is what a live market
--      offers once the player is most of the way there. St. Brown finished that
--      game with 156 receiving yards on 8 receptions, active. The OPEN line
--      three days earlier was 88.5, which IS an ordinary pre-game line. The pair
--      only makes sense as pre-game and in-game snapshots of one event.
--
--   4. NO OTHER CANDIDATE EXISTS. DET played exactly one game in week 10 of
--      2023, and it is this one.
--
-- WHY THE STAMP GUARD DOES NOT OBJECT. aa5e43baa freezes a market's esbid once
-- is_market_settled is true, so that a re-observation cannot move a settled
-- market onto another game. This row's is_market_settled is FALSE, so it was
-- never frozen and this write is not going around the guard. The predicate below
-- asserts that rather than assuming it.
--
-- WHAT THIS FIXES, AND WHAT IT DOES NOT. Two settled selection rows hang off
-- this market (source_selection_id 40891131 and 40891132, time_type CLOSE). Both
-- carry metric_result_value 156.0 against selection_metric_line 162.5 and are
-- graded OVER WON / UNDER LOST, which is backwards -- 156 is under 162.5. They
-- are two of the six findings reported by the
-- prop-market-selection-grade-consistency check.
--
-- This file does NOT touch those grades, deliberately. The reason they were
-- never repairable is that libs-server/prop-market-settlement/prop-market-utils.mjs
-- fetch_markets_for_games requires a non-null esbid AND a matching season_year on
-- the selection's own time_type market row, so no settlement run at any
-- missing_only setting could ever fetch them. Stamping the esbid is what makes
-- them reachable. The grades are then rewritten by the settlement code itself:
--
--   node scripts/process-market-results.mjs --esbids 2023111208
--
-- Re-grading through the real writer rather than hand-writing WON/LOST here is
-- the point. A hand-written grade is a third source of truth for a value the
-- settlement code already derives, and getting it right by hand proves nothing
-- about the code that will derive it next time.
--
-- POPULATION QUERY, if this class is ever suspected again. 22,467 market rows
-- currently have a null esbid while their sibling time_type row has one, and
-- 22,465 of those agree with the sibling on source_event_id. This file repairs
-- ONE of them; the rest are a separate decision and are NOT swept in here,
-- because making 22,433 unfrozen markets newly settleable is a change with a
-- blast radius that wants its own adjudication:
--
--   SELECT a.source_id, a.source_market_id, a.time_type, b.esbid, b.season_year
--     FROM prop_markets_index a
--     JOIN prop_markets_index b
--       ON b.source_id = a.source_id
--      AND b.source_market_id = a.source_market_id
--      AND b.time_type <> a.time_type
--    WHERE a.esbid IS NULL
--      AND b.esbid IS NOT NULL
--      AND a.source_event_id IS NOT DISTINCT FROM b.source_event_id
--      AND NOT a.is_market_settled;

DO $$
DECLARE
  updated integer;
BEGIN
  UPDATE public.prop_markets_index
     SET esbid = 2023111208,
         season_year = 2023
   WHERE source_id = 'FANDUEL'
     AND source_market_id = '734.77171513'
     AND time_type = 'CLOSE'
     -- Every field the header reasons from is asserted here, so the write
     -- cannot land on a row that has moved since this file was written.
     AND esbid IS NULL
     AND season_year IS NULL
     AND is_market_settled = false
     AND source_event_id = '32763016'
     AND market_type = 'GAME_RECEIVING_YARDS';

  GET DIAGNOSTICS updated = ROW_COUNT;

  IF updated <> 1 THEN
    RAISE EXCEPTION
      'expected exactly one market row to resolve, got %; rolling back', updated;
  END IF;

  RAISE NOTICE 'resolved FANDUEL 734.77171513 CLOSE to esbid 2023111208';
END $$;

-- Post-condition inside the same transaction: the market's two rows must now
-- name the SAME game, which is the coherence property the sibling check grades.
-- If they do not, this file did not do what its header claims and rolls back.
DO $$
DECLARE
  distinct_esbids integer;
BEGIN
  SELECT count(DISTINCT esbid)
    INTO distinct_esbids
    FROM public.prop_markets_index
   WHERE source_id = 'FANDUEL'
     AND source_market_id = '734.77171513';

  IF distinct_esbids <> 1 THEN
    RAISE EXCEPTION
      'market 734.77171513 names % distinct esbids after the repair, expected 1; rolling back',
      distinct_esbids;
  END IF;
END $$;
