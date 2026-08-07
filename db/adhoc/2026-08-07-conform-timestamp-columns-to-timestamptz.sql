-- STATUS: PENDING
--
-- Conform 24 time-bearing columns across 11 league tables to timestamptz,
-- renaming the four spelled `timestamp` off the reserved word in the same pass.
--
-- Clears 20 schema-conformance findings: 16 [timestamp_type] and 4
-- [reserved_word]. The four renamed columns carry both.
--
-- NO BEGIN/COMMIT IN THIS FILE. scripts/db-exec.sh runs it under
-- --single-transaction; a file's own COMMIT ends the OUTER transaction early and
-- every statement after it loses rollback. Three committed files in this program
-- shipped that defect, including the closest precedent to this one
-- (2026-07-29-league-notifications-season-year-and-timestamptz.sql).
--
--
-- SCOPE IS 24 COLUMNS, NOT THE AUDIT'S 16
--
-- db/tools/audit-schema-conformance.mjs reports 16. It cannot see the other 8.
-- Its `looks_like_time_column` (line 429) keys on a
-- /(_at|_time|_ts|timestamp|_date)$/ suffix and `known_time_columns` is empty,
-- so a time column named without one of those endings is invisible to it. All 8
-- are `seasons` calendar instants: draft_start, tddate,
-- free_agency_period_{start,end}, free_agency_live_auction_{start,end},
-- restricted_free_agency_period_{start,end}.
--
-- Conforming only the flagged members would be actively worse than conforming
-- none. libs-server/context-docs/league-calendar.mjs enumerates ELEVEN of these
-- fields as one homogeneous set and, at build_league_calendar, does
-- `Number(league[field])` into a single sort and a single `< now` comparison.
-- Mixing conformed and unconformed members puts `Number(Date)` -- milliseconds --
-- into the same sort as unconformed integer SECONDS, which is a factor-of-1000
-- error: every conformed field sorts last and reads 'upcoming' forever, and the
-- calendar silently reorders. app/core/selectors.js names 13 of them together
-- and has the same shape. This is the "partly visible sibling family" defect the
-- program has now recorded three times (pff_team_gamelogs.wins/losses/ties, the
-- Sportradar ten, and now this).
--
--
-- UNITS, SETTLED AGAINST PRODUCTION DATA RATHER THAN INFERRED FROM TYPE
--
-- An integer epoch is seconds; a bigint may be seconds or milliseconds and the
-- two are indistinguishable by type. Measured on 2026-08-07:
--
--   SECONDS (23 columns) -- every integer column, AND every `seasons` bigint.
--   Observed ranges all fall in 1595563200 .. 1797137999, i.e. 2020-07-24 to
--   2026-12-11. A milliseconds reading of those values would land in 1970.
--
--   MILLISECONDS (1 column) -- league_team_daily_values.timestamp ONLY, range
--   1595563200000 .. 1785988800000. This is the trap in this cluster: it is the
--   one bigint that is NOT seconds, and to_timestamp() on it unscaled lands in
--   the year 52528. Every value's `% 1000` remainder is 0.
--
-- INDEPENDENT-EXPRESSION PROOFS (the nfl_games."timestamp" method: compare the
-- conversion against an expression derived some other way, and require zero
-- disagreements AND zero NULL-vacuous comparisons):
--
--   league_team_daily_values -- the table carries its own `date` column.
--     12466 rows, 0 null-vacuous, 0 disagreements against
--     (to_timestamp(timestamp/1000.0) AT TIME ZONE 'America/New_York')::date.
--     The same comparison read as UTC disagrees on 244 rows, which is what
--     makes this a proof of the zone and not just of the scale.
--
--   roster_asset_transformation.occurred_at -- joined to transactions."timestamp"
--     through its own transaction_id FK. 6324 rows, 0 null-vacuous, 38
--     disagreements, ALL of them between -13 and -1 seconds (write latency: the
--     row is stamped a moment before the transaction is). Never an hour, never a
--     day. Read as UTC, all 6324 disagree. Zone is America/New_York, which is
--     also this server's TimeZone setting.
--
-- BOUNDED RATHER THAN PROVEN (no independent expression exists): the remaining
-- epoch columns are bounded by the DO block at the foot of this file, which
-- asserts every converted value lands in 2019-01-01 .. 2035-01-01. Three columns
-- hold zero non-null rows and so are metadata-only conversions with nothing to
-- disagree about: leagues.archived_at (only ever read via whereNull),
-- seasons.season_started_at, matchups.simulation_timestamp.
--
--
-- THE THREE NAIVE COLUMNS ARE LOCAL, NOT UTC
--
-- config.updated_at, matchups.simulation_timestamp and
-- roster_asset_transformation.occurred_at are `timestamp without time zone`.
-- A naive column has no zone, so the USING clause has to supply one and getting
-- it wrong shifts every value by 4-5 hours silently. All three are
-- America/New_York:
--   - the server's TimeZone is America/New_York, so a naive column defaulted
--     from CURRENT_TIMESTAMP stores local wall-clock. config.updated_at's max
--     reads 16:01 local against a 17:50 local now(); a UTC store would read
--     20:01.
--   - roster_asset_transformation.occurred_at is proven local by the FK
--     comparison above.
-- `AT TIME ZONE 'America/New_York'` applied to a naive timestamp INTERPRETS it
-- as New York wall-clock and yields the timestamptz instant, which is the
-- direction wanted here.
--
--
-- WHAT THIS REWRITES, AND FOR HOW LONG
--
-- Unlike the rename clusters in this program, ALTER TABLE ... TYPE is NOT
-- catalog-only: it rewrites the table and holds ACCESS EXCLUSIVE for the
-- duration. Row counts and heap+index sizes as of authoring:
--
--   jobs                          1,512,655 rows   441 MB   <- the only one that matters
--   league_team_daily_values         12,466 rows  2528 kB
--   transactions                     12,227 rows  4248 kB
--   league_team_forecast              8,290 rows  1144 kB
--   roster_asset_transformation       7,730 rows  5456 kB
--   matchups 456 / draft 384 / seasons 122 / leagues 116 / config 26 / super_priority 16
--
-- Estimated lock: `jobs` a few seconds (single narrow column, one full rewrite of
-- a 441 MB heap); everything else sub-second. The whole file should hold its
-- locks well under a minute. Note this corrects the plan's guess that
-- `transactions` was a table to worry about -- it is 12k rows.
--
--
-- DEPENDENT OBJECTS
--
-- view_trade_asset_flow SELECTs roster_asset_transformation.occurred_at, so
-- Postgres refuses the retype while it exists. It is dropped and recreated
-- verbatim below, WITH its comment and its league_reader grant -- a dropped view
-- takes its ACL with it, and silently losing the grant would read as drift on
-- the next schema export.
--
-- view_roster_asset_lineage_walk also depends on the table but references only
-- source_holding_id / target_holding_id / transformation_type, so it does not
-- block the retype and is left alone.
--
-- No index or constraint needs renaming: none of the four renamed columns is
-- indexed, and the indexes that DO cover retyped columns
-- (idx_super_priority_poach_timestamp, unique_super_priority,
-- idx_matchups_simulation_timestamp, roster_asset_transformation_lid_occurred_idx)
-- keep their names because their columns keep theirs. Postgres rebuilds them in
-- place. No identifier here approaches the 63-byte cap.
--
-- No PL/pgSQL function body names any of these 24 columns (checked against
-- pg_proc.prosrc, since a renamed column leaves a body compiling and throwing at
-- call time and no repo grep reaches it).
--
-- All NOT NULL columns stay NOT NULL; ALTER TYPE preserves it.

