import debug from 'debug'

import db from '#db'
import { constants, Errors, get_free_agent_period } from '#libs-shared'
import {
  submitAcquisition,
  resetWaiverOrder,
  getTopFreeAgencyWaiver,
  get_waiver_by_id,
  is_main,
  getLeague,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('process:waivers:freeagency')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:waivers:freeagency')
}

const process_active_waivers = async ({ daily = false, wid = null } = {}) => {
  const timestamp = Math.round(Date.now() / 1000)

  // Handle specific waiver processing
  if (wid) {
    return await process_single_active_waiver(wid, timestamp)
  }

  // Original bulk processing logic
  return await process_bulk_active_waivers(daily, timestamp)
}

const process_single_active_waiver = async (waiver_id, timestamp) => {
  const waiver = await get_waiver_by_id(waiver_id)

  // Validate it's a free agency waiver
  if (waiver.waiver_type !== constants.waivers.FREE_AGENCY) {
    throw new Error(`Waiver ${waiver_id} is not a free agency waiver`)
  }

  const lid = waiver.lid

  // Check game timing constraints if during regular season
  if (constants.season.isRegularSeason) {
    await validate_game_timing(waiver_id)
  }

  let error
  try {
    await process_waiver_claim(waiver, lid, timestamp)
  } catch (err) {
    error = err
  }

  await db('waivers')
    .update({
      succ: error ? 0 : 1,
      reason: error ? error.message : null,
      processed: timestamp
    })
    .where('uid', waiver.wid)
}

const process_bulk_active_waivers = async (daily, timestamp) => {
  // Original bulk processing logic
  // only run outside of regular season waiver period
  if (constants.season.isRegularSeason && constants.season.isWaiverPeriod) {
    log('during regular season waiver period, active waivers not run')
    return
  }

  // only run daily waivers during offseason
  if (!constants.season.isRegularSeason && !daily) {
    log('outside of daily waivers during offseason, active waivers not run')
    return
  }

  const league_ids = await get_leagues_with_pending_active_waivers()
  if (!league_ids.length) {
    throw new Errors.EmptyFreeAgencyWaivers()
  }

  for (const lid of league_ids) {
    if (!constants.season.isRegularSeason) {
      const should_skip = await should_skip_league_in_offseason(lid)
      if (should_skip) continue
    }

    await process_league_active_waivers(lid, timestamp)
  }
}

// Helper functions
const validate_game_timing = async (waiver_id) => {
  const waiver_with_game_info = await db('waivers')
    .select('waivers.*', 'nfl_games.date', 'nfl_games.time_est')
    .join('player', 'waivers.pid', 'player.pid')
    .joinRaw(
      `left join nfl_games on (player.current_nfl_team = nfl_games.v or player.current_nfl_team = nfl_games.h) and (nfl_games.week = ${constants.season.week} or nfl_games.week is null) and (nfl_games.year = ${constants.season.year} or nfl_games.year is null) and (nfl_games.seas_type = 'REG' or nfl_games.seas_type is null)`
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

const process_waiver_claim = async (waiver, lid, timestamp) => {
  const release = await db('waiver_releases')
    .select('pid')
    .where('waiverid', waiver.wid)

  await submitAcquisition({
    release: release.map((r) => r.pid),
    leagueId: lid,
    pid: waiver.pid,
    teamId: waiver.tid,
    bid: waiver.bid,
    userId: waiver.userid,
    waiverId: waiver.wid
  })

  // reset waiver order if necessary
  await handle_tied_waivers(waiver)

  // update team budget
  if (constants.season.isRegularSeason) {
    await update_team_budget(waiver.tid, waiver.bid)
  }

  // cancel any other pending waivers for this player
  await cancel_other_pending_waivers(lid, waiver.pid, waiver.wid, timestamp)
}

const handle_tied_waivers = async (waiver) => {
  const tied_waivers = await db('waivers')
    .where({
      bid: waiver.bid,
      pid: waiver.pid,
      lid: waiver.lid,
      type: waiver.waiver_type
    })
    .whereNot('uid', waiver.wid)
    .whereNot('tid', waiver.tid)
    .whereNull('processed')
    .whereNull('cancelled')

  if (tied_waivers.length) {
    await resetWaiverOrder({ leagueId: waiver.lid, teamId: waiver.tid })
  }
}

const update_team_budget = async (team_id, bid) => {
  await db('teams').decrement('faab', bid).where({
    uid: team_id,
    year: constants.season.year
  })
}

const cancel_other_pending_waivers = async (lid, pid, waiver_id, timestamp) => {
  await db('waivers')
    .update({
      succ: 0,
      reason: 'Player already claimed',
      processed: timestamp
    })
    .where('lid', lid)
    .where('pid', pid)
    .where('uid', '!=', waiver_id)
    .whereNull('processed')
    .whereNull('cancelled')
}

const get_leagues_with_pending_active_waivers = async () => {
  const results = await db('waivers')
    .select('lid')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.FREE_AGENCY)
    .groupBy('lid')

  return results.map((w) => w.lid)
}

const should_skip_league_in_offseason = async (lid) => {
  const league = await getLeague({ lid })

  if (league.free_agency_live_auction_start) {
    const fa_period = get_free_agent_period(league)
    if (
      constants.season.now.isBefore(fa_period.free_agency_live_auction_start)
    ) {
      // skip leagues during offseason before start of free agency auction
      return true
    }
  } else {
    // skip leagues during offseason with no scheduled free agency period
    return true
  }

  return false
}

const process_league_active_waivers = async (lid, timestamp) => {
  let waiver = await getTopFreeAgencyWaiver(lid)
  if (!waiver) {
    log(`no waivers ready to be processed for league ${lid}`)
    return
  }

  while (waiver) {
    let error
    try {
      await process_waiver_claim(waiver, lid, timestamp)
    } catch (err) {
      error = err
    }

    await db('waivers')
      .update({
        succ: error ? 0 : 1,
        reason: error ? error.message : null, // TODO - add error codes
        processed: timestamp
      })
      .where('uid', waiver.wid)

    waiver = await getTopFreeAgencyWaiver(lid)
  }
}

export default process_active_waivers

const main = async () => {
  let error
  try {
    await process_active_waivers()
  } catch (err) {
    error = err
  }

  const job_success = Boolean(
    !error ||
      error instanceof Errors.EmptyFreeAgencyWaivers ||
      error instanceof Errors.NotRegularSeason
  )
  if (!job_success) {
    console.log(error)
  }

  await report_job({
    job_type: job_types.CLAIMS_WAIVERS_ACTIVE,
    job_success,
    job_reason: error ? error.message : null
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
