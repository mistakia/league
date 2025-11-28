import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { is_main } from '#libs-server'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('calculate-playoff-matchup-projection')
debug.enable('calculate-playoff-matchup-projection')

const calculate_playoff_matchup_projection = async ({
  year = current_season.year,
  lid = 1,
  dry = false
} = {}) => {
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

  if (dry) {
    log(playoff_updates[0])
    return
  }

  if (playoff_updates.length) {
    log(`Updating ${playoff_updates.length} playoffs in lid ${lid} for ${year}`)
    await db('playoffs')
      .insert(playoff_updates)
      .onConflict(['uid', 'tid', 'year', 'week'])
      .merge()
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await calculate_playoff_matchup_projection({
      year: argv.year,
      lid: argv.lid,
      dry: argv.dry
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

export default calculate_playoff_matchup_projection
