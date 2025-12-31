import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { is_main, report_job, get_season_playoff_weeks } from '#libs-server'
import {
  run_step,
  get_hosted_league_ids,
  process_all_format_aggregates,
  process_global_aggregates
} from '#libs-server/stats-pipeline.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

import import_plays_nfl_v1 from '#scripts/import-plays-nfl-v1.mjs'
import process_stats_for_week from '#scripts/process-stats-for-week.mjs'
import process_matchups from '#scripts/process-matchups.mjs'
import process_playoffs from '#scripts/process-playoffs.mjs'
import calculate_league_careerlogs from '#scripts/calculate-league-careerlogs.mjs'
import generate_league_season_teams from '#scripts/generate-league-season-teams.mjs'
import generate_draft_picks from '#scripts/generate-draft-picks.mjs'
import set_draft_pick_number from '#scripts/set-draft-pick-number.mjs'

const log = debug('finalize-season')

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('lid', {
      type: 'number',
      describe: 'League ID to finalize (omit for all hosted leagues)'
    })
    .option('year', {
      type: 'number',
      describe: 'Season year to finalize (defaults to current season)'
    })
    .option('skip-play-import', {
      type: 'boolean',
      default: false,
      describe:
        'Skip play import step (use when plays already imported during week finalization)'
    })
    .parse()
}

/**
 * Finalize a completed fantasy football season
 *
 * Pipeline (all steps are idempotent):
 *
 * 1. Import plays for playoff weeks (force update for stat corrections)
 *    - Skipped when skip_play_import=true (plays already imported during week finalization)
 *    - Uses skip_finalization=true since per-game finalization was done live
 *
 * 2. Process stats for each playoff week (skip_aggregates=true)
 *    - Generates player gamelogs and format-specific gamelogs
 *    - Aggregates skipped here, done once in step 5-6
 *
 * 3. Process matchups for each playoff week
 *    - Calculates fantasy scores for playoff matchups
 *
 * 4. Process playoffs
 *    - Determines final standings and post_season_finish
 *
 * 5. Process format aggregates (once, covering all weeks)
 *    - Scoring format seasonlogs/careerlogs
 *    - League format seasonlogs/careerlogs
 *
 * 6. Process global aggregates
 *    - NFL team seasonlogs, player seasonlogs, career game counts
 *
 * 7. Calculate league careerlogs
 *    - Team and user career statistics
 *
 * 8. Generate next year teams
 *    - Creates team records with draft order based on final standings
 *    - Uses league_settings_year (current year) for cap/faab values
 *
 * 9. Generate next year draft picks
 *    - Creates draft pick records (skips if already exist)
 *
 * 10. Set draft pick numbers
 *     - Assigns pick numbers based on draft order
 *
 * 11. Update season_finalized_at timestamp
 *
 * @param {Object} params
 * @param {number} params.lid - League ID
 * @param {number} [params.year] - Season year (defaults to current season)
 * @param {boolean} [params.skip_play_import] - Skip play import step (already done during week finalization)
 * @returns {Promise<Object>} Result with success status and step details
 */
