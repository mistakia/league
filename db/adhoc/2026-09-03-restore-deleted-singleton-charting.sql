-- STATUS: APPLIED 2026-09-03 against league_production
--
-- Restore the charting the forked-esbid repair deleted. Follow-up to
-- db/adhoc/2026-09-03-repair-forked-play-stats-esbids.sql and to
-- user:task/league/repair-forked-play-stats-esbids.md.
--
-- WHAT WENT WRONG. That repair deleted two singleton orphans as duplicates of
-- games we already held under the correct key. They ARE duplicates, and the
-- surviving copies are richer on almost every measure -- more play stats, more
-- populated columns overall. But nobody compared them COLUMN BY COLUMN, and one
-- block runs the other way: the deleted 2021122201 copy carries charting across
-- 45 columns on 121 plays that the surviving 2021122101 has not got at all.
-- Measured 2026-09-03, the surviving copy is the ONLY game in 2021 REG week 15
-- with zero charted plays; every sibling carries 117 to 150.
--
-- HOW IT CAME TO BE, because it explains why no re-import fixes it. The
-- charting importer, scripts/import-charted-plays-from-csv.mjs, does not carry
-- an esbid: it content-matches a play through libs-server/get-play.mjs on week,
-- season, teams, quarter, clock, down and yard line, and then writes back to
-- whatever esbid that row happens to hold. get-play.mjs returns a row only when
-- EXACTLY ONE matches.
--
--   2021-12-21 22:08  a live import writes the game under the forked esbid
--                     2021122201. It is the only copy.
--   later             the charting CSV import content-matches those plays,
--                     finds exactly one, and charts them -- on the fork.
--   2023-12-18 17:23  a re-import creates the canonical copy at 2021122101,
--                     uncharted. From this moment two copies match, get-play
--                     returns null, and NEITHER copy can ever be charted again.
--   2026-09-03        the repair deletes the fork as the inferior duplicate,
--                     taking the only charted copy with it.
--
-- So this is not recoverable by re-running the importer, and it was not
-- recoverable even before the delete. The backup table is the only source.
--
-- WHY COALESCE AND NOT A PLAIN ASSIGNMENT. Every cell this touches was measured
-- null on the surviving row -- zero exceptions across all 45 columns. coalesce
-- makes that measurement an invariant rather than a premise: if a survivor value
-- appeared between the measurement and the apply, it WINS and nothing is lost.
--
-- The column list is GENERATED from the backup-versus-survivor comparison rather
-- than transcribed, so it cannot drift from what was measured.
--
-- Scope is both singleton pairs, not just the 2021 one. The 2020 pair
-- contributes only game_clock_start on 2 plays, which the same rule covers.

create temp table restore_map (src bigint, tgt bigint) on commit drop;
insert into restore_map values (2020112602, 2020120200), (2021122201, 2021122101);

-- PRE-CONDITIONS. Each names the specific thing that must hold, so a failure
-- says which premise moved rather than that something went wrong.
do $$
declare
  n_backup_plays int;
  n_charted_survivor int;
  n_charted_backup int;
  n_pairs int;
begin
  select count(*) into n_backup_plays
  from forked_esbid_backup_20260903_nfl_plays b join restore_map m on m.src = b.esbid;
  if n_backup_plays <> 336 then
    raise exception 'backup holds % singleton play(s), expected 336', n_backup_plays;
  end if;

  select count(*) into n_charted_backup
  from forked_esbid_backup_20260903_nfl_plays
  where esbid = 2021122201 and is_play_action is not null;
  if n_charted_backup <> 121 then
    raise exception 'backup holds % charted play(s), expected 121', n_charted_backup;
  end if;

  -- The whole reason this migration exists. If the survivor is already charted,
  -- something else filled it and this migration must be re-thought, not run.
  select count(*) into n_charted_survivor
  from nfl_plays where esbid = 2021122101 and is_play_action is not null;
  if n_charted_survivor <> 0 then
    raise exception 'survivor already holds % charted play(s), expected 0', n_charted_survivor;
  end if;

  -- The join must reach the rows. A mapping that matches nothing would make
  -- every post-condition below pass vacuously.
  select count(*) into n_pairs
  from forked_esbid_backup_20260903_nfl_plays b
  join restore_map m on m.src = b.esbid
  join nfl_plays p on p.esbid = m.tgt and p.play_id = b.play_id and p.season_year = b.season_year;
  if n_pairs <> 332 then
    raise exception 'mapping reaches % pair(s), expected 332', n_pairs;
  end if;
end $$;

-- Snapshot the sibling games before the write, so the leak check below has
-- something real to compare against.
create temp table sibling_before on commit drop as
select esbid, count(*) filter (where is_play_action is not null) as charted
from nfl_plays
where season_year = 2021 and week = 15 and season_type = 'REG'
  and esbid <> 2021122101
group by esbid;

