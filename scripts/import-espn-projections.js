// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const fetch = require('node-fetch')
const debug = require('debug')
const argv = require('yargs').argv

const log = debug('import:projections')
debug.enable('import:projections')

const { constants } = require('../common')
const { getPlayerId } = require('../utils')
const db = require('../db')

const week = argv.season ? 0 : constants.season.week
const year = new Date().getFullYear()
const URL = `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leaguedefaults/3?view=kona_player_info` + (argv.season ? '&seasonTotals=true' : '')
const timestamp = new Date()

const run = async () => {
  // do not pull in any projections after the season has ended
  if (constants.season.week > constants.season.finalWeek) {
    return
  }

  log(URL)
  const data = await fetch(URL, {
    headers: {
      'x-fantasy-filter': '{"players":{"filterStatsForSplitTypeIds":{"value":[0,1]},"filterSlotIds":{"value":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,23,24]},"filterStatsForSourceIds":{"value":[0,1]},"useFullProjectionTable":{"value":true},"sortAppliedStatTotal":{"sortAsc":false,"sortPriority":2,"value":"1120202"},"sortDraftRanks":{"sortPriority":3,"sortAsc":true,"value":"PPR"},"sortPercOwned":{"sortPriority":4,"sortAsc":false},"limit":600,"filterRanksForSlotIds":{"value":[0,2,4,6,17,16]},"filterStatsForTopScoringPeriodIds":{"value":2,"additionalValue":["002020","102020","002019","1120202","022020"]}}}'
    }
  }).then(res => res.json())

  const inserts = []
  const missing = []
  for (const player of data.players) {
    const name = player.player.fullName
    const team = constants.espn.teamId[player.player.proTeamId]
    const pos = constants.espn.positionId[player.player.defaultPositionId]
    const params = { name, team, pos }
    let playerId

    // TODO cleanup
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

    const projections = player.player.stats
      .find(s => s.scoringPeriodId === week && s.seasonId === year)
    const data = constants.espn.stats(projections.stats)

    inserts.push({
      player: playerId,
      year,
      week,
      sourceid: 3, // fantasy sharks sourceid
      timestamp,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach(m => log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`))

  if (argv.dry) {
    log(inserts[0])
    return
  }

  log(`Inserting ${inserts.length} projections into database`)
  await db('projections').insert(inserts)
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
    type: constants.jobs.PROJECTIONS_ESPN,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
