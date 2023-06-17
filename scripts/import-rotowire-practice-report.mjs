import fetch from 'node-fetch'
import debug from 'debug'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, getPlayer } from '#libs-server'

const log = debug('import:practice-report')
debug.enable('import:practice-report,get-player')

const url = 'https://www.rotowire.com/football/tables/practice-report.php?team='
const { week, year } = constants.season
const getReport = (item) => ({
  status: item.status,
  inj: item.injtype,
  m: item.monday === '-' ? null : item.monday,
  tu: item.tuesday === '-' ? null : item.tuesday,
  w: item.wednesday === '-' ? null : item.wednesday,
  th: item.thursday === '-' ? null : item.thursday,
  f: item.friday === '-' ? null : item.friday,
  s: item.saturday === '-' ? null : item.saturday,
  su: item.sunday === '-' ? null : item.sunday
})

const run = async () => {
  // do not pull in reports outside of the NFL season
  if (
    !constants.season.now.isBetween(
      constants.season.start,
      constants.season.end
    )
  ) {
    return
  }

  const data = await fetch(url).then((res) => res.json())

  const missing = []
  for (const item of data) {
    let player_row

    const params = {
      name: item.player,
      team: item.team,
      pos: item.pos
    }

    try {
      player_row = await getPlayer(params)
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

  await db('jobs').insert({
    type: constants.jobs.PRACTICE_REPORT,
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
