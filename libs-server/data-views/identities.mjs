import { nfl_team_abbreviations } from '#libs-shared/constants/nfl-teams-constants.mjs'

const team_values_cte_sql = () => {
  const tuples = nfl_team_abbreviations.map((code) => `('${code}')`).join(',')
  return `SELECT team_code FROM (VALUES ${tuples}) AS t(team_code)`
}

const base_years_sql = ({ year_range }) => {
  if (!Array.isArray(year_range) || year_range.length === 0) {
    throw new Error('base_years_sql requires non-empty year_range')
  }
  return `SELECT unnest(ARRAY[${year_range.join(',')}]::int[]) AS year`
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
    subject: 'player',
    splits: [],
    key_columns: ['pid'],
    pid_column: 'player.pid',
    team_column: null,
    year_column: null,
    week_column: null,
    from_source: () => ({ table: 'player', with: [] })
  },

  player_year: {
    id: 'player_year',
    subject: 'player',
    splits: ['year'],
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
    subject: 'player',
    splits: ['year', 'week'],
    key_columns: ['pid', 'year', 'week'],
    pid_column: 'player.pid',
    team_column: null,
    year_column: 'player_years_weeks.year',
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
    subject: 'team',
    splits: [],
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
    subject: 'team',
    splits: ['year'],
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
    subject: 'team',
    splits: ['year', 'week'],
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
