-- Normalise player_changelog.injury_status case fragmentation.
--
-- Pre-normaliser-era ingestion wrote mixed-case values (Out / Questionable /
-- Doubtful / Sus) alongside the SCREAMING_SNAKE values current ingestion uses.
-- Any string-equality join on `new` / `prev` silently miscounts. Audit
-- (2026-05-23) found 10,888 mixed-case rows: 4,080 distinct values in `new`
-- and ~10,250 in `prev`, fully overlapping the canonical OUT/QUESTIONABLE/
-- DOUBTFUL/SUS set.
--
-- Snapshot is scoped to the affected rows only (not the full ~250k-row
-- changelog) so revert is cheap. Revert: UPDATE player_changelog SET new =
-- s.new, prev = s.prev FROM player_changelog_injury_status_snapshot_2026_05_23 s
-- WHERE player_changelog.uid = s.uid;

CREATE TABLE player_changelog_injury_status_snapshot_2026_05_23 AS
SELECT *
FROM player_changelog
WHERE prop = 'injury_status'
  AND (new IS DISTINCT FROM UPPER(new) OR prev IS DISTINCT FROM UPPER(prev));

UPDATE player_changelog
SET new = UPPER(new),
    prev = UPPER(prev)
WHERE prop = 'injury_status'
  AND (new IS DISTINCT FROM UPPER(new) OR prev IS DISTINCT FROM UPPER(prev));
