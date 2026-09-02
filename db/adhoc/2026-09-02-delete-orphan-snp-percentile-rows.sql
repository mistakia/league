-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Delete the 126 orphan `snp` rows from percentiles.
--
-- WHY THIS FILE EXISTS. db/adhoc/2026-05-23-drop-orphan-snp-columns.sql dropped
-- the `snp` column from every table that carried it (ce19747c2), on an audit
-- showing it was 0 or NULL across ~617k player_gamelogs rows, ~1M
-- scoring_format_player_projection_points rows and the rest -- no source
-- populated it, no league could configure snap-based scoring, and 0 of 173
-- saved data views referenced it. Real snap data lives in
-- player_gamelogs.snaps_off / snaps_def / snaps_st and was never involved.
--
-- That drop did not reach percentiles.field, because the value is DATA rather
-- than an identifier -- the same gate-invisible class league CLAUDE.md names,
-- and the same one db/adhoc/2026-08-19-conform-percentiles-field-values.sql was
-- the arrears for. 126 rows survived the drop by four months.
--
-- WHY DELETE RATHER THAN RENAME. `snp` is not a stranded spelling with a live
-- target. It is absent from the writer's key set
-- (scripts/generate-nfl-team-seasonlogs.mjs, whose vocabulary is
-- all_fantasy_stats plus its passing/rushing/receiving arrays), absent from
-- libs-shared entirely, and requested by no consumer -- `grep -rn "'snp'"`
-- over app/ libs-shared/ libs-server/ api/ scripts/ returns nothing. Every one
-- of the 126 rows is identically zero in all nine percentile columns and in
-- both bounds, so there is no value here to preserve under another name.
--
-- Verified against league_production 2026-09-02: 126 rows, 126 of them
-- all-zero. After this file, percentiles.field holds no value that fails both
-- halves of the resolution oracle except `cpoe`, which is data+code coupled and
-- is its own unit.

SET search_path = public;

-- Guard: refuse if any snp row carries a non-zero measurement. The audit behind
-- the column drop and the measurement above both say there are none, and a row
-- that appeared since would mean a writer resumed emitting this field -- which
-- makes deletion the wrong action, not a bigger one.
DO $$
DECLARE nonzero int;
BEGIN
  SELECT count(*) INTO nonzero
  FROM public.percentiles
  WHERE field = 'snp'
    AND NOT (
      percentile_25 = 0 AND percentile_50 = 0 AND percentile_75 = 0
      AND percentile_90 = 0 AND percentile_95 = 0 AND percentile_98 = 0
      AND percentile_99 = 0 AND minimum_value = 0 AND maximum_value = 0
    );

  IF nonzero > 0 THEN
    RAISE EXCEPTION
      '% snp row(s) carry a non-zero measurement; a writer is emitting this field again and deletion is wrong',
      nonzero;
  END IF;
END $$;

-- Expected: 126 rows.
DELETE FROM public.percentiles WHERE field = 'snp';

-- POST-CONDITION. Nothing keys on snp any more.
DO $$
DECLARE residual int;
BEGIN
  SELECT count(*) INTO residual FROM public.percentiles WHERE field = 'snp';

  IF residual > 0 THEN
    RAISE EXCEPTION 'percentiles still holds % snp row(s)', residual;
  END IF;
END $$;
