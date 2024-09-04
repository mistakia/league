import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { constants, fixTeam } from '#libs-shared'
import { is_main, getPlayer, report_job } from '#libs-server'
import config from '#config'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:players:mfl')
debug.enable('league:player:get,import:players:mfl,get-player')

const run = async () => {
  const missing = []

  const URL = `https://api.myfantasyleague.com/${constants.season.year}/export?TYPE=players&DETAILS=1&JSON=1`
  const result = await fetch(URL, {
    headers: {
      'User-Agent': config.mflUserAgent
    }
  }).then((res) => res.json())

  const fields = {}
  const inserts = []
  const ignorePositions = [
    'TMQB',
    'TMPK',
    'TMPN',
    'TMWR',
    'TMRB',
    'TMDL',
    'TMLB',
    'TMDB',
    'TMTE',
    'ST',
    'Off'
  ]
  for (const item of result.players.player) {
    const name = item.name.split(', ').reverse().join(' ')
    const team = fixTeam(item.team)
    const pos = item.position

    if (ignorePositions.includes(pos)) {
      continue
    }

    const params = { name, team, pos }
    let player_row
    try {
      player_row = await getPlayer(params)
      if (!player_row) {
        missing.push(params)
      }
    } catch (err) {
      console.log(err)
      missing.push(params)
      continue
    }

    for (const field in item) {
      fields[field] = true
    }

    const {
      cbs_id,
      espn_id,
      fleaflicker_id,
      nfl_id,
      id, // mfl_id
      rotoworld_id,
      rotowire_id,
      stats_id,
      stats_global_id,
      sportsdata_id,
      twitter_username
    } = item

    const data = {
      cbs_id,
      espn_id,
      fleaflicker_id,
      nfl_id,
      mfl_id: id, // mfl_id
      rotoworld_id,
      rotowire_id,
      stats_id,
      stats_global_id,
      sportradar_id: sportsdata_id,
      twitter_username
    }

    inserts.push({
      pid: player_row.pid,
      name,
      team,
      pos,
      ...data
    })
  }

  log(`Complete field list: ${Object.keys(fields)}`)
  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (argv.dry) {
    return
  }

  if (inserts.length) {
    log(`Inserting ${inserts.length} players into database`)
    log(inserts[0])
    /* for (const insert of inserts) {
     *   const rows = await db('players').where('mfl_id', insert.mfl_id)
     *   if (rows.length) {
     *     const { twitter_username } = insert
     *     if (!twitter_username) continue
     *     await db('players')
     *       .update({ twitter_username })
     *       .where('mfl_id', insert.mfl_id)
     *   } else {
     *     await db('players').insert(insert)
     *   }
     * } */
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

  await report_job({
    job_type: job_types.PLAYERS_MFL,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
