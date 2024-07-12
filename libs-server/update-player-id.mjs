import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
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
    log(`pid ${new_pid} not found`)
    return
  }

  // get all tables with pid columns, except for player table
  const tables = await db.raw(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE (column_name LIKE '%_pid' OR column_name = 'pid')
      AND table_schema = current_schema()
      AND table_name != 'player'
    GROUP BY table_name, column_name
  `)

  for (const table of tables.rows) {
    const table_name = table.table_name
    const column_name = table.column_name
    const result = await db.raw(
      `
      WITH updated AS (
        UPDATE ${table_name}
        SET ${column_name} = ?
        WHERE ${column_name} = ?
        RETURNING 1
      )
      SELECT count(*) AS count FROM updated
    `,
      [new_pid, current_pid]
    )
    const rows_updated = result.rows[0].count
    log(`${table_name} ${column_name} rows updated: ${rows_updated}`)
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
