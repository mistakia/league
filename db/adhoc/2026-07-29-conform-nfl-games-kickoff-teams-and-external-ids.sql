-- STATUS: PENDING
--
-- Conform the nfl_games dimension: kickoff time, team roles, and external ids.
--
-- Three violation classes on one table, fused into one pass on operator ruling
-- because they share a consumer surface. `historical-injury-index-sql.mjs`
-- alone reads h, v AND timestamp from nfl_games, and its spec hard-asserts
-- `h AS home_team` / `v AS away_team`, so splitting them edits and re-reviews
-- the same files two or three times over.
--
-- 1. KICKOFF TIME. `"timestamp"` is a quoted reserved word AND an integer epoch,
--    the last epoch column on the game dimension. Per
--    user:guideline/league/database-schema-standards.md a point in time is
--    timestamptz and carries a name that says which event it marks, so this
--    becomes `kickoff_at`.
--
--    The epoch is unambiguous, unlike the nfl_plays event-time retype where the
--    stored zone had to be inferred. Verified against an independent oracle
--    before writing this file: for all 15,598 non-null rows,
--      to_timestamp("timestamp") AT TIME ZONE 'America/New_York'
--        = (date || ' ' || time_est)::timestamp
--    agrees exactly, 0 disagreements. So to_timestamp() is the correct USING
--    clause and no zone shift is involved. (24 rows carry a null timestamp and
--    stay null.)
--
-- 2. TEAM ROLES. `v`/`h` are the last unqualified team-role spellings on this
--    table. Every other role-bearing column here already uses the home_/away_
--    vocabulary -- home_score/away_score, home_rest/away_rest,
--    home_moneyline/away_moneyline, home_team_id/away_team_id -- so this rename
--    makes the table internally consistent rather than introducing a convention.
--    v = visitor = away.
--
-- 3. EXTERNAL IDS. Ten id columns spell their vendor without a separator
--    (`gsisid` rather than `gsis_game_id`). The conformance audit flags only
--    two of them, because its external-id rule recognises vendors through a
--    hardcoded prefix list (gsis|sleeper|yahoo|roto|cbs|shield|nfl) that misses
--    espn/ngs/pfr/detail. Every such column in the entire schema is on this
--    table, so conforming all ten closes the class completely. The audit rule
--    itself is a separate follow-up -- widening it mid-cluster would move the
--    baseline underneath work in flight.
--
--    site_ngsid becomes ngs_site_id. `site` is not in the audit's entity list
--    (player|team|game|league); the entity list is what should widen, not the
--    name. Recorded so the follow-up covers it.
--
-- NOT IN SCOPE, deliberately:
--   - schedule.v / schedule.h. Deferred: that table is a drop candidate (5,580
--     rows frozen at season 2000-2020, zero inserts/updates/deletes, no genuine
--     code reference) and renaming columns on a table slated for removal is
--     transitional cruft. Needs its own verification and an operator ruling.
--   - nfl_games.date / time_est / time_tz_offset / time_start / time_end. These
--     become largely redundant once kickoff_at is a real timestamptz, but they
--     have their own consumers and collapsing them is a separate decision.
--
-- DEPENDENCIES CHECKED. No view or materialized view depends on any column
-- touched here -- verified at column granularity via pg_depend.refobjsubid, not
-- by reading view definitions. The two matviews on nfl_games
-- (nfl_year_week_timestamp, opening_days) depend only on date, season_year,
-- week and season_type. Note nfl_year_week_timestamp is named for a timestamp
-- it does not read; it derives from `date`.
--
-- Indexes need no action: a column rename cascades to index definitions
-- automatically. idx_24707_game covers (h, v); nfl_game_coaches_pkey and
-- nfl_game_coaches_team cover team.
--
-- ROLLBACK: db/adhoc/2026-07-29-conform-nfl-games-kickoff-teams-and-external-ids-rollback.sql

BEGIN;

-- 1. Kickoff time: rename, then retype in place.
ALTER TABLE public.nfl_games RENAME COLUMN "timestamp" TO kickoff_at;
ALTER TABLE public.nfl_games
  ALTER COLUMN kickoff_at TYPE timestamptz USING to_timestamp(kickoff_at);

-- 2. Team roles.
ALTER TABLE public.nfl_games RENAME COLUMN v TO away_nfl_team;
ALTER TABLE public.nfl_games RENAME COLUMN h TO home_nfl_team;

-- 3. External ids: {system}_{entitytype}_id.
ALTER TABLE public.nfl_games RENAME COLUMN gsisid TO gsis_game_id;
ALTER TABLE public.nfl_games RENAME COLUMN espnid TO espn_game_id;
ALTER TABLE public.nfl_games RENAME COLUMN ngsid TO ngs_game_id;
ALTER TABLE public.nfl_games RENAME COLUMN shieldid TO shield_game_id;
ALTER TABLE public.nfl_games RENAME COLUMN pfrid TO pfr_game_id;
ALTER TABLE public.nfl_games RENAME COLUMN detailid_v1 TO detail_v1_game_id;
ALTER TABLE public.nfl_games RENAME COLUMN detailid_v3 TO detail_v3_game_id;

-- Team- and site-grain ngs ids on the game row.
ALTER TABLE public.nfl_games RENAME COLUMN home_ngsid TO home_ngs_team_id;
ALTER TABLE public.nfl_games RENAME COLUMN away_ngsid TO away_ngs_team_id;
ALTER TABLE public.nfl_games RENAME COLUMN site_ngsid TO ngs_site_id;

-- 4. nfl_game_coaches carries exactly one team per row (the team whose coaching
--    staff the row describes), so the unqualified nfl_team is correct -- the
--    same call the historical_injury_index conform made for the same shape.
ALTER TABLE public.nfl_game_coaches RENAME COLUMN team TO nfl_team;

COMMIT;
