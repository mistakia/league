import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, Roster, calculateStandings } from '#libs-shared'
import { is_main, getRoster, getLeague, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('process-matchups')
debug.enable('process-matchups,calculate-standings')

const run = async ({ lid = 1, year = constants.season.year }) => {
  const league = await getLeague({ lid, year })
  const matchups = await db('matchups').where({ lid, year })
  const teams = await db('teams').where({ lid, year })

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
    .select('player_gamelogs.*', 'nfl_games.week')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.year', year)
    .where('player_gamelogs.active', true)
    .where('nfl_games.seas_type', 'REG')
    .whereIn('player_gamelogs.pid', Object.keys(player_pids))

  const result = calculateStandings({
    starters,
    active,
    league,
    teams,
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

  const league_team_seasonlogs = []
  for (const [tid, team] of Object.entries(result)) {
    const tm = teams.find((t) => t.uid === team.tid)
    // Remove post_season_finish and overall_finish from the stats object as they are not calculated and should not overwrite existing values
    const { post_season_finish, overall_finish, ...remainingStats } = team.stats
    league_team_seasonlogs.push({
      tid,
      lid,
      year,
      div: tm.div,
      ...remainingStats
    })
  }

  if (league_team_seasonlogs.length) {
    await db('league_team_seasonlogs')
      .insert(league_team_seasonlogs)
      .onConflict(['tid', 'year'])
      .merge()
    log(`saved team stats for ${league_team_seasonlogs.length} teams`)
  }

  if (matchups.length) {
    await db('matchups').insert(matchups).onConflict('uid').merge()
    log(`saved ${matchups.length} matchups`)
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const lid = argv.lid
    const year = argv.year
    await run({ year, lid })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROCESS_MATCHUPS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
