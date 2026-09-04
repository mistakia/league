import debug from 'debug'

import db from '#db'
import { format_nfl_status, format_nfl_injury_status } from '#libs-shared'
import { current_season } from '#constants'
import {
  is_main,
  find_player_row,
  report_job,
  fetch_with_retry,
  throw_if_shortfall
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('import:practice-report')
enable_debug_namespaces('import:practice-report,get-player,fetch')

const url = 'https://www.rotowire.com/football/tables/practice-report.php?team='
const { week, year } = current_season
const getReport = (item) => {
  const data = {
    source_status: item.status,
    injury_type: item.injtype,
    monday_practice_status: item.monday === '-' ? null : item.monday,
    tuesday_practice_status: item.tuesday === '-' ? null : item.tuesday,
    wednesday_practice_status: item.wednesday === '-' ? null : item.wednesday,
    thursday_practice_status: item.thursday === '-' ? null : item.thursday,
    friday_practice_status: item.friday === '-' ? null : item.friday,
    saturday_practice_status: item.saturday === '-' ? null : item.saturday,
    sunday_practice_status: item.sunday === '-' ? null : item.sunday
  }

  // Try to parse as game designation first (OUT, QUESTIONABLE, DOUBTFUL, PROBABLE)
  try {
    data.game_designation = format_nfl_injury_status(item.status)
  } catch (err) {
    log(err)
    log(item)
  }

  // If not a game designation, try parsing as roster status
  if (!data.game_designation) {
    try {
      data.roster_status = format_nfl_status(item.status)
    } catch (err) {
      log(err)
      log(item)
    }
  }

  return data
}

// Per-run in-season floor. A typical weekly NFL practice report touches
// 50-150 players; 20 is generous against partial data while catching
// empty rotowire payload / wholesale find_player_row failure modes.
const PRACTICE_REPORT_FLOOR_PER_WEEK = 20

const run = async () => {
  // do not pull in reports outside of the NFL season
  if (
    !current_season.now.isBetween(
      current_season.regular_season_start,
      current_season.end
    )
  ) {
    return { shortfall: null, in_season: false }
  }

  // The rotowire feed returns [] until the Wednesday before week 1, so a
  // regular season that has not kicked off means every run legitimately
  // processes zero rows. week === 0 is not sufficient: week 1 is also
  // pre-opener (the Sept 8-9 window here), so gate on the first FINAL REG
  // game rather than the week counter.
  const season_has_kicked_off = await db('nfl_games')
    .where({ season_year: current_season.year, season_type: 'REG' })
    .andWhere('status', 'like', 'FINAL%')
    .limit(1)
    .then((rows) => rows.length > 0)
  if (!season_has_kicked_off) {
    return { shortfall: null, in_season: false }
  }

  const data = await fetch_with_retry({
    url,
    use_proxy: true,
    response_type: 'json'
  })

  const missing = []
  let players_processed = 0
  for (const item of data) {
    let player_row

    const params = {
      name: item.player,
      team: item.team,
      pos: item.pos
    }

    try {
      player_row = await find_player_row(params)
      if (!player_row) {
        missing.push(params)
        continue
      }
    } catch (err) {
      console.log(err)
      missing.push(params)
      continue
    }

    const currentPRs = await db('practice')
      .where({ pid: player_row.pid, week, season_year: year })
      .limit(1)
    const currentPR = currentPRs[0]

    const practiceReport = getReport(item)
    if (currentPR) {
      await db('practice')
        .update({
          ...practiceReport
        })
        .where({
          pid: player_row.pid,
          week,
          season_year: year
        })
    } else {
      await db('practice').insert({
        pid: player_row.pid,
        week,
        season_year: year,
        season_type: current_season.nfl_seas_type,
        ...practiceReport
      })
    }
    players_processed++
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (players_processed < PRACTICE_REPORT_FLOOR_PER_WEEK) {
    return {
      shortfall: `practice report row-count shortfall for (year=${year}, week=${week}): ${players_processed} players processed (floor=${PRACTICE_REPORT_FLOOR_PER_WEEK})`,
      in_season: true
    }
  }

  // E2 silence monitor: cross-run check that ANY Rotowire row landed in the
  // last ~7 days. The per-run floor catches a single dead run; this catches
  // a string of dead runs that each succeed in parsing but produce zero
  // writes (silent upstream content stripping). Looks at current week +
  // prior week as the trailing window.
  const window_weeks = week > 1 ? [week, week - 1] : [week]
  const [{ c: window_rows }] = await db('practice')
    .where({
      season_year: year,
      season_type: current_season.nfl_seas_type,
      source: 'rotowire'
    })
    .whereIn('week', window_weeks)
    .count({ c: '*' })
  if (Number(window_rows) === 0) {
    return {
      shortfall: `Rotowire silence monitor: zero practice rows across weeks ${window_weeks.join(',')} of ${year} -- 7d window dark`,
      in_season: true
    }
  }
  return { shortfall: null, in_season: true }
}

const main = async () => {
  let error
  try {
    const result = await run()
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PRACTICE_REPORT,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default run
