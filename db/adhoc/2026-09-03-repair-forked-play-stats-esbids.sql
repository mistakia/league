-- STATUS: APPLIED 2026-09-03 against league_production
--
-- Repair the forked play-stats esbids. Closes
-- user:task/league/repair-forked-play-stats-esbids.md.
--
-- 132 esbids carry rows that no nfl_games row answers to. They are TWO
-- populations needing OPPOSITE treatment, and conflating them is the way to get
-- this wrong:
--
--   130 games of 2013 and 2014 preseason RE-POINT to esbid + 50.
--   2 singletons are DUPLICATES and are DELETED.
--
-- WHY RE-POINT RATHER THAN RE-IMPORT. Every preseason year from 2012 through
-- 2026 holds roughly 11,500 plays. 2013 and 2014 read exactly 0. The forked rows
-- number 11,851 and 11,671 -- right in that range. The rows are correct and only
-- their key is wrong, so re-pointing restores the two holes exactly, while
-- re-importing would trade a known-good corpus for whatever a thirteen-year-old
-- preseason endpoint still answers.
--
-- WHY THE SINGLETONS ARE DELETES AND NOT RE-POINTS, which inverts this task's
-- own do-not-delete rule for exactly these two. Each names a game we already
-- hold COMPLETE under the correct key, so the target occupies the key and a
-- re-point is not even available:
--
--   2020112602 -> 2020120200 already holds 167 of its 170 plays, 750 play stats
--                 against 661. A BAL at PIT game postponed off Thanksgiving.
--   2021122201 -> 2021122101 already holds 165 of its 166 plays, 693 play stats
--                 against 613. A SEA at LA game we carry one calendar day earlier.
--
-- Everything the orphan copies hold that their targets do not is junk: the 4
-- orphan-only plays are empty shells with null play_type and null
-- play_description, and all 23 orphan-only play-stat rows are is_valid false.
-- Deleting them loses no valid row.
--
-- THREE TABLES, NOT TWO. The affected class was enumerated from the schema
-- rather than from the tables already known, which is what found the third:
-- player_gamelogs holds 2,310 rows across 124 of these esbids. Every other
-- esbid-keyed table in production reads exactly 0 -- nfl_snaps, the four
-- nfl_plays_* role tables, nfl_player_play_charting, play_changelog,
-- nfl_matchup_stats, nfl_team_gamelogs, historical_injury_index and the three
-- format gamelog tables among them.
--
-- NO DERIVED COLUMN NEEDS RECOMPUTING, measured rather than assumed: the orphan
-- nfl_plays rows already carry the correct season_year, week and season_type
-- (all PRE, weeks 0 through 4), with zero mismatches against the target game.
-- Both nfl_plays and player_gamelogs are RANGE partitioned on season_year, which
-- this migration does not touch, so no row crosses a partition.
--
-- THERE IS NO WRITER FIX TO SHIP ALONGSIDE THIS, which is a correction to the
-- task's original framing. No current importer mints an esbid:
-- import-plays-nfl-v1.mjs carries game.esbid straight from nfl_games,
-- import-plays-nflfastr.mjs resolves through resolve-nflfastr-game.mjs and
-- refuses what it cannot resolve, import-plays-nflfastr-ftn.mjs maps
-- nflverse_game_id to esbid, and import-nfl-games-nfl.mjs takes the esbid from
-- the vendor elias external id. The producer is not in the current code.
--
-- db:exec supplies the transaction; do NOT add BEGIN/COMMIT.

-- The orphan set is materialised BEFORE any write, because re-pointing changes
-- the very predicate that defines it -- computing it again after the first
-- update would silently address a different population.
create temp table forked_esbid on commit drop as
select distinct s.esbid
from nfl_play_stats s
left join nfl_games g on g.esbid = s.esbid
where g.esbid is null;

create temp table forked_repoint on commit drop as
select esbid, esbid + 50 as target_esbid
from forked_esbid
where esbid < 2020000000;

create temp table forked_delete on commit drop as
select esbid from forked_esbid where esbid >= 2020000000;

-- PRE-CONDITIONS. Each raises, so a population that has moved since this was
-- measured aborts the migration instead of quietly repairing something else.
do $$
declare
  n_total int;
  n_repoint int;
  n_delete int;
  n_unresolvable int;
  n_occupied int;
  n_pid_collisions int;
