import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { formatPlayerName } from '#common'
import { isMain, pfr } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-pfr-player-ids')
debug.enable('import-pfr-player-ids,pro-football-reference')

const import_pro_football_reference_player_ids = async ({
  ignore_cache = false
} = {}) => {
  const all_players = await db('player')
  const pfr_players = await pfr.get_players({ ignore_cache })

  log(`got ${pfr_players.length} players from pro-football-reference`)

  let update_count = 0

  for (const pfr_player of pfr_players) {
    let player
    try {
      player = all_players.find((p) => p.pfr_id === pfr_player.pfr_id)

      if (player) {
        continue
      }

      const formatted = formatPlayerName(pfr_player.name)
      const matched_players = all_players.filter(
        (p) =>
          p.formatted === formatted &&
          pfr_player.positions.includes(p.pos) &&
          pfr_player.start === p.start
      )

      if (matched_players.length === 1) {
        player = matched_players[0]
      }
    } catch (err) {
      log(err)
    }

    if (!player) {
      log(
        `no player found for ${pfr_player.name} (https://www.pro-football-reference.com${pfr_player.url})`
      )
      continue
    }

    // update all_players array to reflect the new pfr_id
    player.pfr_id = pfr_player.pfr_id

    await db('player')
      .where({ pid: player.pid })
      .update({ pfr_id: pfr_player.pfr_id })
    update_count += 1
  }

  log(`Updated ${update_count} player pfr ids`)
}

const main = async () => {
  let error
  try {
    await import_pro_football_reference_player_ids({
      ignore_cache: argv.ignore_cache
    })
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

export default import_pro_football_reference_player_ids
