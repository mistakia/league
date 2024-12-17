import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, Roster, calculatePoints } from '#libs-shared'
import { is_main, getLeague, getRoster, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-playoffs')
debug.enable('process-playoffs')

const processPlayoffs = async ({ lid, year }) => {
  const league = await getLeague({ lid })
  const playoffs = await db('playoffs').where({ lid, year })
  const league_team_seasonlogs = await db('league_team_seasonlogs').where({
    lid,
    year
  })

  const is_wildcard_round =
    constants.season.year === year && constants.season.week === 15
  if (!playoffs.length && is_wildcard_round) {
    log(`creating wildcard round matchups for lid ${lid} year ${year}`)

    const wildcard_regular_season_finishes = [3, 4, 5, 6]
    const wildcard_teams = league_team_seasonlogs
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
        week: 15 // wildcard round week
      })
    }

    await db('playoffs')
      .insert(playoff_inserts)
      .onConflict(['tid', 'uid', 'year'])
      .merge()
    log(
      `inserted ${playoff_inserts.length} wildcard round matchups for lid ${lid}`
    )

    return
  }

  const weeks =
    constants.season.year === year
      ? [
          ...new Set(
            playoffs
              .filter((p) => p.week < constants.season.week)
              .map((p) => p.week)
          )
        ]
      : [...new Set(playoffs.map((p) => p.week))]
  const gamelogs = await db('player_gamelogs')
    .select('player_gamelogs.*', 'nfl_games.week')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', 'REG')
    .whereIn('nfl_games.week', weeks)

  for (const item of playoffs) {
    const { tid, week, year } = item
    if (
      item.year === constants.season.year &&
      item.week >= constants.season.week
    ) {
      continue
    }
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

  await db('playoffs')
    .insert(playoffs)
    .onConflict(['tid', 'uid', 'year'])
    .merge()
  log(`updated ${playoffs.length} playoff results`)

  if (constants.season.year !== year || constants.season.week > 17) {
    // calculate post season finish
    const playoff_teams = playoffs
      .filter((p) => p.uid === 1)
      .sort((a, b) => b.points - a.points)
      .map((p) => p.tid)

    const team_stat_inserts = []

    // lowest scoring wildcard team is 6th place
    team_stat_inserts.push({
      lid,
      year,
      tid: playoff_teams[3],
      post_season_finish: 6,
      overall_finish: 6
    })

    // second lowest scoring wildcard team is 5th place
    team_stat_inserts.push({
      lid,
      year,
      tid: playoff_teams[2],
      post_season_finish: 5,
      overall_finish: 5
    })

    // combine championship round week 16 and 17 points
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
        post_season_finish: i + 1,
        overall_finish: i + 1
      })
    }

    const playoff_team_ids = team_stat_inserts.map((entry) => Number(entry.tid))
    // Calculate overall finishes for non-playoff teams based on regular season finishes
    const non_playoff_teams = league_team_seasonlogs
      .filter((team) => !playoff_team_ids.includes(team.tid))
      .sort((a, b) => a.regular_season_finish - b.regular_season_finish)

    let next_finish_position = playoff_team_ids.length + 1
    non_playoff_teams.forEach((team) => {
      team_stat_inserts.push({
        lid,
        year,
        tid: team.tid,
        post_season_finish: null,
        overall_finish: next_finish_position++
      })
    })

    await db('league_team_seasonlogs')
      .insert(team_stat_inserts)
      .onConflict(['tid', 'year'])
      .merge()
    log(
      `updated ${team_stat_inserts.length} team stats for lid ${lid} year ${year}`
    )

    return
  }

  const is_championship_round =
    constants.season.year === year && constants.season.week >= 16
  const missing_championship_matchups = !playoffs.some(
    (p) => p.uid === 2 && p.week === 16
  )
  if (missing_championship_matchups && is_championship_round) {
    log(`creating championship round matchups for lid ${lid} year ${year}`)
    // create championship round matchups
    // regular season 1st and 2nd place finish + two highest points from the wildcard round
    const league_team_seasonlogs = await db('league_team_seasonlogs').where({
      lid,
      year
    })
    const regular_season_finishes = [1, 2]
    const regular_season_teams = league_team_seasonlogs
      .filter((t) => regular_season_finishes.includes(t.regular_season_finish))
      .map((t) => t.tid)

    const wildcard_teams = playoffs
      .filter((p) => p.uid === 1 && p.week === 15)
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
        week: 16 // championship round week
      })

      championship_inserts.push({
        uid: 3, // championship round uid
        tid,
        lid,
        year,
        week: 17 // championship round week
      })
    }

    await db('playoffs')
      .insert(championship_inserts)
      .onConflict(['tid', 'uid', 'year'])
      .merge()
    log(
      `inserted ${championship_inserts.length} championship round matchups for lid ${lid}`
    )
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

  await report_job({
    job_type: job_types.PROCESS_PLAYOFFS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default processPlayoffs
