import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('archive-projections')
debug.enable('archive-projections')

const archiveProjections = async () => {
  const insert_result = await db.raw(
    `INSERT IGNORE INTO projections_archive SELECT * FROM projections where year != ${constants.season.year};`
  )
  log(insert_result)

  const delete_result = await db.raw(
    `DELETE p
    FROM projections p
    INNER JOIN projections_archive pa
    ON p.sourceid = pa.sourceid
    AND p.pid = pa.pid
    AND p.userid = pa.userid
    AND p.week = pa.week
    AND p.year = pa.year
    AND p.timestamp = pa.timestamp;
    `
  )
  log(delete_result)
}

const main = async () => {
  let error
  try {
    await archiveProjections()
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default archiveProjections
