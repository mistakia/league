import debug from 'debug'

import db from '#db'
import { current_season, roster_slot_types } from '#constants'
import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('reset-protected-designation')
debug.enable('reset-protected-designation')

const run = async () => {
  if (current_season.week !== 0) {
    log('abort, during regular season')
    return
  }

  // reset protection for signed PS players
  const signed_row_count = await db('rosters_players')
    .update({ slot: roster_slot_types.PS })
    .where({
      week: 0,
      slot: roster_slot_types.PSP,
      year: current_season.year
    })
  log(`updated ${signed_row_count} signed practice squad players`)

  // reset protection for drafted PS players
  const drafted_row_count = await db('rosters_players')
    .update({ slot: roster_slot_types.PSD })
    .where({
      week: 0,
      slot: roster_slot_types.PSDP,
      year: current_season.year
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

  await report_job({
    job_type: job_types.RESET_PROTECTED_DESIGNATION,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
