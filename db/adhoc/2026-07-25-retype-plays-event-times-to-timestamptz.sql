-- Retype the four NGS event-time columns the nfl-plays-snaps conform deferred
-- (schema-redesign nfl-plays-snaps cluster, tail). Type change only -- no rename,
-- no index change, no consumer repoint.
--
-- ############################################################################
-- ## APPLIED 2026-07-28 against league_production under direct operator     ##
-- ## authorization. All four columns are now timestamp with time zone;      ##
-- ## 975/975 nfl_plays_passer.snap_time values survived intact, and the     ##
-- ## minimum lands 00:47 UTC on 2024-09-06, 27 minutes after that game's    ##
-- ## 00:20 UTC kickoff -- inside the 4-27 minute window documented below,   ##
-- ## confirming no timezone shift. Plays-family residual dropped 10 -> 6.   ##
-- ############################################################################
--
-- Scope (the 4 timestamp_type flags in the plays residual 13):
--   nfl_plays_passer.snap_time, .pass_start_time, .pass_end_time
--   nfl_plays_rusher.contact_time
-- The other three timestamp_type flags -- punt_hang_time, pocket_time, air_time --
-- are numeric durations, not instants, and keep both their names and their types
-- per the 2026-07-24 ruling. They are false positives of the audit's name rule.
--
-- SOURCE TIMEZONE IS UTC, NOT America/New_York. This is the one trap in this
-- change. The sibling betting-props-timeseries conform converted its tz-naive
-- definition columns with `AT TIME ZONE 'America/New_York'`; copying that recipe
-- here would shift every value 4-5 hours. Verified against nfl_games by joining
-- each game's kickoff (to_timestamp(nfl_games."timestamp")) to its first and last
-- snap_time: for all of 2024 week 1, the first snap lands 4-27 minutes after
-- kickoff-in-UTC and the last ~3h later, which only holds if the stored naive
-- value is UTC wall clock. Read as America/New_York the snaps would precede
-- kickoff by hours.
--
-- Round-trip verified read-only on prod: 975/975 non-null snap_time rows satisfy
-- (snap_time AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' = snap_time.
--
-- Cost: trivial. nfl_plays_passer is 392 kB / 1058 rows (975 populated),
-- nfl_plays_rusher is 264 kB / 873 rows (777 populated) -- these hold a single
-- NGS sample week, not the full history. Sub-second under the prod 40s
-- statement_timeout, no lock_timeout staging needed, unlike the ~20.5 GB the
-- betting retypes rewrote.
--
-- Consumer repoint: NONE REQUIRED. All four column names have zero references in
-- libs-server, libs-shared, app, api, jobs, scripts, or the private submodule --
-- no writer and no reader. The columns are populated by a historical NGS load
-- that no current importer maintains. Nothing to deploy alongside this.
--
-- Post-apply: yarn export:schema, then re-run
--   node db/adhoc/audit-schema-conformance.mjs
-- and confirm the plays residual drops 10 -> 6, leaving only the ratified _ngs
-- vendor keeps and no timestamp_type flag on the family at all. (The residual was
-- 13 at cutover; the three numeric-duration false positives are now recorded as
-- keeps in the auditor's accepted_non_timestamp_columns, taking it to 10.)

BEGIN;

ALTER TABLE public.nfl_plays_passer
  ALTER COLUMN snap_time TYPE timestamp with time zone
    USING snap_time AT TIME ZONE 'UTC',
  ALTER COLUMN pass_start_time TYPE timestamp with time zone
    USING pass_start_time AT TIME ZONE 'UTC',
  ALTER COLUMN pass_end_time TYPE timestamp with time zone
    USING pass_end_time AT TIME ZONE 'UTC';

ALTER TABLE public.nfl_plays_rusher
  ALTER COLUMN contact_time TYPE timestamp with time zone
    USING contact_time AT TIME ZONE 'UTC';

COMMIT;
