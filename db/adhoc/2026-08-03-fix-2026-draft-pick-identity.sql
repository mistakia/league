-- Restore the identity of league 1's 2026 rookie picks for teams 5 and 10.
--
-- db/adhoc/2026-05-04-rewrite-2026-rookie-draft-otid.sql applied the Potential
-- Points Penalty draft-order correction by rewriting (tid, otid) on rows
-- selected by (round, pick). `draft.uid` is a pick's stable identity and
-- `trades_picks.pickid` is the only reference to it, so keying on the slot
-- re-pointed each pickid at the other team's pick: the triples 278/279/280
-- (team 5) and 290/291/292 (team 10) swapped identities in all three rounds,
-- and every trades_picks row naming them has read as mis-keyed since.
--
-- The correct repair in May was to fix `teams.draft_order` and re-run
-- scripts/set-draft-pick-number.mjs, which derives pick/pick_str from
-- `draft.otid` keyed on `draft.uid`. teams.draft_order for league 1 2026 is
-- already correct (tid 5 at order 1, tid 10 at order 2), so the values below
-- are what that script would produce today.
--
-- Three independent discriminators establish that `draft` is the wrong side and
-- trades_picks is right:
--   1. generate-draft-picks.mjs inserts one row per team per round in teams-uid
--      order, so league 1's 2026 pickid triples run 1, 2, 4, ?, 6, 7, 9, ?, 11,
--      12 -- the 278 triple must be team 5 and the 290 triple must be team 10.
--   2. Accepted chains put 279 at origin 5 (trades 234, 247) and 280 at origin 5
--      (trades 287, 291); 292 at origin 10 (trade 300).
--   3. Unaccepted trades 271 and 299 offer 290, 291 and 292 with
--      trades_picks.tid = 10.
--
-- Slot-level ownership is IDENTICAL before and after: overall picks 1, 2, 11,
-- 12, 21 and 22 keep the same holding team. Only the pickid binding moves, so
-- no team gains or loses a pick. Safe to apply because no 2026 pick has been
-- selected -- pid and selection_timestamp are null on every row of rounds 1-3.
--
-- Every statement is keyed on draft.uid. Never key a draft correction on
-- (round, pick); that is the bug this file repairs.

-- The pick numbers are swapped WITHIN each round, and idx_draft_pick is unique
-- on (round, pick, lid, year), so a direct pairwise assignment collides on the
-- first statement. Park team 10's three picks on a NULL pick first (the index
-- treats NULLs as distinct), then land team 5's, then land team 10's.

BEGIN;

UPDATE draft SET pick = NULL, pick_str = NULL WHERE uid IN (290, 291, 292);

-- Team 5's picks: overall 1, and 11 held by team 7 (5 -> 11 -> 7), and 21 held
-- by team 1 (5 -> 11 -> 1).
UPDATE draft SET otid = 5, tid = 5, pick = 1,  pick_str = '1.1' WHERE uid = 278;
UPDATE draft SET otid = 5, tid = 7, pick = 11, pick_str = '2.1' WHERE uid = 279;
UPDATE draft SET otid = 5, tid = 1, pick = 21, pick_str = '3.1' WHERE uid = 280;

-- Team 10's picks: overall 2 and 12 untraded, 22 held by team 1 (10 -> 1).
UPDATE draft SET otid = 10, tid = 10, pick = 2,  pick_str = '1.2' WHERE uid = 290;
UPDATE draft SET otid = 10, tid = 10, pick = 12, pick_str = '2.2' WHERE uid = 291;
UPDATE draft SET otid = 10, tid = 1,  pick = 22, pick_str = '3.2' WHERE uid = 292;

COMMIT;

-- Applied to production 2026-08-03. Verified after: the six rows read
-- (278,5,5,1) (290,10,10,2) (279,5,7,11) (291,10,10,12) (280,5,1,21)
-- (292,10,1,22) as (uid, otid, tid, pick), and overall picks 1, 2, 11, 12, 21
-- and 22 hold the same teams as before the change.
