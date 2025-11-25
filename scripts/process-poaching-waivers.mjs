import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { constants, Errors, get_free_agent_period } from '#libs-shared'
import {
  sendNotifications,
  submitPoach,
  resetWaiverOrder,
  getTopPoachingWaiver,
  getLeague,
  report_job,
  is_main
} from '#libs-server'
import db from '#db'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('process:waivers:poach')
if (process.env.NODE_ENV !== 'test') {
  debug.enable('process:waivers:poach')
}

const run = async ({ daily = false } = {}) => {
  const timestamp = Math.round(Date.now() / 1000)

  // Check if it's the first 24 hours of the regular season
  const is_first_24_hours_of_regular_season = constants.season.now.isBetween(
    constants.season.regular_season_start.add(7, 'days'),
    constants.season.regular_season_start.add(8, 'days')
  )

  if (is_first_24_hours_of_regular_season) {
    log(
      `First 24 hours of regular season, a poaching sanctuary period, skipping poaching waivers`
    )
    return
  }

  // get leagueIds with pending waivers
  const results = await db('waivers')
    .select('lid')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.POACH)
    .groupBy('lid')

  const leagueIds = results.map((w) => w.lid)

  if (!leagueIds.length) {
    throw new Errors.EmptyPoachingWaivers()
  }

  for (const lid of leagueIds) {
    const league = await getLeague({ lid })
    const free_agency_period = get_free_agent_period(league)
    if (
      !constants.season.isRegularSeason &&
      constants.season.now.isAfter(free_agency_period.start) &&
      !daily
    ) {
      log(
        `outside of daily waivers run during free agency period, skipping league ${lid}`
      )
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
          .where('waiverid', waiver.wid)
        await submitPoach({
          release: release.map((r) => r.pid),
          leagueId: waiver.lid,
          userId: waiver.userid,
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
        const player_rows = await db('player').where('pid', waiver.pid).limit(1)
        const player_row = player_rows[0]
        await sendNotifications({
          league,
          teamIds: [waiver.tid],
          voice: false,
          notifyLeague: false,
          message: `Your waiver claim to poach ${player_row.fname} ${player_row.lname} was unsuccessful.`
        })
      }

      await db('waivers')
        .update({
          succ: error ? 0 : 1,
          reason: error ? error.message : null, // TODO - add error codes
          processed: timestamp
        })
        .where('uid', waiver.wid)

      waiver = await getTopPoachingWaiver(lid)
    }
  }
}

export default run

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const daily = argv.daily
    await run({ daily })
  } catch (err) {
    error = err
  }

  const job_success = Boolean(
    !error || error instanceof Errors.EmptyPoachingWaivers
  )
  if (!job_success) {
    console.log(error)
  }

  await report_job({
    job_type: job_types.CLAIMS_WAIVERS_POACH,
    job_reason: error ? error.message : null,
    job_success
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
