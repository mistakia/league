-- STATUS: APPLIED 2026-09-03 against league_production
--
-- Make the nfl_play_stats unique index hold where player_name is null, and
-- merge-forward the duplicates that escaped it. Closes defect two of
-- user:task/league/repair-silent-play-match-ambiguity.md.
--
-- THE DEFECT. idx_24719_play_stat is a standard unique index on
-- (esbid, play_id, stat_id, player_name). A standard unique index treats NULLs
-- as distinct, so every row with a null player_name escapes it entirely.
--
-- WHY THAT PRODUCES DUPLICATES RATHER THAN JUST PERMITTING THEM.
-- import-plays-nfl-v1.mjs re-imports a game by invalidating the whole game and
-- re-inserting:
--
--   update nfl_play_stats set is_valid = 0 where esbid = ?
--   insert ... onConflict(esbid, play_id, stat_id, player_name).merge()
--
-- For a non-null player_name the conflict is detected and the merge flips the
-- SAME row back to is_valid = 1. For a null player_name no conflict is ever
-- detected, so the insert appends a NEW row and strands the prior copy at
-- is_valid = 0. Every re-import of a game therefore mints another copy of every
-- one of its team-level stat rows. That is the whole mechanism, and the
-- measurement agrees with it exactly: all 296,443 duplicate key groups have a
-- null player_name and ZERO have a non-null one.
--
-- SO is_valid IS CURRENT STATE, NOT VERSION HISTORY. This matters because it
-- decides the end state. For the non-null 79% of the table there is exactly one
-- row per key and is_valid flips on it in place -- no superseded copy is
-- retained anywhere. The extra null-player_name rows are not history the schema
-- means to keep; they are artifacts of a conflict that was never detected. So
-- the right end state is the model already in force for the rest of the table:
-- one row per key, enforced, with NULLS NOT DISTINCT closing the gap. Postgres
-- 16.15 in production, and NULLS NOT DISTINCT is already used elsewhere in this
-- schema.
--
-- WHY THIS IS A MERGE-FORWARD AND NOT A DEDUPE, which is the part the prior
-- chain's lesson is about. The obvious remediation -- keep the is_valid row,
-- delete the rest -- is unrecoverable and WRONG HERE, because the stranded
-- copies carry columns the survivor does not:
--
--   192,827 groups where the valid row's nfl_team_id is NULL and a stranded
--            copy holds one
--    13,412 groups where the same is true of smart_player_id
--
-- A keep-the-valid-row delete silently drops all of that. So every non-null
-- value in the group is coalesced ONTO the survivor first, and only then are the
-- redundant rows removed.
--
-- THE COALESCE IS UNAMBIGUOUS, measured rather than assumed. Within the
-- duplicate groups, no group holds more than ONE distinct non-null value of
-- nfl_team_id, smart_player_id, gsis_player_id or nfl_team, so there is no
-- choice to make and nothing to lose. Re-asserted as a pre-condition below,
-- because it is the claim the whole merge rests on.
--
-- stat_yards is deliberately NOT coalesced. It is the one column with a
-- conflicting group -- esbid 2026081353, play 899, stat_id 95, holding both -5
-- and -4 across seven rows that are ALL is_valid false. Nothing consumes an
-- invalid row (libs-server/play-stats-utils.mjs filters is_valid = true), and
-- the next real import of that game rewrites it. The survivor keeps its own
-- value rather than acquiring one from a row it cannot be reconciled with.
--
-- SCALE, and what is actually at stake. Of the 296,443 duplicate groups, only
-- 17 hold more than one is_valid row; 271,144 hold exactly one and 25,282 hold
-- none. So 296,426 of them are already invisible to every consumer, and the
-- excess is overwhelmingly dead weight rather than live ambiguity. The 17 real
-- conflicts are all stat_id 5 with byte-identical valid copies -- genuinely
-- interchangeable, unlike the forked-esbid pair that motivated the warning.
--
-- NO IMPORTER CHANGE SHIPS WITH THIS. import-plays-nfl-v1.mjs already dedupes
-- play_stat_inserts on `${esbid}-${play_id}-${stat_id}-${player_name}` before
-- insert, and a null player_name stringifies to "null", so the batch is already
-- unique on exactly this index key including nulls. The new index therefore
-- cannot raise "ON CONFLICT DO UPDATE command cannot affect row a second time",
-- and the existing .merge() starts working as written.

