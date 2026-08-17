import debug from 'debug'

import db from '#db'
import { Errors } from '#libs-shared'
import {
  current_season,
  roster_slot_types,
  transaction_types,
  waiver_types
} from '#constants'
import {
  submitAcquisition,
  resetWaiverOrder,
  getTopPracticeSquadWaiver,
  get_waiver_by_id,
  get_super_priority_status,
  process_super_priority,
  is_main,
  report_job,
  throw_if_shortfall
} from '#libs-server'
import { get_open_league_pause } from '#libs-server/league-pause.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import apply_nfl_games_current_week_join from '#libs-server/data-views/join-nfl-games-current-week.mjs'

const log = debug('process:waivers:freeagency')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:waivers:freeagency')
}

const process_practice_waivers = async ({ daily = false, wid = null } = {}) => {
  const timestamp = new Date()

  // Handle specific waiver processing
  if (wid) {
    return await process_single_practice_waiver(wid, timestamp)
  }

  // Original bulk processing logic
  return await process_bulk_practice_waivers(daily, timestamp)
}

const process_single_practice_waiver = async (waiver_id, timestamp) => {
  const waiver = await get_waiver_by_id(waiver_id)

  // Validate it's a practice squad waiver
  if (waiver.waiver_type !== waiver_types.FREE_AGENCY_PRACTICE) {
    throw new Error(`Waiver ${waiver_id} is not a practice squad waiver`)
  }

  const lid = waiver.lid

  // The single-waiver entry path is a separate door into the same write, so it
  // needs its own gate -- guarding only the loop below would leave an operator
  // running one waiver by id able to write to a paused league.
  const open_pause = await get_open_league_pause({ league_id: lid })
  if (open_pause) {
    throw new Errors.LeaguePaused(`league ${lid} is paused`)
  }

  // Check game timing constraints if during regular season
  if (current_season.isRegularSeason) {
    await validate_game_timing(waiver_id, waiver.lid)
  }

  let error
  try {
    if (waiver.super_priority) {
      await handle_super_priority_claim(waiver, lid, timestamp)
    } else {
      await handle_regular_practice_claim(waiver, lid, timestamp)
    }
  } catch (err) {
    error = err
    // Only update waiver status if it hasn't been processed yet (super priority claims handle their own status)
    if (!waiver.super_priority) {
      await db('waivers')
        .update({
          is_successful: 0,
          reason: error.message,
          processed: timestamp
        })
        .where('uid', waiver.wid)
    }
  }
}

const process_bulk_practice_waivers = async (daily, timestamp) => {
  // Original bulk processing logic
  if (current_season.week > current_season.finalWeek) {
    log('after final week, practice waivers not run')
    return
  }

  // only run daily waivers during offseason
  if (!current_season.isRegularSeason && !daily) {
    log('outside of daily waivers during offseason, practice waivers not run')
    return
  }

  if (current_season.isRegularSeason && current_season.isWaiverPeriod) {
    return
  }

  const league_ids = await get_leagues_with_pending_practice_waivers()
  if (!league_ids.length) {
    throw new Errors.EmptyPracticeSquadFreeAgencyWaivers()
  }

  for (const lid of league_ids) {
    const open_pause = await get_open_league_pause({ league_id: lid })
    if (open_pause) {
      log(`league ${lid} is paused; holding practice squad waivers`)
      continue
    }

    await process_league_practice_waivers(lid, timestamp)
  }

  return { shortfall: await get_practice_waiver_shortfall() }
}

/**
 * Oracle: practice squad waivers still pending after a run that should have
 * cleared them.
 *
 * This script had no oracle at all before the league pause landed. See the
 * matching comment in process-waivers-free-agency-active for why one ships in
 * the same change as the skip, and why paused leagues must be excluded HERE
 * rather than inferred from the loop.
 */
const get_practice_waiver_shortfall = async () => {
  const stuck_waivers = await db('waivers')
    .select('waivers.uid', 'waivers.lid')
    .leftJoin('league_pauses', function () {
      this.on('league_pauses.league_id', '=', 'waivers.lid').andOnNull(
        'league_pauses.resumed_at'
      )
    })
    .whereNull('waivers.processed')
    .whereNull('waivers.cancelled')
    .where('waivers.type', waiver_types.FREE_AGENCY_PRACTICE)
    .whereNull('league_pauses.pause_id')

  if (!stuck_waivers.length) return null

  return `${stuck_waivers.length} practice squad waiver(s) remain unprocessed after run: uids=${stuck_waivers
    .map((waiver) => waiver.uid)
    .join(',')}`
}

// Helper functions
const validate_game_timing = async (waiver_id, lid) => {
  const waiver_game_query = db('waivers')
    .select('waivers.*', 'nfl_games.date', 'nfl_games.time_eastern')
    .join('player', 'waivers.pid', 'player.pid')
  apply_nfl_games_current_week_join({ db, query: waiver_game_query })
  const waiver_with_game_info = await waiver_game_query
    .where('waivers.uid', waiver_id)
    .first()

  if (waiver_with_game_info && waiver_with_game_info.date) {
    const dayjs = await import('dayjs')
    const timezone = await import('dayjs/plugin/timezone.js')
    dayjs.default.extend(timezone.default)

    const now = dayjs.default()
    const game_start = dayjs.default.tz(
      `${waiver_with_game_info.date} ${waiver_with_game_info.time_eastern}`,
      'YYYY/MM/DD HH:mm:SS',
      'America/New_York'
    )

    if (!now.isBefore(game_start)) {
      throw new Error(
        `Cannot process waiver ${waiver_id}: player's game has already started`
      )
    }
  }
}

