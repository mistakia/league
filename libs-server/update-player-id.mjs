import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import config from '#config'
import isMain from './is-main.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('update-player-id')
debug.enable('update-player-id')

const update_player_id = async function ({ current_pid, new_pid }) {
  if (!current_pid) {
    throw new Error('current_pid is required')
  }

  if (!new_pid) {
    throw new Error('new_pid is required')
  }

  const player_rows = await db('player').where({ pid: new_pid })
  const player_row = player_rows[0]

  if (!player_row) {
    log(`pid ${current_pid} not found`)
    return
  }

  // get all tables with pid columns, except for player table
  const tables = await db('information_schema.columns')
    .select('table_name', 'column_name')
    .where(function () {
      this.whereILike('column_name', '%_pid')
      this.orWhere('column_name', 'pid')
    })
    .groupBy('table_name', 'column_name')
    .where('table_schema', config.mysql.connection.database)
    .whereNot('table_name', 'player')

  for (const table of tables) {
    const table_name = table.TABLE_NAME
    const column_name = table.COLUMN_NAME
    const [rows_updated] = await db.raw(
      `update ignore ${table_name} set ${column_name} = '${new_pid}' where ${column_name} = '${current_pid}'`
    )
    log(`${table_name} ${column_name} rows updated: ${rows_updated.info}`)
    await db(table_name).where(column_name, current_pid).del()
  }
}

export default update_player_id

if (isMain(import.meta.url)) {
  const main = async () => {
    await update_player_id({
      current_pid: argv.current_pid,
      new_pid: argv.new_pid
    })

    process.exit(0)
  }

  main()
}
