import debug from 'debug'

import db from '#db'
import update_player_id from './update-player-id.mjs'
import updatePlayer from './update-player.mjs'

const log = debug('merge-player')
debug.enable('merge-player,update-player-id')

export default async function ({ update_player_row, remove_player_row }) {
  log(
    `merging ${update_player_row.fname} ${update_player_row.lname} ${update_player_row.pid} and ${remove_player_row.fname} ${remove_player_row.lname} ${remove_player_row.pid}`
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
    update: merged_player_row
  })
}
