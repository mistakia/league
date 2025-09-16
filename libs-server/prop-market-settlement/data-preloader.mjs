import debug from 'debug'

import db from '#db'

const log = debug('data-preloader')

/**
 * Preload all required game data for market settlement processing
 *
 * This utility centralizes data loading to eliminate worker database queries.
 * Data is structured for direct consumption by settlement handlers.
 *
 * @param {Array<string>} esbids - Game IDs to load data for
 * @returns {Object} Serializable data object containing all required game data
 */
export const preload_game_data = async (esbids) => {
  if (!esbids || esbids.length === 0) {
    return {
      player_gamelogs: [],
      nfl_plays: [],
      nfl_games: []
    }
  }

  log(`Preloading data for ${esbids.length} games: ${esbids.join(', ')}`)

  // Load all data in parallel for maximum efficiency
  const [player_gamelogs, nfl_plays, nfl_games] = await Promise.all([
    load_player_gamelogs(esbids),
    load_nfl_plays(esbids),
    load_nfl_games(esbids)
  ])

  const data = {
    player_gamelogs,
    nfl_plays,
    nfl_games
  }

  log(
    `Preloaded data: ${player_gamelogs.length} gamelogs, ${nfl_plays.length} plays, ${nfl_games.length} games`
  )

  return data
}

/**
 * Load player gamelogs for specified games
 */
const load_player_gamelogs = async (esbids) => {
  return await db('player_gamelogs')
    .select(
      'player_gamelogs.esbid',
      'player_gamelogs.pid',
      'player_gamelogs.year',
      'player_gamelogs.pos',
      'player_gamelogs.tm',
      'player_gamelogs.opp',
      'player_gamelogs.active',
      // Passing stats
      'player_gamelogs.pa',
      'player_gamelogs.pc',
      'player_gamelogs.py',
      'player_gamelogs.ints',
      'player_gamelogs.tdp',
      // Rushing stats
      'player_gamelogs.ra',
      'player_gamelogs.ry',
      'player_gamelogs.tdr',
      'player_gamelogs.fuml',
      // Receiving stats
      'player_gamelogs.trg',
      'player_gamelogs.rec',
      'player_gamelogs.recy',
      'player_gamelogs.tdrec',
      // Defense stats
      'player_gamelogs.dsk',
      'player_gamelogs.dtno',
      // Kicking stats
      'player_gamelogs.fgm',
      // Longest stats from specialized tables
      'player_receiving_gamelogs.longest_reception',
      'player_rushing_gamelogs.longest_rush'
    )
    .leftJoin('player_receiving_gamelogs', function () {
      this.on(
        'player_gamelogs.esbid',
        '=',
        'player_receiving_gamelogs.esbid'
      ).andOn('player_gamelogs.pid', '=', 'player_receiving_gamelogs.pid')
    })
    .leftJoin('player_rushing_gamelogs', function () {
      this.on(
        'player_gamelogs.esbid',
        '=',
        'player_rushing_gamelogs.esbid'
      ).andOn('player_gamelogs.pid', '=', 'player_rushing_gamelogs.pid')
    })
    .whereIn('player_gamelogs.esbid', esbids)
    .where('player_gamelogs.active', true)
}

/**
 * Load NFL plays for specified games
 */
const load_nfl_plays = async (esbids) => {
  return await db('nfl_plays')
    .select(
      'esbid',
      'qtr',
      // Player identification columns
      'psr_pid',
      'bc_pid',
      'trg_pid',
      // Yardage columns used in market calculations
      'pass_yds',
      'rush_yds',
      'recv_yds'
    )
    .whereIn('esbid', esbids)
}

/**
 * Load NFL games for specified games
 */
const load_nfl_games = async (esbids) => {
  return await db('nfl_games')
    .select(
      'esbid',
      'year',
      'week',
      'seas_type',
      'date',
      'h',
      'v',
      'home_score',
      'away_score',
      'spread_line',
      'total_line',
      'home_moneyline',
      'away_moneyline',
      'temp',
      'wind',
      'stad',
      'surf',
      'roof',
      'home_rest',
      'away_rest',
      'home_coach',
      'away_coach',
      'status'
    )
    .whereIn('esbid', esbids)
}
