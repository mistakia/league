import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain } from '#libs-server'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-league-team-careerlogs')
debug.enable('calculate-league-team-careerlogs')

const calculate_league_team_careerlogs = async ({ lid }) => {
  log(`Calculating careerlogs for league ${lid}`)
  // get all seasonlogs for league
  const league_team_seasonlogs = await db('league_team_seasonlogs').where(
    'lid',
    lid
  )

  // Group seasonlogs by team
  const team_seasonlogs = {}
  for (const log of league_team_seasonlogs) {
    if (!team_seasonlogs[log.tid]) {
      team_seasonlogs[log.tid] = []
    }
    team_seasonlogs[log.tid].push(log)
  }

  // Calculate careerlogs for each team
  const careerlogs = []
  for (const [tid, logs] of Object.entries(team_seasonlogs)) {
    const careerlog = {
      lid,
      tid: parseInt(tid),
      wins: 0,
      losses: 0,
      ties: 0,
      apWins: 0,
      apLosses: 0,
      apTies: 0,
      pf: 0,
      pa: 0,
      pdiff: 0,
      pp: 0,
      pw: 0,
      pl: 0,
      pp_pct: 0,
      pmax: 0,
      pmin: Number.MAX_VALUE,
      worst_regular_season_finish: 0,
      best_regular_season_finish: Number.MAX_VALUE,
      best_overall_finish: Number.MAX_VALUE,
      worst_overall_finish: 0
    }

    for (const log of logs) {
      careerlog.wins += log.wins
      careerlog.losses += log.losses
      careerlog.ties += log.ties
      careerlog.apWins += log.apWins
      careerlog.apLosses += log.apLosses
      careerlog.apTies += log.apTies
      careerlog.pf += log.pf
      careerlog.pa += log.pa
      careerlog.pdiff += log.pdiff
      careerlog.pp += log.pp
      careerlog.pw += log.pw
      careerlog.pl += log.pl
      careerlog.pmax = Math.max(careerlog.pmax, log.pmax)
      careerlog.pmin = Math.min(careerlog.pmin, log.pmin)
      careerlog.worst_regular_season_finish = Math.max(
        careerlog.worst_regular_season_finish,
        log.regular_season_finish
      )
      careerlog.best_regular_season_finish = Math.min(
        careerlog.best_regular_season_finish,
        log.regular_season_finish
      )
      careerlog.best_overall_finish = Math.min(
        careerlog.best_overall_finish,
        log.overall_finish
      )
      careerlog.worst_overall_finish = Math.max(
        careerlog.worst_overall_finish,
        log.overall_finish
      )
    }

    careerlog.pp_pct = (careerlog.pf / careerlog.pp) * 100

    careerlogs.push(careerlog)
  }

  if (careerlogs.length) {
    // Save careerlogs to database
    await db('league_team_careerlogs')
      .insert(careerlogs)
      .onConflict(['lid', 'tid'])
      .merge()

    log(
      `Calculated and saved careerlogs for ${careerlogs.length} teams in league ${lid}`
    )
  }
}

const main = async () => {
  let error
  try {
    // Assuming you want to process all leagues
    const leagues = await db('leagues').select('uid').where('hosted', true)
    for (const league of leagues) {
      await calculate_league_team_careerlogs({ lid: league.uid })
    }
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: constants.jobs.EXAMPLE,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default calculate_league_team_careerlogs
