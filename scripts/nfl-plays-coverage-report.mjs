import debug from 'debug'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import { constants } from '#libs-shared'
import { isMain } from '#libs-server'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('nfl-plays-coverage-report')
debug.enable('nfl-plays-coverage-report')

const nfl_plays_coverage_report = async () => {
  // get a list of columns in the nfl_plays table
  const columns = await db('nfl_plays').columnInfo()
  const column_keys = Object.keys(columns)

  log(`Calculating coverage for ${column_keys.length} columns`)

  const results_index = {}
  const available_selects = []

  for (const column of column_keys) {
    results_index[column] = {
      column,
      available_since: null,
      coverage_since: null
    }
    available_selects.push(
      db.raw(
        `MIN(CASE WHEN "nfl_plays"."${column}" IS NOT NULL THEN "nfl_games"."date" END) AS "${column}_available_since"`
      )
    )
  }

  const available_since_query = await db.transaction(async (trx) => {
    await trx.raw('SET statement_timeout TO 0')
    const result = await trx('nfl_plays')
      .select(available_selects)
      .join('nfl_games', 'nfl_plays.esbid', 'nfl_games.esbid')
      .first()
    await trx.raw('SET statement_timeout TO DEFAULT')
    return result
  })

  for (const column of column_keys) {
    results_index[column].available_since =
      available_since_query[`${column}_available_since`]
  }

  log('Calculated available_since for all columns')

  const coverage_selects = []
  for (const column of column_keys) {
    const available_since = results_index[column].available_since
    coverage_selects.push(
      db.raw(
        `100.0 * COUNT(DISTINCT CASE WHEN "nfl_plays"."${column}" IS NOT NULL AND "nfl_games"."date" >= '${available_since}' THEN "nfl_plays"."esbid" END)::float / NULLIF(COUNT(DISTINCT CASE WHEN "nfl_games"."date" >= '${available_since}' THEN "nfl_plays"."esbid" END), 0)::float AS "${column}_coverage_since"`
      )
    )
  }

  const coverage_query = await db.transaction(async (trx) => {
    await trx.raw('SET statement_timeout TO 0')
    const result = await trx('nfl_plays')
      .select(coverage_selects)
      .join('nfl_games', 'nfl_plays.esbid', 'nfl_games.esbid')
      .first()
    await trx.raw('SET statement_timeout TO DEFAULT')
    return result
  })

  for (const column of column_keys) {
    results_index[column].coverage_since =
      coverage_query[`${column}_coverage_since`]
  }

  log('Calculated coverage_since for all columns')

  log(results_index)

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const data_path = path.join(__dirname, '../data')
  const json_file_path = `${data_path}/nfl/plays/coverage-report.json`

  await fs.writeJson(json_file_path, results_index, { spaces: 2 })
  log(`wrote json to ${json_file_path}`)
}

const main = async () => {
  let error
  try {
    await nfl_plays_coverage_report()
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default nfl_plays_coverage_report
