import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, Roster, calculateStandings } from '#common'
import { isMain, getRoster, getLeague } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-matchups')
debug.enable('process-matchups')

const run = async ({ lid, year }) => {
  const league = await getLeague(lid)
  const matchups = await db('matchups').where({ lid, year })
  const gamelogs = await db('gamelogs').where({ year })
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
    }
  }
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
    teamStats.push({
      tid,
      lid,
      year,
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
    if (!lid) {
      console.log('missing --lid')
      return
    }

    if (!year) {
      console.log('missing --year')
    }

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
