-- STATUS: APPLIED 2026-08-04 against league_production
--
-- Null the wrongly-attributed `player.nfl_player_id` values and add the missing
-- UNIQUE index.
--
-- `nfl_player_id` was the only identifier column on `player` without a UNIQUE
-- index; the other 29 all have one. It held 18 duplicated values across 40 rows
-- -- one person's NFL id sitting on two different player rows, which is the
-- fingerprint left by a name-match importer writing an id onto the wrong row.
--
-- Adjudication method. `nfl_player_id` is monotone in entry cohort, and so is
-- the `gsis_player_id` numeric block, so the local median of `gsis_player_id`
-- over the 60 nearest uniquely-keyed `nfl_player_id` neighbours predicts which
-- cohort an id belongs to. Calibrated against the 11,820 uniquely-keyed rows
-- that carry a well-formed gsis id, that predictor has a median absolute
-- residual of 25 and a 90th percentile of 315. For 15 of the 18 values one
-- candidate row lands at or below the median residual and the other lands above
-- the 90th percentile, which decides ownership without appealing to
-- `date_of_birth` or `nfl_draft_year` (both corrupt on these rows).
--
-- Three cases do not resolve that way and are handled by nulling BOTH rows,
-- because a null is recoverable and a wrong id propagates:
--   * 2560000 is a placeholder, not an id -- six unrelated 2019 rows carry it.
--   * 2561392 (jamiyus pittman / kyle queiro) -- residuals 68 and 43, both
--     ordinary; the predictor does not separate two players from one cohort.
--   * 2563241 (derrick kelly / isaiah searight) -- residuals 55 and 15, same.
--
-- Previous values are recorded in `player_changelog` as well as here, so any
-- null is reversible from the database alone.
--
-- No index is built outside a transaction here: `player` is ~28k rows, so a
-- blocking build is cheap and the whole file must be atomic. db:exec supplies
-- the transaction (`--single-transaction`), so this file declares none of its
-- own.

CREATE TEMP TABLE nfl_player_id_repair (pid varchar(25) PRIMARY KEY) ON COMMIT DROP;

INSERT INTO nfl_player_id_repair (pid) VALUES
  -- father/son and same-name pairs: the id belongs to the older player
  ('LEON-JOHN-003018'),  -- 2501437 -> leon johnson (1997 North Carolina)
  ('TEBU-JONE-002541'),  -- 2501520 -> tebucky jones (1998 Syracuse)
  ('CHRI-WARR-002516'),  -- 2503542 -> chris warren (1990 Ferrum)
  ('CHRI-COOP-004607'),  -- 2504674 -> chris cooper (2001 Nebraska-Omaha)
  ('CEDR-WILS-026895'),  -- 2504701 -> cedrick wilson (2001 Tennessee)
  ('TONY-BROW-025958'),  -- 2505269 -> tony brown (2004 Memphis)
  ('JIMM-WILL-001938'),  -- 2506891 -> jimmy williams (2006 Virginia Tech)
  ('JOHN-ALST-021590'),  -- 2506905 -> jon alston (2006 Stanford)
  ('BRAN-SMIT-007336'),  -- 2531061 -> brandon smith (2011 Arizona State)
  ('MARC-MART-005829'),  -- 2543670 -> marcus martin (2014 USC)
  ('DARI-JACK-005807'),  -- 2556273 -> darius jackson (2016 Eastern Michigan)
  ('CJXX-JOHN-001708'),  -- 2556831 -> cj johnson (2016 Mississippi)
  ('DARR-WILL-006055'),  -- 2559009 -> darrell williams (2017 Western Kentucky)
  ('DAVI-LONG-015070'),  -- 2562798 -> david long jr (2019 West Virginia)

  -- two same-name contemporaries, resolved: 2506353 is the 2005 first-rounder
  -- out of Texas (gsis 00-0023449), whose neighbours run in exact draft order
  ('DERR-JOHN-009487'),

  -- 2560000 is a placeholder; none of these six rows should keep it
  ('MIKQ-DEAN-002787'),
  ('CASE-TUCK-019539'),
  ('FLOY-ALLE-003680'),
  ('ALEX-BROW-020260'),
  ('NOAH-DAWK-005680'),
  ('DAKA-MONR-008297'),

  -- undecidable contemporaries: null both sides rather than guess
  ('JAMI-PITT-004761'),  -- 2561392
  ('KYLE-QUEI-011210'),  -- 2561392
  ('DERR-KELL-027318'),  -- 2563241
  ('ISAI-SEAR-007429');  -- 2563241

INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT
  p.pid,
  'nfl_player_id',
  p.nfl_player_id::text,
  NULL,
  'adhoc/2026-08-04-dedupe-player-nfl-player-id',
  'duplicated nfl_player_id resolved against the gsis_player_id cohort block',
  now()
FROM player p
JOIN nfl_player_id_repair r ON r.pid = p.pid
WHERE p.nfl_player_id IS NOT NULL;

UPDATE player p
SET nfl_player_id = NULL
FROM nfl_player_id_repair r
WHERE r.pid = p.pid;

-- Fail loudly rather than half-apply if the adjudication list missed a value.
DO $$
DECLARE remaining integer;
BEGIN
  SELECT count(*) INTO remaining FROM (
    SELECT nfl_player_id FROM player
    WHERE nfl_player_id IS NOT NULL
    GROUP BY nfl_player_id HAVING count(*) > 1
  ) t;
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'nfl_player_id still has % duplicated values', remaining;
  END IF;
END $$;

CREATE UNIQUE INDEX player_nfl_player_id_unique ON public.player USING btree (nfl_player_id);
