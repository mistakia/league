import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import { constants } from '#libs-shared'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-league-careerlogs')
debug.enable('calculate-league-careerlogs')

const calculate_league_careerlogs = async ({ lid }) => {
  log(`Calculating careerlogs for league ${lid}`)

  // Get all seasonlogs for league
  const league_team_seasonlogs = await db('league_team_seasonlogs').where(
    'lid',
    lid
  )

  // Group seasonlogs by team and user
  const team_seasonlogs = {}
  const user_seasonlogs = {}

  for (const league_team_seasonlog of league_team_seasonlogs) {
    if (!team_seasonlogs[league_team_seasonlog.tid]) {
      team_seasonlogs[league_team_seasonlog.tid] = []
    }
    team_seasonlogs[league_team_seasonlog.tid].push(league_team_seasonlog)

    // Get all users associated with this team
    const users_teams = await db('users_teams').where({
      tid: league_team_seasonlog.tid,
      year: league_team_seasonlog.year
    })
    for (const user_team of users_teams) {
      if (!user_seasonlogs[user_team.userid]) {
        user_seasonlogs[user_team.userid] = []
      }
      user_seasonlogs[user_team.userid].push(league_team_seasonlog)
    }
  }

  // Calculate careerlogs for each team and user
  const team_careerlogs = []
  const user_careerlogs = []

  const calculate_careerlog = async ({ league_team_seasonlogs }) => {
    const careerlog = {
      lid,
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
      worst_overall_finish: 0,
      first_season_year: Number.MAX_VALUE,
      last_season_year: 0,
      num_seasons: league_team_seasonlogs.length,
      weekly_high_scores: 0,
      post_seasons: 0,
      championships: 0,
      championship_rounds: 0,
      regular_season_leader: 0,
      num_byes: 0,
      best_season_win_pct: 0,
      best_season_all_play_pct: 0,
      wildcards: 0,
      wildcard_wins: 0,
      wildcard_highest_score: 0,
      wildcard_total_points: 0,
      wildcard_lowest_score: Number.MAX_VALUE,
      championship_highest_score: 0,
      championship_total_points: 0,
      championship_lowest_score: Number.MAX_VALUE,
      division_wins: 0
    }

    for (const league_team_seasonlog of league_team_seasonlogs) {
      careerlog.wins += league_team_seasonlog.wins
      careerlog.losses += league_team_seasonlog.losses
      careerlog.ties += league_team_seasonlog.ties
      careerlog.apWins += league_team_seasonlog.apWins
      careerlog.apLosses += league_team_seasonlog.apLosses
      careerlog.apTies += league_team_seasonlog.apTies
      careerlog.pf += league_team_seasonlog.pf
      careerlog.pa += league_team_seasonlog.pa
      careerlog.pdiff += league_team_seasonlog.pdiff
      careerlog.pp += league_team_seasonlog.pp
      careerlog.pw += league_team_seasonlog.pw
      careerlog.pl += league_team_seasonlog.pl
      careerlog.pmax = Math.max(careerlog.pmax, league_team_seasonlog.pmax)
      careerlog.pmin = Math.min(careerlog.pmin, league_team_seasonlog.pmin)
      careerlog.worst_regular_season_finish = Math.max(
        careerlog.worst_regular_season_finish,
        league_team_seasonlog.regular_season_finish
      )
      careerlog.best_regular_season_finish = Math.min(
        careerlog.best_regular_season_finish,
        league_team_seasonlog.regular_season_finish
      )
      careerlog.best_overall_finish = Math.min(
        careerlog.best_overall_finish,
        league_team_seasonlog.overall_finish
      )
      careerlog.worst_overall_finish = Math.max(
        careerlog.worst_overall_finish,
        league_team_seasonlog.overall_finish
      )
      careerlog.first_season_year = Math.min(
        careerlog.first_season_year,
        league_team_seasonlog.year
      )
      careerlog.last_season_year = Math.max(
        careerlog.last_season_year,
        league_team_seasonlog.year
      )
      careerlog.weekly_high_scores +=
        league_team_seasonlog.weekly_high_scores || 0

      careerlog.post_seasons +=
        league_team_seasonlog.overall_finish <= 6 ? 1 : 0
      careerlog.championships +=
        league_team_seasonlog.overall_finish === 1 ? 1 : 0
      careerlog.championship_rounds +=
        league_team_seasonlog.overall_finish <= 4 ? 1 : 0
      careerlog.regular_season_leader +=
        league_team_seasonlog.regular_season_finish === 1 ? 1 : 0
      careerlog.num_byes +=
        league_team_seasonlog.regular_season_finish <= 2 ? 1 : 0
      careerlog.best_season_win_pct = Math.max(
        careerlog.best_season_win_pct,
        league_team_seasonlog.wins /
          (league_team_seasonlog.wins +
            league_team_seasonlog.losses +
            league_team_seasonlog.ties)
      )
      careerlog.best_season_all_play_pct = Math.max(
        careerlog.best_season_all_play_pct,
        league_team_seasonlog.apWins /
          (league_team_seasonlog.apWins +
            league_team_seasonlog.apLosses +
            league_team_seasonlog.apTies)
      )
      careerlog.wildcards +=
        league_team_seasonlog.regular_season_finish >= 3 &&
        league_team_seasonlog.regular_season_finish <= 6
          ? 1
          : 0
      careerlog.division_wins +=
        league_team_seasonlog.division_finish === 1 ? 1 : 0

      // Fetch playoff data for this team and year
      const playoff_data = await db('playoffs')
        .where({
          tid: league_team_seasonlog.tid,
          lid: league_team_seasonlog.lid,
          year: league_team_seasonlog.year
        })
        .orderBy('uid')

      // Process wildcard round
      const wildcard_game = playoff_data.find((game) => game.uid === 1)
      if (wildcard_game) {
        careerlog.wildcard_total_points += wildcard_game.points || 0
        careerlog.wildcard_highest_score = Math.max(
          careerlog.wildcard_highest_score,
          wildcard_game.points || 0
        )
        careerlog.wildcard_lowest_score = Math.min(
          careerlog.wildcard_lowest_score,
          wildcard_game.points || Number.MAX_VALUE
        )

        // Check if team won the wildcard round
        if (playoff_data.some((game) => game.uid === 2)) {
          careerlog.wildcard_wins += 1
        }
      }

      // Process championship round
      const championship_games = playoff_data.filter(
        (game) => game.uid === 2 || game.uid === 3
      )
      for (const game of championship_games) {
        careerlog.championship_total_points += game.points || 0
        careerlog.championship_highest_score = Math.max(
          careerlog.championship_highest_score,
          game.points || 0
        )
        careerlog.championship_lowest_score = Math.min(
          careerlog.championship_lowest_score,
          game.points || Number.MAX_VALUE
        )
      }
    }

    // Adjust lowest scores if they weren't set
    if (careerlog.wildcard_lowest_score === Number.MAX_VALUE) {
      careerlog.wildcard_lowest_score = 0
    }
    if (careerlog.championship_lowest_score === Number.MAX_VALUE) {
      careerlog.championship_lowest_score = 0
    }

    careerlog.best_season_win_pct = careerlog.best_season_win_pct * 100
    careerlog.best_season_all_play_pct =
      careerlog.best_season_all_play_pct * 100

    careerlog.pp_pct = (careerlog.pf / careerlog.pp) * 100

    return careerlog
  }

  for (const [tid, league_team_seasonlogs] of Object.entries(team_seasonlogs)) {
    log(`Calculating careerlog for team ${tid}`)
    const careerlog = await calculate_careerlog({ league_team_seasonlogs })
    careerlog.tid = Number(tid)
    careerlog.lid = lid
    team_careerlogs.push(careerlog)
  }

  for (const [userid, league_team_seasonlogs] of Object.entries(
    user_seasonlogs
  )) {
    log(`Calculating careerlog for user ${userid}`)
    const careerlog = await calculate_careerlog({ league_team_seasonlogs })
    careerlog.userid = Number(userid)
    careerlog.lid = lid
    user_careerlogs.push(careerlog)
  }

  if (team_careerlogs.length) {
    // Save team careerlogs to database
    await db('league_team_careerlogs')
      .insert(team_careerlogs)
      .onConflict(['lid', 'tid'])
      .merge()

    log(
      `Calculated and saved team careerlogs for ${team_careerlogs.length} teams in league ${lid}`
    )
  }

  if (user_careerlogs.length) {
    // Save user careerlogs to database
    await db('league_user_careerlogs')
      .insert(user_careerlogs)
      .onConflict(['lid', 'userid'])
      .merge()

    log(
      `Calculated and saved user careerlogs for ${user_careerlogs.length} users in league ${lid}`
    )
  }
}

const main = async () => {
  let error
  try {
    // Process all leagues
    const leagues = await db('leagues').select('uid').where('hosted', true)
    for (const league of leagues) {
      await calculate_league_careerlogs({ lid: league.uid })
    }
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default calculate_league_careerlogs
