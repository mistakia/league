import debug from 'debug'

import db from '#db'
import { constants, formatPlayerName } from '#common'
import { isMain, updatePlayer } from '#utils'

const log = debug('update-formatted-names')
debug.enable('update-formatted-names')

const updateFormattedNames = async () => {
  const players = await db('player')

  let count = 0
  for (const player of players) {
    try {
      const formatted = formatPlayerName(`${player.fname} ${player.lname}`)
      const changes = await updatePlayer({ player, update: { formatted } })
      count += changes
    } catch (err) {
      log(err)
      log(player)
    }
  }

  log(`Updated formatted names, count: ${count}`)
}

const main = async () => {
  let error
  try {
    await updateFormattedNames()
  } catch (err) {
    error = err
    log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.UPDATE_FORMATTED_NAMES,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default updateFormattedNames
