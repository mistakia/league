import db from '#db'
import updatePlayerId from './update-player-id.mjs'
import updatePlayer from './update-player.mjs'

export default async function ({ update_player_row, remove_player_row }) {
  await updatePlayerId({
    current_pid: remove_player_row.pid,
    new_pid: update_player_row.pid
  })
  await updatePlayer({
    pid: update_player_row.pid,
    update: remove_player_row
  })
  await db('player').where('pid', remove_player_row.pid).del()
}
