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
 * @param {object} params
 * @param {number} params.season_year - NFL year
 * @param {number} params.week - NFL week
 * @param {string} [params.season_type='REG'] - Season type (REG or POST)
 * @returns {Promise<Object<string, { opponent: string, esbid: number, is_home: boolean, is_final: boolean, has_started: boolean, kickoff_at: Date }>>} Schedule keyed by team abbreviation
 */
export async function load_nfl_schedule({
  season_year,
  week,
  season_type = 'REG'
}) {
  const schedules = await load_nfl_schedules_for_weeks({
    season_year,
    weeks: [week],
    season_type
  })
  return schedules.get(week)
}

/**
 * Load NFL schedule for multiple weeks in a single query.
 *
 * @param {object} params
 * @param {number} params.season_year - NFL year
 * @param {number[]} params.weeks - Array of NFL weeks
 * @param {string} [params.season_type='REG'] - Season type (REG or POST)
 * @returns {Promise<Map<number, Object<string, { opponent: string, esbid: number, is_home: boolean, is_final: boolean, has_started: boolean, kickoff_at: Date }>>>} Map of week to schedule keyed by team abbreviation
 */
export async function load_nfl_schedules_for_weeks({
  season_year,
  weeks,
  season_type = 'REG'
}) {
  log(`Loading NFL schedules for year ${season_year}, weeks ${weeks.join(',')}`)

  // Exactly the requested season type, never a widened set. nfl_games numbers
  // POST weeks from 1, so for weeks 1-4 a REG and a POST game share a week
  // number, and the schedule below keys one entry per team -- admitting both
  // made the surviving row a function of the query plan rather than of what the
  // caller asked for. No caller passes anything but the REG default today.
  const games = await db('nfl_games')
    .where({ season_year, season_type })
    .whereIn('week', weeks)
    .select(
      'away_nfl_team',
      'home_nfl_team',
      'esbid',
      'week',
      'home_score',
      'away_score',
      'status',
      'kickoff_at'
    )

  // Group games by week
  const schedules = new Map()
  weeks.forEach((week) => schedules.set(week, {}))

  const now = Date.now()

  for (const game of games) {
    const schedule = schedules.get(game.week)

    // Game is final if status indicates final
    const is_final = game.status?.toUpperCase()?.startsWith('FINAL') ?? false

    // Game has started if current time is past kickoff
    const has_started =
      Boolean(game.kickoff_at) && now >= game.kickoff_at.getTime()

    // Home team entry
    schedule[game.home_nfl_team] = {
      opponent: game.away_nfl_team,
      esbid: game.esbid,
      is_home: true,
      is_final,
      has_started,
      kickoff_at: game.kickoff_at
    }

    // Visitor/away team entry
    schedule[game.away_nfl_team] = {
      opponent: game.home_nfl_team,
      esbid: game.esbid,
      is_home: false,
      is_final,
      has_started,
      kickoff_at: game.kickoff_at
    }
  }

  log(`Loaded ${games.length} games across ${weeks.length} weeks`)
  return schedules
}

/**
 * Get opponent for a team in a specific week.
 *
 * @param {object} params
 * @param {string} params.team - NFL team abbreviation
 * @param {number} params.season_year - NFL year
 * @param {number} params.week - NFL week
 * @returns {Promise<string|null>} Opponent team abbreviation or null if on bye
 */
export async function get_team_opponent({ team, season_year, week }) {
  const schedule = await load_nfl_schedule({ season_year, week })
  return schedule[team]?.opponent || null
}
