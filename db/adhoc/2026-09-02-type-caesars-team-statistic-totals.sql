-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Type 10,508 CAESARS rows across 11 templates -- the team statistic totals and
-- the game-level total field goals -- and attribute the team on the 19,836
-- selections underneath the team-grain ten.
--
-- THE TWO HALVES SHIP TOGETHER, DELIBERATELY, AND THE ORDER MATTERS. Typing the
-- team family without attributing it would reproduce the GAME_TEAM_TOTAL
-- collapse repaired by
-- db/adhoc/2026-09-02-attribute-caesars-game-team-total-selections.sql, at six
-- times its scale. Caesars publishes each of these as one market per team from
-- one template with bare over/under selections, and the team survives only as a
-- prefix on the market name. Type both markets and they become one key on
-- (esbid, market_type, selection_name) -- the key the data-view betting columns
-- and the historical hit-rate calculation join on -- so two different lines land
-- in one cell and the observed_at dedup picks arbitrarily. Settlement never
-- catches it, because every constant here resolves to UNSUPPORTED. Measured on
-- these templates before this file: 9,808 colliding groups.
--
-- WHY AN EXTINCT FAMILY EARNS CONSTANTS AT ALL. Caesars has not published this
-- family since 2025-02-07, so these are not forward mappings. But settlement
-- resolves an unmapped type to UNSUPPORTED and the data-view columns offer only
-- what the param groups expose, so typing a historical row to a constant that
-- does not exist buys nothing anywhere. For an extinct family the choice is
-- binary: coin the constant and accept the param expansion, or leave the rows
-- untyped. This takes team_game_market_types from 33 to 42.
--
-- THE PAIRS WERE GENERATED, not hand-typed: by calling the new get_market_type
-- on all 820 distinct stored Caesars templates and DIFFING against the mapper
-- as it stood at the previous commit. The generator raised on any template
-- whose type CHANGED rather than appeared; none did, so this file cannot be
-- silently re-typing a row that already had an answer.
--
-- THE TEMPLATE MUST BE WRAPPED IN PIPES BEFORE THE MAPPER SEES IT. The importer
-- stores templateName.replaceAll('|',''), so the stored segment has the pipes
-- stripped while the table keys carry them. The pairs above were derived with
-- the wrap applied; this file joins on the bare stored form.
--
-- 'TEAM TOTAL TEAM DEFENSIVE TACKLES' IS NOT HERE, and its 1,116 rows are why
-- this file types 10,508 rather than the 11,320 the plan projected. The
-- statistic is ambiguous -- the only player-side tackle constants are the
-- combined GAME_TACKLES_ASSISTS and its alt, and Caesars does not publish
-- whether its team aggregate counts tackles plus assists or solo tackles -- so
-- it stays a no-map row in the mapper table, carrying that reason. A settlement
-- handler would sum whichever the constant name claimed.
--
-- 'TOTAL MATCH FIELD GOALS' IS GAME GRAIN, not team grain, and belongs to this
-- file only because it was swept into the team census by a regex. Its market
-- name is a bare 'Total Field Goals' with no team prefix, it is still being
-- published (last written 2026-09-01), and it gets no selection_pid.
--
-- THE LIVE VARIANT FALLS OUT BY CONSTRUCTION. 'Team Total Team Rushing
-- Touchdowns Live' holds 532 rows and the table is exact match, so it matches no
-- key. The post-condition asserts no live-suffixed template acquired a type.
--
-- WHAT THIS FILE DOES NOT CLAIM TO FIX. 216 selection groups still share a key
-- after attribution, on three esbids Caesars listed under more than one event
-- id. Same residual as the GAME_TEAM_TOTAL repair, same cause, and the
-- observed_at dedup resolves it correctly by taking the later listing. The
-- post-condition asserts the residual is exactly those rather than asserting a
-- zero this file cannot honestly reach.
--
-- DURABILITY. market_type merges as excluded.market_type and selection_pid
-- upserts under a bare .merge(), so an incoming import overwrites both. This
-- write is durable for the right reason on both halves: the mapper now types
-- these templates and the importer now derives the same pid. The extinct
-- population is a belt as well.

