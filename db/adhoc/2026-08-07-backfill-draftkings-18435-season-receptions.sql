-- STATUS: APPLIED 2026-08-07 against league_production
--
-- Backfill market_type on the 2025 DraftKings season-receptions markets that
-- were ingested while offer 1759 / subcategory 18435 was still unmapped.
--
-- DraftKings re-keys this subcategory each season. 18435 carried season
-- receptions through 2025 (first seen 2025-08-22, last seen 2025-09-05); 20168
-- replaced it for 2026. eb4d97ae8 added the 20168 mapping, and the import has
-- since re-typed all 86 of the 2026 rows on its own, so they need nothing here.
-- The 18435 mapping was likewise added to the code at the time, but the rows
-- already sitting in prop_markets_index were never backfilled and still carry
-- market_type IS NULL.
--
-- Population verified before writing: 106 rows, every one source_id =
-- 'DRAFTKINGS', every one named 'Player Futures - Receptions - Regular Season
-- Receptions (categoryId: 1759, subcategoryId: 18435, betOfferTypeId: 0)', and
-- every one market_type IS NULL. No row carries a conflicting non-null type.
--
-- prop_markets_history has no market_type column at all, so there is no
-- corresponding null to repair there.
--
-- This does NOT touch season_year, which is null on 60 of these rows. That is a
-- separate gap and is deliberately left alone.

UPDATE prop_markets_index
SET market_type = 'SEASON_RECEPTIONS'
WHERE source_id = 'DRAFTKINGS'
  AND source_market_name LIKE '%subcategoryId: 18435%'
  AND source_market_name LIKE '%Regular Season Receptions%'
  AND market_type IS NULL;

-- Fail the transaction if the population moved between the pre-write survey and
-- this run, rather than silently applying to a different row set.
DO $$
DECLARE
  remaining integer;
  typed integer;
BEGIN
  SELECT count(*) INTO remaining
  FROM prop_markets_index
  WHERE source_market_name LIKE '%subcategoryId: 18435%'
    AND market_type IS NULL;

  SELECT count(*) INTO typed
  FROM prop_markets_index
  WHERE source_market_name LIKE '%subcategoryId: 18435%'
    AND market_type = 'SEASON_RECEPTIONS';

  IF remaining <> 0 THEN
    RAISE EXCEPTION 'expected 0 untyped 18435 markets after backfill, found %', remaining;
  END IF;

  IF typed <> 106 THEN
    RAISE EXCEPTION 'expected 106 typed 18435 markets after backfill, found %', typed;
  END IF;
END $$;
