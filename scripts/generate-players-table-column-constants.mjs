import debug from 'debug'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import { constants } from '#libs-shared'
import { isMain } from '#utils'
import config from '#config'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-players-table-column-constants')
debug.enable('generate-players-table-column-constants')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const players_table_columns_path = path.join(
  __dirname,
  '../libs-shared/players-table-columns.json'
)

const generate_players_table_column_constants = async () => {
  if (!fs.existsSync(players_table_columns_path)) {
    await fs.writeJson(players_table_columns_path, [])
  }

  const existing_items = await fs.readJson(players_table_columns_path)

  const existing_items_map = {}
  for (const item of existing_items) {
    const { table_name, column_name } = item
    const key = `/${table_name}/${column_name}`
    existing_items_map[key] = item
  }

  // get all tables with pid columns, except for player table
  const tables = await db('information_schema.columns')
    .select('table_name')
    .where({ column_name: 'pid' })
    .where('table_schema', config.mysql.connection.database)
    .groupBy('table_name')

  const table_names = tables.map((table) => table.TABLE_NAME)

  const columns = await db('information_schema.columns')
    .select('table_name as table_name', 'column_name as column_name')
    .whereIn('table_name', table_names)
    .where('table_schema', config.mysql.connection.database)

  const excluded_table_names = [
    'league_baselines',
    'player_changelog',
    'players_status',
    'poach_releases',
    'poaches',
    'projections',
    'projections_archive',
    'props',
    'rosters_players',
    'trade_releases',
    'transactions',
    'trades_players',
    'transactions',
    'transition_bids',
    'transition_releases',
    'waiver_releases',
    'waivers',
    'league_cutlist'
  ]
  const excluded_column_names = [
    'lid',
    'pid',
    'tid',
    'uid',
    'league_format_hash',
    'esbid'
  ]

  for (const column of columns) {
    const { table_name, column_name } = column

    if (excluded_column_names.includes(column_name)) {
      continue
    }

    if (excluded_table_names.includes(table_name)) {
      continue
    }

    const key = `/${table_name}/${column_name}`
    if (!existing_items_map[key]) {
      existing_items_map[key] = {
        table_name,
        column_name
      }
    }
  }

  const new_items = Object.values(existing_items_map)

  await fs.writeJson(players_table_columns_path, new_items, {
    spaces: 2
  })

  log(`generated ${new_items.length} items`)
}
const main = async () => {
  let error
  try {
    await generate_players_table_column_constants()
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: constants.jobs.EXAMPLE,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default generate_players_table_column_constants