update nfl_plays p
set
  avoided_sacks = coalesce(p.avoided_sacks, b.avoided_sacks),
  blitzers = coalesce(p.blitzers, b.blitzers),
  box_defenders_charted = coalesce(p.box_defenders_charted, b.box_defenders_charted),
  coverage_on_target = coalesce(p.coverage_on_target, b.coverage_on_target),
  coverage_type_charted = coalesce(p.coverage_type_charted, b.coverage_type_charted),
  defensive_back_count = coalesce(p.defensive_back_count, b.defensive_back_count),
  game_clock_start = coalesce(p.game_clock_start, b.game_clock_start),
  is_batted_pass = coalesce(p.is_batted_pass, b.is_batted_pass),
  is_catchable_ball = coalesce(p.is_catchable_ball, b.is_catchable_ball),
  is_contested_ball = coalesce(p.is_contested_ball, b.is_contested_ball),
  is_created_reception = coalesce(p.is_created_reception, b.is_created_reception),
  is_dropped_pass = coalesce(p.is_dropped_pass, b.is_dropped_pass),
  is_highlight_pass = coalesce(p.is_highlight_pass, b.is_highlight_pass),
  is_hindered_pass = coalesce(p.is_hindered_pass, b.is_hindered_pass),
  is_interception_worthy = coalesce(p.is_interception_worthy, b.is_interception_worthy),
  is_no_huddle = coalesce(p.is_no_huddle, b.is_no_huddle),
  is_out_of_pocket_pass = coalesce(p.is_out_of_pocket_pass, b.is_out_of_pocket_pass),
  is_pain_free_play = coalesce(p.is_pain_free_play, b.is_pain_free_play),
  is_physical_ball = coalesce(p.is_physical_ball, b.is_physical_ball),
  is_play_action = coalesce(p.is_play_action, b.is_play_action),
  is_qb_fault_sack = coalesce(p.is_qb_fault_sack, b.is_qb_fault_sack),
  is_qb_hit = coalesce(p.is_qb_hit, b.is_qb_hit),
  is_qb_pressure = coalesce(p.is_qb_pressure, b.is_qb_pressure),
  is_qb_rush = coalesce(p.is_qb_rush, b.is_qb_rush),
  is_qb_sneak = coalesce(p.is_qb_sneak, b.is_qb_sneak),
  is_screen_pass = coalesce(p.is_screen_pass, b.is_screen_pass),
  is_shovel_pass = coalesce(p.is_shovel_pass, b.is_shovel_pass),
  is_sideline_pass = coalesce(p.is_sideline_pass, b.is_sideline_pass),
  is_stunt = coalesce(p.is_stunt, b.is_stunt),
  is_successful_play = coalesce(p.is_successful_play, b.is_successful_play),
  is_throw_away = coalesce(p.is_throw_away, b.is_throw_away),
  is_trick_look = coalesce(p.is_trick_look, b.is_trick_look),
  is_trick_play = coalesce(p.is_trick_play, b.is_trick_play),
  is_zero_blitz = coalesce(p.is_zero_blitz, b.is_zero_blitz),
  missed_or_broken_tackle = coalesce(p.missed_or_broken_tackle, b.missed_or_broken_tackle),
  out_of_pocket_details = coalesce(p.out_of_pocket_details, b.out_of_pocket_details),
  pass_rushers = coalesce(p.pass_rushers, b.pass_rushers),
  quarterback_position = coalesce(p.quarterback_position, b.quarterback_position),
  read_thrown = coalesce(p.read_thrown, b.read_thrown),
  receiver_separation = coalesce(p.receiver_separation, b.receiver_separation),
  starting_hash = coalesce(p.starting_hash, b.starting_hash),
  time_to_pass = coalesce(p.time_to_pass, b.time_to_pass),
  time_to_pressure = coalesce(p.time_to_pressure, b.time_to_pressure),
  true_air_yards = coalesce(p.true_air_yards, b.true_air_yards),
  yards_after_any_contact = coalesce(p.yards_after_any_contact, b.yards_after_any_contact)
from forked_esbid_backup_20260903_nfl_plays b
join restore_map m on m.src = b.esbid
where p.esbid = m.tgt
  and p.play_id = b.play_id
  and p.season_year = b.season_year;

-- POST-CONDITIONS.
do $$
declare
  n_charted int;
  n_cells_missing int;
  n_leaked int;
begin
  select count(*) into n_charted
  from nfl_plays where esbid = 2021122101 and is_play_action is not null;
  if n_charted <> 121 then
    raise exception 'survivor holds % charted play(s) after restore, expected 121', n_charted;
  end if;

  -- Conservation. Every cell the backup held and the survivor lacked must now
  -- be present. A partial update satisfies the charted count above by accident;
  -- this does not.
  select count(*) into n_cells_missing
  from (
    select to_jsonb(b) as bj, to_jsonb(p) as pj
    from forked_esbid_backup_20260903_nfl_plays b
    join restore_map m on m.src = b.esbid
    join nfl_plays p on p.esbid = m.tgt and p.play_id = b.play_id
      and p.season_year = b.season_year
  ) pairs, lateral jsonb_each(bj) e
  where e.value <> 'null'::jsonb and pj -> e.key = 'null'::jsonb;
  if n_cells_missing <> 0 then
    raise exception '% backup cell(s) still absent from the survivor', n_cells_missing;
  end if;

  -- Nothing outside the two target games may have moved, compared against the
  -- snapshot taken BEFORE the update rather than against itself.
  select count(*) into n_leaked
  from sibling_before s
  join (
    select esbid, count(*) filter (where is_play_action is not null) as charted
    from nfl_plays
    where season_year = 2021 and week = 15 and season_type = 'REG'
      and esbid <> 2021122101
    group by esbid
  ) a on a.esbid = s.esbid
  where a.charted <> s.charted;
  if n_leaked <> 0 then
    raise exception '% sibling game(s) changed charted count', n_leaked;
  end if;
end $$;

