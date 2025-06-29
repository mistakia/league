import debug from 'debug'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import db from '#db'
import { constants } from '#libs-shared'
import {
  get_top_restricted_free_agency_bids,
  processRestrictedFreeAgencyBid,
  is_main,
  resetWaiverOrder,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

// Initialize dayjs plugins
dayjs.extend(utc)
dayjs.extend(timezone)

const log = debug('process-restricted-free-agency-bids')
debug.enable('process-restricted-free-agency-bids')

const argv = yargs(hideBin(process.argv)).argv

/**
 * Sort bids by waiver order for the given league
 * @param {Array} bids - Array of bids to sort
 * @returns {Promise<Array>} Sorted array of bids
 */
async function sort_bids_by_waiver_order(bids) {
  if (!bids || !bids.length) return []

  const teams = await db('teams').select('uid', 'waiver_order').where({
    lid: bids[0].lid,
    year: constants.season.year
  })

  const team_waiver_order = {}
  for (const team of teams) {
    team_waiver_order[team.uid] = team.waiver_order
  }

  return bids.sort(
    (a, b) => team_waiver_order[a.tid] - team_waiver_order[b.tid]
  )
}

/**
 * Check if a league is eligible for processing bids
 * @param {Object} league - League data object
 * @param {Object} current_date_est - Current date object in EST
 * @returns {Object} Eligibility status and timing information
 */
function check_league_eligibility(league, current_date_est) {
  const current_hour_est = current_date_est.hour()
  const current_timestamp = Math.round(Date.now() / 1000)

  // Get the configured processing hour or use default
  const processing_hour =
    league.restricted_free_agency_processing_hour !== undefined
      ? league.restricted_free_agency_processing_hour
      : constants.league_default_restricted_free_agency_processing_hour

  // Get the configured announcement hour or use default
  const announcement_hour =
    league.restricted_free_agency_announcement_hour !== undefined
      ? league.restricted_free_agency_announcement_hour
      : constants.league_default_restricted_free_agency_announcement_hour

  // Calculate time difference needed between announcement and processing
  // Processing always happens on the following day
  const hours_between = 24 - announcement_hour + processing_hour

  // Calculate the minimum seconds that must pass after announcement
  const min_seconds_after_announcement = hours_between * 60 * 60

  // Get the earliest eligible processing timestamp for today
  let earliest_processing_time
  if (current_hour_est >= processing_hour) {
    // We're past the processing hour today
    earliest_processing_time = dayjs(current_date_est)
      .hour(processing_hour)
      .minute(0)
      .second(0)
      .unix()
  } else {
    // We're before the processing hour today, use yesterday's time
    earliest_processing_time = dayjs(current_date_est)
      .subtract(1, 'day')
      .hour(processing_hour)
      .minute(0)
      .second(0)
      .unix()
  }

  const should_process =
    current_hour_est >= processing_hour &&
    current_timestamp >= earliest_processing_time

  return {
    should_process,
    earliest_processing_time,
    processing_hour,
    announcement_hour,
    hours_between,
    min_seconds_after_announcement
  }
}

/**
 * Check if enough time has passed since the announcement
 * @param {number} announcement_timestamp - When the bid was announced
 * @param {number} min_seconds_required - Minimum seconds required between announcement and processing
 * @returns {boolean} Whether enough time has passed
 */
function has_enough_time_passed(announcement_timestamp, min_seconds_required) {
  const current_timestamp = Math.round(Date.now() / 1000)
  const seconds_since_announcement = current_timestamp - announcement_timestamp

  return seconds_since_announcement >= min_seconds_required
}

const run = async ({ dry_run = false } = {}) => {
  if (dry_run) {
    log('DRY RUN MODE: No database changes will be made')
  }

  const timestamp = Math.round(Date.now() / 1000)

  // Get current date in EST
  const current_date_est = dayjs().tz('America/New_York')

  log(
    `Current EST date/time: ${current_date_est.format('YYYY-MM-DD HH:mm:ss')}`
  )

  // Get leagues currently in RFA period with unprocessed bids
  const active_leagues = await db('seasons')
    .select('seasons.*', 'leagues.name as name')
    .join('leagues', 'leagues.uid', '=', 'seasons.lid')
    .join('restricted_free_agency_bids', function () {
      this.on('restricted_free_agency_bids.lid', 'seasons.lid').on(
        'restricted_free_agency_bids.year',
        'seasons.year'
      )
    })
    .where({
      'seasons.year': constants.season.year
    })
    .whereNotNull('tran_start')
    .where('tran_start', '<=', timestamp)
    .where('tran_end', '>=', timestamp)
    .groupBy('seasons.lid', 'seasons.year', 'leagues.name')
    .whereNull('restricted_free_agency_bids.processed')
    .whereNull('restricted_free_agency_bids.cancelled')
    .whereNotNull('restricted_free_agency_bids.announced')
    .distinct()

  log(`Found ${active_leagues.length} active leagues with unprocessed bids`)

  if (!active_leagues.length) {
    log('No active leagues found with unprocessed bids')
    return
  }

  // Filter leagues that are eligible for processing
  const eligible_leagues = []
  for (const league of active_leagues) {
    const eligibility = check_league_eligibility(league, current_date_est)

    league.eligibility = eligibility

    log(
      `League ${league.lid} (${league.name || 'Unnamed'}) - ` +
        `Announcement hour: ${eligibility.announcement_hour}, Processing hour: ${eligibility.processing_hour}, ` +
        `Current hour: ${current_date_est.hour()}, Should process: ${eligibility.should_process}, ` +
        `Hours between announcement and processing: ${eligibility.hours_between}`
    )

    if (eligibility.should_process) {
      eligible_leagues.push(league)
    } else if (dry_run) {
      // In dry run, include leagues that aren't ready yet to show when they would be processed
      eligible_leagues.push(league)
    }
  }

  log(
    `${eligible_leagues.length} leagues are eligible for processing or included in dry run output`
  )

  if (!eligible_leagues.length) {
    log('No eligible leagues found for RFA processing at the current hour')
    return
  }

  for (const league of eligible_leagues) {
    const { lid } = league

    if (!league.eligibility.should_process) {
      const next_time = dayjs
        .unix(league.eligibility.earliest_processing_time)
        .format('YYYY-MM-DD HH:mm:ss')
      log(
        `DRY RUN: League ${lid} (${league.name || 'Unnamed'}) would be processed at ${next_time}`
      )

      // Only continue if in dry run mode
      if (!dry_run) {
        continue
      }

      log(
        `DRY RUN: Continuing with dry run processing for league ${lid} despite not being time to process yet`
      )
    }

    log(`Processing league ${lid} (${league.name || 'Unnamed'})`)

    let restricted_free_agency_bids =
      await get_top_restricted_free_agency_bids(lid)

    if (!restricted_free_agency_bids.length) {
      log(`No bids ready to be processed for league ${lid}`)
      continue
    }

    // Check if bids meet the minimum time requirement
    const min_seconds_required =
      league.eligibility.min_seconds_after_announcement

    // Filter bids that meet the time requirement
    const eligible_bids = []
    const ineligible_bids = []

    for (const bid of restricted_free_agency_bids) {
      if (has_enough_time_passed(bid.announced, min_seconds_required)) {
        eligible_bids.push(bid)
      } else {
        ineligible_bids.push(bid)
      }
    }

    if (!eligible_bids.length) {
      if (dry_run) {
        // Find the earliest bid announcement to show when it would be eligible
        const earliest_announced = Math.min(
          ...restricted_free_agency_bids.map((bid) => bid.announced)
        )
        const time_since_announcement = timestamp - earliest_announced
        const time_remaining = min_seconds_required - time_since_announcement
        const eligible_time = dayjs
          .unix(earliest_announced + min_seconds_required)
          .format('YYYY-MM-DD HH:mm:ss')

        const player = await db('player')
          .where('pid', restricted_free_agency_bids[0].pid)
          .first()
        if (player) {
          log(
            `DRY RUN: Bid for ${player.fname} ${player.lname} (${player.pos}) is not eligible yet`
          )
        } else {
          log(
            `DRY RUN: Bid for player ${restricted_free_agency_bids[0].pid} is not eligible yet`
          )
        }

        log(
          `DRY RUN: This bid would be eligible for processing at ${eligible_time} (${Math.ceil(time_remaining / 3600)} hours from now)`
        )

        // For dry run, continue with processing using ineligible bids
        log(`DRY RUN: Continuing with dry run processing using ineligible bids`)
      } else {
        log(
          `No bids meet the time requirement for league ${lid}. Need to wait at least ${Math.ceil(min_seconds_required / 3600)} hours after announcement.`
        )
        continue
      }
    } else {
      // Use the eligible bids instead of all bids
      restricted_free_agency_bids = eligible_bids
    }

    // Use the eligible bids instead of all bids
    restricted_free_agency_bids = eligible_bids

    if (dry_run) {
      // Show what would be processed
      const player = await db('player')
        .where('pid', restricted_free_agency_bids[0].pid)
        .first()
      if (player) {
        log(
          `DRY RUN: Would process restricted free agency bid for ${player.fname} ${player.lname} (${player.pos}) in league ${lid}`
        )
      } else {
        log(
          `DRY RUN: Would process restricted free agency bid for player ${restricted_free_agency_bids[0].pid} in league ${lid}`
        )
      }

      if (restricted_free_agency_bids.length > 1) {
        if (restricted_free_agency_bids.find((t) => t.player_tid === t.tid)) {
          log(
            `DRY RUN: Original team has a matching bid, they would retain the player`
          )
        } else {
          log(
            `DRY RUN: ${restricted_free_agency_bids.length} teams have the same bid amount, would use waiver order to determine winner`
          )
          const sorted = await sort_bids_by_waiver_order(
            restricted_free_agency_bids
          )
          const winning_team = await db('teams')
            .where('uid', sorted[0].tid)
            .first()
          if (winning_team) {
            log(
              `DRY RUN: ${winning_team.name} (${winning_team.abbrv}) would win the player based on waiver order`
            )
          } else {
            log(
              `DRY RUN: Team ${sorted[0].tid} would win the player based on waiver order`
            )
          }
        }
      }

      // Show ineligible bids if any
      if (ineligible_bids.length > 0) {
        log(
          `DRY RUN: ${ineligible_bids.length} bid(s) are not yet eligible for processing`
        )
        for (const bid of ineligible_bids) {
          const time_since_announcement = timestamp - bid.announced
          const time_remaining = min_seconds_required - time_since_announcement
          const player = await db('player').where('pid', bid.pid).first()
          const player_name = player
            ? `${player.fname} ${player.lname} (${player.pos})`
            : `Player ${bid.pid}`
          log(
            `DRY RUN: Bid for ${player_name} would be eligible in ${Math.ceil(time_remaining / 3600)} hours`
          )
        }
      }

      continue
    }

    while (restricted_free_agency_bids.length) {
      let error
      const original_team_bid = restricted_free_agency_bids.find(
        (t) => t.player_tid === t.tid
      )
      let winning_bid = original_team_bid || restricted_free_agency_bids[0]

      try {
        if (original_team_bid || restricted_free_agency_bids.length === 1) {
          log('Processing restricted free agency bid', winning_bid)

          if (!dry_run) {
            await processRestrictedFreeAgencyBid(winning_bid)
          }

          const { pid } = winning_bid

          if (!dry_run) {
            // Mark all other bids for this player as unsuccessful
            await db('restricted_free_agency_bids')
              .update({
                succ: 0,
                reason: 'player no longer a restricted free agent',
                processed: timestamp
              })
              .where({
                pid,
                lid,
                year: constants.season.year
              })
              .whereNull('cancelled')
              .whereNull('processed')
              .whereNot('uid', winning_bid.uid)
          }
        } else {
          // multiple bids tied with no original team
          log(`Tied top bids for league ${lid}`)
          log(restricted_free_agency_bids)

          // Sort bids by waiver order
          const sorted_bids = await sort_bids_by_waiver_order(
            restricted_free_agency_bids
          )
          winning_bid = sorted_bids[0]

          log('Processing winning restricted free agency bid', winning_bid)

          if (!dry_run) {
            await processRestrictedFreeAgencyBid(winning_bid)
            // Reset waiver order for the winning team
            await resetWaiverOrder({ leagueId: lid, teamId: winning_bid.tid })
          }

          // Update all other bids as unsuccessful
          if (!dry_run) {
            await db('restricted_free_agency_bids')
              .update({
                succ: 0,
                reason: 'player no longer a restricted free agent',
                processed: timestamp
              })
              .where({
                pid: winning_bid.pid,
                lid,
                year: constants.season.year
              })
              .whereNull('cancelled')
              .whereNull('processed')
              .whereNot('uid', winning_bid.uid)
          }
        }
      } catch (err) {
        error = err
        log(`Error processing bid: ${err.message}`)
      }

      // save restricted free agency bid outcome
      if (!dry_run) {
        await db('restricted_free_agency_bids')
          .update({
            succ: error ? 0 : 1,
            reason: error ? error.message : null,
            processed: timestamp
          })
          .where('uid', winning_bid.uid)
      }

      // Get next bids to process for this league
      const next_bids = await get_top_restricted_free_agency_bids(lid)

      // Filter the next bids by time requirement
      restricted_free_agency_bids = next_bids.filter((bid) =>
        has_enough_time_passed(bid.announced, min_seconds_required)
      )
    }
  }
}

export default run

const main = async () => {
  debug.enable('process-restricted-free-agency-bids')
  let error
  try {
    const dry_run = argv.dry_run || false
    await run({ dry_run })
  } catch (err) {
    error = err
    log(error)
  }

  if (!argv.dry_run) {
    await report_job({
      job_type: job_types.PROCESS_RESTRICTED_FREE_AGENCY_BIDS,
      error
    })
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
