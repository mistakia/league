-- STATUS: APPLIED 2026-09-03 against league_production
--
-- Drop nulls_not_distinct_backup_20260903_nfl_play_stats, the backup taken by
-- 2026-09-03-nfl-play-stats-nulls-not-distinct.sql. That file states the backup
-- is "kept until the post-apply verification in the task entity is recorded,
-- then dropped deliberately"; the verification is recorded on
-- user:task/league/repair-silent-play-match-ambiguity.md and this is that drop.
--
-- WHY IT CANNOT JUST BE LEFT. A retained backup table is carried by
-- yarn export:schema into db/schema.postgres.sql and by the type generator into
-- db/knex-tables.d.ts, so it becomes part of the schema every future session
-- reads and every fresh database materializes. That is the schema trap the
-- forked-esbid close-out shut, and it does not decay on its own.
--
-- WHAT MAKES THE DROP SAFE. The backup exists to answer one question: did the
-- merge-forward carry every value the removed rows held? The assertions below
-- re-ask it in full immediately before the drop, in the same transaction, so a
-- regression between the apply and this file refuses rather than discards.
--
-- AND WHY THE ASSERTION IS NOT VACUOUS. A left-join "nothing was lost" check
-- returns a confident zero when it is simply unable to match -- a wrong join
-- key, an empty backup, a type coercion that never equates. So the same query
-- is run against an impossible nfl_team_id as a negative control, and the
-- transaction refuses if that control does NOT report losses. The check must be
-- shown able to fire before its zero is allowed to mean anything.

do $$
declare
  n_lost_team_id bigint;
  n_lost_smart bigint;
  n_lost_gsis bigint;
  n_lost_team bigint;
  n_lost_stat_yards bigint;
  n_orphan_keys bigint;
  n_control bigint;
  n_backup_rows bigint;
begin
  select count(*) into n_backup_rows
  from nulls_not_distinct_backup_20260903_nfl_play_stats;
  if n_backup_rows = 0 then
    raise exception
      'backup table is empty -- every preservation check below would pass vacuously, stopping';
  end if;

  -- Every non-null value the backup holds must be present on the surviving row
  -- for the same key. One assertion per merged column.
  select count(*) into n_lost_team_id
  from (
    select distinct b.esbid, b.play_id, b.stat_id, b.nfl_team_id as v
    from nulls_not_distinct_backup_20260903_nfl_play_stats b
    where b.nfl_team_id is not null
  ) b
  left join nfl_play_stats s
    on s.esbid = b.esbid and s.play_id = b.play_id and s.stat_id = b.stat_id
   and s.player_name is null and s.nfl_team_id = b.v
  where s.esbid is null;

  select count(*) into n_lost_smart
  from (
    select distinct b.esbid, b.play_id, b.stat_id, b.smart_player_id as v
    from nulls_not_distinct_backup_20260903_nfl_play_stats b
    where b.smart_player_id is not null
  ) b
  left join nfl_play_stats s
    on s.esbid = b.esbid and s.play_id = b.play_id and s.stat_id = b.stat_id
   and s.player_name is null and s.smart_player_id = b.v
  where s.esbid is null;

  select count(*) into n_lost_gsis
  from (
    select distinct b.esbid, b.play_id, b.stat_id, b.gsis_player_id as v
    from nulls_not_distinct_backup_20260903_nfl_play_stats b
    where b.gsis_player_id is not null
  ) b
  left join nfl_play_stats s
    on s.esbid = b.esbid and s.play_id = b.play_id and s.stat_id = b.stat_id
   and s.player_name is null and s.gsis_player_id = b.v
  where s.esbid is null;

  select count(*) into n_lost_team
  from (
    select distinct b.esbid, b.play_id, b.stat_id, b.nfl_team as v
    from nulls_not_distinct_backup_20260903_nfl_play_stats b
    where b.nfl_team is not null
  ) b
  left join nfl_play_stats s
    on s.esbid = b.esbid and s.play_id = b.play_id and s.stat_id = b.stat_id
   and s.player_name is null and s.nfl_team = b.v
  where s.esbid is null;

  if n_lost_team_id <> 0 or n_lost_smart <> 0 or n_lost_gsis <> 0
     or n_lost_team <> 0 then
    raise exception
      'merge-forward did not carry every value: % nfl_team_id, % smart_player_id, % gsis_player_id, % nfl_team absent from the surviving rows -- refusing to drop the backup',
      n_lost_team_id, n_lost_smart, n_lost_gsis, n_lost_team;
  end if;

  -- stat_yards was deliberately NOT coalesced, on the grounds that the one
  -- conflicting group is entirely is_valid false and nothing consumes an invalid
  -- row. Assert the narrower claim that follows from it: no VALID backup row
  -- carried a stat_yards the survivor lacks.
  select count(*) into n_lost_stat_yards
  from (
    select distinct b.esbid, b.play_id, b.stat_id, b.stat_yards as v
    from nulls_not_distinct_backup_20260903_nfl_play_stats b
    where b.stat_yards is not null and b.is_valid
  ) b
  left join nfl_play_stats s
    on s.esbid = b.esbid and s.play_id = b.play_id and s.stat_id = b.stat_id
   and s.player_name is null and s.stat_yards = b.v
  where s.esbid is null;

  if n_lost_stat_yards <> 0 then
    raise exception
      '% valid stat_yards value(s) in the backup are absent from the surviving rows -- refusing to drop the backup',
      n_lost_stat_yards;
  end if;

  -- A removed row whose key has no live row at all is a deletion, not a merge.
  select count(*) into n_orphan_keys
  from (
    select distinct b.esbid, b.play_id, b.stat_id
    from nulls_not_distinct_backup_20260903_nfl_play_stats b
  ) b
  left join nfl_play_stats s
    on s.esbid = b.esbid and s.play_id = b.play_id and s.stat_id = b.stat_id
   and s.player_name is null
  where s.esbid is null;

  if n_orphan_keys <> 0 then
    raise exception
      '% backup key(s) have no surviving live row -- rows were removed rather than merged, refusing to drop the backup',
      n_orphan_keys;
  end if;

  -- NEGATIVE CONTROL. Same query, same join, against a value no row can hold.
  -- It must report losses; a zero here means the check cannot fire and every
  -- zero above is meaningless.
  select count(*) into n_control
  from (
    select distinct b.esbid, b.play_id, b.stat_id, 'ZZ_IMPOSSIBLE'::varchar as v
    from nulls_not_distinct_backup_20260903_nfl_play_stats b
    where b.nfl_team_id is not null
  ) b
  left join nfl_play_stats s
    on s.esbid = b.esbid and s.play_id = b.play_id and s.stat_id = b.stat_id
   and s.player_name is null and s.nfl_team_id = b.v
  where s.esbid is null;

  if n_control = 0 then
    raise exception
      'negative control reported zero losses against an impossible nfl_team_id -- the preservation check cannot fire and its zeros prove nothing, stopping';
  end if;

  raise notice
    'preservation verified across % backup row(s); negative control fired on % key(s)',
    n_backup_rows, n_control;
end $$;

drop table public.nulls_not_distinct_backup_20260903_nfl_play_stats;
