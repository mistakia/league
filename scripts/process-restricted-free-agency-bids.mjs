import debug from 'debug'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import db from '#db'
import {
  current_season,
  league_default_rfa_window_hours,
  league_default_rfa_processing_lead_hours,
  bid_change_types,
  bid_change_sources
} from '#constants'
import {
  get_restricted_free_agency_window_config,
  get_restricted_free_agency_window_index,
  get_restricted_free_agency_processing_time,
  league_timezone
} from '#libs-shared'
import {
  get_top_restricted_free_agency_bids,
  get_restricted_free_agency_nominations,
  classify_restricted_free_agency_bid_outcome,
  processRestrictedFreeAgencyBid,
  is_main,
  resetWaiverOrder,
  report_job,
  throw_if_shortfall,
  record_restricted_free_agency_bid_change
} from '#libs-server'
import { resolve_restricted_free_agency_bid_error_outcome } from '#libs-server/restricted-free-agency-bid-error.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

// Initialize dayjs plugins
dayjs.extend(utc)
dayjs.extend(timezone)

const log = debug('process-restricted-free-agency-bids')
debug.enable('process-restricted-free-agency-bids')

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

/**
 * Sort bids by waiver order for the given league
 * @param {Array} bids - Array of bids to sort
 * @returns {Promise<Array>} Sorted array of bids
 */