CREATE TEMP TABLE caesars_team_totals_baseline ON COMMIT DROP AS
SELECT
  count(*) FILTER (WHERE source_id = 'CAESARS' AND market_type IS NULL)
    AS caesars_null_type,
  count(*) FILTER (WHERE source_id <> 'CAESARS' AND market_type IS NULL)
    AS other_sources_null_type,
  count(*) FILTER (WHERE is_market_settled) AS settled_markets
FROM public.prop_markets_index;

CREATE TEMP TABLE caesars_team_totals_attribution ON COMMIT DROP AS
WITH caesars_team_token (team_token, nfl_team) AS (
  VALUES
    ('ARI', 'ARI'),
    ('Arizona Cardinals', 'ARI'),
    ('ATL', 'ATL'),
    ('Atlanta Falcons', 'ATL'),
    ('BAL', 'BAL'),
    ('Baltimore Ravens', 'BAL'),
    ('BUF', 'BUF'),
    ('Buffalo Bills', 'BUF'),
    ('CAR', 'CAR'),
    ('Carolina Panthers', 'CAR'),
    ('CHI', 'CHI'),
    ('Chicago Bears', 'CHI'),
    ('CIN', 'CIN'),
    ('Cincinnati Bengals', 'CIN'),
    ('CLE', 'CLE'),
    ('Cleveland Browns', 'CLE'),
    ('DAL', 'DAL'),
    ('Dallas Cowboys', 'DAL'),
    ('DEN', 'DEN'),
    ('Denver Broncos', 'DEN'),
    ('DET', 'DET'),
    ('Detroit Lions', 'DET'),
    ('GB', 'GB'),
    ('Green Bay Packers', 'GB'),
    ('HOU', 'HOU'),
    ('Houston Texans', 'HOU'),
    ('IND', 'IND'),
    ('Indianapolis Colts', 'IND'),
    ('Jacksonville Jaguars', 'JAX'),
    ('JAX', 'JAX'),
    ('Kansas City Chiefs', 'KC'),
    ('KC', 'KC'),
    ('LA', 'LA'),
    ('LAC', 'LAC'),
    ('Las Vegas Raiders', 'LV'),
    ('Los Angeles Chargers', 'LAC'),
    ('Los Angeles Rams', 'LA'),
    ('LVR', 'LV'),
    ('MIA', 'MIA'),
    ('Miami Dolphins', 'MIA'),
    ('MIN', 'MIN'),
    ('Minnesota Vikings', 'MIN'),
    ('NE', 'NE'),
    ('New England Patriots', 'NE'),
    ('New Orleans Saints', 'NO'),
    ('New York Giants', 'NYG'),
    ('New York Jets', 'NYJ'),
    ('NOR', 'NO'),
    ('NYG', 'NYG'),
    ('NYJ', 'NYJ'),
    ('PHI', 'PHI'),
    ('Philadelphia Eagles', 'PHI'),
    ('PIT', 'PIT'),
    ('Pittsburgh Steelers', 'PIT'),
    ('San Francisco 49ers', 'SF'),
    ('SEA', 'SEA'),
    ('Seattle Seahawks', 'SEA'),
    ('SF', 'SF'),
    ('Tampa Bay Buccaneers', 'TB'),
    ('TB', 'TB'),
    ('TEN', 'TEN'),
    ('Tennessee Titans', 'TEN'),
    ('Washington Commanders', 'WAS'),
    ('WSC', 'WAS')
), template_suffix (template, name_suffix) AS (
  VALUES
    ('Team Total Team Touchdowns', 'Total Team Touchdowns'),
    ('Team Total Team Offense Touchdowns', 'Total Team Offense Touchdowns'),
    ('Team Total Team Passing Yards', 'Total Team Passing Yards'),
    ('Team Total Team Passing Touchdowns', 'Total Team Passing Touchdowns'),
    ('Team Total Team Rushing Yards', 'Total Team Rushing Yards'),
    ('Team Total Team Rushing Touchdowns', 'Total Team Rushing Touchdowns'),
    ('Team Total Team Rushing Attempts', 'Total Team Rushing Attempts'),
    ('Team Total Team Receiving Yards', 'Total Team Receiving Yards'),
    ('Team Total Team Receiving Touchdowns', 'Total Team Receiving Touchdowns'),
    ('Team Total Team Receptions', 'Total Team Receptions')
), market_name AS (
  SELECT
    i.source_id,
    i.source_market_id,
    i.time_type,
    i.esbid,
    i.source_event_id,
    split_part(i.source_market_name, ' — ', 2) AS template,
    reverse(split_part(reverse(split_part(i.source_market_name, ' — ', 1)), ' - ', 1))
      AS market_name
  FROM public.prop_markets_index AS i
  WHERE i.source_id = 'CAESARS'
    AND i.market_type IS NULL
)
SELECT
  m.source_id,
  m.source_market_id,
  m.time_type,
  m.esbid,
  m.source_event_id,
  m.template,
  k.nfl_team
