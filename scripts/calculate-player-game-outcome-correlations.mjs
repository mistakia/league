import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { sampleCorrelation } from 'simple-statistics'

import db from '#db'
import { is_main, batch_insert, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { current_season } from '#constants'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-player-game-outcome-correlations')
debug.enable('calculate-player-game-outcome-correlations')

// Minimum games required for correlation calculation
const MIN_GAMES_FOR_CORRELATION = 8
const MIN_GAMES_PER_STATE = 3
const MIN_GAMES_FOR_FULL_CONFIDENCE = 14
const MIN_GAMES_PER_STATE_FULL_CONFIDENCE = 5

/**
 * Calculate player-game outcome correlations from historical gamelogs.
 * Measures how each player's fantasy performance correlates with game script
 * (leading vs trailing).
 */
const calculate_player_game_outcome_correlations = async ({
  year,
  scoring_format_hash
} = {}) => {
  if (!year) {
    throw new Error('year is required')
  }
  if (!scoring_format_hash) {
    throw new Error('scoring_format_hash is required')
  }

  log(`Calculating player game outcome correlations for year ${year}`)

  // Get all player gamelogs with snaps data and fantasy points
  const gamelogs = await db('player_gamelogs')
    .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
    .join('scoring_format_player_gamelogs', function () {
      this.on(
        'player_gamelogs.pid',
        'scoring_format_player_gamelogs.pid'
      ).andOn('player_gamelogs.esbid', 'scoring_format_player_gamelogs.esbid')
    })
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', 'REG')
    .where(
      'scoring_format_player_gamelogs.scoring_format_hash',
      scoring_format_hash
    )
    .whereNotNull('player_gamelogs.snaps_leading')
    .whereNotNull('player_gamelogs.snaps_trailing')
    .where('player_gamelogs.snaps_off', '>', 0)
    .select(
      'player_gamelogs.pid',
      'player_gamelogs.esbid',
      'player_gamelogs.pos',
      'player_gamelogs.snaps_off',
      'player_gamelogs.snaps_leading',
      'player_gamelogs.snaps_trailing',
      'scoring_format_player_gamelogs.points'
    )

  log(`Found ${gamelogs.length} gamelog entries with snaps data`)

  // Group by player
  const player_games = new Map()
  for (const gl of gamelogs) {
    if (!player_games.has(gl.pid)) {
      player_games.set(gl.pid, {
        games: [],
        pos: gl.pos
      })
    }

    const snaps_leading = gl.snaps_leading || 0
    const snaps_trailing = gl.snaps_trailing || 0
    const total_snaps = gl.snaps_off || 1

    // Calculate game script score: ranges from -1 (all trailing) to +1 (all leading)
    const script_score = (snaps_leading - snaps_trailing) / total_snaps
    const points = parseFloat(gl.points) || 0

    player_games.get(gl.pid).games.push({
      esbid: gl.esbid,
      script_score,
      points,
      is_leading: snaps_leading > snaps_trailing,
      is_trailing: snaps_trailing > snaps_leading
    })
  }

  log(`Processing ${player_games.size} players`)

  const correlations_to_insert = []

  for (const [pid, data] of player_games) {
    const { games } = data

    // Need minimum games for correlation
    if (games.length < MIN_GAMES_FOR_CORRELATION) {
      continue
    }

    // Count games in each state
    const leading_games = games.filter((g) => g.is_leading).length
    const trailing_games = games.filter((g) => g.is_trailing).length

    // Need minimum games in each state
    if (
      leading_games < MIN_GAMES_PER_STATE ||
      trailing_games < MIN_GAMES_PER_STATE
    ) {
      continue
    }

    // Calculate mean fantasy points
    const mean_points =
      games.reduce((sum, g) => sum + g.points, 0) / games.length

    // Calculate fantasy deviation for each game
    const script_scores = games.map((g) => g.script_score)
    const fantasy_deviations = games.map((g) => g.points - mean_points)

    // Calculate Pearson correlation
    let correlation
    try {
      correlation = sampleCorrelation(script_scores, fantasy_deviations)
    } catch {
      continue
    }

    if (isNaN(correlation)) {
      continue
    }

    // Calculate average points in each state
    const leading_points = games
      .filter((g) => g.is_leading)
      .reduce((sum, g) => sum + g.points, 0)
    const trailing_points = games
      .filter((g) => g.is_trailing)
      .reduce((sum, g) => sum + g.points, 0)

    const leading_fpg = leading_games > 0 ? leading_points / leading_games : 0
    const trailing_fpg =
      trailing_games > 0 ? trailing_points / trailing_games : 0

    // Calculate confidence (0-1) based on sample size
    // Full confidence at 14+ games with 5+ in each state
    const games_confidence = Math.min(
      games.length / MIN_GAMES_FOR_FULL_CONFIDENCE,
      1
    )
    const state_confidence = Math.min(
      Math.min(leading_games, trailing_games) /
        MIN_GAMES_PER_STATE_FULL_CONFIDENCE,
      1
    )
    const confidence = (games_confidence + state_confidence) / 2

    correlations_to_insert.push({
      pid,
      year,
      outcome_type: 'game_script',
      correlation: correlation.toFixed(4),
      games_sample: games.length,
      leading_games,
      trailing_games,
      leading_fpg: leading_fpg.toFixed(2),
      trailing_fpg: trailing_fpg.toFixed(2),
      overall_fpg: mean_points.toFixed(2),
      confidence: confidence.toFixed(3),
      calculated_at: new Date()
    })
  }

  log(`Inserting ${correlations_to_insert.length} player correlations`)

  // Insert in batches
  if (correlations_to_insert.length > 0) {
    await batch_insert({
      items: correlations_to_insert,
      batch_size: 1000,
      save: async (batch) => {
        await db('player_game_outcome_correlations')
          .insert(batch)
          .onConflict(['pid', 'year', 'outcome_type'])
          .merge()
      }
    })
  }

  log(`Completed: inserted ${correlations_to_insert.length} correlations`)
  return correlations_to_insert.length
}

const main = async () => {
  let error
  try {
    const year = argv.year || current_season.year - 1
    const scoring_format_hash = argv.scoring_format_hash

    if (!scoring_format_hash) {
      // Get default scoring format from league 1
      const league = await db('seasons').where({ lid: 1 }).first()
      if (league) {
        await calculate_player_game_outcome_correlations({
          year,
          scoring_format_hash: league.scoring_format_hash
        })
      } else {
        throw new Error('No scoring_format_hash provided and no default found')
      }
    } else {
      await calculate_player_game_outcome_correlations({
        year,
        scoring_format_hash
      })
    }
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.CALCULATE_PLAYER_GAME_OUTCOME_CORRELATIONS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default calculate_player_game_outcome_correlations
