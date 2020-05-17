const fetch = require('node-fetch')
const debug = require('debug')

log = debug('import:projections')
debug.enable('league:player:get,import:projections')

const { constants } = require('../common')
const { getPlayerId } = require('../utils')
const db = require('../db')

const year = new Date().getFullYear()
const URL = `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leaguedefaults/3?seasonTotals=true&seasonId=${year}&view=kona_player_info`
const timestamp = new Date()

const run = async () => {
  const data = await fetch(URL).then(res => res.json())

  const inserts = []
  const missing = []
  for (const player of data.players) {
    const name = player.player.fullName
    const team = constants.espn.teamId[player.player.proTeamId]
    const pos = constants.espn.positionId[player.player.defaultPositionId]
    const params = { name, team, pos }
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

    const seasonProjection = player.player.stats.find(s => s.scoringPeriodId === 0 && s.seasonId === year)

    const data = constants.espn.stats(seasonProjection.stats)

    inserts.push({
      player: playerId,
      year,
      sourceid: 3, // fantasy sharks sourceid
      timestamp,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach(m => log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`))

  log(`Inserting ${inserts.length} projections into database`)
  const res = await db('projections').insert(inserts)

  process.exit()
}

try {
  run()
} catch (error) {
  console.log(error)
}
