-- Conform the three player position columns to the canonical vocabulary
-- STATUS: APPLIED 2026-08-04 against league_production
--
-- Folds vendor and single-wing-era spellings into the 25-value vocabulary
-- established in libs-shared/constants/position-constants.mjs. Every UPDATE
-- records the prior value in position_vocabulary_backfill_audit first.
--
-- primary_position and secondary_position are NOT NULL; tertiary_position is
-- nullable and spells absent two ways (15,002 NULL, 12,307 empty string), which
-- this collapses to one.
--
-- Two rows carry return-specialist codes that are not positions at all and have
-- no behavioral oracle -- neither player has a single gamelog or play stat.
-- Both columns are NOT NULL so neither can be nulled, so both are resolved by
-- inspection of the surviving attributes:
--
--   ARRI-JONE-017099  Arrington Jones III, Winston-Salem State, 1981, 6'0"
--                     225 lb  ->  RB  (KOR is a kick-return role; the listed
--                     build is a running back's)
--   JONA-HEFN-010587  Jonathan Hefney, Tennessee, 2008, 5'8" 190 lb  ->  DB
--                     (KR likewise a return role; the build is a defensive
--                     back's)
--
-- These two are inference from height, weight, college and era -- not from the
-- data. They are called out here so a later reader does not mistake them for
-- oracle-derived values.

-- db:exec wraps the whole file in one transaction, so no explicit BEGIN here.

CREATE TEMPORARY TABLE position_alias (raw text PRIMARY KEY, canonical text NOT NULL) ON COMMIT DROP;
INSERT INTO position_alias (raw, canonical) VALUES
  ('OT','T'), ('LT','T'), ('RT','T'), ('OG','G'), ('LG','G'), ('RG','G'), ('OC','C'),
  ('ED','EDGE'), ('LDE','DE'), ('RDE','DE'), ('DI','DT'), ('DG','DT'), ('LDT','DT'), ('RDT','DT'),
  ('MIKE','MLB'), ('WILL','OLB'), ('LOLB','OLB'), ('ROLB','OLB'), ('LILB','ILB'), ('RILB','ILB'), ('$LB','LB'),
  ('SS','S'), ('FS','S'), ('SAF','S'), ('LCB','CB'), ('RCB','CB'),
  ('HB','RB'), ('H-B','RB'), ('TB','RB'), ('BB','RB'), ('WB','RB'),
  ('OE','TE'), ('E','TE'), ('FL','WR'), ('DEF','DST');

-- ---------------------------------------------------------------- aliases ---

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'player', 'primary_position', jsonb_build_object('pid', p.pid), p.primary_position, a.canonical
FROM public.player p JOIN position_alias a ON a.raw = p.primary_position;

UPDATE public.player p SET primary_position = a.canonical
FROM position_alias a WHERE a.raw = p.primary_position;

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'player', 'secondary_position', jsonb_build_object('pid', p.pid), p.secondary_position, a.canonical
FROM public.player p JOIN position_alias a ON a.raw = p.secondary_position;

UPDATE public.player p SET secondary_position = a.canonical
FROM position_alias a WHERE a.raw = p.secondary_position;

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'player', 'tertiary_position', jsonb_build_object('pid', p.pid), p.tertiary_position, a.canonical
FROM public.player p JOIN position_alias a ON a.raw = p.tertiary_position;

UPDATE public.player p SET tertiary_position = a.canonical
FROM position_alias a WHERE a.raw = p.tertiary_position;

-- ------------------------------------------- tertiary_position: one absent ---

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'player', 'tertiary_position', jsonb_build_object('pid', pid), tertiary_position, NULL
FROM public.player
WHERE tertiary_position IS NOT NULL
  AND (btrim(tertiary_position) = '' OR tertiary_position IN ('`', 'KR'));

UPDATE public.player SET tertiary_position = NULL
WHERE tertiary_position IS NOT NULL
  AND (btrim(tertiary_position) = '' OR tertiary_position IN ('`', 'KR'));

-- ---------------------------------------- return-specialist codes, by hand ---

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'player', 'primary_position', jsonb_build_object('pid', pid), primary_position,
  CASE pid WHEN 'ARRI-JONE-017099' THEN 'RB' WHEN 'JONA-HEFN-010587' THEN 'DB' END
FROM public.player WHERE pid IN ('ARRI-JONE-017099', 'JONA-HEFN-010587');

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'player', 'secondary_position', jsonb_build_object('pid', pid), secondary_position,
  CASE pid WHEN 'ARRI-JONE-017099' THEN 'RB' WHEN 'JONA-HEFN-010587' THEN 'DB' END
FROM public.player WHERE pid IN ('ARRI-JONE-017099', 'JONA-HEFN-010587');

UPDATE public.player SET primary_position = 'RB', secondary_position = 'RB' WHERE pid = 'ARRI-JONE-017099';
UPDATE public.player SET primary_position = 'DB', secondary_position = 'DB' WHERE pid = 'JONA-HEFN-010587';
