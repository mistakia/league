import debug from 'debug'

import db from '#db'
import { constants, Errors } from '#libs-shared'
import {
  submitAcquisition,
  resetWaiverOrder,
  getTopPracticeSquadWaiver,
  get_waiver_by_id,
  get_super_priority_status,
  process_super_priority,
  is_main,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('process:waivers:freeagency')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:waivers:freeagency')
}

const process_practice_waivers = async ({ daily = false, wid = null } = {}) => {
  const timestamp = Math.round(Date.now() / 1000)

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
  if (waiver.waiver_type !== constants.waivers.FREE_AGENCY_PRACTICE) {
    throw new Error(`Waiver ${waiver_id} is not a practice squad waiver`)
  }

  const lid = waiver.lid

  // Check game timing constraints if during regular season
  if (constants.season.isRegularSeason) {
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
          succ: 0,
          reason: error.message,
          processed: timestamp
        })
        .where('uid', waiver.wid)
    }
  }
}

const process_bulk_practice_waivers = async (daily, timestamp) => {
  // Original bulk processing logic
  if (constants.season.week > constants.season.finalWeek) {
    log('after final week, practice waivers not run')
    return
  }

  // only run daily waivers during offseason
  if (!constants.season.isRegularSeason && !daily) {
    log('outside of daily waivers during offseason, practice waivers not run')
    return
  }

  if (constants.season.isRegularSeason && constants.season.isWaiverPeriod) {
    return
  }

  const league_ids = await get_leagues_with_pending_practice_waivers()
  if (!league_ids.length) {
    throw new Errors.EmptyPracticeSquadFreeAgencyWaivers()
  }

  for (const lid of league_ids) {
    await process_league_practice_waivers(lid, timestamp)
  }
}

// Helper functions
const validate_game_timing = async (waiver_id, lid) => {
  const waiver_with_game_info = await db('waivers')
    .select('waivers.*', 'nfl_games.date', 'nfl_games.time_est')
    .join('player', 'waivers.pid', 'player.pid')
    .joinRaw(
      `left join nfl_games on nfl_games.week = ${constants.season.week} and nfl_games.year = ${constants.season.year} and nfl_games.seas_type = 'REG' and (player.current_nfl_team = nfl_games.v or player.current_nfl_team = nfl_games.h)`
    )
    .where('waivers.uid', waiver_id)
    .first()

  if (waiver_with_game_info && waiver_with_game_info.date) {
    const dayjs = await import('dayjs')
    const timezone = await import('dayjs/plugin/timezone.js')
    dayjs.default.extend(timezone.default)

    const now = dayjs.default()
    const game_start = dayjs.default.tz(
      `${waiver_with_game_info.date} ${waiver_with_game_info.time_est}`,
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
      .where('waiverid', waiver.wid)

    // Process super priority claim
    await process_super_priority({
      pid: waiver.pid,
      original_tid: waiver.tid,
      lid,
      super_priority_uid: super_priority_status.super_priority_uid,
      userid: waiver.userid,
      release: release.map((r) => r.pid)
    })

    // Mark waiver as successful
    await db('waivers')
      .update({
        succ: 1,
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
  } else {
    // Super priority not eligible, mark as failed
    await db('waivers')
      .update({
        succ: 0,
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
  if (!constants.season.isRegularSeason) {
    const transactions = await db('transactions').where({
      lid,
      type: constants.transactions.DRAFT,
      year: constants.season.year,
      pid: waiver.pid
    })

    if (transactions.length) {
      value = transactions[0].value
    }
  }

  const release = await db('waiver_releases')
    .select('pid')
    .where('waiverid', waiver.wid)

  await submitAcquisition({
    release: release.map((r) => r.pid),
    leagueId: lid,
    pid: waiver.pid,
    teamId: waiver.tid,
    bid: value,
    userId: waiver.userid,
    slot: constants.slots.PS,
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
      succ: 1,
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
      succ: false,
      reason,
      processed: timestamp
    })
    .where('lid', lid)
    .where('pid', pid)
    .where('type', constants.waivers.FREE_AGENCY_PRACTICE)
    .where('uid', '!=', waiver_id)
    .whereNull('processed')
    .whereNull('cancelled')
}

const get_leagues_with_pending_practice_waivers = async () => {
  const results = await db('waivers')
    .select('lid')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.FREE_AGENCY_PRACTICE)
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
          succ: error ? 0 : 1,
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
    await process_practice_waivers()
  } catch (err) {
    error = err
  }

  const job_success = Boolean(
    !error || error instanceof Errors.EmptyPracticeSquadFreeAgencyWaivers
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
