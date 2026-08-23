-- STATUS: APPLIED 2026-08-23 against league_production
--
-- Repoint the 107 prop_markets_index rows whose esbid matches no nfl_games row,
-- and give each the season of the game it now points at.
--
-- Three esbids across 6 (esbid, source_id) groups hold markets for games that
-- exist under a DIFFERENT id. Because every consumer named in the
-- prop-markets-games-season-agreement invariant inner-joins nfl_games, these
-- 107 rows are invisible today -- they are dropped before any filter is
-- evaluated, so nothing has ever contradicted them.
--
-- 2024011400 -> 2024011501. The pre-postponement id for the PIT@BUF wild card
-- game, which moved from 2024-01-14 to 2024-01-15 for the winter storm. 97 rows
-- (FANDUEL 39, PRIZEPICKS 58), season 2023 (POST week 1).
--
-- 2024121900 -> 2024122214 and 2024122209 -> 2024121901. These two are
-- TRANSPOSED: the id encoding 12/19 carries CLE@CIN event names while the real
-- 12/19 game is DEN@LAC, and vice versa. 5 rows each (CAESARS 4, DRAFTKINGS 1),
-- season 2024 (REG week 16).
--
-- WHY THIS DERIVATION IS TRUSTED. It matches on event name rather than on an
-- exact key, which is a weaker standard than a functional dependency, so it was
-- corroborated against a surface the event name does not control:
--
--   * PIT@BUF, the player-prop half. All 15 distinct PrizePicks selection
--     players and 17 of 19 FanDuel ones appear in player_gamelogs for
--     2024011501; the 2 absences are ordinary DNPs. Zero of either book's
--     players appear in any other candidate game. This matters most for
--     PRIZEPICKS, whose 58 rows carry NO source_event_name at all -- the roster
--     is the only evidence those rows have, and it is unanimous.
--   * The transposed pair. All 10 rows are TEAM markets (money line, spread,
--     total points, first to score) with no player pids, but the teams are named
--     twice over independently -- in source_market_name and again in every
--     selection_name ("Cincinnati Bengals", "Cleveland Browns"). Each target is
--     the unique 2024 game at that away/home orientation: CLE at CIN is
--     2024122214 and DEN at LAC is 2024121901, one row each in nfl_games.
--
-- Each UPDATE is guarded on the event-name evidence that justifies it, not on
-- the esbid alone, so a row sitting at one of these ids WITHOUT the name that
-- licenses the move is left behind and reported by the post-condition rather
-- than swept along.
--
-- The post-conditions assert ORIENTATION, which is the claim this file actually
-- makes and the one an earlier draft could not check. Both transposed targets
-- are real games in the same week of the same season, so swapping them left
-- every assertion silent: the ids resolve, the seasons match, the row counts
-- hold. Only the event name separates them, so post-condition 0 requires each
-- moved row to name its new game's two teams. It also carries the file's one
-- real surprise -- DraftKings writes "DEN Broncos @ LA Chargers", and "LA
-- Chargers" does not contain the abbreviation LAC, so the check flagged a
-- correct row on its first run and both spellings are now named explicitly.
--
-- SEASON_YEAR MOVES IN THE SAME STATEMENT, AND THAT IS NOT A CONVENIENCE. 105
-- of the 107 rows carry a NULL season today (only the 2 DRAFTKINGS rows have
-- 2024). Repointing the esbid alone makes all 107 rows joinable for the first
-- time and would therefore hand prop-markets-games-season-agreement 6 brand-new
-- disagreeing groups -- a check that reads zero today would go red on the
-- repair. The esbid and the season are one change.
--
-- WHAT BECOMES VISIBLE. These rows enter every consumer that filters markets by
-- esbid or season_year. For 2024011501: FANDUEL 39 player-prop markets
-- (longest reception, longest rush, alt receiving/receptions/rushing yards,
-- passing and rushing leaders, 8 with a null market_type) and PRIZEPICKS 58
-- (PPR fantasy points, receiving/rushing/passing yards, receptions, passing
-- touchdowns, defensive sacks, tackles+assists). For the two week 16 games: 5
-- team markets each. All are OPEN rows except 5 (2 PRIZEPICKS CLOSE, 2
-- PRIZEPICKS receptions CLOSE, 2 DRAFTKINGS CLOSE). The three target games
-- already carry markets -- 356, 1682 and 1445 rows respectively -- so this is
-- an addition to a populated game, not the first data for one. No duplicate can
-- arise: the unique index idx_24959_market is
-- (source_id, source_market_id, time_type) and does not include esbid, so a row
-- whose corrected esbid already had that market WOULD BE that row.
--
-- SCOPE, AND THE ONE TABLE THIS DELIBERATELY LEAVES STALE. Across the canonical
-- prop-market family prop_markets_index is the only table carrying esbid --
-- prop_markets_history, prop_market_selections_history and
-- prop_market_selections_index all lack the column. But props_index, the frozen
-- 2020-2023 archive, carries BOTH esbid and season_year, and holds 108 rows at
-- 2024011400 (season 2023, week 1, FANDUEL, CLOSE, 25 distinct pids). After
-- this file applies, prop_markets_index says 2024011501 and props_index still
-- says 2024011400 for the same FanDuel PIT@BUF markets.
--
-- That is left alone on purpose. props_index is a dead table -- max observed_at
-- 2024-01-27, no live writer -- and it is slated to be DROPPED outright by
-- user:task/league/migrate-props-archive-into-canonical-prop-markets.md, whose
-- migration reads props.id as a market key and never reads props_index.esbid.
-- Repairing rows in a table scheduled for deletion is the transitional cruft
-- that task exists to avoid. The inconsistency is historical and cannot grow.
-- Verified clean elsewhere: props, prop_pairings, prop_pairing_props,
-- selection_combination_odds_index/_history and
-- weekly_market_selections_analysis_cache hold zero orphan esbids, and
-- prop_pairing_props references none of the affected markets.
--
-- SETTLEMENT. All 107 markets carry is_market_settled = false, and 197 of their
-- 199 prop_market_selections_index rows carry a NULL selection_result.
-- Repointing makes them joinable to nfl_games and therefore gradeable by
-- libs-server/prop-market-settlement for the first time, so the settlement job
-- will pick up three 2024-season games' worth of unsettled selections on its
-- next pass. That is the intended consequence of making the rows visible, but
-- it is a behaviour change and not merely a read-path one -- worth watching the
-- market_settled = false queue after the apply rather than assuming it drains.

