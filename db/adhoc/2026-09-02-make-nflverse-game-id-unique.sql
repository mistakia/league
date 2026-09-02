-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Make nfl_games.nflverse_game_id UNIQUE.
--
-- The nflverse games importer now matches a feed row to nfl_games on this
-- column FIRST, and it reads that match with `.first()` and no ordering. That
-- is non-deterministic the moment a duplicate lands: two stored rows carrying
-- the same feed id would leave the run writing one game's spread line,
-- moneylines, rest days, roof, surface, coaches and referee onto whichever row
-- Postgres happened to return, with nothing in the output saying so.
--
-- The column has always been unique in practice and was simply never enforced
-- -- 7,548 non-null values and 7,548 distinct, measured 2026-09-02. The build
-- IS the check here: a unique index cannot be created over a duplicate, so
-- there is no separate guard above it to keep in agreement with the DDL.
--
-- NULL is unconstrained by a unique index in Postgres, which is what this
-- column wants. 8,074 rows carry no feed id at all -- preseason games and
-- everything before 1999, none of which nflverse publishes -- and they must all
-- stay insertable.
--
-- nfl_games is 9,536 kB across 15,622 rows, so the rebuild is sub-second and
-- needs no non-blocking index build. lock_timeout bounds the wait to ACQUIRE
-- the lock rather than the work done under it.

SET lock_timeout = '30s';

DROP INDEX public.nfl_games_nflverse_game_id;

CREATE UNIQUE INDEX nfl_games_nflverse_game_id
    ON public.nfl_games USING btree (nflverse_game_id);

-- Read the post-condition back rather than inferring it from a clean exit.
DO $$
DECLARE
    index_is_unique boolean;
BEGIN
    SELECT i.indisunique INTO index_is_unique
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = 'nfl_games_nflverse_game_id';

    IF index_is_unique IS NOT TRUE THEN
        RAISE EXCEPTION 'nfl_games_nflverse_game_id did not come back unique';
    END IF;
END
$$;
