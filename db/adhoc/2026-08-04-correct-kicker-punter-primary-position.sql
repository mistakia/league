-- Correct kickers mislabelled as punters and vice versa
-- STATUS: APPLIED 2026-08-04 against league_production
--
-- Neither player.primary_position nor player_gamelogs.pos is authoritative on
-- K versus P. Measured against the play-stat oracle on rows where the two
-- columns disagree, player is right on 6,608 gamelog rows, player_gamelogs on
-- 1,739, and both are wrong on 2,763. nfl_plays.punter_pid is 100% NULL and
-- cannot serve.
--
-- The oracle is behavior, not either column: punt stat_ids (29-32, 37-40)
-- versus field-goal and extra-point stat_ids (44, 70-73), counted per player in
-- nfl_play_stats.
--
-- The 3:1 activity ratio is an abstention threshold, not a tuned one. It
-- declines to decide genuine two-way players -- Bradley Pinion at 1,247 punts
-- and 679 kicks, Pat McAfee at 1,032 and 404 -- who keep their current value.
-- 27 players abstain; the SELECT at the end of this file lists them so the
-- abstentions are visible in the apply output rather than silently dropped.
--
-- secondary_position follows primary_position only where it currently mirrors
-- it (48 of the 63). The other 15 already carry a different, independently
-- meaningful value and are left alone.

-- db:exec wraps the whole file in one transaction, so no explicit BEGIN here.

CREATE TEMPORARY TABLE kicker_punter_verdict ON COMMIT DROP AS
WITH kicking AS (
  SELECT s.gsis_player_id,
    count(*) FILTER (WHERE s.stat_id IN (29,30,31,32,37,38,39,40)) AS punt_stats,
    count(*) FILTER (WHERE s.stat_id IN (44,70,71,72,73)) AS kick_stats
  FROM public.nfl_play_stats s
  WHERE s.stat_id IN (29,30,31,32,37,38,39,40,44,70,71,72,73)
    AND s.gsis_player_id IS NOT NULL
  GROUP BY 1
)
SELECT p.pid, p.first_name, p.last_name, p.primary_position, p.secondary_position,
  k.punt_stats, k.kick_stats,
  CASE
    WHEN k.punt_stats >= 3 * greatest(k.kick_stats, 1) AND k.punt_stats > 0 THEN 'P'
    WHEN k.kick_stats >= 3 * greatest(k.punt_stats, 1) AND k.kick_stats > 0 THEN 'K'
  END AS oracle_position
FROM kicking k
JOIN public.player p ON p.gsis_player_id = k.gsis_player_id
WHERE p.primary_position IN ('K', 'P');

-- ------------------------------------------------------------ the 63 flips ---

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'player', 'primary_position', jsonb_build_object('pid', v.pid), v.primary_position, v.oracle_position
FROM kicker_punter_verdict v
WHERE v.oracle_position IS NOT NULL AND v.oracle_position <> v.primary_position;

INSERT INTO public.position_vocabulary_backfill_audit (table_name, column_name, row_key, old_value, new_value)
SELECT 'player', 'secondary_position', jsonb_build_object('pid', v.pid), v.secondary_position, v.oracle_position
FROM kicker_punter_verdict v
WHERE v.oracle_position IS NOT NULL AND v.oracle_position <> v.primary_position
  AND v.secondary_position = v.primary_position;

UPDATE public.player p SET secondary_position = v.oracle_position
FROM kicker_punter_verdict v
WHERE v.pid = p.pid AND v.oracle_position IS NOT NULL
  AND v.oracle_position <> v.primary_position
  AND v.secondary_position = v.primary_position;

UPDATE public.player p SET primary_position = v.oracle_position
FROM kicker_punter_verdict v
WHERE v.pid = p.pid AND v.oracle_position IS NOT NULL
  AND v.oracle_position <> v.primary_position;

-- --------------------------------------------------- abstentions, reported ---

SELECT v.pid, v.first_name, v.last_name, v.primary_position AS kept_position,
  v.punt_stats, v.kick_stats
FROM kicker_punter_verdict v
WHERE v.oracle_position IS NULL
ORDER BY v.punt_stats + v.kick_stats DESC;
