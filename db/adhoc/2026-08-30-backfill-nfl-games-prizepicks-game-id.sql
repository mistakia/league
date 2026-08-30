-- STATUS: APPLIED 2026-08-30 against league_production
-- Backfill nfl_games.prizepicks_game_id from the existing prop_markets_index
-- history, by the kickoff test.
--
-- THE TEST. A PrizePicks source_event_id is the book's own game id, carried
-- from a projection's attributes.game_id and stored on every index row since
-- the importer began recording it. For each (source_event_id, esbid) pair the
-- history holds, ask whether ANY row of that pair was observed BEFORE the
-- stamped game kicked off. A book does not open a prop on a game already in
-- progress, so a pair observed entirely post-kickoff is corrupted residue and a
-- pair with at least one pre-kickoff observation is plausible. An event id with
-- exactly one plausible esbid resolves; anything else is left null.
--
-- This works only because the drift is one-directional. All 9,160 drifting
-- markets are PrizePicks, and every one holds a SINGLE stable source_event_id
-- while its esbid moves -- so the event id is the fixed point and the esbid is
-- what wandered. The event id is not a coarse grain; it is the answer.
--
-- WHAT IT POPULATES: 683 nfl_games rows, from 685 resolved event ids. The plan
-- for this task predicted 685 rows and that number is two too high; the
-- shortfall is not a failure of the test and is enumerated under DEGENERATE
-- SPELLINGS below.
--
-- Null is a first-class outcome here, not a gap to be closed by guessing. The
-- importer falls back to its existing team-based match whenever the crosswalk
-- misses and writes the resolution back, so an incomplete backfill degrades to
-- exactly today's behavior for the rows it skips. Every event id below is left
-- null deliberately.
--
--
-- THE TEN UNRESOLVED EVENT IDS
--
-- Seven have NO plausible esbid -- every index row for them was observed after
-- the stamped game had already kicked off, so the test has nothing to affirm.
-- Six are 2024 week-17 stragglers of two to four rows each; the seventh is a
-- literal string rather than a game id. (The task body describes this group as
-- "seven week-17 stragglers ... and one SuperBowl", which counts eight; the
-- measured set is six plus SuperBowl.)
--
--   NFL_game_2ofT5ZqNLcD0wYxTOc5e8Xqt   4 rows  -> 2024122600  2024 REG 17 SEA@CHI
--   NFL_game_AUZ8LPi3Ypfe21yJHX1qszHH   2 rows  -> 2024122910  2024 REG 17 DAL@PHI
--   NFL_game_Bch7Oe7NxwnPaPwH7P4wrpdq   2 rows  -> 2024122801  2024 REG 17 DEN@CIN
--   NFL_game_dE5jYn58y3KAmr8IDDwpkLX3   4 rows  -> 2024122908  2024 REG 17 LV@NO
--   NFL_game_iJiNnMphckandglRRE6EazTV   4 rows  -> 2024122909  2024 REG 17 CAR@TB
--   NFL_game_vGKu1245AD8FNpapZr9h9dRG   4 rows  -> 2024122801  2024 REG 17 DEN@CIN
--   SuperBowl                           1 row   -> 2025012601  2024 POST 3 BUF@KC
--
-- Three have MORE THAN ONE plausible esbid, and are themselves instances of the
-- drift this task exists to stop -- the book reused an event id across weeks,
-- or the resolver stamped two different games early enough that both pass the
-- test. Adjudicating them by row count would pick the majority game, which is
-- an inference the kickoff test does not license, so they stay null:
--
--   NFL_game_O0Bbd8YaAfhi417H0Zeb0wTF
--     2025100505  948 rows  plausible    2025 REG  5 DAL@NYJ
--     2025092900    2 rows  plausible    2025 REG  4 NYJ@MIA
--     2025092812    2 rows  not          2025 REG  4 GB@DAL
--   NFL_game_PNZgCAAobQ2f5V9Mf6nwNSww
--     2024112802  379 rows  plausible    2024 REG 13 MIA@GB
--     2024112404   43 rows  plausible    2024 REG 12 NE@MIA
--     2024112408   54 rows  not          2024 REG 12 SF@GB
--   NFL_game_Vj889ddpzXU6hg1b7Tx8TM10
--     2024121501  419 rows  plausible    2024 REG 15 KC@CLE
--     2024120810    1 row   plausible    2024 REG 14 LAC@KC
--
--
-- DEGENERATE SPELLINGS, and why 685 resolved event ids populate only 683 rows.
--
-- Two pairs of resolved event ids land on the SAME game. They are not a
-- conflict: each pair is one identifier written two ways, from the era before
-- the book moved to the NFL_game_* format, and the two spellings differ only in
-- serialization. A game row holds one value, so the file keeps the spelling
-- carrying the most index rows and drops the other.
--
--   2023121706  2023 REG 15 DAL@BUF   keeps 10173224 (222 rows)
--                                     drops 10173224.0 (6 rows, float-formatted)
--   2024011402  2023 POST 1 LA@DET    keeps 10508789 (65 rows)
--                                     drops 10508789 with a trailing tab (1 row)
--
-- Dropping the minority spelling costs nothing going forward: both are 2023
-- history, and PrizePicks has emitted the NFL_game_* format since. A future
-- payload carrying a degenerate spelling simply misses the crosswalk and takes
-- the fallback path.
--
-- The unique index added by 2026-08-30-add-nfl-games-prizepicks-game-id.sql is
-- therefore satisfiable BY CONSTRUCTION rather than by luck: distinct on (esbid)
-- makes one game the target of at most one value, and each value reaches at most
-- one game because the resolver is keyed on the event id.
--
-- Read-mostly and idempotent in effect: it stamps a column no deployed code
-- reads yet. Safe to land ahead of the deploy.

