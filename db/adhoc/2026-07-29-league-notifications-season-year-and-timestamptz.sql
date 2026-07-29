-- STATUS: APPLIED 2026-07-29 against league_production
--
-- league_notifications: season grain conform + epoch-integer timestamps -> timestamptz
--
-- Clears three schema-conformance findings in one apply window:
--   [season_grain]   league_notifications.year -> season_year
--   [timestamp_type] league_notifications.event_timestamp [integer NOT NULL]
--   [timestamp_type] league_notifications.sent_timestamp  [integer NOT NULL]
--
-- Folding the retypes in with the rename is deliberate: the apply-through-commit
-- window is where the risk lives (see CLAUDE.md), so this table is touched once
-- rather than twice. Retype shape follows the nfl_games."timestamp" -> kickoff_at
-- precedent (b09fdbce).
--
-- USING-clause correctness: the table holds ZERO rows in production
-- (`select count(*) from league_notifications` = 0, checked immediately before
-- authoring), so both retypes are metadata-only and there is no value to
-- disagree about. The stored integers were true UTC epoch seconds by
-- construction -- libs-server/league-notifications.mjs writes sent_timestamp as
-- Math.round(Date.now() / 1000), and every caller derives event_timestamp from
-- dayjs().unix() or a bigint epoch column -- so to_timestamp() alone is correct
-- and NO zone shift is involved. The clause is present because integer ->
-- timestamptz requires one, not because any row exercises it.
--
-- No dependent views or materialized views reference this table (checked via
-- pg_depend); the four dependent objects are all btree indexes, which Postgres
-- rebuilds in place on ALTER COLUMN TYPE. The composite unique constraint
-- (lid, year, notification_type, event_timestamp) follows the renamed column
-- automatically.
--
-- idx_league_notifications_lid_year is renamed alongside its column so the
-- schema carries no remnant of the old name.
--
-- Both columns stay NOT NULL.

BEGIN;

ALTER TABLE league_notifications
  RENAME COLUMN year TO season_year;

ALTER INDEX idx_league_notifications_lid_year
  RENAME TO idx_league_notifications_lid_season_year;

ALTER TABLE league_notifications
  ALTER COLUMN event_timestamp TYPE timestamptz USING to_timestamp(event_timestamp);

ALTER TABLE league_notifications
  ALTER COLUMN sent_timestamp TYPE timestamptz USING to_timestamp(sent_timestamp);

COMMIT;
