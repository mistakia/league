// Rebuild SQL for historical_injury_index. Source of truth lives in
// task/home-dynasty-league/build-historical-injury-index.md; this file
// is a transcription, kept in sync by hand.
//
// Parameter bindings: :start_year, :end_year. Bound via knex db.raw().

export const rebuild_sql = `
WITH reg_games AS (
  SELECT esbid, year, week,
         h AS home_team, v AS away_team,
         home_qb_pid, away_qb_pid, timestamp AS game_timestamp
  FROM nfl_games
  WHERE seas_type = 'REG' AND year BETWEEN :start_year AND :end_year
),
gl AS (
  SELECT pg.pid, pg.esbid, pg.year, pg.tm, pg.active,
         pg.snaps_off, pg.snaps_def, pg.snaps_st,
         pg.ruled_out_in_game,
         (COALESCE(pg.pa,0)+COALESCE(pg.ra,0)+COALESCE(pg.trg,0)
          +COALESCE(pg.rec,0)+COALESCE(pg.fgm,0)+COALESCE(pg.xpm,0)
          +COALESCE(pg.dsk,0)+COALESCE(pg.dint,0)+COALESCE(pg.dtno,0)) AS any_stat_count
  FROM player_gamelogs pg
  WHERE pg.year BETWEEN :start_year AND :end_year
),
practice_signal AS (
  SELECT pid, year, week,
         BOOL_OR(inj IS NOT NULL AND inj <> '') AS practice_listed_injury,
         BOOL_OR(UPPER(game_designation) IN ('OUT','DOUBTFUL','QUESTIONABLE')) AS practice_questionable_or_worse,
         MAX(UPPER(game_designation)) AS practice_designation
  FROM practice
  WHERE seas_type = 'REG'
  GROUP BY pid, year, week
),
changelog_signal AS (
  -- Asymmetric per-game window: -7d back, +3h forward. pc.changed_at is
  -- timestamptz; gm.timestamp is epoch seconds, bridged via to_timestamp().
  SELECT gl_inner.pid, gl_inner.esbid,
         BOOL_OR(pc.column_name = 'injury_status'
                 AND UPPER(pc.new_value) IN ('OUT','DOUBTFUL','IR','PUP','SUS','COV')) AS changelog_unavailable,
         BOOL_OR(pc.column_name = 'injury_status') AS changelog_injury_event,
         BOOL_OR(pc.column_name = 'nfl_status'
                 AND pc.new_value IN ('INJURED_RESERVE','PHYSICALLY_UNABLE_TO_PERFORM',
                                'SUSPENDED','NON_FOOTBALL_RELATED_INJURED_RESERVE',
                                'DID_NOT_REPORT')) AS changelog_nfl_reserve_event
  FROM player_gamelogs gl_inner
  JOIN nfl_games gm ON gm.esbid = gl_inner.esbid
  JOIN player_changelog pc
    ON pc.pid = gl_inner.pid
   AND pc.column_name IN ('injury_status','nfl_status','roster_status','status')
   AND pc.changed_at BETWEEN to_timestamp(gm.timestamp - 7*86400) AND to_timestamp(gm.timestamp + 3*3600)
  WHERE gl_inner.year BETWEEN :start_year AND :end_year AND gm.seas_type = 'REG'
  GROUP BY gl_inner.pid, gl_inner.esbid
),
team_spans AS (
  SELECT gl.pid, gl.year, gl.tm,
         MIN(g.game_timestamp) AS span_start,
         MAX(g.game_timestamp) AS span_end
  FROM gl JOIN reg_games g ON g.esbid = gl.esbid
  GROUP BY gl.pid, gl.year, gl.tm
),
schedule_spine AS (
  SELECT ts.pid, ts.year AS spine_year, g.week, g.esbid, ts.tm
  FROM team_spans ts
  JOIN reg_games g
    ON g.year = ts.year
   AND (g.home_team = ts.tm OR g.away_team = ts.tm)
   AND g.game_timestamp BETWEEN ts.span_start AND ts.span_end
)
SELECT
  s.pid,
  s.spine_year AS year,
  s.week,
  s.esbid,
  s.tm,
  CASE
    WHEN gl.pid IS NULL THEN false
    WHEN gl.snaps_off IS NULL AND gl.snaps_def IS NULL AND gl.snaps_st IS NULL
      THEN (gl.any_stat_count > 0)
    ELSE COALESCE(gl.snaps_off,0) + COALESCE(gl.snaps_def,0) + COALESCE(gl.snaps_st,0) > 0
  END AS played,
  CASE WHEN gl.pid IS NULL THEN NULL
       ELSE COALESCE(gl.snaps_off,0) + COALESCE(gl.snaps_def,0) + COALESCE(gl.snaps_st,0)
  END AS snap_count,
  gl.snaps_off, gl.snaps_def, gl.snaps_st,
  gl.active AS gamelog_active,
  gl.ruled_out_in_game,
  COALESCE(ps.practice_listed_injury, false) AS practice_listed_injury,
  COALESCE(ps.practice_questionable_or_worse, false) AS practice_questionable_or_worse,
  ps.practice_designation,
  COALESCE(cs.changelog_injury_event, false) AS changelog_injury_event,
  COALESCE(cs.changelog_unavailable, false) AS changelog_unavailable,
  COALESCE(cs.changelog_nfl_reserve_event, false) AS changelog_nfl_reserve_event,
  CASE
    WHEN gl.pid IS NULL                                                  THEN 'no-gamelog-row'
    WHEN gl.active = false                                               THEN 'inactive'
    WHEN cs.changelog_nfl_reserve_event                                  THEN 'reserve-list'
    WHEN gl.ruled_out_in_game                                            THEN 'in-game-injury'
    WHEN ps.practice_questionable_or_worse                               THEN 'practice-report-out'
    WHEN cs.changelog_unavailable                                        THEN 'changelog-out'
    WHEN (COALESCE(gl.snaps_off,0) + COALESCE(gl.snaps_def,0) + COALESCE(gl.snaps_st,0)) = 0
         AND gl.pid IS NOT NULL                                          THEN 'zero-snap'
    ELSE NULL
  END AS missed_reason,
  ( (CASE WHEN cs.changelog_injury_event   THEN 1 ELSE 0 END)
  + (CASE WHEN ps.practice_listed_injury    THEN 1 ELSE 0 END)
  + (CASE WHEN gl.active = false            THEN 1 ELSE 0 END)
  + (CASE WHEN gl.ruled_out_in_game         THEN 1 ELSE 0 END)
  ) AS source_concurrence,
  CASE
    WHEN s.spine_year < 2009 THEN 'low'
    WHEN s.spine_year < 2021 AND ( (CASE WHEN cs.changelog_injury_event THEN 1 ELSE 0 END)
                                 + (CASE WHEN ps.practice_listed_injury THEN 1 ELSE 0 END)
                                 + (CASE WHEN gl.active = false         THEN 1 ELSE 0 END)
                                 + (CASE WHEN gl.ruled_out_in_game      THEN 1 ELSE 0 END) ) >= 1 THEN 'medium'
    WHEN s.spine_year < 2021 THEN 'low'
    WHEN ( (CASE WHEN cs.changelog_injury_event THEN 1 ELSE 0 END)
         + (CASE WHEN ps.practice_listed_injury THEN 1 ELSE 0 END)
         + (CASE WHEN gl.active = false         THEN 1 ELSE 0 END)
         + (CASE WHEN gl.ruled_out_in_game      THEN 1 ELSE 0 END) ) >= 2 THEN 'high'
    WHEN ( (CASE WHEN cs.changelog_injury_event THEN 1 ELSE 0 END)
         + (CASE WHEN ps.practice_listed_injury THEN 1 ELSE 0 END)
         + (CASE WHEN gl.active = false         THEN 1 ELSE 0 END)
         + (CASE WHEN gl.ruled_out_in_game      THEN 1 ELSE 0 END) ) = 1 THEN 'medium'
    ELSE 'low'
  END AS confidence
FROM schedule_spine s
LEFT JOIN gl              ON gl.pid = s.pid AND gl.esbid = s.esbid
LEFT JOIN practice_signal ps ON ps.pid = s.pid AND ps.year = s.spine_year AND ps.week = s.week
LEFT JOIN changelog_signal cs ON cs.pid = s.pid AND cs.esbid = s.esbid
`
