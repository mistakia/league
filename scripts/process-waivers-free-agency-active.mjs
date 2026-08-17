import debug from 'debug'

import db from '#db'
import { Errors, get_free_agent_period } from '#libs-shared'
import { current_season, waiver_types } from '#constants'
import {
  submitAcquisition,
  resetWaiverOrder,
  getTopFreeAgencyWaiver,
  get_waiver_by_id,
  is_main,
  getLeague,
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

const process_active_waivers = async ({ daily = false, wid = null } = {}) => {
  const timestamp = new Date()

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
  if (waiver.waiver_type !== waiver_types.FREE_AGENCY) {
    throw new Error(`Waiver ${waiver_id} is not a free agency waiver`)
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
      is_successful: error ? 0 : 1,
      reason: error ? error.message : null,
      processed: timestamp
    })
    .where('uid', waiver.wid)
}

const process_bulk_active_waivers = async (daily, timestamp) => {
  // Original bulk processing logic
  // only run outside of regular season waiver period
  // Both abstentions below return the { shortfall } shape rather than bare
  // undefined, so every caller can read result.shortfall without a guard. The
  // oracle deliberately does NOT run on these paths: a waiver pending outside
  // its run window is not due, so counting it would be a false shortfall.
  if (current_season.isRegularSeason && current_season.isWaiverPeriod) {
    log('during regular season waiver period, active waivers not run')
    return { shortfall: null }
  }

  // only run daily waivers during offseason
  if (!current_season.isRegularSeason && !daily) {
    log('outside of daily waivers during offseason, active waivers not run')
    return { shortfall: null }
  }

  const league_ids = await get_leagues_with_pending_active_waivers()
  if (!league_ids.length) {
    throw new Errors.EmptyFreeAgencyWaivers()
  }

  for (const lid of league_ids) {
    const open_pause = await get_open_league_pause({ league_id: lid })
    if (open_pause) {
      log(`league ${lid} is paused; holding free agency waivers`)
      continue
    }

    if (!current_season.isRegularSeason) {
      const should_skip = await should_skip_league_in_offseason(lid)
      if (should_skip) continue
    }

    await process_league_active_waivers(lid, timestamp)
  }

  return { shortfall: await get_active_waiver_shortfall() }
}

/**
 * Oracle: free agency waivers still pending after a run that should have
 * cleared them.
 *
 * This script had no oracle at all before the league pause landed, so a run
 * that silently processed nothing exited 0 and reported success. Adding the
 * pause skip makes that gap materially worse -- a skip is now an expected
 * outcome, so "nothing happened" stops being suspicious on its face -- which is
 * why the oracle ships in the same change as the skip rather than after it.
 *
 * Paused leagues are excluded: their waivers are held ON PURPOSE and are not a
 * shortfall. This mirrors the carve-out in process-restricted-free-agency-bids,
 * and it is the whole reason the exclusion has to live in the oracle's own
 * query rather than being inferred from the loop -- a hold that trips the
 * failure detector turns every paused run into a false pipeline break.
 */
const get_active_waiver_shortfall = async () => {
  const stuck_waivers = await db('waivers')
    .select('waivers.uid', 'waivers.lid')
    .leftJoin('league_pauses', function () {
      this.on('league_pauses.league_id', '=', 'waivers.lid').andOnNull(
        'league_pauses.resumed_at'
      )
    })
    .whereNull('waivers.processed')
    .whereNull('waivers.cancelled')
    .where('waivers.type', waiver_types.FREE_AGENCY)
    .whereNull('league_pauses.pause_id')

  if (!stuck_waivers.length) return null

  return `${stuck_waivers.length} free agency waiver(s) remain unprocessed after run: uids=${stuck_waivers
    .map((waiver) => waiver.uid)
    .join(',')}`
}

// Helper functions
const validate_game_timing = async (waiver_id) => {
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

const process_waiver_claim = async (waiver, lid, timestamp) => {
  const release = await db('waiver_releases')
    .select('pid')
    .where('waiverid', waiver.wid)

  await submitAcquisition({
    release: release.map((r) => r.pid),
    leagueId: lid,
    pid: waiver.pid,
    teamId: waiver.tid,
    bid: waiver.bid_amount,
    userId: waiver.userid,
    waiverId: waiver.wid
  })

  // reset waiver order if necessary
  await handle_tied_waivers(waiver)

  // update team budget
  if (current_season.isRegularSeason) {
    await update_team_budget(waiver.tid, waiver.bid_amount)
  }

  // cancel any other pending waivers for this player
  await cancel_other_pending_waivers(lid, waiver.pid, waiver.wid, timestamp)
}

const handle_tied_waivers = async (waiver) => {
  const tied_waivers = await db('waivers')
    .where({
      bid_amount: waiver.bid_amount,
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
  await db('teams')
    .decrement('free_agent_acquisition_budget_balance', bid)
    .where({
      uid: team_id,
      season_year: current_season.year
    })
}

const cancel_other_pending_waivers = async (lid, pid, waiver_id, timestamp) => {
  await db('waivers')
    .update({
      is_successful: 0,
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
    .where('type', waiver_types.FREE_AGENCY)
    .groupBy('lid')

  return results.map((w) => w.lid)
}

const should_skip_league_in_offseason = async (lid) => {
  const league = await getLeague({ lid })

  if (league.free_agency_live_auction_start) {
    const fa_period = get_free_agent_period(league)
    if (current_season.now.isBefore(fa_period.free_agency_live_auction_start)) {
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
        is_successful: error ? 0 : 1,
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
    const result = await process_active_waivers()
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
  }

  const job_success = Boolean(
    !error ||
      error instanceof Errors.EmptyFreeAgencyWaivers ||
      error instanceof Errors.NotRegularSeason ||
      // A pause is a hold, not a failure: the single-waiver path throws this
      // rather than writing to a paused league.
      error instanceof Errors.LeaguePaused
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
