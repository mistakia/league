-- Clear espn_id hijack on Sr Isaiah Johnson (Georgia Tech FS,
-- ISAI-JOHN-2015-1992-05-16). The espn_id 3126182 actually belongs to
-- Houston CB Isaiah Johnson (Sleeper 5951, gsisid 00-0034980, b. 1995-12-20).
-- Clear the value here so the next ESPN import can re-attach it to the
-- correct relative; the new name-fallback hijack guard in updatePlayer
-- now prevents another silent overwrite if the wrong pid is matched.
-- Discovered during the 2026-05-24 deferred-pid-mixup pass; logged in
-- task #10 follow-up.

INSERT INTO player_changelog (pid, prop, prev, new, timestamp)
SELECT pid, 'espn_id', espn_id::text, NULL, EXTRACT(EPOCH FROM NOW())::int
FROM player
WHERE pid = 'ISAI-JOHN-2015-1992-05-16'
  AND espn_id = 3126182;

UPDATE player
SET espn_id = NULL
WHERE pid = 'ISAI-JOHN-2015-1992-05-16'
  AND espn_id = 3126182;

SELECT pid, fname, lname, dob, espn_id FROM player WHERE pid = 'ISAI-JOHN-2015-1992-05-16';
