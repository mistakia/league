-- STATUS: APPLIED 2026-08-18 against league_production
--
-- Retire `uid` from the trade and claim cluster, the third window of
-- [[user:task/league/retire-uid-surrogate-key-column.md]].
--
--   trades.uid                  -> trade_id
--   transactions.uid            -> transaction_id
--   waivers.uid                 -> waiver_id
--   poaches.uid                 -> poach_id
--   sources.uid                 -> source_id
--   restricted_free_agency_bids.uid -> bid_id
--   leagues.uid                 -> league_id
--   trades_slots.trade_uid      -> trade_id
--   roster_asset_transformation.trade_uid -> trade_id
--
-- Plus the seven matching sequences, the promotion of `trades`'s legacy unique
-- index to a real primary key, the drop of `transactions`'s duplicate index,
-- the two `trade_uid` index renames, and the view output column.
--
-- ---------------------------------------------------------------------------
-- Why these names
-- ---------------------------------------------------------------------------
--
-- The sibling conform campaign's keys batch already shipped the CHILD spellings
-- (`trades_picks.trade_id`, `waivers.waiver_id` on the parent/child link tables,
-- `transactions.transaction_id` in `roster_asset_transformation.transaction_id`,
-- `sources.source_id` in the child keys). This batch moves the PARENT columns to
-- match, which is the whole point of the plan: parent and child spell the key
-- identically (`trades.trade_id = trades_picks.trade_id`).
--
-- `restricted_free_agency_bids.uid` -> `bid_id` follows
-- `bid_changelog.bid_id` and `restricted_free_agency_nominations.winning_bid_id`,
-- which already spell the reference. `leagues.uid` -> `league_id` follows
-- `bid_changelog.league_id`.
--
-- `trades_slots.trade_uid` and `roster_asset_transformation.trade_uid` are the
-- THIRD spelling of the trade reference the plan exists to close: the `uid`
-- token is ratified so the conformance audit cannot see them, and they reach a
-- user-facing URL as the SPA route parameter at app/views/routes.js:147, which
-- the operator ruled moves with no legacy alias.
--
-- ---------------------------------------------------------------------------
-- `trades` gets a primary key; `transactions` drops a duplicate index
-- ---------------------------------------------------------------------------
--
-- `trades` carries ZERO constraints and a lone `idx_25089_uid` unique index, a
-- MySQL-migration name. `ADD CONSTRAINT ... PRIMARY KEY USING INDEX` renames it
-- to `trades_pkey` in place. Verified before authoring: 305 rows, 305 distinct,
-- zero null, so the promotion cannot fail on data the way the `jobs` key did.
-- The guard in step 0 re-checks it at apply time.
--
-- `transactions` carries `idx_25103_uid` beside `transactions_pkey` -- the
-- identical unique btree on the same column, both MySQL-migration artifacts.
-- It is DROPPED rather than renamed, because renaming it would preserve dead
-- weight under a better name.
--
-- `leagues` gained `leagues_pkey` in batch 3 via `idx_24693_uid`; this batch
-- renames the column and the key follows automatically.
--
-- ---------------------------------------------------------------------------
-- What is deliberately NOT in this file
-- ---------------------------------------------------------------------------
--
-- `waivers.uid as wid` (five sites) and `leagues.uid as lid` (one) alias to
-- the DEFERRED app keys. The left half of each moves with the column; the alias
-- target is left alone per the operator ruling. The `check-rename-alias-residue`
-- comment citing `waivers.uid as wid` as its canonical example is rewritten in
-- the same batch's sweep commit, not here.
--
-- db:exec wraps this file in a single transaction; no explicit BEGIN here.

-- ---------------------------------------------------------------------------
-- Step 0 -- refuse if trades cannot take the primary key
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  total_rows bigint;
  distinct_uid bigint;
  null_uid bigint;
BEGIN
  SELECT count(*), count(DISTINCT uid), count(*) FILTER (WHERE uid IS NULL)
  INTO total_rows, distinct_uid, null_uid
  FROM trades;

  IF null_uid > 0 OR distinct_uid <> total_rows THEN
    RAISE EXCEPTION
      'REFUSING: trades holds % rows, % distinct uid, % null -- the primary '
      'key below cannot be established.',
      total_rows, distinct_uid, null_uid;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 1 -- rename the columns
-- ---------------------------------------------------------------------------

ALTER TABLE trades RENAME COLUMN uid TO trade_id;
ALTER TABLE transactions RENAME COLUMN uid TO transaction_id;
ALTER TABLE waivers RENAME COLUMN uid TO waiver_id;
ALTER TABLE poaches RENAME COLUMN uid TO poach_id;
ALTER TABLE sources RENAME COLUMN uid TO source_id;
ALTER TABLE restricted_free_agency_bids RENAME COLUMN uid TO bid_id;
ALTER TABLE leagues RENAME COLUMN uid TO league_id;
ALTER TABLE trades_slots RENAME COLUMN trade_uid TO trade_id;
ALTER TABLE roster_asset_transformation RENAME COLUMN trade_uid TO trade_id;

-- ---------------------------------------------------------------------------
-- Step 2 -- rename the sequences to match
-- ---------------------------------------------------------------------------

