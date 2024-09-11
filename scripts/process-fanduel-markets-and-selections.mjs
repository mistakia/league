import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
// import config from '#config'
import { is_main, fanduel, getPlayer } from '#libs-server'
// import { constants } from '#libs-shared'
// import { player_prop_types } from '#libs-shared/bookmaker-constants.mjs'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-fanduel-markets-and-selections')
debug.enable('process-fanduel-markets-and-selections,get-player')

const process_fanduel_markets_and_selections = async ({
  missing_only = false,
  since_date = null
} = {}) => {
  const query = db('prop_market_selections_index')
    .select(
      'prop_market_selections_index.*',
      'prop_markets_index.*',
      'nfl_games.year as nfl_games_year'
    )
    .leftJoin('prop_markets_index', function () {
      this.on(
        'prop_market_selections_index.source_market_id',
        'prop_markets_index.source_market_id'
      )
      this.andOn(
        'prop_market_selections_index.source_id',
        'prop_markets_index.source_id'
      )
      this.andOn(
        'prop_market_selections_index.time_type',
        'prop_markets_index.time_type'
      )
    })
    .leftJoin('nfl_games', 'nfl_games.esbid', 'prop_markets_index.esbid')
    .where('prop_markets_index.source_id', 'FANDUEL')

  if (since_date) {
    const since_timestamp = Math.floor(new Date(since_date).getTime() / 1000)
    query.where('prop_markets_index.timestamp', '>=', since_timestamp)
  }

  if (missing_only) {
    query.where(function () {
      this.whereNull('prop_markets_index.market_type').orWhereNull(
        'prop_market_selections_index.selection_pid'
      )
    })
  }

  const market_selection_rows = await query

  const source_market_index = {}
  const add_market_selection = ({
    source_market_id,
    market_name,
    market_type,
    market_selection_row
  }) => {
    if (!source_market_index[source_market_id]) {
      source_market_index[market_selection_row.source_market_id] = {
        source_market_id: market_selection_row.source_market_id,
        source_id: market_selection_row.source_id,
        esbid: market_selection_row.esbid,
        year: market_selection_row.year,
        nfl_games_year: market_selection_row.nfl_games_year,
        source_event_name: market_selection_row.source_event_name,
        market_name,
        market_type,
        selections: []
      }
    }
    source_market_index[source_market_id].selections.push(market_selection_row)
  }

  for (const market_selection_row of market_selection_rows) {
    // extract marketName and marketType from source_market_name
    const [market_name, market_type_with_parentheses] =
      market_selection_row.source_market_name.split(' (')
    const market_type = market_type_with_parentheses.slice(0, -1) // Remove the closing parenthesis

    add_market_selection({
      source_market_id: market_selection_row.source_market_id,
      market_name: market_name.trim(),
      market_type: market_type.trim(),
      market_selection_row
    })
  }

  log(`Loaded market types: ${Object.keys(source_market_index).length}`)

  const missing_market_types = {}
  const missing_selection_pids = {}

  for (const source_market of Object.values(source_market_index)) {
    const market_type = fanduel.get_market_type({
      marketName: source_market.market_name,
      marketType: source_market.market_type
    })
    if (!market_type) {
      missing_market_types[source_market.market_name] =
        (missing_market_types[source_market.market_name] || 0) + 1
      continue
    }

    await db('prop_markets_index')
      .where({
        source_market_id: source_market.source_market_id,
        source_id: source_market.source_id
      })
      .update({
        market_type
      })

    if (!source_market.year) {
      let year = source_market.nfl_games_year
      if (!year) {
        year = fanduel.get_market_year({
          marketName: source_market.market_name,
          source_event_name: source_market.source_event_name
        })
      }

      if (year) {
        await db('prop_markets_index')
          .where({
            source_market_id: source_market.source_market_id,
            source_id: source_market.source_id
          })
          .update({ year })
      }
    }

    for (const selection of source_market.selections) {
      const selection_type = fanduel.format_selection_type(
        selection.selection_name
      )
      if (selection_type) {
        await db('prop_market_selections_index')
          .where({
            source_market_id: source_market.source_market_id,
            source_id: source_market.source_id,
            source_selection_id: selection.source_selection_id
          })
          .update({ selection_type })

        await db('prop_market_selections_history')
          .where({
            source_market_id: source_market.source_market_id,
            source_id: source_market.source_id,
            source_selection_id: selection.source_selection_id
          })
          .update({ selection_type })
      }

      if (!selection.selection_metric_line) {
        const metric = fanduel.get_selection_metric_from_selection_name(
          selection.selection_name
        )

        if (metric) {
          await db('prop_market_selections_index')
            .where({
              source_market_id: source_market.source_market_id,
              source_id: source_market.source_id,
              source_selection_id: selection.source_selection_id
            })
            .update({
              selection_metric_line: metric
            })
        }
      }

      let player_row

      const selection_key = `${source_market.market_name} - ${selection.selection_name}`
      const name_string = fanduel.get_player_string({
        marketName: source_market.market_name,
        marketType: source_market.market_type,
        runnerName: selection.selection_name
      })

      if (!name_string) {
        log(selection)
        log(source_market)
        log('missing name string')
        missing_selection_pids[selection_key] =
          (missing_selection_pids[selection_key] || 0) + 1
        continue
      }

      const params = {
        name: name_string,
        ignore_retired: true
      }

      try {
        player_row = await getPlayer(params)
      } catch (err) {
        log(selection)
        log(params)
        log(err)
      }

      if (!player_row) {
        log(selection)
        log(params)
        missing_selection_pids[selection_key] =
          (missing_selection_pids[selection_key] || 0) + 1
        log(`Player not found: ${params.name} from ${selection_key}`)
        continue
      }

      if (selection.selection_pid) {
        // Check for conflict if selection pid already exists
        if (selection.selection_pid !== player_row.pid) {
          if (argv.force) {
            // Update if force param is set
            await db('prop_market_selections_index')
              .where({
                source_market_id: source_market.source_market_id,
                source_id: source_market.source_id,
                selection_id: selection.selection_id
              })
              .update({
                selection_pid: player_row.pid
              })
            // log(`Updated selection pid for ${selection_key}`)
          } else {
            log(
              `Conflict found for ${selection_key}, existing: ${selection.selection_pid}, new: ${player_row.pid}`
            )
          }
        }
        // If same, ignore (no action needed)
      } else {
        // If missing, update
        await db('prop_market_selections_index')
          .where({
            source_market_id: source_market.source_market_id,
            source_id: source_market.source_id,
            source_selection_id: selection.source_selection_id
          })
          .update({
            selection_pid: player_row.pid
          })
        // log(`Added selection pid for ${selection_key}`)
      }
    }
  }

  // log(Object.entries(missing_market_types).sort((a, b) => b[1] - a[1]))
  // log(Object.entries(missing_selection_pids).sort((a, b) => b[1] - a[1]))
  // iterate through markets and extract market_type from source_market_name
}

async function main() {
  let error
  try {
    await process_fanduel_markets_and_selections({
      missing_only: argv.missing_only,
      since_date: argv.since_date
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default process_fanduel_markets_and_selections
