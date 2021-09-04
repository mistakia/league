// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')
// const argv = require('yargs').argv

const db = require('../db')
const { constants, Roster, optimizeLineup } = require('../common')
const { getLeague, getRoster, getPlayers } = require('../utils')

const log = debug('project-lineups')

const run = async () => {
  const { year } = constants.season
  const leagueId = 1
  const league = await getLeague(leagueId)
  const teams = await db('teams').where({ lid: leagueId })
  const teamLineupsInserts = []
  const teamLineupStartersInserts = []
  for (const team of teams) {
    const tid = team.uid
    const rosterRows = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRows, league })
    const activePlayerIds = roster.active.map((p) => p.player)
    const players = await getPlayers({ leagueId, playerIds: activePlayerIds })
    const lineups = optimizeLineup({
      players,
      league
    })

    for (const [week, lineup] of Object.entries(lineups)) {
      teamLineupsInserts.push({
        week,
        tid,
        lid: leagueId,
        year,
        total: lineup.total
      })
      for (const player of lineup.starters) {
        teamLineupStartersInserts.push({
          player,
          week,
          lid: leagueId,
          year,
          tid
        })
      }
    }
  }

  if (teamLineupsInserts.length) {
    await db('league_team_lineups')
      .insert(teamLineupsInserts)
      .onConflict()
      .merge()
    log(`saved ${teamLineupsInserts.length} team lineups`)
  }

  if (teamLineupStartersInserts.length) {
    await db('league_team_lineup_starters')
      .insert(teamLineupStartersInserts)
      .onConflict()
      .merge()
    log(`saved ${teamLineupStartersInserts.length} team lineup starters`)
  }
}

module.exports = run

const main = async () => {
  debug.enable('project-lineups')
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
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
