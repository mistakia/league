import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, getPlayer } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:projections')
debug.enable('import:projections,get-player')
const week = Math.max(constants.season.week, 1)

const getProjection = (stats) => ({
  py: stats.pyd,
  pa: stats.att,
  pc: stats.cmp,
  tdp: stats.ptd,
  ints: stats.icp,

  ra: stats.rsh,
  ry: stats.rshyd,
  tdr: stats.rshtd,

  fuml: stats.fum,

  rec: stats.rec,
  recy: stats.recyd,
  tdrec: stats.rectd
})

const PLAYERS_URL =
  'https://appdata.footballguys.com/2021-6265cea3e6ba4/NFLPlayers.json'
const PROJECTIONS_URL = `https://appdata.footballguys.com/2021-6265cea3e6ba4/WeeklyProjections-${constants.season.year}-${constants.season.week}.json`
const timestamp = new Date()

const run = async () => {
  // do not pull in any projections after the season has ended
  if (constants.season.week > constants.season.nflFinalWeek) {
    return
  }

  // fetch players
  const fbg_players = await fetch(PLAYERS_URL).then((res) => res.json())

  const data = await fetch(PROJECTIONS_URL).then((res) => res.json())

  // if no projections or 404 exit
  const projectors = {
    2: 7, // david dodds
    41: 8, // bob henry
    50: 9, // jason wood
    53: 10, // maurile tremblay
    107: 11, // sigmund bloom
    996: 19 // fbg consensus
  }

  const missing = []
  const inserts = []
  for (const id in projectors) {
    const projector = parseInt(id, 10)
    const projections = data.find(
      (p) => p.projector === projector && p.type === 'off'
    )

    if (!projections) continue

    for (const fbgId in projections.projections) {
      const fbg_player = fbg_players.find((p) => p.id === fbgId)
      if (!fbg_player) {
        log(`could not find ${fbgId} in players set`)
        continue
      }

      let player_row

      const params = {
        name: `${fbg_player.first} ${fbg_player.last}`,
        team: fbg_player.team_id,
        pos: fbg_player.pos
      }

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

      const proj = getProjection(projections.projections[fbgId])
      inserts.push({
        pid: player_row.pid,
        year: constants.season.year,
        week,
        sourceid: projectors[id],
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
    type: constants.jobs.PROJECTIONS_FBG,
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
