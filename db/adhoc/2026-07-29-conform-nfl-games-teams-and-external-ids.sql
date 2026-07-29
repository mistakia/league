-- STATUS: APPLIED 2026-07-29 against league_production
--
-- Conform the nfl_games dimension: team roles and external ids.
--
-- 1. TEAM ROLES. `v`/`h` are the last unqualified team-role spellings on this
--    table. Every other role-bearing column here already uses the home_/away_
--    vocabulary -- home_score/away_score, home_rest/away_rest,
--    home_moneyline/away_moneyline, home_team_id/away_team_id -- so this rename
--    makes the table internally consistent rather than introducing a convention.
--    v = visitor = away.
--
-- 2. EXTERNAL IDS. Ten id columns spell their vendor without a separator
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
-- 3. nfl_game_coaches carries exactly one team per row (the team whose coaching
--    staff the row describes), so the unqualified nfl_team is correct -- the
--    same call the historical_injury_index conform made for the same shape.
--
-- SPLIT FROM THE KICKOFF RETYPE, deliberately. `nfl_games."timestamp"` ->
-- `kickoff_at timestamptz` was originally fused into this pass, on the sound
-- rationale that the three classes share consumer files. Discovery changed the
-- picture: the retype is a SEMANTIC migration, not a rename. A stale column name
-- throws a loud 42703, but a changed type hands node-pg consumers a Date where
-- they expect epoch seconds, so the code goes silently wrong instead -- and the
-- EXPLAIN-validity gate cannot see it, because the SQL stays valid and only the
-- arithmetic is wrong (`now >= game.timestamp` in load-nfl-schedule.mjs:112
-- compares seconds against milliseconds; import-nflverse-injuries.mjs:326 would
-- write garbage changed_at into player_changelog). Reviewing that in the same
-- diff as a ~40-file mechanical sweep is where such a miss hides. It ships as
-- its own pass with its own consumer rewrites.
--
-- The retype's semantics are already established, and that verification carries
-- forward: for all 15,598 non-null rows,
--   to_timestamp("timestamp") AT TIME ZONE 'America/New_York'
--     = (date || ' ' || time_est)::timestamp
-- agrees exactly, 0 disagreements -- so to_timestamp() is the correct USING
-- clause and no zone shift is involved. The ambiguity that made the nfl_plays
-- event-time retype delicate does not exist here.
--
-- ALSO NOT IN SCOPE: schedule.v / schedule.h. That table is a drop candidate
-- (5,580 rows frozen at season 2000-2020, zero inserts/updates/deletes, and all
-- three discovery sweeps independently found zero code references). Renaming
-- columns on a table slated for removal is transitional cruft.
--
-- DEPENDENCIES CHECKED. No view or materialized view depends on any column
-- touched here -- verified at column granularity via pg_depend.refobjsubid, not
-- by reading view definitions. The two matviews on nfl_games
-- (nfl_year_week_timestamp, opening_days) depend only on date, season_year,
-- week and season_type.
--
-- Indexes need no action: a column rename cascades to index definitions
-- automatically. idx_24707_game covers (h, v); nfl_game_coaches_pkey and
-- nfl_game_coaches_team cover team.
--
-- ROLLBACK: db/adhoc/2026-07-29-conform-nfl-games-teams-and-external-ids-rollback.sql

BEGIN;

-- 1. Team roles.
ALTER TABLE public.nfl_games RENAME COLUMN v TO away_nfl_team;
ALTER TABLE public.nfl_games RENAME COLUMN h TO home_nfl_team;

-- 2. External ids: {system}_{entitytype}_id.
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

-- 3. Coaching-staff row carries exactly one team.
ALTER TABLE public.nfl_game_coaches RENAME COLUMN team TO nfl_team;

COMMIT;
