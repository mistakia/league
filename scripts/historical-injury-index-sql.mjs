// Rebuild SQL for historical_injury_index. Source of truth lives in
// task/home-dynasty-league/build-historical-injury-index.md; this file
// is a transcription, kept in sync by hand.
//
// Parameter bindings: :start_year, :end_year. Bound via knex db.raw().

export const rebuild_sql = `
WITH reg_games AS (
  SELECT esbid, season_year AS year, week,
         home_nfl_team AS home_team, away_nfl_team AS away_team,
         home_qb_pid, away_qb_pid, kickoff_at AS game_kickoff_at
  FROM nfl_games
  WHERE season_type = 'REG' AND season_year BETWEEN :start_year AND :end_year
),
gl AS (
  SELECT pg.pid, pg.esbid, pg.season_year AS year, pg.nfl_team, pg.is_active,
         pg.snaps_offense, pg.snaps_defense, pg.snaps_special_teams,
         pg.is_ruled_out_in_game,
         (COALESCE(pg.passing_attempts,0)+COALESCE(pg.rushing_attempts,0)+COALESCE(pg.targets,0)
          +COALESCE(pg.receptions,0)+COALESCE(pg.field_goals_made,0)+COALESCE(pg.extra_points_made,0)
          +COALESCE(pg.defensive_sacks,0)+COALESCE(pg.defensive_interceptions,0)+COALESCE(pg.defensive_three_and_outs,0)) AS any_stat_count
  FROM player_gamelogs pg
  WHERE pg.season_year BETWEEN :start_year AND :end_year
),
practice_signal AS (
  SELECT pid, season_year, week,
         BOOL_OR(injury_type IS NOT NULL AND injury_type <> '') AS has_practice_listed_injury,
         BOOL_OR(UPPER(game_designation) IN ('OUT','DOUBTFUL','QUESTIONABLE')) AS is_practice_questionable_or_worse,
         MAX(UPPER(game_designation)) AS practice_designation
  FROM practice
  WHERE season_type = 'REG'
  GROUP BY pid, season_year, week
),
changelog_signal AS (
  -- Asymmetric per-game window: 168h back, 3h forward. Both bounds are stated in
  -- absolute units DELIBERATELY. pc.changed_at and gm.kickoff_at are timestamptz,
  -- so a DAY-unit interval would be CALENDAR arithmetic in the session timezone
  -- (production runs America/New_York): across the November fall-back transition
  -- it spans 169 hours, widening the window for exactly one week of every season
  -- and no other -- a seasonal artifact in a table built for cross-season
  -- comparison. Hour units are absolute and carry no such drift. Do not
  -- "simplify" 168h to the equivalent-looking day form; the spec asserts against
  -- it, and this comment avoids the literal so that guard stays meaningful.
  SELECT gl_inner.pid, gl_inner.esbid,
         BOOL_OR(pc.column_name = 'injury_status'
                 AND UPPER(pc.new_value) IN ('OUT','DOUBTFUL','IR','PUP','SUS','COV')) AS is_changelog_unavailable,
         BOOL_OR(pc.column_name = 'injury_status') AS has_changelog_injury_event,
         BOOL_OR(pc.column_name = 'nfl_status'
                 AND pc.new_value IN ('INJURED_RESERVE','PHYSICALLY_UNABLE_TO_PERFORM',
                                'SUSPENDED','NON_FOOTBALL_RELATED_INJURED_RESERVE',
                                'DID_NOT_REPORT')) AS has_changelog_nfl_reserve_event
  FROM player_gamelogs gl_inner
  JOIN nfl_games gm ON gm.esbid = gl_inner.esbid
  JOIN player_changelog pc
    ON pc.pid = gl_inner.pid
   AND pc.column_name IN ('injury_status','nfl_status','roster_status','status')
   AND pc.changed_at BETWEEN gm.kickoff_at - interval '168 hours' AND gm.kickoff_at + interval '3 hours'
  WHERE gl_inner.season_year BETWEEN :start_year AND :end_year AND gm.season_type = 'REG'
  GROUP BY gl_inner.pid, gl_inner.esbid
),
team_spans AS (
  SELECT gl.pid, gl.year, gl.nfl_team,
         MIN(g.game_kickoff_at) AS span_start,
         MAX(g.game_kickoff_at) AS span_end
  FROM gl JOIN reg_games g ON g.esbid = gl.esbid
  GROUP BY gl.pid, gl.year, gl.nfl_team
),
schedule_spine AS (
  SELECT ts.pid, ts.year AS spine_year, g.week, g.esbid, ts.nfl_team
  FROM team_spans ts
  JOIN reg_games g
    ON g.year = ts.year
   AND (g.home_team = ts.nfl_team OR g.away_team = ts.nfl_team)
   AND g.game_kickoff_at BETWEEN ts.span_start AND ts.span_end
)
SELECT
  s.pid,
  s.spine_year AS season_year,
  s.week,
  s.esbid,
  s.nfl_team,
  CASE
    WHEN gl.pid IS NULL THEN false
    WHEN gl.snaps_offense IS NULL AND gl.snaps_defense IS NULL AND gl.snaps_special_teams IS NULL
      THEN (gl.any_stat_count > 0)
    ELSE COALESCE(gl.snaps_offense,0) + COALESCE(gl.snaps_defense,0) + COALESCE(gl.snaps_special_teams,0) > 0
  END AS is_played,
  CASE WHEN gl.pid IS NULL THEN NULL
       ELSE COALESCE(gl.snaps_offense,0) + COALESCE(gl.snaps_defense,0) + COALESCE(gl.snaps_special_teams,0)
  END AS snap_count,
  gl.snaps_offense, gl.snaps_defense, gl.snaps_special_teams,
  gl.is_active AS is_gamelog_active,
  gl.is_ruled_out_in_game,
  COALESCE(ps.has_practice_listed_injury, false) AS has_practice_listed_injury,
  COALESCE(ps.is_practice_questionable_or_worse, false) AS is_practice_questionable_or_worse,
  ps.practice_designation,
  COALESCE(cs.has_changelog_injury_event, false) AS has_changelog_injury_event,
  COALESCE(cs.is_changelog_unavailable, false) AS is_changelog_unavailable,
  COALESCE(cs.has_changelog_nfl_reserve_event, false) AS has_changelog_nfl_reserve_event,
  CASE
    WHEN gl.pid IS NULL                                                  THEN 'no-gamelog-row'
    WHEN gl.is_active = false                                            THEN 'inactive'
    WHEN cs.has_changelog_nfl_reserve_event                              THEN 'reserve-list'
    WHEN gl.is_ruled_out_in_game                                         THEN 'in-game-injury'
    WHEN ps.is_practice_questionable_or_worse                            THEN 'practice-report-out'
    WHEN cs.is_changelog_unavailable                                     THEN 'changelog-out'
    WHEN (COALESCE(gl.snaps_offense,0) + COALESCE(gl.snaps_defense,0) + COALESCE(gl.snaps_special_teams,0)) = 0
         AND gl.pid IS NOT NULL                                          THEN 'zero-snap'
    ELSE NULL
  END AS missed_reason,
  ( (CASE WHEN cs.has_changelog_injury_event THEN 1 ELSE 0 END)
  + (CASE WHEN ps.has_practice_listed_injury THEN 1 ELSE 0 END)
  + (CASE WHEN gl.is_active = false          THEN 1 ELSE 0 END)
  + (CASE WHEN gl.is_ruled_out_in_game       THEN 1 ELSE 0 END)
  ) AS source_concurrence,
  CASE
    WHEN s.spine_year < 2009 THEN 'low'
    WHEN s.spine_year < 2021 AND ( (CASE WHEN cs.has_changelog_injury_event THEN 1 ELSE 0 END)
                                 + (CASE WHEN ps.has_practice_listed_injury THEN 1 ELSE 0 END)
                                 + (CASE WHEN gl.is_active = false          THEN 1 ELSE 0 END)
                                 + (CASE WHEN gl.is_ruled_out_in_game       THEN 1 ELSE 0 END) ) >= 1 THEN 'medium'
    WHEN s.spine_year < 2021 THEN 'low'
    WHEN ( (CASE WHEN cs.has_changelog_injury_event THEN 1 ELSE 0 END)
         + (CASE WHEN ps.has_practice_listed_injury THEN 1 ELSE 0 END)
         + (CASE WHEN gl.is_active = false          THEN 1 ELSE 0 END)
         + (CASE WHEN gl.is_ruled_out_in_game       THEN 1 ELSE 0 END) ) >= 2 THEN 'high'
    WHEN ( (CASE WHEN cs.has_changelog_injury_event THEN 1 ELSE 0 END)
         + (CASE WHEN ps.has_practice_listed_injury THEN 1 ELSE 0 END)
         + (CASE WHEN gl.is_active = false          THEN 1 ELSE 0 END)
         + (CASE WHEN gl.is_ruled_out_in_game       THEN 1 ELSE 0 END) ) = 1 THEN 'medium'
    ELSE 'low'
  END AS confidence
FROM schedule_spine s
LEFT JOIN gl              ON gl.pid = s.pid AND gl.esbid = s.esbid
LEFT JOIN practice_signal ps ON ps.pid = s.pid AND ps.season_year = s.spine_year AND ps.week = s.week
LEFT JOIN changelog_signal cs ON cs.pid = s.pid AND cs.esbid = s.esbid
`
