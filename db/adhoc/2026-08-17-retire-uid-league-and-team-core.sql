-- STATUS: APPLIED 2026-08-18 against league_production
--
-- Retire `uid` from the league and team core, the second window of
-- [[user:task/league/retire-uid-surrogate-key-column.md]].
--
--   teams.uid    -> team_id
--   rosters.uid  -> roster_id
--   matchups.uid -> matchup_id
--   draft.uid    -> draft_pick_id
--
-- Plus the four matching sequences, and the promotion of `leagues`'s legacy
-- unique index to a real primary key.
--
-- ---------------------------------------------------------------------------
-- Why these four names
-- ---------------------------------------------------------------------------
--
-- `teams.uid` -> `team_id` and `rosters.uid` -> `roster_id` are the operator
-- ruling plus the vote the schema has already cast: `matchups.home_team_id` /
-- `away_team_id` and the whole `admission_vote_*` family already spell the team
-- reference `team_id`, and `rosters_players`'s primary key is already
-- `roster_id + pid`. `matchups.uid` -> `matchup_id` follows code that already
-- aliases `uid as matchup_id` to get the name it wanted.
--
-- `draft.uid` -> `draft_pick_id` is NOT `pick_id`, and that is the whole point:
-- `draft` already carries `pick`, and the sibling conform campaign renamed
-- `pick_str` to `pick_string`, so `pick_id` would sit between `pick` and
-- `pick_string` as exactly the decode step that campaign exists to remove.
-- Settled with that campaign on 2026-08-17, which shipped
-- `trades_picks.pickid` -> `draft_pick_id` on the child to match, so parent and
-- child now spell the reference identically.
--
-- ---------------------------------------------------------------------------
-- `leagues` gets a primary key, ahead of its own rename
-- ---------------------------------------------------------------------------
--
-- `leagues` carries ZERO constraints and a lone `idx_24693_uid` unique index,
-- a name inherited from the MySQL migration. Promoting it here rather than in
-- the trade/claim window costs nothing -- `ADD CONSTRAINT ... PRIMARY KEY USING
-- INDEX` renames the index in place, so no second index is built and no table
-- is rewritten -- and it retires a `uid`-named object one window early. The
-- COLUMN stays `uid` until the trade/claim batch renames it; the primary key
-- then follows that rename automatically, because Postgres rewrites the parse
-- trees behind dependent constraints.
--
-- Verified before authoring: 116 rows, 116 non-null, 116 distinct, so the
-- promotion cannot fail on data the way the `jobs` key did. The guard in step 0
-- re-checks it at apply time rather than trusting that reading.
--
-- ---------------------------------------------------------------------------
-- What is deliberately NOT in this file
-- ---------------------------------------------------------------------------
--
-- `draft`, `matchups` and `rosters` carry legacy MySQL-named primary keys
-- (`idx_24608_PRIMARY`, `idx_24699_PRIMARY`, `idx_24995_PRIMARY`). They do NOT
-- contain `uid`, so retiring the column does not strand them and they are
-- outside this plan's scope. Renaming them is a defensible cleanup and belongs
-- in its own change rather than widening a window that already carries the
-- largest SPA surface in the plan.
--
-- `idx_leagues_commishid` still names `commishid` though the column is now
-- `commissioner_user_id` -- a remnant of the sibling campaign's keys batch, not
-- this one's, and left for its owner.
--
-- db:exec wraps this file in a single transaction; no explicit BEGIN here.

-- ---------------------------------------------------------------------------
-- Step 0 -- refuse if leagues cannot take the primary key
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  total_rows bigint;
  distinct_uid bigint;
  null_uid bigint;
BEGIN
  SELECT count(*), count(DISTINCT uid), count(*) FILTER (WHERE uid IS NULL)
  INTO total_rows, distinct_uid, null_uid
  FROM leagues;

  IF null_uid > 0 OR distinct_uid <> total_rows THEN
    RAISE EXCEPTION
      'REFUSING: leagues holds % rows, % distinct uid, % null -- the primary '
      'key below cannot be established.',
      total_rows, distinct_uid, null_uid;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 1 -- rename the columns
-- ---------------------------------------------------------------------------

ALTER TABLE teams RENAME COLUMN uid TO team_id;
ALTER TABLE rosters RENAME COLUMN uid TO roster_id;
ALTER TABLE matchups RENAME COLUMN uid TO matchup_id;
ALTER TABLE draft RENAME COLUMN uid TO draft_pick_id;

-- ---------------------------------------------------------------------------
-- Step 2 -- rename the sequences to match
-- ---------------------------------------------------------------------------

ALTER SEQUENCE teams_uid_seq RENAME TO teams_team_id_seq;
ALTER SEQUENCE rosters_uid_seq RENAME TO rosters_roster_id_seq;
ALTER SEQUENCE matchups_uid_seq RENAME TO matchups_matchup_id_seq;
ALTER SEQUENCE draft_uid_seq RENAME TO draft_draft_pick_id_seq;

-- ---------------------------------------------------------------------------
-- Step 3 -- promote the legacy leagues unique index to a primary key
-- ---------------------------------------------------------------------------
--
-- USING INDEX renames idx_24693_uid to leagues_pkey in place rather than
-- building a second index.

ALTER TABLE leagues ALTER COLUMN uid SET NOT NULL;
ALTER TABLE leagues ADD CONSTRAINT leagues_pkey PRIMARY KEY USING INDEX idx_24693_uid;

-- ---------------------------------------------------------------------------
-- Step 4 -- prove the batch landed, on both surfaces
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  surviving_columns bigint;
  surviving_objects bigint;
  new_columns bigint;
  leagues_key bigint;
BEGIN
  SELECT count(*) INTO surviving_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('teams', 'rosters', 'matchups', 'draft')
    AND column_name = 'uid';

  IF surviving_columns > 0 THEN
    RAISE EXCEPTION 'REFUSING: % uid columns survive on the batch tables.',
      surviving_columns;
  END IF;

  SELECT count(*) INTO new_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (table_name, column_name) IN (
      ('teams', 'team_id'),
      ('rosters', 'roster_id'),
      ('matchups', 'matchup_id'),
      ('draft', 'draft_pick_id')
    );

  IF new_columns <> 4 THEN
    RAISE EXCEPTION 'REFUSING: % of 4 renamed columns present.', new_columns;
  END IF;

  -- Covers the four batch tables AND the promoted leagues index, which is the
  -- one uid-named object this window retires without renaming a column.
  SELECT count(*) INTO surviving_objects
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname ~ 'uid'
    AND (c.relname LIKE 'teams%' OR c.relname LIKE 'rosters%'
         OR c.relname LIKE 'matchups%' OR c.relname LIKE 'draft%'
         OR c.relname = 'idx_24693_uid');

  IF surviving_objects > 0 THEN
    RAISE EXCEPTION 'REFUSING: % uid-named objects survive.', surviving_objects;
  END IF;

  SELECT count(*) INTO leagues_key
  FROM pg_constraint WHERE conrelid = 'leagues'::regclass AND contype = 'p';

  IF leagues_key <> 1 THEN
    RAISE EXCEPTION 'REFUSING: leagues carries % primary keys, expected 1.',
      leagues_key;
  END IF;

  RAISE NOTICE
    'uid retirement batch 3: 4 columns renamed, 4 sequences renamed, leagues_pkey promoted.';
END $$;
