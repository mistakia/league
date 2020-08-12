// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const fetch = require('node-fetch')

const debug = require('debug')
const argv = require('yargs').argv

const log = debug('import:projections')
debug.enable('league:player:get,import:projections')

const { getPlayerId } = require('../utils')
const db = require('../db')

const timestamp = new Date()
const config = require('../config')
const { constants } = require('../common')
const year = constants.season.year

const runOne = async (week) => {
  const missing = []

  const URL = `https://www.pff.com/api/prankster/projections?scoring=preset_std&weeks=${week}`
  const result = await fetch(URL, {
    headers: {
      cookie: config.pff
    }
  }).then(res => res.json())

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
      fuml: Math.round(player.fumbles_lost) || 0,
      pa: Math.round(player.pass_att) || 0,
      pc: Math.round(player.pass_comp) || 0,
      ints: Math.round(player.pass_int) || 0,
      tdp: Math.round(player.pass_td) || 0,
      py: Math.round(player.pass_yds) || 0,
      ra: Math.round(player.rush_att) || 0,
      tdr: Math.round(player.rush_td) || 0,
      ry: Math.round(player.rush_yds) || 0,
      twoptc: Math.round(player.two_pt) || 0,
      rec: Math.round(player.recv_receptions) || 0,
      trg: Math.round(player.recv_targets) || 0,
      tdrec: Math.round(player.recv_td) || 0,
      recy: Math.round(player.recv_yds) || 0
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
  missing.forEach(m => log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`))

  if (argv.dry) {
    return process.exit()
  }

  log(`Inserting ${inserts.length} projections into database`)
  await db('projections').insert(inserts)
}

const run = async () => {
  for (let week = constants.season.week; week < 17; week++) {
    await runOne(week)
  }
  process.exit()
}

try {
  run()
} catch (error) {
  console.log(error)
}
