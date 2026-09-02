-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Attribute the player on 212 prop markets that were graded against the whole
-- game, and clear the 1,320 wrong results those markets carry.
--
--   prop_market_selections_index
--     selection_pid        NULL -> the market's player
--     selection_result     the wrong grade -> NULL
--     metric_result_value  the whole-population aggregate -> NULL
--
-- WHAT BROKE. NFLPlaysMarketHandler._filter_plays_for_market applied the player
-- filter only `if (market.selection_pid)`, so a selection carrying a null pid
-- skipped the filter entirely and the aggregation ran over every play in the
-- game. The guard that refuses this landed in b29bb6774; this file repairs what
-- was written before it. The class is every NFL_PLAYS mapping declaring a
-- player_column -- 37 market types, not the three longest-x arms the defect was
-- first reported under.
--
-- THE TWO FAILURE SHAPES, measured rather than reasoned about. A MAX-aggregated
-- market took the game's longest play by ANY player; a period-scoped market took
-- the period's total across ALL players. Every affected row equals its
-- whole-population aggregate exactly: 354 of 354 on the MAX arms against the
-- game-wide max from nfl_plays, and 859 of 859 on the quarter and first-half
-- arms against the period-wide sum. A single oracle over all 37 types flags
-- 1,305 of the 1,320; the 15 it misses are all GAME_FIRST_QUARTER_RECEPTIONS and
-- differ by exactly one from a count of is_completion, which is a nuance in how
-- the handler drops metric-null plays and not a second defect.
--
-- These markets are UNATTRIBUTED, NOT UNGRADABLE, which is what makes a repair
-- possible at all. Every one of the 212 names a real player, and every affected
-- market names exactly ONE player -- verified both ways, since all 108 FanDuel
-- markets carry one player across their selection names and all 100 DraftKings
-- markets carry one source_market_name. So attribution is per market.
--
-- HOW EACH PLAYER WAS RESOLVED, in three tiers, each verified:
--
--   SIBLING (72 markets). A sibling selection on the same market already
--   resolved a pid, and every one of those 72 markets carries exactly ONE
--   distinct pid. No name matching, no ambiguity.
--
--   NAME (126 markets). find_player from libs-server/player-cache.mjs, the same
--   resolver the importers call, over 2-, 3- and 4-token prefixes of every
--   hyphen-separated segment of source_market_name, requiring every prefix that
--   resolves to agree. A stat suffix like 'Receiving Yards' resolves to nobody;
--   a real name suffix like 'Jr' resolves to the same player.
--
--   MANUAL (14 markets). Four causes the automated pass cannot reach, each
--   resolved against gamelog evidence rather than by name similarity:
--     Simi Fehoko      -> SIMI-FEHO-019360, stored as Simione; 21 LAC games in
--                         2024, and the market is NO at LAC.
--     Audric Estime    -> AUDR-ESTI-006095; the vendor spells it Estime with an
--                         acute accent. 8 NO games in 2025; both markets are NO.
--     Terrell Jennings -> TERR-JENN-000417; 12 NE games in 2025, and the two
--                         markets are ATL at NE and NE at TB.
--     Robbie Chosen    -> ROBB-ANDE-017101; a legal name change from Robbie
--                         Anderson. 4 WAS games in 2025; the market is WAS at MIA.
--     Josh Allen       -> JOSH-ALLE-000098; JAX at BUF holds TWO Josh Allens and
--                         both played, so team cannot disambiguate. The gamelog
--                         does: the quarterback threw 30 and carried 6, the
--                         Jacksonville lineman neither, and all four markets are
--                         passing or rushing props.
--
-- WHY THE RESOLVER IS CALLED WITH ignore_free_agent AND ignore_retired FALSE,
-- AND all_players TRUE. The importers call find_player with the first two
-- defaulting TRUE, which is very likely why these rows are null: resolution ran
-- against the roster of the day, and this population skews to rookies and fringe
-- players who are retired or unsigned now. Re-resolving with the importer's
-- flags would reproduce the original miss on exactly the players being
-- recovered and report it as a clean no-match. all_players matters more: the
-- default preload holds ACTIVE players only, so without it the retired half is
-- not in the cache and ignore_retired false does nothing.
--
-- THE TEAM CONSTRAINT IS NOT USED AS A FILTER, and that is deliberate.
-- find_player's `teams` argument filters on current_nfl_team, so for a player
-- who has since moved it excludes the right answer -- which is precisely what
-- happened to Terrell Jennings and Robbie Chosen. Team agreement is applied as
-- a POST-HOC check instead: all 198 automatically resolved players hold a
-- gamelog in the game's own season for one of the game's two teams, and 197 of
-- the 198 played in that very game. The one who did not is the Fehoko-shaped
-- case the whole repair exists for -- a player listed by the book and inactive
-- on the day.
--
-- WHY THE RESULTS ARE CLEARED RATHER THAN REGRADED HERE. Grading belongs to
-- scripts/process-market-results.mjs, not to a SQL file, and the two columns
-- must not be written by different derivations -- that is the exact provenance
-- split the prop-market-selection-grade-consistency check exists to catch.
-- Clearing leaves every affected row honestly ungraded; the re-settle that
-- follows this file grades them from the now-correct pid. Clearing FIRST also
-- means a re-settle that never runs leaves no wrong answer behind, which is the
-- safe direction to fail.
--
-- ORDER MATTERS AND IS NOT INTERCHANGEABLE. The clear runs BEFORE the
-- attribution, because `selection_pid IS NULL` is what identifies the affected
-- rows; attributing first would erase the predicate that finds them.
--
-- THE CLEAR IS KEYED ON THE 212 MARKETS, NOT ON market_type AND esbid, and the
-- difference is six rows that a narrower predicate leaves behind. Four of them
-- are DraftKings OPEN rows on an affected market carrying a grade of 54.0 -- the
-- game-wide longest completion -- with NO esbid at all, so a predicate requiring
-- an esbid scores them clean while they hold the same wrong answer as their
-- CLOSE siblings. Keying both steps on the mapping makes the file internally
-- consistent: everything it attributes, it also clears.
--
-- WHAT THIS DOES NOT CLAIM. It does not close
-- user:task/league/classify-null-selection-pids-in-prop-markets, which is about
-- 6.0 million null-pid rows of which most are game-line selections where null is
-- CORRECT. This is a disjoint, fully-enumerated slice: player-prop market types
-- that already carry a wrong grade.

DO $$
DECLARE
  graded_rows integer;
  affected_markets integer;
