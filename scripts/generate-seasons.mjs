import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'
import { is_main, report_job, throw_if_shortfall } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('generate-seasons')
debug.enable('generate-seasons')

const generate_seasons = async () => {
  // get all hosted leagues that are not archived
  const leagues = await db('leagues')
    .where({ hosted: 1 })
    .whereNull('archived_at')

  log(`Found ${leagues.length} active hosted leagues`)

  for (const league of leagues) {
    const { uid: lid } = league

    // get the latest season for this league
    const season = await db('seasons')
      .where({ lid })
      .orderBy('year', 'desc')
      .first()

    if (!season) {
      log(`No season found for league ${lid}`)
      continue
    }

    // if the latest season is not the current season, create a new season
    if (season.year !== current_season.year) {
      const new_season = {
        ...season,

        // reset
        tran_start: null,
        tran_end: null,
        draft_start: null,
        draft_type: null,
        draft_hour_min: null,
        draft_hour_max: null,
        draft_pick_clock_hours: 24,
        free_agency_live_auction_start: null,
        tddate: null,

        season_started_at: null
      }
      await db('seasons').insert({
        ...new_season,
        lid,
        year: current_season.year
      })
      log(`Created new season for league ${lid} (${current_season.year})`)
    }
  }

  // Oracle: every active hosted league that had any prior seasons row must
  // now have a seasons row for current_season.year. Leagues with no prior
  // seasons are deliberately out of scope (logged-and-skipped above) because
  // this script cannot manufacture a season from nothing.
  const expected_lids = await db('leagues')
    .where({ 'leagues.hosted': 1 })
    .whereNull('leagues.archived_at')
    .whereExists(function () {
      this.select('*').from('seasons').whereRaw('seasons.lid = leagues.uid')
    })
    .pluck('leagues.uid')

  if (!expected_lids.length) {
    return { shortfall: null }
  }

  const present_lids = await db('seasons')
    .where({ year: current_season.year })
    .whereIn('lid', expected_lids)
    .pluck('lid')

  const present = new Set(present_lids)
  const missing = expected_lids.filter((lid) => !present.has(lid))

  if (missing.length) {
    return {
      shortfall: `seasons row absent for year ${current_season.year} on ${missing.length} active hosted league(s): ${missing.join(', ')}`
    }
  }

  return { shortfall: null }
}

const main = async () => {
  let error
  try {
    const result = await generate_seasons()
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.GENERATE_NEW_SEASONS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_seasons
