import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { isMain } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('migrate-data')
debug.enable('migrate-data')

const migrateData = async () => {
  // get duplicates for player_changelog
  const query = db('player_changelog')
    .select('*')
    .count('* as count')
    .groupBy('id', 'prop', 'prev')
    .having('count', '>', 1)

  log(query.toString())

  const rows = await query

  for (const row of rows) {
    const { id, prop, prev } = row
    const duplicate_rows = await db('player_changelog').where({
      id,
      prop,
      prev
    })

    const sorted_rows = duplicate_rows.sort((a, b) => a.uid - b.uid)
    const delete_rows = sorted_rows.slice(1)
    const delete_uids = delete_rows.map((d) => d.uid)
    log(`deleted ${delete_uids.length} duplicate rows`)
    await db('player_changelog').whereIn('uid', delete_uids).del()
  }

  log('completed')
}

const main = async () => {
  let error
  try {
    await migrateData()
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

export default migrateData
