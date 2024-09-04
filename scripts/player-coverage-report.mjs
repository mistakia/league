import debug from 'debug'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

import db from '#db'
import { is_main } from '#libs-server'

const log = debug('player-coverage-report')
debug.enable('player-coverage-report')

const player_coverage_report = async ({ table_name = 'player' }) => {
  // get a list of columns in the players table
  const columns = await db(table_name).columnInfo()
  const column_keys = Object.keys(columns)

  log(`Calculating coverage for ${column_keys.length} columns`)

  const results_index = {}

  for (const column of column_keys) {
    results_index[column] = {
      column,
      coverage: null
    }
  }

  const coverage_selects = []
  for (const column of column_keys) {
    coverage_selects.push(
      db.raw(
        `100.0 * COUNT(CASE WHEN "${table_name}"."${column}" IS NOT NULL THEN 1 END)::float / COUNT(*)::float AS "${column}_coverage"`
      )
    )
  }

  const coverage_query = await db(table_name).select(coverage_selects).first()

  for (const column of column_keys) {
    results_index[column].coverage = coverage_query[`${column}_coverage`]
  }

  log('Calculated coverage for all columns')

  log(results_index)

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const data_path = path.join(__dirname, '../data')
  const json_file_path = `${data_path}/nfl/players-coverage-report.json`

  await fs.writeJson(json_file_path, results_index, { spaces: 2 })
  log(`wrote json to ${json_file_path}`)
}

const main = async () => {
  let error
  try {
    await player_coverage_report({ table_name: 'player' })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default player_coverage_report
