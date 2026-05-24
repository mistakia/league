-- Fix Frank Gore Sr / Frank Gore Jr player record mixup
--
-- Current state in `player`:
--   FRAN-GORE-2005-1983-05-14  Frank   Gore       pff_id=121457  -- Sr (wrong pff_id, that's Jr's)
--   FRAN-GORE-2024-2002-03-13  Frank   Gore Jr.   pff_id=NULL    -- Jr canonical (no external IDs except pfr_id)
--   FRAN-GORE-2024-0000-00-00  Franklin Gore      pff_id=NULL    -- Jr duplicate stub created by plays importer
--
-- Authoritative PFF IDs (verified via pff.com URLs):
--   Sr -> 2282        (pff.com/nfl/players/frank-gore/2282)
--   Jr -> 121457      (pff.com/nfl/players/frank-gore/121457)
--
-- This file:
--   1. Repoints stub references in nfl_plays / player_gamelogs / player_changelog to Jr canonical.
--   2. Backfills Jr canonical with the stub's gsisid + esbid.
--   3. Deletes the stub player row.
--   4. Moves the 2025 pff_player_seasonlogs row from Sr to Jr.
--   5. Reassigns pff_id: clear Sr first (unique index), set Jr=121457, then set Sr=2282.
--   6. Adds "Franklin Gore" alias to Jr canonical so future "Franklin" lookups resolve correctly.

-- 1. Repoint stub references in nfl_plays
UPDATE nfl_plays SET bc_pid='FRAN-GORE-2024-2002-03-13'         WHERE bc_pid='FRAN-GORE-2024-0000-00-00';
UPDATE nfl_plays SET trg_pid='FRAN-GORE-2024-2002-03-13'        WHERE trg_pid='FRAN-GORE-2024-0000-00-00';
UPDATE nfl_plays SET player_fuml_pid='FRAN-GORE-2024-2002-03-13' WHERE player_fuml_pid='FRAN-GORE-2024-0000-00-00';

-- 2. Repoint stub references in player_gamelogs
UPDATE player_gamelogs SET pid='FRAN-GORE-2024-2002-03-13' WHERE pid='FRAN-GORE-2024-0000-00-00';

-- 3. Repoint stub references in player_changelog (history rows)
UPDATE player_changelog SET pid='FRAN-GORE-2024-2002-03-13' WHERE pid='FRAN-GORE-2024-0000-00-00';

-- 3a. Repoint stub references in ngs_prospect_scores_* (FK-protected tables)
UPDATE ngs_prospect_scores_history SET pid='FRAN-GORE-2024-2002-03-13' WHERE pid='FRAN-GORE-2024-0000-00-00';
UPDATE ngs_prospect_scores_index   SET pid='FRAN-GORE-2024-2002-03-13' WHERE pid='FRAN-GORE-2024-0000-00-00';

-- 4. Delete the stub player row first (frees its gsisid/esbid for the unique indexes)
DELETE FROM player WHERE pid='FRAN-GORE-2024-0000-00-00';

-- 5. Backfill Jr canonical with the stub's NFL external IDs
UPDATE player
SET gsisid = COALESCE(gsisid, '00-0039471'),
    esbid  = COALESCE(esbid,  'GOR415561')
WHERE pid='FRAN-GORE-2024-2002-03-13';

-- 6. Move 2025 PFF seasonlog row from Sr to Jr canonical
--    Defensive: clear any pre-existing Jr 2025 row first (none expected) to avoid pk collision.
DELETE FROM pff_player_seasonlogs WHERE pid='FRAN-GORE-2024-2002-03-13' AND year=2025;
UPDATE pff_player_seasonlogs
SET pid='FRAN-GORE-2024-2002-03-13'
WHERE pid='FRAN-GORE-2005-1983-05-14' AND year=2025;

-- 7. Reassign player.pff_id values respecting the unique index on player.pff_id
UPDATE player SET pff_id=NULL   WHERE pid='FRAN-GORE-2005-1983-05-14';   -- clear Sr first
UPDATE player SET pff_id=121457 WHERE pid='FRAN-GORE-2024-2002-03-13';   -- Jr correct
UPDATE player SET pff_id=2282   WHERE pid='FRAN-GORE-2005-1983-05-14';   -- Sr correct

-- 8. Add "Franklin Gore" alias to Jr canonical
INSERT INTO player_aliases (pid, formatted_alias)
SELECT 'FRAN-GORE-2024-2002-03-13', 'franklin gore'
WHERE NOT EXISTS (
  SELECT 1 FROM player_aliases
  WHERE pid='FRAN-GORE-2024-2002-03-13' AND formatted_alias='franklin gore'
);
