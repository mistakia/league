import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { chunk_array } from '#libs-shared/chunk.mjs'
import { get_canonical_penalty_type } from '#libs-shared/penalty-utils.mjs'

const log = debug('backfill-penalty-type')
debug.enable('backfill-penalty-type')

const backfill_penalty_type = async ({
  year,
  dry_run = false,
  batch_size = 500,
  force = false
} = {}) => {
  const result = {
    plays_queried: 0,
    plays_updated: 0,
    plays_skipped: 0,
    plays_failed: 0
  }

  const table_name = `nfl_plays_year_${year}`

  // Query penalty plays that need backfill
  // Only process enforced penalties (pen_team IS NOT NULL)
  // Declined penalties have pen_team = NULL and don't need penalty_type
  let query = db(table_name)
    .select('esbid', 'playId', 'desc', 'desc_nflfastr', 'pen_team', 'off')
    .where('penalty', true)
    .whereNotNull('pen_team')

  if (!force) {
    query = query.whereNull('penalty_type')
  }

  const penalty_plays = await query

  result.plays_queried = penalty_plays.length
  log(`Found ${penalty_plays.length} penalty plays in ${table_name}`)

  if (penalty_plays.length === 0) {
    log('No plays to process')
    return result
  }

  // Process plays and build updates
  const updates = []
  for (const play of penalty_plays) {
    const penalty_type = get_canonical_penalty_type({
      desc: play.desc,
      desc_nflfastr: play.desc_nflfastr,
      pen_team: play.pen_team,
      off_team: play.off
    })

    if (penalty_type) {
      updates.push({
        esbid: play.esbid,
        playId: play.playId,
        penalty_type
      })
    } else {
      result.plays_failed += 1
      log(
        `Failed to extract penalty type for play ${play.esbid}:${play.playId}`
      )
    }
  }

  log(`Prepared ${updates.length} updates`)

  if (dry_run) {
    log('DRY RUN - no database updates')

    // Show sample of updates
    const sample_size = Math.min(10, updates.length)
    log(`Sample of ${sample_size} updates:`)
    for (let i = 0; i < sample_size; i++) {
      log(
        `  ${updates[i].esbid}:${updates[i].playId} -> ${updates[i].penalty_type}`
      )
    }

    // Show penalty type distribution
    const distribution = {}
    for (const update of updates) {
      distribution[update.penalty_type] =
        (distribution[update.penalty_type] || 0) + 1
    }
    log('Penalty type distribution:')
    const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1])
    for (const [type, count] of sorted.slice(0, 20)) {
      log(`  ${type}: ${count}`)
    }

    result.plays_updated = updates.length
    result.plays_skipped =
      result.plays_queried - updates.length - result.plays_failed
    return result
  }

  // Execute updates in batches within a transaction
  await db.transaction(async (trx) => {
    const update_chunks = chunk_array({
      items: updates,
      chunk_size: batch_size
    })

    for (const chunk of update_chunks) {
      await Promise.all(
        chunk.map(({ esbid, playId, penalty_type }) =>
          trx(table_name).where({ esbid, playId }).update({ penalty_type })
        )
      )
      log(`Updated ${chunk.length} plays`)
    }
  })

  result.plays_updated = updates.length
  result.plays_skipped =
    result.plays_queried - updates.length - result.plays_failed

  log(`Backfill complete for ${year}:`)
  log(`  Queried: ${result.plays_queried}`)
  log(`  Updated: ${result.plays_updated}`)
  log(`  Skipped: ${result.plays_skipped}`)
  log(`  Failed: ${result.plays_failed}`)

  return result
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('year', {
        alias: 'y',
        type: 'number',
        description: 'Year to process'
      })
      .option('all', {
        alias: 'a',
        type: 'boolean',
        description: 'Process all years (2000-2024)',
        default: false
      })
      .option('dry-run', {
        alias: 'd',
        type: 'boolean',
        description: 'Preview changes without updating database',
        default: false
      })
      .option('batch-size', {
        alias: 'b',
        type: 'number',
        description: 'Batch size for updates',
        default: 500
      })
      .option('force', {
        alias: 'f',
        type: 'boolean',
        description: 'Overwrite existing penalty_type values',
        default: false
      })
      .check((argv) => {
        if (!argv.year && !argv.all) {
          throw new Error('Must specify --year or --all')
        }
        return true
      })
      .parse()

    const years_to_process = argv.all
      ? Array.from({ length: 25 }, (_, i) => 2024 - i) // 2024 down to 2000
      : [argv.year]

    const total_result = {
      plays_queried: 0,
      plays_updated: 0,
      plays_skipped: 0,
      plays_failed: 0
    }

    for (const year of years_to_process) {
      log(`\n--- Processing year ${year} ---`)
      const result = await backfill_penalty_type({
        year,
        dry_run: argv.dryRun,
        batch_size: argv.batchSize,
        force: argv.force
      })

      total_result.plays_queried += result.plays_queried
      total_result.plays_updated += result.plays_updated
      total_result.plays_skipped += result.plays_skipped
      total_result.plays_failed += result.plays_failed
    }

    log('\n=== TOTAL SUMMARY ===')
    log(`Years processed: ${years_to_process.length}`)
    log(`Total plays queried: ${total_result.plays_queried}`)
    log(`Total plays updated: ${total_result.plays_updated}`)
    log(`Total plays skipped: ${total_result.plays_skipped}`)
    log(`Total plays failed: ${total_result.plays_failed}`)
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.BACKFILL_PENALTY_TYPE,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default backfill_penalty_type
