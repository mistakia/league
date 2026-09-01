-- STATUS: PENDING
--
-- Void 18 PrizePicks prop selection rows that carry a settled result graded
-- against a game the bet was never offered on. Each row's market had its
-- prop_markets_index esbid stamp move between the OPEN and CLOSE snapshots
-- (the cause, fixed in league aa5e43baa and deployed at 500fe711d), and
-- settlement ran while the row still held the earlier stamp. Every stored
-- metric therefore reproduces the OPEN game's gamelog exactly. That agreement
-- is the corruption, not evidence for it.
--
-- Owner: user:task/league/adjudicate-drifted-prop-market-settlements.md
--
-- ONE REMEDY, NOT TWO. The task entity describes two classes needing opposite
-- treatments -- 16 no-shows to void, and Amari Cooper's 2 rows to be repointed
-- to 2024102002 and re-settled because he was traded and played that game
-- instead. THAT SPLIT IS WRONG and this file deliberately does not implement
-- it. See "Why Cooper is a void" below. All 18 rows are the same condition and
-- take the same remedy.
--
-- WHY CANCELLED. A prop on a player who does not dress is refunded by the book,
-- so CANCELLED is the settled state these rows should carry. The alternative --
-- leaving a stale LOST/WON pair that happens to read plausibly -- is a wrong
-- answer that nothing downstream can distinguish from a right one. CANCELLED
-- and CASHED_OUT currently hold ZERO rows of 1.96M settled, so this gives
-- CANCELLED its first real occurrence.
--
-- WHY NOT NULL THE RESULT. No writer sets is_market_settled back to false, so a
-- nulled row would sit settled-but-ungraded forever. CANCELLED is a terminal
-- state the settlement path already understands.
--
-- THE DNP ORACLE IS nfl_snaps, NOT GAMELOG ABSENCE. The postseason has zero
-- is_active = false gamelog rows in any season 2023-2025 against 24,901 in the
-- regular season, so "no gamelog row" cannot distinguish a no-show from a
-- player who dressed and recorded nothing. Estime and Flowers are both in POST
-- games. Every row below was verified as zero nfl_snaps rows in the CLOSE game,
-- in games carrying 92 to 96 players with snaps, with BOTH teams represented
-- (verified per team: DEN 55, BAL 39, WAS 47, CLE 50). All four players carry a
-- non-null gsis_it_player_id with a live career snap history (Cooper 8,301
-- rows, Moore 5,429, Flowers 2,819, Estime 583), so the snap test is live for
-- them rather than vacuously true against a null id.
--
-- WHY COOPER IS A VOID AND NOT A REPOINT. This is the correction to the task
-- entity, and it rests on evidence that did not exist when that plan was
-- written -- nfl_games.prizepicks_game_id, the crosswalk the stamping fix
-- added.
--
--   Market 3183167 carries source_event_id NFL_game_qbzEcOZGh3n9g1eWPzfQYQvr on
--   BOTH its rows. That id resolves through the crosswalk to esbid 2024102003,
--   CIN at CLE, week 7 -- exactly what the CLOSE row already holds. PrizePicks
--   is saying this market was offered on the Cleveland game. Our OPEN stamp
--   (2024101305, CLE at PHI, week 6) is the side that moved.
--
--   db/checks/registry.mjs is explicit that the vendor's event is the oracle
--   here and forbids rewriting an esbid to a game the vendor never named.
--   Repointing 3183167 to 2024102002 would do precisely that.
--
--   Cooper was traded and did not play CIN at CLE -- zero snaps in a game
--   covering 96 players. He is a no-show on the game his market was offered on,
--   which is the same condition as the other 16.
--
--   AND THE RESULT THE TASK WANTED TO RECOVER ALREADY EXISTS. PrizePicks posted
--   a SEPARATE market cluster for Cooper on TEN at BUF (source_event_id
--   NFL_game_tU6n4Ij3Z0dYiqRmGtMBo1YT, observed 2024-10-20): market 3198982
--   receiving yards at a 35.5 line, already settled OVER = WON at metric 66.0,
--   plus receptions, longest reception and PPR markets on the same game.
--   Repointing 3183167 onto 2024102002 would have manufactured a SECOND
--   receiving-yards result for one player in one game, at a line PrizePicks
--   never offered for it. Voiding discards nothing: the recoverable result is
--   already recorded, on the market the book actually opened.
--
-- SCOPE. Selection rows only. The prop_markets_index esbid stamps are left
-- alone: repointing this one market's OPEN row would drop the coherence check's
-- count by 1 out of 9,160 for no systematic reason. The crosswalk now makes a
-- systematic adjudication of all 9,160 against the vendor's own event id
-- possible for the first time, and that belongs in its own pass.
--
-- OUT OF SCOPE, named so the outcome is not overclaimed: 204 settled rows with
-- a null selection_pid (169 carrying a stored metric), 10,196 settled rows in
-- gamelog markets with a null esbid, and 701 PrizePicks markets (1,340 index
-- rows) carrying a null source_event_id, which no event-id-keyed repair reaches.
--
-- PRE-IMAGE of all 18 rows. source_id PRIZEPICKS and time_type CLOSE
-- throughout; the four-part key is (source_id, source_market_id,
-- source_selection_id, time_type).
--
--   player          market    selection            type   line  result  metric
--   --------------  --------  -------------------  -----  ----  ------  ------
--   Amari Cooper    3183167   3183167-over         OVER   50.5  LOST    42.0
--   Amari Cooper    3183167   3183167-under        UNDER  50.5  WON     42.0
--   Audric Estime   3595838   3595838-over         OVER   22.5  WON     34.0
--   Audric Estime   3595838   3595838-under        UNDER  22.5  LOST    34.0
--   Audric Estime   3596235   3596235-over         OVER   39.5  LOST    34.0
--   Audric Estime   3596235   3596235-under        UNDER  39.5  WON     34.0
--   Audric Estime   3598180   3598180-over         OVER   19.5  WON     34.0
--   Audric Estime   3598180   3598180-under        UNDER  19.5  LOST    34.0
--   Audric Estime   3598181   3598181-over         OVER   29.5  WON     34.0
--   Audric Estime   3598181   3598181-under        UNDER  29.5  LOST    34.0
--   Audric Estime   3598364   3598364-over         OVER    0.5  WON      1.0
--   Audric Estime   3598364   3598364-under        UNDER   0.5  LOST     1.0
--   Audric Estime   3598542   3598542-over         OVER    5.5  WON     12.0
--   Audric Estime   3598542   3598542-under        UNDER   5.5  LOST    12.0
--   Chris Moore     6488579   6488579-over         OVER    0.5  LOST     0.0
--   Chris Moore     6488579   6488579-under        UNDER   0.5  WON      0.0
--   Zay Flowers     3595901   3595901-over         OVER    0.5  LOST     0.0
--   Zay Flowers     3595901   3595901-under        UNDER   0.5  WON      0.0
--
-- Each stored metric reproduces the OPEN game's gamelog exactly, verified row
-- by row:
--   Cooper  OPEN 2024101305 CLE at PHI wk6  -- 42 receiving yards
--   Estime  OPEN 2025010504 KC at DEN wk18  -- 34 rushing yards, 12 attempts, 1 TD
--   Moore   OPEN 2025090707 NYG at WAS wk1  -- 0 touchdowns
--   Flowers OPEN 2025010400 CLE at BAL wk18 -- 0 touchdowns
--
-- And the CLOSE game each was graded away from:
--   Cooper  CLOSE 2024102003 CIN at CLE  wk7      -- traded, did not play
--   Estime  CLOSE 2025011200 DEN at BUF  POST wk1 -- did not play
--   Moore   CLOSE 2025091100 WAS at GB   wk2      -- did not play
--   Flowers CLOSE 2025011101 PIT at BAL  POST wk1 -- did not play
--
-- Revert, restoring every row to the pre-image above:
--
--   UPDATE prop_market_selections_index AS s
--   SET selection_result = v.selection_result::wager_status,
--       metric_result_value = v.metric_result_value
--   FROM (VALUES
--     ('3183167','3183167-over','LOST',42.0), ('3183167','3183167-under','WON',42.0),
--     ('3595838','3595838-over','WON',34.0),  ('3595838','3595838-under','LOST',34.0),
--     ('3596235','3596235-over','LOST',34.0), ('3596235','3596235-under','WON',34.0),
--     ('3598180','3598180-over','WON',34.0),  ('3598180','3598180-under','LOST',34.0),
--     ('3598181','3598181-over','WON',34.0),  ('3598181','3598181-under','LOST',34.0),
--     ('3598364','3598364-over','WON',1.0),   ('3598364','3598364-under','LOST',1.0),
--     ('3598542','3598542-over','WON',12.0),  ('3598542','3598542-under','LOST',12.0),
--     ('6488579','6488579-over','LOST',0.0),  ('6488579','6488579-under','WON',0.0),
--     ('3595901','3595901-over','LOST',0.0),  ('3595901','3595901-under','WON',0.0)
--   ) AS v(source_market_id, source_selection_id, selection_result, metric_result_value)
--   WHERE s.source_id = 'PRIZEPICKS'
--     AND s.time_type = 'CLOSE'
--     AND s.source_market_id = v.source_market_id
--     AND s.source_selection_id = v.source_selection_id;

UPDATE prop_market_selections_index AS s
SET selection_result = 'CANCELLED',
    metric_result_value = NULL
FROM (VALUES
  ('3183167', '3183167-over'),
  ('3183167', '3183167-under'),
  ('3595838', '3595838-over'),
  ('3595838', '3595838-under'),
  ('3596235', '3596235-over'),
  ('3596235', '3596235-under'),
  ('3598180', '3598180-over'),
  ('3598180', '3598180-under'),
  ('3598181', '3598181-over'),
  ('3598181', '3598181-under'),
  ('3598364', '3598364-over'),
  ('3598364', '3598364-under'),
  ('3598542', '3598542-over'),
  ('3598542', '3598542-under'),
  ('6488579', '6488579-over'),
  ('6488579', '6488579-under'),
  ('3595901', '3595901-over'),
  ('3595901', '3595901-under')
) AS v(source_market_id, source_selection_id)
WHERE s.source_id = 'PRIZEPICKS'
  AND s.time_type = 'CLOSE'
  AND s.source_market_id = v.source_market_id
  AND s.source_selection_id = v.source_selection_id;
