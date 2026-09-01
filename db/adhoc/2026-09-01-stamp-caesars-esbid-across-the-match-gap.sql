-- STATUS: APPLIED 2026-09-01 against league_production
--
-- Stamp esbid and season_year on the 414,963 CAESARS rows in prop_markets_index
-- that a broken importer left unresolvable for thirteen months.
--
--   source_id CAESARS, observed_at in (2024-08-09 23:07:14+00, 2025-09-19 20:00:02+00)
--   esbid        NULL -> the matched nfl_games.esbid
--   season_year  NULL -> the matched nfl_games.season_year
--
-- WHAT BROKE. Commit 39fa74332 (2024-08-09 19:38:57 -0400) replaced the
-- event-to-game match predicate in the then-current scripts/import-caesars-odds.mjs
-- with a date built as dayjs(event.startTime).format('YYYY-MM-DD') -- hyphens --
-- and compared it to nfl_games.date, which is 'YYYY/MM/DD' in every season the
-- table holds. The predicate could never be true. The last import that matched
-- anything ran 31 minutes before that commit; matching resumed only when
-- private/scripts/import-caesars-odds-v4.mjs landed with '/' on 2025-09-19.
-- Nothing in the current importer needs fixing, and this file does not touch it.
--
-- The transition is sharp on both edges, which is what makes the window a
-- timestamp range rather than a set of calendar months. Per-month match rate over
-- game-shaped rows: 2023-11 is 100%, 2024-08 is 95.50% (1,442 of 1,510), then
-- 2024-09 through 2025-02 are 0.00% across 415,125 rows, then 2025-09 onward is
-- 100% in every month.
--
-- HOW EACH EVENT IS MATCHED, and why not by date. Binding candidate games to a
-- window around observed_at drops real games. This file joins on
-- (away_nfl_team, home_nfl_team, season_year) and uses the date in two distinct
-- roles, each of which is load-bearing on a case the other does not reach:
--
--   TIEBREAK. 17 of the 303 game-shaped events have TWO candidate games, because
--   a playoff rematch repeats the ordered pair at the same site -- Washington
--   Commanders at Tampa Bay Buccaneers is both week 1 and a wild card -- and one
--   pair collides a preseason game with a regular-season one (Philadelphia Eagles
--   at Baltimore Ravens, 2024/08/09 and 2024/12/01). Taking the EARLIEST
--   candidate on or after first observation resolves all 17 correctly. An earlier
--   draft of this repair asserted zero ambiguous matches and would have stamped
--   whichever row the planner happened to return.
--
--   REJECTION. Three events observed on 2025-01-06 name wild-card matchups that
--   never happened as posted, the bracket not yet being set. Two have no
--   candidate at all. The third, Baltimore Ravens at Pittsburgh Steelers, has a
--   same-season candidate 50 days EARLIER (week 11) and would take a wrong esbid
--   from any nearest-date rule. Requiring the game to be on or after first
--   observation drops all three.
--
-- WHY THE GRACE IS TWO DAYS AND NOT ZERO. One real event, Los Angeles Chargers at
-- New England Patriots, was first observed the morning AFTER its 2024/12/28
-- kickoff, so a zero-day floor rejects a game that plainly happened. Two days
-- admits it and still excludes the 50-day case above by a wide margin; no
-- ambiguous event has its wrong candidate closer than two months.
--
-- WHY THE TEAM NAMES ARE MAPPED INLINE. libs-shared/fix-team.mjs is the canonical
-- resolver and it THROWS on an unrecognized name rather than returning null, so
-- it cannot express "skip what does not resolve" without a wrapper. All 34
-- distinct name tokens in the range were run through it; 32 are the full club
-- names below and two are the placeholder halves of 'AFC Super Bowl Participant
-- at NFC Super Bowl Participant', which raises. Mapping by inner join reproduces
-- fixTeam exactly on this population and drops the placeholder by construction.
-- Note LA (not LAR) for the Rams and JAX (not JAC) for the Jaguars, which is what
-- fixTeam returns and what nfl_games stores.
--
-- WHY THE STAMP GUARD DOES NOT OBJECT. esbid and season_year are
-- MARKET_INDEX_STAMP_COLUMNS in libs-server/insert-prop-markets.mjs, merged as
-- `case when prop_markets_index.is_market_settled then <existing> else <excluded> end`
-- -- frozen only once a market has settled. Zero rows in this range are settled,
-- so nothing here is frozen and this write goes around no guard. The predicate
-- asserts is_market_settled = false rather than assuming it.
--
-- OPEN/CLOSE COHERENCE IS PRESERVED BY CONSTRUCTION. The
-- prop-market-open-close-esbid-coherence check in db/checks/registry.mjs grades
-- whether a market's two time_type rows name the same game. This file resolves
-- one esbid per source_event_id and stamps every row of that event with it, so
-- both rows of every market move together. The post-condition asserts it.
--
-- WHAT THIS MAKES REACHABLE, AND WHAT IT DOES NOT START. Settlement, historical
-- hit rates and the data-view market CTE all require a non-null esbid, so these
-- rows are currently invisible to every consumer however well typed they are.
-- After this file, the four-way Caesars census moves like this:
--
--                       before      after
--   typed_invisible    294,544        295
--   fully_usable         5,130    299,379
--   untyped_invisible  125,819      5,105
--   untyped_visible     26,181    146,895
--
-- Both pairs move together because typing and stamping are independent; 294,249
-- of the stamped rows are already typed and 120,714 are not. Nothing is graded as
-- a side effect: settlement runs from jobs/finalize-week.mjs, which is scoped to
-- the current season's target week and never sweeps history. Re-grading any of
-- this is a deliberate `node scripts/process-market-results.mjs --esbids ...`
-- and is not part of this file.
--
-- THE RESIDUE, hand-inspected rather than accepted as a rate. 415,125 rows in the
-- range are game-shaped and 414,963 are stamped here; the 162 left are four
-- events, and all four are correct to leave alone:
--
--   150  AFC Super Bowl Participant at NFC Super Bowl Participant  (placeholder)
--     4  Philadelphia Eagles at Green Bay Packers                  (played as GB at PHI)
--     4  Tampa Bay Buccaneers at Washington Commanders             (never played)
--     4  Baltimore Ravens at Pittsburgh Steelers                   (played as PIT at BAL)
--
-- The other 2,544 rows in the range are genuine futures with no game to match.