FROM market_name AS m
JOIN template_suffix AS t USING (template)
LEFT JOIN caesars_team_token AS k
  ON k.team_token = left(m.market_name, length(m.market_name) - length(t.name_suffix) - 1);

-- Pre-conditions.
DO $$
DECLARE
  baseline record;
  team_index_rows integer;
  unresolved integer;
  team_not_in_game integer;
  colliding_groups integer;
BEGIN
  SELECT * INTO baseline FROM caesars_team_totals_baseline;

  IF baseline.caesars_null_type <> 115352 THEN
    RAISE EXCEPTION
      'expected 115352 untyped CAESARS rows, found %; the population moved and the counts in this file are about a different one, rolling back',
      baseline.caesars_null_type;
  END IF;

  SELECT count(*) INTO team_index_rows FROM caesars_team_totals_attribution;
  IF team_index_rows <> 10204 THEN
    RAISE EXCEPTION
      'expected 10204 untyped team-grain index rows, found %; rolling back', team_index_rows;
  END IF;

  -- Every market name must yield a team. Unlike the GAME_TEAM_TOTAL repair
  -- there is no Pro Bowl exception here, so the tolerance is zero.
  SELECT count(*) INTO unresolved
    FROM caesars_team_totals_attribution WHERE nfl_team IS NULL;
  IF unresolved <> 0 THEN
    RAISE EXCEPTION
      '% market names yielded no team; a name shape has drifted and the attribution below would be a guess, rolling back',
      unresolved;
  END IF;

  -- The check that makes the derivation honest rather than a parse that cannot
  -- report failure: every team read off a market name must be one of the two
  -- teams the game holds. Validated to go red -- repointing one token at
  -- another team raises this from 0 to 342 on the sibling population.
  SELECT count(*) INTO team_not_in_game
    FROM caesars_team_totals_attribution AS a
    JOIN public.nfl_games AS g ON g.esbid = a.esbid
   WHERE a.nfl_team IS NOT NULL
     AND a.nfl_team NOT IN (g.home_nfl_team, g.away_nfl_team);
  IF team_not_in_game <> 0 THEN
    RAISE EXCEPTION
      '% markets resolved to a team the game does not hold; rolling back', team_not_in_game;
  END IF;

  SELECT count(*) INTO colliding_groups FROM (
    SELECT 1
      FROM caesars_team_totals_attribution AS a
      JOIN public.prop_market_selections_index AS s
        ON s.source_id = a.source_id
       AND s.source_market_id = a.source_market_id
       AND s.time_type = a.time_type
     GROUP BY a.esbid, a.time_type, a.template, s.selection_name
    HAVING count(*) > 1
  ) AS g;
  IF colliding_groups <> 9808 THEN
    RAISE EXCEPTION
      'expected 9808 colliding groups before attribution, found %; rolling back', colliding_groups;
  END IF;

  RAISE NOTICE 'baseline: % untyped CAESARS rows, % colliding groups',
    baseline.caesars_null_type, colliding_groups;