-- ---------------------------------------------------------------------------
-- config
-- ---------------------------------------------------------------------------
-- The DEFAULT is dropped and restored around the retype. Postgres will not
-- re-cast an existing default expression through a USING clause, so leaving it
-- in place fails with "default for column cannot be cast automatically".

ALTER TABLE public.config
  ALTER COLUMN updated_at DROP DEFAULT;

ALTER TABLE public.config
  ALTER COLUMN updated_at TYPE timestamptz
  USING updated_at AT TIME ZONE 'America/New_York';

ALTER TABLE public.config
  ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------------
-- draft
-- ---------------------------------------------------------------------------
-- Retires the debt 2026-08-05-retype-draft-expired-at-timestamptz.sql explicitly
-- deferred: expired_at was conformed then and selection_timestamp left as
-- pre-existing baselined debt with a wider blast radius. This is that pass.

ALTER TABLE public.draft
  ALTER COLUMN selection_timestamp TYPE timestamptz
  USING to_timestamp(selection_timestamp);

-- ---------------------------------------------------------------------------
-- jobs -- reserved word + retype. 1.5M rows, the long lock in this file.
-- ---------------------------------------------------------------------------

ALTER TABLE public.jobs
  RENAME COLUMN "timestamp" TO run_at;

ALTER TABLE public.jobs
  ALTER COLUMN run_at TYPE timestamptz
  USING to_timestamp(run_at);

