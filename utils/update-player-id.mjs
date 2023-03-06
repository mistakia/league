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
    .select('table_name')
    .where({ column_name: 'pid' })
    .groupBy('table_name')
    .where('table_schema', config.mysql.connection.database)
    .whereNot('table_name', 'player')

  const table_names = tables.map((table) => table.TABLE_NAME)
  for (const table_name of table_names) {
    const [rows_updated] = await db.raw(
      `update ignore ${table_name} set pid = '${new_pid}' where pid = '${current_pid}'`
    )
    log(`${table_name} rows updated: ${rows_updated.info}`)
    await db(table_name).where('pid', current_pid).del()
  }
}