BEGIN
  SELECT count(*), count(DISTINCT (s.source_id, s.source_market_id))
    INTO graded_rows, affected_markets
    FROM public.prop_markets_index m
    JOIN public.prop_market_selections_index s
      ON s.source_id = m.source_id
     AND s.source_market_id = m.source_market_id
     AND s.time_type = m.time_type
   WHERE m.market_type IN (
      'GAME_FIRST_QUARTER_PASSING_YARDS',
      'GAME_FIRST_QUARTER_RUSHING_YARDS',
      'GAME_FIRST_QUARTER_RECEIVING_YARDS',
      'GAME_FIRST_QUARTER_RECEPTIONS',
      'GAME_FIRST_QUARTER_RUSHING_ATTEMPTS',
      'GAME_FIRST_QUARTER_PASSING_ATTEMPTS',
      'GAME_FIRST_QUARTER_PASSING_INTERCEPTIONS',
      'GAME_SECOND_QUARTER_PASSING_YARDS',
      'GAME_SECOND_QUARTER_RUSHING_YARDS',
      'GAME_SECOND_QUARTER_RECEIVING_YARDS',
      'GAME_THIRD_QUARTER_PASSING_YARDS',
      'GAME_THIRD_QUARTER_RUSHING_YARDS',
      'GAME_THIRD_QUARTER_RECEIVING_YARDS',
      'GAME_FOURTH_QUARTER_PASSING_YARDS',
      'GAME_FOURTH_QUARTER_RUSHING_YARDS',
      'GAME_FOURTH_QUARTER_RECEIVING_YARDS',
      'GAME_FIRST_HALF_ALT_RUSHING_YARDS',
      'GAME_FIRST_HALF_ALT_PASSING_YARDS',
      'GAME_FIRST_HALF_ALT_RECEIVING_YARDS',
      'GAME_LONGEST_RECEPTION',
      'GAME_LONGEST_RUSH',
      'GAME_PASSING_LONGEST_COMPLETION',
      'GAME_ALT_PASSING_LONGEST_COMPLETION',
      'GAME_ALT_LONGEST_RUSH',
      'GAME_ALT_LONGEST_RECEPTION',
      'GAME_FIRST_QUARTER_ALT_PASSING_YARDS',
      'GAME_FIRST_QUARTER_ALT_RUSHING_YARDS',
      'GAME_FIRST_QUARTER_ALT_RECEIVING_YARDS',
      'GAME_SECOND_QUARTER_ALT_PASSING_YARDS',
      'GAME_SECOND_QUARTER_ALT_RUSHING_YARDS',
      'GAME_SECOND_QUARTER_ALT_RECEIVING_YARDS',
      'GAME_THIRD_QUARTER_ALT_PASSING_YARDS',
      'GAME_THIRD_QUARTER_ALT_RUSHING_YARDS',
      'GAME_THIRD_QUARTER_ALT_RECEIVING_YARDS',
      'GAME_FOURTH_QUARTER_ALT_PASSING_YARDS',
      'GAME_FOURTH_QUARTER_ALT_RUSHING_YARDS',
      'GAME_FOURTH_QUARTER_ALT_RECEIVING_YARDS'
     )
     AND s.selection_pid IS NULL
     AND s.selection_result IS NOT NULL
     AND m.esbid IS NOT NULL;

  -- The header reasons from this population. If it has moved, every count below
  -- is about a different one.
  IF graded_rows <> 1320 THEN
    RAISE EXCEPTION
      'expected 1320 graded null-pid rows, found %; rolling back', graded_rows;
  END IF;

  IF affected_markets <> 212 THEN
    RAISE EXCEPTION
      'expected 212 affected markets, found %; rolling back', affected_markets;
  END IF;
END $$;

-- STEP ONE: clear the wrong grades. Runs BEFORE the attribution, because
-- `selection_pid IS NULL` is the predicate that identifies these rows;
-- attributing first would erase it.
DO $$
DECLARE
  cleared integer;
