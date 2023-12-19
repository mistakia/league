import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-playoff-matchup-projection')
debug.enable('calculate-playoff-matchup-projection')

const calculate_playoff_matchup_projection = async ({
  year = constants.season.year,
  lid = 1
}) => {
  log(`Calculating playoff matchup projections for lid ${lid} in ${year}`)
  const lineups = await db('league_team_lineups').where({ year, lid })
  const playoffs = await db('playoffs').where({ year, lid })

  log(`Found ${lineups.length} lineups and ${playoffs.length} playoffs`)

  const playoff_updates = []

  for (const playoff of playoffs) {
    const team_lineup = lineups.find(
      (l) => l.tid === playoff.tid && l.week === playoff.week
    )

    if (!team_lineup) {
      log(`Missing lineup for playoff: ${playoff.uid}`)
      continue
    }

    const team_projection = team_lineup.baseline_total

    playoff_updates.push({
      ...playoff,
      projection: team_projection
    })
  }

  if (argv.dry) {
    log(playoff_updates[0])
    return
  }

  if (playoff_updates.length) {
    log(`Updating ${playoff_updates.length} playoffs in lid ${lid} for ${year}`)
    await db('playoffs').insert(playoff_updates).onConflict('uid').merge()
  }
}

const main = async () => {
  let error
  try {
    await calculate_playoff_matchup_projection({
      year: argv.year,
      lid: argv.lid
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default calculate_playoff_matchup_projection
