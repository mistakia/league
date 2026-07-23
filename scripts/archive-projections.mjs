import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('archive-projections')
debug.enable('archive-projections')

const archiveProjections = async () => {
  // NOTE (2026-07-22): this file carries pre-existing bugs that make it inert against
  // the production Postgres schema -- both raw statements use MySQL-only grammar
  // (`INSERT IGNORE`, `DELETE <alias> FROM ... INNER JOIN`) and `SELECT *` cannot
  // positionally match projections -> projections_archive (differing column sets).
  // The column names are kept conformant (season_year/generated_at) so a future
  // Postgres rewrite need not re-rename; the statements are otherwise left as-is
  // deliberately -- a half-fixed DELETE against a 4.6M-row live table is more
  // dangerous than an inert script. Full rewrite tracked separately.
  const insert_result = await db.raw(
    `INSERT IGNORE INTO projections_archive SELECT * FROM projections where season_year != ${current_season.year};`
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
    AND p.season_year = pa.season_year
    AND p.generated_at = pa.generated_at;
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
