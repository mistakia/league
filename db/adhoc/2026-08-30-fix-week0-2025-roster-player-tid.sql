-- STATUS: APPLIED 2026-08-30 against league_production
--
-- Correct the two rosters_players rows in league 1 whose denormalized `tid`
-- contradicts the `tid` on the roster row they belong to. These are the ONLY
-- two such rows in the whole table -- the population query is at the bottom of
-- this header -- and both sit at (lid=1, week=0, season_year=2025, slot=11).
--
--   roster_id 9262  JARE-GOFF-002009   tid 9 -> 2  (roster 9262 is team 2's)
--   roster_id 9267  MARK-ANDR-027703   tid 7 -> 9  (roster 9267 is team 9's)
--
-- WHY THE ROSTER ROW IS RIGHT AND rp.tid IS THE OUTLIER. `rosters_players.tid`
-- is not independent of the roster it hangs off: every writer derives BOTH the
-- roster_id and the tid from the same roster row, and libs-shared/roster.mjs
-- emits them together from one Roster instance (`get rosters_players`). The
-- legitimate "one player, two teams at week 0" state that 99f5b35ce documents
-- (week 0 is the offseason, a PERIOD -- ZAMI-WHIT-015750, 2022, tids 11 and 12)
-- is TWO rows on TWO rosters, each self-consistent. It is not one row whose tid
-- contradicts its own roster_id, which is what these two are. They are wrong
-- under every reading of the column.
--
-- EVIDENCE, JARE-GOFF-002009 (roster_id 9262, team 2 "Mayeday McMillions"):
--   - restricted_free_agency_nominations.nomination_id=105: original_team_id=2,
--     winning_bid_id=500, and bid 500 is team 2's OWN bid ($32). The auction was
--     won by the original team, so the player never moved.
--   - Team 9's only tie to Goff is losing bid 502 ($30, outcome 'matched').
--   - rosters_players 2025 weeks 1-17 are all tid 2, as is every 2024 week and
--     2026 week 0-1.
--   - transactions: every row across 2024, 2025 and 2026 is tid 2 (type 9
--     EXTENSION 2025-05-25, type 10 RESTRICTED_FREE_AGENCY_TAG 2025-06-09).
--   - roster_asset_holding: unbroken tid 2 since 2023-06-19, no tid 9 holding.
--
-- EVIDENCE, MARK-ANDR-027703 (roster_id 9267, team 9 "Is This Thing On?"):
--   - restricted_free_agency_nominations.nomination_id=133: original_team_id=9,
--     winning_bid_id=516, tid 9 ($7). Again won by the original team.
--   - Team 7 has NO relation to this player in ANY table: no bid in any season,
--     no trade, no poach, no waiver, no transaction row, ever. The stored 7 is
--     not an echo of any league event.
--   - rosters_players 2025 weeks 1-17 and 2026 weeks 0-1 are all tid 9.
--   - The 2024 history reads correctly once the numeric types are decoded
--     (libs-shared/constants/transaction-constants.mjs): the type 6 rows
--     alternating tid 1 and tid 9 are AUCTION_BID (player_salary is the
--     ascending bid ladder), NOT ownership; type 7 AUCTION_PROCESSED on tid 1
--     settles it; and the week-4 type 4 TRADE is trades.trade_id=227
--     (propose_tid 1 -> accept_tid 9), which is what actually moved him to
--     team 9 for weeks 4-17.
--
-- HOW THEY GOT THIS WAY: not established, and NOT reproducible from any current
-- writer. Every insert and update path was read: generate-rosters.mjs (rollover
-- takes tid off the source roster), process-restricted-free-agency-bid.mjs
-- (only the !isOriginalTeam branch writes rosters_players, and BOTH of these
-- auctions were won by the ORIGINAL team, so that branch never ran -- also true
-- of the June-2025 process-transition-bid.mjs that preceded the rename),
-- process-extensions.mjs (writes transactions only), the trade, poach, waiver
-- and super-priority paths (no such rows exist for either player), and the
-- external roster sync (external_league_connections holds 0 rows, so it has
-- never run against an internal league). rosters_players carries no timestamp
-- and rosters.last_updated is NULL for both, so the write cannot be dated.
-- Most likely a one-off manual or since-replaced 2025 offseason write. There is
-- no live defect to fix alongside this, which is why this is a data repair and
-- not a code change.
--
-- Filed: user:task/league/advance-codebase-review-followups.md. Note that the
-- finding that surfaced these rows was written up as an external-fantasy-league
-- roster-sync defect; league 1 is hosted and that framing is wrong.
--
-- POST-EXECUTION -- three derived surfaces read rosters_players.tid directly and
-- were stale until rebuilt (each verified wrong beforehand, not assumed). All
-- three were run immediately after this file applied, and their corrected state
-- verified; they are recorded here because a future reader of this repair needs
-- to know the derived tier moves with it:
--
--   NODE_ENV=production node /root/league/scripts/generate-league-player-seasonlogs.mjs --lid 1 --year 2025
--     league_player_seasonlogs holds start_tid=9 (Goff) and start_tid=7
--     (Andrews) for 2025 with start_acquisition_type NULL; the script reads
--     week 0 keyed by tid. Keyed on (pid, season_year, lid), so the re-run
--     corrects in place.
--
--   NODE_ENV=production node /root/league/scripts/generate-league-team-player-seasonlogs.mjs --lid 1 --year 2025
--     league_team_player_seasonlogs holds PHANTOM rows (lid 1, tid 9, Goff,
--     2025, weeks_rostered=1, is_start_team=true) and (lid 1, tid 7, Andrews,
--     2025, is_start_team=true), while the true tid 2 / tid 9 rows read
--     is_start_team=false. This script DELETEs the (lid, year, league_format_id)
--     slice before inserting, so the phantom rows are removed by the re-run.
--
--   NODE_ENV=production node /root/league/scripts/generate-roster-asset-lineage.mjs --lid 1
--     roster_asset_holding tid is transaction-driven and was already correct,
--     but its week counters index rosters_players by `tid__pid__year`, so the
--     misfiled week-0 row was uncounted: each player's 2025 holding read
--     weeks_active=17 and now reads 18. Note there is no `--rebuild` flag,
--     which two earlier adhoc headers in this directory still prescribe; the
--     script rebuilds the league it is given. `--year` is NOT the right scope
--     here either -- it filters draft holdings only, not player holdings.
--
-- Rosters, lineups and standings need nothing: get-roster.mjs keys on
-- roster_id and ignores rp.tid entirely, which is why this was invisible in the
-- app. The data-view columns that read rp.tid (team name, own-team filter,
-- extended-salary join) compute on read and self-correct.
--
-- Verification, expected to return zero rows after this file and forever after:
--
--   SELECT rp.roster_id, rp.pid, rp.tid AS rp_tid, r.tid AS roster_tid
--     FROM rosters_players rp
--     JOIN rosters r ON r.roster_id = rp.roster_id
--    WHERE rp.tid IS DISTINCT FROM r.tid
--       OR rp.week IS DISTINCT FROM r.week
--       OR rp.season_year IS DISTINCT FROM r.season_year
--       OR rp.lid IS DISTINCT FROM r.lid;

-- db:exec wraps this file in a single transaction; no explicit BEGIN here.

DO $$
DECLARE
  goff_updated integer;
  andrews_updated integer;
BEGIN
  -- Every guard is load-bearing: each predicate pins a value read off the row
  -- today, so a row that has already been repaired, or that is not the row this
  -- file was written against, updates nothing and trips the assertion below
  -- rather than being silently rewritten.
  UPDATE public.rosters_players
     SET tid = 2
   WHERE roster_id = 9262
     AND pid = 'JARE-GOFF-002009'
     AND lid = 1
     AND week = 0
     AND season_year = 2025
     AND tid = 9;
  GET DIAGNOSTICS goff_updated = ROW_COUNT;

  UPDATE public.rosters_players
     SET tid = 9
   WHERE roster_id = 9267
     AND pid = 'MARK-ANDR-027703'
     AND lid = 1
     AND week = 0
     AND season_year = 2025
     AND tid = 7;
  GET DIAGNOSTICS andrews_updated = ROW_COUNT;

  IF goff_updated <> 1 OR andrews_updated <> 1 THEN
    RAISE EXCEPTION
      'expected exactly one row per repair, got goff=% andrews=%; rolling back',
      goff_updated, andrews_updated;
  END IF;

  RAISE NOTICE 'repaired rosters_players.tid: goff=% andrews=%',
    goff_updated, andrews_updated;
END $$;

-- Post-condition inside the same transaction: if any (lid=1, season_year=2025)
-- row still disagrees with its roster, the repair did not achieve what it
-- claims and the whole file rolls back.
DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT count(*)
    INTO remaining
    FROM public.rosters_players rp
    JOIN public.rosters r ON r.roster_id = rp.roster_id
   WHERE rp.tid IS DISTINCT FROM r.tid
      OR rp.week IS DISTINCT FROM r.week
      OR rp.season_year IS DISTINCT FROM r.season_year
      OR rp.lid IS DISTINCT FROM r.lid;

  IF remaining <> 0 THEN
    RAISE EXCEPTION
      '% rosters_players row(s) still disagree with their roster; rolling back',
      remaining;
  END IF;
END $$;
