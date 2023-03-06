import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import { constants } from '#common'
import { isMain, generate_player_id, update_player_id } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('format-player-ids')
debug.enable('format-player-ids,update-player-id')

const format_player_ids = async () => {
  let collision_count = 0
  let update_count = 0
  let error_count = 0
  let unchanged_count = 0

  const players = await db('player')

  for (const player of players) {
    let pid
    try {
      pid = generate_player_id(player)
    } catch (err) {
      log(err)
      log(
        `failed to generate pid for ${player.fname} ${player.lname} ${player.start} ${player.dob}`
      )
      error_count += 1
      continue
    }

    if (pid && pid !== player.pid) {
      // check if pid exists
      const player_rows = await db('player').where({ pid })
      if (player_rows.length) {
        log(
          `generated pid ${pid} for ${player.pid} ${player.fname} ${player.lname} ${player.start} ${player.dob} already exists`
        )
        collision_count += 1
        continue
      }

      try {
        // update player
        await db('player').where({ pid: player.pid }).update({ pid })
        await update_player_id({ current_pid: player.pid, new_pid: pid })

        await db('player_changelog')
          .insert({
            pid,
            prop: 'pid',
            prev: player.pid,
            new: pid,
            timestamp: Math.round(Date.now() / 1000)
          })
          .onConflict()
          .ignore()

        log(
          `updated pid for ${player.fname} ${player.lname} from ${player.pid} to ${pid}`
        )
        update_count += 1
      } catch (err) {
        log(err)
        log(
          `failed to update pid for ${player.fname} ${player.lname} from ${player.pid} to ${pid}`
        )
        error_count += 1
      }
    } else {
      unchanged_count += 1
    }
  }

  log(`collision count: ${collision_count}`)
  log(`update count: ${update_count}`)
  log(`error count: ${error_count}`)
  log(`unchanged count: ${unchanged_count}`)
}

const main = async () => {
  let error
  try {
    await format_player_ids()
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: constants.jobs.EXAMPLE,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default format_player_ids
