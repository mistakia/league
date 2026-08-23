// Player -> team identity bridge CTEs. Materializes per-(player,...) team
// arrays so team-grain column definitions can be reached under player
// row_grain. Each CTE produces a `teams text[]` column carrying every NFL
// team the player was associated with in the relevant window, matching the
// array-agg semantics established by player_nfl_teams.
//
// Consumers:
//   - libs-server/get-data-view-results.mjs (setup_from_table_and_player_joins)
//   - libs-server/data-views-column-definitions/team-table-column-definitions.mjs
//   - team-year-grain column definitions (nfl-team-seasonlogs, pff-team-grades,
//     team-dvoa, espn-line-win-rates) when invoked under player row_grain.
//
// CTE name contract (must stay stable across consumers):
//   - player_teams(pid, teams text[])
//   - player_years_teams(pid, year, teams text[])
//   - player_years_weeks_teams(pid, year, week, teams text[])

export const PLAYER_TEAMS_CTE = 'player_teams'
export const PLAYER_YEARS_TEAMS_CTE = 'player_years_teams'
export const PLAYER_YEARS_WEEKS_TEAMS_CTE = 'player_years_weeks_teams'
export const PLAYER_PARTICIPATION_WEEKS_CTE = 'player_participation_weeks'

// Single-row-per-player snapshot: the player's current NFL team wrapped in a
// 1-element array so downstream consumers can use uniform `ANY(teams)` syntax.
export const player_teams_cte_sql = () =>
  `SELECT pid, ARRAY[current_nfl_team]::text[] AS teams FROM player WHERE current_nfl_team IS NOT NULL AND current_nfl_team <> 'INA'`

// Per-(pid, year) team set: every team the player was ROSTERED on in
// REG-season games of the requested year_range. Distinct across multi-team
// seasons so traded players carry every team they were on that year.
//
// Deliberately does NOT filter on `pgl.is_active`, matching the
// player_year_teams identity bridge (identity-bridges/player-year-to-team-year.mjs)
// which resolves the team a team-grain stat attaches to. The two must agree:
// while this CTE filtered on active and that bridge did not, a player with
// gamelogs but no active REG game rendered a BLANK team_code beside a
// populated team_*_from_plays -- 5,076 of 53,767 player-years on production
// (AJ Dillon 2024 GB, Alexander Mattison 2025 MIA). Participation is a
// separate signal, carried by player_participation_weeks below.
export const player_years_teams_cte_sql = ({ year_range }) => {
  if (!Array.isArray(year_range) || year_range.length === 0) {
    throw new Error('player_years_teams_cte_sql requires non-empty year_range')
  }
  const unions = year_range
    .map(
      (year) => `SELECT pgl.pid, ${year}::int AS year, pgl.nfl_team AS team_code
       FROM player_gamelogs_year_${year} pgl
       INNER JOIN nfl_games g ON g.esbid = pgl.esbid
       WHERE g.season_type = 'REG' AND g.season_year = ${year}`
    )
    .join(' UNION ALL ')
  return `SELECT pid, year, array_agg(DISTINCT team_code) AS teams
          FROM (${unions}) src
          GROUP BY pid, year`
}

// Per-(pid, year, week) participation row: the SAME player_gamelogs ⋈ nfl_games
// REG join as the two team CTEs, projecting `is_active` instead of the team.
// This is the single source of the "was the player active this week" signal --
// and since the team CTEs no longer filter on it, the ONLY place the flag is
// read. A row exists for every (pid, year, week) the player has a
// gamelog for — active or inactive — so a consumer can distinguish active-but-
// zero (row present, is_active true) from did-not-play (no row at all).
// `is_active`
// is carried through as bool_or(pgl.is_active) to defend against duplicate
// (pid, year, week) rows (the gamelog PK is (esbid, pid, year), not unique on
// week). `columns` is an extension point: each entry contributes an inner
// projection (`inner`, selected from the gamelog source) and an outer aggregate
// (`outer`, in the grouped SELECT) so the sibling active/started/snaps task can
// add started / snaps_offense without editing this builder. The raw `active`
// boolean is available directly — no enum decoding required.
export const player_participation_weeks_cte_sql = ({
  year_range,
  columns = []
}) => {
  if (!Array.isArray(year_range) || year_range.length === 0) {
    throw new Error(
      'player_participation_weeks_cte_sql requires non-empty year_range'
    )
  }
  const inner_extra = columns.map((c) => `, ${c.inner}`).join('')
  const outer_extra = columns.map((c) => `, ${c.outer}`).join('')
  const unions = year_range
    .map(
      (
        year
      ) => `SELECT pgl.pid, ${year}::int AS year, g.week, pgl.is_active${inner_extra}
       FROM player_gamelogs_year_${year} pgl
       INNER JOIN nfl_games g ON g.esbid = pgl.esbid
       WHERE g.season_type = 'REG' AND g.season_year = ${year}`
    )
    .join(' UNION ALL ')
  return `SELECT pid, year, week, bool_or(is_active) AS is_active${outer_extra}
          FROM (${unions}) src
          GROUP BY pid, year, week`
}

// Per-(pid, year, week) team set: the team the player was ROSTERED on for that
// week's REG game. Unfiltered on `pgl.is_active` for the same reason as
// player_years_teams_cte_sql above.
//
// Grouped rather than projected row-for-row because the gamelog PK is
// (esbid, pid, year) and is NOT unique on week, so a player can carry two
// gamelogs for one week -- 20 such (pid, year, week) keys on production, every
// one of them naming two DIFFERENT teams. Projected raw, those duplicate the
// player's week row through the LEFT JOIN in team-table-column-definitions.
// The same builder shape as player_years_teams keeps the `teams text[]`
// contract uniform across all three bridges.
export const player_years_weeks_teams_cte_sql = ({ year_range }) => {
  if (!Array.isArray(year_range) || year_range.length === 0) {
    throw new Error(
      'player_years_weeks_teams_cte_sql requires non-empty year_range'
    )
  }
  const unions = year_range
    .map(
      (
        year
      ) => `SELECT pgl.pid, ${year}::int AS year, g.week, pgl.nfl_team AS team_code
       FROM player_gamelogs_year_${year} pgl
       INNER JOIN nfl_games g ON g.esbid = pgl.esbid
       WHERE g.season_type = 'REG' AND g.season_year = ${year}`
    )
    .join(' UNION ALL ')
  return `SELECT pid, year, week, array_agg(DISTINCT team_code) AS teams
          FROM (${unions}) src
          GROUP BY pid, year, week`
}
