-- Repair the twelve player rows whose identity fields belong to a different
-- person, adjudicated 2026-08-27 against the nflverse players feed (the
-- authoritative gsis_player_id map, already a dependency of
-- scripts/import-players-nflverse.mjs).
--
-- HOW THEY WERE FOUND. `nfl_draft_year` compared against nflverse's
-- `rookie_season` for the same gsis id separates cleanly with no threshold to
-- invent: 15,327 rows fall in a continuous band from -4 to +7, then THIRTY-FOUR
-- EMPTY YEARS, then eleven rows at +42 through +67. One row sits at -8. Those
-- twelve are this file. The old `gsis_cohort` falsifier that was supposed to
-- catch this found none of them -- see the companion change to
-- db/gates/check-conflated-player-rows.mjs.
--
-- TWO SHAPES, TWO REPAIRS. They are not the same defect mirrored:
--
--   (A) ELEVEN historical player rows carrying a MODERN player's NFL-system
--       ids. Sam Boyd (drafted 1939) holds the gsis id of Shane Boyd, a 2006
--       Kentucky quarterback. The historical player's own biography -- name,
--       college, draft year, position, and his own pfr id -- is intact and
--       correct. The grafted ids are the contaminant, so they are CLEARED
--       rather than corrected: we have no evidence these men were ever issued
--       an NFL-system id, and inventing one would be the same defect again.
--
--   (B) ONE modern row, CHRI-CAMP-019727, where the reverse happened. Its
--       gsis, esb and college correctly identify Chris Campbell, an offensive
--       tackle out of Eastern Illinois (rookie 2010). Its position, height,
--       weight and draft year were overwritten from a SAME-NAMED 2018 Penn
--       State defensive back who has his own correct row at CHRI-CAMP-001340.
--       Here the ids are right and the attributes are wrong, so the attributes
--       are restored from nflverse.
--
-- WHY esb IS CLEARED ON ONLY EIGHT OF THE ELEVEN. Checked per row rather than
-- assumed: on eight, our `esb_player_id` is byte-identical to the esb nflverse
-- carries for the grafted gsis, so it arrived with it and is the modern
-- player's. On BOBB-WILL-001964, TOMM-DAVI-019484 and WILL-WILL-019626 our esb
-- DIFFERS from nflverse's, so it is the historical player's own and is kept. A
-- blanket clear would have destroyed three correct identifiers.
--
-- `smart_player_id` is cleared wherever gsis is, on all eleven: its value is a
-- hex encoding of the gsis id itself (32013030-2d30-3032-3437-3237... decodes
-- to "00-0024727"), so it is the same identifier in another dress and would be
-- left dangling by clearing gsis alone.
--
-- NOT TOUCHED: pfr_player_id on any row. Those encode the HISTORICAL player
-- (AlleDu00 is Duane Allen; nflverse's grafted-player pfr is AlleDa00, David
-- Allen), so they are correct and are the surviving link to who these rows
-- actually are.
--
-- Oracles are computed at apply time, never hardcoded to a row count that
-- moves. Each statement asserts it touched exactly the rows named.
-- STATUS: APPLIED 2026-08-27 against league_production

SET lock_timeout = '30s';

-- ---------------------------------------------------------------------------
-- 0. Refuse to run if the rows are not in the state this file was written
--    against. A partial earlier repair, or a writer having moved one of these
--    rows since 2026-08-27, must stop the file rather than silently apply a
--    subset.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  present bigint;
BEGIN
  SELECT count(*) INTO present
  FROM public.player
  WHERE pid IN (
    'DUAN-ALLE-004357','WILL-WILL-019626','BOBB-WILL-001964','DANI-JAME-005413',
    'DOUG-BROW-004739','TOMM-DAVI-019484','ROBE-SMIT-014085','RAMO-ARMS-013770',
    'RALP-FELT-008514','HARR-SMIT-011312','SAMX-BOYD-019293','CHRI-CAMP-019727'
  );
  IF present <> 12 THEN
    RAISE EXCEPTION
      'expected all 12 adjudicated pids to exist, found %', present;
  END IF;
END
$$;

DO $$
DECLARE
  already_clear bigint;
BEGIN
  SELECT count(*) INTO already_clear
  FROM public.player
  WHERE pid IN (
    'DUAN-ALLE-004357','WILL-WILL-019626','BOBB-WILL-001964','DANI-JAME-005413',
    'DOUG-BROW-004739','TOMM-DAVI-019484','ROBE-SMIT-014085','RAMO-ARMS-013770',
    'RALP-FELT-008514','HARR-SMIT-011312','SAMX-BOYD-019293'
  ) AND gsis_player_id IS NULL;
  IF already_clear > 0 THEN
    RAISE EXCEPTION
      '% of the 11 grafted rows already have a null gsis_player_id -- this file has been applied, or another writer has moved them',
      already_clear;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 1. Shape A -- clear the grafted NFL-system ids from the eleven historical
