import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, Roster, calculateStandings } from '#common'
import { isMain, getRoster, getLeague } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-matchups')
debug.enable('process-matchups,calculate-standings')

const run = async ({ lid = 1, year = constants.season.year }) => {
  const league = await getLeague({ lid, year })
  const matchups = await db('matchups').where({ lid, year })
  const teams = await db('teams').where({ lid })
  const tids = teams.map((t) => t.uid)

  const finalWeek =
    year === constants.season.year
      ? Math.min(
          Math.max(constants.season.week - 1, 0),
          constants.season.regularSeasonFinalWeek
        )
      : constants.season.regularSeasonFinalWeek

  const starters = {}
  const active = {}
  const player_pids = {}
  for (let week = 1; week <= finalWeek; week++) {
    starters[week] = {}
    active[week] = {}
    for (const team of teams) {
      const rosterRow = await getRoster({ tid: team.uid, week, year })
      const roster = new Roster({ roster: rosterRow, league })
      starters[week][team.uid] = roster.starters.map((p) => ({
        pid: p.pid,
        pos: p.pos,
        slot: p.slot
      }))
      active[week][team.uid] = roster.active.map((p) => ({
        pid: p.pid,
        pos: p.pos
      }))
      for (const p of roster.active) {
        player_pids[p.pid] = true
      }
    }
  }

  const gamelogs = await db('player_gamelogs')
    .select('player_gamelogs.*', 'nfl_games.week', 'nfl_games.year')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.year', year)
    .where('player_gamelogs.active', true)
    .where('nfl_games.seas_type', 'REG')
    .whereIn('player_gamelogs.pid', Object.keys(player_pids))

  const result = calculateStandings({
    starters,
    active,
    league,
    tids,
    gamelogs,
    matchups,
    year
  })

  for (const matchup of matchups) {
    const { week } = matchup
    matchup.hp = result[matchup.hid].points.weeks[week]
    matchup.ap = result[matchup.aid].points.weeks[week]

    matchup.hpp = result[matchup.hid].potentialPoints[week]
    matchup.app = result[matchup.aid].potentialPoints[week]
  }

  const teamStats = []
  for (const [tid, team] of Object.entries(result)) {
    const tm = teams.find((t) => t.uid === team.tid)
    teamStats.push({
      tid,
      lid,
      year,
      div: tm.div,
      ...team.stats
    })
  }

  if (teamStats.length) {
    await db('team_stats').insert(teamStats).onConflict().merge()
    log(`saved team stats for ${teamStats.length} teams`)
  }

  if (matchups.length) {
    await db('matchups').insert(matchups).onConflict().merge()
    log(`saved ${matchups.length} matchups`)
  }
}

const main = async () => {
  let error
  try {
    const lid = argv.lid
    const year = argv.year
    await run({ year, lid })
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.PROCESS_MATCHUPS,
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
