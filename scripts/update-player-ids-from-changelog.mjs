import debug from 'debug'
import db from '#db'
// import { constants } from '#libs-shared'
import { isMain, update_player_id } from '#libs-server'

const log = debug('update-player-ids-from-changelog')
debug.enable('update-player-ids-from-changelog,update-player-id')

const update_player_ids_from_changelog = async () => {
  const changelog_rows = await db('player_changelog')
    .where({ prop: 'pid' })
    .select('prev', 'new')

  for (const row of changelog_rows) {
    await update_player_id({
      current_pid: row.prev,
      new_pid: row.new
    })
    log(`Updated player ID from ${row.prev} to ${row.new}`)
  }
}

const main = async () => {
  let error
  try {
    await update_player_ids_from_changelog()
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: constants.jobs.update_player_ids_from_changelog,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}