const handle_super_priority_claim = async (waiver, lid, timestamp) => {
  const super_priority_status = await get_super_priority_status({
    pid: waiver.pid,
    lid
  })

  if (
    super_priority_status.eligible &&
    super_priority_status.original_tid === waiver.tid &&
    super_priority_status.super_priority_uid
  ) {
    // Get waiver releases
    const release = await db('waiver_releases')
      .select('pid')
      .where('waiver_id', waiver.wid)

    try {
      // Process super priority claim
      await process_super_priority({
        pid: waiver.pid,
        original_tid: waiver.tid,
        lid,
        super_priority_uid: super_priority_status.super_priority_uid,
        user_id: waiver.user_id,
        release: release.map((r) => r.pid)
      })

      // Mark waiver as successful
      await db('waivers')
        .update({
          is_successful: 1,
          processed: timestamp
        })
        .where('uid', waiver.wid)

      log(
        `super priority claim processed for pid: ${waiver.pid}, tid: ${waiver.tid}`
      )

      // Cancel all other pending waivers for this player
      await cancel_other_pending_waivers(
        lid,
        waiver.pid,
        waiver.wid,
        timestamp,
        'Player already claimed by super priority'
      )
    } catch (err) {
      // Mark waiver as failed with the actual error reason
      await db('waivers')
        .update({
          is_successful: 0,
          reason: err.message,
          processed: timestamp
        })
        .where('uid', waiver.wid)

      log(
        `super priority claim failed for pid: ${waiver.pid}, tid: ${waiver.tid} - ${err.message}`
      )
    }
  } else {
    // Super priority not eligible, mark as failed
    await db('waivers')
      .update({
        is_successful: 0,
        reason: 'super priority not available',
        processed: timestamp
      })
      .where('uid', waiver.wid)

    log(
      `super priority claim failed for pid: ${waiver.pid}, tid: ${waiver.tid}`
    )
  }
}

const handle_regular_practice_claim = async (waiver, lid, timestamp) => {
  let value = 0
  if (!current_season.isRegularSeason) {
    const transactions = await db('transactions').where({
      lid,
      type: transaction_types.DRAFT,
      season_year: current_season.year,
      pid: waiver.pid
    })

    if (transactions.length) {
      value = transactions[0].player_salary
    }
  }

  const release = await db('waiver_releases')
    .select('pid')
    .where('waiver_id', waiver.wid)

  await submitAcquisition({
    release: release.map((r) => r.pid),
    leagueId: lid,
    pid: waiver.pid,
    teamId: waiver.tid,
    bid: value,
    userId: waiver.user_id,
    slot: roster_slot_types.PS,
    waiverId: waiver.wid
  })

  // Reset waiver order for regular claims only
  await resetWaiverOrder({ teamId: waiver.tid, leagueId: lid })

  // Cancel all other pending waivers for this player
  await cancel_other_pending_waivers(
    lid,
    waiver.pid,
    waiver.wid,
    timestamp,
    'Player already claimed'
  )

  // Update waiver status for regular claims
  await db('waivers')
    .update({
      is_successful: 1,
      reason: null,
      processed: timestamp
    })
    .where('uid', waiver.wid)
}

const cancel_other_pending_waivers = async (
  lid,
  pid,
  waiver_id,
  timestamp,
  reason
) => {
  await db('waivers')
    .update({
      is_successful: false,
      reason,
      processed: timestamp
    })
    .where('lid', lid)
    .where('pid', pid)
    .where('type', waiver_types.FREE_AGENCY_PRACTICE)
    .where('uid', '!=', waiver_id)
    .whereNull('processed')
    .whereNull('cancelled')
}

const get_leagues_with_pending_practice_waivers = async () => {
  const results = await db('waivers')
    .select('lid')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', waiver_types.FREE_AGENCY_PRACTICE)
    .groupBy('lid')

  return results.map((w) => w.lid)
}

const process_league_practice_waivers = async (lid, timestamp) => {
  let waiver = await getTopPracticeSquadWaiver(lid)
  if (!waiver) {
    log(`no waivers ready to be processed for league ${lid}`)
    return
  }

  while (waiver) {
    let error
    try {
      if (waiver.super_priority) {
        await handle_super_priority_claim(waiver, lid, timestamp)
      } else {
        await handle_regular_practice_claim(waiver, lid, timestamp)
      }
    } catch (err) {
      error = err
    }

    // Only update waiver status if it hasn't been processed yet (super priority claims handle their own status)
    if (!waiver.super_priority) {
      await db('waivers')
        .update({
          is_successful: error ? 0 : 1,
          reason: error ? error.message : null,
          processed: timestamp
        })
        .where('uid', waiver.wid)
    }

    waiver = await getTopPracticeSquadWaiver(lid)
  }
}

export default process_practice_waivers

const main = async () => {
  let error
  try {
    const result = await process_practice_waivers()
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
  }

  const job_success = Boolean(
    !error ||
      error instanceof Errors.EmptyPracticeSquadFreeAgencyWaivers ||
      // A pause is a hold, not a failure.
      error instanceof Errors.LeaguePaused
  )
  if (!job_success) {
    console.log(error)
  }

  await report_job({
    job_type: job_types.CLAIMS_WAIVERS_PRACTICE,
    job_success,
    job_reason: error ? error.message : null
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
