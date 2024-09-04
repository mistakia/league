import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-matchup-projection')
debug.enable('calculate-matchup-projection')

const calculate_matchup_projection = async ({
  year = constants.season.year,
  lid = 1
}) => {
  log(`Calculating matchup projections for lid ${lid} in ${year}`)
  const lineups = await db('league_team_lineups').where({ year, lid })
  const matchups = await db('matchups').where({ year, lid })

  log(`Found ${lineups.length} lineups and ${matchups.length} matchups`)

  const matchup_updates = []

  for (const matchup of matchups) {
    const home_lineup = lineups.find(
      (l) => l.tid === matchup.hid && l.week === matchup.week
    )
    const away_lineup = lineups.find(
      (l) => l.tid === matchup.aid && l.week === matchup.week
    )

    if (!home_lineup || !away_lineup) {
      log(`Missing lineup for matchup: ${matchup.uid}`)
      continue
    }

    const home_projection = home_lineup.baseline_total
    const away_projection = away_lineup.baseline_total

    matchup_updates.push({
      ...matchup,
      home_projection,
      away_projection
    })
  }

  if (argv.dry) {
    log(matchup_updates[0])
    return
  }

  if (matchup_updates.length) {
    log(`Updating ${matchup_updates.length} matchups in lid ${lid} for ${year}`)
    await db('matchups').insert(matchup_updates).onConflict('uid').merge()
  }
}

const main = async () => {
  let error
  try {
    await calculate_matchup_projection({
      year: argv.year,
      lid: argv.lid
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default calculate_matchup_projection