set local statement_timeout = 0;

-- PRE-CONDITIONS. These are invariants, not volumes: production is mid-preseason
-- and the counts above move between measurement and apply, so asserting them
-- exactly would refuse for the wrong reason. What must hold is the safety of the
-- merge, which does not depend on how many rows there are.
do $$
declare
  n_nonnull_dup_groups bigint;
  n_conflicting_team_id bigint;
  n_conflicting_smart bigint;
  n_conflicting_gsis bigint;
  n_conflicting_team bigint;
  n_null_is_valid bigint;
  n_groups bigint;
  n_excess bigint;
begin
  -- The scope claim. If a duplicate group ever appears with a NON-null
  -- player_name, the standard unique index is not doing its job for a reason
  -- this migration has not diagnosed, and NULLS NOT DISTINCT is the wrong fix.
  select count(*) into n_nonnull_dup_groups
  from (
    select 1 from nfl_play_stats
    where player_name is not null
    group by esbid, play_id, stat_id, player_name
    having count(*) > 1
  ) t;
  if n_nonnull_dup_groups <> 0 then
    raise exception
      '% duplicate group(s) with a NON-null player_name -- the index gap is not the only cause, stopping',
      n_nonnull_dup_groups;
  end if;

  -- is_valid drives survivor selection below, so a null would silently sort.
  select count(*) into n_null_is_valid
  from nfl_play_stats where is_valid is null;
  if n_null_is_valid <> 0 then
    raise exception '% row(s) with a null is_valid -- survivor ordering is undefined', n_null_is_valid;
  end if;

  -- The merge's whole claim: at most one distinct non-null value per column per
  -- group, so coalescing loses nothing and chooses nothing.
  select
    count(*) filter (where d_team_id > 1),
    count(*) filter (where d_smart > 1),
    count(*) filter (where d_gsis > 1),
    count(*) filter (where d_team > 1),
    count(*),
    sum(c) - count(*)
  into n_conflicting_team_id, n_conflicting_smart, n_conflicting_gsis,
       n_conflicting_team, n_groups, n_excess
  from (
    select
      count(*) as c,
      count(distinct nfl_team_id) as d_team_id,
      count(distinct smart_player_id) as d_smart,
      count(distinct gsis_player_id) as d_gsis,
      count(distinct nfl_team) as d_team
    from nfl_play_stats
    where player_name is null
    group by esbid, play_id, stat_id
    having count(*) > 1
  ) g;

  if n_conflicting_team_id <> 0 or n_conflicting_smart <> 0
     or n_conflicting_gsis <> 0 or n_conflicting_team <> 0 then
    raise exception
      'coalesce is ambiguous: % group(s) conflict on nfl_team_id, % on smart_player_id, % on gsis_player_id, % on nfl_team -- a merge would pick a value arbitrarily, stopping',
      n_conflicting_team_id, n_conflicting_smart, n_conflicting_gsis, n_conflicting_team;
  end if;

  raise notice 'merging % duplicate group(s), removing % excess row(s)', n_groups, n_excess;
end $$;

-- The survivor and the merged values, resolved once. ctid is stable here because
-- nothing has been updated yet; the delete below runs before the update for
-- exactly that reason.
create temp table play_stat_dedupe on commit drop as
select
  esbid,
  play_id,
  stat_id,
  (array_agg(ctid order by is_valid desc, ctid))[1] as keep_ctid,
  max(nfl_team_id) as merged_nfl_team_id,
  max(smart_player_id) as merged_smart_player_id,
  max(gsis_player_id) as merged_gsis_player_id,
  max(nfl_team) as merged_nfl_team
