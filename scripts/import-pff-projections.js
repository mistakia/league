// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const fetch = require('node-fetch')

const debug = require('debug')
const argv = require('yargs').argv

const log = debug('import:projections')
debug.enable('import:projections')

const { getPlayerId } = require('../utils')
const db = require('../db')

const timestamp = new Date()
const config = require('../config')
const { constants } = require('../common')
const year = constants.season.year

const runOne = async (week) => {
  const missing = []

  const URL = `https://www.pff.com/api/fantasy/projections?scoring=preset_ppr&weeks=${week}`
  const result = await fetch(URL, {
    headers: {
      cookie: config.pff
    }
  }).then((res) => res.json())

  if (!result.player_projections || !result.player_projections.length) {
    throw new Error('missing projections')
  }

  const inserts = []
  for (const player of result.player_projections) {
    const name = player.player_name
    const team = player.team_name
    const pos = player.position.toUpperCase()
    const params = { name, team, pos }
    let playerId

    try {
      playerId = await getPlayerId(params)
      if (!playerId) {
        missing.push(params)
        continue
      }
    } catch (err) {
      console.log(err)
      missing.push(params)
      continue
    }

    const data = {
      fuml: player.fumbles_lost || 0,
      pa: player.pass_att || 0,
      pc: player.pass_comp || 0,
      ints: player.pass_int || 0,
      tdp: player.pass_td || 0,
      py: player.pass_yds || 0,
      ra: player.rush_att || 0,
      tdr: player.rush_td || 0,
      ry: player.rush_yds || 0,
      twoptc: player.two_pt || 0,
      rec: player.recv_receptions || 0,
      trg: player.recv_targets || 0,
      tdrec: player.recv_td || 0,
      recy: player.recv_yds || 0,

      fg29: player.fg_made_20_29 || 0,
      fg39: player.fg_made_30_39 || 0,
      fg49: player.fg_made_40_49 || 0,
      fg50: player.fg_made_50plus || 0,
      xpm: player.pat_made || 0,

      dff: player.dst_fumbles_forced || 0,
      drf: player.dst_fumbles_recovered || 0,
      dint: player.dst_int || 0,
      dsk: player.dst_sacks || 0,
      dsf: player.dst_safeties || 0,
      dtd: player.dst_td || 0
    }

    inserts.push({
      player: playerId,
      week,
      year,
      sourceid: 6, // pff sourceid,
      timestamp,
      ...data
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
  await db('projections').insert(inserts)
}

const run = async () => {
  // do not pull in any projections after the season has ended
  if (constants.season.week > constants.season.nflFinalWeek) {
    return
  }

  for (
    let week = constants.season.week;
    week <= constants.season.nflFinalWeek;
    week++
  ) {
    await runOne(week)
  }
}

module.exports = run

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.PROJECTIONS_PFF,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
