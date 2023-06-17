import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import { constants } from '#libs-shared'
import { isMain, espn, getPlayer, updatePlayer } from '#libs-server'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-players-espn')
debug.enable('import-players-espn,espn,get-player,update-player')

const importPlayersESPN = async () => {
  let changeCount = 0
  let page = 1
  let res
  do {
    res = await espn.getPlayers({ page })
    if (res && res.items && res.items.length) {
      for (const item of res.items) {
        const re = /athletes\/(?<espn_id>[0-9]+)?/gi
        const re_result = re.exec(item.$ref)
        const {
          groups: { espn_id }
        } = re_result
        const query_result = await db('player').where({ espn_id })

        if (query_result.length) {
          log(`espn_id already exists: ${espn_id}`)
          continue
        }

        const espn_player = await espn.getPlayer({ espn_id })
        if (!espn_player.athlete) {
          log(`skipping ${espn_id}, espn api response missing athlete`)
          continue
        }

        const name = `${espn_player.athlete.firstName} ${espn_player.athlete.lastName}`
        const pos = espn_player.athlete.position.abbreviation
        const team = espn_player.athlete.team
          ? espn_player.athlete.team.abbreviation
          : null

        let player_row
        try {
          player_row = await getPlayer({ name, pos, team })
        } catch (err) {
          log(err)
          log({ name, pos, team, espn_id })
          continue
        }

        if (!player_row) {
          log(`espn_id ${espn_id} matched no player rows`)
          continue
        }

        const changes = await updatePlayer({
          player_row,
          update: {
            espn_id
          }
        })

        changeCount += changes
      }
    }

    page += 1
  } while (res && res.pageIndex < res.pageCount)

  log(`updated ${changeCount} player fields`)
}

const main = async () => {
  let error
  try {
    await importPlayersESPN()
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

export default importPlayersESPN