-- ---------------------------------------------------------------------------
-- league_team_daily_values -- reserved word + retype. THE MILLISECONDS COLUMN.
-- ---------------------------------------------------------------------------

ALTER TABLE public.league_team_daily_values
  RENAME COLUMN "timestamp" TO observed_at;

ALTER TABLE public.league_team_daily_values
  ALTER COLUMN observed_at TYPE timestamptz
  USING to_timestamp(observed_at / 1000.0);

-- ---------------------------------------------------------------------------
-- league_team_forecast -- reserved word + retype
-- ---------------------------------------------------------------------------

ALTER TABLE public.league_team_forecast
  RENAME COLUMN "timestamp" TO generated_at;

ALTER TABLE public.league_team_forecast
  ALTER COLUMN generated_at TYPE timestamptz
  USING to_timestamp(generated_at);

-- ---------------------------------------------------------------------------
-- leagues
-- ---------------------------------------------------------------------------

ALTER TABLE public.leagues
  ALTER COLUMN processed_at TYPE timestamptz
  USING to_timestamp(processed_at);

ALTER TABLE public.leagues
  ALTER COLUMN archived_at TYPE timestamptz
  USING to_timestamp(archived_at);

-- ---------------------------------------------------------------------------
-- matchups
-- ---------------------------------------------------------------------------

ALTER TABLE public.matchups
  ALTER COLUMN simulation_timestamp TYPE timestamptz
  USING simulation_timestamp AT TIME ZONE 'America/New_York';

-- ---------------------------------------------------------------------------
-- roster_asset_transformation -- view_trade_asset_flow blocks this one
-- ---------------------------------------------------------------------------

DROP VIEW public.view_trade_asset_flow;

ALTER TABLE public.roster_asset_transformation
  ALTER COLUMN occurred_at TYPE timestamptz
  USING occurred_at AT TIME ZONE 'America/New_York';

CREATE VIEW public.view_trade_asset_flow AS
 SELECT t.lid,
    t.trade_uid,
    t.transformation_id,
    t.occurred_at,
    t.source_holding_id,
    t.target_holding_id,
    src.tid AS from_tid,
    tgt.tid AS to_tid,
    tgt.asset_type,
    tgt.player_id,
    tgt.pick_year,
    tgt.pick_round,
    tgt.pick_original_owner_tid,
    src.keeptradecut_value_at_termination AS keeptradecut_value_at_trade,
    src.salary_paid AS salary_paid_at_trade,
    src.realized_pts_added_net_through_termination AS pts_added_before_trade,
    tgt.terminated_by AS post_trade_terminated_by,
    tgt.period_end AS post_trade_period_end
   FROM ((public.roster_asset_transformation t
     JOIN public.roster_asset_holding src ON ((src.holding_id = t.source_holding_id)))
     JOIN public.roster_asset_holding tgt ON ((tgt.holding_id = t.target_holding_id)))
  WHERE (t.transformation_type = 1);

