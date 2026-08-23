-- STATUS: APPLIED 2026-08-23 against league_production
--
-- Repair the 74 FanDuel prop_markets_index rows whose season_year is a yardage
-- or odds THRESHOLD read out of the market name.
--
-- get_market_year in libs-server/fanduel/fanduel-market-types.mjs used to take
-- the first four-digit run in a market name. On this vocabulary that run is the
-- threshold, not the season: "1000+ Regular Season Receiving Yards 2024-25"
-- yielded 1000 and "Thanksgiving Day Specials: +2000 to +4900" yielded 2000.
-- The parser is fixed in 17dd55a59; these rows predate the fix. Every one is
-- FanDuel with esbid IS NULL and source_event_name IS NULL, so nothing joining
-- nfl_games could ever contradict the value -- which is why it survived.
--
-- THE FIX IS NOT COMPLETE, and this file repairs the data rather than the
-- remaining hole. is_threshold_token recognises a threshold only by an adjacent
-- '+', so a threshold written any other way still reads as a season. Five
-- distinct FanDuel names on production do exactly that today -- "Any Player to
-- Break the Record for Most Passing Yards in the Regular Season (Over 5477.5
-- Reg season Pass Yards)" yields 5477, the receiving and rushing siblings yield
-- 1964 and 2105, and "<player> to have 75+ Receptions & 1000 Yards Receiving
-- Yards" yields 1000 for two players. Those rows store NULL today and so are
-- NOT in this file's population, but the shipped parser would write the
-- threshold if those markets were rescraped. Recorded as an observation on
-- user:task/league/migrate-props-archive-into-canonical-prop-markets.md; it is
-- a code change, not a data one, and does not belong in an adhoc file.
--
-- HOW THE REPLACEMENT VALUES WERE DERIVED. Not by re-spelling the parser's
-- regex in SQL, which would make this file a second implementation of the thing
-- it is healing and free to disagree with it. The shipped get_market_year was
-- CALLED on each row's own market name and the values below are its output,
-- transcribed. The importer stores source_market_name as
-- `${marketName} (${marketType})` (private/scripts/import-fanduel-odds.mjs), so
-- the parser's input is the stored name with the last parenthetical removed;
-- the harness strips exactly that and refuses a name carrying no marketType
-- suffix, so a truncation cannot pass silently into the parser.
--
-- THE HARNESS WAS CALIBRATED BOTH WAYS before its output was trusted, because a
-- deriver that always agrees and one that always disagrees are indistinguishable
-- from a correct one on a one-sided sample. Against the 3,558 FanDuel
-- esbid-less rows that already carry a plausible season, it reproduced the
-- stored value 3,558 times out of 3,558 and dissented zero times. Against the
-- 74 rows below it dissented 74 times out of 74. So it can say both words, and
-- it says them where they belong.
--
-- TWO LIMITS OF THAT CONTROL, stated because a calibration paragraph that
-- oversells itself is worse than none. First, it does NOT validate the
-- suffix-strip described above: running the parser on the RAW stored name and
-- on the stripped one agrees 3,632 times out of 3,632, so the strip changes no
-- answer anywhere in this corpus and the control would read 3,558/3,558 had the
-- harness never stripped at all. The strip is still right, but what makes it
-- safe is its shape -- anchored at the end, with a character class excluding
-- parentheses, so it can only ever take the LAST parenthetical and it THROWS
-- rather than guessing when no marketType suffix is present -- not this number.
-- Second, the control exercises the span branch (3,415 rows) and the bare-year
-- branch (143), and CANNOT exercise the threshold-skip branch that the 30 NULL
-- rows below depend on: the control is defined as rows holding a plausible
-- stored season, and a row resolving through that branch stores NULL. So the
-- NULL partition rests on the parser's own behaviour, verified by execution and
-- by reading the 15 names, rather than on agreement with anything.
--
-- 44 rows get a real season, read from the "2024-25" span the same name
-- carries. 30 go to NULL: "Championship Sunday Specials: +500 To +1900",
-- "Thanksgiving Day Specials: +2000 to +4900" and the "+5000 or Above" family
-- carry no span and no bare year, so they have no honest season and a guess
-- would be worse than the absence. NULL is what the fixed parser returns for
-- them today.
--
-- NULL is chosen with the alternative in view, not for want of one. All 30 rows
-- share source_event_id 28041972, and their observed_at dates fall on the very
-- days the names describe -- Red Zone 2024-09-05 and 2024-09-27, Thanksgiving
-- 2024-11-26, Christmas 2024-12-25, Championship Sunday 2025-01-26 -- every one
-- of which sits in season 2024. So a season IS recoverable from the row. It is
-- still not written, because deriving a futures market's season from when it
-- was observed is the specific inference this check's own repair_command
-- forbids: "observed_at is not a substitute because futures markets are
-- observed year-round and would be assigned a season by the accident of when
-- they were scraped." That these 30 happen to be datable does not make the rule
-- safe to apply, and a season written by a method the invariant rejects is
-- worse than an absent one.
--
-- Note 2000 is the value that makes a plausibility window useless as a rule:
-- of the 12 rows carrying it, "2000+ Regular Season Rushing Yards 2025-26" is
-- really 2025 and "Thanksgiving Day Specials: +2000 to +4900" is really NULL.
-- Nothing about the value 2000 distinguishes them; only the name does.
--
-- SCOPE. Across the canonical prop-market family prop_markets_index is the only
-- table holding season_year -- prop_markets_history,
-- prop_market_selections_history and prop_market_selections_index all lack the
-- column -- so this repair is complete at one table. props_index, the frozen
-- 2020-2023 archive, does carry season_year, but it holds no threshold value:
-- its max season_year is 2023 and its writer never used this parser. Verified,
-- not assumed.
--
-- Each UPDATE is additionally guarded on the row still carrying a threshold
-- value. The FanDuel importer is live and now writes the correct season, so a
-- row it has already refreshed must be left alone rather than rewritten from
-- this file's frozen snapshot.
--
-- Measured on production immediately before authoring: 74 rows across 37
-- markets, all FANDUEL, all esbid IS NULL. The count recorded on the task
-- entity and in the parser's own header comment was 86; that figure is wrong
-- and 74 is the measured population.
--
-- The registered check prop-markets-games-season-agreement is silent here by
-- construction: it inner-joins nfl_games, and these rows carry no esbid. Its
-- calibration is updated in the same commit to carry the corrected count.

