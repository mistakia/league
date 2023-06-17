import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import csv from 'csv-parser'

import config from '#config'
import { getPlayer, isMain } from '#libs-server'
import { constants } from '#libs-shared'
import db from '#db'

const log = debug('import:projections')
debug.enable('import:projections,get-player')

const timestamp = new Date()
const argv = yargs(hideBin(process.argv)).argv
const URL = 'https://www.4for4.com/projections_weekly_csv/60444'

const getProjection = (stats) => ({
  py: parseFloat(stats['Pass Yds']),
  pa: parseFloat(stats['Pass Att']),
  pc: parseFloat(stats.Comp),
  tdp: parseFloat(stats['Pass TD']),
  ints: parseFloat(stats.INT),

  ra: parseFloat(stats['Rush Att']),
  ry: parseFloat(stats['Rush Yds']),
  tdr: parseFloat(stats['Rush TD']),

  fuml: parseFloat(stats.Fum),

  rec: parseFloat(stats.Rec),
  recy: parseFloat(stats['Rec Yds']),
  tdrec: parseFloat(stats['Rec TD']),

  fgm: parseFloat(stats.FG),
  xpm: parseFloat(stats.XP)
})

const run = async () => {
  // do not pull in any projections after the season has ended
  if (constants.season.week > constants.season.finalWeek) {
    return
  }

  const data = await fetch(URL, {
    headers: {
      cookie: config['4for4']
    }
  }).then(
    (res) =>
      new Promise((resolve, reject) => {
        const results = []
        res.body
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('error', (error) => resolve(error))
          .on('end', () => resolve(results))
      })
  )

  const inserts = []
  const missing = []

  for (const item of data) {
    const params = {
      name: item.Player,
      team: item.Team,
      pos: item.Pos
    }

    let player_row
    try {
      player_row = await getPlayer(params)
      if (!player_row) {
        missing.push(params)
        continue
      }
    } catch (err) {
      console.log(err)
      missing.push(params)
      continue
    }

    const proj = getProjection(item)
    inserts.push({
      pid: player_row.pid,
      year: constants.season.year,
      week: parseInt(item.Week, 10),
      sourceid: constants.sources['4FOR4'],
      ...proj
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (argv.dry) {
    log(`${inserts.length} projections`)
    log(inserts[0])
    return
  }

  log(`Inserting ${inserts.length} projections into database`)
  await db('projections_index').insert(inserts).onConflict().merge()
  await db('projections').insert(inserts.map((i) => ({ ...i, timestamp })))
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
    type: constants.jobs.PROJECTIONS_4FOR4,
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
