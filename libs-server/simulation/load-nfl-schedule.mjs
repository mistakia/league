/**
 * Load NFL schedule from database for simulation.
 */

import debug from 'debug'

import db from '#db'

const log = debug('simulation:load-nfl-schedule')

/**
 * All 32 NFL team abbreviations.
 */
export const NFL_TEAMS = [
  'ARI',
  'ATL',
  'BAL',
  'BUF',
  'CAR',
  'CHI',
  'CIN',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GB',
  'HOU',
  'IND',
  'JAX',
  'KC',
  'LA',
  'LAC',
  'LV',
  'MIA',
  'MIN',
  'NE',
  'NO',
  'NYG',
  'NYJ',
  'PHI',
  'PIT',
  'SEA',
  'SF',
  'TB',
  'TEN',
  'WAS'
]

/**
 * Load NFL schedule for a specific week.
 * Delegates to load_nfl_schedules_for_weeks for a single week.
 *
 * @param {Object} params
 * @param {number} params.year - NFL year
 * @param {number} params.week - NFL week
 * @param {string} [params.seas_type='REG'] - Season type (REG or POST)
 * @returns {Promise<Object>} Schedule object: { [team_abbrev]: { opponent, esbid, is_home } }
 */
export async function load_nfl_schedule({ year, week, seas_type = 'REG' }) {
  const schedules = await load_nfl_schedules_for_weeks({
    year,
    weeks: [week],
    seas_type
  })
  return schedules.get(week)
}

/**
 * Load NFL schedule for multiple weeks in a single query.
 *
 * @param {Object} params
 * @param {number} params.year - NFL year
 * @param {number[]} params.weeks - Array of NFL weeks
 * @param {string} [params.seas_type='REG'] - Season type (REG or POST)
 * @returns {Promise<Map>} Map of week -> schedule object
 */
export async function load_nfl_schedules_for_weeks({
  year,
  weeks,
  seas_type = 'REG'
}) {
  log(`Loading NFL schedules for year ${year}, weeks ${weeks.join(',')}`)

  const games = await db('nfl_games')
    .where({ year })
    .whereIn('week', weeks)
    .whereIn('seas_type', seas_type === 'POST' ? ['POST'] : ['REG', 'POST'])
    .select(
      'v',
      'h',
      'esbid',
      'week',
      'home_score',
      'away_score',
      'status',
      'timestamp'
    )

  // Group games by week
  const schedules = new Map()
  weeks.forEach((week) => schedules.set(week, {}))

  const now = Math.floor(Date.now() / 1000)

  for (const game of games) {
    const schedule = schedules.get(game.week)

    // Game is final if status indicates final
    const is_final = game.status?.toUpperCase().startsWith('FINAL') || false

    // Game has started if current time is past the game timestamp
    const has_started = game.timestamp && now >= game.timestamp

    // Home team entry
    schedule[game.h] = {
      opponent: game.v,
      esbid: game.esbid,
      is_home: true,
      is_final,
      has_started,
      timestamp: game.timestamp
    }

    // Visitor/away team entry
    schedule[game.v] = {
      opponent: game.h,
      esbid: game.esbid,
      is_home: false,
      is_final,
      has_started,
      timestamp: game.timestamp
    }
  }

  log(`Loaded ${games.length} games across ${weeks.length} weeks`)
  return schedules
}

/**
 * Get opponent for a team in a specific week.
 *
 * @param {Object} params
 * @param {string} params.team - NFL team abbreviation
 * @param {number} params.year - NFL year
 * @param {number} params.week - NFL week
 * @returns {Promise<string|null>} Opponent team abbreviation or null if on bye
 */
export async function get_team_opponent({ team, year, week }) {
  const schedule = await load_nfl_schedule({ year, week })
  return schedule[team]?.opponent || null
}
