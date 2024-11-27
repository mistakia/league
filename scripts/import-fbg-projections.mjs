import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main, find_player_row, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:projections')
debug.enable('import:projections,get-player')
const week = Math.max(constants.season.week, 1)

const format_projection = (stats) => ({
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

const timestamp = Math.floor(Date.now() / 1000)

const run = async ({ dry_run = false } = {}) => {
  // do not pull in any projections after the season has ended
  if (constants.season.week > constants.season.nflFinalWeek) {
    return
  }

  if (!constants.season.week) {
    log('No projections available for current week')
    return
  }

  const config_row = await db('config').where({ key: 'fbg_config' }).first()
  const fbg_config = config_row.value

  if (!fbg_config) {
    throw new Error('fbg_config not found')
  }

  // fetch players
  const players_url = `${fbg_config.data_url}/NFLPlayers.json`
  log(`fetching players from ${players_url}`)
  const fbg_players = await fetch(players_url).then((res) => res.json())

  const projections_url = `${fbg_config.data_url}/WeeklyProjections-${constants.season.year}-${constants.season.week}.json`
  log(`fetching projections from ${projections_url}`)
  const data = await fetch(projections_url).then((res) => res.json())

  // if no projections or 404 exit
  const projectors = {
    2: constants.sources.FBG_DAVID_DODDS,
    41: constants.sources.FBG_BOB_HENRY,
    50: constants.sources.FBG_JASON_WOOD,
    53: constants.sources.FBG_MAURILE_TREMBLAY,
    107: constants.sources.FBG_SIGMUND_BLOOM,
    996: constants.sources.FBG_CONSENSUS
  }

  const missing = []
  const inserts = []
  for (const item of data) {
    if (item.type !== 'off') continue

    const projector = projectors[item.projector]
    if (!projector) continue

    const player_id_index = {}

    for (const fbgId in item.projections) {
      const fbg_player_projection = item.projections[fbgId]

      // ignore players with no projections, empty array
      if (
        Array.isArray(fbg_player_projection) &&
        !fbg_player_projection.length
      ) {
        continue
      }

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
        player_row = await find_player_row(params)
        if (!player_row) {
          missing.push(params)
          continue
        }
      } catch (err) {
        console.log(err)
        missing.push(params)
        continue
      }

      const proj = format_projection(fbg_player_projection)

      // ignore if all the values are undefined or null
      if (Object.values(proj).every((v) => v === undefined || v === null)) {
        continue
      }

      if (player_id_index[player_row.pid]) {
        log(`duplicate player: ${player_row.pid}`, {
          ...params,
          ...player_id_index[player_row.pid]
        })
        continue
      }

      player_id_index[player_row.pid] = params

      inserts.push({
        pid: player_row.pid,
        year: constants.season.year,
        week,
        sourceid: projector,
        ...proj
      })
    }
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (dry_run) {
    log(`${inserts.length} projections`)
    log(inserts[0])
    return
  }

  if (inserts.length) {
    log(`Inserting ${inserts.length} projections into database`)
    await db('projections_index')
      .insert(inserts)
      .onConflict(['sourceid', 'pid', 'userid', 'week', 'year'])
      .merge()
    await db('projections').insert(inserts.map((i) => ({ ...i, timestamp })))
  }
}

const main = async () => {
  let error
  try {
    await run({ dry_run: argv.dry })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROJECTIONS_FBG,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