DO $$
DECLARE
  in_range_rows integer;
  already_stamped integer;
  settled_rows integer;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE esbid IS NOT NULL OR season_year IS NOT NULL),
         count(*) FILTER (WHERE is_market_settled)
    INTO in_range_rows, already_stamped, settled_rows
    FROM public.prop_markets_index
   WHERE source_id = 'CAESARS'
     AND observed_at > '2024-08-09 23:07:14+00'
     AND observed_at < '2025-09-19 20:00:02+00';

  -- The header reasons from this population. If it has moved, every count below
  -- is about a different range than the one that was inspected.
  IF in_range_rows <> 417669 THEN
    RAISE EXCEPTION
      'expected 417669 CAESARS rows in the match-gap range, found %; rolling back', in_range_rows;
  END IF;

  IF already_stamped <> 0 THEN
    RAISE EXCEPTION
      '% rows in the range already carry an esbid or season_year; the range is not virgin and a second pass is no longer meaningful, rolling back', already_stamped;
  END IF;

  IF settled_rows <> 0 THEN
    RAISE EXCEPTION
      '% settled markets in the range; the stamp guard freezes those and this file must not go around it, rolling back', settled_rows;
  END IF;
END $$;

DO $$
DECLARE
  updated integer;
BEGIN
  WITH team_name (nm, ab) AS (
    VALUES
      ('Arizona Cardinals', 'ARI'), ('Atlanta Falcons', 'ATL'),
      ('Baltimore Ravens', 'BAL'), ('Buffalo Bills', 'BUF'),
      ('Carolina Panthers', 'CAR'), ('Chicago Bears', 'CHI'),
      ('Cincinnati Bengals', 'CIN'), ('Cleveland Browns', 'CLE'),
      ('Dallas Cowboys', 'DAL'), ('Denver Broncos', 'DEN'),
      ('Detroit Lions', 'DET'), ('Green Bay Packers', 'GB'),
      ('Houston Texans', 'HOU'), ('Indianapolis Colts', 'IND'),
      ('Jacksonville Jaguars', 'JAX'), ('Kansas City Chiefs', 'KC'),
      ('Las Vegas Raiders', 'LV'), ('Los Angeles Chargers', 'LAC'),
      ('Los Angeles Rams', 'LA'), ('Miami Dolphins', 'MIA'),
      ('Minnesota Vikings', 'MIN'), ('New England Patriots', 'NE'),
      ('New Orleans Saints', 'NO'), ('New York Giants', 'NYG'),
      ('New York Jets', 'NYJ'), ('Philadelphia Eagles', 'PHI'),
      ('Pittsburgh Steelers', 'PIT'), ('San Francisco 49ers', 'SF'),
      ('Seattle Seahawks', 'SEA'), ('Tampa Bay Buccaneers', 'TB'),
      ('Tennessee Titans', 'TEN'), ('Washington Commanders', 'WAS')
  ),

  -- One row per Caesars event, anchored on when the event was FIRST seen. The
  -- anchor is per event and not per market row, because an event resolves to one
  -- game and its rows span days.
  caesars_event AS (
    SELECT source_event_id,
           source_event_name,
           (min(observed_at) AT TIME ZONE 'America/New_York')::date AS first_observed_date
      FROM public.prop_markets_index
     WHERE source_id = 'CAESARS'
       AND esbid IS NULL
       AND NOT is_market_settled
       AND observed_at > '2024-08-09 23:07:14+00'
       AND observed_at < '2025-09-19 20:00:02+00'
       AND source_event_name LIKE '% at %'
     GROUP BY 1, 2
  ),

  -- Inner joins on team_name are the "skip what does not resolve" rule: an event
  -- naming something that is not a club drops out here rather than matching
  -- loosely. Season is taken from first observation, shifted back a year in
  -- January and February so a playoff event lands in its own season.
  resolved AS (
    SELECT e.source_event_id,
           e.first_observed_date,
           a.ab AS away_nfl_team,
           h.ab AS home_nfl_team,
           extract(year FROM e.first_observed_date)::int
             - CASE WHEN extract(month FROM e.first_observed_date) <= 2 THEN 1 ELSE 0 END
             AS season_year
      FROM caesars_event e
      JOIN team_name a ON a.nm = split_part(e.source_event_name, ' at ', 1)
      JOIN team_name h ON h.nm = split_part(e.source_event_name, ' at ', 2)
  ),

  -- CROSS JOIN LATERAL, not LEFT JOIN: an event with no candidate game on or
  -- after its first observation produces no row and is therefore never stamped.
  -- ORDER BY date ASC with LIMIT 1 is the tiebreak.
  event_game AS (
    SELECT r.source_event_id, g.esbid, g.season_year
      FROM resolved r
      CROSS JOIN LATERAL (
        SELECT g.esbid, g.season_year
          FROM public.nfl_games g
         WHERE g.away_nfl_team = r.away_nfl_team
           AND g.home_nfl_team = r.home_nfl_team
           AND g.season_year = r.season_year
           AND to_date(g.date, 'YYYY/MM/DD') >= r.first_observed_date - 2
         ORDER BY to_date(g.date, 'YYYY/MM/DD')
         LIMIT 1
      ) g
  )

  UPDATE public.prop_markets_index m
     SET esbid = eg.esbid,
         season_year = eg.season_year
    FROM event_game eg
   WHERE eg.source_event_id = m.source_event_id
     AND m.source_id = 'CAESARS'
     AND m.esbid IS NULL
     AND m.season_year IS NULL
     AND m.is_market_settled = false
     AND m.observed_at > '2024-08-09 23:07:14+00'
     AND m.observed_at < '2025-09-19 20:00:02+00';

  GET DIAGNOSTICS updated = ROW_COUNT;

  IF updated <> 414963 THEN
    RAISE EXCEPTION
      'expected to stamp 414963 rows, stamped %; rolling back', updated;
  END IF;

  RAISE NOTICE 'stamped % CAESARS rows across the match gap', updated;
