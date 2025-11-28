import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { getPlayerExtensions, is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('calculate-player-extension-count')
debug.enable('calculate-player-extension-count')

const run = async ({ lid }) => {
  const rosters = await db('rosters')
    .select('*')
    .where({ lid, year: current_season.year })
    .orderBy('week', 'desc')

  const rows = await db('rosters_players').whereIn(
    'rid',
    rosters.map((r) => r.uid)
  )

  for (const { pid, rid } of rows) {
    const extensions = await getPlayerExtensions({ lid, pid })
    await db('rosters_players')
      .update({ extensions: extensions.length })
      .where({ pid, rid })
  }

  log(`set extensions for ${rows.length} players`)
}

export default run

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const lid = argv.lid
    if (!lid) {
      return console.log('missing --lid')
    }
    await run({ lid })
  } catch (err) {
    error = err
    console.log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
