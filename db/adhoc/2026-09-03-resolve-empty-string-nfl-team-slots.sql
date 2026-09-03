-- STATUS: NOT APPLIED. Authored and rehearsed only. Needs operator approval at
-- execution time, and the DDL at the end needs `yarn export:schema` in the SAME
-- commit as the apply.
--
-- Resolve the four empty-string NFL team slots, and remove the column DEFAULT
-- that minted two of them. Closes user:task/league/resolve-empty-string-nfl-team-slots.md.
--
-- These four are the only findings nfl-team-abbreviation-conformance reports.
-- The 2026-09-02 conform deliberately left them alone, correctly, because an
-- empty team is a different defect from an era token. They are TWO defects, not
-- one, and only one of them is the absence the check's prose assumed.
--
-- HALF ONE -- nfl_plays, and here the absence reading is right.
-- Both rows are play_type NOPL with every other column null: no description, no
-- quarter, no down, no offense or defense team. 88,414 sibling NOPL rows already
-- carry a NULL possession and exactly 2 carry '', so NULL is the established
-- convention measured against the corpus rather than merely the tidier value.
--
-- HALF TWO -- player_gamelogs, and here the absence reading is WRONG.
-- These are not absences. Both rows are pid CALE-JOHN-027832 in 2024 preseason;
-- the player is a Jaguar, and the games are KC at JAX and TB at JAX. Their teams
-- are JAX and their opponents are KC and TB, both of which the rows currently
-- get wrong: opponent reads GB and MIN, which are Cleveland's opponents those
-- weeks. A namesake (CALE-JOHN-000167, also an LB) was on Cleveland's gameday
-- roster, and scripts/generate-player-snaps.mjs paired the snap group with that
-- player's CLE gamelog because it matched on the player alone. It then took the
-- esbid from the snaps, the opponent from the CLE row, and omitted nfl_team from
-- the insert entirely -- so the row took the column DEFAULT.
--
-- Do NOT write NULL here (the column is NOT NULL) and do NOT write INA. All 12
-- rows carrying INA in this column are wrong-game misattributions from other
-- importers, and scripts/generate-player-gamelogs.mjs already excludes both ''
-- and 'INA' at read time as not-a-franchise. INA would file a row with a known
-- team into a class of known-defective ones.
--
-- ORDER MATTERS. The writer fix (league 2bcceda77) ships BEFORE the DDL below.
-- Dropping the default while that writer can still omit the column turns a
-- silent wrong row into a mid-week crash in the weekly stats pipeline. With the
-- pairing fixed the insert path is unreachable for this cause, so the dropped
-- default becomes a loud guard rather than a live hazard.
--
-- db:exec supplies the transaction; do NOT add BEGIN/COMMIT.

-- Half one: the two NOPL plays.
update nfl_plays
set possession_nfl_team = null
where possession_nfl_team = '';

-- Half two: the two Jaguars gamelogs. Keyed on the pair, and the opponent is
-- corrected alongside the team because both came from the wrong game.
update player_gamelogs
set nfl_team = 'JAX', opponent_nfl_team = 'KC'
where pid = 'CALE-JOHN-027832' and esbid = 2024081056;

update player_gamelogs
set nfl_team = 'JAX', opponent_nfl_team = 'TB'
where pid = 'CALE-JOHN-027832' and esbid = 2024081762;

-- The DEFAULT that minted the class. Exactly one writer ever relied on it, by
-- accident, and it produced exactly two rows -- both wrong. No writer omits this
-- column legitimately, so the default has no case to serve; without it, a writer
-- that forgets raises a NOT NULL violation at write time instead of minting a
-- row that every null-counting check scores as healthy.
--
-- Recurses to all 28 partitions (ONLY would prevent that). The post-condition
-- below reads pg_attrdef across the whole family rather than trusting it.
alter table player_gamelogs alter column nfl_team drop default;

-- POST-CONDITIONS. Each raises rather than reporting, so a partial apply cannot
-- commit. Asserted on the PROPERTY, not on a bare count that ordinary repair
-- work would move.
do $$
declare
  empty_plays int;
  empty_gamelogs int;
  wrong_side int;
  remaining_defaults int;
begin
  select count(*) into empty_plays from nfl_plays where possession_nfl_team = '';
  if empty_plays <> 0 then
    raise exception 'nfl_plays still holds % empty possession slots', empty_plays;
  end if;

  select count(*) into empty_gamelogs from player_gamelogs where nfl_team = '' or opponent_nfl_team = '';
  if empty_gamelogs <> 0 then
    raise exception 'player_gamelogs still holds % empty team slots', empty_gamelogs;
  end if;

  -- The repaired rows must name teams that are actually IN their game. This is
  -- the assertion that would have caught the original defect, and it is
  -- independent of the values written above.
  select count(*) into wrong_side
  from player_gamelogs g join nfl_games ng on ng.esbid = g.esbid
  where g.pid = 'CALE-JOHN-027832'
    and g.esbid in (2024081056, 2024081762)
    and (g.nfl_team not in (ng.away_nfl_team, ng.home_nfl_team)
         or g.opponent_nfl_team not in (ng.away_nfl_team, ng.home_nfl_team));
  if wrong_side <> 0 then
    raise exception 'repaired gamelogs still name a team outside their game (% rows)', wrong_side;
  end if;

  -- The parent AND every partition. A default surviving on one partition would
  -- keep minting the class for any writer that inserts into it directly.
  select count(*) into remaining_defaults
  from pg_attrdef ad
  join pg_class c on c.oid = ad.adrelid
  join pg_attribute a on a.attrelid = c.oid and a.attnum = ad.adnum
  where c.relname like 'player_gamelogs%' and a.attname = 'nfl_team';
  if remaining_defaults <> 0 then
    raise exception 'nfl_team still carries a DEFAULT on % player_gamelogs relation(s)', remaining_defaults;
  end if;
end $$;
