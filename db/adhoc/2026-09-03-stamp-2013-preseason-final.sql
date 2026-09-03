-- STATUS: APPLIED 2026-09-03 against league_production
--
-- Stamp the 2013 preseason FINAL so it can be graded. Closes the third item of
-- user:task/league/repair-silent-play-match-ambiguity.md.
--
-- All 65 games of the 2013 preseason carry a NULL status, so the
-- nfl-plays-game-coverage check in db/checks/registry.mjs -- which selects on
-- `g.status like 'FINAL%'` -- excludes the whole season block. Its plays are
-- present and correct; only the stamp is missing. This is a different mechanism
-- from the forked-esbid defect that hid 2013 and 2014 preseason PLAYS, which
-- db/adhoc/2026-09-03-repair-forked-play-stats-esbids.sql already repaired.
--
-- A CORRECTION TO THE FRAMING THIS INHERITED. The registry note and the task
-- both say 2013 is "the only season between 2002 and 2025 that is unstamped".
-- That is not quite right, and the difference matters for anyone re-running the
-- measurement: 2017, 2018 and 2019 each carry a handful of unstamped PRE games,
-- 2020 an unstamped PRO, and 2022 one unstamped POST and one REG. What is true
-- -- and what actually costs a season of coverage -- is that 2013 PRE is the
-- only WHOLE season-type block that is unstamped. The stragglers are individual
-- games and are out of scope here.
--
-- WHY 'FINAL' AND NOT 'FINAL_OVER'. Zero of the 65 games carry is_overtime, and
-- both neighbouring preseasons are uniformly 'FINAL' (2012: 65 FINAL, 2014: 65
-- FINAL). So this puts 2013 in exactly the state its neighbours are already in.
--
-- ON THE 0-0 SCORES, checked because stamping a game FINAL asserts it is over
-- and a 0-0 final would be a suspicious thing to assert. Every 2013 preseason
-- game reads home_score 0 and away_score 0 -- and so does every game of 2011,
-- 2012, 2014, 2015 and 2016 preseason, all 65 of each. Preseason scores are
-- simply not populated in this table for that era, so 2013 is not anomalous and
-- the stamp does not make it claim anything its neighbours do not already claim.
--
-- THE 2013 PRO BOWL IS DELIBERATELY LEFT ALONE. It also carries a NULL status,
-- but the coverage check reports the Pro Bowl un-gradeable rather than as a
-- finding (one game a week fails its eight-game precondition), so stamping it
-- would change no reading and assert something nothing verified.

do $$
declare
  n_games bigint;
  n_null_status bigint;
  n_without_plays bigint;
  n_overtime bigint;
begin
  select count(*), count(*) filter (where status is null), count(*) filter (where is_overtime)
  into n_games, n_null_status, n_overtime
  from nfl_games where season_year = 2013 and season_type = 'PRE';

  if n_games <> 65 or n_null_status <> 65 then
    raise exception
      '2013 preseason moved: % game(s), % with a null status (expected 65/65)',
      n_games, n_null_status;
  end if;

  if n_overtime <> 0 then
    raise exception
      '% 2013 preseason game(s) went to overtime -- FINAL is the wrong stamp for those',
      n_overtime;
  end if;

  -- The stamp's whole claim is that these games are complete enough to grade,
  -- and the check it unblocks asserts every FINAL game has plays. Stamping a
  -- game with no plays would manufacture the finding rather than close it.
  select count(*) into n_without_plays
  from nfl_games g
  where g.season_year = 2013 and g.season_type = 'PRE'
    and not exists (select 1 from nfl_plays p where p.esbid = g.esbid);
  if n_without_plays <> 0 then
    raise exception
      '% 2013 preseason game(s) hold no plays -- stamping them FINAL would create a coverage finding, not close one',
      n_without_plays;
  end if;
end $$;

update nfl_games
set status = 'FINAL'
where season_year = 2013 and season_type = 'PRE' and status is null;

do $$
declare
  n_final bigint;
  n_gradeable_without_plays bigint;
begin
  select count(*) into n_final
  from nfl_games where season_year = 2013 and season_type = 'PRE' and status like 'FINAL%';
  if n_final <> 65 then
    raise exception 'expected 65 stamped 2013 preseason games, found %', n_final;
  end if;

  -- The post-condition that matters: the season block is now graded AND reads
  -- clean, so the check goes from silent to 1.0 rather than from silent to red.
  select count(*) into n_gradeable_without_plays
  from nfl_games g
  where g.season_year = 2013 and g.season_type = 'PRE' and g.status like 'FINAL%'
    and not exists (select 1 from nfl_plays p where p.esbid = g.esbid);
  if n_gradeable_without_plays <> 0 then
    raise exception
      '% newly-graded 2013 preseason game(s) have no plays', n_gradeable_without_plays;
  end if;
end $$;
