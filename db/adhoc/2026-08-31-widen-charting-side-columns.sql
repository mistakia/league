-- STATUS: APPLIED 2026-08-31 against league_production
--
-- Widen the three side columns on nfl_player_play_charting from varchar(8)
-- to varchar(16).
--
-- Caught by the T9 backfill's own oracle, which is the part worth recording.
-- The 2026 preseason stage failed 31 of 98 team requests on
-- `value too long for type character varying(8)`, and the run reported
-- `114933 row(s) inserted of 168270 returned` rather than exiting 0 on a
-- partial import. That gap between returned and inserted is the only signal
-- available at this grain -- rows here have no natural key, so a short import
-- cannot be detected by inspecting the rows themselves.
--
-- The value is coverageResponsibilitySide emitting `INSIDE LEFT` and
-- `INSIDE RIGHT`, 12 characters. Four team-games sampled across 2025 REG and
-- 2026 PRE while sizing this table showed only LEFT, RIGHT and MIDDLE, so the
-- column was sized at 8. That sample was 6,976 rows and it was not enough: the
-- vendor's side vocabulary is open, and a two-word form appears only in later
-- 2026 preseason games.
--
-- All three *_side columns move, not just the one that overflowed. They share a
-- vocabulary and there is no reason the two-word form is confined to coverage
-- responsibility -- sizing the other two off the same insufficient sample would
-- be repeating the mistake and waiting for a different game to find it.
--
-- Measured across the 1,278,807 rows that DID land: alignment_side 6,
-- gap_assignment_side 5, coverage_responsibility_side 6. So nothing already
-- stored is near the old limit, and this widening loses nothing and truncates
-- nothing.
--
-- Increasing a varchar length is a catalog-only change in Postgres -- no table
-- rewrite and no scan, even at 1.28M rows.

SET lock_timeout = '30s';
SET statement_timeout = 0;

ALTER TABLE public.nfl_player_play_charting
  ALTER COLUMN coverage_responsibility_side TYPE character varying(16),
  ALTER COLUMN alignment_side TYPE character varying(16),
  ALTER COLUMN gap_assignment_side TYPE character varying(16);
