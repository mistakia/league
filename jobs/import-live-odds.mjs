import debug from 'debug'

import { wait } from '#utils'
import { job as import_draftkings_odds } from '#scripts/import-draftkings-odds.mjs'
import { job as import_caesars_odds } from '#scripts/import-caesars-odds.mjs'
import { job as import_fanduel_odds } from '#scripts/import-fanduel-odds.mjs'
import { job as import_betmgm_odds } from '#scripts/import-betmgm-odds.mjs'
import { job as import_prizepicks_odds } from '#scripts/import-prizepicks-odds.mjs'
// import import_betonline_odds from '#scripts/import-betonline-odds.mjs'

const log = debug('import-live-odds')

let live_odds_job_is_running = false

export default async function () {
  if (live_odds_job_is_running) {
    log('job already running')
    return
  }
  live_odds_job_is_running = true
  log('started new job')

  try {
    await import_draftkings_odds()
  } catch (err) {
    log(err)
  }

  try {
    await import_caesars_odds()
  } catch (err) {
    log(err)
  }

  try {
    await import_fanduel_odds()
  } catch (err) {
    log(err)
  }

  try {
    await import_betmgm_odds()
  } catch (err) {
    log(err)
  }

  try {
    await import_prizepicks_odds()
  } catch (err) {
    log(err)
  }

  const throttle_timer = wait(60000)

  // make sure its been 60 seconds
  await throttle_timer

  live_odds_job_is_running = false
  log('job exiting')
}