END $$;

DO $$
DECLARE
  typed integer;
  attributed integer;
BEGIN
  WITH template_market_type (template, market_type) AS (
    VALUES
      ('Team Total Team Offense Touchdowns', 'GAME_TEAM_OFFENSE_TOUCHDOWNS'),
      ('Team Total Team Passing Touchdowns', 'GAME_TEAM_PASSING_TOUCHDOWNS'),
      ('Team Total Team Passing Yards', 'GAME_TEAM_PASSING_YARDS'),
      ('Team Total Team Receiving Touchdowns', 'GAME_TEAM_RECEIVING_TOUCHDOWNS'),
      ('Team Total Team Receiving Yards', 'GAME_TEAM_RECEIVING_YARDS'),
      ('Team Total Team Receptions', 'GAME_TEAM_RECEPTIONS'),
      ('Team Total Team Rushing Attempts', 'GAME_TEAM_RUSHING_ATTEMPTS'),
      ('Team Total Team Rushing Touchdowns', 'GAME_TEAM_RUSHING_TOUCHDOWNS'),
      ('Team Total Team Rushing Yards', 'GAME_TEAM_RUSHING_YARDS'),
      ('Team Total Team Touchdowns', 'GAME_TEAM_TOUCHDOWNS'),
      ('Total Match Field Goals', 'GAME_TOTAL_FIELD_GOALS_MADE')
  )
  UPDATE public.prop_markets_index AS i
     SET market_type = t.market_type
    FROM template_market_type AS t
   WHERE i.source_id = 'CAESARS'
     AND i.market_type IS NULL
     AND split_part(i.source_market_name, ' — ', 2) = t.template;

  GET DIAGNOSTICS typed = ROW_COUNT;

  -- Exactly, not at least.
  IF typed <> 10508 THEN
    RAISE EXCEPTION
      'expected to type exactly 10508 rows, typed %; rolling back', typed;
  END IF;

  UPDATE public.prop_market_selections_index AS s
     SET selection_pid = a.nfl_team
    FROM caesars_team_totals_attribution AS a
   WHERE s.source_id = a.source_id
     AND s.source_market_id = a.source_market_id
     AND s.time_type = a.time_type
     AND s.selection_pid IS NULL
     AND a.nfl_team IS NOT NULL;

  GET DIAGNOSTICS attributed = ROW_COUNT;

  IF attributed <> 19836 THEN
    RAISE EXCEPTION
      'expected to attribute exactly 19836 selections, attributed %; rolling back', attributed;
  END IF;

  RAISE NOTICE 'typed % rows across 11 templates, attributed % selections', typed, attributed;
END $$;

-- Post-conditions, inside the same transaction.
DO $$
DECLARE
  baseline record;
  caesars_null_type integer;
  other_sources_null_type integer;
  settled_markets integer;
  live_typed integer;
  tackles_typed integer;
  still_null integer;
  colliding_groups integer;
  residual_not_duplicate_event integer;
