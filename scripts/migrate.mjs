import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import { constants } from '#common'
import { isMain } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('migrate')
debug.enable('migrate')

const migrate = async () => {
  await db.schema.alterTable('nfl_plays', function (table) {
    table.string('kick_player', 7).nullable()
    table.string('kick_gsis', 36).nullable()
    table.tinyint('fga', 1).nullable()
    table.tinyint('xpa', 1).nullable()
    table.tinyint('lateral', 1).nullable()
    table.string('td_gsis', 36).nullable()

    table.dropColumn('yds_gained')
  })

  log('all tables migrated')
}

const main = async () => {
  let error
  try {
    await migrate()
  } catch (err) {
    error = err
    log(error)
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

export default migrate
