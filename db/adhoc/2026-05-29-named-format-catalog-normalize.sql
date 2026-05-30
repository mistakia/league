-- Reconcile DB rows with libs-shared/named-format-catalog.mjs after the
-- 2026-05-28 format-id migration. Catalog source has fum_ret_td=6 for the
-- 10 named scoring slugs but the DB rows landed with fum_ret_td=0 (legacy
-- column default). Without this, `yarn generate:formats` misses on the
-- find-or-create tuple and inserts orphan gen_random_uuid() rows instead
-- of resolving to the named slugs.
--
-- Scope: only the 9 distinct named-slug rows (ppr_lower_turnover aliases
-- to draftkings in the catalog). UUID rows are intentionally left at
-- fum_ret_td=0 to preserve existing user-league scoring math.

UPDATE league_scoring_formats
   SET fum_ret_td = 6
 WHERE id IN (
   'draftkings',
   'fanduel',
   'genesis',
   'half_ppr',
   'half_ppr_lower_turnover',
   'ppr',
   'sfb15_mfl',
   'sfb15_sleeper',
   'standard'
 )
   AND fum_ret_td = 0;
