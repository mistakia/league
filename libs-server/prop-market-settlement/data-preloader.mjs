import debug from 'debug'

import db from '#db'
import { stat_countable_play_types } from '#constants'

const log = debug('data-preloader')

/**
 * Preload all required game data for market settlement processing
 *
 * This utility centralizes data loading to eliminate worker database queries.
 * Data is structured for direct consumption by settlement handlers.
 *
 * @param {Array<string>} esbids - Game IDs to load data for
 * @returns {object} Serializable data object containing all required game data
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

// The columns each loader selects, declared as VALUES rather than spelled
// inline in the select, because a settlement handler reads them by name off the
// returned rows: a column missing here does not raise, it reads undefined and
// settles the market against a zero metric. That is silent, and it is how the
// three return-touchdown columns above shipped unguarded.
//
// test/prop-market-settlement.preloaded-column-coverage.spec.mjs checks these
// against the metric_columns in market-type-mappings.mjs, which it can only do
// against a value. The gate it replaces recovered this list by regex over this
// file's source text, and so could see neither the qualified names below nor
// the PLAYER_GAMELOG handler at all.

// Qualified because two of them come from joined tables. Knex returns each
// under its UNQUALIFIED name, which is what the handler reads and what the gate
// therefore compares against -- hence the derived list below rather than a
// second hand-written one that could disagree with this.
const player_gamelog_select_columns = [
  'player_gamelogs.esbid',
  'player_gamelogs.pid',
  'player_gamelogs.season_year',
  'player_gamelogs.player_position',
  'player_gamelogs.nfl_team',
  'player_gamelogs.opponent_nfl_team',
  'player_gamelogs.is_active',
  // Passing stats
  'player_gamelogs.passing_attempts',
  'player_gamelogs.passing_completions',
  'player_gamelogs.passing_yards',
  'player_gamelogs.passing_interceptions',
  'player_gamelogs.passing_touchdowns',
  // Rushing stats
  'player_gamelogs.rushing_attempts',
  'player_gamelogs.rushing_yards',
  'player_gamelogs.rushing_touchdowns',
  'player_gamelogs.fumbles_lost',
  // Receiving stats
  'player_gamelogs.targets',
  'player_gamelogs.receptions',
  'player_gamelogs.receiving_yards',
  'player_gamelogs.receiving_touchdowns',
  // Return and fumble-return touchdowns (anytime / two-plus TD markets)
  'player_gamelogs.punt_return_touchdowns',
  'player_gamelogs.kickoff_return_touchdowns',
  'player_gamelogs.fumble_return_touchdowns',
  // Defense stats
  'player_gamelogs.defensive_sacks',
  // Kicking stats
  'player_gamelogs.field_goals_made',
  // Longest stats from specialized tables
  'player_receiving_gamelogs.longest_reception',
  'player_rushing_gamelogs.longest_rush'
]

// What a PLAYER_GAMELOG handler actually sees on a preloaded row.
export const player_gamelog_columns = player_gamelog_select_columns.map(
  (column) => column.split('.').pop()
)

/**
 * Load player gamelogs for specified games
 */
const load_player_gamelogs = async (esbids) => {
  return await db('player_gamelogs')
    .select(player_gamelog_select_columns)
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
    .where('player_gamelogs.is_active', true)
}

// Unqualified, so this is both the select list and what the NFL_PLAYS handler
// reads off a row.
export const nfl_plays_columns = [
  'esbid',
  'quarter',
  // Intra-game ordering, so first-scorer markets read the game's first
  // touchdown rather than whichever row the database happened to return
  'sequence',
  // Team attribution for team_aggregate markets
  'offense_nfl_team',
  // Which side scored, so first-touchdown markets can tell an offensive
  // touchdown from one returned by the defense. The play-shape flags cannot:
  // a rush fumbled and returned is still is_rushing_play.
  'touchdown_nfl_team',
  // Player identification columns
  'passer_pid',
  'ball_carrier_pid',
  'target_pid',
  // Yardage columns used in market calculations
  'pass_yards',
  'rush_yards',
  'receiving_yards',
  // Sack yardage for the net-yards team markets. A sack carries its loss in
  // yards_gained and nothing in the three columns above, so a team total
  // built from those alone is gross rather than the NFL's net figure.
  'is_sack',
  'yards_gained',
  // Play outcome flags used by count and first-scorer market logic
  'is_completion',
  'is_touchdown',
  'is_rushing_play',
  'is_passing_play',
  'is_interception'
]

/**
 * Load NFL plays for specified games
 */
const load_nfl_plays = async (esbids) => {
  return await db('nfl_plays')
    .select(nfl_plays_columns)
    .whereIn('esbid', esbids)
    // Settlement counts passing, rushing and receiving production, so a
    // nullified play and a two-point conversion are both out. play_type is
    // filtered without being selected -- the handler never reads it.
    .whereIn('play_type', stat_countable_play_types)
    .orderBy('esbid')
    .orderBy('sequence')
}

/**
 * Load NFL games for specified games
 */
const load_nfl_games = async (esbids) => {
  return await db('nfl_games')
    .select(
      'esbid',
      'season_year',
      'week',
      'season_type',
      'date',
      'home_nfl_team',
      'away_nfl_team',
      'home_score',
      'away_score',
      'status'
    )
    .whereIn('esbid', esbids)
}