async function sort_bids_by_waiver_order(bids) {
  if (!bids || !bids.length) return []

  const teams = await db('teams').select('uid', 'waiver_order').where({
    lid: bids[0].lid,
    year: current_season.year
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
 * Settle every bid that lost an auction, recording WHY each one lost.
 *
 * This replaces a single blanket UPDATE that stamped
 * `player no longer a restricted free agent` onto all of them. That sentence is
 * true of every ordinary loss and separates none of them, so six seasons of
 * history recorded no usable reason at all: 262 of 280 losing bids carry it.
 * Classifying per bid costs one statement each on a set that has never exceeded
 * a handful per auction.
 *
 * @param {Object} params
 * @param {Object} params.winning_bid - The bid that signed the player
 * @param {number} params.lid - League id
 * @param {number} params.original_team_id - Team holding the player's rights
 * @param {number} params.timestamp - Processing timestamp
 */
async function settle_losing_bids({
  winning_bid,
  lid,
  original_team_id,
  timestamp
}) {
  const losing_bids = await db('restricted_free_agency_bids')
    .where({
      pid: winning_bid.pid,
      lid,
      year: current_season.year
    })
    .whereNull('cancelled')
    .whereNull('processed')
    .whereNot('uid', winning_bid.uid)

  for (const losing_bid of losing_bids) {
    const outcome = classify_restricted_free_agency_bid_outcome({
      winning_bid,
      losing_bid,
      original_team_id
    })

    await db.transaction(async (trx) => {
      await trx('restricted_free_agency_bids')
        .update({ is_successful: 0, outcome, processed: timestamp })
        .where('uid', losing_bid.uid)

      await record_restricted_free_agency_bid_change({
        db: trx,
        bid_id: losing_bid.uid,
        change_type: bid_change_types.SETTLED,
        change_source: bid_change_sources.SETTLEMENT_SCRIPT,
        changed_by_user_id: null
      })
    })
  }
}

/**
 * When bids on the window a player was announced in are due to be processed.
 *
 * Processing is defined relative to the NEXT announcement rather than as a
 * duration after this one, so it always strictly precedes the next window
 * opening — by `restricted_free_agency_processing_lead_hours`.
 *
 * @param {Object} params
 * @param {Object} params.league - League with window configuration
 * @param {number} params.announced - When the player's nomination was announced
 * @returns {number} Timestamp at which the bid becomes processable, or
 *   Infinity when the player has no announcement and so has no window yet
 */
function get_bid_processing_due({ league, announced }) {
  if (!announced) {
    return Infinity
  }

  const window_index = get_restricted_free_agency_window_index({
    league,
    timestamp: Number(announced)
  })

  return get_restricted_free_agency_processing_time({ league, window_index })
}

const run = async ({ dry_run = false } = {}) => {
  if (dry_run) {
    log('DRY RUN MODE: No database changes will be made')
  }

  const timestamp = Math.round(Date.now() / 1000)

  log(
    `Current ET date/time: ${dayjs()
      .tz(league_timezone)
      .format('YYYY-MM-DD HH:mm:ss [ET]')}`
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
      'seasons.year': current_season.year
    })
    .whereNotNull('restricted_free_agency_period_start')
    .whereNotNull('restricted_free_agency_first_window_at')
    .where('restricted_free_agency_period_start', '<=', timestamp)
    .where('restricted_free_agency_period_end', '>=', timestamp)
    .groupBy('seasons.lid', 'seasons.year', 'leagues.name')
    .whereNull('restricted_free_agency_bids.processed')
    .whereNull('restricted_free_agency_bids.cancelled')
    // The announcement lives on the player's nomination, never on a competing
    // bid, so this must reach through the nomination rather than testing a
    // column that is null on all but one bid per auction.
    .whereExists(function () {
      this.select('*')
        .from('restricted_free_agency_nominations')
        .whereRaw(
          'restricted_free_agency_nominations.league_id = restricted_free_agency_bids.lid'
        )
        .whereRaw(
          'restricted_free_agency_nominations.player_id = restricted_free_agency_bids.pid'
        )
        .whereRaw(
          'restricted_free_agency_nominations.season_year = restricted_free_agency_bids.year'
        )
        .whereNotNull('restricted_free_agency_nominations.announced_at')
    })
    .distinct()

  log(`Found ${active_leagues.length} active leagues with unprocessed bids`)

  if (!active_leagues.length) {
    log('No active leagues found with unprocessed bids')
    return
  }

  // Every league with announced, unprocessed bids is examined. Whether any
  // particular bid is due is decided per bid against its own window's
  // processing time, so there is no league-level hour gate to apply here.
  for (const league of active_leagues) {
    const { lid } = league
    const { window_hours, processing_lead_hours, bid_window_hours } =
      get_restricted_free_agency_window_config({ league })

    log(
      `Processing league ${lid} (${league.name || 'Unnamed'}) - ` +
        `window ${window_hours}h, processing lead ${processing_lead_hours}h, ` +
        `bid window ${bid_window_hours}h`
    )

    let restricted_free_agency_bids =
      await get_top_restricted_free_agency_bids(lid)

    if (!restricted_free_agency_bids.length) {
      log(`No bids ready to be processed for league ${lid}`)
      continue
    }

    const nominations_by_pid = await get_restricted_free_agency_nominations({
      lid
    })

    // A bid is due once the processing time of its PLAYER's nomination window
    // has arrived — competing bids carry no announcement of their own
    const eligible_bids = []
    const ineligible_bids = []

    for (const bid of restricted_free_agency_bids) {
      const processing_due = get_bid_processing_due({
        league,
        announced: nominations_by_pid[bid.pid]?.announced
      })

      if (timestamp >= processing_due) {
        eligible_bids.push(bid)
      } else {
        ineligible_bids.push({ ...bid, processing_due })
      }
    }

    if (!eligible_bids.length) {
      const next_due = Math.min(
        ...ineligible_bids.map((bid) => bid.processing_due)
      )
      if (Number.isFinite(next_due)) {
        log(
          `No bids due for league ${lid}. Next processing time is ${dayjs
            .unix(next_due)
            .tz(league_timezone)
            .format('YYYY-MM-DD HH:mm:ss [ET]')} (${Math.ceil(
            (next_due - timestamp) / 3600
          )} hours from now).`
        )
      } else {
        log(`No bids due for league ${lid}. No player has been announced yet.`)
      }
      continue
    }

    restricted_free_agency_bids = eligible_bids

    if (dry_run) {
      // Show what would be processed
      const player = await db('player')
        .where('pid', restricted_free_agency_bids[0].pid)
        .first()
      if (player) {
        log(
          `DRY RUN: Would process restricted free agency bid for ${player.first_name} ${player.last_name} (${player.primary_position}) in league ${lid}`
        )
      } else {
        log(
          `DRY RUN: Would process restricted free agency bid for player ${restricted_free_agency_bids[0].pid} in league ${lid}`
        )
      }

      if (restricted_free_agency_bids.length > 1) {
        if (
          restricted_free_agency_bids.find((t) => t.original_team_id === t.tid)
        ) {
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
              `DRY RUN: ${winning_team.name} (${winning_team.abbreviation}) would win the player based on waiver order`
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
          const time_remaining = bid.processing_due - timestamp
          const player = await db('player').where('pid', bid.pid).first()
          const player_name = player
            ? `${player.first_name} ${player.last_name} (${player.primary_position})`
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
        (t) => t.original_team_id === t.tid
      )
      let winning_bid = original_team_bid || restricted_free_agency_bids[0]
      const { original_team_id } = winning_bid

      try {
        if (original_team_bid || restricted_free_agency_bids.length === 1) {
          log('Processing restricted free agency bid', winning_bid)

          if (!dry_run) {
            await processRestrictedFreeAgencyBid({
              ...winning_bid,
              processed: timestamp
            })

            await settle_losing_bids({
              winning_bid,
              lid,
              original_team_id,
              timestamp
            })
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
            await processRestrictedFreeAgencyBid({
              ...winning_bid,
              processed: timestamp
            })
            // Reset waiver order for the winning team
            await resetWaiverOrder({ leagueId: lid, teamId: winning_bid.tid })

            // Every remaining bid tied this one and lost on waiver order, which
            // the classifier reads off the equal amounts.
            await settle_losing_bids({
              winning_bid,
              lid,
              original_team_id,
              timestamp
            })
          }
        }
      } catch (err) {
        error = err
        log(`Error processing bid: ${err.message}`)
      }

      // save restricted free agency bid outcome
      //
      // The SUCCESS half now commits inside processRestrictedFreeAgencyBid,
      // atomically with the tag transaction, so only the failure half is left
      // here. `whereNull('processed')` is what keeps the two from fighting: a
      // throw raised AFTER that commit (sendNotifications, say) must not
      // rewrite succ back to 0, which would leave a tag transaction with no
      // successful signing — the precise state this change exists to prevent.
      //
      // The outcome code travels ON the error, attached where it is thrown, so
      // this never has to match on the message text -- the habit that made the
      // retired `reason` column a record of exception wording rather than of
      // auction results.
      //
      // The changelog entry is conditional on the UPDATE having applied. The
      // `whereNull('processed')` guard above exists so a throw raised after the
      // success commit cannot rewrite the record, and in that case this
      // statement legitimately touches nothing -- recording a settlement anyway
      // would put a failure in the trail that the table never held.
      if (!dry_run && error) {
        await db.transaction(async (trx) => {
          const updated_count = await trx('restricted_free_agency_bids')
            .update({
              is_successful: false,
              outcome: resolve_restricted_free_agency_bid_error_outcome(error),
              outcome_detail: error.message,
              processed: timestamp
            })
            .where('uid', winning_bid.uid)
            .whereNull('processed')

          if (updated_count) {
            await record_restricted_free_agency_bid_change({
              db: trx,
              bid_id: winning_bid.uid,
              change_type: bid_change_types.SETTLED,
              change_source: bid_change_sources.SETTLEMENT_SCRIPT,
              changed_by_user_id: null
            })
          }
        })
      }

      // Get next bids to process for this league
      const next_bids = await get_top_restricted_free_agency_bids(lid)

      // Filter the next bids by time requirement
      restricted_free_agency_bids = next_bids.filter(
        (bid) =>
          timestamp >=
          get_bid_processing_due({
            league,
            announced: nominations_by_pid[bid.pid]?.announced
          })
      )
    }
  }

  if (!dry_run) {
    // Oracle: no bid that was both announced and past its processing window
    // should remain unprocessed after the run. A non-empty result means the
    // loop silently skipped eligible bids — surface that as a shortfall.
    const stuck_bids = await db('restricted_free_agency_bids as rfab')
      .join('seasons', function () {
        this.on('seasons.lid', 'rfab.lid').on(
          'seasons.year',
          db.raw('?', [current_season.year])
        )
      })
      .where('rfab.year', current_season.year)
      .whereNull('rfab.processed')
      .whereNull('rfab.cancelled')
      .whereNotNull('seasons.restricted_free_agency_period_start')
      .whereNotNull('seasons.restricted_free_agency_first_window_at')
      .where('seasons.restricted_free_agency_period_start', '<=', timestamp)
      .where('seasons.restricted_free_agency_period_end', '>=', timestamp)
      .where(function () {
        // bid meets the time-since-announcement requirement
        // The announcement belongs to the player's NOMINATION, which now has a
        // row of its own — a competing bid never carried one and reading it off
        // rfab would drop the row from the oracle.
        // Epoch approximation of the calendar-aware boundary, with an hour of
        // slack so a DST transition inside a bid window cannot manufacture a
        // false shortfall. Costs an hour of detection latency, never a miss.
        // A player with no nomination yields NULL here, which excludes the
        // row — correct, since an unannounced player is never due.
        this.whereRaw(
          `? - (
            select extract(epoch from nomination.announced_at)
            from restricted_free_agency_nominations as nomination
            where nomination.player_id = rfab.pid
              and nomination.league_id = rfab.lid
              and nomination.season_year = rfab.year
              and nomination.announced_at is not null
          ) >= (COALESCE(seasons.restricted_free_agency_window_hours, ?) - COALESCE(seasons.restricted_free_agency_processing_lead_hours, ?)) * 3600 + 3600`,
          [
            timestamp,
            league_default_rfa_window_hours,
            league_default_rfa_processing_lead_hours
          ]
        )
      })
      .select('rfab.uid', 'rfab.lid', 'rfab.pid')

    if (stuck_bids.length > 0) {
      return {
        shortfall: `${stuck_bids.length} eligible RFA bid(s) remain unprocessed after run: uids=${stuck_bids.map((b) => b.uid).join(',')}`
      }
    }
  }

  return { shortfall: null }
}

export default run

const main = async () => {
  debug.enable('process-restricted-free-agency-bids')
  const argv = initialize_cli()
  let error
  try {
    const dry_run = argv.dry_run || false
    const result = await run({ dry_run })
    throw_if_shortfall(result?.shortfall)
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
