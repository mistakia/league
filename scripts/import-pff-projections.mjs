import debug from 'debug'
import fetch from 'node-fetch'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main, find_player_row, report_job, pff } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:projections')
debug.enable('import:projections,get-player,pff')
const timestamp = Math.round(Date.now() / 1000)
const year = constants.season.year

const runOne = async ({ pff_week, cookie, dry = false, seas_type = 'REG' }) => {
  const missing = []

  const config_row = await db('config').where({ key: 'pff_config' }).first()
  const pff_config = config_row.value

  if (!pff_config) {
    throw new Error('PFF config not found')
  }

  const URL = `${pff_config.projections_url}?scoring=preset_ppr&weeks=${pff_week}`
  log(`fetching ${URL}`)
  const result = await fetch(URL, {
    headers: {
      cookie
    }
  }).then((res) => res.json())

  if (!result.player_projections || !result.player_projections.length) {
    throw new Error('missing projections')
  }

  log(`loaded ${result.player_projections.length} projections`)

  const inserts = []
  const week = seas_type === 'POST' ? constants.season.nfl_seas_week : pff_week
  for (const item of result.player_projections) {
    const name = item.player_name
    const team = item.team_name
    const pos = item.position.toUpperCase()
    const params = { name, team, pos }
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
      seas_type,
      sourceid: constants.sources.PFF,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (dry) {
    log(`${inserts.length} projections`)
    log(inserts[0])
    return
  }

  if (inserts.length) {
    // remove any existing projections in index not included in this set
    await db('projections_index')
      .where({ year, week, sourceid: constants.sources.PFF, seas_type })
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

const run = async ({ executable_path, dry_run = false } = {}) => {
  // do not pull in any projections after the season has ended
  if (constants.season.now.isAfter(constants.season.end)) {
    log('Season has ended, skipping')
    return
  }

  const cookie = await pff.get_pff_session_cookie({
    executable_path
  })

  const seas_type = constants.season.nfl_seas_type === 'POST' ? 'POST' : 'REG'

  if (seas_type === 'POST') {
    const week = pff.get_pff_week()
    await runOne({ pff_week: week, cookie, dry: dry_run, seas_type: 'POST' })
  } else {
    for (
      let week = constants.season.week;
      week <= constants.season.nflFinalWeek;
      week++
    ) {
      await runOne({ pff_week: week, cookie, dry: dry_run, seas_type: 'REG' })
    }
  }
}

const main = async () => {
  let error
  try {
    await run({
      executable_path: argv.executable_path,
      dry_run: argv.dry
    })
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

if (is_main(import.meta.url)) {
  main()
}

export default run
