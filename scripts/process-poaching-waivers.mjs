import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { Errors, get_free_agent_period } from '#libs-shared'
import { is_auction_complete } from '#libs-server/auction-completion.mjs'
import { current_season, waiver_types } from '#constants'
import {
  submitPoach,
  resetWaiverOrder,
  getTopPoachingWaiver,
  getLeague,
  report_job,
  is_main,
  throw_if_shortfall
} from '#libs-server'
import { get_open_league_pause } from '#libs-server/league-pause.mjs'
import db from '#db'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('process:waivers:poach')
if (process.env.NODE_ENV !== 'test') {
  enable_debug_namespaces('process:waivers:poach')
}

const run = async ({ daily = false } = {}) => {
  const timestamp = new Date()

  // Check if it's the first 24 hours of the regular season
  const is_first_24_hours_of_regular_season = current_season.now.isBetween(
    current_season.regular_season_start.add(7, 'days'),
    current_season.regular_season_start.add(8, 'days')
  )

  if (is_first_24_hours_of_regular_season) {
    log(
      `First 24 hours of regular season, a poaching sanctuary period, skipping poaching waivers`
    )
    return { shortfall: null }
  }

  // get leagueIds with pending waivers
  const results = await db('waivers')
    .select('lid')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', waiver_types.POACH)
    .groupBy('lid')

  const leagueIds = results.map((w) => w.lid)

  if (!leagueIds.length) {
    throw new Errors.EmptyPoachingWaivers()
  }

  for (const lid of leagueIds) {
    const league = await getLeague({ lid })

    // A paused league is HELD, not failed. The oracle below is loop-scoped and
    // returns { shortfall: null } for a league it never reached, so skipping
    // here cannot manufacture a false pipeline failure.
    const open_pause = await get_open_league_pause({ league_id: lid })
    if (open_pause) {
      log(`league ${lid} is paused; holding poaching waivers`)
      continue
    }

    const free_agency_period = get_free_agent_period(league)
    const is_within_free_agency_period =
      !current_season.is_regular_season &&
      free_agency_period.start &&
      current_season.now.isAfter(free_agency_period.start)

    if (is_within_free_agency_period && !daily) {
      log(
        `outside of daily waivers run during free agency period, skipping league ${lid}`
      )
      continue
    }

    // A POACH FILLS AN ACTIVE ROSTER SPOT, so awarding one mid-auction moves a
    // team out of an eligible set without passing through settlement -- and
    // eligibility monotonicity is what second-price settlement rests on.
    // Article XII Section 7 processes poaching waivers the day AFTER the
    // auction, which under the collapsed timestamps means once it completes.
    if (is_within_free_agency_period && !(await is_auction_complete({ lid }))) {
      log(`auction still running, holding poaching waivers for league ${lid}`)
      continue
    }

    let waiver = await getTopPoachingWaiver(lid)
    if (!waiver) {
      log(`no waivers ready to be processed for league ${lid}`)
      continue
    }

    while (waiver) {
      let error

      try {
        const release = await db('waiver_releases')
          .select('pid')
          .where('waiver_id', waiver.wid)
        await submitPoach({
          release: release.map((r) => r.pid),
          leagueId: waiver.lid,
          userId: waiver.user_id,
          pid: waiver.pid,
          teamId: waiver.tid,
          team: waiver,
          is_waiver: true
        })

        log(
          `poaching waiver awarded to ${waiver.name} (${waiver.tid}) for ${waiver.pid}`
        )

        await resetWaiverOrder({ leagueId: waiver.lid, teamId: waiver.tid })
      } catch (err) {
        error = err
        log(
          `poaching waiver unsuccessful for ${waiver.name} (${waiver.tid}) because ${error.message}`
        )
      }

      await db('waivers')
        .update({
          is_successful: error ? 0 : 1,
          reason: error ? error.message : null, // TODO - add error codes
          processed: timestamp
        })
        .where('waiver_id', waiver.wid)

      waiver = await getTopPoachingWaiver(lid)
    }
  }

  // Oracle: no POACH waiver that was pending at run start should remain
  // unprocessed. A non-empty result means the loop silently skipped eligible
  // waivers — surface that as a shortfall.
  const stuck_waivers = await db('waivers')
    .select('waiver_id', 'lid', 'pid')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', waiver_types.POACH)
    .whereIn('lid', leagueIds)

  if (stuck_waivers.length > 0) {
    return {
      shortfall: `${stuck_waivers.length} poaching waiver(s) remain unprocessed after run: waiver_ids=${stuck_waivers.map((w) => w.waiver_id).join(',')}`
    }
  }

  return { shortfall: null }
}

export default run

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const daily = argv.daily
    const result = await run({ daily })
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
    if (!(error instanceof Errors.EmptyPoachingWaivers)) {
      console.log(error)
    }
  }

  await report_job({
    job_type: job_types.CLAIMS_WAIVERS_POACH,
    error: error instanceof Errors.EmptyPoachingWaivers ? null : error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