COMMENT ON VIEW public.view_trade_asset_flow IS 'One row per trade leg: which team gave up which asset to whom, and what that asset was worth when it moved. keeptradecut_value_at_trade is the source holding''s KeepTradeCut value at the moment it left, in the league''s own market format class. Join target_holding_id to view_roster_asset_lineage_walk.originating_holding_id to follow what the asset later became.';

GRANT SELECT ON TABLE public.view_trade_asset_flow TO league_reader;

-- ---------------------------------------------------------------------------
-- seasons -- 12 calendar instants, bigint unix SECONDS throughout.
-- Four are audit-flagged; eight are invisible to its suffix rule. See the
-- scope note in the header for why taking only the four would break the
-- calendar rather than half-fix it.
-- ---------------------------------------------------------------------------

ALTER TABLE public.seasons
  ALTER COLUMN season_started_at TYPE timestamptz
  USING to_timestamp(season_started_at);

ALTER TABLE public.seasons
  ALTER COLUMN ext_date TYPE timestamptz
  USING to_timestamp(ext_date);

ALTER TABLE public.seasons
  ALTER COLUMN rookie_draft_completed_at TYPE timestamptz
  USING to_timestamp(rookie_draft_completed_at);

ALTER TABLE public.seasons
  ALTER COLUMN season_finalized_at TYPE timestamptz
  USING to_timestamp(season_finalized_at);

ALTER TABLE public.seasons
  ALTER COLUMN draft_start TYPE timestamptz
  USING to_timestamp(draft_start);

ALTER TABLE public.seasons
  ALTER COLUMN tddate TYPE timestamptz
  USING to_timestamp(tddate);

ALTER TABLE public.seasons
  ALTER COLUMN free_agency_period_start TYPE timestamptz
  USING to_timestamp(free_agency_period_start);

ALTER TABLE public.seasons
  ALTER COLUMN free_agency_period_end TYPE timestamptz
  USING to_timestamp(free_agency_period_end);

ALTER TABLE public.seasons
  ALTER COLUMN free_agency_live_auction_start TYPE timestamptz
  USING to_timestamp(free_agency_live_auction_start);

ALTER TABLE public.seasons
  ALTER COLUMN free_agency_live_auction_end TYPE timestamptz
  USING to_timestamp(free_agency_live_auction_end);

ALTER TABLE public.seasons
  ALTER COLUMN restricted_free_agency_period_start TYPE timestamptz
  USING to_timestamp(restricted_free_agency_period_start);

ALTER TABLE public.seasons
  ALTER COLUMN restricted_free_agency_period_end TYPE timestamptz
  USING to_timestamp(restricted_free_agency_period_end);

-- ---------------------------------------------------------------------------
-- super_priority
-- ---------------------------------------------------------------------------

ALTER TABLE public.super_priority
  ALTER COLUMN poach_timestamp TYPE timestamptz
  USING to_timestamp(poach_timestamp);

ALTER TABLE public.super_priority
  ALTER COLUMN claimed_at TYPE timestamptz
  USING to_timestamp(claimed_at);

-- ---------------------------------------------------------------------------
-- transactions -- reserved word + retype
-- ---------------------------------------------------------------------------

ALTER TABLE public.transactions
  RENAME COLUMN "timestamp" TO occurred_at;

ALTER TABLE public.transactions
  ALTER COLUMN occurred_at TYPE timestamptz
  USING to_timestamp(occurred_at);

-- ---------------------------------------------------------------------------
-- Verification. Every assertion RAISEs, so a failure rolls the whole file back
-- under db-exec.sh's --single-transaction wrapper.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  wrong_count int;
  bad_range int;
  reserved_count int;
  daily_disagreements int;
  observed_lo timestamptz;
  observed_hi timestamptz;