from nfl_play_stats
where player_name is null
group by esbid, play_id, stat_id
having count(*) > 1;

create index on play_stat_dedupe (esbid, play_id, stat_id);

-- BACKUP of every row this migration removes. The prior chain's 195
-- unattributable cells came from dropping a backup while duplicates still made
-- the live rows ambiguous, so this one is taken and kept until the post-apply
-- verification in the task entity is recorded, then dropped deliberately.
create table nulls_not_distinct_backup_20260903_nfl_play_stats as
select s.*
from nfl_play_stats s
join play_stat_dedupe d
  on d.esbid = s.esbid and d.play_id = s.play_id and d.stat_id = s.stat_id
where s.player_name is null
  and s.ctid <> d.keep_ctid;

-- Remove the redundant copies. Runs BEFORE the merge so ctid still identifies
-- the rows the temp table resolved.
delete from nfl_play_stats s
using play_stat_dedupe d
where d.esbid = s.esbid and d.play_id = s.play_id and d.stat_id = s.stat_id
  and s.player_name is null
  and s.ctid <> d.keep_ctid;

-- Merge forward onto the sole remaining row of each group. Exactly one row per
-- group survives the delete, so this joins on the key rather than on ctid.
update nfl_play_stats s
set
  nfl_team_id = coalesce(s.nfl_team_id, d.merged_nfl_team_id),
  smart_player_id = coalesce(s.smart_player_id, d.merged_smart_player_id),
  gsis_player_id = coalesce(s.gsis_player_id, d.merged_gsis_player_id),
  nfl_team = coalesce(s.nfl_team, d.merged_nfl_team)
from play_stat_dedupe d
where d.esbid = s.esbid and d.play_id = s.play_id and d.stat_id = s.stat_id
  and s.player_name is null
  and (
    (s.nfl_team_id is null and d.merged_nfl_team_id is not null)
    or (s.smart_player_id is null and d.merged_smart_player_id is not null)
    or (s.gsis_player_id is null and d.merged_gsis_player_id is not null)
    or (s.nfl_team is null and d.merged_nfl_team is not null)
  );

-- The DDL. This is also the post-condition: if any duplicate key survived the
-- merge, the index cannot build and the whole transaction rolls back.
drop index public.idx_24719_play_stat;

create unique index idx_24719_play_stat
  on public.nfl_play_stats
  using btree (esbid, play_id, stat_id, player_name)
  nulls not distinct;

-- POST-CONDITIONS, asserted rather than eyeballed.
do $$
declare
  n_remaining bigint;
  n_lost_team_id bigint;
begin
  select count(*) into n_remaining
  from (
    select 1 from nfl_play_stats
    group by esbid, play_id, stat_id, player_name
    having count(*) > 1
  ) t;
  if n_remaining <> 0 then
    raise exception '% duplicate key group(s) survived', n_remaining;
  end if;

  -- Every nfl_team_id the backup holds must now be present on the surviving
  -- row. This is the assertion that separates a merge-forward from the plain
  -- delete it would otherwise be indistinguishable from.
  select count(*) into n_lost_team_id
  from (
    select distinct b.esbid, b.play_id, b.stat_id, b.nfl_team_id
    from nulls_not_distinct_backup_20260903_nfl_play_stats b
    where b.nfl_team_id is not null
  ) b
  left join nfl_play_stats s
    on s.esbid = b.esbid and s.play_id = b.play_id and s.stat_id = b.stat_id
   and s.player_name is null and s.nfl_team_id = b.nfl_team_id
  where s.esbid is null;
  if n_lost_team_id <> 0 then
    raise exception
      '% nfl_team_id value(s) present in the backup are absent from the surviving rows -- the merge did not carry them',
      n_lost_team_id;
  end if;
end $$;