const finalize_season = async ({
  lid,
  year = current_season.year,
  skip_play_import = false
}) => {
  const start_time = Date.now()

  log(`Finalizing season ${year} for league ${lid}`)

  const results = {
    lid,
    year,
    steps_completed: [],
    steps_failed: []
  }

  // Get playoff week configuration from seasons table
  const playoff_config = await get_season_playoff_weeks({ lid, year })

  if (!playoff_config.final_week) {
    log(`No playoff configuration found for league ${lid} year ${year}`)
    return { success: false, results, error: 'No playoff configuration found' }
  }

  const { playoff_weeks } = playoff_config

  log(`Playoff weeks for league ${lid}: ${playoff_weeks.join(', ')}`)

  // Re-import plays for playoff weeks (force update for stat corrections)
  // Skip if plays already imported during week finalization
  if (skip_play_import) {
    log('Skipping play import (already done during week finalization)')
  } else {
    for (const week of playoff_weeks) {
      await run_step({
        name: `import_plays_week_${week}`,
        results,
        logger: log,
        fn: () =>
          import_plays_nfl_v1({
            year,
            week,
            force_update: true,
            ignore_cache: true,
            skip_finalization: true
          })
      })
    }
  }

  // Process stats for playoff weeks (skip aggregates - done once later)
  for (const week of playoff_weeks) {
    await run_step({
      name: `process_stats_week_${week}`,
      results,
      logger: log,
      fn: () => process_stats_for_week({ week, skip_aggregates: true })
    })
  }

  // Process matchups for playoff weeks
  for (const week of playoff_weeks) {
    await run_step({
      name: `process_matchups_week_${week}`,
      results,
      logger: log,
      fn: () => process_matchups({ lid, week })
    })
  }

  // Process playoffs (final standings)
  await run_step({
    name: 'process_playoffs',
    results,
    logger: log,
    fn: () => process_playoffs({ lid, year })
  })

  // Generate all format aggregates (seasonlogs and careerlogs)
  await run_step({
    name: 'process_format_aggregates',
    results,
    logger: log,
    fn: () => process_all_format_aggregates()
  })

  // Process global aggregates (NFL team seasonlogs, player seasonlogs)
  await run_step({
    name: 'process_global_aggregates',
    results,
    logger: log,
    fn: () => process_global_aggregates()
  })

  // Calculate league team and user careerlogs
  await run_step({
    name: 'calculate_league_careerlogs',
    results,
    logger: log,
    fn: () => calculate_league_careerlogs({ lid })
  })

  // Generate next year teams with draft order
  const next_year = year + 1
  await run_step({
    name: 'generate_league_season_teams',
    results,
    logger: log,
    fn: () =>
      generate_league_season_teams({
        lid,
        year: next_year,
        league_settings_year: year
      })
  })

  // Generate next year draft picks (skips if already exist)
  await run_step({
    name: 'generate_draft_picks',
    results,
    logger: log,
    fn: () => generate_draft_picks({ future_year: next_year })
  })

  // Set draft pick numbers based on draft order
  await run_step({
    name: 'set_draft_pick_number',
    results,
    logger: log,
    fn: () => set_draft_pick_number({ lid })
  })

  // Update season_finalized_at timestamp
  const finalization_timestamp = Math.floor(Date.now() / 1000)
  await run_step({
    name: 'update_season_finalized_at',
    results,
    logger: log,
    fn: async () => {
      await db('seasons')
        .where({ lid, year })
        .update({ season_finalized_at: finalization_timestamp })
      log(`Updated season_finalized_at to ${finalization_timestamp}`)
    }
  })

  const total_duration = Date.now() - start_time
  const success = results.steps_failed.length === 0

  log(
    `Season finalization ${success ? 'completed' : 'completed with errors'} in ${total_duration}ms`
  )
  log(`Steps completed: ${results.steps_completed.length}`)
  if (results.steps_failed.length > 0) {
    log(`Steps failed: ${results.steps_failed.map((s) => s.step).join(', ')}`)
  }

  return { success, results }
}

/**
 * Finalize seasons for all hosted leagues
 *
 * @param {Object} params
 * @param {number} [params.year] - Season year (defaults to current season)
 * @param {boolean} [params.skip_play_import] - Skip play import step
 * @returns {Promise<Object>} Combined results for all leagues
 */
const finalize_all_seasons = async ({
  year = current_season.year,
  skip_play_import = false
} = {}) => {
  const league_ids = await get_hosted_league_ids()
  const all_results = []

  log(`Finalizing season ${year} for ${league_ids.length} hosted leagues`)

  for (const lid of league_ids) {
    const result = await finalize_season({ lid, year, skip_play_import })
    all_results.push({ lid, ...result })
  }

  const all_success = all_results.every((r) => r.success)
  return { success: all_success, results: all_results }
}

const main = async () => {
  debug.enable('finalize-season')
  let error
  let finalize_result

  try {
    const argv = initialize_cli()
    const year = argv.year || current_season.year
    const skip_play_import = argv['skip-play-import']

    if (argv.lid) {
      finalize_result = await finalize_season({
        lid: argv.lid,
        year,
        skip_play_import
      })
    } else {
      finalize_result = await finalize_all_seasons({ year, skip_play_import })
    }
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.FINALIZE_SEASON,
    error,
    succ: finalize_result?.success ?? false,
    reason: finalize_result?.success
      ? 'Season finalized successfully'
      : `Season finalization failed: ${error?.message || 'unknown error'}`
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default finalize_season