ALTER SEQUENCE trades_uid_seq RENAME TO trades_trade_id_seq;
ALTER SEQUENCE transactions_uid_seq RENAME TO transactions_transaction_id_seq;
ALTER SEQUENCE waivers_uid_seq RENAME TO waivers_waiver_id_seq;
ALTER SEQUENCE poaches_uid_seq RENAME TO poaches_poach_id_seq;
ALTER SEQUENCE sources_uid_seq RENAME TO sources_source_id_seq;
ALTER SEQUENCE restricted_free_agency_bids_uid_seq RENAME TO restricted_free_agency_bids_bid_id_seq;
ALTER SEQUENCE leagues_uid_seq RENAME TO leagues_league_id_seq;

-- ---------------------------------------------------------------------------
-- Step 3 -- rename the trade_uid indexes
-- ---------------------------------------------------------------------------

ALTER INDEX trades_slots_trade_uid_idx RENAME TO trades_slots_trade_id_idx;
ALTER INDEX roster_asset_transformation_trade_uid_idx RENAME TO roster_asset_transformation_trade_id_idx;

-- ---------------------------------------------------------------------------
-- Step 4 -- promote the legacy trades index and drop the duplicate
-- ---------------------------------------------------------------------------

ALTER TABLE trades ALTER COLUMN trade_id SET NOT NULL;
ALTER TABLE trades ADD CONSTRAINT trades_pkey PRIMARY KEY USING INDEX idx_25089_uid;

DROP INDEX idx_25103_uid;

-- ---------------------------------------------------------------------------
-- Step 5 -- rename the view output column
-- ---------------------------------------------------------------------------
--
-- CREATE OR REPLACE VIEW cannot change an existing output column's name -- it
-- refuses with ERROR: cannot change name of view column. ALTER VIEW RENAME
-- COLUMN is the verb.

ALTER VIEW view_trade_asset_flow RENAME COLUMN trade_uid TO trade_id;

-- ---------------------------------------------------------------------------
-- Step 6 -- prove the batch landed, on both surfaces
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  surviving_columns bigint;
  surviving_objects bigint;
  new_columns bigint;
  trades_key bigint;
  transactions_uid_indexes bigint;
  view_columns bigint;
BEGIN
  SELECT count(*) INTO surviving_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('trades', 'transactions', 'waivers', 'poaches',
                       'sources', 'restricted_free_agency_bids', 'leagues')
    AND column_name = 'uid';

  IF surviving_columns > 0 THEN
    RAISE EXCEPTION 'REFUSING: % uid columns survive on the batch tables.',
      surviving_columns;
  END IF;

  SELECT count(*) INTO surviving_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('trades_slots', 'roster_asset_transformation')
    AND column_name = 'trade_uid';

  IF surviving_columns > 0 THEN
    RAISE EXCEPTION 'REFUSING: % trade_uid columns survive.',
      surviving_columns;
  END IF;

  SELECT count(*) INTO new_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (table_name, column_name) IN (
      ('trades', 'trade_id'),
      ('transactions', 'transaction_id'),
      ('waivers', 'waiver_id'),
      ('poaches', 'poach_id'),
      ('sources', 'source_id'),
      ('restricted_free_agency_bids', 'bid_id'),
      ('leagues', 'league_id'),
      ('trades_slots', 'trade_id'),
      ('roster_asset_transformation', 'trade_id')
    );

  IF new_columns <> 9 THEN
    RAISE EXCEPTION 'REFUSING: % of 9 renamed columns present.', new_columns;
  END IF;

  -- Any uid-named object across the batch tables, including the sequences and
  -- indexes this file renamed and the promoted trades key.
  SELECT count(*) INTO surviving_objects
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname ~ 'uid'
    AND (c.relname LIKE 'trades%' OR c.relname LIKE 'transactions%'
         OR c.relname LIKE 'waivers%' OR c.relname LIKE 'poaches%'
         OR c.relname LIKE 'sources%' OR c.relname LIKE 'restricted_free_agency_bids%'
         OR c.relname LIKE 'leagues%'
         OR c.relname IN ('idx_25089_uid', 'idx_25103_uid',
                          'trades_slots_trade_uid_idx',
                          'roster_asset_transformation_trade_uid_idx'));

  IF surviving_objects > 0 THEN
    RAISE EXCEPTION 'REFUSING: % uid-named objects survive.', surviving_objects;
  END IF;

  SELECT count(*) INTO trades_key
  FROM pg_constraint WHERE conrelid = 'trades'::regclass AND contype = 'p';

  IF trades_key <> 1 THEN
    RAISE EXCEPTION 'REFUSING: trades carries % primary keys, expected 1.',
      trades_key;
  END IF;

  SELECT count(*) INTO transactions_uid_indexes
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'transactions'
    AND indexname = 'idx_25103_uid';

  IF transactions_uid_indexes <> 0 THEN
    RAISE EXCEPTION 'REFUSING: % idx_25103_uid index(es) survive on transactions.',
      transactions_uid_indexes;
  END IF;

  SELECT count(*) INTO view_columns
  FROM information_schema.columns
  WHERE table_name = 'view_trade_asset_flow' AND column_name = 'trade_id';

  IF view_columns <> 1 THEN
    RAISE EXCEPTION 'REFUSING: view_trade_asset_flow exposes % trade_id column(s).',
      view_columns;
  END IF;

  RAISE NOTICE
    'uid retirement batch 4: 9 columns renamed, 7 sequences renamed, trades_pkey promoted, idx_25103_uid dropped, 2 indexes renamed, view column renamed.';
END $$;
