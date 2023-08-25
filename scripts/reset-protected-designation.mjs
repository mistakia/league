import debug from 'debug'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain } from '#libs-server'

const log = debug('reset-protected-designation')
debug.enable('reset-protected-designation')

const run = async () => {
  if (constants.season.week !== 0) {
    log('abort, during regular season')
    return
  }

  // reset protection for signed PS players
  const signed_row_count = await db('rosters_players')
    .update({ slot: constants.slots.PS })
    .where({
      week: 0,
      slot: constants.slots.PSP,
      year: constants.season.year
    })
  log(`updated ${signed_row_count} signed practice squad players`)

  // reset protection for drafted PS players
  const drafted_row_count = await db('rosters_players')
    .update({ slot: constants.slots.PSD })
    .where({
      week: 0,
      slot: constants.slots.PSDP,
      year: constants.season.year
    })
  log(`updated ${drafted_row_count} drafted practice squad players`)
}

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.RESET_PROTECTED_DESIGNATION,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
