-- Clear stolen smart_player_id encodings from the player table
-- STATUS: APPLIED 2026-08-04 against league_production
--
-- `player.smart_player_id` is not an independent identifier. It is a UUID
-- template with a `gsis_player_id` hex-embedded at the offset `decode_id` reads
-- (scripts/import-plays-nfl-v1.mjs): 10,483 of the 10,897 player rows carrying
-- one decode to that same row's OWN gsis_player_id. The column therefore holds
-- no identity information that gsis_player_id does not already hold.
--
-- 36 rows hold an encoding of ANOTHER player's gsis id. Those are the whole
-- structural defect behind the 5,224 play-stat rows whose two identifiers
-- resolve to different people, and they include all six high-volume pairs
-- (Sterling/Steve Weatherford, Steve White/John Abraham, Benny/Benjamin Sapp,
-- Jake/Jason Ferguson, Lawrence Okoye/Nick Williams, James/Jarrett Brown).
--
-- The 36 split two ways, and BOTH halves are repaired here:
--   23  gsis_player_id IS NOT NULL, and the encoding names a different player
--   13  gsis_player_id IS NULL, so the stolen encoding is the row's ONLY
--       identifier -- the most damaging shape, and the one a
--       `gsis_player_id IS NOT NULL` filter silently drops
--
-- Deliberately NOT touched: 16 further rows whose encoding decodes to a gsis id
-- no player row owns. They are corrupt but inert -- they steal from nobody, so
-- clearing them would be churn rather than repair.
--
-- The repair is to NULL the value, not to re-encode the player's own gsis id.
-- Removing a false claim is honest; synthesizing a replacement would invent
-- data, and the end state for this column is to drop it entirely.
--
-- Not idempotent in the sense that a second run matches nothing -- which is the
-- point: the WHERE clause selects only rows that are still corrupt.
--
-- Paired with the guard added to scripts/update-player-gsispid.mjs in the same
-- commit. That script is the sole writer of this column, assigns by majority
-- vote over nfl_play_stats, and clears the value off whoever currently holds it
-- before assigning. It did NOT originate these rows (24 of the 36 have no
-- play-stat evidence to vote from), but it would have rewritten 10 of them on
-- its next run, which would have made this repair temporary.

BEGIN;

CREATE TEMPORARY TABLE stolen_smart_player_id_encodings AS
SELECT
  p.pid,
  p.formatted_name,
  p.gsis_player_id,
  p.smart_player_id,
  encode(
    decode(substring(replace(p.smart_player_id, '-', '') FROM 5 FOR 20), 'hex'),
    'escape'
  ) AS encoded_gsis_player_id
FROM player p
WHERE p.smart_player_id IS NOT NULL
  AND p.smart_player_id <> ''
  AND encode(
        decode(substring(replace(p.smart_player_id, '-', '') FROM 5 FOR 20), 'hex'),
        'escape'
      ) ~ '^[0-9]{2}-[0-9]{7}$'
  AND encode(
        decode(substring(replace(p.smart_player_id, '-', '') FROM 5 FOR 20), 'hex'),
        'escape'
      ) IS DISTINCT FROM p.gsis_player_id
  AND EXISTS (
    SELECT 1
    FROM player owner
    WHERE owner.gsis_player_id = encode(
            decode(substring(replace(p.smart_player_id, '-', '') FROM 5 FOR 20), 'hex'),
            'escape'
          )
      AND owner.pid <> p.pid
  );

-- Fail loudly rather than repairing a population that has moved. Measured 36 on
-- 2026-08-04; a different count means the underlying data changed and this file
-- needs re-deriving before it runs.
DO $$
DECLARE
  affected integer;
BEGIN
  SELECT count(*) INTO affected FROM stolen_smart_player_id_encodings;
  IF affected <> 36 THEN
    RAISE EXCEPTION
      'expected 36 stolen smart_player_id encodings, found %; re-derive before applying',
      affected;
  END IF;
END $$;

UPDATE player
SET smart_player_id = NULL
WHERE pid IN (SELECT pid FROM stolen_smart_player_id_encodings);

COMMIT;