BEGIN
  WITH market_player (source_id, source_market_id) AS (
    VALUES
      ('CAESARS',   '36f9643d-a4ef-3ace-b9b9-040026dc3704'),
      ('CAESARS',   'db659d27-346e-321b-bd77-2817579fa685'),
      ('DRAFTKINGS', '178831491'),
      ('DRAFTKINGS', '179054819'),
      ('DRAFTKINGS', '181070983'),
      ('DRAFTKINGS', '181071015'),
      ('DRAFTKINGS', '181123808'),
      ('DRAFTKINGS', '211317519'),
      ('DRAFTKINGS', '212970139'),
      ('DRAFTKINGS', '213981807'),
      ('DRAFTKINGS', '214899564'),
      ('DRAFTKINGS', '215968934'),
      ('DRAFTKINGS', '216802405'),
      ('DRAFTKINGS', '218021692'),
      ('DRAFTKINGS', '218936447'),
      ('DRAFTKINGS', '220411408'),
      ('DRAFTKINGS', '220908919'),
      ('DRAFTKINGS', '222027792'),
      ('DRAFTKINGS', '223097123'),
      ('DRAFTKINGS', '224105726'),
      ('DRAFTKINGS', '225833397'),
      ('DRAFTKINGS', '226595974'),
      ('DRAFTKINGS', '227069685'),
      ('DRAFTKINGS', '228009753'),
      ('DRAFTKINGS', '228683762'),
      ('DRAFTKINGS', '229493267'),
      ('DRAFTKINGS', '273450471'),
      ('DRAFTKINGS', '273541663'),
      ('DRAFTKINGS', '275098632'),
      ('DRAFTKINGS', '275723521'),
      ('DRAFTKINGS', '276303501'),
      ('DRAFTKINGS', '276303517'),
      ('DRAFTKINGS', '276336864'),
      ('DRAFTKINGS', '276336878'),
      ('DRAFTKINGS', '276336888'),
      ('DRAFTKINGS', '276336934'),
      ('DRAFTKINGS', '276336952'),
      ('DRAFTKINGS', '276347255'),
      ('DRAFTKINGS', '276779567'),
      ('DRAFTKINGS', '276779817'),
      ('DRAFTKINGS', '277237412'),
      ('DRAFTKINGS', '277237440'),
      ('DRAFTKINGS', '277237598'),
      ('DRAFTKINGS', '277237623'),
      ('DRAFTKINGS', '277940187'),
      ('DRAFTKINGS', '277940188'),
      ('DRAFTKINGS', '278427273'),
      ('DRAFTKINGS', '278427286'),
      ('DRAFTKINGS', '278427291'),
      ('DRAFTKINGS', '278427312'),
      ('DRAFTKINGS', '278427321'),
      ('DRAFTKINGS', '278427325'),
      ('DRAFTKINGS', '278427400'),
      ('DRAFTKINGS', '278427440'),
      ('DRAFTKINGS', '279118194'),
      ('DRAFTKINGS', '279118213'),
      ('DRAFTKINGS', '280208591'),
      ('DRAFTKINGS', '280208623'),
      ('DRAFTKINGS', '280208703'),
      ('DRAFTKINGS', '280208795'),
      ('DRAFTKINGS', '280208940'),
      ('DRAFTKINGS', '280208948'),
      ('DRAFTKINGS', '280208983'),
      ('DRAFTKINGS', '280209118'),
      ('DRAFTKINGS', '280872757'),
      ('DRAFTKINGS', '280872760'),
      ('DRAFTKINGS', '281738523'),
      ('DRAFTKINGS', '281738537'),
      ('DRAFTKINGS', '281738611'),
      ('DRAFTKINGS', '281738612'),
      ('DRAFTKINGS', '281738656'),
      ('DRAFTKINGS', '281738727'),
      ('DRAFTKINGS', '281738779'),
      ('DRAFTKINGS', '281738804'),
      ('DRAFTKINGS', '282334247'),
      ('DRAFTKINGS', '282334250'),
      ('DRAFTKINGS', '283201493'),
      ('DRAFTKINGS', '283201502'),
      ('DRAFTKINGS', '283201555'),
      ('DRAFTKINGS', '283201600'),
      ('DRAFTKINGS', '283201619'),
      ('DRAFTKINGS', '283201644'),
      ('DRAFTKINGS', '283201665'),
      ('DRAFTKINGS', '283201862'),
      ('DRAFTKINGS', '283476607'),
      ('DRAFTKINGS', '283476609'),
      ('DRAFTKINGS', '284790772'),
      ('DRAFTKINGS', '284790838'),
      ('DRAFTKINGS', '284790854'),
      ('DRAFTKINGS', '284790863'),
      ('DRAFTKINGS', '284790951'),
      ('DRAFTKINGS', '284791091'),
      ('DRAFTKINGS', '284791128'),
      ('DRAFTKINGS', '285168518'),
      ('DRAFTKINGS', '285168522'),
      ('DRAFTKINGS', '294494802'),
      ('DRAFTKINGS', '295906490'),
      ('DRAFTKINGS', '296891053'),
      ('FANDUEL',   '711.100213691'),
      ('FANDUEL',   '711.100213704'),
      ('FANDUEL',   '711.100972931'),
      ('FANDUEL',   '711.103223307'),
      ('FANDUEL',   '711.103223327'),
      ('FANDUEL',   '711.103223407'),
      ('FANDUEL',   '711.104000438'),
      ('FANDUEL',   '711.104002612'),
      ('FANDUEL',   '711.104002614'),
      ('FANDUEL',   '711.105525435'),
      ('FANDUEL',   '711.105525465'),
      ('FANDUEL',   '711.105525470'),
      ('FANDUEL',   '711.138045237'),
      ('FANDUEL',   '711.138045241'),
      ('FANDUEL',   '711.138045246'),
      ('FANDUEL',   '711.139832120'),
      ('FANDUEL',   '711.139832121'),
      ('FANDUEL',   '711.139846124'),
      ('FANDUEL',   '711.139846248'),
      ('FANDUEL',   '711.140026953'),
      ('FANDUEL',   '711.140040856'),
      ('FANDUEL',   '711.140042319'),
      ('FANDUEL',   '711.140042458'),
      ('FANDUEL',   '711.140042515'),
      ('FANDUEL',   '711.140125386'),
      ('FANDUEL',   '711.140380810'),
      ('FANDUEL',   '711.144372901'),
      ('FANDUEL',   '711.146026809'),
      ('FANDUEL',   '711.146026822'),
      ('FANDUEL',   '711.146028812'),
      ('FANDUEL',   '711.146773799'),
      ('FANDUEL',   '711.146774093'),
      ('FANDUEL',   '711.148492238'),
      ('FANDUEL',   '711.148492242'),
      ('FANDUEL',   '711.148570833'),
      ('FANDUEL',   '711.149344994'),
      ('FANDUEL',   '711.149344995'),
      ('FANDUEL',   '711.149909070'),
      ('FANDUEL',   '711.149909314'),
      ('FANDUEL',   '711.149909316'),
      ('FANDUEL',   '711.150447725'),
      ('FANDUEL',   '711.150447732'),
      ('FANDUEL',   '711.150481651'),
      ('FANDUEL',   '711.152133943'),
      ('FANDUEL',   '711.152133946'),
      ('FANDUEL',   '711.152202395'),
      ('FANDUEL',   '711.152202401'),
      ('FANDUEL',   '711.152204905'),
      ('FANDUEL',   '711.152204971'),
      ('FANDUEL',   '711.152210831'),
      ('FANDUEL',   '711.152210837'),
      ('FANDUEL',   '711.152210841'),
      ('FANDUEL',   '711.152210846'),
      ('FANDUEL',   '711.152210848'),
      ('FANDUEL',   '711.152211673'),
      ('FANDUEL',   '711.152211678'),
      ('FANDUEL',   '711.152211958'),
      ('FANDUEL',   '711.152211959'),
      ('FANDUEL',   '711.152211961'),
      ('FANDUEL',   '711.152211963'),
      ('FANDUEL',   '711.152212270'),
      ('FANDUEL',   '711.152212275'),
      ('FANDUEL',   '711.152212281'),
      ('FANDUEL',   '711.152212282'),
      ('FANDUEL',   '711.152213736'),
      ('FANDUEL',   '711.152213738'),
      ('FANDUEL',   '711.152213739'),
      ('FANDUEL',   '711.152213747'),
      ('FANDUEL',   '711.152214046'),
      ('FANDUEL',   '711.152214064'),
      ('FANDUEL',   '711.152214128'),
      ('FANDUEL',   '711.152214130'),
      ('FANDUEL',   '711.152214249'),
      ('FANDUEL',   '711.152214252'),
      ('FANDUEL',   '711.152214255'),
      ('FANDUEL',   '711.152214266'),
      ('FANDUEL',   '711.152214269'),
      ('FANDUEL',   '711.152214273'),
      ('FANDUEL',   '711.152214276'),
      ('FANDUEL',   '711.152214284'),
      ('FANDUEL',   '711.152214289'),
      ('FANDUEL',   '711.152214300'),
      ('FANDUEL',   '711.152214302'),
      ('FANDUEL',   '711.152214319'),
      ('FANDUEL',   '711.152214329'),
      ('FANDUEL',   '711.152214330'),
      ('FANDUEL',   '711.152214340'),
      ('FANDUEL',   '711.152214344'),
      ('FANDUEL',   '711.152214358'),
      ('FANDUEL',   '711.152215302'),
      ('FANDUEL',   '711.152315935'),
      ('FANDUEL',   '711.152316050'),
      ('FANDUEL',   '711.98976725'),
      ('FANDUEL',   '711.99682520'),
      ('FANDUEL',   '711.99997998'),
      ('FANDUEL',   '734.81038444'),
      ('FANDUEL',   '736.137657867'),
      ('FANDUEL',   '736.137657869'),
      ('FANDUEL',   '736.137657875'),
      ('PINNACLE',  '1597717579'),
      ('CAESARS',   '08f696c2-3cac-3b08-828c-001c39ed4ac6'),
      ('DRAFTKINGS', '213957926'),
      ('DRAFTKINGS', '288131745'),
      ('DRAFTKINGS', '289850243'),
      ('DRAFTKINGS', '291136408'),
      ('FANDUEL',   '711.151039292'),
      ('FANDUEL',   '711.151039299'),
      ('FANDUEL',   '711.151039300'),
      ('FANDUEL',   '711.151039307'),
      ('FANDUEL',   '711.151039926'),
      ('FANDUEL',   '711.151979191'),
      ('FANDUEL',   '711.151979554'),
      ('FANDUEL',   '711.99678689'),
      ('FANDUEL',   '711.99678690')
  )
  UPDATE public.prop_market_selections_index s
     SET selection_result = NULL,
         metric_result_value = NULL
    FROM market_player mp
   WHERE s.source_id::text = mp.source_id
     AND s.source_market_id = mp.source_market_id
     AND s.selection_pid IS NULL
     AND s.selection_result IS NOT NULL;

  GET DIAGNOSTICS cleared = ROW_COUNT;

  IF cleared <> 1326 THEN
    RAISE EXCEPTION 'expected to clear 1326 rows, cleared %; rolling back', cleared;
  END IF;

  RAISE NOTICE 'cleared % wrong grades', cleared;
END $$;

-- STEP TWO: attribute the player. Every selection under one of these markets
-- belongs to that market's single player, so this covers the ungraded siblings
-- too rather than only the rows that carried a wrong grade.
DO $$
DECLARE
  attributed integer;
