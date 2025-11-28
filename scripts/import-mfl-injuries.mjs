import fetch from 'node-fetch'
import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import { current_season } from '#constants'
import { is_main, report_job } from '#libs-server'
import config from '#config'
import { job_types } from '#libs-shared/job-constants.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:players:mfl')
debug.enable('league:player:get,import:players:mfl')
// const timestamp = Math.round(Date.now() / 1000)

const run = async () => {
  // const missing = []

  const URL = `https://api.myfantasyleague.com/${current_season.year}/export?TYPE=injuries&JSON=1`
  const result = await fetch(URL, {
    headers: {
      'User-Agent': config.mflUserAgent
    }
  }).then((res) => res.json())

  log(result)

  // TODO

  /* const fields = {}
   * const inserts = []
   * for (const item of result.injuries.injury) {
   *   const mfl_id = item.id
   *   const { exp_return, status, details } = item

   *   for (const field in item) {
   *     fields[field] = true
   *   }

   *   let pid
   *   try {
   *     const player_rows = await db('players').where('mfl_id', mfl_id)
   *     if (!player_rows.length) {
   *       missing.push(mfl_id)
   *       continue
   *     }
   *     const player_row = player_rows[0]
   *     pid = player_row.pid
   *   } catch (err) {
   *     console.log(err)
   *     missing.push(mfl_id)
   *     continue
   *   }

   *   inserts.push({
   *     exp_return,
   *     status, // TODO needs to adhere to status formatting
   *     details,
   *     mfl_id,
   *     pid,
   *     timestamp
   *   })
   * }

   * log(`Complete field list: ${Object.keys(fields)}`)
   * log(`Retrieved ${inserts.length} status updates`)

   * if (argv.dry) {
   *   return
   * }

   * if (inserts.length) {
   *   log(`Inserting ${inserts.length} status updates into database`)
   *   log(inserts[0])

   *   await db('players_status').insert(inserts)
   * } */
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
    job_type: job_types.PLAYERS_MFL_INJURIES,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