\echo 'Pre-repair population (expect 74 rows across 37 markets):'
SELECT count(*) AS threshold_season_rows,
       count(DISTINCT source_market_id) AS markets,
       count(*) FILTER (WHERE esbid IS NOT NULL) AS unexpected_with_esbid
FROM prop_markets_index
WHERE season_year IS NOT NULL AND (season_year < 2015 OR season_year > 2030);

-- 26 rows -> 2024
UPDATE prop_markets_index SET season_year = 2024
WHERE source_id = 'FANDUEL'
  AND season_year IN (1000,1250,1500,1900,2000,4000,4500,5000)
  AND (source_market_id, time_type) IN (
  ('711.106975947', 'CLOSE'::time_type),
  ('711.106975947', 'OPEN'::time_type),
  ('711.94422420', 'CLOSE'::time_type),
  ('711.94422420', 'OPEN'::time_type),
  ('711.94422634', 'CLOSE'::time_type),
  ('711.94422634', 'OPEN'::time_type),
  ('711.94838348', 'CLOSE'::time_type),
  ('711.94838348', 'OPEN'::time_type),
  ('711.94838612', 'CLOSE'::time_type),
  ('711.94838612', 'OPEN'::time_type),
  ('711.95553830', 'CLOSE'::time_type),
  ('711.95553830', 'OPEN'::time_type),
  ('711.95554088', 'CLOSE'::time_type),
  ('711.95554088', 'OPEN'::time_type),
  ('734.94248482', 'CLOSE'::time_type),
  ('734.94248482', 'OPEN'::time_type),
  ('734.94248696', 'CLOSE'::time_type),
  ('734.94248696', 'OPEN'::time_type),
  ('734.94664430', 'CLOSE'::time_type),
  ('734.94664430', 'OPEN'::time_type),
  ('734.94664694', 'CLOSE'::time_type),
  ('734.94664694', 'OPEN'::time_type),
  ('734.95379883', 'CLOSE'::time_type),
  ('734.95379883', 'OPEN'::time_type),
  ('734.95380141', 'CLOSE'::time_type),
  ('734.95380141', 'OPEN'::time_type)
);

