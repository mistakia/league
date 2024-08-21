import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, pfr, updatePlayer, getPlayer } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-player-draft-position-pfr')
debug.enable('import-player-draft-position-pfr,update-player,get-player')

const import_player_draft_position_pfr = async ({
  year = constants.season.year,
  ignore_cache = false
} = {}) => {
  const draft_players = await pfr.get_draft({ year, ignore_cache })

  log(`Importing ${draft_players.length} draft players for ${year}`)

  const pfr_ids = draft_players.map((player) => player.pfr_id)
  const players = await db('player').whereIn('pfr_id', pfr_ids)

  const players_map = {}
  for (const player_row of players) {
    players_map[player_row.pfr_id] = player_row
  }
  const missing_players = []

  for (const draft_player of draft_players) {
    let player_row = players_map[draft_player.pfr_id]

    if (!player_row) {
      try {
        const params = {
          name: draft_player.player_name,
          team: draft_player.team,
          start: year
        }
        player_row = await getPlayer(params)
      } catch (err) {
        log(err)
      }
    }

    if (!player_row) {
      missing_players.push(draft_player)
      continue
    }

    if (
      player_row.round !== draft_player.round ||
      player_row.dpos !== draft_player.overall ||
      player_row.pfr_id !== draft_player.pfr_id
    ) {
      await updatePlayer({
        player_row,
        update: {
          round: draft_player.round,
          dpos: draft_player.overall_pick,
          pfr_id: draft_player.pfr_id
        }
      })
    }
  }

  log(`missing players: ${missing_players.length}`)
}
const main = async () => {
  let error
  try {
    await import_player_draft_position_pfr({
      year: argv.year,
      ignore_cache: argv.ignore_cache
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default import_player_draft_position_pfr
