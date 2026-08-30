import debug from 'debug'

import db from '#db'
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
 * IDEMPOTENCY. Finalizing a game whose play data has not changed since the last
 * successful finalization is pure waste, and it was the dominant consumer of
 * CPU on the production host -- every completed game re-finalized roughly 96
 * times a day. The guard below skips that case.
 *
 * It lives HERE rather than at the call site because "do not redo completed
 * work" is a property of finalization, not of whoever invokes it, and because
 * the one production caller is not the only way in.
 *
 * TWO GUARDS, DIFFERENT PATHS. This one is not the only thing stopping repeat
 * work, and knowing which runs where matters -- a comment in the live worker
 * once credited this guard for a path it never executes on:
 *
 * - Every POLLING path (both cron families and the pm2 live worker) is stopped
 *   earlier, by the completed-game skip at import-plays-nfl-v1.mjs, which
 *   returns before finalize_game is called at all. Those callers pass no
 *   force_update.
 * - This guard defends the --final/force_update path, which deliberately
 *   bypasses that skip and is therefore the only way a completed game reaches
 *   finalization. It is what makes the daily --final run cheap instead of a
 *   full re-finalization of every completed game.
 *
 * Neither subsumes the other: the skip cannot defend --final because --final
 * exists to bypass it, and this guard cannot defend polling because it is
 * never reached there.
 *
 * The skip is of finalize_game, NOT of process_all_format_gamelogs. That step
 * is week-scoped and shared across every game in the week, so guarding inside
 * it would need separate per-week state and would break the case where a
 * genuinely changed game must refresh its week.
 *
 * Three routes keep a legitimate re-finalization working:
 *
 * - Corrected play data, the common case, works with no intervention: an
 *   importer writing a real change bumps nfl_plays.updated past the stored
 *   watermark and the next pass finalizes. This depends on the conditional
 *   upsert in upsert-plays.mjs -- without it `updated` advances on every
 *   pass, carries no signal, and this guard would skip nothing.
 * - A new scoring or league format changes nothing in nfl_plays and would be
 *   wrongly skipped, so it takes force_finalize. Format onboarding is a
 *   deliberate operator action rather than a poll, which is the shape an
 *   explicit flag fits.
 * - A change to the finalization pipeline itself uses the same flag.
 *
 * @param {object} params
 * @param {string} params.esbid - Game identifier
 * @param {number} params.season_year - Season year
 * @param {number} params.week - Week number
 * @param {string} params.season_type - Season type (PRE, REG, POST)
 * @param {boolean} params.update_aggregates - If true, also update seasonlogs and careerlogs (default: false)
 * @param {boolean} params.force_finalize - If true, finalize even when the play-data watermark says nothing changed (default: false)
 * @returns {Promise<object>} - Processing results
 */
export const finalize_game = async ({
  esbid,
  season_year,
  week,
  season_type,
  update_aggregates = false,
  force_finalize = false
}) => {
  const start_time = Date.now()

  // Read the watermark BEFORE the first step, not after the last one. A run
  // averages 71 seconds; stamping the completion time would silently claim
  // coverage of any play corrected during the run, and that correction would
  // never re-finalize.
  const { max: plays_updated_at } = await db('nfl_plays')
    .where({ esbid })
    .max('updated as max')
    .first()

  const game = await db('nfl_games')
    .select('finalized_plays_updated_at')
    .where({ esbid })
    .first()
  const finalized_through = game?.finalized_plays_updated_at || null

  const watermark_is_current =
    finalized_through !== null &&
    (plays_updated_at === null || plays_updated_at <= finalized_through)

  if (watermark_is_current && !force_finalize) {
    log(
      `Skipping game finalization for esbid: ${esbid}, play data unchanged since ${finalized_through.toISOString()}`
    )
    return {
      esbid,
      season_year,
      week,
      season_type,
      skipped: true,
      steps_completed: [],
      steps_failed: []
    }
  }

  log(
    `Starting game finalization for esbid: ${esbid}, ${season_year} week ${week}`
  )

  const results = {
    esbid,
    season_year,
    week,
    season_type,
    skipped: false,
    steps_completed: [],
    steps_failed: []
  }

  // Step 1: Import game status and scores
  //
  // This once also called import_nfl_games_ngs({ season_year }) alongside the
  // NFL import, under Promise.all. Three things were wrong with that and only
  // the third was visible:
  //
  // - Both importers blanket-merge home_score, away_score and status onto
  //   nfl_games, so Promise.all ordering decided which source won the scores.
  //   A race over score columns is not something to leave to scheduling.
  // - It was season-scoped on a per-game path: finalizing ONE game re-upserted
  //   the entire season schedule.
  // - Nothing reads what it uniquely supplied. ngs_game_id, ngs_stadium_id and
  //   home_ngs_team_id are write-only columns (positive-control verified), and
  //   a daily 03:00 cron already owns that import.
  //
  // Removing it also retires the dynamic import this step used to need:
  // import-nfl-games-ngs.mjs statically reaches #private, which CI checks out
  // empty, so a static import here aborted the entire mocha run at load rather
  // than failing one test. That is why this module had no coverage at all.
  await run_step({
    name: 'import_games',
    results,
    logger: log,
    fn: () =>
      import_nfl_games_nfl({
        season_year,
        week,
        season_type,
        ignore_cache: true
      })
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

  // Only a fully successful run may claim the watermark. A partial failure that
  // marked the game done would strand whatever the failing step was meant to
  // produce, with nothing to trigger a retry -- the next pass would skip.
  if (success) {
    await db('nfl_games')
      .where({ esbid })
      .update({ finalized_plays_updated_at: plays_updated_at })
  }

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
