-- Rewrite the originator (otid) and current-holder (tid) columns of the 2026
-- rookie draft to reflect the corrected DOI ordering produced by the 2025 PPP
-- backfill (see text/home-dynasty-league/league-management/audits/ppp-2025-backfill-20260504.md).
--
-- Slot ranges for non-playoff teams reorder from [10, 5, 11, 9] to [5, 10, 11, 9]
-- in every round (P1-4, P11-14, P21-24). Slots P3-4, P13-14, P23-24 are unaffected
-- because tids 11 and 9 keep their relative DOI ranks. Only the swap of tids 10
-- and 5 propagates: P1<->P2, P11<->P12, P21<->P22.
--
-- Trade chain (whoever currently holds team X's pick continues to hold it):
--   R1 P1 (Lil Chef's R1 pick): own pick. R1 P2 (PurDoodies R1): own pick.
--     -> swap moves both originator and holder.
--   R2 P11 (Lil Chef R2): own pick. R2 P12 (PurDoodies R2): held by tid 7.
--     -> after swap: P11 otid=5 tid=7; P12 otid=10 tid=10.
--   R3 P21 (Lil Chef R3): held by tid 1. R3 P22 (PurDoodies R3): held by tid 1.
--     -> after swap: P21 otid=5 tid=1; P22 otid=10 tid=1.

UPDATE draft SET otid = 5,  tid = 5  WHERE lid = 1 AND year = 2026 AND round = 1 AND pick = 1;
UPDATE draft SET otid = 10, tid = 10 WHERE lid = 1 AND year = 2026 AND round = 1 AND pick = 2;

UPDATE draft SET otid = 5,  tid = 7  WHERE lid = 1 AND year = 2026 AND round = 2 AND pick = 11;
UPDATE draft SET otid = 10, tid = 10 WHERE lid = 1 AND year = 2026 AND round = 2 AND pick = 12;

UPDATE draft SET otid = 5,  tid = 1  WHERE lid = 1 AND year = 2026 AND round = 3 AND pick = 21;
UPDATE draft SET otid = 10, tid = 1 WHERE lid = 1 AND year = 2026 AND round = 3 AND pick = 22;
