import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, batch_insert, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { current_season } from '#constants'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-player-variance')
debug.enable('calculate-player-variance')

/**
 * Calculate variance statistics for each player from historical gamelogs.
 */
const calculate_player_variance = async ({
  year,
  scoring_format_hash
} = {}) => {
  if (!year) {
    throw new Error('year is required')
  }
  if (!scoring_format_hash) {
    throw new Error('scoring_format_hash is required')
  }

  log(`Calculating player variance for year ${year}`)

  // Get all gamelog data grouped by player for the year
  const gamelogs = await db('scoring_format_player_gamelogs')
    .join(
      'nfl_games',
      'scoring_format_player_gamelogs.esbid',
      'nfl_games.esbid'
    )
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', 'REG')
    .where(
      'scoring_format_player_gamelogs.scoring_format_hash',
      scoring_format_hash
    )
    .select(
      'scoring_format_player_gamelogs.pid',
      'scoring_format_player_gamelogs.points'
    )

  log(`Found ${gamelogs.length} gamelog entries`)

  // Group by player
  const player_games = new Map()
  for (const gl of gamelogs) {
    if (!player_games.has(gl.pid)) {
      player_games.set(gl.pid, [])
    }
    player_games.get(gl.pid).push(parseFloat(gl.points))
  }

  log(`Processing ${player_games.size} players`)

  const variance_records = []

  for (const [pid, points_array] of player_games) {
    const n = points_array.length

    // Require minimum games for reliable statistics
    if (n < 3) {
      continue
    }

    // Calculate statistics
    const mean = points_array.reduce((a, b) => a + b, 0) / n
    const min_points = Math.min(...points_array)
    const max_points = Math.max(...points_array)

    // Calculate sample standard deviation
    const sum_squared_diff = points_array.reduce(
      (sum, val) => sum + Math.pow(val - mean, 2),
      0
    )
    const std_dev = Math.sqrt(sum_squared_diff / (n - 1))

    // Calculate coefficient of variation (CV)
    // Cap at 9.9999 to fit numeric(5,4) column constraint
    const cv = mean > 0 ? Math.min(std_dev / mean, 9.9999) : 0

    variance_records.push({
      pid,
      year,
      scoring_format_hash,
      games_played: n,
      mean_points: mean.toFixed(2),
      standard_deviation: std_dev.toFixed(2),
      min_points: min_points.toFixed(2),
      max_points: max_points.toFixed(2),
      coefficient_of_variation: cv.toFixed(4),
      calculated_at: new Date()
    })
  }

  log(`Inserting ${variance_records.length} variance records`)

  // Insert in batches (batch_size 100 to stay under PostgreSQL parameter limit)
  if (variance_records.length > 0) {
    await batch_insert({
      items: variance_records,
      batch_size: 100,
      save: async (batch) => {
        await db('player_variance')
          .insert(batch)
          .onConflict(['pid', 'year', 'scoring_format_hash'])
          .merge()
      }
    })
  }

  log(`Completed: inserted ${variance_records.length} variance records`)
  return variance_records.length
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
        await calculate_player_variance({
          year,
          scoring_format_hash: league.scoring_format_hash
        })
      } else {
        throw new Error('No scoring_format_hash provided and no default found')
      }
    } else {
      await calculate_player_variance({ year, scoring_format_hash })
    }
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.CALCULATE_PLAYER_VARIANCE,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default calculate_player_variance