begin
  select count(*) into n_total from forked_esbid;
  select count(*) into n_repoint from forked_repoint;
  select count(*) into n_delete from forked_delete;

  if n_total <> 132 or n_repoint <> 130 or n_delete <> 2 then
    raise exception
      'forked population moved: % total, % to re-point, % to delete (expected 132/130/2)',
      n_total, n_repoint, n_delete;
  end if;

  -- Every re-point target must exist and be a preseason game. This is the
  -- mapping's whole claim, re-asserted at execution time rather than trusted
  -- from the measurement that established it.
  select count(*) into n_unresolvable
  from forked_repoint r
  left join nfl_games g on g.esbid = r.target_esbid
  where g.esbid is null or g.season_type <> 'PRE';
  if n_unresolvable <> 0 then
    raise exception '% re-point target(s) absent or not PRE', n_unresolvable;
  end if;

  -- No re-point target may already hold plays or play stats. If one does, it is
  -- a duplicate like the two singletons and belongs in the delete set, not here.
  select count(*) into n_occupied
  from forked_repoint r
  where exists (select 1 from nfl_play_stats s where s.esbid = r.target_esbid)
     or exists (select 1 from nfl_plays p where p.esbid = r.target_esbid);
  if n_occupied <> 0 then
    raise exception
      '% re-point target(s) already carry plays or play stats -- these are duplicates, not re-points',
      n_occupied;
  end if;

  -- player_gamelogs DOES hold rows at some targets, legitimately and for other
  -- players, so the assertion here is the unique key rather than emptiness.
  select count(*) into n_pid_collisions
  from player_gamelogs a
  join forked_repoint r on r.esbid = a.esbid
  join player_gamelogs b on b.esbid = r.target_esbid and b.pid = a.pid;
  if n_pid_collisions <> 0 then
    raise exception '% (pid, esbid) collision(s) at re-point targets', n_pid_collisions;
  end if;
end $$;

-- BACKUPS. This migration deletes rows, so it gets a rollback -- unlike the
-- 2026-09-03 abbreviation conform, whose backup tables were dropped and which
-- therefore has none.
create table forked_esbid_backup_20260903_nfl_play_stats as
select s.* from nfl_play_stats s join forked_esbid f on f.esbid = s.esbid;

create table forked_esbid_backup_20260903_nfl_plays as
select p.* from nfl_plays p join forked_esbid f on f.esbid = p.esbid;

create table forked_esbid_backup_20260903_player_gamelogs as
select pg.* from player_gamelogs pg join forked_esbid f on f.esbid = pg.esbid;

-- RE-POINT the 130.
update nfl_play_stats s
set esbid = r.target_esbid
from forked_repoint r
where r.esbid = s.esbid;

update nfl_plays p
set esbid = r.target_esbid
from forked_repoint r
where r.esbid = p.esbid;

update player_gamelogs pg
set esbid = r.target_esbid
from forked_repoint r
where r.esbid = pg.esbid;

-- DELETE the two duplicate copies.
delete from nfl_play_stats s using forked_delete d where d.esbid = s.esbid;
delete from nfl_plays p using forked_delete d where d.esbid = p.esbid;
delete from player_gamelogs pg using forked_delete d where d.esbid = pg.esbid;

-- POST-CONDITIONS. Each raises rather than reporting, so a partial apply cannot
-- commit.
do $$
declare
  remaining_orphans int;
  unfilled int;
  survivors int;
  target_stats_2020 int;
  target_stats_2021 int;
  backup_stats int;
  moved_stats int;
begin
  -- The invariant the registered check nfl-play-stats-game-linkage grades.
  select count(distinct s.esbid) into remaining_orphans
  from nfl_play_stats s
  left join nfl_games g on g.esbid = s.esbid
  where g.esbid is null;
  if remaining_orphans <> 0 then
    raise exception 'nfl_play_stats still holds % orphan esbid(s)', remaining_orphans;
  end if;

  -- Every re-point target must now actually carry the rows. A silent no-op
  -- update would satisfy the orphan count above only by accident, so this asks
  -- the positive question instead.
  select count(*) into unfilled
  from forked_repoint r
  where not exists (select 1 from nfl_play_stats s where s.esbid = r.target_esbid);
  if unfilled <> 0 then
    raise exception '% re-point target(s) carry no play stats after the move', unfilled;
  end if;

  -- Nothing may survive under a deleted singleton, in any of the three tables.
  select
    (select count(*) from nfl_play_stats s join forked_delete d on d.esbid = s.esbid)
    + (select count(*) from nfl_plays p join forked_delete d on d.esbid = p.esbid)
    + (select count(*) from player_gamelogs pg join forked_delete d on d.esbid = pg.esbid)
  into survivors;
  if survivors <> 0 then
    raise exception '% row(s) survive under a deleted singleton esbid', survivors;
  end if;

  -- The singletons' TARGETS must be untouched. This is what distinguishes a
  -- delete of the duplicate from a delete of the game.
  select count(*) into target_stats_2020 from nfl_play_stats where esbid = 2020120200;
  select count(*) into target_stats_2021 from nfl_play_stats where esbid = 2021122101;
  if target_stats_2020 <> 750 or target_stats_2021 <> 693 then
    raise exception
      'singleton targets changed: 2020120200 has % play stats (expected 750), 2021122101 has % (expected 693)',
      target_stats_2020, target_stats_2021;
  end if;

  -- Conservation: every backed-up play-stat row is either re-pointed or
  -- deliberately deleted, and none simply vanished.
  select count(*) into backup_stats from forked_esbid_backup_20260903_nfl_play_stats;
  select count(*) into moved_stats
  from nfl_play_stats s join forked_repoint r on r.target_esbid = s.esbid;
  if backup_stats <> moved_stats + 1274 then
    raise exception
      'row conservation failed: % backed up, % re-pointed, expected the difference to be the 1,274 deleted singleton rows',
      backup_stats, moved_stats;
  end if;
end $$;
