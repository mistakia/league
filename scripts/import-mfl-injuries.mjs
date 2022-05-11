import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain } from '#utils'
import config from '#config'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:players:mfl')
debug.enable('league:player:get,import:players:mfl')
const timestamp = Math.round(Date.now() / 1000)

const run = async () => {
  const missing = []

  const URL = `https://api.myfantasyleague.com/${constants.season.year}/export?TYPE=injuries&JSON=1`
  const result = await fetch(URL, {
    headers: {
      'User-Agent': config.mflUserAgent
    }
  }).then((res) => res.json())

  const fields = {}
  const inserts = []
  for (const item of result.injuries.injury) {
    const mfl_id = item.id
    const { exp_return, status, details } = item

    for (const field in item) {
      fields[field] = true
    }

    let playerId
    try {
      const rows = await db('players').where('mfl_id', mfl_id)
      if (!rows.length) {
        missing.push(mfl_id)
        continue
      }
      const row = rows[0]
      playerId = row.player
    } catch (err) {
      console.log(err)
      missing.push(mfl_id)
      continue
    }

    inserts.push({
      exp_return,
      status,
      details,
      mfl_id,
      player: playerId,
      timestamp
    })
  }

  log(`Complete field list: ${Object.keys(fields)}`)
  log(`Retrieved ${inserts.length} status updates`)

  if (argv.dry) {
    return
  }

  if (inserts.length) {
    log(`Inserting ${inserts.length} status updates into database`)
    await db('players_status').insert(inserts)
  }
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
    type: constants.jobs.PLAYERS_MFL_INJURIES,
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
