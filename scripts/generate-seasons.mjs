import debug from 'debug'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain } from '#libs-server'

const log = debug('generate-seasons')
debug.enable('generate-seasons')

const generate_seasons = async () => {
  // get all hosted leagues that are not archived
  const leagues = await db('leagues')
    .where({ hosted: 1 })
    .whereNull('archived_at')

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
    if (season.year !== constants.season.year) {
      const new_season = {
        ...season,

        // reset
        tran_start: null,
        tran_end: null,
        draft_start: null,
        draft_type: null,
        draft_hour_min: null,
        draft_hour_max: null,
        adate: null,
        tddate: null,

        season_started_at: null
      }
      await db('seasons').insert({
        ...new_season,
        lid,
        year: constants.season.year
      })
      log(`Created new season for league ${lid} (${constants.season.year})`)
    }
  }
}

const main = async () => {
  let error
  try {
    await generate_seasons()
  } catch (err) {
    error = err
    log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.GENERATE_NEW_SEASONS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default generate_seasons
