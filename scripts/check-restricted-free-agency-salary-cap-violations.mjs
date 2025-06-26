import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, Roster } from '#libs-shared'
import { is_main, getLeague, getRoster, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('check-restricted-free-agency-salary-cap-violations')
debug.enable('check-restricted-free-agency-salary-cap-violations')

// Constants for better maintainability
const CURRENT_YEAR = constants.season.year
const OFFSEASON_WEEK = 0
const RESTRICTED_FREE_AGENCY_TAG_TYPE =
  constants.transactions.RESTRICTED_FREE_AGENCY_TAG

/**
 * Get leagues that have had restricted free agency transactions this season
 */
const get_leagues_with_restricted_free_agency_transactions = async () => {
  return await db('seasons')
    .select('seasons.*', 'leagues.name as league_name')
    .join('leagues', 'leagues.uid', '=', 'seasons.lid')
    .where('seasons.year', CURRENT_YEAR)
    .whereExists(function () {
      this.select('*')
        .from('transactions')
        .where('transactions.lid', db.raw('seasons.lid'))
        .where('transactions.year', CURRENT_YEAR)
        .where('transactions.type', RESTRICTED_FREE_AGENCY_TAG_TYPE)
    })
    .distinct()
}

/**
 * Get teams that had restricted free agency transactions in a specific league
 */
const get_teams_with_restricted_free_agency_transactions = async ({ lid }) => {
  return await db('transactions')
    .select('tid')
    .where('lid', lid)
    .where('year', CURRENT_YEAR)
    .where('type', RESTRICTED_FREE_AGENCY_TAG_TYPE)
    .groupBy('tid')
}

/**
 * Get team details for display purposes
 */
const get_team_display_name = async ({ tid }) => {
  const team = await db('teams')
    .select('name', 'abbrv')
    .where('uid', tid)
    .where('year', CURRENT_YEAR)
    .first()

  return team ? `${team.name} (${team.abbrv})` : `Team ${tid}`
}

/**
 * Get restricted free agency transactions for a specific team
 */
const get_restricted_free_agency_transactions = async ({ tid, lid }) => {
  return await db('transactions')
    .leftJoin('player', 'transactions.pid', 'player.pid')
    .select('transactions.*', 'player.fname', 'player.lname', 'player.pos')
    .where('transactions.tid', tid)
    .where('transactions.lid', lid)
    .where('transactions.year', CURRENT_YEAR)
    .where('transactions.type', RESTRICTED_FREE_AGENCY_TAG_TYPE)
    .orderBy('transactions.timestamp', 'desc')
}

/**
 * Format player name for display
 */
const format_player_name = ({ fname, lname, pos, pid }) => {
  return fname && lname ? `${fname} ${lname} (${pos})` : `Player ${pid}`
}

/**
 * Log restricted free agency transactions for a team
 */
const log_restricted_free_agency_transactions = async ({ tid, lid }) => {
  const restricted_free_agency_transactions =
    await get_restricted_free_agency_transactions({ tid, lid })

  if (restricted_free_agency_transactions.length) {
    log(`   - Recent restricted free agency transactions:`)
    for (const transaction of restricted_free_agency_transactions) {
      const player_name = format_player_name(transaction)
      const transaction_type = 'Restricted Free Agency Tagged'
      log(
        `     - ${player_name}: ${transaction_type}, Value: $${transaction.value || 'N/A'}`
      )
    }
  }
}

/**
 * Check salary cap compliance for a specific team
 */
const check_team_salary_cap = async ({ tid, lid, league }) => {
  const team_name = await get_team_display_name({ tid })

  try {
    // Get current roster (week 0 for offseason)
    const roster_data = await getRoster({
      tid,
      week: OFFSEASON_WEEK,
      year: CURRENT_YEAR
    })

    if (!roster_data) {
      log(`Could not load roster for ${team_name}`)
      return { violation: false, team_name }
    }

    // Create Roster object to calculate salary cap
    const roster = new Roster({
      roster: roster_data,
      league
    })

    const available_cap = roster.availableCap
    const is_over_cap = available_cap < 0

    if (is_over_cap) {
      const overage = Math.abs(available_cap)
      log(
        `❌ SALARY CAP VIOLATION: ${team_name} is $${overage} over the salary cap`
      )

      // Log additional details about the roster
      const active_players = roster.active
      const total_salary = active_players.reduce(
        (sum, player) => sum + player.value,
        0
      )

      log(`   - Total salary: $${total_salary}`)
      log(`   - Salary cap: $${league.cap}`)
      log(`   - Overage: $${overage}`)
      log(`   - Active players: ${active_players.length}`)

      // Show restricted free agency transactions for this team
      await log_restricted_free_agency_transactions({ tid, lid })

      return { violation: true, team_name, overage }
    } else {
      log(`✅ ${team_name} is under salary cap (Available: $${available_cap})`)
      return { violation: false, team_name }
    }
  } catch (error) {
    log(`Error checking salary cap for ${team_name}: ${error.message}`)
    return { violation: false, team_name, error: error.message }
  }
}

/**
 * Process salary cap checks for all teams in a league
 */
const process_league_salary_cap_checks = async ({ league_data }) => {
  const { lid, league_name } = league_data

  log(`\nProcessing league ${lid} (${league_name || 'Unnamed'})`)

  // Get full league details for salary cap calculation
  const league = await getLeague({ lid })

  if (!league) {
    log(`Could not load league details for ${lid}`)
    return { teams_checked: 0, violations: 0 }
  }

  // Get teams that had restricted free agency transactions this season
  const teams_with_restricted_free_agency =
    await get_teams_with_restricted_free_agency_transactions({ lid })

  log(
    `Found ${teams_with_restricted_free_agency.length} teams with restricted free agency transactions in league ${lid}`
  )

  if (!teams_with_restricted_free_agency.length) {
    return { teams_checked: 0, violations: 0 }
  }

  let league_violations = 0
  const league_teams_checked = teams_with_restricted_free_agency.length

  // Check salary cap for each team
  for (const { tid } of teams_with_restricted_free_agency) {
    const result = await check_team_salary_cap({ tid, lid, league })
    if (result.violation) {
      league_violations++
    }
  }

  return { teams_checked: league_teams_checked, violations: league_violations }
}

const script = async ({ dry_run = false } = {}) => {
  if (dry_run) {
    log('DRY RUN MODE: No database changes will be made')
  }

  log(
    'Starting salary cap violation check for teams with restricted free agency transactions'
  )

  // Get all active leagues that have had restricted free agency transactions this season
  const active_leagues =
    await get_leagues_with_restricted_free_agency_transactions()

  log(
    `Found ${active_leagues.length} active leagues with restricted free agency transactions this season`
  )

  if (!active_leagues.length) {
    log('No active leagues found with restricted free agency transactions')
    return
  }

  let total_violations = 0
  let total_teams_checked = 0

  // Process each league
  for (const league_data of active_leagues) {
    const { teams_checked, violations } =
      await process_league_salary_cap_checks({ league_data })
    total_teams_checked += teams_checked
    total_violations += violations
  }

  // Summary
  log(`\n=== SALARY CAP VIOLATION SUMMARY ===`)
  log(`Teams checked: ${total_teams_checked}`)
  log(`Salary cap violations found: ${total_violations}`)

  if (total_violations > 0) {
    log(
      `⚠️  ${total_violations} team(s) are over the salary cap and need to make roster moves`
    )
  } else {
    log(
      `✅ All teams with restricted free agency transactions are compliant with salary cap`
    )
  }
}

const main = async () => {
  let error
  try {
    const dry_run = argv.dry_run || false
    await script({ dry_run })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.CALCULATE_FRANCHISE_TAGS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default script