-- 18 rows -> 2025
UPDATE prop_markets_index SET season_year = 2025
WHERE source_id = 'FANDUEL'
  AND season_year IN (1000,1250,1500,1900,2000,4000,4500,5000)
  AND (source_market_id, time_type) IN (
  ('711.111937298', 'CLOSE'::time_type),
  ('711.111937298', 'OPEN'::time_type),
  ('711.123260801', 'CLOSE'::time_type),
  ('711.123260801', 'OPEN'::time_type),
  ('711.123262815', 'CLOSE'::time_type),
  ('711.123262815', 'OPEN'::time_type),
  ('711.124097509', 'CLOSE'::time_type),
  ('711.124097509', 'OPEN'::time_type),
  ('711.124097566', 'CLOSE'::time_type),
  ('711.124097566', 'OPEN'::time_type),
  ('711.124098115', 'CLOSE'::time_type),
  ('711.124098115', 'OPEN'::time_type),
  ('711.124098151', 'CLOSE'::time_type),
  ('711.124098151', 'OPEN'::time_type),
  ('711.124107593', 'CLOSE'::time_type),
  ('711.124107593', 'OPEN'::time_type),
  ('711.124107594', 'CLOSE'::time_type),
  ('711.124107594', 'OPEN'::time_type)
);

-- 30 rows -> NULL
UPDATE prop_markets_index SET season_year = NULL
WHERE source_id = 'FANDUEL'
  AND season_year IN (1000,1250,1500,1900,2000,4000,4500,5000)
  AND (source_market_id, time_type) IN (
  ('711.100224344', 'CLOSE'::time_type),
  ('711.100224344', 'OPEN'::time_type),
  ('711.100224373', 'CLOSE'::time_type),
  ('711.100224373', 'OPEN'::time_type),
  ('711.100224492', 'CLOSE'::time_type),
  ('711.100224492', 'OPEN'::time_type),
  ('711.105586756', 'CLOSE'::time_type),
  ('711.105586756', 'OPEN'::time_type),
  ('711.105587210', 'CLOSE'::time_type),
  ('711.105587210', 'OPEN'::time_type),
  ('711.105587456', 'CLOSE'::time_type),
  ('711.105587456', 'OPEN'::time_type),
  ('711.107668538', 'CLOSE'::time_type),
  ('711.107668538', 'OPEN'::time_type),
  ('711.107668676', 'CLOSE'::time_type),
  ('711.107668676', 'OPEN'::time_type),
  ('711.107668740', 'CLOSE'::time_type),
  ('711.107668740', 'OPEN'::time_type),
  ('711.109979716', 'CLOSE'::time_type),
  ('711.109979716', 'OPEN'::time_type),
  ('711.109979742', 'CLOSE'::time_type),
  ('711.109979742', 'OPEN'::time_type),
  ('711.109979780', 'CLOSE'::time_type),
  ('711.109979780', 'OPEN'::time_type),
  ('711.98493359', 'CLOSE'::time_type),
  ('711.98493359', 'OPEN'::time_type),
  ('711.98493367', 'CLOSE'::time_type),
  ('711.98493367', 'OPEN'::time_type),
  ('711.98493371', 'CLOSE'::time_type),
  ('711.98493371', 'OPEN'::time_type)
);

-- Post-conditions. Each is a PROPERTY the repair must establish, asserted over
-- the repaired population rather than a restatement of the values above.

