import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { isMain } from '#utils'
// import { constants } from '#common'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('migrate-data')
debug.enable('migrate-data')

const migrateData = async () => {
  const props = await db('props')

  for (const prop of props) {
    const { pid, sourceid, year, wk, type, ln, o, u } = prop
    const grouped_props = await db('props').where({
      pid,
      sourceid,
      year,
      wk,
      type,
      ln,
      o,
      u
    })

    log(`grouped count ${grouped_props.length}`)
    if (grouped_props.length < 2) continue

    const sorted = grouped_props.sort((a, b) => a.timestamp - b.timestamp)
    const earliest_timestamp = sorted[0].timestamp
    log(`first timestamp: ${earliest_timestamp}`)
    const count = await db('props')
      .del()
      .where({ pid, sourceid, year, wk, type, ln, o, u })
      .whereNot({ timestamp: earliest_timestamp })
    log(`deleted ${count} rows`)
  }
}

const main = async () => {
  let error
  try {
    await migrateData()
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

export default migrateData
