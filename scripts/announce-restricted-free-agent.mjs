import debug from 'debug'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import db from '#db'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  current_season,
  league_default_rfa_announcement_hour
} from '#constants'
import { is_main, sendNotifications, getLeague, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

// Initialize dayjs plugins
dayjs.extend(utc)
dayjs.extend(timezone)

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('announce-restricted-free-agent')
debug.enable('announce-restricted-free-agent')

/**
 * Calculate the correct announced timestamp based on the league's announcement hour
 * @param {Object} params - Parameters object
 * @param {Object} params.league - League object with announcement hour settings
 * @param {number} params.day_offset - Optional offset to adjust which day to calculate for (0 = today, -1 = yesterday, etc.)
 * @returns {Object} - The correct timestamp and information about announcement timing
 */
const calculate_announcement_timestamp = ({ league, day_offset = 0 }) => {
  // Get current date and time in EST, adjusted by day_offset
  const current_date_est = dayjs().tz('America/New_York').add(day_offset, 'day')
  const actual_current_date_est = dayjs().tz('America/New_York')
  const current_hour_est = actual_current_date_est.hour()

  // Get the configured announcement hour or use default
  const announcement_hour =
    league.restricted_free_agency_announcement_hour !== undefined
      ? league.restricted_free_agency_announcement_hour
      : league_default_rfa_announcement_hour

  // Handle special case for hour 24 (midnight)
  const target_hour = announcement_hour === 24 ? 0 : announcement_hour

  // Calculate the timestamp for the target day's announcement time
  const target_announcement_time = dayjs(current_date_est)
    .hour(target_hour)
    .minute(0)
    .second(0)
    .unix()

  // For offset days, we can always announce (since we're overriding the time)
  // For today (day_offset = 0), check if we've passed the announcement time
  const is_after_announcement_time =
    day_offset !== 0 || current_hour_est >= target_hour
  const can_announce = is_after_announcement_time

  // Calculate the correct timestamp for the announcement
  const correct_timestamp = target_announcement_time

  // Calculate the next valid announcement time (either today or tomorrow)
  const next_announcement_time = is_after_announcement_time
    ? dayjs(actual_current_date_est)
        .add(1, 'day')
        .hour(target_hour)
        .minute(0)
        .second(0)
        .unix()
    : dayjs(actual_current_date_est)
        .hour(target_hour)
        .minute(0)
        .second(0)
        .unix()

  return {
    announcement_hour,
    correct_timestamp,
    next_announcement_time,
    can_announce,
    is_after_announcement_time,
    current_hour_est,
    day_offset
  }
}

/**
 * Get all leagues that are currently in their restricted free agency period
 * and should be announcing today
 * @param {Object} params - Parameters object
 * @param {boolean} params.use_previous - Whether to check eligibility for previous day announcements
 * @returns {Promise<Array>} Array of eligible league objects
 */
const get_eligible_leagues = async ({
  use_previous = false,
  dry_run = false
} = {}) => {
  const current_timestamp = Math.round(Date.now() / 1000)

  // Get leagues currently in RFA period
  const active_leagues = await db('seasons')
    .select('seasons.*', 'leagues.name as name')
    .join('leagues', 'leagues.uid', '=', 'seasons.lid')
    .where({
      'seasons.year': current_season.year
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
  const day_offset = use_previous ? -1 : 0

  for (const league of active_leagues) {
    const timing_info = calculate_announcement_timestamp({ league, day_offset })
    league.announcement_info = timing_info

    log(
      `League ${league.lid} (${league.name || 'Unnamed'}) announcement hour: ${timing_info.announcement_hour}, ` +
        `current hour: ${timing_info.current_hour_est}, can announce: ${timing_info.can_announce}, ` +
        `day offset: ${day_offset}, ` +
        `next announcement time: ${dayjs.unix(timing_info.next_announcement_time).format('YYYY-MM-DD HH:mm:ss')}`
    )

    if (timing_info.can_announce || dry_run) {
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
 * @param {number} params.day_offset - Optional offset to adjust which day to calculate for (0 = today, -1 = yesterday, etc.)
 * @returns {Object} The team that should nominate for the specified day
 */
const get_nominating_team = async ({ league, teams, lid, day_offset = 0 }) => {
  const current_date = dayjs().format('YYYY-MM-DD')
  const tran_start_date = dayjs.unix(league.tran_start).format('YYYY-MM-DD')
  const days_since_start =
    dayjs(current_date).diff(dayjs(tran_start_date), 'day') + day_offset

  log(`Days since start (with offset ${day_offset}): ${days_since_start}`)

  // If calculated date is before tran_start, select the first team
  if (days_since_start < 0) {
    log('Calculated date is before tran_start, selecting first team')
    return teams[0]
  }

  // Always select based on rotation schedule, regardless of who has or hasn't nominated
  const expected_team_index = days_since_start % teams.length
  const selected_team = teams[expected_team_index]

  log(
    `Selected team based on rotation: ${selected_team.name} (${selected_team.abbrv}) - index ${expected_team_index}`
  )

  return selected_team
}

const announce_restricted_free_agent = async ({
  lid,
  tid = null,
  use_previous = false,
  dry_run = false
}) => {
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

  // Determine the day offset based on use_previous flag
  const day_offset = use_previous ? -1 : 0

  // Calculate the correct timestamp for the announcement
  const announcement_info = calculate_announcement_timestamp({
    league,
    day_offset
  })

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
    .where({ lid, year: current_season.year })
    .orderBy('draft_order', 'desc')

  // Determine the nominating team based on provided parameters
  let nominating_team

  if (tid) {
    // Use the specified team ID to override the nominating team
    nominating_team = teams.find((team) => team.uid === tid)

    if (!nominating_team) {
      throw new Error(`Team with tid ${tid} not found in league ${lid}`)
    }

    log(
      `Using overridden nominating team: ${nominating_team.name} (${nominating_team.abbrv})`
    )
  } else {
    // Use rotation logic with appropriate day offset
    const team_day_offset = use_previous ? -1 : 0
    nominating_team = await get_nominating_team({
      league,
      teams,
      lid,
      day_offset: team_day_offset
    })

    if (use_previous) {
      log(
        `Using previous day's nominating team: ${nominating_team.name} (${nominating_team.abbrv})`
      )
    }
  }

  if (!nominating_team) {
    throw new Error(`No nominating team found for league ${lid}`)
  }

  log(
    `Today's nominating team is ${nominating_team.name} (${nominating_team.abbrv})`
  )

  const restricted_free_agency_bid = await db('restricted_free_agency_bids')
    .where({
      tid: nominating_team.uid,
      lid,
      year: current_season.year
    })
    .whereNull('cancelled')
    .whereNull('processed')
    .whereNull('announced')
    .whereNotNull('nominated')
    .first()

  if (restricted_free_agency_bid) {
    const player_row = await db('player')
      .where({ pid: restricted_free_agency_bid.pid })
      .first()

    if (!player_row) {
      throw new Error(
        `Player with pid ${restricted_free_agency_bid.pid} for team ${nominating_team.uid} not found`
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
      await db('restricted_free_agency_bids')
        .where({ uid: restricted_free_agency_bid.uid })
        .update({ announced: announcement_timestamp })

      await sendNotifications({
        league,
        notifyLeague: true,
        message
      })

      const formatted_time = dayjs
        .unix(announcement_timestamp)
        .format('YYYY-MM-DD HH:mm:ss')
      log(`Announcement timestamp set to ${formatted_time}`)
      log(`Notification sent: ${message}`)
    }
  } else {
    log(`No unprocessed nominated player found for team ${nominating_team.uid}`)
  }
}

const process_all_leagues = async ({
  dry_run = false,
  use_previous = false
} = {}) => {
  const eligible_leagues = await get_eligible_leagues({ use_previous, dry_run })

  if (!eligible_leagues.length) {
    log('No eligible leagues found for RFA announcements at the current hour')
    return
  }

  for (const league of eligible_leagues) {
    try {
      log(`Processing league ${league.lid} (${league.name || 'Unnamed'})`)
      await announce_restricted_free_agent({
        lid: league.lid,
        use_previous,
        dry_run
      })
    } catch (err) {
      log(`Error processing league ${league.lid}: ${err.message}`)
    }
  }

  log(`Completed processing ${eligible_leagues.length} leagues`)
}

const main = async () => {
  let error
  const argv = initialize_cli()
  const { lid, tid, use_previous = false, dry_run = false } = argv

  try {
    if (lid) {
      // Process specific league if lid is provided
      await announce_restricted_free_agent({ lid, tid, use_previous, dry_run })
    } else {
      // Process all eligible leagues
      await process_all_leagues({ dry_run, use_previous })
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