BEGIN
  -- 1. All 24 columns are timestamptz.
  SELECT count(*) INTO wrong_count
  FROM (VALUES
    ('config','updated_at'), ('draft','selection_timestamp'),
    ('jobs','run_at'), ('league_team_daily_values','observed_at'),
    ('league_team_forecast','generated_at'),
    ('leagues','processed_at'), ('leagues','archived_at'),
    ('matchups','simulation_timestamp'),
    ('roster_asset_transformation','occurred_at'),
    ('seasons','season_started_at'), ('seasons','ext_date'),
    ('seasons','rookie_draft_completed_at'), ('seasons','season_finalized_at'),
    ('seasons','draft_start'), ('seasons','tddate'),
    ('seasons','free_agency_period_start'), ('seasons','free_agency_period_end'),
    ('seasons','free_agency_live_auction_start'),
    ('seasons','free_agency_live_auction_end'),
    ('seasons','restricted_free_agency_period_start'),
    ('seasons','restricted_free_agency_period_end'),
    ('super_priority','poach_timestamp'), ('super_priority','claimed_at'),
    ('transactions','occurred_at')
  ) AS expected(tbl, col)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = expected.tbl
   AND c.column_name = expected.col
  WHERE c.data_type IS DISTINCT FROM 'timestamp with time zone';

  IF wrong_count <> 0 THEN
    RAISE EXCEPTION '% of 24 columns are missing or not timestamptz', wrong_count;
  END IF;

  -- 2. No column named `timestamp` survives on the four renamed tables.
  SELECT count(*) INTO reserved_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'timestamp'
    AND table_name IN ('jobs','league_team_daily_values',
                       'league_team_forecast','transactions');
  IF reserved_count <> 0 THEN
    RAISE EXCEPTION '% reserved-word `timestamp` columns survived the rename', reserved_count;
  END IF;

  -- 3. Every converted value lands in a plausible calendar range. This is the
  --    bound that catches a units error: a seconds value read as milliseconds
  --    lands in 1970, and a milliseconds value read as seconds lands in 52528.
  SELECT
    (SELECT count(*) FROM config WHERE updated_at IS NOT NULL AND (updated_at < '2019-01-01Z' OR updated_at > '2035-01-01Z'))
  + (SELECT count(*) FROM draft WHERE selection_timestamp IS NOT NULL AND (selection_timestamp < '2019-01-01Z' OR selection_timestamp > '2035-01-01Z'))
  + (SELECT count(*) FROM jobs WHERE run_at IS NOT NULL AND (run_at < '2019-01-01Z' OR run_at > '2035-01-01Z'))
  + (SELECT count(*) FROM league_team_daily_values WHERE observed_at IS NOT NULL AND (observed_at < '2019-01-01Z' OR observed_at > '2035-01-01Z'))
  + (SELECT count(*) FROM league_team_forecast WHERE generated_at IS NOT NULL AND (generated_at < '2019-01-01Z' OR generated_at > '2035-01-01Z'))
  + (SELECT count(*) FROM leagues WHERE processed_at IS NOT NULL AND (processed_at < '2019-01-01Z' OR processed_at > '2035-01-01Z'))
  + (SELECT count(*) FROM leagues WHERE archived_at IS NOT NULL AND (archived_at < '2019-01-01Z' OR archived_at > '2035-01-01Z'))
  + (SELECT count(*) FROM matchups WHERE simulation_timestamp IS NOT NULL AND (simulation_timestamp < '2019-01-01Z' OR simulation_timestamp > '2035-01-01Z'))
  + (SELECT count(*) FROM roster_asset_transformation WHERE occurred_at IS NOT NULL AND (occurred_at < '2019-01-01Z' OR occurred_at > '2035-01-01Z'))
  + (SELECT count(*) FROM super_priority WHERE poach_timestamp IS NOT NULL AND (poach_timestamp < '2019-01-01Z' OR poach_timestamp > '2035-01-01Z'))
  + (SELECT count(*) FROM super_priority WHERE claimed_at IS NOT NULL AND (claimed_at < '2019-01-01Z' OR claimed_at > '2035-01-01Z'))
  + (SELECT count(*) FROM transactions WHERE occurred_at IS NOT NULL AND (occurred_at < '2019-01-01Z' OR occurred_at > '2035-01-01Z'))
  + (SELECT count(*) FROM seasons WHERE
        (season_started_at IS NOT NULL AND (season_started_at < '2019-01-01Z' OR season_started_at > '2035-01-01Z'))
     OR (ext_date IS NOT NULL AND (ext_date < '2019-01-01Z' OR ext_date > '2035-01-01Z'))
     OR (rookie_draft_completed_at IS NOT NULL AND (rookie_draft_completed_at < '2019-01-01Z' OR rookie_draft_completed_at > '2035-01-01Z'))
     OR (season_finalized_at IS NOT NULL AND (season_finalized_at < '2019-01-01Z' OR season_finalized_at > '2035-01-01Z'))
     OR (draft_start IS NOT NULL AND (draft_start < '2019-01-01Z' OR draft_start > '2035-01-01Z'))
     OR (tddate IS NOT NULL AND (tddate < '2019-01-01Z' OR tddate > '2035-01-01Z'))
     OR (free_agency_period_start IS NOT NULL AND (free_agency_period_start < '2019-01-01Z' OR free_agency_period_start > '2035-01-01Z'))
     OR (free_agency_period_end IS NOT NULL AND (free_agency_period_end < '2019-01-01Z' OR free_agency_period_end > '2035-01-01Z'))
     OR (free_agency_live_auction_start IS NOT NULL AND (free_agency_live_auction_start < '2019-01-01Z' OR free_agency_live_auction_start > '2035-01-01Z'))
     OR (free_agency_live_auction_end IS NOT NULL AND (free_agency_live_auction_end < '2019-01-01Z' OR free_agency_live_auction_end > '2035-01-01Z'))
     OR (restricted_free_agency_period_start IS NOT NULL AND (restricted_free_agency_period_start < '2019-01-01Z' OR restricted_free_agency_period_start > '2035-01-01Z'))
     OR (restricted_free_agency_period_end IS NOT NULL AND (restricted_free_agency_period_end < '2019-01-01Z' OR restricted_free_agency_period_end > '2035-01-01Z')))
  INTO bad_range;

  IF bad_range <> 0 THEN
    RAISE EXCEPTION '% converted values fall outside 2019-01-01 .. 2035-01-01', bad_range;
  END IF;

  -- 4. The milliseconds column specifically: re-run the independent-expression
  --    check against the table's own `date`. This is the one conversion whose
  --    scale differs from every other column here, so it gets the proof rather
  --    than only the bound. Zero disagreements AND zero NULL-vacuous rows.
  SELECT count(*) INTO daily_disagreements
  FROM league_team_daily_values
  WHERE observed_at IS NULL
     OR date IS NULL
     OR (observed_at AT TIME ZONE 'America/New_York')::date <> date;

  IF daily_disagreements <> 0 THEN
    RAISE EXCEPTION 'league_team_daily_values.observed_at disagrees with date on % rows', daily_disagreements;
  END IF;

  SELECT min(observed_at), max(observed_at) INTO observed_lo, observed_hi
  FROM league_team_daily_values;
  RAISE NOTICE 'league_team_daily_values.observed_at spans % .. %', observed_lo, observed_hi;

  -- 5. view_trade_asset_flow came back, with its grant.
  IF NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='view_trade_asset_flow') THEN
    RAISE EXCEPTION 'view_trade_asset_flow was not recreated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_name='view_trade_asset_flow' AND grantee='league_reader' AND privilege_type='SELECT'
  ) THEN
    RAISE EXCEPTION 'view_trade_asset_flow lost its league_reader SELECT grant';
  END IF;
END $$;
