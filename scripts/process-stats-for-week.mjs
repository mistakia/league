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
  return yargs(hideBin(process.argv))
    .option('week', { type: 'number', describe: 'NFL week number' })
    .option('dry', { type: 'boolean', describe: 'Dry run mode' })
    .option('skip_aggregates', {
      type: 'boolean',
      describe: 'Skip aggregate processing'
    }).argv
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
 * @param {boolean} [params.skip_aggregates=false] - Skip aggregate processing (seasonlogs/careerlogs).
 *   Use when processing multiple weeks - run aggregates once at the end instead.
 * @returns {Promise<void>}
 */
const process_stats_for_week = async ({
  week,
  skip_aggregates = false,
  dry_run = false
} = {}) => {
  if (!week) {
    week = get_target_week()
  }

  log(
    `updating stats for week ${week}${skip_aggregates ? ' (skipping aggregates)' : ''}${dry_run ? ' (dry run)' : ''}`
  )

  // Step 1: Process plays (enrich with player data)
  await process_plays({ week, dry_run })

  // Step 2: Generate base player gamelogs
  await generate_player_gamelogs({ week, dry_run })

  // Step 3: Generate format-specific gamelogs (scoring + league)
  if (!dry_run) {
    await process_all_format_gamelogs({ week })
  } else {
    log('Skipping format-specific gamelogs (dry run)')
  }

  if (!skip_aggregates) {
    if (!dry_run) {
      // Step 4: Generate format-specific aggregates (seasonlogs + careerlogs)
      await process_all_format_aggregates()

      // Step 5: Generate global aggregates (team seasonlogs, player seasonlogs, career counts)
      await process_global_aggregates()
    } else {
      log('Skipping aggregates (dry run)')
    }
  }

  // Step 6: Generate player snaps
  if (!dry_run) {
    await generate_player_snaps_for_week({ week })
  } else {
    log('Skipping player snaps (dry run)')
  }

  log(`Completed stats processing for week ${week}`)
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await process_stats_for_week({
      week: argv.week,
      skip_aggregates: argv.skip_aggregates,
      dry_run: argv.dry
    })
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