\echo 'Pre-repair orphan population (expect 107 rows, 3 esbids, 6 groups):'
SELECT i.esbid, i.source_id::text AS book, count(*) AS rows,
       count(*) FILTER (WHERE i.season_year IS NULL) AS null_season
FROM prop_markets_index i
LEFT JOIN nfl_games g ON g.esbid = i.esbid
WHERE i.esbid IS NOT NULL AND g.esbid IS NULL
GROUP BY 1, 2 ORDER BY 1, 2;

-- The keys this file moves, captured BEFORE the UPDATEs so the post-conditions
-- can grade exactly the repointed rows. Without this the orientation check
-- below would also grade the 3,483 rows already sitting at the three target
-- games, whose event names come from every book's own spelling and have nothing
-- to do with this repair. ON COMMIT DROP: the table lives and dies inside
-- db-exec.sh's single transaction and leaves nothing behind.
CREATE TEMP TABLE repointed_keys ON COMMIT DROP AS
SELECT source_id, source_market_id, time_type, esbid AS old_esbid
FROM prop_markets_index
WHERE esbid IN (2024011400, 2024121900, 2024122209);

DO $$
DECLARE
  moved integer;
  captured integer;
  misdirected integer;
  remaining_orphans integer;
  disagreeing_groups integer;