BEGIN
  WITH market_player (source_id, source_market_id, selection_pid) AS (
    VALUES
      ('CAESARS',   '36f9643d-a4ef-3ace-b9b9-040026dc3704', 'JERM-JACK-000360'),
      ('CAESARS',   'db659d27-346e-321b-bd77-2817579fa685', 'JORD-MIMS-025420'),
      ('DRAFTKINGS', '178831491',           'JOSH-ALLE-000098'),
      ('DRAFTKINGS', '179054819',           'JOSH-ALLE-000098'),
      ('DRAFTKINGS', '181070983',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '181071015',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '181123808',           'BRAN-AIYU-006142'),
      ('DRAFTKINGS', '211317519',           'KENN-WALK-011862'),
      ('DRAFTKINGS', '212970139',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '213981807',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '214899564',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '215968934',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '216802405',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '218021692',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '218936447',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '220411408',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '220908919',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '222027792',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '223097123',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '224105726',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '225833397',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '226595974',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '227069685',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '228009753',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '228683762',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '229493267',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '273450471',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '273541663',           'CAMX-WARD-005728'),
      ('DRAFTKINGS', '275098632',           'ANDR-MCCO-004333'),
      ('DRAFTKINGS', '275723521',           'LAMA-JACK-008142'),
      ('DRAFTKINGS', '276303501',           'ANDR-MCCO-004333'),
      ('DRAFTKINGS', '276303517',           'ANDR-MCCO-004333'),
      ('DRAFTKINGS', '276336864',           'MARK-IRVI-017623'),
      ('DRAFTKINGS', '276336878',           'MARK-IRVI-017623'),
      ('DRAFTKINGS', '276336888',           'MARK-IRVI-017623'),
      ('DRAFTKINGS', '276336934',           'MARK-IRVI-017623'),
      ('DRAFTKINGS', '276336952',           'MARK-IRVI-017623'),
      ('DRAFTKINGS', '276347255',           'ANDR-MCCO-004333'),
      ('DRAFTKINGS', '276779567',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '276779817',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '277237412',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '277237440',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '277237598',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '277237623',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '277940187',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '277940188',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '278427273',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '278427286',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '278427291',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '278427312',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '278427321',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '278427325',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '278427400',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '278427440',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '279118194',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '279118213',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '280208591',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '280208623',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '280208703',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '280208795',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '280208940',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '280208948',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '280208983',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '280209118',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '280872757',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '280872760',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '281738523',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '281738537',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '281738611',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '281738612',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '281738656',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '281738727',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '281738779',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '281738804',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '282334247',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '282334250',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '283201493',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '283201502',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '283201555',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '283201600',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '283201619',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '283201644',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '283201665',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '283201862',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '283476607',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '283476609',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '284790772',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '284790838',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '284790854',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '284790863',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '284790951',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '284791091',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '284791128',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '285168518',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '285168522',           'CAMX-SKAT-015649'),
      ('DRAFTKINGS', '294494802',           'DYLA-DRUM-002275'),
      ('DRAFTKINGS', '295906490',           'DYLA-DRUM-002275'),
      ('DRAFTKINGS', '296891053',           'DYLA-DRUM-002275'),
      ('FANDUEL',   '711.100213691',       'JAMA-CHAS-016384'),
      ('FANDUEL',   '711.100213704',       'TEEX-HIGG-000938'),
      ('FANDUEL',   '711.100972931',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.103223307',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.103223327',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.103223407',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.104000438',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.104002612',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.104002614',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.105525435',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.105525465',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.105525470',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.138045237',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.138045241',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.138045246',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.139832120',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.139832121',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.139846124',       'ANDR-MCCO-004333'),
      ('FANDUEL',   '711.139846248',       'ANDR-MCCO-004333'),
      ('FANDUEL',   '711.140026953',       'THEO-JOHN-004074'),
      ('FANDUEL',   '711.140040856',       'MARK-IRVI-017623'),
      ('FANDUEL',   '711.140042319',       'MARK-IRVI-017623'),
      ('FANDUEL',   '711.140042458',       'MARK-IRVI-017623'),
      ('FANDUEL',   '711.140042515',       'MARK-IRVI-017623'),
      ('FANDUEL',   '711.140125386',       'ANDR-MCCO-004333'),
      ('FANDUEL',   '711.140380810',       'MARK-IRVI-017623'),
      ('FANDUEL',   '711.144372901',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.146026809',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.146026822',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.146028812',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.146773799',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.146774093',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.148492238',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.148492242',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.148570833',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.149344994',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.149344995',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.149909070',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.149909314',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.149909316',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.150447725',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.150447732',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.150481651',       'ZONO-KNIG-025438'),
      ('FANDUEL',   '711.152133943',       'JORD-LOVE-001990'),
      ('FANDUEL',   '711.152133946',       'CALE-WILL-002155'),
      ('FANDUEL',   '711.152202395',       'JOSH-ALLE-000098'),
      ('FANDUEL',   '711.152202401',       'JOSH-ALLE-000098'),
      ('FANDUEL',   '711.152204905',       'JOSH-ALLE-000098'),
      ('FANDUEL',   '711.152204971',       'JOSH-ALLE-000098'),
      ('FANDUEL',   '711.152210831',       'KYLE-MONA-017458'),
      ('FANDUEL',   '711.152210837',       'CALE-WILL-002155'),
      ('FANDUEL',   '711.152210841',       'DAND-SWIF-005581'),
      ('FANDUEL',   '711.152210846',       'JORD-LOVE-001990'),
      ('FANDUEL',   '711.152210848',       'JOSH-JACO-001263'),
      ('FANDUEL',   '711.152211673',       'CHRI-WATS-007263'),
      ('FANDUEL',   '711.152211678',       'CHRI-WATS-007263'),
      ('FANDUEL',   '711.152211958',       'LUTH-BURD-003046'),
      ('FANDUEL',   '711.152211959',       'LUTH-BURD-003046'),
      ('FANDUEL',   '711.152211961',       'ROME-ODUN-024966'),
      ('FANDUEL',   '711.152211963',       'ROME-ODUN-024966'),
      ('FANDUEL',   '711.152212270',       'COLS-LOVE-000613'),
      ('FANDUEL',   '711.152212275',       'COLS-LOVE-000613'),
      ('FANDUEL',   '711.152212281',       'JAYD-REED-008824'),
      ('FANDUEL',   '711.152212282',       'JAYD-REED-008824'),
      ('FANDUEL',   '711.152213736',       'ROME-DOUB-025034'),
      ('FANDUEL',   '711.152213738',       'DJXX-MOOR-007273'),
      ('FANDUEL',   '711.152213739',       'ROME-DOUB-025034'),
      ('FANDUEL',   '711.152213747',       'DJXX-MOOR-007273'),
      ('FANDUEL',   '711.152214046',       'JOSH-JACO-001263'),
      ('FANDUEL',   '711.152214064',       'DAND-SWIF-005581'),
      ('FANDUEL',   '711.152214128',       'LUKE-MUSG-002741'),
      ('FANDUEL',   '711.152214130',       'LUKE-MUSG-002741'),
      ('FANDUEL',   '711.152214249',       'KYLE-MONA-017458'),
      ('FANDUEL',   '711.152214252',       'JOSH-JACO-001263'),
      ('FANDUEL',   '711.152214255',       'LUKE-MUSG-002741'),
      ('FANDUEL',   '711.152214266',       'CALE-WILL-002155'),
      ('FANDUEL',   '711.152214269',       'ROME-DOUB-025034'),
      ('FANDUEL',   '711.152214273',       'DAND-SWIF-005581'),
      ('FANDUEL',   '711.152214276',       'COLS-LOVE-000613'),
      ('FANDUEL',   '711.152214284',       'CALE-WILL-002155'),
      ('FANDUEL',   '711.152214289',       'CHRI-WATS-007263'),
      ('FANDUEL',   '711.152214300',       'JORD-LOVE-001990'),
      ('FANDUEL',   '711.152214302',       'JOSH-JACO-001263'),
      ('FANDUEL',   '711.152214319',       'JAYD-REED-008824'),
      ('FANDUEL',   '711.152214329',       'JORD-LOVE-001990'),
      ('FANDUEL',   '711.152214330',       'DAND-SWIF-005581'),
      ('FANDUEL',   '711.152214340',       'LUTH-BURD-003046'),
      ('FANDUEL',   '711.152214344',       'DJXX-MOOR-007273'),
      ('FANDUEL',   '711.152214358',       'ROME-ODUN-024966'),
      ('FANDUEL',   '711.152215302',       'COLE-KMET-002218'),
      ('FANDUEL',   '711.152315935',       'JOSH-ALLE-000098'),
      ('FANDUEL',   '711.152316050',       'JOSH-ALLE-000098'),
      ('FANDUEL',   '711.98976725',        'THEO-JOHN-004074'),
      ('FANDUEL',   '711.99682520',        'THEO-JOHN-004074'),
      ('FANDUEL',   '711.99997998',        'THEO-JOHN-004074'),
      ('FANDUEL',   '734.81038444',        'JOSH-ALLE-000098'),
      ('FANDUEL',   '736.137657867',       'THEO-JOHN-004074'),
      ('FANDUEL',   '736.137657869',       'THEO-JOHN-004074'),
      ('FANDUEL',   '736.137657875',       'THEO-JOHN-004074'),
      ('PINNACLE',  '1597717579',          'THEO-JOHN-004074'),
      ('CAESARS',   '08f696c2-3cac-3b08-828c-001c39ed4ac6', 'SIMI-FEHO-019360'),
      ('DRAFTKINGS', '213957926',           'JOSH-ALLE-000098'),
      ('DRAFTKINGS', '288131745',           'TERR-JENN-000417'),
      ('DRAFTKINGS', '289850243',           'TERR-JENN-000417'),
      ('DRAFTKINGS', '291136408',           'ROBB-ANDE-017101'),
      ('FANDUEL',   '711.151039292',       'AUDR-ESTI-006095'),
      ('FANDUEL',   '711.151039299',       'AUDR-ESTI-006095'),
      ('FANDUEL',   '711.151039300',       'AUDR-ESTI-006095'),
      ('FANDUEL',   '711.151039307',       'AUDR-ESTI-006095'),
      ('FANDUEL',   '711.151039926',       'AUDR-ESTI-006095'),
      ('FANDUEL',   '711.151979191',       'AUDR-ESTI-006095'),
      ('FANDUEL',   '711.151979554',       'AUDR-ESTI-006095'),
      ('FANDUEL',   '711.99678689',        'JOSH-ALLE-000098'),
      ('FANDUEL',   '711.99678690',        'JOSH-ALLE-000098')
  )
  UPDATE public.prop_market_selections_index s
     SET selection_pid = mp.selection_pid
    FROM market_player mp
   WHERE s.source_id::text = mp.source_id
     AND s.source_market_id = mp.source_market_id
     AND s.selection_pid IS NULL;

  GET DIAGNOSTICS attributed = ROW_COUNT;

  IF attributed <> 1330 THEN
    RAISE EXCEPTION
      'expected to attribute 1330 selections, attributed %; rolling back', attributed;
  END IF;

  RAISE NOTICE 'attributed % selections across 212 markets', attributed;
END $$;

-- Post-conditions, inside the same transaction.
DO $$
DECLARE
  still_null_pid integer;
  still_graded integer;
  wrong_player integer;
BEGIN
  WITH market_player (source_id, source_market_id) AS (
    VALUES
      ('CAESARS',   '36f9643d-a4ef-3ace-b9b9-040026dc3704'),
      ('CAESARS',   'db659d27-346e-321b-bd77-2817579fa685'),
      ('DRAFTKINGS', '178831491'),
      ('DRAFTKINGS', '179054819'),
      ('DRAFTKINGS', '181070983'),
      ('DRAFTKINGS', '181071015'),
      ('DRAFTKINGS', '181123808'),
      ('DRAFTKINGS', '211317519'),
      ('DRAFTKINGS', '212970139'),
      ('DRAFTKINGS', '213981807'),
      ('DRAFTKINGS', '214899564'),
      ('DRAFTKINGS', '215968934'),
      ('DRAFTKINGS', '216802405'),
      ('DRAFTKINGS', '218021692'),
      ('DRAFTKINGS', '218936447'),
      ('DRAFTKINGS', '220411408'),
      ('DRAFTKINGS', '220908919'),
      ('DRAFTKINGS', '222027792'),
      ('DRAFTKINGS', '223097123'),
      ('DRAFTKINGS', '224105726'),
      ('DRAFTKINGS', '225833397'),
      ('DRAFTKINGS', '226595974'),
      ('DRAFTKINGS', '227069685'),
      ('DRAFTKINGS', '228009753'),
      ('DRAFTKINGS', '228683762'),
      ('DRAFTKINGS', '229493267'),
      ('DRAFTKINGS', '273450471'),
      ('DRAFTKINGS', '273541663'),
      ('DRAFTKINGS', '275098632'),
      ('DRAFTKINGS', '275723521'),
      ('DRAFTKINGS', '276303501'),
      ('DRAFTKINGS', '276303517'),
      ('DRAFTKINGS', '276336864'),
      ('DRAFTKINGS', '276336878'),
      ('DRAFTKINGS', '276336888'),
      ('DRAFTKINGS', '276336934'),
      ('DRAFTKINGS', '276336952'),
      ('DRAFTKINGS', '276347255'),
      ('DRAFTKINGS', '276779567'),
      ('DRAFTKINGS', '276779817'),
      ('DRAFTKINGS', '277237412'),
      ('DRAFTKINGS', '277237440'),
      ('DRAFTKINGS', '277237598'),
      ('DRAFTKINGS', '277237623'),
      ('DRAFTKINGS', '277940187'),
      ('DRAFTKINGS', '277940188'),
      ('DRAFTKINGS', '278427273'),
      ('DRAFTKINGS', '278427286'),
      ('DRAFTKINGS', '278427291'),
      ('DRAFTKINGS', '278427312'),
      ('DRAFTKINGS', '278427321'),
      ('DRAFTKINGS', '278427325'),
      ('DRAFTKINGS', '278427400'),
      ('DRAFTKINGS', '278427440'),
      ('DRAFTKINGS', '279118194'),
      ('DRAFTKINGS', '279118213'),
      ('DRAFTKINGS', '280208591'),
      ('DRAFTKINGS', '280208623'),
      ('DRAFTKINGS', '280208703'),
      ('DRAFTKINGS', '280208795'),
      ('DRAFTKINGS', '280208940'),
      ('DRAFTKINGS', '280208948'),
      ('DRAFTKINGS', '280208983'),
      ('DRAFTKINGS', '280209118'),
      ('DRAFTKINGS', '280872757'),
      ('DRAFTKINGS', '280872760'),
      ('DRAFTKINGS', '281738523'),
      ('DRAFTKINGS', '281738537'),
      ('DRAFTKINGS', '281738611'),
      ('DRAFTKINGS', '281738612'),
      ('DRAFTKINGS', '281738656'),
      ('DRAFTKINGS', '281738727'),
      ('DRAFTKINGS', '281738779'),
      ('DRAFTKINGS', '281738804'),
      ('DRAFTKINGS', '282334247'),
      ('DRAFTKINGS', '282334250'),
      ('DRAFTKINGS', '283201493'),
      ('DRAFTKINGS', '283201502'),
      ('DRAFTKINGS', '283201555'),
      ('DRAFTKINGS', '283201600'),
      ('DRAFTKINGS', '283201619'),
      ('DRAFTKINGS', '283201644'),
      ('DRAFTKINGS', '283201665'),
      ('DRAFTKINGS', '283201862'),
      ('DRAFTKINGS', '283476607'),
      ('DRAFTKINGS', '283476609'),
      ('DRAFTKINGS', '284790772'),
      ('DRAFTKINGS', '284790838'),
      ('DRAFTKINGS', '284790854'),
      ('DRAFTKINGS', '284790863'),
      ('DRAFTKINGS', '284790951'),
      ('DRAFTKINGS', '284791091'),
      ('DRAFTKINGS', '284791128'),
      ('DRAFTKINGS', '285168518'),
      ('DRAFTKINGS', '285168522'),
      ('DRAFTKINGS', '294494802'),
      ('DRAFTKINGS', '295906490'),
      ('DRAFTKINGS', '296891053'),
      ('FANDUEL',   '711.100213691'),
      ('FANDUEL',   '711.100213704'),
      ('FANDUEL',   '711.100972931'),
      ('FANDUEL',   '711.103223307'),
      ('FANDUEL',   '711.103223327'),
      ('FANDUEL',   '711.103223407'),
      ('FANDUEL',   '711.104000438'),
      ('FANDUEL',   '711.104002612'),
      ('FANDUEL',   '711.104002614'),
      ('FANDUEL',   '711.105525435'),
      ('FANDUEL',   '711.105525465'),
      ('FANDUEL',   '711.105525470'),
      ('FANDUEL',   '711.138045237'),
      ('FANDUEL',   '711.138045241'),
      ('FANDUEL',   '711.138045246'),
      ('FANDUEL',   '711.139832120'),
      ('FANDUEL',   '711.139832121'),
      ('FANDUEL',   '711.139846124'),
      ('FANDUEL',   '711.139846248'),
      ('FANDUEL',   '711.140026953'),
      ('FANDUEL',   '711.140040856'),
      ('FANDUEL',   '711.140042319'),
      ('FANDUEL',   '711.140042458'),
      ('FANDUEL',   '711.140042515'),
      ('FANDUEL',   '711.140125386'),
      ('FANDUEL',   '711.140380810'),
      ('FANDUEL',   '711.144372901'),
      ('FANDUEL',   '711.146026809'),
      ('FANDUEL',   '711.146026822'),
      ('FANDUEL',   '711.146028812'),
      ('FANDUEL',   '711.146773799'),
      ('FANDUEL',   '711.146774093'),
      ('FANDUEL',   '711.148492238'),
      ('FANDUEL',   '711.148492242'),
      ('FANDUEL',   '711.148570833'),
      ('FANDUEL',   '711.149344994'),
      ('FANDUEL',   '711.149344995'),
      ('FANDUEL',   '711.149909070'),
      ('FANDUEL',   '711.149909314'),
      ('FANDUEL',   '711.149909316'),
      ('FANDUEL',   '711.150447725'),
      ('FANDUEL',   '711.150447732'),
      ('FANDUEL',   '711.150481651'),
      ('FANDUEL',   '711.152133943'),
      ('FANDUEL',   '711.152133946'),
      ('FANDUEL',   '711.152202395'),
      ('FANDUEL',   '711.152202401'),
      ('FANDUEL',   '711.152204905'),
      ('FANDUEL',   '711.152204971'),
      ('FANDUEL',   '711.152210831'),
      ('FANDUEL',   '711.152210837'),
      ('FANDUEL',   '711.152210841'),
      ('FANDUEL',   '711.152210846'),
      ('FANDUEL',   '711.152210848'),
      ('FANDUEL',   '711.152211673'),
      ('FANDUEL',   '711.152211678'),
      ('FANDUEL',   '711.152211958'),
      ('FANDUEL',   '711.152211959'),
      ('FANDUEL',   '711.152211961'),
      ('FANDUEL',   '711.152211963'),
      ('FANDUEL',   '711.152212270'),
      ('FANDUEL',   '711.152212275'),
      ('FANDUEL',   '711.152212281'),
      ('FANDUEL',   '711.152212282'),
      ('FANDUEL',   '711.152213736'),
      ('FANDUEL',   '711.152213738'),
      ('FANDUEL',   '711.152213739'),
      ('FANDUEL',   '711.152213747'),
      ('FANDUEL',   '711.152214046'),
      ('FANDUEL',   '711.152214064'),
      ('FANDUEL',   '711.152214128'),
      ('FANDUEL',   '711.152214130'),
      ('FANDUEL',   '711.152214249'),
      ('FANDUEL',   '711.152214252'),
      ('FANDUEL',   '711.152214255'),
      ('FANDUEL',   '711.152214266'),
      ('FANDUEL',   '711.152214269'),
      ('FANDUEL',   '711.152214273'),
      ('FANDUEL',   '711.152214276'),
      ('FANDUEL',   '711.152214284'),
      ('FANDUEL',   '711.152214289'),
      ('FANDUEL',   '711.152214300'),
      ('FANDUEL',   '711.152214302'),
      ('FANDUEL',   '711.152214319'),
      ('FANDUEL',   '711.152214329'),
      ('FANDUEL',   '711.152214330'),
      ('FANDUEL',   '711.152214340'),
      ('FANDUEL',   '711.152214344'),
      ('FANDUEL',   '711.152214358'),
      ('FANDUEL',   '711.152215302'),
      ('FANDUEL',   '711.152315935'),
      ('FANDUEL',   '711.152316050'),
      ('FANDUEL',   '711.98976725'),
      ('FANDUEL',   '711.99682520'),
      ('FANDUEL',   '711.99997998'),
      ('FANDUEL',   '734.81038444'),
      ('FANDUEL',   '736.137657867'),
      ('FANDUEL',   '736.137657869'),
      ('FANDUEL',   '736.137657875'),
      ('PINNACLE',  '1597717579'),
      ('CAESARS',   '08f696c2-3cac-3b08-828c-001c39ed4ac6'),
      ('DRAFTKINGS', '213957926'),
      ('DRAFTKINGS', '288131745'),
      ('DRAFTKINGS', '289850243'),
      ('DRAFTKINGS', '291136408'),
      ('FANDUEL',   '711.151039292'),
      ('FANDUEL',   '711.151039299'),
      ('FANDUEL',   '711.151039300'),
      ('FANDUEL',   '711.151039307'),
      ('FANDUEL',   '711.151039926'),
      ('FANDUEL',   '711.151979191'),
      ('FANDUEL',   '711.151979554'),
      ('FANDUEL',   '711.99678689'),
      ('FANDUEL',   '711.99678690')
  )
  SELECT count(*) INTO still_null_pid
    FROM public.prop_market_selections_index s
    JOIN market_player mp
      ON s.source_id::text = mp.source_id
     AND s.source_market_id = mp.source_market_id
   WHERE s.selection_pid IS NULL;

  IF still_null_pid <> 0 THEN
    RAISE EXCEPTION
      '% selections under an affected market still carry no player; rolling back', still_null_pid;
  END IF;

  -- Nothing in the defect population may still carry a grade. This is what
  -- makes the file safe on its own: if the re-settle that follows never runs,
  -- no wrong answer is left standing.
  SELECT count(*) INTO still_graded
    FROM public.prop_markets_index m
    JOIN public.prop_market_selections_index s
      ON s.source_id = m.source_id
     AND s.source_market_id = m.source_market_id
     AND s.time_type = m.time_type
   WHERE m.market_type IN (
      'GAME_FIRST_QUARTER_PASSING_YARDS',
      'GAME_FIRST_QUARTER_RUSHING_YARDS',
      'GAME_FIRST_QUARTER_RECEIVING_YARDS',
      'GAME_FIRST_QUARTER_RECEPTIONS',
      'GAME_FIRST_QUARTER_RUSHING_ATTEMPTS',
      'GAME_FIRST_QUARTER_PASSING_ATTEMPTS',
      'GAME_FIRST_QUARTER_PASSING_INTERCEPTIONS',
      'GAME_SECOND_QUARTER_PASSING_YARDS',
      'GAME_SECOND_QUARTER_RUSHING_YARDS',
      'GAME_SECOND_QUARTER_RECEIVING_YARDS',
      'GAME_THIRD_QUARTER_PASSING_YARDS',
      'GAME_THIRD_QUARTER_RUSHING_YARDS',
      'GAME_THIRD_QUARTER_RECEIVING_YARDS',
      'GAME_FOURTH_QUARTER_PASSING_YARDS',
      'GAME_FOURTH_QUARTER_RUSHING_YARDS',
      'GAME_FOURTH_QUARTER_RECEIVING_YARDS',
      'GAME_FIRST_HALF_ALT_RUSHING_YARDS',
      'GAME_FIRST_HALF_ALT_PASSING_YARDS',
      'GAME_FIRST_HALF_ALT_RECEIVING_YARDS',
      'GAME_LONGEST_RECEPTION',
      'GAME_LONGEST_RUSH',
      'GAME_PASSING_LONGEST_COMPLETION',
      'GAME_ALT_PASSING_LONGEST_COMPLETION',
      'GAME_ALT_LONGEST_RUSH',
      'GAME_ALT_LONGEST_RECEPTION',
      'GAME_FIRST_QUARTER_ALT_PASSING_YARDS',
      'GAME_FIRST_QUARTER_ALT_RUSHING_YARDS',
      'GAME_FIRST_QUARTER_ALT_RECEIVING_YARDS',
      'GAME_SECOND_QUARTER_ALT_PASSING_YARDS',
      'GAME_SECOND_QUARTER_ALT_RUSHING_YARDS',
      'GAME_SECOND_QUARTER_ALT_RECEIVING_YARDS',
      'GAME_THIRD_QUARTER_ALT_PASSING_YARDS',
      'GAME_THIRD_QUARTER_ALT_RUSHING_YARDS',
      'GAME_THIRD_QUARTER_ALT_RECEIVING_YARDS',
      'GAME_FOURTH_QUARTER_ALT_PASSING_YARDS',
      'GAME_FOURTH_QUARTER_ALT_RUSHING_YARDS',
      'GAME_FOURTH_QUARTER_ALT_RECEIVING_YARDS'
     )
     AND s.selection_pid IS NULL
     AND s.selection_result IS NOT NULL;

  IF still_graded <> 0 THEN
    RAISE EXCEPTION
      '% null-pid selections still carry a grade; rolling back', still_graded;
  END IF;

  -- Every attributed player must hold a gamelog in the game's own season for
  -- one of the game's two teams. This is the independent check on the
  -- resolution, asserted here rather than trusted from the run that produced
  -- the mapping.
  WITH market_player (source_id, source_market_id) AS (
    VALUES
      ('CAESARS',   '36f9643d-a4ef-3ace-b9b9-040026dc3704'),
      ('CAESARS',   'db659d27-346e-321b-bd77-2817579fa685'),
      ('DRAFTKINGS', '178831491'),
      ('DRAFTKINGS', '179054819'),
      ('DRAFTKINGS', '181070983'),
      ('DRAFTKINGS', '181071015'),
      ('DRAFTKINGS', '181123808'),
      ('DRAFTKINGS', '211317519'),
      ('DRAFTKINGS', '212970139'),
      ('DRAFTKINGS', '213981807'),
      ('DRAFTKINGS', '214899564'),
      ('DRAFTKINGS', '215968934'),
      ('DRAFTKINGS', '216802405'),
      ('DRAFTKINGS', '218021692'),
      ('DRAFTKINGS', '218936447'),
      ('DRAFTKINGS', '220411408'),
      ('DRAFTKINGS', '220908919'),
      ('DRAFTKINGS', '222027792'),
      ('DRAFTKINGS', '223097123'),
      ('DRAFTKINGS', '224105726'),
      ('DRAFTKINGS', '225833397'),
      ('DRAFTKINGS', '226595974'),
      ('DRAFTKINGS', '227069685'),
      ('DRAFTKINGS', '228009753'),
      ('DRAFTKINGS', '228683762'),
      ('DRAFTKINGS', '229493267'),
      ('DRAFTKINGS', '273450471'),
      ('DRAFTKINGS', '273541663'),
      ('DRAFTKINGS', '275098632'),
      ('DRAFTKINGS', '275723521'),
      ('DRAFTKINGS', '276303501'),
      ('DRAFTKINGS', '276303517'),
      ('DRAFTKINGS', '276336864'),
      ('DRAFTKINGS', '276336878'),
      ('DRAFTKINGS', '276336888'),
      ('DRAFTKINGS', '276336934'),
      ('DRAFTKINGS', '276336952'),
      ('DRAFTKINGS', '276347255'),
      ('DRAFTKINGS', '276779567'),
      ('DRAFTKINGS', '276779817'),
      ('DRAFTKINGS', '277237412'),
      ('DRAFTKINGS', '277237440'),
      ('DRAFTKINGS', '277237598'),
      ('DRAFTKINGS', '277237623'),
      ('DRAFTKINGS', '277940187'),
      ('DRAFTKINGS', '277940188'),
      ('DRAFTKINGS', '278427273'),
      ('DRAFTKINGS', '278427286'),
      ('DRAFTKINGS', '278427291'),
      ('DRAFTKINGS', '278427312'),
      ('DRAFTKINGS', '278427321'),
      ('DRAFTKINGS', '278427325'),
      ('DRAFTKINGS', '278427400'),
      ('DRAFTKINGS', '278427440'),
      ('DRAFTKINGS', '279118194'),
      ('DRAFTKINGS', '279118213'),
      ('DRAFTKINGS', '280208591'),
      ('DRAFTKINGS', '280208623'),
      ('DRAFTKINGS', '280208703'),
      ('DRAFTKINGS', '280208795'),
      ('DRAFTKINGS', '280208940'),
      ('DRAFTKINGS', '280208948'),
      ('DRAFTKINGS', '280208983'),
      ('DRAFTKINGS', '280209118'),
      ('DRAFTKINGS', '280872757'),
      ('DRAFTKINGS', '280872760'),
      ('DRAFTKINGS', '281738523'),
      ('DRAFTKINGS', '281738537'),
      ('DRAFTKINGS', '281738611'),
      ('DRAFTKINGS', '281738612'),
      ('DRAFTKINGS', '281738656'),
      ('DRAFTKINGS', '281738727'),
      ('DRAFTKINGS', '281738779'),
      ('DRAFTKINGS', '281738804'),
      ('DRAFTKINGS', '282334247'),
      ('DRAFTKINGS', '282334250'),
      ('DRAFTKINGS', '283201493'),
      ('DRAFTKINGS', '283201502'),
      ('DRAFTKINGS', '283201555'),
      ('DRAFTKINGS', '283201600'),
      ('DRAFTKINGS', '283201619'),
      ('DRAFTKINGS', '283201644'),
      ('DRAFTKINGS', '283201665'),
      ('DRAFTKINGS', '283201862'),
      ('DRAFTKINGS', '283476607'),
      ('DRAFTKINGS', '283476609'),
      ('DRAFTKINGS', '284790772'),
      ('DRAFTKINGS', '284790838'),
      ('DRAFTKINGS', '284790854'),
      ('DRAFTKINGS', '284790863'),
      ('DRAFTKINGS', '284790951'),
      ('DRAFTKINGS', '284791091'),
      ('DRAFTKINGS', '284791128'),
      ('DRAFTKINGS', '285168518'),
      ('DRAFTKINGS', '285168522'),
      ('DRAFTKINGS', '294494802'),
      ('DRAFTKINGS', '295906490'),
      ('DRAFTKINGS', '296891053'),
      ('FANDUEL',   '711.100213691'),
      ('FANDUEL',   '711.100213704'),
      ('FANDUEL',   '711.100972931'),
      ('FANDUEL',   '711.103223307'),
      ('FANDUEL',   '711.103223327'),
      ('FANDUEL',   '711.103223407'),
      ('FANDUEL',   '711.104000438'),
      ('FANDUEL',   '711.104002612'),
      ('FANDUEL',   '711.104002614'),
      ('FANDUEL',   '711.105525435'),
      ('FANDUEL',   '711.105525465'),
      ('FANDUEL',   '711.105525470'),
      ('FANDUEL',   '711.138045237'),
      ('FANDUEL',   '711.138045241'),
      ('FANDUEL',   '711.138045246'),
      ('FANDUEL',   '711.139832120'),
      ('FANDUEL',   '711.139832121'),
      ('FANDUEL',   '711.139846124'),
      ('FANDUEL',   '711.139846248'),
      ('FANDUEL',   '711.140026953'),
      ('FANDUEL',   '711.140040856'),
      ('FANDUEL',   '711.140042319'),
      ('FANDUEL',   '711.140042458'),
      ('FANDUEL',   '711.140042515'),
      ('FANDUEL',   '711.140125386'),
      ('FANDUEL',   '711.140380810'),
      ('FANDUEL',   '711.144372901'),
      ('FANDUEL',   '711.146026809'),
      ('FANDUEL',   '711.146026822'),
      ('FANDUEL',   '711.146028812'),
      ('FANDUEL',   '711.146773799'),
      ('FANDUEL',   '711.146774093'),
      ('FANDUEL',   '711.148492238'),
      ('FANDUEL',   '711.148492242'),
      ('FANDUEL',   '711.148570833'),
      ('FANDUEL',   '711.149344994'),
      ('FANDUEL',   '711.149344995'),
      ('FANDUEL',   '711.149909070'),
      ('FANDUEL',   '711.149909314'),
      ('FANDUEL',   '711.149909316'),
      ('FANDUEL',   '711.150447725'),
      ('FANDUEL',   '711.150447732'),
      ('FANDUEL',   '711.150481651'),
      ('FANDUEL',   '711.152133943'),
      ('FANDUEL',   '711.152133946'),
      ('FANDUEL',   '711.152202395'),
      ('FANDUEL',   '711.152202401'),
      ('FANDUEL',   '711.152204905'),
      ('FANDUEL',   '711.152204971'),
      ('FANDUEL',   '711.152210831'),
      ('FANDUEL',   '711.152210837'),
      ('FANDUEL',   '711.152210841'),
      ('FANDUEL',   '711.152210846'),
      ('FANDUEL',   '711.152210848'),
      ('FANDUEL',   '711.152211673'),
      ('FANDUEL',   '711.152211678'),
      ('FANDUEL',   '711.152211958'),
      ('FANDUEL',   '711.152211959'),
      ('FANDUEL',   '711.152211961'),
      ('FANDUEL',   '711.152211963'),
      ('FANDUEL',   '711.152212270'),
      ('FANDUEL',   '711.152212275'),
      ('FANDUEL',   '711.152212281'),
      ('FANDUEL',   '711.152212282'),
      ('FANDUEL',   '711.152213736'),
      ('FANDUEL',   '711.152213738'),
      ('FANDUEL',   '711.152213739'),
      ('FANDUEL',   '711.152213747'),
      ('FANDUEL',   '711.152214046'),
      ('FANDUEL',   '711.152214064'),
      ('FANDUEL',   '711.152214128'),
      ('FANDUEL',   '711.152214130'),
      ('FANDUEL',   '711.152214249'),
      ('FANDUEL',   '711.152214252'),
      ('FANDUEL',   '711.152214255'),
      ('FANDUEL',   '711.152214266'),
      ('FANDUEL',   '711.152214269'),
      ('FANDUEL',   '711.152214273'),
      ('FANDUEL',   '711.152214276'),
      ('FANDUEL',   '711.152214284'),
      ('FANDUEL',   '711.152214289'),
      ('FANDUEL',   '711.152214300'),
      ('FANDUEL',   '711.152214302'),
      ('FANDUEL',   '711.152214319'),
      ('FANDUEL',   '711.152214329'),
      ('FANDUEL',   '711.152214330'),
      ('FANDUEL',   '711.152214340'),
      ('FANDUEL',   '711.152214344'),
      ('FANDUEL',   '711.152214358'),
      ('FANDUEL',   '711.152215302'),
      ('FANDUEL',   '711.152315935'),
      ('FANDUEL',   '711.152316050'),
      ('FANDUEL',   '711.98976725'),
      ('FANDUEL',   '711.99682520'),
      ('FANDUEL',   '711.99997998'),
      ('FANDUEL',   '734.81038444'),
      ('FANDUEL',   '736.137657867'),
      ('FANDUEL',   '736.137657869'),
      ('FANDUEL',   '736.137657875'),
      ('PINNACLE',  '1597717579'),
      ('CAESARS',   '08f696c2-3cac-3b08-828c-001c39ed4ac6'),
      ('DRAFTKINGS', '213957926'),
      ('DRAFTKINGS', '288131745'),
      ('DRAFTKINGS', '289850243'),
      ('DRAFTKINGS', '291136408'),
      ('FANDUEL',   '711.151039292'),
      ('FANDUEL',   '711.151039299'),
      ('FANDUEL',   '711.151039300'),
      ('FANDUEL',   '711.151039307'),
      ('FANDUEL',   '711.151039926'),
      ('FANDUEL',   '711.151979191'),
      ('FANDUEL',   '711.151979554'),
      ('FANDUEL',   '711.99678689'),
      ('FANDUEL',   '711.99678690')
  )
  SELECT count(*) INTO wrong_player
    FROM (
      SELECT DISTINCT s.selection_pid, m.esbid
        FROM public.prop_markets_index m
        JOIN public.prop_market_selections_index s
          ON s.source_id = m.source_id
         AND s.source_market_id = m.source_market_id
         AND s.time_type = m.time_type
        JOIN market_player mp
          ON s.source_id::text = mp.source_id
         AND s.source_market_id = mp.source_market_id
       WHERE m.esbid IS NOT NULL
    ) a
    JOIN public.nfl_games g ON g.esbid = a.esbid
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.player_gamelogs pg
       JOIN public.nfl_games g2 ON g2.esbid = pg.esbid
      WHERE pg.pid = a.selection_pid
        AND g2.season_year = g.season_year
        AND pg.nfl_team IN (g.away_nfl_team, g.home_nfl_team)
   );

  IF wrong_player <> 0 THEN
    RAISE EXCEPTION
      '% attributed players hold no gamelog in the game''s season for either team; rolling back', wrong_player;
  END IF;

  RAISE NOTICE 'repair clean: no null pids, no standing grades, no player out of era';
END $$;
