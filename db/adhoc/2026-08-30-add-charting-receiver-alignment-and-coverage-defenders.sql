-- STATUS: APPLIED 2026-08-30 against league_production
--
-- Give the charting vendor's `formation` and `coverageDefenders` their own
-- columns on nfl_plays, and drop the dead has_charting_data column.
--
-- The vendor's `formation` was previously mapped onto offense_formation, which
-- the NFL feed owns -- 462 rows of directional NxN receiver splits sitting
-- against SHOTGUN / SINGLEBACK / I_FORM. That mapping was deleted in 224a915e3;
-- this file gives the value the destination it should always have had, so the
-- companion data repair can MOVE those 462 values rather than destroy them.
--
-- receiver_alignment_charting, not receiver_alignment: the NFL feed's column is
-- normalized strong-side-first and never emits a right-heavy value, while this
-- vendor is directional (1x3 alongside 3x1, plus 1x4+, 4+x1 and MISCxMISC).
-- Different encodings of the same concept, and the vendor's carries strictly
-- more information. The `_charting` suffix is this vendor's family (epa_charting,
-- charting_play_type); `_charted` is the Next Gen Stats family and would file
-- the column under the wrong source.
--
-- varchar(16), not the incumbent's varchar(10): the longest observed value is
-- MISCxMISC at 9, but the vendor's vocabulary is open and a truncation here
-- would be silent.
--
-- Both new columns go on nfl_plays ONLY. nfl_plays_current_week is a strict
-- subset (326 columns against 417) feeding the live scoreboard, and the
-- charting importer runs days after a game. The has_charting_data DROP touches
-- BOTH, because the column exists on both.
--
-- has_charting_data is NULL on all 1,487,212 rows and has no code consumer --
-- grep returns only frozen adhoc history, the column-repoint archive, and the
-- generated data/nfl/plays/coverage-report.json, whose entry this change also
-- removes. Positive control: the same grep for offense_formation returns seven
-- live files.
--
-- nfl_plays is a declarative partition parent with 27 year partitions; ADD and
-- DROP COLUMN propagate to them automatically and must not be run per-partition.
-- Verification is a count in the schema export: each new column appears 28 times
-- (parent + 27 partitions) and has_charting_data goes from 29 to zero.

SET lock_timeout = '30s';
SET statement_timeout = 0;

ALTER TABLE public.nfl_plays
  ADD COLUMN receiver_alignment_charting character varying(16),
  ADD COLUMN coverage_defenders smallint;

ALTER TABLE public.nfl_plays DROP COLUMN has_charting_data;

ALTER TABLE public.nfl_plays_current_week DROP COLUMN has_charting_data;
