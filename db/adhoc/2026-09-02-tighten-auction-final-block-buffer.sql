-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Tighten the auction final-block buffer to a three-hour ceiling.
--
-- Operator ruling, 2026-09-02. The final-block buffer is the fixed slack held
-- between the pace-driven end of the mandatory live block and the period
-- close. It was introduced at twelve, as both the column default and the CHECK
-- ceiling (seventy-two, a bound no real window approaches), so a league-season
-- could silently claim a half-day slab of a free agency period that runs about
-- five days. Three hours still clears the block's pacing reservation ahead of
-- the period end while leaving the window's other claims -- notice and the
-- minimum election window -- room to breathe.
--
-- Pure tightening: nothing widens, one tunable narrows, and the UPDATE and the
-- CHECK share one db:exec transaction, so the new constraint never lands over
-- data that violates it.
--
-- Two measured notes.
--
-- - 121 `seasons` rows carry the old default of 12: league 1's 2020-2025
--   seasons and the 2023 test-league seasons. They are inert outside their own
--   periods, and they come down to 3 to satisfy the ceiling -- which is the
--   ruling anyway. The 2026 live leagues (1 and 119) were set to 3 ahead of
--   this file, so the UPDATE matches exactly these.
-- - The guard asserts that count before updating, because an UPDATE whose
--   predicate matches nothing reports success and the apply still reads done.

SET lock_timeout = '30s';

DO $$
DECLARE
    expected integer := 121;
    actual integer;
BEGIN
    SELECT count(*) INTO actual FROM public.seasons
    WHERE auction_final_block_buffer_hours > 3;
    IF actual <> expected THEN
        RAISE EXCEPTION 'expected % rows over the 3h ceiling, found %', expected, actual;
    END IF;
END
$$;

UPDATE public.seasons
SET auction_final_block_buffer_hours = 3
WHERE auction_final_block_buffer_hours > 3;

-- The default carries the ruling forward: a league-season created after this
-- lands at 3, not at the old 12.
ALTER TABLE public.seasons
    ALTER COLUMN auction_final_block_buffer_hours SET DEFAULT 3;

-- The old ceiling (72), named for only the lower half of what it constrained.
ALTER TABLE public.seasons
    DROP CONSTRAINT auction_final_block_buffer_positive;

-- The operator ceiling, named for the whole range it constrains.
ALTER TABLE public.seasons
    ADD CONSTRAINT auction_final_block_buffer_within_bounds
    CHECK ((auction_final_block_buffer_hours > 0) AND (auction_final_block_buffer_hours <= 3));
