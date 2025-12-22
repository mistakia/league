import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { get_target_week } from '#libs-shared'
import { is_main } from '#libs-server'
import {
  process_all_format_gamelogs,
  process_all_format_aggregates,
  process_global_aggregates
} from '#libs-server/stats-pipeline.mjs'

import process_plays from './process-plays.mjs'
import generate_player_gamelogs from './generate-player-gamelogs.mjs'
import generate_player_snaps_for_week from './generate-player-snaps.mjs'

const log = debug('process-stats-for-week')
debug.enable('process-stats-for-week')

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

/**
 * Process all stats for a given week including:
 * - Play processing
 * - Player gamelogs
 * - Scoring format gamelogs/seasonlogs/careerlogs
 * - League format gamelogs/seasonlogs/careerlogs
 * - NFL team seasonlogs
 * - Basic player seasonlogs
 * - Player career game counts
 * - Player snaps
 *
 * @param {Object} params
 * @param {number} params.week - Week number (defaults to target week)
 * @returns {Promise<void>}
 */
const process_stats_for_week = async ({ week } = {}) => {
  if (!week) {
    week = get_target_week()
  }

  log(`updating stats for week ${week}`)

  // Step 1: Process plays (enrich with player data)
  await process_plays({ week })

  // Step 2: Generate base player gamelogs
  await generate_player_gamelogs({ week })

  // Step 3: Generate format-specific gamelogs (scoring + league)
  await process_all_format_gamelogs({ week })

  // Step 4: Generate format-specific aggregates (seasonlogs + careerlogs)
  await process_all_format_aggregates()

  // Step 5: Generate global aggregates (team seasonlogs, player seasonlogs, career counts)
  await process_global_aggregates()

  // Step 6: Generate player snaps
  await generate_player_snaps_for_week({ week })
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await process_stats_for_week({ week: argv.week })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default process_stats_for_week
