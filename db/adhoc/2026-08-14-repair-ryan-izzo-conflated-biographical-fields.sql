-- STATUS: APPLIED 2026-08-14 against league_production
--
-- Repair the two biographical fields Tyler Conklin's row left on Ryan Izzo's.
--
-- The 2026-08-13 orphan-gamelog repair corrected the two players' IDENTIFIERS
-- and stopped there, which is stated outright in the docstring of
-- scripts/generate-player-gamelogs.mjs ("only the IDENTIFIER was"). The
-- biographical fields stayed conflated: RYAN-IZZO-004768 carried
-- date_of_birth 1995-07-30 and college 'Central Michigan', both of which are
-- Tyler Conklin's (TYLE-CONK-027880) and neither of which is Izzo's.
--
-- Three independent things agree on the direction, which is what makes this a
-- repair rather than a guess between two rows:
--
--   1. The row falsifies itself. Izzo's college_division is 'Atlantic Coast
--      (ACC)' while 'Central Michigan' is Mid-American (MAC) -- and Conklin's
--      row carries exactly that MAC division. The division is the field the
--      copy missed, so it still names Izzo's real conference.
--   2. External sources. Wikipedia and ESPN (id 3122920) both give Ryan Izzo
--      1995-12-21 and Florida State; NFL.com corroborates Florida State.
--      Pro Football Reference was unreachable (403) and is not relied on.
--   3. The corrected pair is the canonical one already in this table:
--      ('Florida State', 'Atlantic Coast (ACC)') holds 190 player rows.
--
-- nfl_draft_year is deliberately NOT touched. Both men were drafted in 2018 --
-- Izzo round 7 pick 250, Conklin round 5 pick 157 -- so the shared value is a
-- true coincidence rather than part of the copy, and the stored draft_round /
-- draft_overall_pick already differ correctly (7/250 against 5/157). Treating
-- every shared field as conflated would have rewritten a correct one.
--
-- No derived table is rebuilt by this. Both fields are read by
-- libs-server/player-era.mjs, whose birth-date branch decides on the birth
-- YEAR alone -- 1995 either way -- so player_could_have_played returns an
-- identical verdict before and after, and nothing downstream of it moves.

UPDATE player
SET date_of_birth = '1995-12-21',
    college = 'Florida State'
WHERE pid = 'RYAN-IZZO-004768'
  AND date_of_birth = '1995-07-30'
  AND college = 'Central Michigan';

-- Refuse the apply unless exactly the one intended row moved and it now holds
-- the internally-consistent pair. A bare UPDATE that matched nothing would
-- otherwise commit silently and read as a successful repair.
DO $$
DECLARE
  repaired integer;
BEGIN
  SELECT count(*) INTO repaired
  FROM player
  WHERE pid = 'RYAN-IZZO-004768'
    AND date_of_birth = '1995-12-21'
    AND college = 'Florida State'
    AND college_division = 'Atlantic Coast (ACC)';

  IF repaired <> 1 THEN
    RAISE EXCEPTION 'expected 1 repaired Izzo row, found %', repaired;
  END IF;
END $$;

-- Conklin must be untouched: his values were the correct ones all along, and
-- the failure mode of a copy repair is repairing the wrong end of it.
DO $$
DECLARE
  conklin integer;
BEGIN
  SELECT count(*) INTO conklin
  FROM player
  WHERE pid = 'TYLE-CONK-027880'
    AND date_of_birth = '1995-07-30'
    AND college = 'Central Michigan';

  IF conklin <> 1 THEN
    RAISE EXCEPTION 'Conklin row unexpectedly altered, found %', conklin;
  END IF;
END $$;
