-- STATUS: APPLIED 2026-08-08 against league_production
--
-- Retype the fourteen integer-epoch transaction lifecycle stamps to timestamptz.
--
-- trades.vetoed IS THE FOURTEENTH AND THE AUDIT CANNOT SEE IT. The audit's
-- known_time_columns set is hand-maintained and held exactly the fifteen columns
-- the value-based sweep decoded; vetoed is 0 non-null across all 303 rows, so
-- that sweep had nothing to decode and the column was never listed. It is
-- integer epoch of the same class as the four trades columns beside it, and it
-- is included here on the operator's ruling of 2026-08-08 rather than left to
-- split an obvious sibling set. It is added to known_time_columns in the same
-- commit so a future regression is visible to the audit.
--
-- Its two WRITERS are the reason this is not free, and both are the
-- insert-payload class the gate structurally cannot see:
--   api/routes/leagues/trade.mjs:1547  unaccepted-trade veto path
--   api/routes/leagues/trade.mjs:1676  accepted-trade reversal path
-- Both bound Math.round(vetoed_occurred_at.getTime() / 1000); both now bind the
-- Date the reversal transactions already use, so commissioner veto keeps working
-- across the apply. Every read of vetoed is a null check or a truthiness test
-- and needed no change.
--
-- APPLIED 2026-08-08 in one window with the companion play-mtime file, on the
-- operator's ruling. Instant: fourteen columns over 11,855 rows, 2 seconds wall.
-- The SPA-visible window described at the bottom was closed by deploying the
-- frontend in the same window rather than at cluster end.
--
-- A PURE RETYPE IS SUFFICIENT -- NO RENAME IS NEEDED, and that was verified
-- rather than assumed. The prior timestamp clusters renamed as they retyped
-- (nfl_games.timestamp -> kickoff_at, transactions.timestamp -> occurred_at),
-- so `_at` names looked mandatory. They are not: the timestamp_type rule keys on
-- TYPE alone. Running the audit against a candidate schema carrying these
-- fifteen retypes and no renames reports exactly ONE finding schema-wide,
-- league_formats.cap, which belongs to
-- user:task/league/separate-auction-economy-from-format-identity.md. Renaming
-- would therefore have been a consumer sweep bought for nothing.
--
-- THE nfl_plays PAIR IS SPLIT OUT, AND THE REASON IS NOT THE ONE THE TASK
-- PREDICTED. The task expected to split on consumer population, the play tables
-- being "a far larger consumer population". Measured with
-- db/gates/check-retyped-column-arithmetic.mjs against a candidate carrying all
-- fifteen retypes, nfl_plays.updated and nfl_plays_current_week.updated produce
-- ZERO consumer findings; all thirteen findings fall on the tables in THIS file.
-- The split is justified on LOCK DURATION instead: nfl_plays is 1,483,118 rows
-- across 27 partitions at 8,489 MB, and ALTER COLUMN TYPE rewrites all of it
-- under ACCESS EXCLUSIVE, blocking every read of the schema's hottest table.
-- The five tables here total 11,855 rows and rewrite in well under a second.
-- See the companion 2026-08-08-retype-play-row-mtimes-to-timestamptz.sql.
--
-- CONSUMER INVENTORY, derived by the gate rather than hand-enumerated -- 13
-- findings over 6 files, with all seven of the gate's negative controls firing:
--   api/routes/leagues/trades.mjs:227                     epoch bound in predicate
--   libs-server/get-trade-veto-window.mjs:52              epoch bound in predicate
--   libs-server/get-trade-veto-window.mjs:63              Number() of a retyped read
--   libs-shared/get-trade-veto-window.mjs:22              Number() of a retyped read
--   libs-server/process-release.mjs:210                   dayjs.unix() of a retyped read
--   libs-server/roster-asset-lineage/walk-transactions.mjs:862,972,997,1024,1044
--   scripts/process-poaching-claims.mjs:25,72             epoch bound in predicate
--   private/scripts/import-combination-odds.mjs:502       epoch comparison
-- The read-boundary helper for these is libs-shared/timestamptz-to-epoch.mjs.
--
-- TWO CLASSES THE GATE STRUCTURALLY CANNOT SEE, both found by hand and both
-- required in the same commit as this apply:
--
-- 1. INSERT PAYLOADS. The gate reads predicates and reads, not insert objects.
--    An epoch integer written into a timestamptz column fails LOUDLY -- verified
--    empirically rather than reasoned: `INSERT INTO t (updated) VALUES
--    (1786220000)` raises `column "updated" is of type timestamp with time zone
--    but expression is of type integer`. Every writer of these thirteen columns
--    needs its payload moved to a Date in this commit. (The two writers of the
--    PLAYS pair are in the companion file, and both build
--    Math.round(Date.now() / 1000).)
--
-- 2. THE SPA. `SCAN_ROOTS` in check-retyped-column-arithmetic.mjs is api,
--    libs-server, libs-shared, scripts, jobs, test, private -- `app` is ABSENT,
--    so the entire frontend is invisible to the only gate that can see this
--    class at all. These thirteen columns ARE SPA-visible, which makes this the
--    leagues.hosted outage shape: the API keeps answering 200 while the browser
--    breaks. Measured SPA sites that are genuine defects after the retype:
--      app/core/selectors.js:3041                dayjs.unix(poach.submitted)
--      app/core/selectors.js:3382                b.accepted - a.accepted (sort -> NaN)
--      app/views/components/draft-pick-sheet/draft-pick-sheet.js:68,74
--      app/views/components/poach-notice/poach-notice.js:21
--    Truthiness reads (`!trade.accepted`, `Boolean(trade.accepted)`,
--    `if (poach.processed)`) are NOT defects: an ISO string and an integer are
--    both truthy and null is falsy either way.
--
-- THE APPLY WINDOW IS USER-FACING, which is why this file was held until a
-- deploy window. Between the DDL and the frontend deploy, a logged-in user gets a broken
-- poach-notice processing time, an unsorted trade history and wrong draft-pick
-- sheet dates. The no-shims ruling forbids aliasing the columns back on the
-- wire, so the remedy is the frontend fix plus sequencing
-- `yarn build && yarn deploy:dist && yarn deploy:sourcemaps` immediately behind
-- the apply rather than at cluster end -- the same sequencing the 2026-08-05
-- shorthand cluster used to hold its window to eight minutes.
--
-- DDL rehearsed on a scratch database loaded from the committed schema: all
-- fifteen retypes apply in one transaction at exit 0.
--
-- No BEGIN/COMMIT here -- db-exec.sh runs this under --single-transaction.

