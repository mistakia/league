import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import config from '#config'
import { isMain } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('migrate')
debug.enable('migrate,insert-prop-markets')

const migrate = async () => {
  // get market_rows that do not exist prop_markets_history
  const market_rows = await db('prop_markets_index').select(
    'prop_markets_index.*'
  )
  // .leftJoin('prop_markets_history', function () {
  //   this.on(db.raw(`prop_markets_history.source_id = 'BETRIVERS'`))
  //   this.on(
  //     'prop_markets_history.source_market_id',
  //     '=',
  //     'prop_markets.market_id'
  //   )
  //   this.on('prop_markets_history.timestamp', '=', 'prop_markets.timestamp')
  // })
  // .whereNull('prop_markets_history.source_id')

  log(`market_rows.length: ${market_rows.length}`)

  const formatted_market_inserts = []

  const format_source_id = (source_id) => {
    switch (source_id) {
      case 14:
        return 'DRAFTKINGS'

      case 20:
        return 'CAESARS'

      case 21:
        return 'FANDUEL'

      case 22:
        return 'BETMGM'

      case 25:
        return 'BETRIVERS'

      default:
        throw new Error(`unknown source_id: ${source_id}`)
    }
  }

  for (const market_row of market_rows) {
    const formatted_row = {
      market_type: market_row.market_type,
      source_id: format_source_id(market_row.source_id),
      source_market_id: market_row.market_id,
      source_market_name: market_row.market_name,

      esbid: null,
      source_event_id: market_row.source_event_id,
      source_event_name: null,

      open: Boolean(market_row.open),
      live: Boolean(market_row.live),
      selection_count: market_row.runners,
      selections: []
    }

    formatted_market_inserts.push(formatted_row)
  }

  const missing_inserts = []

  for (const formatted_market_insert of formatted_market_inserts) {
    process.stdout.clearLine()
    process.stdout.cursorTo(0)
    process.stdout.write(
      `Processing: ${
        formatted_market_inserts.indexOf(formatted_market_insert) + 1
      }/${formatted_market_inserts.length}`
    )

    // check if it already exists in the `prop_markets_history` table

    // get all rows that match the source_id, source_market_id
    // then check if the entry right before the timestamp is the same

    const rows = await db('prop_markets_history')
      .where('source_id', formatted_market_insert.source_id)
      .where('source_market_id', formatted_market_insert.source_market_id)
      .orderBy('timestamp', 'asc')

    if (!rows.length) {
      log(`missing rows for ${formatted_market_insert.source_market_id}`)
      missing_inserts.push(formatted_market_insert)
      continue
    }

    // find if exact timestamp exists
    let index = rows.findIndex(
      (row) => row.timestamp === formatted_market_insert.timestamp
    )

    // if exact timestamp does not exist, find index of the row that precedes the timestamp
    if (index === -1) {
      index = rows.findIndex(
        (row) => row.timestamp >= formatted_market_insert.timestamp
      )

      if (index === -1) {
        index = rows.length - 1
      } else if (index > 0) {
        index -= 1
      }
    }

    const row = rows[index]

    if (Boolean(row.open) !== Boolean(formatted_market_insert.open)) {
      log(`open mismatch for ${formatted_market_insert.source_market_id}`)
      missing_inserts.push(formatted_market_insert)
      continue
    }

    if (Boolean(row.live) !== Boolean(formatted_market_insert.live)) {
      log(`live mismatch for ${formatted_market_insert.source_market_id}`)
      missing_inserts.push(formatted_market_insert)
      continue
    }

    if (row.selection_count !== formatted_market_insert.selection_count) {
      log(
        `selection_count mismatch for ${formatted_market_insert.source_market_id}`
      )
      missing_inserts.push(formatted_market_insert)
      continue
    }

    if (row.source_market_name !== formatted_market_insert.source_market_name) {
      log(
        `source_market_name mismatch for ${formatted_market_insert.source_market_id}`
      )
      missing_inserts.push(formatted_market_insert)
      continue
    }
  }

  log(`missing_inserts.length: ${missing_inserts.length}`)
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
   *   type: job_types.EXAMPLE,
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
