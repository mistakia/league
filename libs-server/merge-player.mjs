import debug from 'debug'

import db from '#db'
import update_player_id from './update-player-id.mjs'
import updatePlayer from './update-player.mjs'

const log = debug('merge-player')
debug.enable('merge-player,update-player-id')

export default async function ({ update_player_row, remove_player_row }) {
  // Determine which PID to use based on birthdate
  const update_pid = determine_pid_to_use({
    update_player: update_player_row,
    remove_player: remove_player_row
  })

  const keep_player_row =
    update_pid === update_player_row.pid ? update_player_row : remove_player_row
  const discard_player_row =
    update_pid === update_player_row.pid ? remove_player_row : update_player_row

  log(
    `merging ${keep_player_row.fname} ${keep_player_row.lname} ${keep_player_row.pid} and ${discard_player_row.fname} ${discard_player_row.lname} ${discard_player_row.pid}. Using pid ${update_pid}`
  )

  await update_player_id({
    current_pid: discard_player_row.pid,
    new_pid: keep_player_row.pid
  })

  await db('player').where('pid', discard_player_row.pid).del()

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

function determine_pid_to_use({ update_player, remove_player }) {
  const update_has_birthdate =
    update_player.dob && update_player.dob !== '0000-00-00'
  const remove_has_birthdate =
    remove_player.dob && remove_player.dob !== '0000-00-00'

  if (update_has_birthdate && !remove_has_birthdate) {
    // update_player has birthdate and remove_player does not
    return update_player.pid
  } else if (!update_has_birthdate && remove_has_birthdate) {
    // update_player does not have birthdate and remove_player does
    return remove_player.pid
  } else {
    // If both have birthdate or both don't have birthdate, use update_player's PID
    return update_player.pid
  }
}
