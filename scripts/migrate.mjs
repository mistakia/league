import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import config from '#config'
// import { constants } from '#common'
import { isMain } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('migrate')
debug.enable('migrate')

const migrate = async () => {
  // get all tables with pid columns
  const tables = await db('information_schema.columns')
    .select('table_name')
    .where({ column_name: 'pid' })
    .groupBy('table_name')
    .where('table_schema', config.mysql.connection.database)

  const table_names = tables.map((table) => table.TABLE_NAME)

  // update all pid columns to be varchar(20)
  for (const table_name of table_names) {
    await db.schema.alterTable(table_name, (table) => {
      table.string('pid', 25).alter()
    })
  }
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
   *   type: constants.jobs.EXAMPLE,
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
