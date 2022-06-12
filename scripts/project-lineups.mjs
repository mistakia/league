import debug from 'debug'

import db from '#db'
import { constants, Roster, optimizeLineup } from '#common'
import { getLeague, getRoster, getPlayers, isMain } from '#utils'

const log = debug('project-lineups')

const run = async () => {
  const { year } = constants.season
  const leagueId = 1
  const league = await getLeague(leagueId)
  const teams = await db('teams').where({ lid: leagueId })
  const team_lineup_inserts = []
  const team_lineup_starter_inserts = []
  for (const team of teams) {
    const tid = team.uid
    const rosterRows = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRows, league })
    const active_pids = roster.active.map((p) => p.pid)
    const players = await getPlayers({ leagueId, pids: active_pids })
    const lineups = optimizeLineup({
      players,
      league
    })

    for (const [week, lineup] of Object.entries(lineups)) {
      team_lineup_inserts.push({
        week,
        tid,
        lid: leagueId,
        year,
        total: lineup.total
      })
      for (const pid of lineup.starter_pids) {
        team_lineup_starter_inserts.push({
          pid,
          week,
          lid: leagueId,
          year,
          tid
        })
      }
    }
  }

  if (team_lineup_inserts.length) {
    await db('league_team_lineups')
      .insert(team_lineup_inserts)
      .onConflict()
      .merge()
    log(`saved ${team_lineup_inserts.length} team lineups`)
  }

  if (team_lineup_starter_inserts.length) {
    await db('league_team_lineup_starters')
      .insert(team_lineup_starter_inserts)
      .onConflict()
      .merge()
    log(`saved ${team_lineup_starter_inserts.length} team lineup starters`)
  }
}

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

if (isMain(import.meta.url)) {
  main()
}

export default run
