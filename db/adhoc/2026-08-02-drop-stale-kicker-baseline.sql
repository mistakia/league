-- STATUS: APPLIED 2026-08-02 against league_production
--
-- Remove the week-0 kicker baseline the distributional season board orphaned.
--
-- league_baselines is upserted and never deleted, so a row the producer stops
-- writing survives forever with whatever the last writer left in it. The season
-- board excludes kickers -- they are not drawn, because no league here starts
-- one -- so it writes no K row, and league 1's pre-cutover K row stayed behind
-- carrying a pid and a NULL `points`.
--
-- A NULL there is worse than absent: project-lineups.mjs reads
-- `Number(baseline.points) || 0`, so it resolves to a replacement level of zero
-- rather than to "no such baseline". Harmless while no league starts a kicker,
-- and exactly the shape that stops being harmless the moment one does.
--
-- Scoped to lid > 0 deliberately. There are six lid = 0 rows with the same
-- shape, plus a `historical` baseline type nothing in the current pipeline
-- writes; those are orphans from an earlier era and are not this change's to
-- clean up.

DELETE FROM public.league_baselines
  WHERE week = '0'
    AND type = 'starter'
    AND points IS NULL
    AND lid > 0;
