import debug from 'debug'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import db from '#db'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { current_season } from '#constants'
import {
  is_main,
  sendNotifications,
  getLeague,
  report_job,
  has_league_notification_been_sent,
  record_league_notification_sent
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { get_free_agent_period } from '#libs-shared'

// Initialize dayjs plugins
dayjs.extend(utc)
dayjs.extend(timezone)

// Constants
const NOTIFICATION_TYPE_FREE_AGENCY_PERIOD_START = 'free_agency_period_start'
const NOTIFICATION_TYPE_FREE_AGENCY_PERIOD_START_ADVANCE =
  'free_agency_period_start_advance'
// Default check window: only send notifications within 60 minutes of period start
// This prevents the script from sending notifications if run too long after the period has started
const DEFAULT_CHECK_WINDOW_MINUTES = 60
// Advance notice: send notification 7 days before the free agency period starts
const ADVANCE_NOTICE_DAYS = 7
// Check window for advance notice: within 24 hours of the 7-day mark
const ADVANCE_NOTICE_CHECK_WINDOW_HOURS = 24
const TIMEZONE_AMERICA_NEW_YORK = 'America/New_York'

// Debug logging
const log = debug('announce-free-agency-period-start')
debug.enable('announce-free-agency-period-start')

/**
 * Initialize CLI argument parsing
 * @returns {Object} Parsed command line arguments
 */
const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

/**
 * Get all leagues that are eligible for free agency period notifications
 * Checks for both advance notice (7 days before) and start notice (within 60 minutes after)
 * @param {Object} params - Parameters object
 * @param {number} params.check_window_minutes - How many minutes after the start to check (default: 60)
 * @param {boolean} params.dry_run - Whether this is a dry run
 * @returns {Promise<Array>} Array of eligible league objects with timing info and notice type
 */
const get_eligible_leagues_for_free_agency_period_notifications = async ({
  check_window_minutes = DEFAULT_CHECK_WINDOW_MINUTES,
  dry_run = false
} = {}) => {
  const current_time_est = dayjs().tz(TIMEZONE_AMERICA_NEW_YORK)

  // Get leagues with free agency period configured
  const leagues_with_free_agency = await db('seasons')
    .select('seasons.*', 'leagues.name as name', 'leagues.uid as lid')
    .join('leagues', 'leagues.uid', '=', 'seasons.lid')
    .where({
      'seasons.year': current_season.year
    })
    .whereNotNull('free_agency_live_auction_start')

  log(
    `Found ${leagues_with_free_agency.length} leagues with free agency period configured`
  )

  if (!leagues_with_free_agency.length) {
    return []
  }

  // Check each league for both advance notice and start notice eligibility
  const eligible_leagues = []

  for (const league of leagues_with_free_agency) {
    const free_agency_period = get_free_agent_period(league)
    const period_start_time = free_agency_period.start
    const period_start_timestamp = period_start_time.unix()

    // Calculate time differences
    const minutes_since_period_start = current_time_est.diff(
      period_start_time,
      'minute'
    )
    const advance_notice_target_time = period_start_time.subtract(
      ADVANCE_NOTICE_DAYS,
      'day'
    )
    const hours_since_advance_target = current_time_est.diff(
      advance_notice_target_time,
      'hour'
    )

    // Check eligibility for start notice (within 60 minutes after period start)
    const is_eligible_for_start_notice =
      minutes_since_period_start >= 0 &&
      minutes_since_period_start <= check_window_minutes

    // Check eligibility for advance notice (within 24 hours of 7 days before period start)
    const is_eligible_for_advance_notice =
      hours_since_advance_target >= 0 &&
      hours_since_advance_target <= ADVANCE_NOTICE_CHECK_WINDOW_HOURS &&
      minutes_since_period_start < 0 // Period hasn't started yet

    log(
      `League ${league.lid} (${league.name || 'Unnamed'}): ` +
        `period start: ${period_start_time.format('YYYY-MM-DD HH:mm:ss')}, ` +
        `minutes since start: ${minutes_since_period_start}, ` +
        `hours since advance target: ${hours_since_advance_target}, ` +
        `eligible for start: ${is_eligible_for_start_notice}, ` +
        `eligible for advance: ${is_eligible_for_advance_notice}`
    )

    // Determine which notice type to send (prioritize start notice if both are eligible)
    let notice_type = null
    if (is_eligible_for_start_notice) {
      notice_type = 'start'
    } else if (is_eligible_for_advance_notice) {
      notice_type = 'advance'
    }

    if (notice_type || dry_run) {
      league.free_agency_period_info = {
        period_start_time,
        period_start_timestamp,
        minutes_since_period_start,
        hours_since_advance_target,
        notice_type: notice_type || (dry_run ? 'start' : null)
      }
      eligible_leagues.push(league)
    }
  }

  log(
    `${eligible_leagues.length} leagues are eligible for free agency period notifications`
  )

  return eligible_leagues
}

/**
 * Format the free agency period advance notice message (7 days before)
 * @param {Object} params - Parameters
 * @param {string} params.league_name - League name
 * @param {dayjs.Dayjs} params.period_start_time - When the free agency period will start
 * @returns {string} Formatted notification message
 */
const format_free_agency_period_advance_message = ({
  league_name,
  period_start_time
}) => {
  const period_start_formatted = period_start_time.format(
    'dddd, MMMM D, YYYY [at] h:mm A'
  )

  return `The Free Agency Period Sanctuary Period will begin in 7 days for ${league_name || 'this league'}. The free agency period will start on ${period_start_formatted}. During the sanctuary period, poaching claims cannot be submitted.`
}

/**
 * Format the free agency period start message
 * @param {Object} params - Parameters
 * @param {string} params.league_name - League name
 * @param {dayjs.Dayjs} params.period_start_time - When the free agency period started
 * @returns {string} Formatted notification message
 */
const format_free_agency_period_start_message = ({
  league_name,
  period_start_time
}) => {
  const period_start_formatted = period_start_time.format(
    'dddd, MMMM D, YYYY [at] h:mm A'
  )

  return `The Free Agency Period Sanctuary Period has begun for ${league_name || 'this league'}. The free agency period started on ${period_start_formatted}. During this sanctuary period, poaching claims cannot be submitted.`
}

/**
 * Announce free agency period notification for a league (advance or start)
 * @param {Object} params - Parameters object
 * @param {number} params.lid - League ID
 * @param {string} params.notice_type - Type of notice: 'advance' or 'start'
 * @param {boolean} params.dry_run - Whether this is a dry run
 * @returns {Promise<void>}
 */
const announce_free_agency_period_notification = async ({
  lid,
  notice_type,
  dry_run = false
}) => {
  if (!lid) {
    throw new Error('lid is required')
  }

  if (!notice_type || !['advance', 'start'].includes(notice_type)) {
    throw new Error('notice_type must be "advance" or "start"')
  }

  if (dry_run) {
    log('DRY RUN MODE: No notifications will be sent')
  }

  const league = await getLeague({ lid })

  if (!league) {
    throw new Error(`League with lid ${lid} not found`)
  }

  if (!league.free_agency_live_auction_start) {
    throw new Error(
      `League with lid ${lid} does not have a free_agency_live_auction_start date`
    )
  }

  const free_agency_period = get_free_agent_period(league)
  const period_start_time = free_agency_period.start
  const event_timestamp = period_start_time.unix()
  const current_year = current_season.year

  // Determine notification type and message formatter
  const notification_type =
    notice_type === 'advance'
      ? NOTIFICATION_TYPE_FREE_AGENCY_PERIOD_START_ADVANCE
      : NOTIFICATION_TYPE_FREE_AGENCY_PERIOD_START

  // Check if notification was already sent (second layer of protection against duplicates)
  // This database check prevents sending duplicate notifications even if the time window
  // check passes (e.g., if the script runs multiple times within the check window)
  const notification_already_sent = await has_league_notification_been_sent({
    lid,
    year: current_year,
    notification_type,
    event_timestamp
  })

  if (notification_already_sent && !dry_run) {
    log(
      `${notice_type} notification for free agency period has already been sent for league ${lid}, year ${current_year}, event_timestamp ${event_timestamp}`
    )
    return
  }

  // Format the appropriate message
  const notification_message =
    notice_type === 'advance'
      ? format_free_agency_period_advance_message({
          league_name: league.name,
          period_start_time
        })
      : format_free_agency_period_start_message({
          league_name: league.name,
          period_start_time
        })

  if (dry_run) {
    log(
      `DRY RUN: Would send ${notice_type} notification: ${notification_message}`
    )
    log(
      `DRY RUN: Period start: ${period_start_time.format('YYYY-MM-DD HH:mm:ss')}`
    )
  } else {
    await sendNotifications({
      league,
      notifyLeague: true,
      message: notification_message
    })

    // Record that the notification was sent in the database
    await record_league_notification_sent({
      lid,
      year: current_year,
      notification_type,
      event_timestamp,
      message: notification_message,
      metadata: {
        notice_type,
        free_agency_live_auction_start: league.free_agency_live_auction_start,
        free_agency_period_start: league.free_agency_period_start,
        free_agency_period_end: league.free_agency_period_end
      }
    })

    log(`${notice_type} notification sent: ${notification_message}`)
    log(
      `Free agency period ${notice_type} notification sent for league ${lid} at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`
    )
  }
}

/**
 * Process all eligible leagues for free agency period notifications
 * @param {Object} params - Parameters
 * @param {boolean} params.dry_run - Whether this is a dry run
 * @param {number} params.check_window_minutes - Check window in minutes
 * @returns {Promise<void>}
 */
const process_all_eligible_leagues = async ({
  dry_run = false,
  check_window_minutes = DEFAULT_CHECK_WINDOW_MINUTES
} = {}) => {
  const eligible_leagues =
    await get_eligible_leagues_for_free_agency_period_notifications({
      check_window_minutes,
      dry_run
    })

  if (!eligible_leagues.length) {
    log('No eligible leagues found for free agency period notifications')
    return
  }

  for (const league of eligible_leagues) {
    try {
      const notice_type = league.free_agency_period_info?.notice_type || 'start'
      log(
        `Processing league ${league.lid} (${league.name || 'Unnamed'}) for ${notice_type} notification`
      )
      await announce_free_agency_period_notification({
        lid: league.lid,
        notice_type,
        dry_run
      })
    } catch (error) {
      log(`Error processing league ${league.lid}: ${error.message}`)
    }
  }

  log(`Completed processing ${eligible_leagues.length} leagues`)
}

/**
 * Main entry point for the script
 * @returns {Promise<void>}
 */
const main = async () => {
  let error = null
  const argv = initialize_cli()
  const {
    lid,
    dry_run = false,
    check_window_minutes = DEFAULT_CHECK_WINDOW_MINUTES
  } = argv

  try {
    if (lid) {
      // Process specific league if lid is provided
      // Default to 'start' notice type if not specified
      const notice_type = argv.notice_type || 'start'
      await announce_free_agency_period_notification({
        lid,
        notice_type,
        dry_run
      })
    } else {
      // Process all eligible leagues (will determine notice type automatically)
      await process_all_eligible_leagues({ dry_run, check_window_minutes })
    }
  } catch (err) {
    error = err
    log(error)
  }

  if (!dry_run) {
    await report_job({
      job_type: job_types.ANNOUNCE_FREE_AGENCY_PERIOD_START,
      error
    })
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default announce_free_agency_period_notification
