-- Conform the NFL plays/snaps canonical fact family to snake_case full-word naming
-- (schema-redesign nfl-plays-snaps cluster). Pure METADATA renames — no data movement,
-- no type change. Follows user:guideline/league/database-schema-standards.md.
--
-- Mechanism (per the player_gamelogs 4f0b1d07 + nfl_games 06128e28 precedents): ALTER
-- TABLE RENAME COLUMN on a partitioned parent cascades to every partition child by
-- attnum; STORED generated columns (nfl_plays.nfl_week_id) and all indexes/constraints
-- track columns by attnum and auto-rewire; the prod 40s statement_timeout does not bite
-- metadata renames. No compat view (partitioned parents cannot host an updatable
-- INSTEAD-OF facade); code is repointed and deployed in lockstep.
--
-- Naming rulings baked in (operator-settled 2026-07-24, see the redesign task):
--   nfl_plays."timestamp" -> play_time_of_day
--     VERIFIED wall-clock time-of-day (HH:MM:SS, 16:05:42->16:50:46 across Q1, range
--     00:00:08..23:59:44), NOT a game clock — the real game clock is the existing
--     game_clock_start column. Supersedes the 2026-07-22 game_clock_time proposal, which
--     rested on a disproven research finding. Type retype (varchar->time) DEFERRED, like
--     every other event-time retype in this redesign.
--   pos_team -> possession_nfl_team (+ pos_team_id -> possession_nfl_team_id, companion)
--     VERIFIED distinct from off/offense (differ on 9290/64435 rows, kicks/PATs), so a
--     genuine possession-team concept, NOT the audit's naive team_nfl_team.
--   "to" -> timeouts (+ to_team -> timeout_team companion)
--     VERIFIED "to"=true rows are all "Timeout #N by TEAM" and siblings to_team /
--     home_to_rem / away_to_rem are timeout attributes, so "to" is a TIMEOUT flag,
--     NOT a turnover. Corrects the schema-standards "to"->turnovers example (which
--     assumed the wrong meaning). Plural "timeouts" matches the guideline's play-event
--     vocabulary (int->interceptions, fuml->fumbles_lost); timeout_team stays singular
--     (the one team of this play's timeout).
--   "desc" -> play_description (guideline example; reserved word)
--   nfl_plays_player."position" -> player_position (reserved word; sits beside the
--     staying position_group / ngs_position / ngs_position_group).
--   nfl_play_stats/_current_week folded into this cluster (same fact family, same
--     ngs.mjs writer, same (esbid, play_id, stat_id) key): clubCode->nfl_team,
--     teamid->nfl_team_id (NFL feed team GUID; companion, not itself audit-flagged),
--     gsispid->smart_player_id (nflverse smart_id), statId->stat_id, playerName->player_name.
--
-- KEPT per operator rulings: all _ngs columns (play_type_ngs, ep_ngs, epa_ngs,
--   nfl_plays_player.ngs_position/ngs_position_group) and idx_nfl_plays_route_ngs — no
--   vendor renames in this cluster (2026-07-23 ruling).
-- DEFERRED (types, not this pass): nfl_plays_passer.snap_time/pass_start_time/
--   pass_end_time, nfl_plays_rusher.contact_time (timestamp without time zone retypes);
--   numeric-duration false positives punt_hang_time/pocket_time/air_time keep their names.
--
-- Index-name policy: rename the primary single-concept PARENT indexes whose conformed
-- name fits NAMEDATALEN(63); leave long multi-column composite parent index names and
-- the ~1450 auto-generated child-partition index names unchanged (index names are not in
-- the conformance-audit surface; full expansion of the composites overflows 63 chars and
-- risks truncation collisions) — consistent with the player_gamelogs parent-primary
-- precedent.
--
-- yarn db:exec db/adhoc/2026-07-24-conform-nfl-plays-snaps.sql
-- yarn export:schema

BEGIN;

-- Bound the lock wait. Verified on prod: lock_timeout is 0 server-wide (source=default,
-- no rolconfig override on league_writer), and the 40s statement_timeout cited above is
-- the knex/app-layer setting, NOT this psql session -- so without this the ALTERs wait
-- indefinitely. That matters because these renames take AccessExclusiveLock on nfl_plays
-- + 27 children and nfl_snaps + 28 children: a single in-flight data-view query (these
-- routinely run tens of seconds) holds AccessShareLock, the ALTER queues behind it, and a
-- PENDING AccessExclusiveLock blocks every newly-arriving reader -- an unbounded lock
-- convoy on the hottest table in the schema. On timeout the whole transaction aborts
-- cleanly and the migration is simply retried.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- ---- nfl_plays (partitioned parent; cascades to 27 nfl_plays_year_* children) ----
ALTER TABLE public.nfl_plays RENAME COLUMN year TO season_year;
ALTER TABLE public.nfl_plays RENAME COLUMN seas_type TO season_type;
ALTER TABLE public.nfl_plays RENAME COLUMN "playId" TO play_id;
ALTER TABLE public.nfl_plays RENAME COLUMN "desc" TO play_description;
ALTER TABLE public.nfl_plays RENAME COLUMN "int" TO interceptions;
ALTER TABLE public.nfl_plays RENAME COLUMN "to" TO timeouts;
ALTER TABLE public.nfl_plays RENAME COLUMN to_team TO timeout_team;
ALTER TABLE public.nfl_plays RENAME COLUMN "timestamp" TO play_time_of_day;
ALTER TABLE public.nfl_plays RENAME COLUMN off TO offense_nfl_team;
ALTER TABLE public.nfl_plays RENAME COLUMN def TO defense_nfl_team;
ALTER TABLE public.nfl_plays RENAME COLUMN pos_team TO possession_nfl_team;
ALTER TABLE public.nfl_plays RENAME COLUMN pos_team_id TO possession_nfl_team_id;
ALTER TABLE public.nfl_plays RENAME COLUMN bc_pid TO ball_carrier_pid;
ALTER TABLE public.nfl_plays RENAME COLUMN psr_pid TO passer_pid;
ALTER TABLE public.nfl_plays RENAME COLUMN trg_pid TO target_pid;
ALTER TABLE public.nfl_plays RENAME COLUMN intp_pid TO interceptor_pid;
ALTER TABLE public.nfl_plays RENAME COLUMN fuml TO fumbles_lost;

-- ---- nfl_plays_current_week (standalone) ----
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN year TO season_year;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN seas_type TO season_type;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN "playId" TO play_id;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN "desc" TO play_description;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN "int" TO interceptions;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN "to" TO timeouts;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN to_team TO timeout_team;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN "timestamp" TO play_time_of_day;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN off TO offense_nfl_team;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN def TO defense_nfl_team;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pos_team TO possession_nfl_team;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN pos_team_id TO possession_nfl_team_id;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN bc_pid TO ball_carrier_pid;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN psr_pid TO passer_pid;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN trg_pid TO target_pid;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN intp_pid TO interceptor_pid;
ALTER TABLE public.nfl_plays_current_week RENAME COLUMN fuml TO fumbles_lost;

-- ---- participant tables (standalone) ----
ALTER TABLE public.nfl_plays_passer RENAME COLUMN "playId" TO play_id;
ALTER TABLE public.nfl_plays_passer RENAME COLUMN year TO season_year;
ALTER TABLE public.nfl_plays_passer RENAME COLUMN gsis_id TO gsis_player_id;

ALTER TABLE public.nfl_plays_receiver RENAME COLUMN "playId" TO play_id;
ALTER TABLE public.nfl_plays_receiver RENAME COLUMN year TO season_year;
ALTER TABLE public.nfl_plays_receiver RENAME COLUMN gsis_id TO gsis_player_id;

ALTER TABLE public.nfl_plays_rusher RENAME COLUMN "playId" TO play_id;
ALTER TABLE public.nfl_plays_rusher RENAME COLUMN year TO season_year;
ALTER TABLE public.nfl_plays_rusher RENAME COLUMN gsis_id TO gsis_player_id;

ALTER TABLE public.nfl_plays_player RENAME COLUMN "playId" TO play_id;
ALTER TABLE public.nfl_plays_player RENAME COLUMN year TO season_year;
ALTER TABLE public.nfl_plays_player RENAME COLUMN gsis_id TO gsis_player_id;
ALTER TABLE public.nfl_plays_player RENAME COLUMN "position" TO player_position;

-- ---- nfl_snaps (partitioned parent; cascades to 27 nfl_snaps_year_* + _default) ----
ALTER TABLE public.nfl_snaps RENAME COLUMN "playId" TO play_id;
ALTER TABLE public.nfl_snaps RENAME COLUMN year TO season_year;

-- ---- nfl_play_stats / _current_week (standalone; folded into cluster) ----
ALTER TABLE public.nfl_play_stats RENAME COLUMN "playId" TO play_id;
ALTER TABLE public.nfl_play_stats RENAME COLUMN "clubCode" TO nfl_team;
ALTER TABLE public.nfl_play_stats RENAME COLUMN "playerName" TO player_name;
ALTER TABLE public.nfl_play_stats RENAME COLUMN "statId" TO stat_id;
ALTER TABLE public.nfl_play_stats RENAME COLUMN "gsisId" TO gsis_player_id;
ALTER TABLE public.nfl_play_stats RENAME COLUMN gsispid TO smart_player_id;
ALTER TABLE public.nfl_play_stats RENAME COLUMN teamid TO nfl_team_id;

ALTER TABLE public.nfl_play_stats_current_week RENAME COLUMN "playId" TO play_id;
ALTER TABLE public.nfl_play_stats_current_week RENAME COLUMN "clubCode" TO nfl_team;
ALTER TABLE public.nfl_play_stats_current_week RENAME COLUMN "playerName" TO player_name;
ALTER TABLE public.nfl_play_stats_current_week RENAME COLUMN "statId" TO stat_id;
ALTER TABLE public.nfl_play_stats_current_week RENAME COLUMN "gsisId" TO gsis_player_id;
ALTER TABLE public.nfl_play_stats_current_week RENAME COLUMN gsispid TO smart_player_id;
ALTER TABLE public.nfl_play_stats_current_week RENAME COLUMN teamid TO nfl_team_id;

-- ---- primary parent index renames (name-embedded renamed tokens; fit NAMEDATALEN) ----
ALTER INDEX public.idx_nfl_plays_bc_pid          RENAME TO idx_nfl_plays_ball_carrier_pid;
ALTER INDEX public.idx_nfl_plays_psr_pid         RENAME TO idx_nfl_plays_passer_pid;
ALTER INDEX public.idx_nfl_plays_trg_pid         RENAME TO idx_nfl_plays_target_pid;
ALTER INDEX public.idx_nfl_plays_off             RENAME TO idx_nfl_plays_offense_nfl_team;
ALTER INDEX public.idx_nfl_plays_off_week        RENAME TO idx_nfl_plays_offense_nfl_team_week;
ALTER INDEX public.idx_nfl_plays_seas_type       RENAME TO idx_nfl_plays_season_type;
ALTER INDEX public.idx_nfl_plays_year_esbid      RENAME TO idx_nfl_plays_season_year_esbid;
ALTER INDEX public.idx_nfl_plays_year_esbid_play_id RENAME TO idx_nfl_plays_season_year_esbid_play_id;
ALTER INDEX public."nfl_plays_current_week_playId"       RENAME TO nfl_plays_current_week_play_id;
ALTER INDEX public."nfl_plays_current_week_esbid_playId" RENAME TO nfl_plays_current_week_esbid_play_id;

COMMIT;
