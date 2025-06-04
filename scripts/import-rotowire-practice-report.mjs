import debug from 'debug'

import db from '#db'
import {
  constants,
  format_nfl_status,
  format_nfl_injury_status
} from '#libs-shared'
import {
  is_main,
  find_player_row,
  report_job,
  fetch_with_retry
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('import:practice-report')
debug.enable('import:practice-report,get-player,fetch')

const url = 'https://www.rotowire.com/football/tables/practice-report.php?team='
const { week, year } = constants.season
const getReport = (item) => {
  const data = {
    status: item.status,
    inj: item.injtype,
    m: item.monday === '-' ? null : item.monday,
    tu: item.tuesday === '-' ? null : item.tuesday,
    w: item.wednesday === '-' ? null : item.wednesday,
    th: item.thursday === '-' ? null : item.thursday,
    f: item.friday === '-' ? null : item.friday,
    s: item.saturday === '-' ? null : item.saturday,
    su: item.sunday === '-' ? null : item.sunday
  }

  try {
    data.formatted_status = format_nfl_injury_status(item.status)
  } catch (err) {
    log(err)
    log(item)
  }

  if (!data.formatted_status) {
    try {
      data.formatted_status = format_nfl_status(item.status)
    } catch (err) {
      log(err)
      log(item)
    }
  }

  return data
}

const run = async () => {
  // do not pull in reports outside of the NFL season
  if (
    !constants.season.now.isBetween(
      constants.season.regular_season_start,
      constants.season.end
    )
  ) {
    return
  }

  const data = await fetch_with_retry({ url, response_type: 'json' })

  const missing = []
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
      .where({ pid: player_row.pid, week, year })
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
          year
        })
    } else {
      await db('practice').insert({
        pid: player_row.pid,
        week,
        year,
        ...practiceReport
      })
    }
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )
}

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PRACTICE_REPORT,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
