import debug from 'debug'
import fetch from 'node-fetch'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, getPlayer, report_job, pff } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:projections')
debug.enable('import:projections,get-player,pff')
const timestamp = Math.round(Date.now() / 1000)
const year = constants.season.year

const runOne = async ({ week, cookie }) => {
  const missing = []

  const URL = `https://www.pff.com/api/fantasy/projections?scoring=preset_ppr&weeks=${week}`
  const result = await fetch(URL, {
    headers: {
      cookie
    }
  }).then((res) => res.json())

  if (!result.player_projections || !result.player_projections.length) {
    throw new Error('missing projections')
  }

  const inserts = []
  for (const item of result.player_projections) {
    const name = item.player_name
    const team = item.team_name
    const pos = item.position.toUpperCase()
    const params = { name, team, pos }
    let player_row

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

    const data = {
      fuml: item.fumbles_lost || 0,
      pa: item.pass_att || 0,
      pc: item.pass_comp || 0,
      ints: item.pass_int || 0,
      tdp: item.pass_td || 0,
      py: item.pass_yds || 0,
      ra: item.rush_att || 0,
      tdr: item.rush_td || 0,
      ry: item.rush_yds || 0,
      twoptc: item.two_pt || 0,
      rec: item.recv_receptions || 0,
      trg: item.recv_targets || 0,
      tdrec: item.recv_td || 0,
      recy: item.recv_yds || 0,

      fg29: item.fg_made_20_29 || 0,
      fg39: item.fg_made_30_39 || 0,
      fg49: item.fg_made_40_49 || 0,
      fg50: item.fg_made_50plus || 0,
      xpm: item.pat_made || 0,

      dff: item.dst_fumbles_forced || 0,
      drf: item.dst_fumbles_recovered || 0,
      dint: item.dst_int || 0,
      dsk: item.dst_sacks || 0,
      dsf: item.dst_safeties || 0,
      dtd: item.dst_td || 0
    }

    inserts.push({
      pid: player_row.pid,
      week,
      year,
      sourceid: constants.sources.PFF,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (argv.dry) {
    log(`${inserts.length} projections`)
    log(inserts[0])
    return
  }

  if (inserts.length) {
    // remove any existing projections in index not included in this set
    await db('projections_index')
      .where({ year, week, sourceid: constants.sources.PFF })
      .whereNotIn(
        'pid',
        inserts.map((i) => i.pid)
      )
      .del()

    log(`Inserting ${inserts.length} projections into database`)
    await db('projections_index')
      .insert(inserts)
      .onConflict(['sourceid', 'pid', 'userid', 'week', 'year'])
      .merge()
    await db('projections').insert(inserts.map((i) => ({ ...i, timestamp })))
  }
}

const run = async () => {
  // do not pull in any projections after the season has ended
  if (constants.season.week > constants.season.nflFinalWeek) {
    return
  }

  const cookie = await pff.get_pff_session_cookie()

  for (
    let week = constants.season.week;
    week <= constants.season.nflFinalWeek;
    week++
  ) {
    await runOne({ week, cookie })
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
    job_type: job_types.PROJECTIONS_PFF,
    error
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