--    rows. gsis and smart on all eleven; esb only where it demonstrably came
--    with the gsis.
-- ---------------------------------------------------------------------------

UPDATE public.player
SET gsis_player_id = NULL,
    smart_player_id = NULL
WHERE pid IN (
  'DUAN-ALLE-004357','WILL-WILL-019626','BOBB-WILL-001964','DANI-JAME-005413',
  'DOUG-BROW-004739','TOMM-DAVI-019484','ROBE-SMIT-014085','RAMO-ARMS-013770',
  'RALP-FELT-008514','HARR-SMIT-011312','SAMX-BOYD-019293'
);

UPDATE public.player
SET esb_player_id = NULL
WHERE pid IN (
  'DUAN-ALLE-004357','DANI-JAME-005413','DOUG-BROW-004739','ROBE-SMIT-014085',
  'RAMO-ARMS-013770','RALP-FELT-008514','HARR-SMIT-011312','SAMX-BOYD-019293'
);

-- ---------------------------------------------------------------------------
-- 2. Shape B -- restore CHRI-CAMP-019727's own attributes. Values are Chris
--    Campbell the Eastern Illinois offensive tackle's, read from nflverse:
--    T (tackle), 77in, 327lb, rookie season 2010, born 1986-09-22. The row keeps its
--    gsis (00-0027432), esb (CAM216872) and college, which were always his.
-- ---------------------------------------------------------------------------

-- 'T', not nflverse's 'OT': player_primary_position_vocabulary admits T/G/C/OL
-- for the line, and the dry run rejected OT.
UPDATE public.player
SET primary_position = 'T',
    secondary_position = 'T',
    height_inches = 77,
    weight_pounds = 327,
    nfl_draft_year = 2010,
    date_of_birth = '1986-09-22'
WHERE pid = 'CHRI-CAMP-019727';

-- ---------------------------------------------------------------------------
-- 3. Prove the end state rather than trusting the updates above.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  stragglers bigint;
  camp record;
BEGIN
  SELECT count(*) INTO stragglers
  FROM public.player
  WHERE pid IN (
    'DUAN-ALLE-004357','WILL-WILL-019626','BOBB-WILL-001964','DANI-JAME-005413',
    'DOUG-BROW-004739','TOMM-DAVI-019484','ROBE-SMIT-014085','RAMO-ARMS-013770',
    'RALP-FELT-008514','HARR-SMIT-011312','SAMX-BOYD-019293'
  ) AND (gsis_player_id IS NOT NULL OR smart_player_id IS NOT NULL);
  IF stragglers <> 0 THEN
    RAISE EXCEPTION '% grafted row(s) still carry a gsis or smart id', stragglers;
  END IF;

  SELECT count(*) INTO stragglers
  FROM public.player
  WHERE pid IN (
    'DUAN-ALLE-004357','DANI-JAME-005413','DOUG-BROW-004739','ROBE-SMIT-014085',
    'RAMO-ARMS-013770','RALP-FELT-008514','HARR-SMIT-011312','SAMX-BOYD-019293'
  ) AND esb_player_id IS NOT NULL;
  IF stragglers <> 0 THEN
    RAISE EXCEPTION '% row(s) still carry a grafted esb id', stragglers;
  END IF;

  -- The three whose esb was their own must still have it.
  SELECT count(*) INTO stragglers
  FROM public.player
  WHERE pid IN ('BOBB-WILL-001964','TOMM-DAVI-019484','WILL-WILL-019626')
    AND esb_player_id IS NULL;
  IF stragglers <> 0 THEN
    RAISE EXCEPTION
      '% row(s) lost an esb id that was the historical player''s own', stragglers;
  END IF;

  SELECT primary_position, height_inches, weight_pounds, nfl_draft_year,
         date_of_birth, gsis_player_id
  INTO camp FROM public.player WHERE pid = 'CHRI-CAMP-019727';
  IF camp.primary_position <> 'T' OR camp.height_inches <> 77
     OR camp.weight_pounds <> 327 OR camp.nfl_draft_year <> 2010
     OR camp.date_of_birth <> '1986-09-22'
     OR camp.gsis_player_id <> '00-0027432' THEN
    RAISE EXCEPTION 'CHRI-CAMP-019727 did not reach its adjudicated end state';
  END IF;

  RAISE NOTICE 'repaired 11 grafted rows and restored CHRI-CAMP-019727';
END
$$;
