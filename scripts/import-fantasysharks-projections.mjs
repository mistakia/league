import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import {
  is_main,
  find_player_row,
  report_job,
  fetch_with_retry
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:projections')
debug.enable('import:projections,get-player,fetch')

const URL = argv.season
  ? 'https://www.fantasysharks.com/apps/Projections/SeasonProjections.php?pos=ALL&format=json&l=2'
  : 'https://www.fantasysharks.com/apps/Projections/WeeklyProjections.php?pos=ALL&format=json'
const week = argv.season ? 0 : Math.max(constants.season.week, 1)
const year = new Date().getFullYear()
const timestamp = Math.round(Date.now() / 1000)

const run = async () => {
  // do not pull in any projections after the season has ended
  if (constants.season.week > constants.season.nflFinalWeek) {
    return
  }

  log(URL)
  const data = await fetch_with_retry({ url: URL, response_type: 'json' })
  const missing = []

  const createEntry = (item) => ({
    // passing
    ints: item.Int,
    tdp: item.PassTD,
    py: item.PassYards,
    pc: item.Comp,

    // rushing
    ra: item.Att,
    ry: item.RushYards,
    tdr: item.RushTD,
    fuml: item.Fum,

    // receiving
    rec: item.Rec,
    recy: item.RecYards,
    tdrec: item.RecTD
  })

  const inserts = []

  for (const item of data) {
    const { Team, Pos, Name } = item
    const n = Name.split(',')
    const fname = n.pop().trim()
    const lname = n.shift().trim()
    const fullname = `${fname} ${lname}`
    let player_row
    const params = { name: fullname, team: Team, pos: Pos }
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

    const entry = createEntry(item)
    inserts.push({
      pid: player_row.pid,
      year,
      week,
      sourceid: constants.sources.FANTASY_SHARKS,
      seas_type: 'REG',
      ...entry
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (argv.dry) {
    log(inserts[0])
    return
  }

  if (inserts.length) {
    // remove any existing projections in index not included in this set
    await db('projections_index')
      .where({
        year,
        week,
        sourceid: constants.sources.FANTASY_SHARKS,
        seas_type: 'REG'
      })
      .whereNotIn(
        'pid',
        inserts.map((i) => i.pid)
      )
      .del()

    log(`Inserting ${inserts.length} projections into database`)
    await db('projections_index')
      .insert(inserts)
      .onConflict(['sourceid', 'pid', 'userid', 'week', 'year', 'seas_type'])
      .merge()
    await db('projections').insert(inserts.map((i) => ({ ...i, timestamp })))
  }
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
    job_type: job_types.PROJECTIONS_FANTASYSHARKS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
