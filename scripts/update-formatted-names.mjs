import debug from 'debug'

import db from '#db'
import { format_player_name } from '#libs-shared'
import { is_main, updatePlayer, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('update-formatted-names')
debug.enable('update-formatted-names')

const updateFormattedNames = async () => {
  const player_rows = await db('player')

  let count = 0
  for (const player_row of player_rows) {
    try {
      const formatted = format_player_name(
        `${player_row.first_name} ${player_row.last_name}`
      )
      const changes = await updatePlayer({
        player_row,
        update: { formatted_name: formatted },
        source: 'name_normalization'
      })
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

  await report_job({
    job_type: job_types.UPDATE_FORMATTED_NAMES,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default updateFormattedNames
