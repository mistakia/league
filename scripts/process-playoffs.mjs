import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, Roster, calculatePoints } from '#libs-shared'
import { isMain, getLeague, getRoster } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-playoffs')
debug.enable('process-playoffs')

const processPlayoffs = async ({ lid, year }) => {
  const league = await getLeague({ lid })
  const playoffs = await db('playoffs').where({ lid, year })

  const is_wildcard_round =
    constants.season.year === year && constants.season.week === 15
  if (!playoffs.length && is_wildcard_round) {
    log(`creating wildcard round matchups for lid ${lid} year ${year}`)

    const team_stats = await db('team_stats').where({ lid, year })
    const wildcard_regular_season_finishes = [3, 4, 5, 6]
    const wildcard_teams = team_stats
      .filter((t) =>
        wildcard_regular_season_finishes.includes(t.regular_season_finish)
      )
      .map((t) => t.tid)

    const playoff_inserts = []
    for (const tid of wildcard_teams) {
      playoff_inserts.push({
        uid: 1, // wildcard round uid
        tid,
        lid,
        year,
        week: 14 // wildcard round week
      })
    }

    await db('playoffs').insert(playoff_inserts).onConflict().merge()
    log(
      `inserted ${playoff_inserts.length} wildcard round matchups for lid ${lid}`
    )

    return
  }

  const weeks = [...new Set(playoffs.map((p) => p.week))]
  const gamelogs = await db('player_gamelogs')
    .select('player_gamelogs.*', 'nfl_games.week', 'nfl_games.year')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', 'REG')
    .whereIn('nfl_games.week', weeks)

  for (const item of playoffs) {
    const { tid, week, year } = item
    const rosterRow = await getRoster({ tid, week, year })
    const roster = new Roster({ roster: rosterRow, league })
    item.points = 0
    for (const { pid, pos } of roster.starters) {
      const gamelog = gamelogs.find((g) => g.week === week && g.pid === pid)
      if (!gamelog) {
        log(`WARN: gamelog not found for ${pid} for week ${week}`)
        continue
      }
      const points = calculatePoints({
        stats: gamelog,
        position: pos,
        league
      })
      item.points = points.total + item.points
    }
  }

  await db('playoffs').insert(playoffs).onConflict().merge()
  log(`updated ${playoffs.length} playoff results`)

  if (constants.season.year !== year || constants.season.week > 16) {
    // calculate post season finish
    const playoff_teams = playoffs
      .filter((p) => p.uid === 1 && p.week === 15)
      .sort((a, b) => b.points - a.points)
      .map((p) => p.tid)

    const team_stat_inserts = []

    // lowest scoring wildcard team is 6th place
    team_stat_inserts.push({
      lid,
      year,
      tid: playoff_teams[3],
      post_season_finish: 6
    })

    // second lowest scoring wildcard team is 5th place
    team_stat_inserts.push({
      lid,
      year,
      tid: playoff_teams[2],
      post_season_finish: 5
    })

    // combine championship round week 15 and 16 points
    const championship_round_matchups = playoffs.filter((p) => p.uid > 1)
    const championship_round_points = {}
    for (const matchup of championship_round_matchups) {
      if (!championship_round_points[matchup.tid]) {
        championship_round_points[matchup.tid] = 0
      }
      championship_round_points[matchup.tid] +=
        matchup.points_manual || matchup.points
    }

    const sorted_championship_round_teams = Object.keys(
      championship_round_points
    ).sort(
      (a, b) => championship_round_points[b] - championship_round_points[a]
    )

    log({
      sorted_championship_round_teams,
      championship_round_points
    })

    for (let i = 0; i < sorted_championship_round_teams.length; i++) {
      const tid = sorted_championship_round_teams[i]
      team_stat_inserts.push({
        lid,
        year,
        tid,
        post_season_finish: i + 1
      })
    }

    log(team_stat_inserts)
    await db('team_stats').insert(team_stat_inserts).onConflict().merge()
    log(
      `updated ${team_stat_inserts.length} team stats for lid ${lid} year ${year}`
    )

    return
  }

  const is_championship_round =
    constants.season.year === year && constants.season.week >= 15
  const missing_championship_matchups = !playoffs.some(
    (p) => p.uid === 2 && p.week === 15
  )
  if (missing_championship_matchups && is_championship_round) {
    log(`creating championship round matchups for lid ${lid} year ${year}`)
    // create championship round matchups
    // regular season 1st and 2nd place finish + two highest points from the wildcard round
    const team_stats = await db('team_stats').where({ lid, year })
    const regular_season_finishes = [1, 2]
    const regular_season_teams = team_stats
      .filter((t) => regular_season_finishes.includes(t.regular_season_finish))
      .map((t) => t.tid)

    const wildcard_teams = playoffs
      .filter((p) => p.uid === 1 && p.week === 14)
      .sort((a, b) => b.points - a.points)
      .slice(0, 2)
      .map((p) => p.tid)

    const championship_teams = [...regular_season_teams, ...wildcard_teams]
    const championship_inserts = []
    for (const tid of championship_teams) {
      championship_inserts.push({
        uid: 2, // championship round uid
        tid,
        lid,
        year,
        week: 15 // championship round week
      })

      championship_inserts.push({
        uid: 3, // championship round uid
        tid,
        lid,
        year,
        week: 16 // championship round week
      })
    }
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
      return
    }

    await processPlayoffs({ lid, year })
  } catch (err) {
    error = err
    log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.PROCESS_PLAYOFFS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default processPlayoffs
