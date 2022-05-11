import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { getPlayerExtensions, isMain } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-player-extension-count')
debug.enable('calculate-player-extension-count')

const run = async ({ lid }) => {
  const rosters = await db('rosters')
    .select('*')
    .where({ lid, year: constants.season.year })
    .orderBy('week', 'desc')

  const rows = await db('rosters_players').whereIn(
    'rid',
    rosters.map((r) => r.uid)
  )

  for (const { player, rid } of rows) {
    const extensions = await getPlayerExtensions({ lid, player })
    await db('rosters_players')
      .update({ extensions: extensions.length })
      .where({ player, rid })
  }

  log(`set extensions for ${rows.length} players`)
}

export default run

const main = async () => {
  let error
  try {
    const lid = argv.lid
    if (!lid) {
      return console.log('missing --lid')
    }
    await run({ lid })
  } catch (err) {
    error = err
    console.log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}