-- The 37 markets this file repairs, named once so the two post-conditions
-- below cannot drift apart. ON COMMIT DROP: it lives and dies inside
-- db-exec.sh's single transaction and leaves nothing behind.
CREATE TEMP TABLE repaired_markets (source_market_id varchar(255)) ON COMMIT DROP;
INSERT INTO repaired_markets (source_market_id) VALUES
  ('711.100224344'),
  ('711.100224373'),
  ('711.100224492'),
  ('711.105586756'),
  ('711.105587210'),
  ('711.105587456'),
  ('711.106975947'),
  ('711.107668538'),
  ('711.107668676'),
  ('711.107668740'),
  ('711.109979716'),
  ('711.109979742'),
  ('711.109979780'),
  ('711.111937298'),
  ('711.123260801'),
  ('711.123262815'),
  ('711.124097509'),
  ('711.124097566'),
  ('711.124098115'),
  ('711.124098151'),
  ('711.124107593'),
  ('711.124107594'),
  ('711.94422420'),
  ('711.94422634'),
  ('711.94838348'),
  ('711.94838612'),
  ('711.95553830'),
  ('711.95554088'),
  ('711.98493359'),
  ('711.98493367'),
  ('711.98493371'),
  ('734.94248482'),
  ('734.94248696'),
  ('734.94664430'),
  ('734.94664694'),
  ('734.95379883'),
  ('734.95380141');

DO $$
DECLARE
  implausible_rows integer;
  rows_2024 integer;
  rows_2025 integer;
  rows_null integer;
  misassigned integer;
  total_rows integer;
BEGIN
  -- (1) No row anywhere in the table still carries a season outside the range
  -- the NFL has ever played. Deliberately scoped to the WHOLE table, not to the
  -- keys this file names: a threshold-as-season written under some other id
  -- would be the same defect and should stop this apply.
  SELECT count(*) INTO implausible_rows
  FROM prop_markets_index
  WHERE season_year IS NOT NULL AND (season_year < 2015 OR season_year > 2030);

  IF implausible_rows <> 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: % prop_markets_index rows still carry an implausible season_year', implausible_rows;
  END IF;

  -- (2) The 37 repaired markets landed on the partition the shipped parser
  -- produced: 13 markets (26 rows) at 2024, 9 markets (18 rows) at 2025, and
  -- 15 markets (30 rows) at NULL because their names carry no season at all.
  SELECT count(*),
         count(*) FILTER (WHERE season_year = 2024),
         count(*) FILTER (WHERE season_year = 2025),
         count(*) FILTER (WHERE season_year IS NULL)
    INTO total_rows, rows_2024, rows_2025, rows_null
  FROM prop_markets_index
  WHERE source_id = 'FANDUEL'
    AND source_market_id IN (
      SELECT source_market_id FROM repaired_markets
    );

  IF total_rows <> 74 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: expected 74 rows across the 37 repaired markets, found %', total_rows;
  END IF;

  IF rows_2024 <> 26 OR rows_2025 <> 18 OR rows_null <> 30 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: partition is 2024=%, 2025=%, NULL=%; expected 26/18/30', rows_2024, rows_2025, rows_null;
  END IF;

  -- (3) Each row that received a season NAMES that season. Check (2) asserts
  -- the SIZE of each bucket, which given the three UPDATEs follows arithmetically
  -- from the key-list lengths -- so swapping one market from the 2024 list into
  -- the 2025 list and another the other way leaves 26/18/30 intact and two
  -- markets wrong. This asserts ASSIGNMENT instead, and it is deliberately not a
  -- second spelling of the parser's regex: it asks only whether the four digits
  -- written into the column appear anywhere in the market name, which no
  -- transposition can satisfy ("...Receiving Yards 2024-25" does not contain
  -- "2025"). True for all 44 year-assigned rows.
  SELECT count(*) INTO misassigned
  FROM prop_markets_index
  WHERE source_id = 'FANDUEL'
    AND season_year IS NOT NULL
    AND source_market_id IN (
      SELECT source_market_id FROM repaired_markets
    )
    AND position(season_year::text in source_market_name) = 0;

  IF misassigned <> 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: % repaired rows carry a season that does not appear in their own market name', misassigned;
  END IF;

  RAISE NOTICE 'OK: 74 rows repaired -- 26 to 2024, 18 to 2025, 30 to NULL; zero implausible seasons remain table-wide';
END $$;
