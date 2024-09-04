import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import config from '#config'
import { is_main, insert_prop_markets } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('migrate')
debug.enable('migrate,insert-prop-markets')

const migrate = async () => {
  // get market_rows that do not exist prop_markets_history
  const market_rows = await db('prop_markets')
    .select('prop_markets.*')
    .leftJoin('prop_markets_history', function () {
      this.on(db.raw(`prop_markets_history.source_id = 'DRAFTKINGS'`))
      this.on(
        'prop_markets_history.source_market_id',
        '=',
        'prop_markets.market_id'
      )
      this.on('prop_markets_history.timestamp', '=', 'prop_markets.timestamp')
    })
    .where('prop_markets.source_id', 14)
    .whereNull('prop_markets_history.source_id')
    .orderBy('prop_markets.timestamp', 'asc')

  log(`market_rows.length: ${market_rows.length}`)

  const formatted_market_inserts = []

  for (const market_row of market_rows) {
    const formatted_row = {
      market_type: market_row.market_type,
      source_id: 'DRAFTKINGS',
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

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default migrate
