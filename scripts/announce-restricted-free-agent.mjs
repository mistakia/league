import debug from 'debug'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import db from '#db'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { constants } from '#libs-shared'
import { is_main, sendNotifications, getLeague, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

// Initialize dayjs plugins
dayjs.extend(utc)
dayjs.extend(timezone)

const argv = yargs(hideBin(process.argv)).argv
const log = debug('announce-restricted-free-agent')
debug.enable('announce-restricted-free-agent')

/**
 * Calculate the correct announced timestamp based on the league's announcement hour
 * @param {Object} league - League object with announcement hour settings
 * @returns {Object} - The correct timestamp and information about announcement timing
 */
const calculate_announcement_timestamp = (league) => {
  // Get current date and time in EST
  const current_date_est = dayjs().tz('America/New_York')
  const current_hour_est = current_date_est.hour()

  // Get the configured announcement hour or use default
  const announcement_hour =
    league.restricted_free_agency_announcement_hour !== undefined
      ? league.restricted_free_agency_announcement_hour
      : constants.league_default_restricted_free_agency_announcement_hour

  // Handle special case for hour 24 (midnight)
  const target_hour = announcement_hour === 24 ? 0 : announcement_hour

  // Calculate the timestamp for today's announcement time
  const today_announcement_time = dayjs(current_date_est)
    .hour(target_hour)
    .minute(0)
    .second(0)
    .unix()

  // Check if we've already passed today's announcement time
  const is_after_announcement_time = current_hour_est >= target_hour

  // If we're before the announcement time, we can't announce yet
  const can_announce = is_after_announcement_time

  // Calculate the correct timestamp for the announcement
  const correct_timestamp = today_announcement_time

  // Calculate the next valid announcement time (either today or tomorrow)
  const next_announcement_time = is_after_announcement_time
    ? dayjs(current_date_est)
        .add(1, 'day')
        .hour(target_hour)
        .minute(0)
        .second(0)
        .unix()
    : today_announcement_time

  return {
    announcement_hour,
    correct_timestamp,
    next_announcement_time,
    can_announce,
    is_after_announcement_time,
    current_hour_est
  }
}

/**
 * Get all leagues that are currently in their restricted free agency period
 * and should be announcing today
 * @returns {Promise<Array>} Array of eligible league objects
 */
const get_eligible_leagues = async () => {
  const current_timestamp = Math.round(Date.now() / 1000)

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

  log(`Found ${active_leagues.length} active leagues in RFA period`)

  if (!active_leagues.length) {
    return []
  }

  // Get announcement timing info for each league and filter those eligible
  const eligible_leagues = []

  for (const league of active_leagues) {
    const timing_info = calculate_announcement_timestamp(league)
    league.announcement_info = timing_info

    log(
      `League ${league.lid} (${league.name || 'Unnamed'}) announcement hour: ${timing_info.announcement_hour}, ` +
        `current hour: ${timing_info.current_hour_est}, can announce: ${timing_info.can_announce}, ` +
        `next announcement time: ${dayjs.unix(timing_info.next_announcement_time).format('YYYY-MM-DD HH:mm:ss')}`
    )

    if (timing_info.can_announce || argv.dry_run) {
      eligible_leagues.push(league)
    }
  }

  log(
    `${eligible_leagues.length} leagues are eligible for announcements at the current hour or included in dry run output`
  )

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

  // Calculate the correct timestamp for the announcement
  const announcement_info = calculate_announcement_timestamp(league)

  if (!dry_run && !announcement_info.can_announce) {
    const next_time = dayjs
      .unix(announcement_info.next_announcement_time)
      .format('YYYY-MM-DD HH:mm:ss')
    throw new Error(
      `Cannot announce yet. The next valid announcement time is ${next_time} (hour: ${announcement_info.announcement_hour})`
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

    // Use the calculated correct timestamp for the announcement
    const announcement_timestamp = announcement_info.correct_timestamp

    const message = `${nominating_team.name} (${nominating_team.abbrv}) has announced ${player_row.fname} ${player_row.lname} (${player_row.pos}) as a restricted free agent`

    if (dry_run) {
      const announcement_time = dayjs
        .unix(announcement_timestamp)
        .format('YYYY-MM-DD HH:mm:ss')
      log(
        `DRY RUN: Would announce at ${announcement_time} with timestamp ${announcement_timestamp}`
      )
      log(`DRY RUN: Would send notification: ${message}`)

      // Check if we're before the announcement time
      if (!announcement_info.can_announce) {
        const next_time = dayjs
          .unix(announcement_info.next_announcement_time)
          .format('YYYY-MM-DD HH:mm:ss')
        log(
          `DRY RUN: Cannot announce yet. The next valid announcement time would be ${next_time}`
        )
      }
    } else {
      // Update the database with the calculated announcement timestamp
      await db('transition_bids')
        .where({ uid: transition_bid.uid })
        .update({ announced: announcement_timestamp })

      await sendNotifications({
        league,
        notifyLeague: true,
        message
      })

      log(
        `Announcement timestamp set to ${dayjs.unix(announcement_timestamp).format('YYYY-MM-DD HH:mm:ss')}`
      )
      log(`Notification sent: ${message}`)
    }
  } else {
    log(`No unprocessed nominated player found for team ${nominating_team.uid}`)
  }
}

const process_all_leagues = async (dry_run = false) => {
  const eligible_leagues = await get_eligible_leagues()

  if (!eligible_leagues.length) {
    log('No eligible leagues found for RFA announcements at the current hour')
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
  const lid = argv.lid
  const dry_run = argv.dry_run || false

  try {
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

  if (!dry_run) {
    await report_job({
      job_type: job_types.ANNOUNCE_RESTRICTED_FREE_AGENT,
      error
    })
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default announce_restricted_free_agent
