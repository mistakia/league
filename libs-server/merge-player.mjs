import debug from 'debug'

import db from '#db'
import update_player_id from './update-player-id.mjs'
import updatePlayer from './update-player.mjs'

const log = debug('merge-player')
// Library module: a bare debug.enable REPLACES the namespace set for the whole
// process, so importing this would silently switch off namespaces the entry
// point enabled. Defer to an explicit DEBUG (see jobs/import-live-odds-worker.mjs).
if (!process.env.DEBUG) {
  debug.enable('merge-player,update-player-id')
}

// The caller names which row survives: `update_player_row` keeps its pid and
// `remove_player_row` is folded into it.
//
// This used to be decided here, by preferring whichever row carried a real
// `date_of_birth`. That rule predates the pid redesign and no longer means
// anything: a pid is now an opaque immutable serial off a sequence
// (`generate-player-id.mjs`), so it encodes no birth date and two pids are
// equally canonical. Holding a birth date said something about which pid was
// "more real" only while the pid string was built from one.
//
// Note the field merge below still keeps both rows' values, so the surviving
// row inherits a birth date from either side regardless of which pid wins.
export default async function ({ update_player_row, remove_player_row }) {
  log(
    `merging ${update_player_row.first_name} ${update_player_row.last_name} ${update_player_row.pid} and ${remove_player_row.first_name} ${remove_player_row.last_name} ${remove_player_row.pid}. Using pid ${update_player_row.pid}`
  )

  await update_player_id({
    current_pid: remove_player_row.pid,
    new_pid: update_player_row.pid
  })

  await db('player').where('pid', remove_player_row.pid).del()

  // merge update_player_row and remove_player_row, select truthy values or longest string or largest number
  const merged_player_row = Object.keys(update_player_row).reduce(
    (acc, key) => {
      if (key === 'pid') {
        return acc
      }

      if (update_player_row[key] && remove_player_row[key]) {
        if (typeof update_player_row[key] === 'string') {
          if (update_player_row[key].length > remove_player_row[key].length) {
            acc[key] = update_player_row[key]
          } else {
            acc[key] = remove_player_row[key]
          }
        } else if (typeof update_player_row[key] === 'number') {
          if (update_player_row[key] > remove_player_row[key]) {
            acc[key] = update_player_row[key]
          } else {
            acc[key] = remove_player_row[key]
          }
        } else {
          acc[key] = update_player_row[key]
        }
      } else if (update_player_row[key]) {
        acc[key] = update_player_row[key]
      } else if (remove_player_row[key]) {
        acc[key] = remove_player_row[key]
      }

      return acc
    },
    {}
  )

  await updatePlayer({
    pid: update_player_row.pid,
    update: merged_player_row,
    source: 'merge'
  })
}
