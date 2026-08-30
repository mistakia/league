import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { Roster, calculatePoints } from '#libs-shared'
import { current_season } from '#constants'
import {
  is_main,
  getLeague,
  getRoster,
  report_job,
  get_season_playoff_weeks
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('process-playoffs')
enable_debug_namespaces('process-playoffs')

const process_playoffs = async ({ lid, year }) => {
  // The playoff weeks are per-league configuration on the season row, the same
  // source simulate-playoff-forecast reads. Hardcoding 15/16/17 here wrote the
  // rows at weeks the league does not play, so the forecast -- which resolves
  // the configured weeks and looks for rows there -- found none. The ORDINALS
  // (playoff_week_number 1, 2, 3) are stable and stay literal; only the week
  // numbers drift.
  const { wildcard_week, championship_weeks, final_week } =
    await get_season_playoff_weeks({ lid, season_year: year })

  if (year === current_season.year) {
    // Only the current season reaches the branches that WRITE a week. A past
    // season with no `seasons` row still processes: every branch below it takes
    // derives its weeks from the playoffs rows that already exist, so throwing
    // unconditionally here would break historical reprocessing.
    if (!wildcard_week || !championship_weeks.length) {
      throw new Error(
        `No playoff weeks configured for league ${lid} in ${year}`
      )
    }

    // skip if processing current season and it is before the wildcard round
    if (current_season.week < wildcard_week) {
      return
    }
  }

  const championship_start_week = championship_weeks[0]

  const league = await getLeague({ lid })
  const playoffs = await db('playoffs').where({ lid, season_year: year })
  const league_team_seasonlogs = await db('league_team_seasonlogs').where({
    lid,
    season_year: year
  })

  const is_wildcard_round =
    current_season.year === year && current_season.week === wildcard_week
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
        playoff_week_number: 1, // wildcard round
        tid,
        lid,
        season_year: year,
        week: wildcard_week
      })
    }

    await db('playoffs')
      .insert(playoff_inserts)
      .onConflict(['tid', 'playoff_week_number', 'season_year'])
      .merge()
    log(
      `inserted ${playoff_inserts.length} wildcard round matchups for lid ${lid}`
    )

    return
  }

  const weeks =
    current_season.year === year
      ? [
          ...new Set(
            playoffs
              .filter((p) => p.week < current_season.week)
              .map((p) => p.week)
          )
        ]
      : [...new Set(playoffs.map((p) => p.week))]
  const gamelogs = await db('player_gamelogs')
    .select('player_gamelogs.*', 'nfl_games.week')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.season_year', year)
    .where('nfl_games.season_type', 'REG')
    .whereIn('nfl_games.week', weeks)

  for (const item of playoffs) {
    const { tid, week, season_year: year } = item
    if (
      item.season_year === current_season.year &&
      item.week >= current_season.week
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
    .onConflict(['tid', 'playoff_week_number', 'season_year'])
    .merge()
  log(`updated ${playoffs.length} playoff results`)

  if (current_season.year !== year || current_season.week > final_week) {
    // calculate post season finish
    const playoff_teams = playoffs
      .filter((p) => p.playoff_week_number === 1)
      .sort((a, b) => b.points - a.points)
      .map((p) => p.tid)

    const team_stat_inserts = []

    // lowest scoring wildcard team is 6th place
    team_stat_inserts.push({
      lid,
      season_year: year,
      tid: playoff_teams[3],
      post_season_finish: 6,
      overall_finish: 6
    })

    // second lowest scoring wildcard team is 5th place
    team_stat_inserts.push({
      lid,
      season_year: year,
      tid: playoff_teams[2],
      post_season_finish: 5,
      overall_finish: 5
    })

    // combine every championship round week's points
    const championship_round_matchups = playoffs.filter(
      (p) => p.playoff_week_number > 1
    )
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
        season_year: year,
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
        season_year: year,
        tid: team.tid,
        post_season_finish: null,
        overall_finish: next_finish_position++
      })
    })

    await db('league_team_seasonlogs')
      .insert(team_stat_inserts)
      .onConflict(['tid', 'season_year'])
      .merge()
    log(
      `updated ${team_stat_inserts.length} team stats for lid ${lid} year ${year}`
    )

    return
  }

  const is_championship_round =
    current_season.year === year &&
    current_season.week >= championship_start_week
  const missing_championship_matchups = !playoffs.some(
    (p) => p.playoff_week_number === 2 && p.week === championship_start_week
  )
  if (missing_championship_matchups && is_championship_round) {
    log(`creating championship round matchups for lid ${lid} year ${year}`)
    // create championship round matchups
    // regular season 1st and 2nd place finish + two highest points from the wildcard round
    const league_team_seasonlogs = await db('league_team_seasonlogs').where({
      lid,
      season_year: year
    })
    const regular_season_finishes = [1, 2]
    const regular_season_teams = league_team_seasonlogs
      .filter((t) => regular_season_finishes.includes(t.regular_season_finish))
      .map((t) => t.tid)

    const wildcard_teams = playoffs
      .filter((p) => p.playoff_week_number === 1 && p.week === wildcard_week)
      .sort((a, b) => b.points - a.points)
      .slice(0, 2)
      .map((p) => p.tid)

    const championship_teams = [...regular_season_teams, ...wildcard_teams]
    const championship_inserts = []
    // One row per championship week, ordinal 2 upward. The previous hand-written
    // pair made a two-week round structural; simulate-playoff-forecast already
    // reads playoff_week_number as an ordinal where anything above 1 is the
    // championship round, "however many weeks that round spans".
    for (const tid of championship_teams) {
      championship_weeks.forEach((championship_week, index) => {
        championship_inserts.push({
          playoff_week_number: index + 2,
          tid,
          lid,
          season_year: year,
          week: championship_week
        })
      })
    }

    await db('playoffs')
      .insert(championship_inserts)
      .onConflict(['tid', 'playoff_week_number', 'season_year'])
      .merge()
    log(
      `inserted ${championship_inserts.length} championship round matchups for lid ${lid}`
    )
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
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

    await process_playoffs({ lid, year })
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

export default process_playoffs
