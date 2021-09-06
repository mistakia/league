// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')
// const argv = require('yargs').argv

const db = require('../db')
const {
  constants,
  Roster,
  calculatePlayerLineupContribution
} = require('../common')
const {
  getRoster,
  getRosters,
  getLeague,
  getBaselines,
  getPlayers
} = require('../utils')

const log = debug('project-player-contributions')
debug.enable('project-player-contributions')

const run = async () => {
  const lid = 1
  const league = await getLeague(lid)
  const teams = await db('teams').where({ lid })
  const players = await getPlayers({ leagueId: lid })
  const baselines = await getBaselines(lid)
  const rosters = await getRosters({ lid })

  const results = []

  for (const team of teams) {
    const rosterRow = await getRoster({ tid: team.uid })
    const roster = new Roster({ roster: rosterRow, league })

    for (const player of roster.players) {
      const activeRosterPlayerIds = roster.active.map((p) => p.player)
      const result = calculatePlayerLineupContribution({
        activeRosterPlayers: players.filter((p) =>
          activeRosterPlayerIds.includes(p.player)
        ),
        player: players.find((p) => p.player === player.player),
        players,
        baselines,
        roster: rosters.find((r) => r.tid === team.uid),
        league
      })
      results.push({
        player: player.player,
        tid: team.uid,
        ...result
      })
    }
  }

  console.log(results)
  console.log(results[0].weeks['1'])
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

  /* await db('jobs').insert({
   *   type: constants.jobs.PROJECT_PLAYER_CONTRIBUTIONS,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (!module.parent) {
  main()
}