BEGIN
  SELECT count(*) INTO captured FROM repointed_keys;
  IF captured <> 107 THEN
    RAISE EXCEPTION 'PRE-CONDITION FAILED: expected 107 orphan rows to repoint, captured %', captured;
  END IF;

  -- PIT@BUF wild card, postponed one day. FanDuel names the event; PrizePicks
  -- carries no event name, so its rows are matched on the id alone and rest on
  -- the roster corroboration recorded in the header.
  UPDATE prop_markets_index
     SET esbid = 2024011501, season_year = 2023
   WHERE esbid = 2024011400
     AND (
       (source_id = 'FANDUEL' AND trim(source_event_name) = 'Pittsburgh Steelers @ Buffalo Bills')
       OR (source_id = 'PRIZEPICKS' AND source_event_name IS NULL)
     );
  GET DIAGNOSTICS moved = ROW_COUNT;
  IF moved <> 97 THEN
    RAISE EXCEPTION 'PIT@BUF: expected to move 97 rows, moved %', moved;
  END IF;

  -- Transposed: the id encoding 12/19 holds the CLE@CIN markets, which belong
  -- to the 12/22 game.
  UPDATE prop_markets_index
     SET esbid = 2024122214, season_year = 2024
   WHERE esbid = 2024121900
     AND trim(source_event_name) IN ('Cleveland Browns at Cincinnati Bengals', 'CLE Browns @ CIN Bengals');
  GET DIAGNOSTICS moved = ROW_COUNT;
  IF moved <> 5 THEN
    RAISE EXCEPTION 'CLE@CIN: expected to move 5 rows, moved %', moved;
  END IF;

  -- Transposed: the id encoding 12/22 holds the DEN@LAC markets, which belong
  -- to the 12/19 game.
  UPDATE prop_markets_index
     SET esbid = 2024121901, season_year = 2024
   WHERE esbid = 2024122209
     AND trim(source_event_name) IN ('Denver Broncos at Los Angeles Chargers', 'DEN Broncos @ LA Chargers');
  GET DIAGNOSTICS moved = ROW_COUNT;
  IF moved <> 5 THEN
    RAISE EXCEPTION 'DEN@LAC: expected to move 5 rows, moved %', moved;
  END IF;

  -- Post-condition 0: every repointed row names its target game's two teams.
  -- This is the assertion the file's central claim actually needs, and the
  -- other two cannot make. The claim here is about ORIENTATION -- which of two
  -- real, same-week, same-season games each row belongs to -- and swapping the
  -- two transposed targets would leave every other check silent: both games
  -- exist, both are season 2024, and both UPDATEs would still move 5 rows. Only
  -- the event name distinguishes them, so the event name is what gets asserted.
  -- PrizePicks is excluded because it carries no event name at all; its 58 rows
  -- rest on the roster corroboration in the header, which is evidence this
  -- transaction cannot re-derive.
  -- Graded over repointed_keys, so it sees the 107 moved rows and nothing else.
  -- A row passes if its event name names BOTH of its new game's teams, by
  -- abbreviation (DraftKings: "CLE Browns @ CIN Bengals") or by the city-and-
  -- nickname spelling the other books use. The city list is keyed to the three
  -- target games, so it is a whitelist of exactly the strings this repair
  -- moves rather than a general team-name matcher.
  SELECT count(*) INTO misdirected
  FROM repointed_keys k
  JOIN prop_markets_index i
    ON i.source_id = k.source_id
   AND i.source_market_id = k.source_market_id
   AND i.time_type = k.time_type
  JOIN nfl_games g ON g.esbid = i.esbid
  WHERE i.source_event_name IS NOT NULL
    AND NOT (
      i.source_event_name ILIKE '%' || g.away_nfl_team || '%'
      AND i.source_event_name ILIKE '%' || g.home_nfl_team || '%'
    )
    AND NOT (
      (g.esbid = 2024011501 AND trim(i.source_event_name) LIKE 'Pittsburgh%Buffalo%')
      OR (g.esbid = 2024122214 AND i.source_event_name LIKE 'Cleveland%Cincinnati%')
      -- Both DEN@LAC spellings are named explicitly. DraftKings writes
      -- "DEN Broncos @ LA Chargers", and "LA Chargers" does NOT contain the
      -- abbreviation LAC, so the abbreviation clause above rejects it. Caught by
      -- this very post-condition on its first run against production, which is
      -- the argument for asserting orientation rather than assuming it.
      OR (g.esbid = 2024121901 AND (
            i.source_event_name LIKE 'Denver%Los Angeles%'
            OR i.source_event_name LIKE 'DEN%LA Chargers%'
          ))
    );

  IF misdirected <> 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: % repointed rows name teams that are not their target game''s', misdirected;
  END IF;

  -- Post-condition 1: no prop_markets_index row anywhere holds an esbid that
  -- resolves to no game. Scoped to the whole table rather than to the three ids
  -- named above, so a row left behind by an event-name guard is reported here
  -- instead of passing silently.
  SELECT count(*) INTO remaining_orphans
  FROM prop_markets_index i
  LEFT JOIN nfl_games g ON g.esbid = i.esbid
  WHERE i.esbid IS NOT NULL AND g.esbid IS NULL;

  IF remaining_orphans <> 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: % prop_markets_index rows still hold an esbid matching no game', remaining_orphans;
  END IF;

  -- Post-condition 2: the registered check's own predicate, run here so the
  -- apply cannot leave prop-markets-games-season-agreement red. This is the
  -- assertion that makes the season half of each UPDATE load-bearing rather
  -- than incidental -- without it, 105 newly-joinable NULL rows would report as
  -- 6 disagreeing groups the next time the check runs.
  SELECT count(*) INTO disagreeing_groups
  FROM (
    SELECT esbid, source_id, season_year
    FROM prop_markets_index
    WHERE esbid IS NOT NULL
    GROUP BY 1, 2, 3
  ) m
  JOIN nfl_games g ON g.esbid = m.esbid
  WHERE m.season_year IS DISTINCT FROM g.season_year;

  IF disagreeing_groups <> 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: % (esbid, source_id, season_year) groups disagree with their game', disagreeing_groups;
  END IF;

  RAISE NOTICE 'OK: 107 rows repointed (97 to 2024011501, 5 to 2024122214, 5 to 2024121901); zero orphan esbids and zero disagreeing groups remain';
END $$;