END $$;

-- Post-conditions, inside the same transaction. Each asserts a property the
-- header claims, so a file that did something other than what it says rolls back.
DO $$
DECLARE
  stamped_events integer;
  incoherent_events integer;
  residue_rows integer;
  typed_invisible integer;
  untyped_invisible integer;
  untyped_visible integer;
  fully_usable integer;
BEGIN
  -- Every stamped event names exactly one game. This is the property the
  -- prop-market-open-close-esbid-coherence check grades.
  SELECT count(*), count(*) FILTER (WHERE n_esbids <> 1)
    INTO stamped_events, incoherent_events
    FROM (
      SELECT source_event_id, count(DISTINCT esbid) AS n_esbids
        FROM public.prop_markets_index
       WHERE source_id = 'CAESARS'
         AND esbid IS NOT NULL
         AND observed_at > '2024-08-09 23:07:14+00'
         AND observed_at < '2025-09-19 20:00:02+00'
       GROUP BY 1
    ) e;

  IF stamped_events <> 299 THEN
    RAISE EXCEPTION
      'expected 299 stamped events, found %; rolling back', stamped_events;
  END IF;

  IF incoherent_events <> 0 THEN
    RAISE EXCEPTION
      '% stamped events name more than one game; rolling back', incoherent_events;
  END IF;

  -- The unstamped game-shaped remainder is the four hand-inspected events.
  SELECT count(*)
    INTO residue_rows
    FROM public.prop_markets_index
   WHERE source_id = 'CAESARS'
     AND esbid IS NULL
     AND source_event_name LIKE '% at %'
     AND observed_at > '2024-08-09 23:07:14+00'
     AND observed_at < '2025-09-19 20:00:02+00';

  IF residue_rows <> 162 THEN
    RAISE EXCEPTION
      'expected 162 game-shaped rows to remain unstamped, found %; rolling back', residue_rows;
  END IF;

  -- esbid and season_year move together, always. A row with one and not the
  -- other is a state no consumer expects.
  IF EXISTS (
    SELECT 1 FROM public.prop_markets_index
     WHERE source_id = 'CAESARS'
       AND (esbid IS NULL) <> (season_year IS NULL)
  ) THEN
    RAISE EXCEPTION
      'a CAESARS row carries esbid without season_year or the reverse; rolling back';
  END IF;

  -- The headline census, asserted against the numbers printed in the header.
  SELECT count(*) FILTER (WHERE esbid IS NULL AND market_type IS NOT NULL),
         count(*) FILTER (WHERE esbid IS NULL AND market_type IS NULL),
         count(*) FILTER (WHERE esbid IS NOT NULL AND market_type IS NULL),
         count(*) FILTER (WHERE esbid IS NOT NULL AND market_type IS NOT NULL)
    INTO typed_invisible, untyped_invisible, untyped_visible, fully_usable
    FROM public.prop_markets_index
   WHERE source_id = 'CAESARS';

  IF typed_invisible <> 295 OR untyped_invisible <> 5105
     OR untyped_visible <> 146895 OR fully_usable <> 299379 THEN
    RAISE EXCEPTION
      'post-state census is (% , % , % , %), expected (295, 5105, 146895, 299379); rolling back',
      typed_invisible, untyped_invisible, untyped_visible, fully_usable;
  END IF;

  RAISE NOTICE
    'CAESARS census now typed_invisible=% untyped_invisible=% untyped_visible=% fully_usable=%',
    typed_invisible, untyped_invisible, untyped_visible, fully_usable;
END $$;
