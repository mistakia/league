import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  find_player_row,
  is_main,
  report_job,
  four_for_four
} from '#libs-server'
import { constants } from '#libs-shared'
import db from '#db'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('import:projections')
debug.enable('import:projections,get-player')

const timestamp = Math.floor(Date.now() / 1000)
const argv = yargs(hideBin(process.argv)).argv

const get_projection = (stats) => ({
  py: Number(stats['Pass Yds']) || null,
  pa: Number(stats['Pass Att']) || null,
  pc: stats.Comp ? Number(stats.Comp) : Number(stats['Pass Comp']) || null,
  tdp: Number(stats['Pass TD']) || null,
  ints: Number(stats.INT) || null,

  ra: Number(stats['Rush Att']) || null,
  ry: Number(stats['Rush Yds']) || null,
  tdr: Number(stats['Rush TD']) || null,

  fuml: Number(stats.Fum) || null,

  rec: Number(stats.Rec) || null,
  recy: Number(stats['Rec Yds']) || null,
  tdrec: Number(stats['Rec TD']) || null,

  fgm: Number(stats.FG) || null,
  xpm: Number(stats.XP) || null
})

const run = async ({
  is_regular_season_projection = false,
  dry_run = false
}) => {
  // do not pull in any projections after the season has ended
  if (constants.season.week > constants.season.nflFinalWeek) {
    return
  }

  const year = constants.season.year
  const week = is_regular_season_projection ? 0 : constants.season.week

  const data = await four_for_four.get_4for4_projections({
    year,
    week,
    is_regular_season_projection,
    ignore_cache: true
  })

  const inserts = []
  const missing = []

  for (const item of data) {
    const params = {
      name: item.Player,
      team: item.Team,
      pos: item.Pos
    }

    let player_row
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

    const proj = get_projection(item)
    inserts.push({
      pid: player_row.pid,
      year,
      week,
      seas_type: 'REG',
      sourceid: constants.sources['4FOR4'],
      ...proj
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (dry_run) {
    log(`${inserts.length} projections`)
    log(inserts[0])
    return
  }

  if (inserts.length) {
    // remove any existing projections in index not included in this set
    await db('projections_index')
      .where({
        year,
        week,
        sourceid: constants.sources['4FOR4'],
        seas_type: 'REG'
      })
      .whereNotIn(
        'pid',
        inserts.map((i) => i.pid)
      )
      .del()

    log(
      `Inserting ${inserts.length} projections for week ${week} into database`
    )
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
    await run({ is_regular_season_projection: argv.season, dry_run: argv.dry })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROJECTIONS_4FOR4,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
