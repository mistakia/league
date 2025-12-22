import debug from 'debug'

import { report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  run_step,
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

const log = debug('finalize-game')
debug.enable('finalize-game')

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
 * @param {Object} params
 * @param {string} params.esbid - Game identifier
 * @param {number} params.year - Season year
 * @param {number} params.week - Week number
 * @param {string} params.seas_type - Season type (PRE, REG, POST)
 * @param {boolean} params.update_aggregates - If true, also update seasonlogs and careerlogs (default: false)
 * @returns {Promise<Object>} - Processing results
 */
export const finalize_game = async ({
  esbid,
  year,
  week,
  seas_type,
  update_aggregates = false
}) => {
  const start_time = Date.now()
  log(`Starting game finalization for esbid: ${esbid}, ${year} week ${week}`)

  const results = {
    esbid,
    year,
    week,
    seas_type,
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
        import_nfl_games_nfl({ year, week, seas_type, ignore_cache: true }),
        import_nfl_games_ngs({ year })
      ])
  })

  // Step 2: Process plays (enrich with player IDs, play types, etc.)
  await run_step({
    name: 'process_plays',
    results,
    logger: log,
    fn: () => process_plays({ year, week, seas_type, esbid })
  })

  // Step 3: Generate base player gamelogs
  await run_step({
    name: 'generate_gamelogs',
    results,
    logger: log,
    fn: () => generate_player_gamelogs({ year, week, seas_type, esbid })
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
    fn: () => generate_player_snaps_for_week({ year, week, seas_type })
  })

  // Step 6: Process market results
  await run_step({
    name: 'process_markets',
    results,
    logger: log,
    fn: () => process_market_results({ year, week, seas_type, esbids: [esbid] })
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

  await report_job({
    job_type: job_types.FINALIZE_GAME,
    succ: success,
    reason: success
      ? `Finalized game ${esbid} in ${total_duration}ms`
      : `Finalized game ${esbid} with ${results.steps_failed.length} failures`,
    timestamp: Math.round(start_time / 1000)
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