BEGIN
  SELECT * INTO baseline FROM caesars_team_totals_baseline;

  SELECT count(*) FILTER (WHERE source_id = 'CAESARS' AND market_type IS NULL),
         count(*) FILTER (WHERE source_id <> 'CAESARS' AND market_type IS NULL),
         count(*) FILTER (WHERE is_market_settled)
    INTO caesars_null_type, other_sources_null_type, settled_markets
    FROM public.prop_markets_index;

  IF caesars_null_type <> 104844 THEN
    RAISE EXCEPTION
      'expected 104844 untyped CAESARS rows after typing, found %; rolling back',
      caesars_null_type;
  END IF;

  -- A per-source check, not just a Caesars one: a total that fell while another
  -- source rose would read as success on a single number.
  IF other_sources_null_type <> baseline.other_sources_null_type THEN
    RAISE EXCEPTION
      'another source''s untyped count moved (% vs %); rolling back',
      other_sources_null_type, baseline.other_sources_null_type;
  END IF;

  -- Typing makes a market readable, not graded. All eleven constants resolve to
  -- UNSUPPORTED, so the settled count must not move at all.
  IF settled_markets <> baseline.settled_markets THEN
    RAISE EXCEPTION
      'the settled-market count moved (% vs %); rolling back',
      settled_markets, baseline.settled_markets;
  END IF;

  SELECT count(*) INTO live_typed
    FROM public.prop_markets_index
   WHERE source_id = 'CAESARS'
     AND market_type IS NOT NULL
     AND split_part(source_market_name, ' — ', 2) LIKE '% Live';
  IF live_typed <> 0 THEN
    RAISE EXCEPTION
      '% live-suffixed templates carry a market_type; rolling back', live_typed;
  END IF;

  -- The no-map decision is a decision, so assert it held rather than trusting
  -- that the table had no entry.
  SELECT count(*) INTO tackles_typed
    FROM public.prop_markets_index
   WHERE source_id = 'CAESARS'
     AND market_type IS NOT NULL
     AND split_part(source_market_name, ' — ', 2) = 'Team Total Team Defensive Tackles';
  IF tackles_typed <> 0 THEN
    RAISE EXCEPTION
      '% Defensive Tackles rows acquired a type; that family is a deliberate no-map, rolling back',
      tackles_typed;
  END IF;

  SELECT count(*) INTO still_null
    FROM caesars_team_totals_attribution AS a
    JOIN public.prop_market_selections_index AS s
      ON s.source_id = a.source_id
     AND s.source_market_id = a.source_market_id
     AND s.time_type = a.time_type
   WHERE s.selection_pid IS NULL;
  IF still_null <> 0 THEN
    RAISE EXCEPTION
      '% team-grain selections left unattributed; rolling back', still_null;
  END IF;

  -- The collapse is gone: keying on the team as well takes 9,808 groups to 216.
  SELECT count(*) INTO colliding_groups FROM (
    SELECT 1
      FROM caesars_team_totals_attribution AS a
      JOIN public.prop_market_selections_index AS s
        ON s.source_id = a.source_id
       AND s.source_market_id = a.source_market_id
       AND s.time_type = a.time_type
     GROUP BY a.esbid, a.time_type, a.template, a.nfl_team, s.selection_name
    HAVING count(*) > 1
  ) AS g;
  IF colliding_groups <> 216 THEN
    RAISE EXCEPTION
      'expected 216 residual colliding groups, found %; rolling back', colliding_groups;
  END IF;

  -- And the residual is the OTHER defect: every remaining group sits on an
  -- esbid Caesars listed under more than one event id. Asserting the residual's
  -- cause, not just its size.
  SELECT count(*) INTO residual_not_duplicate_event FROM (
    SELECT a.esbid
      FROM caesars_team_totals_attribution AS a
      JOIN public.prop_market_selections_index AS s
        ON s.source_id = a.source_id
       AND s.source_market_id = a.source_market_id
       AND s.time_type = a.time_type
     GROUP BY a.esbid, a.time_type, a.template, a.nfl_team, s.selection_name
    HAVING count(*) > 1
       AND count(DISTINCT a.source_event_id) < 2
  ) AS g;
  IF residual_not_duplicate_event <> 0 THEN
    RAISE EXCEPTION
      '% residual colliding groups are NOT explained by a duplicate Caesars event listing; rolling back',
      residual_not_duplicate_event;
  END IF;

  RAISE NOTICE 'CAESARS untyped now %, settled markets %, residual colliding groups %',
    caesars_null_type, settled_markets, colliding_groups;
END $$;
