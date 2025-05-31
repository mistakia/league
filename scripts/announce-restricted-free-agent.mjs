import debug from 'debug'
import dayjs from 'dayjs'
import db from '#db'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { constants } from '#libs-shared'
import { is_main, sendNotifications, getLeague } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('announce-restricted-free-agent')
debug.enable('announce-restricted-free-agent')

/**
 * Get all leagues that are currently in their restricted free agency period
 * or within one day of starting
 * @returns {Promise<Array>} Array of eligible league objects
 */
const get_eligible_leagues = async () => {
  const current_timestamp = Math.round(Date.now() / 1000)
  const one_day_seconds = 24 * 60 * 60
  const tomorrow_timestamp = current_timestamp + one_day_seconds

  // Get leagues currently in RFA period
  const active_leagues = await db('seasons')
    .select('seasons.*', 'leagues.name as name')
    .join('leagues', 'leagues.uid', '=', 'seasons.lid')
    .where({
      'seasons.year': constants.season.year
    })
    .whereNotNull('tran_start')
    .where('tran_start', '<=', current_timestamp)
    .where('tran_end', '>=', current_timestamp)

  // Get leagues that will start RFA within the next day
  const upcoming_leagues = await db('seasons')
    .select('seasons.*', 'leagues.name as name')
    .join('leagues', 'leagues.uid', '=', 'seasons.lid')
    .where({
      'seasons.year': constants.season.year
    })
    .whereNotNull('tran_start')
    .where('tran_start', '>', current_timestamp)
    .where('tran_start', '<=', tomorrow_timestamp)

  // Combine both sets of leagues
  const eligible_leagues = [...active_leagues, ...upcoming_leagues]

  log(`Found ${active_leagues.length} active leagues in RFA period`)
  log(
    `Found ${upcoming_leagues.length} leagues starting RFA within the next day`
  )
  log(`Total eligible leagues: ${eligible_leagues.length}`)

  return eligible_leagues
}

/**
 * Determines which team should nominate a restricted free agent based on league start date and draft order
 * @param {Object} params - Parameters
 * @param {Object} params.league - League object
 * @param {Array} params.teams - Teams array sorted by draft_order desc
 * @returns {Object} The team that should nominate today
 */
const get_nominating_team = async ({ league, teams, lid }) => {
  const current_date = dayjs().format('YYYY-MM-DD')
  const tran_start_date = dayjs.unix(league.tran_start).format('YYYY-MM-DD')
  const days_since_start = dayjs(current_date).diff(
    dayjs(tran_start_date),
    'day'
  )

  log(`Days since start: ${days_since_start}`)

  // If current date is before tran_start, select the first team
  if (days_since_start < 0) {
    log('Current date is before tran_start, selecting first team')
    return teams[0]
  }

  // Get all teams that have already nominated players this year
  const nominated_teams = await db('transition_bids')
    .select('tid')
    .where({
      lid,
      year: constants.season.year
    })
    .whereNotNull('announced')
    .distinct()

  const nominated_team_ids = nominated_teams.map((t) => t.tid)
  log(
    `Teams that have already nominated: ${nominated_team_ids.length ? nominated_team_ids.join(', ') : 'none'}`
  )

  // Find teams that haven't nominated yet, in draft order priority
  const eligible_teams = teams.filter(
    (team) => !nominated_team_ids.includes(team.uid)
  )

  if (eligible_teams.length === 0) {
    log('All teams have nominated, starting a new rotation')
    // If all teams have nominated, start a new rotation
    const expected_team_index = days_since_start % teams.length
    return teams[expected_team_index]
  }

  // Return the first eligible team (highest draft order that hasn't nominated)
  return eligible_teams[0]
}

const announce_restricted_free_agent = async ({ lid, dry_run = false }) => {
  if (!lid) {
    throw new Error('lid is required')
  }

  if (dry_run) {
    log('DRY RUN MODE: No database changes or notifications will be sent')
  }

  const league = await getLeague({ lid })

  if (!league) {
    throw new Error(`League with lid ${lid} not found`)
  }

  if (!league.tran_start) {
    throw new Error(`League with lid ${lid} does not have a tran_start date`)
  }

  const current_date = dayjs().format('YYYY-MM-DD')
  const tran_end_date = dayjs.unix(league.tran_end).format('YYYY-MM-DD')
  if (dayjs(current_date).isAfter(tran_end_date)) {
    throw new Error(
      `The restricted free agency period has ended on ${tran_end_date}`
    )
  }

  // Get teams sorted by draft_order desc (highest to lowest)
  const teams = await db('teams')
    .where({ lid, year: constants.season.year })
    .orderBy('draft_order', 'desc')

  const nominating_team = await get_nominating_team({ league, teams, lid })

  if (!nominating_team) {
    throw new Error(`No nominating team found for league ${lid}`)
  }

  log(
    `Today's nominating team is ${nominating_team.name} (${nominating_team.abbrv})`
  )

  const transition_bid = await db('transition_bids')
    .where({
      tid: nominating_team.uid,
      lid,
      year: constants.season.year
    })
    .whereNull('cancelled')
    .whereNull('processed')
    .whereNull('announced')
    .whereNotNull('nominated')
    .first()

  if (transition_bid) {
    const player_row = await db('player')
      .where({ pid: transition_bid.pid })
      .first()

    if (!player_row) {
      throw new Error(
        `Player with pid ${transition_bid.pid} for team ${nominating_team.uid} not found`
      )
    }

    if (!dry_run) {
      await db('transition_bids')
        .where({ uid: transition_bid.uid })
        .update({ announced: Math.round(Date.now() / 1000) })
    }

    const message = `${nominating_team.name} (${nominating_team.abbrv}) has announced ${player_row.fname} ${player_row.lname} (${player_row.pos}) as a restricted free agent`

    if (dry_run) {
      log(`DRY RUN: Would send notification: ${message}`)
    } else {
      await sendNotifications({
        league,
        notifyLeague: true,
        message
      })
      log(`Notification sent: ${message}`)
    }
  } else {
    log(`No unprocessed nominated player found for team ${nominating_team.uid}`)
  }
}

const process_all_leagues = async (dry_run = false) => {
  const eligible_leagues = await get_eligible_leagues()

  if (!eligible_leagues.length) {
    log('No eligible leagues found in RFA period')
    return
  }

  for (const league of eligible_leagues) {
    try {
      log(`Processing league ${league.lid} (${league.name || 'Unnamed'})`)
      await announce_restricted_free_agent({ lid: league.lid, dry_run })
    } catch (err) {
      log(`Error processing league ${league.lid}: ${err.message}`)
    }
  }

  log(`Completed processing ${eligible_leagues.length} leagues`)
}

const main = async () => {
  let error
  try {
    const lid = argv.lid
    const dry_run = argv.dry_run || false

    if (lid) {
      // Process specific league if lid is provided
      await announce_restricted_free_agent({ lid, dry_run })
    } else {
      // Process all eligible leagues
      await process_all_leagues(dry_run)
    }
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default announce_restricted_free_agent
