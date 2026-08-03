-- STATUS: APPLIED 2026-08-03 against league_production
--
-- Give prop_pairings a season dimension, and truncate both pairing tables.
--
-- Runs in the default single transaction, and MUST: the truncate, the column
-- adds and the index swap have to succeed or fail together, and a destructive
-- statement should never run without rollback. Do not pass --no-transaction.
--
-- No non-blocking index build is needed here, which is what makes that possible.
-- TRUNCATE empties both tables first, so every index built afterwards is built
-- over zero rows -- instant, and the lock it takes cannot queue behind anything
-- meaningful.
--
--
-- Why truncate
--
-- prop_pairings (5,303 MB) and prop_pairing_props (7,795 MB) are derived,
-- no-FK, no-consumer tables regenerated on demand by generate-prop-pairings.mjs.
-- scripts/postgres-backup.sh has excluded their DATA from every full dump since
-- the pipeline was built, on exactly that reasoning. This statement is the other
-- half of that policy, which the database never had: nothing has ever deleted a
-- row from either table.
--
-- All 13.1 GB is stale. Sampled from two far-apart regions of both heaps
-- (prop_pairings rows 0-20,000 and prop_pairing_props rows 30.00M-30.02M),
-- every pairing resolves through prop_markets_index to season_year 2025. There
-- are no 2026 rows; the 2026 season has not started. So this drops nothing any
-- consumer can read.
--
-- Irreversible against backups by design -- the full dumps carry no data for
-- these tables, so there is no copy to restore. The set is regenerable from
-- prop_markets_index and the history tables, which retain markets back to
-- 2023-03, by rerunning the generator per week per source.
--
--
-- Why season_year AND season_type
--
-- The table had no time dimension at all: no season_year, no season_type, no
-- created_at, only `week` (1-9). There was therefore no expression that could
-- identify a stale row, which is why no retention policy existed -- not an
-- oversight in the policy so much as the absence of anything to write one
-- against.
--
-- `week` alone cannot stand in for it. It is a smallint 1-18 that recycles every
-- September, so week 5 of 2025 and week 5 of 2026 are indistinguishable, and the
-- upsert cannot resolve them either: pairing_id is a blake2b hash over
-- `source_market_id:source_selection_id` pairs, and those vendor identifiers are
-- unique per event, so a new season mints entirely new pairing_ids rather than
-- overwriting last season's. onConflict refreshes nothing across a season
-- boundary and the table can only grow.
--
-- season_type is added for the same reason one step down, and it is the half
-- that is easy to miss. Week numbers restart at 1 in POST, so (season_year,
-- week) is STILL ambiguous: REG week 1 and POST week 1 of the same season are
-- the same partition key. The generator has always known the difference --
-- generate_prop_pairings takes seas_type and filters nfl_games on it (line 325)
-- -- and has always discarded it before the insert, storing only the bare week.
-- So a POST rebuild would have deleted or collided with the REG partition of the
-- same number. Adding the column is what makes the partition key honest, and
-- user:guideline/nfl/league/nfl-week-encoding.md requires week-keyed data to be
-- era-aware for exactly this reason.
--
-- Typed to match nfl_games.season_type, the table these rows are derived from
-- and joined to: character varying NOT NULL, not the season_type enum. The enum
-- exists but is used by 18 columns that are all partitions of two projections
-- tables, against 33 tables on varchar. Matching the join partner beats matching
-- the minority type.
--
-- Both NOT NULL with no default. Every row is written by one generator that
-- always knows its season and its era, so a default would only serve to make a
-- missing value silent -- and a nullable partition column reintroduces exactly
-- the ambiguity this change exists to remove. Safe to declare outright because
-- the TRUNCATE above leaves no existing row to backfill.
--
-- prop_pairing_props deliberately does NOT get the column. It is a pure child of
-- prop_pairings keyed on pairing_id, and prop_pairing_props_unique already leads
-- with pairing_id, so the prune deletes children by subquery against the parent
-- at index cost. Copying season_year and week onto 37.7M child rows would need
-- its own index to be prunable directly, which is more bytes than the join it
-- would save.
--
--
-- Why the index swap
--
-- Every read of this table is scoped to one week and will now be scoped to one
-- season as well (filter-prop-pairings.mjs), and the prune deletes whole
-- (season_year, week) partitions. idx_prop_pairings_week was the correct single
-- index while week was the only time column; with season_year present, a bare
-- week index makes 2025 week 5 and 2026 week 5 share leaf pages for no reason.
-- The composite is the same shape one step wider and replaces it outright rather
-- than sitting beside it -- the twelve indexes dropped earlier today are what
-- that habit costs.
--
-- Ordered coarsest first -- season_year, season_type, week -- which is both the
-- prune's delete key and the reader's filter, so every query supplies a full
-- prefix. source_id is deliberately still absent: n_distinct = 2 and 96.6% of
-- rows are FANDUEL, so it discriminates nothing and the planner correctly
-- applies it as a heap filter.

TRUNCATE TABLE public.prop_pairing_props, public.prop_pairings;

ALTER TABLE public.prop_pairings
  ADD COLUMN season_year smallint NOT NULL,
  ADD COLUMN season_type character varying NOT NULL;

DROP INDEX IF EXISTS idx_prop_pairings_week;

CREATE INDEX idx_prop_pairings_season_year_season_type_week
  ON public.prop_pairings USING btree (season_year, season_type, week);
