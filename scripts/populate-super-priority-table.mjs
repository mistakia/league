import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { transaction_types, current_year } from '#constants'
import { get_super_priority_status, is_main } from '#libs-server'

const log = debug('populate:super-priority')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('populate:super-priority')
}

const run = async ({
  year = current_year,
  lid = null,
  dry_run = false
} = {}) => {
  log(
    `Populating super priority table for year ${year}${lid ? ` league ${lid}` : ' (all leagues)'}${dry_run ? ' (DRY RUN)' : ''}`
  )

  // Build query for POACHED transactions
  const query = db('transactions')
    .where({
      type: transaction_types.POACHED,
      year
    })
    .orderBy('timestamp', 'desc')

  // Filter by league if specified
  if (lid) {
    query.where('lid', lid)
  }

  const poached_transactions = await query

  log(`Found ${poached_transactions.length} poached transactions in ${year}`)

  let processed = 0
  let eligible_count = 0
  let ineligible_count = 0
  let errors = 0
  const eligible_players_processed = []

  for (const poach_tx of poached_transactions) {
    try {
      processed++

      if (processed % 50 === 0) {
        log(
          `Progress: ${processed}/${poached_transactions.length} transactions processed`
        )
      }

      // Calculate current super priority status from source tables
      const status = await get_super_priority_status({
        pid: poach_tx.pid,
        lid: poach_tx.lid
      })

      if (status.eligible) {
        eligible_count++

        // Get player details for tracking
        const [player_details, original_team, poaching_team] =
          await Promise.all([
            db('player').where('pid', poach_tx.pid).first(),
            db('teams').where('uid', status.original_tid).first(),
            db('teams').where('uid', status.poaching_tid).first()
          ])

        if (player_details && original_team && poaching_team) {
          eligible_players_processed.push({
            fname: player_details.fname,
            lname: player_details.lname,
            pos: player_details.pos,
            original_team_name: original_team.name,
            original_team_abbrv: original_team.abbrv,
            poaching_team_name: poaching_team.name,
            poaching_team_abbrv: poaching_team.abbrv,
            pid: poach_tx.pid,
            original_tid: status.original_tid,
            poaching_tid: status.poaching_tid,
            poach_timestamp: poach_tx.timestamp,
            lid: poach_tx.lid
          })
        }

        if (!dry_run) {
          // Insert or update super priority record
          await db('super_priority')
            .insert({
              pid: poach_tx.pid,
              original_tid: status.original_tid,
              poaching_tid: status.poaching_tid,
              lid: poach_tx.lid,
              poach_timestamp: poach_tx.timestamp,
              eligible: 1,
              claimed: 0,
              claimed_at: null,
              requires_waiver: 0
            })
            .onConflict([
              'pid',
              'original_tid',
              'poaching_tid',
              'lid',
              'poach_timestamp'
            ])
            .merge({
              eligible: 1,
              poach_timestamp: poach_tx.timestamp,
              claimed: 0,
              claimed_at: null
            })
        }

        log(
          `✓ Eligible: ${poach_tx.pid} (poached by team ${status.poaching_tid}, original team ${status.original_tid})`
        )
      } else {
        ineligible_count++

        if (!dry_run) {
          // Mark existing records as ineligible if they exist
          await db('super_priority')
            .where({
              pid: poach_tx.pid,
              lid: poach_tx.lid
            })
            .update({ eligible: 0 })
        }

        log(`✗ Ineligible: ${poach_tx.pid} - ${status.reason}`)
      }
    } catch (error) {
      errors++
      log(`Error processing ${poach_tx.pid}: ${error.message}`)
    }
  }

  // Summary
  log('\n=== SUMMARY ===')
  log(`Total transactions processed: ${processed}`)
  log(`Eligible for super priority: ${eligible_count}`)
  log(`Ineligible: ${ineligible_count}`)
  log(`Errors: ${errors}`)

  if (eligible_players_processed.length > 0) {
    log('\n=== ELIGIBLE PLAYERS ===')
    for (const player of eligible_players_processed) {
      const poach_date = new Date(
        player.poach_timestamp * 1000
      ).toLocaleDateString()
      log(
        `${player.fname} ${player.lname} (${player.pos}) - Poached by ${player.poaching_team_abbrv} from ${player.original_team_abbrv} on ${poach_date}`
      )
    }
  }

  if (dry_run) {
    log('\n*** DRY RUN - No changes made to database ***')
  }

  return {
    processed,
    eligible_count,
    ineligible_count,
    errors,
    eligible_players: eligible_players_processed
  }
}

export default run

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('year', {
        alias: 'y',
        type: 'number',
        default: current_year,
        describe: 'Year to process'
      })
      .option('lid', {
        alias: 'l',
        type: 'number',
        describe:
          'League ID to process (optional, processes all leagues if not specified)'
      })
      .option('dry-run', {
        alias: 'd',
        type: 'boolean',
        default: false,
        describe: 'Run in dry-run mode without making database changes'
      })
      .help().argv

    const result = await run({
      year: argv.year,
      lid: argv.lid,
      dry_run: argv['dry-run']
    })

    log('\nScript completed successfully')
    console.log(
      `Processed: ${result.processed}, Eligible: ${result.eligible_count}, Ineligible: ${result.ineligible_count}`
    )
  } catch (err) {
    error = err
    console.log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
