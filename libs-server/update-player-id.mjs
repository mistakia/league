import debug from 'debug'

import db from '#db'
import config from '#config'

const log = debug('update-player-id')

export default async function ({ current_pid, new_pid }) {
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
      this.where('column_name', 'like', '%_pid')
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
