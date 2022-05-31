import diff from 'deep-diff'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { constants } from '#common'
import isMain from './is-main.mjs'
import db from '#db'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('update-player')
debug.enable('update-player')

const uniques = [
  'player',
  'esbid',
  'gsisid',
  'gsispid',
  'sleeper_id',
  'rotoworld_id',
  'rotowire_id',
  'sportradar_id',
  'espn_id',
  'fantasy_data_id',
  'yahoo_id',
  'keeptradecut_id'
]

/*
   player can be a string identifier or player db entry
*/

const updatePlayer = async ({ player, update }) => {
  if (typeof player === 'string' || player instanceof String) {
    const rows = await db('player').where({ player })
    player = rows[0]
  }

  const differences = diff(player, update)

  const edits = differences.filter((d) => d.kind === 'E')
  if (!edits.length) {
    return 0
  }

  let changes = 0
  for (const edit of edits) {
    if (!edit.rhs) {
      continue
    }

    const prop = edit.path[0]

    if (uniques.includes(prop)) {
      const exists = await db('player').where(prop, edit.rhs).limit(1)
      if (exists.length) {
        log(
          `Player (${exists[0].player}) has existing value (${edit.rhs}) for field (${prop})`
        )
        continue
      }
    }

    changes += 1
    // log(`Player: ${player.player}, Field: ${prop}, Value: ${edit.rhs}`)
    await db('player_changelog').insert({
      type: constants.changes.PLAYER_EDIT,
      id: player.player,
      prop,
      prev: edit.lhs,
      new: edit.rhs,
      timestamp: Math.round(Date.now() / 1000)
    })

    await db('player')
      .update({
        [prop]: edit.rhs
      })
      .where({
        player: player.player
      })
  }

  return changes
}

export default updatePlayer

const main = async () => {
  let error
  try {
    if (!argv.player) {
      log('missing --player')
      process.exit()
    }

    const ignore = ['_', '$0', 'player']
    const keys = Object.keys(argv).filter((key) => !ignore.includes(key))
    const update = {}
    keys.forEach((key) => {
      update[key] = argv[key]
    })

    const changes = await updatePlayer({ player: argv.player, update })
    log(`player ${argv.player} updated, changes: ${changes}`)
    process.exit()
  } catch (err) {
    error = err
    log(error)
  }
}

if (isMain(import.meta.url)) {
  main()
}
