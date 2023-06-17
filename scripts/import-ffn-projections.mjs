import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, getPlayer } from '#libs-server'
import config from '#config'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:projections')
debug.enable('import:projections,get-player')
const week = Math.max(constants.season.week, 1)

const timestamp = new Date()
const getURL = (position) =>
  `https://www.fantasyfootballnerd.com/service/weekly-projections/json/${config.ffn}/${position}/${week}`
const getProjection = (stats) => ({
  py: stats.passYds,
  pa: stats.passAtt,
  pc: stats.passCmp,
  tdp: stats.passTD,
  ints: stats.passInt,

  ra: stats.rushAtt,
  ry: stats.rushYds,
  tdr: stats.rushTD,

  fuml: stats.fumblesLost,

  rec: stats.receptions,
  recy: stats.recYds,
  tdrec: stats.recTD,

  fg19: parseFloat(stats.fg) / 4,
  fg29: parseFloat(stats.fg) / 4,
  fg39: parseFloat(stats.fg) / 4,
  fg49: parseFloat(stats.fg) / 4,
  xpm: stats.xp,

  dint: stats.defInt,
  dff: stats.defFF,
  drf: stats.defFR,
  dsk: stats.defSack,
  dtd: stats.defTD,
  dsf: stats.defSafety,
  dpa: stats.defPA,
  dya: stats.defYdsAllowed
})

const run = async () => {
  // do not pull in any projections after the season has ended
  if (constants.season.week > constants.season.finalWeek) {
    return
  }

  const inserts = []
  const missing = []

  for (const position of ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']) {
    const url = getURL(position)
    log(url)
    const data = await fetch(url).then((res) => res.json())

    for (const item of data.Projections) {
      const params = {
        name: item.displayName,
        team: item.team,
        pos: item.position === 'DEF' ? 'DST' : item.position
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
        week,
        sourceid: 12,
        ...proj
      })
    }
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
    type: constants.jobs.PROJECTIONS_FFN,
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
