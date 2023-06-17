import debug from 'debug'

import db from '#db'
import { constants, formatPlayerName } from '#libs-shared'
import { isMain, updatePlayer } from '#libs-server'

const log = debug('update-formatted-names')
debug.enable('update-formatted-names')

const updateFormattedNames = async () => {
  const player_rows = await db('player')

  let count = 0
  for (const player_row of player_rows) {
    try {
      const formatted = formatPlayerName(
        `${player_row.fname} ${player_row.lname}`
      )
      const changes = await updatePlayer({ player_row, update: { formatted } })
      count += changes
    } catch (err) {
      log(err)
      log(player_row)
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
