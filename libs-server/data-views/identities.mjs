import { team_values_cte_sql } from '#libs-server/data-views/team-values-cte.mjs'

const base_years_sql = ({ year_range }) => {
  if (!Array.isArray(year_range) || year_range.length === 0) {
    throw new Error('base_years_sql requires non-empty year_range')
  }
  return `SELECT unnest(ARRAY[${year_range.join(',')}]) as year`
}

const player_years_weeks_sql = ({ year_range }) => {
  const single_year = year_range.length === 1 ? year_range[0] : null
  const where = single_year
    ? ` WHERE nfl_year_week_timestamp.year = ${single_year}`
    : ''
  return `SELECT player_years.pid, nfl_year_week_timestamp.year, nfl_year_week_timestamp.week FROM player_years INNER JOIN nfl_year_week_timestamp ON player_years.year = nfl_year_week_timestamp.year${where}`
}

const team_years_weeks_sql = ({ year_range }) => {
  const single_year = year_range.length === 1 ? year_range[0] : null
  const where = single_year
    ? ` WHERE nfl_year_week_timestamp.year = ${single_year}`
    : ''
  return `SELECT team_years.team_code, nfl_year_week_timestamp.year, nfl_year_week_timestamp.week FROM team_years INNER JOIN nfl_year_week_timestamp ON team_years.year = nfl_year_week_timestamp.year${where}`
}

export const identities = {
  player: {
    id: 'player',
    row_grain: 'player',
    row_axes: [],
    key_columns: ['pid'],
    pid_column: 'player.pid',
    team_column: null,
    year_column: null,
    week_column: null,
    from_source: () => ({ table: 'player', with: [] })
  },

  player_year: {
    id: 'player_year',
    row_grain: 'player',
    row_axes: ['year'],
    key_columns: ['pid', 'year'],
    pid_column: 'player.pid',
    team_column: null,
    year_column: 'player_years.year',
    week_column: null,
    from_source: ({ year_range, position_filter_sql = null }) => {
      const where = position_filter_sql ? ` WHERE ${position_filter_sql}` : ''
      return {
        table: 'player',
        with: [
          { name: 'base_years', sql: base_years_sql({ year_range }) },
          {
            name: 'player_years',
            sql: `SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years${where}`
          }
        ]
      }
    }
  },

  player_year_week: {
    id: 'player_year_week',
    row_grain: 'player',
    row_axes: ['year', 'week'],
    key_columns: ['pid', 'year', 'week'],
    pid_column: 'player.pid',
    team_column: null,
    // year sourced from player_years (lower-grain CTE); player_years_weeks
    // INNER JOINs nfl_year_week_timestamp on year, so its year is equivalent.
    // Convention pins the reference to player_years for joinability with
    // year-only consumers and fixture stability.
    year_column: 'player_years.year',
    week_column: 'player_years_weeks.week',
    from_source: ({ year_range, position_filter_sql = null }) => {
      const where = position_filter_sql ? ` WHERE ${position_filter_sql}` : ''
      return {
        table: 'player',
        with: [
          { name: 'base_years', sql: base_years_sql({ year_range }) },
          {
            name: 'player_years',
            sql: `SELECT DISTINCT player.pid, base_years.year FROM player CROSS JOIN base_years${where}`
          },
          {
            name: 'player_years_weeks',
            sql: player_years_weeks_sql({ year_range })
          }
        ]
      }
    }
  },

  team: {
    id: 'team',
    row_grain: 'team',
    row_axes: [],
    key_columns: ['team_code'],
    pid_column: null,
    team_column: 'team.team_code',
    year_column: null,
    week_column: null,
    from_source: () => ({
      table: 'team',
      with: [{ name: 'team', sql: team_values_cte_sql() }]
    })
  },

  team_year: {
    id: 'team_year',
    row_grain: 'team',
    row_axes: ['year'],
    key_columns: ['team_code', 'year'],
    pid_column: null,
    team_column: 'team_years.team_code',
    year_column: 'team_years.year',
    week_column: null,
    from_source: ({ year_range }) => ({
      table: 'team_years',
      with: [
        { name: 'base_years', sql: base_years_sql({ year_range }) },
        { name: 'team', sql: team_values_cte_sql() },
        {
          name: 'team_years',
          sql: 'SELECT team.team_code, base_years.year FROM team CROSS JOIN base_years'
        }
      ]
    })
  },

  team_year_week: {
    id: 'team_year_week',
    row_grain: 'team',
    row_axes: ['year', 'week'],
    key_columns: ['team_code', 'year', 'week'],
    pid_column: null,
    team_column: 'team_years_weeks.team_code',
    year_column: 'team_years_weeks.year',
    week_column: 'team_years_weeks.week',
    from_source: ({ year_range }) => ({
      table: 'team_years_weeks',
      with: [
        { name: 'base_years', sql: base_years_sql({ year_range }) },
        { name: 'team', sql: team_values_cte_sql() },
        {
          name: 'team_years',
          sql: 'SELECT team.team_code, base_years.year FROM team CROSS JOIN base_years'
        },
        { name: 'team_years_weeks', sql: team_years_weeks_sql({ year_range }) }
      ]
    })
  }
}

export const get_identity = (identity_id) => {
  const identity = identities[identity_id]
  if (!identity) {
    throw new Error(`Unknown identity: ${identity_id}`)
  }
  return identity
}

export const is_team_identity = (identity_id) => identity_id.startsWith('team')

// Resolve the canonical reference column expressions for the active identity
// and FROM-table choice. Replaces the legacy from_table_name heuristic in
// setup_central_references.
//
// Contract:
//   - Team row_grain: references always come from the team identity's canonical
//     columns. setup_from_table_and_player_joins guarantees the canonical CTEs
//     (team, team_years, team_years_weeks) are attached via identity.from_source.
//   - Player row_grain, canonical FROM (`player`): use identity's canonical
//     columns. Bridges (player_years, player_years_weeks) are attached by
//     setup_from_table_and_player_joins when from_table_name === 'player'.
//   - Player row_grain, fact-table FROM: by data-model convention, every
//     identity-compatible fact table (gated by get_from_table_config via
//     column-def `granularity`) exposes columns named `pid`, `year`, `week`.
//     Use those directly; bridges are not attached (would multiply rows
//     against finer-grain fact tables).
//
// Note: the granularity gate above currently reads `def.granularity` directly
// on the column definition. The longer-term single source of truth is the
// column's `source.grain` declaration -- when get_from_table_config is
// updated to consume that, it should call derive_granularity from
// libs-server/data-views/derive-granularity.mjs rather than reading
// def.granularity, so per-column overrides remain centralized.
export const resolve_references = ({ identity_id, from_table_name }) => {
  const identity = get_identity(identity_id)

  if (identity.row_grain === 'team') {
    return {
      pid_reference: identity.team_column,
      team_reference: identity.team_column,
      year_reference: identity.year_column,
      week_reference: identity.week_column
    }
  }

  if (from_table_name === 'player') {
    return {
      pid_reference: identity.pid_column,
      team_reference: null,
      year_reference: identity.year_column,
      week_reference: identity.week_column
    }
  }

  return {
    pid_reference: `${from_table_name}.pid`,
    team_reference: null,
    year_reference: `${from_table_name}.year`,
    week_reference: `${from_table_name}.week`
  }
}
