-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Clear receiving_yards and pass_yards from the 16 nfl_plays rows that record an
-- INCOMPLETE pass while carrying yardage for it.
--
-- Owner: user:task/league/wire-settlement-output-data-checks.md
--
-- THE ROWS ARE GENUINELY INCOMPLETIONS, established from nfl_play_stats rather
-- than assumed. All 16 carry stat_id 14 (pass incomplete) and NOT ONE carries
-- stat_id 15 (pass complete); several also carry 85 (pass defensed). So
-- is_completion is the correct column and the yardage is the wrong one -- which
-- matters, because the obvious alternative repair (flip is_completion to true)
-- would invent 16 receptions that never happened.
--
-- THE TARGET STATE IS THE CONVENTION THE OTHER 23,430 INCOMPLETIONS ALREADY
-- HOLD, not a value invented here: an incompletion carries pass_yards = 0 and
-- receiving_yards NULL. Every one of those 23,430 rows carries pass_yards
-- exactly 0 -- min 0, max 0, none non-zero -- so longest-completion markets are
-- not systematically inflated and only these 16 are anomalous.
--
-- AN INDEPENDENT ORACLE CONFIRMS THE DIRECTION. player_gamelogs is derived from
-- nfl_play_stats rather than from these columns (scripts/generate-player-gamelogs.mjs
-- reads nfl_plays only for a role-pid fallback), so it is a second opinion here.
-- For Cade Otton in esbid 2023123109 the gamelog records 2 receptions for 10
-- yards; summing nfl_plays.receiving_yards for him in that game gives 26 today
-- and 10 once these rows are cleared. The repaired side matches the gamelog
-- exactly. Gamelogs are therefore already correct and need no re-derivation.
--
-- WHAT THIS REPAIR CHANGES DOWNSTREAM: 8 graded prop selections across 2
-- markets, measured by re-running the prop-market-graded-metric-recompute check
-- with these rows excluded from its truth aggregation.
--
--   FANDUEL 734.80182131  GAME_LONGEST_RECEPTION           esbid 2023123109
--     CADE-OTTO-015249    stored 16.0 -> 6    (OPEN and CLOSE, 2 selections each)
--   FANDUEL 734.80191068  GAME_PASSING_LONGEST_COMPLETION  esbid 2023123105
--     AIDA-OCON-007812    stored 48.0 -> 24   (OPEN and CLOSE, 2 selections each)
--
-- Only 2 of the 16 rows move a grade at all, because these are MAX arms: a
-- phantom play changes the answer only when it is the largest one.
--
-- THIS FILE DOES NOT RE-SETTLE THOSE MARKETS. Clearing the plays leaves the 8
-- selections holding metrics derived from data that no longer exists, which is
-- exactly the state prop-market-graded-metric-recompute exists to report -- so
-- after this file lands that check is RED on 8 rows until a forced re-settle
-- (missing_only false) rewrites them. That sequencing is deliberate: it makes
-- the repair visible to the detector rather than silently consistent.
--
-- THE CAUSE IS NOT FIXED IN CODE, and this file does not pretend otherwise. The
-- provenance differs by era -- the 2021-2025 rows carry stat_ids 112 and 115
-- (air yards) alongside the incompletion while the 2002 rows carry stat_id 14
-- alone, so no single enrichment path explains all 16. At 16 rows across 25
-- seasons the recurrence rate does not justify guessing at the writer; the
-- shape is recorded on user:text/league/data-quality-and-validation.md so a
-- later reader meeting a 17th has the pattern.

update nfl_plays
   set receiving_yards = null,
       pass_yards = 0
 where is_completion is false
   and receiving_yards is not null;
