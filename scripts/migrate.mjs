import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import config from '#config'
import { isMain, insert_prop_markets } from '#libs-server'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('migrate')
debug.enable('migrate,insert-prop-markets')

const migrate = async () => {
  const market_rows = await db('prop_markets')
    .where('source_id', 14)
    .orderBy('timestamp', 'asc')

  log(`market_rows.length: ${market_rows.length}`)

  const formatted_market_inserts = []

  for (const market_row of market_rows) {
    const formatted_row = {
      market_type: market_row.market_type,
      source_id: 'FANDUEL',
      source_market_id: market_row.market_id,
      source_market_name: market_row.market_name,

      esbid: null,
      source_event_id: market_row.source_event_id,
      source_event_name: null,

      open: Boolean(market_row.open),
      live: Boolean(market_row.live),
      selection_count: market_row.runners,
      selections: [],

      timestamp: market_row.timestamp
    }

    formatted_market_inserts.push(formatted_row)
  }

  await insert_prop_markets(formatted_market_inserts)
}

async function main() {
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