ALTER TABLE public.trades ALTER COLUMN offered TYPE timestamptz USING to_timestamp(offered);
ALTER TABLE public.trades ALTER COLUMN accepted TYPE timestamptz USING to_timestamp(accepted);
ALTER TABLE public.trades ALTER COLUMN cancelled TYPE timestamptz USING to_timestamp(cancelled);
ALTER TABLE public.trades ALTER COLUMN rejected TYPE timestamptz USING to_timestamp(rejected);
ALTER TABLE public.trades ALTER COLUMN vetoed TYPE timestamptz USING to_timestamp(vetoed);

ALTER TABLE public.waivers ALTER COLUMN submitted TYPE timestamptz USING to_timestamp(submitted);
ALTER TABLE public.waivers ALTER COLUMN processed TYPE timestamptz USING to_timestamp(processed);
ALTER TABLE public.waivers ALTER COLUMN cancelled TYPE timestamptz USING to_timestamp(cancelled);

ALTER TABLE public.restricted_free_agency_bids ALTER COLUMN submitted TYPE timestamptz USING to_timestamp(submitted);
ALTER TABLE public.restricted_free_agency_bids ALTER COLUMN processed TYPE timestamptz USING to_timestamp(processed);
ALTER TABLE public.restricted_free_agency_bids ALTER COLUMN cancelled TYPE timestamptz USING to_timestamp(cancelled);

ALTER TABLE public.poaches ALTER COLUMN submitted TYPE timestamptz USING to_timestamp(submitted);
ALTER TABLE public.poaches ALTER COLUMN processed TYPE timestamptz USING to_timestamp(processed);

ALTER TABLE public.rosters ALTER COLUMN last_updated TYPE timestamptz USING to_timestamp(last_updated);