set lock_timeout = '30s';

with pp as (
  select
    pmi.source_event_id,
    pmi.esbid,
    pmi.observed_at,
    g.kickoff_at
  from prop_markets_index pmi
  join nfl_games g on g.esbid = pmi.esbid
  where pmi.source_id = 'PRIZEPICKS'
    and pmi.esbid is not null
    and pmi.source_event_id is not null
    and g.kickoff_at is not null
),
candidate as (
  select
    source_event_id,
    esbid,
    bool_or(observed_at < kickoff_at) as is_plausible,
    count(*) as index_rows
  from pp
  group by source_event_id, esbid
),
resolved as (
  select
    source_event_id,
    min(esbid) filter (where is_plausible) as esbid,
    sum(index_rows) filter (where is_plausible) as index_rows
  from candidate
  group by source_event_id
  having count(*) filter (where is_plausible) = 1
),
canonical as (
  select distinct on (esbid)
    esbid,
    source_event_id
  from resolved
  order by esbid, index_rows desc, source_event_id
)
update nfl_games g
set prizepicks_game_id = c.source_event_id
from canonical c
where g.esbid = c.esbid;

-- Post-conditions. Assert the PROPERTIES the crosswalk has to hold, not the
-- specific values that establish them.
do $$
declare
  stamped_games bigint;
  distinct_ids bigint;
  unresolved_event_ids bigint;
begin
  select count(*) into stamped_games
  from nfl_games where prizepicks_game_id is not null;

  select count(distinct prizepicks_game_id) into distinct_ids
  from nfl_games where prizepicks_game_id is not null;

  if stamped_games <> 683 then
    raise exception
      'expected 683 stamped games, found %', stamped_games;
  end if;

  if distinct_ids <> stamped_games then
    raise exception
      'prizepicks_game_id is not one-to-one: % games carry % distinct ids',
      stamped_games, distinct_ids;
  end if;

  -- Every PrizePicks event id in the index either resolved to a stamped game or
  -- is one of the ten enumerated above plus the two dropped spellings.
  select count(*) into unresolved_event_ids
  from (
    select distinct pmi.source_event_id
    from prop_markets_index pmi
    where pmi.source_id = 'PRIZEPICKS'
      and pmi.source_event_id is not null
      and pmi.esbid is not null
      and not exists (
        select 1 from nfl_games g
        where g.prizepicks_game_id = pmi.source_event_id
      )
  ) t;

  if unresolved_event_ids <> 12 then
    raise exception
      'expected 12 unmapped event ids (10 unresolved + 2 dropped spellings), found %',
      unresolved_event_ids;
  end if;
end $$;
