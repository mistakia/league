import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('archive-projections')
debug.enable('archive-projections')

const archiveProjections = async () => {
  const insert_result = await db.raw(
    `INSERT IGNORE INTO projections_archive SELECT * FROM projections where year != ${constants.season.year}`
  )
  log(insert_result)
  // log(`Inserted ${inserted} projections`)

  const delete_result = await db('projections')
    .whereNot({ year: constants.season.year })
    .del()
  log(`Deleted ${delete_result} projections`)
}

const main = async () => {
  let error
  try {
    await archiveProjections()
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

export default archiveProjections
