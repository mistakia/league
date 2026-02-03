import debug from 'debug'
import dayjs from 'dayjs'

import db from '#db'
import { current_season } from '#constants'
import { is_main, report_job, get_season_playoff_weeks } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  run_step,
  get_hosted_league_ids
} from '#libs-server/stats-pipeline.mjs'

import import_plays_nfl_v1 from '#scripts/import-plays-nfl-v1.mjs'
import process_stats_for_week from '#scripts/process-stats-for-week.mjs'
import process_matchups from '#scripts/process-matchups.mjs'
import process_playoffs from '#scripts/process-playoffs.mjs'
import calculate_league_careerlogs from '#scripts/calculate-league-careerlogs.mjs'
import { process_market_results } from '#scripts/process-market-results.mjs'
import { update_market_settlement_status } from '#scripts/update-market-settlement-status.mjs'
import calculate_team_historical_hit_rates from '#scripts/calculate-team-historical-hit-rates.mjs'
import finalize_season from '#private/scripts/finalize-season.mjs'

const log = debug('finalize-week')

/**
 * Clear temporary live play tables after week finalization
 */
const clear_live_plays = async () => {
  await db('nfl_plays_current_week').del()
  await db('nfl_play_stats_current_week').del()
}

/**
 * Calculate the target week to finalize based on current day
 *
 * Uses nfl_seas_week which correctly handles both regular season (1-18)
 * and playoffs (1-4). On Tuesday/Wednesday, processes previous week
 * since games typically finish by Monday.
 *
 * Exception: During Super Bowl week (playoff week 4), always returns week 4
 * since it's the final week - there's no "next week" to be in, and subtracting
 * would incorrectly re-process the Conference Championship.
 *
 * @returns {number} The target week number for the current seas_type
 */
const get_finalize_target_week = () => {
  const day = dayjs().day()
  const current_nfl_week = current_season.nfl_seas_week
  const seas_type = current_season.nfl_seas_type

  // Super Bowl (playoff week 4) is the final week - always finalize it directly
  const is_super_bowl_week = seas_type === 'POST' && current_nfl_week === 4
  if (is_super_bowl_week) {
    return current_nfl_week
  }

  // On Tuesday (2) or Wednesday (3), process previous week
  const should_process_previous = [2, 3].includes(day)
  return Math.max(
    should_process_previous ? current_nfl_week - 1 : current_nfl_week,
    1
  )
}

/**
 * Finalize a completed NFL week
 *
 * Scheduled via cron (crontab-worker-1.cron) to run Tuesday/Wednesday after each NFL week.
 * Uses nfl_seas_week (not overall week) to correctly handle both regular season
 * and playoff weeks. The week parameter matches nfl_games table conventions:
 * - Regular season: week 1-18
 * - Playoffs: week 1-4 (Wild Card, Divisional, Conference, Super Bowl)
 *
 * Pipeline:
 * 1. Final play import (force update for stat corrections, skip_finalization=true)
 * 2. Process stats for week (gamelogs, seasonlogs, careerlogs)
 * 3. Process matchups for all hosted leagues
 * 4. Process playoffs for all hosted leagues
 * 5. Calculate league careerlogs for all hosted leagues
 * 6. Process market results (betting settlement)
 * 7. Update market settlement status
 * 8. Calculate team historical hit rates
 * 9. Clear temporary live play tables
 * 10. Trigger season finalization (if week after final championship week)
 */
const finalize_week = async () => {
  const week = get_finalize_target_week()
  const year = current_season.year
  const seas_type = current_season.nfl_seas_type
  const start_time = Date.now()

  log(`Finalizing ${seas_type} week ${week} for ${year}`)

  const results = {
    week,
    year,
    seas_type,
    steps_completed: [],
    steps_failed: []
  }

  // Step 1: Final play import
  await run_step({
    name: 'import_plays',
    results,
    logger: log,
    fn: () =>
      import_plays_nfl_v1({
        week,
        seas_type,
        force_update: true,
        ignore_cache: true,
        skip_finalization: true // Per-game finalization already done during live import
      })
  })

  // Step 2: Process stats for the week (includes all format processing)
  await run_step({
    name: 'process_stats_for_week',
    results,
    logger: log,
    fn: () => process_stats_for_week({ week })
  })

  // Step 3-5: Process all hosted leagues
  const league_ids = await get_hosted_league_ids()
  for (const lid of league_ids) {
    await run_step({
      name: `process_matchups_${lid}`,
      results,
      logger: log,
      fn: () => process_matchups({ lid })
    })

    await run_step({
      name: `process_playoffs_${lid}`,
      results,
      logger: log,
      fn: () => process_playoffs({ lid, year })
    })

    await run_step({
      name: `calculate_careerlogs_${lid}`,
      results,
      logger: log,
      fn: () => calculate_league_careerlogs({ lid })
    })
  }

  // Step 6: Process market results for the week
  await run_step({
    name: 'process_market_results',
    results,
    logger: log,
    fn: () =>
      process_market_results({
        year,
        week,
        seas_type
      })
  })

  // Step 7: Update market settlement status
  await run_step({
    name: 'update_settlement_status',
    results,
    logger: log,
    fn: () =>
      update_market_settlement_status({
        year,
        week,
        seas_type
      })
  })

  // Step 8: Calculate team historical hit rates
  await run_step({
    name: 'calculate_team_hit_rates',
    results,
    logger: log,
    fn: () =>
      calculate_team_historical_hit_rates({
        year,
        current_week_only: true
      })
  })

  // Step 9: Clear temporary live play tables
  await run_step({
    name: 'clear_live_plays',
    results,
    logger: log,
    fn: () => clear_live_plays()
  })

  // Step 10: Trigger season finalization when championship has concluded
  // This runs when finalize-week processes the week AFTER the final championship week.
  // Example: If championship is week 17, this triggers when week 18 is finalized.
  // skip_play_import=true because playoff week plays were already imported in step 1.
  for (const lid of league_ids) {
    const playoff_config = await get_season_playoff_weeks({ lid, year })
    if (playoff_config.final_week && week === playoff_config.final_week + 1) {
      log(
        `Week ${week} follows final championship week ${playoff_config.final_week} for league ${lid}, triggering season finalization`
      )
      await run_step({
        name: `finalize_season_${lid}`,
        results,
        logger: log,
        fn: () => finalize_season({ lid, year, skip_play_import: true })
      })
    }
  }

  const total_duration = Date.now() - start_time
  const success = results.steps_failed.length === 0

  log(
    `Week finalization ${success ? 'completed' : 'completed with errors'} in ${total_duration}ms`
  )
  log(`Steps completed: ${results.steps_completed.length}`)
  if (results.steps_failed.length > 0) {
    log(`Steps failed: ${results.steps_failed.map((s) => s.step).join(', ')}`)
  }

  return { success, results }
}

const main = async () => {
  debug.enable('finalize-week')
  let error
  let finalize_result

  try {
    finalize_result = await finalize_week()
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.FINALIZE_WEEK,
    error,
    succ: finalize_result?.success ?? false,
    reason: finalize_result?.success
      ? `Week finalized successfully`
      : `Week finalization failed: ${error?.message || 'unknown error'}`
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default finalize_week
