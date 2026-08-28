import debug from 'debug'

import { report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  run_step,
  format_step_failures,
  process_all_format_gamelogs,
  process_all_format_aggregates,
  process_global_aggregates
} from '#libs-server/stats-pipeline.mjs'

import import_nfl_games_nfl from '#scripts/import-nfl-games-nfl.mjs'
import import_nfl_games_ngs from '#scripts/import-nfl-games-ngs.mjs'
import process_plays from '#scripts/process-plays.mjs'
import generate_player_gamelogs from '#scripts/generate-player-gamelogs.mjs'
import generate_player_snaps_for_week from '#scripts/generate-player-snaps.mjs'
import { process_market_results } from '#scripts/process-market-results.mjs'
import { update_market_settlement_status } from '#scripts/update-market-settlement-status.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('finalize-game')
enable_debug_namespaces('finalize-game')

/**
 * Finalize a single game after END_GAME detection
 * Orchestrates all per-game processing including:
 * - Game status import
 * - Play enrichment
 * - Gamelog generation
 * - Scoring format stats
 * - League format stats
 * - Player snaps
 * - Market results processing
 * - Optional: Seasonlog and careerlog aggregate updates
 *
 * @param {object} params
 * @param {string} params.esbid - Game identifier
 * @param {number} params.season_year - Season year
 * @param {number} params.week - Week number
 * @param {string} params.season_type - Season type (PRE, REG, POST)
 * @param {boolean} params.update_aggregates - If true, also update seasonlogs and careerlogs (default: false)
 * @returns {Promise<object>} - Processing results
 */
export const finalize_game = async ({
  esbid,
  season_year,
  week,
  season_type,
  update_aggregates = false
}) => {
  const start_time = Date.now()
  log(
    `Starting game finalization for esbid: ${esbid}, ${season_year} week ${week}`
  )

  const results = {
    esbid,
    season_year,
    week,
    season_type,
    steps_completed: [],
    steps_failed: []
  }

  // Step 1: Import game status and scores
  await run_step({
    name: 'import_games',
    results,
    logger: log,
    fn: () =>
      Promise.all([
        import_nfl_games_nfl({
          season_year,
          week,
          season_type,
          ignore_cache: true
        }),
        import_nfl_games_ngs({ season_year })
      ])
  })

  // Step 2: Process plays (enrich with player IDs, play types, etc.)
  await run_step({
    name: 'process_plays',
    results,
    logger: log,
    fn: () => process_plays({ season_year, week, season_type, esbid })
  })

  // Step 3: Generate base player gamelogs
  await run_step({
    name: 'generate_gamelogs',
    results,
    logger: log,
    fn: () =>
      generate_player_gamelogs({ season_year, week, season_type, esbid })
  })

  // Step 4: Process scoring and league format gamelogs
  await run_step({
    name: 'process_formats',
    results,
    logger: log,
    fn: () => process_all_format_gamelogs({ week })
  })

  // Step 5: Generate player snaps
  await run_step({
    name: 'generate_snaps',
    results,
    logger: log,
    fn: () => generate_player_snaps_for_week({ season_year, week, season_type })
  })

  // Step 6: Process market results
  await run_step({
    name: 'process_markets',
    results,
    logger: log,
    fn: () =>
      process_market_results({
        season_year,
        week,
        season_type,
        esbids: [esbid]
      })
  })

  // Step 7: Update market settlement status
  await run_step({
    name: 'update_settlement_status',
    results,
    logger: log,
    fn: () => update_market_settlement_status({ esbids: [esbid] })
  })

  // Step 8: Optional aggregate updates (seasonlogs and careerlogs)
  if (update_aggregates) {
    log('Running aggregate updates (seasonlogs and careerlogs)...')

    await run_step({
      name: 'update_format_aggregates',
      results,
      logger: log,
      fn: () => process_all_format_aggregates()
    })

    await run_step({
      name: 'update_global_aggregates',
      results,
      logger: log,
      fn: () => process_global_aggregates()
    })
  }

  // Report job completion
  const total_duration = Date.now() - start_time
  const success = results.steps_failed.length === 0

  // Everything needed to name the failing step is in `results.steps_failed`
  // here. Reporting only a COUNT threw it away, and recovering it afterwards
  // meant an SSH to the worker host and a grep of its log.
  await report_job({
    job_type: job_types.FINALIZE_GAME,
    job_success: success,
    job_reason: success
      ? `Finalized game ${esbid} in ${total_duration}ms`
      : `Finalized game ${esbid}: ${format_step_failures({
          steps_failed: results.steps_failed,
          total_steps:
            results.steps_completed.length + results.steps_failed.length
        })}`
  })

  log(
    `Game finalization ${success ? 'completed' : 'completed with errors'} for esbid: ${esbid} in ${total_duration}ms`
  )
  log(`Steps completed: ${results.steps_completed.join(', ')}`)
  if (results.steps_failed.length > 0) {
    log(`Steps failed: ${results.steps_failed.map((s) => s.step).join(', ')}`)
  }

  return results
}

export default finalize_game
