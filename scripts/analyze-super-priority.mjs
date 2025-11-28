import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_year } from '#constants'
import { get_super_priority_status, is_main } from '#libs-server'

const log = debug('analyze:super-priority')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('analyze:super-priority')
}

const run = async ({
  year = current_year,
  lid = null,
  pid = null,
  validate = false
} = {}) => {
  log(
    `Analyzing super priority data for year ${year}${lid ? ` league ${lid}` : ' (all leagues)'}${pid ? ` player ${pid}` : ''}`
  )

  if (pid) {
    // Analyze specific player
    await analyze_player({ pid, lid: lid || 1 })
  } else {
    // Analyze all eligible players
    await analyze_all_players({ year, lid, validate })
  }
}

async function analyze_player({ pid, lid }) {
  log(`\n=== ANALYZING PLAYER ${pid} ===`)

  // Get calculated status from source tables
  const calculated_status = await get_super_priority_status({ pid, lid })

  // Get cached status from super_priority table
  const cached_record = await db('super_priority')
    .where({ pid, lid, eligible: 1, claimed: 0 })
    .first()

  // Get player details
  const player = await db('player').where({ pid }).first()

  log(`Player: ${player?.fname} ${player?.lname} (${player?.pos})`)

  log('\n--- Calculated Status (from source tables) ---')
  if (calculated_status.eligible) {
    log(`✓ ELIGIBLE for super priority`)
    log(`  Original team: ${calculated_status.original_tid}`)
    log(`  Poaching team: ${calculated_status.poaching_tid}`)
    log(`  Poach date: ${calculated_status.poach_date?.toLocaleDateString()}`)
    log(`  Weeks since poach: ${calculated_status.weeks_since_poach}`)
  } else {
    log(`✗ NOT ELIGIBLE: ${calculated_status.reason}`)
  }

  log('\n--- Cached Status (from super_priority table) ---')
  if (cached_record) {
    log(`✓ Record found in super_priority table`)
    log(`  Original team: ${cached_record.original_tid}`)
    log(`  Poaching team: ${cached_record.poaching_tid}`)
    log(
      `  Poach timestamp: ${new Date(cached_record.poach_timestamp * 1000).toLocaleDateString()}`
    )
    log(`  Eligible: ${cached_record.eligible ? 'YES' : 'NO'}`)
    log(`  Claimed: ${cached_record.claimed ? 'YES' : 'NO'}`)
  } else {
    log(`✗ No record found in super_priority table`)
  }

  // Check for consistency
  const is_consistent =
    (calculated_status.eligible && cached_record?.eligible) ||
    (!calculated_status.eligible && !cached_record?.eligible)

  log(`\n--- Consistency Check ---`)
  log(`Status: ${is_consistent ? '✓ CONSISTENT' : '✗ INCONSISTENT'}`)

  if (!is_consistent) {
    log(`WARNING: Calculated and cached statuses don't match!`)
    log(`Calculated: ${calculated_status.eligible ? 'eligible' : 'ineligible'}`)
    log(
      `Cached: ${cached_record ? (cached_record.eligible ? 'eligible' : 'ineligible') : 'not found'}`
    )
  }
}

async function analyze_all_players({ year, lid, validate }) {
  // Get overview from super_priority table
  const query = db('super_priority')
    .join('player', 'super_priority.pid', 'player.pid')
    .join('teams as original', 'super_priority.original_tid', 'original.uid')
    .join('teams as poaching', 'super_priority.poaching_tid', 'poaching.uid')
    .where('original.year', year)
    .where('poaching.year', year)
    .select(
      'super_priority.*',
      'player.fname',
      'player.lname',
      'player.pos',
      'original.name as original_team_name',
      'original.abbrv as original_team_abbrv',
      'poaching.name as poaching_team_name',
      'poaching.abbrv as poaching_team_abbrv'
    )

  if (lid) {
    query.where('super_priority.lid', lid)
  }

  const all_records = await query.orderBy(
    'super_priority.poach_timestamp',
    'desc'
  )

  const eligible_records = all_records.filter((r) => r.eligible && !r.claimed)
  const claimed_records = all_records.filter((r) => r.claimed)
  const ineligible_records = all_records.filter((r) => !r.eligible)

  log(`\n=== OVERVIEW ===`)
  log(`Total super priority records: ${all_records.length}`)
  log(`Currently eligible: ${eligible_records.length}`)
  log(`Already claimed: ${claimed_records.length}`)
  log(`Ineligible: ${ineligible_records.length}`)

  if (eligible_records.length > 0) {
    log(`\n=== CURRENTLY ELIGIBLE PLAYERS ===`)
    for (const record of eligible_records) {
      const poach_date = new Date(
        record.poach_timestamp * 1000
      ).toLocaleDateString()
      const days_since = Math.floor(
        (Date.now() / 1000 - record.poach_timestamp) / (24 * 60 * 60)
      )
      log(
        `${record.fname} ${record.lname} (${record.pos}) - ${record.poaching_team_abbrv} → ${record.original_team_abbrv} | Poached: ${poach_date} (${days_since} days ago)`
      )
    }
  }

  if (claimed_records.length > 0) {
    log(`\n=== ALREADY CLAIMED ===`)
    for (const record of claimed_records) {
      const poach_date = new Date(
        record.poach_timestamp * 1000
      ).toLocaleDateString()
      const claimed_date = record.claimed_at
        ? new Date(record.claimed_at * 1000).toLocaleDateString()
        : 'Unknown'
      log(
        `${record.fname} ${record.lname} (${record.pos}) - Claimed: ${claimed_date} | Originally poached: ${poach_date}`
      )
    }
  }

  // Validation mode - check consistency with source tables
  if (validate) {
    log(`\n=== VALIDATION (checking against source tables) ===`)
    let inconsistencies = 0

    for (const record of all_records.slice(0, 20)) {
      // Limit to first 20 for performance
      try {
        const calculated = await get_super_priority_status({
          pid: record.pid,
          lid: record.lid
        })

        const cached_eligible = record.eligible && !record.claimed
        const is_consistent = calculated.eligible === cached_eligible

        if (!is_consistent) {
          inconsistencies++
          log(
            `⚠️  ${record.fname} ${record.lname}: Calculated=${calculated.eligible ? 'eligible' : 'ineligible'}, Cached=${cached_eligible ? 'eligible' : 'ineligible'}`
          )
          if (!calculated.eligible) {
            log(`   Reason: ${calculated.reason}`)
          }
        }
      } catch (error) {
        log(
          `❌ Error validating ${record.fname} ${record.lname}: ${error.message}`
        )
      }
    }

    if (inconsistencies === 0) {
      log(`✓ All checked records are consistent`)
    } else {
      log(
        `⚠️  Found ${inconsistencies} inconsistencies (checked ${Math.min(20, all_records.length)} records)`
      )
    }
  }

  return {
    total: all_records.length,
    eligible: eligible_records.length,
    claimed: claimed_records.length,
    ineligible: ineligible_records.length,
    eligible_players: eligible_records
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
        describe: 'Year to analyze'
      })
      .option('lid', {
        alias: 'l',
        type: 'number',
        describe:
          'League ID to analyze (optional, analyzes all leagues if not specified)'
      })
      .option('pid', {
        alias: 'p',
        type: 'string',
        describe:
          'Player ID to analyze (optional, analyzes specific player if specified)'
      })
      .option('validate', {
        alias: 'v',
        type: 'boolean',
        default: false,
        describe: 'Validate consistency between cached and calculated data'
      })
      .help().argv

    await run({
      year: argv.year,
      lid: argv.lid,
      pid: argv.pid,
      validate: argv.validate
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
