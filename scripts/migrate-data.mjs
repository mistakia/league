import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'
import { Odds } from 'oddslib'

import db from '#db'
import { isMain } from '#utils'
// import { constants } from '#common'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('migrate-data')
debug.enable('migrate-data')

const migrateData = async () => {
  const props = await db('props').whereNull('u_am').orWhereNull('o_am')

  for (const prop of props) {
    const { pid, sourceid, year, wk, type, id, o, u, timestamp } = prop
    const o_am = Odds.from('decimal', o).to('moneyline', {
      precision: 0
    })
    const u_am = Odds.from('decimal', u).to('moneyline', {
      precision: 0
    })
    await db('props')
      .update({
        o_am,
        u_am
      })
      .where({
        pid,
        year,
        wk,
        sourceid,
        type,
        timestamp,
        id
      })
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
