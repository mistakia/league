import fs from 'fs'
import os from 'os'
import { pipeline } from 'stream'
import { promisify } from 'util'
import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import dayjs from 'dayjs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import {
  is_main,
  readCSV,
  getPlay,
  update_play,
  format_starting_hash,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-ftn-charting-plays')
debug.enable('import-ftn-charting-plays,update-play')

const format_number = (num) => {
  if (num === null || num === undefined || num === '') {
    return null
  }

  const n = Number(num)

  if (Number.isNaN(n)) {
    return null
  }

  if (Number.isInteger(n)) {
    return n
  }

  return Number(n.toFixed(12))
}

const format_boolean = (value) => {
  if (value === 'TRUE') return true
  if (value === 'FALSE') return false
  return null
}

const format_qb_position = (value) => {
  value = value.toUpperCase()
  switch (value) {
    case 'U':
      return 'UNDER_CENTER'
    case 'S':
      return 'SHOTGUN'
    case 'P':
      return 'PISTOL'
    default:
      return null
  }
}

const format_read_thrown = (value) => {
  if (!value || value === '0') {
    return null
  }

  switch (value.toUpperCase()) {
    case '1':
      return 'FIRST'
    case '2':
      return 'SECOND'
    case 'CHK':
      return 'CHECKDOWN'
    case 'DES':
      return 'DESIGNED'
    case 'SD':
      return 'SCRAMBLE_DRILL'
    default:
      return null
  }
}

const format_play = (play) => ({
  ftn_play_id: format_number(play.ftn_play_id),
  starting_hash: format_starting_hash(play.starting_hash) || null,
  qb_position: format_qb_position(play.qb_location) || null,
  n_offense_backfield: format_number(play.n_offense_backfield) || null,
  no_huddle: format_boolean(play.is_no_huddle),
  motion: format_boolean(play.is_motion),
  play_action: format_boolean(play.is_play_action),
  screen_pass: format_boolean(play.is_screen_pass),
  run_play_option: format_boolean(play.is_rpo),
  trick_play: format_boolean(play.is_trick_play),
  out_of_pocket_pass: format_boolean(play.is_qb_out_of_pocket),
  int_worthy: format_boolean(play.is_interception_worthy),
  throw_away: format_boolean(play.is_throw_away),
  read_thrown: format_read_thrown(play.read_thrown) || null,
  catchable_ball: format_boolean(play.is_catchable_ball),
  contested_ball: format_boolean(play.is_contested_ball),
  created_reception: format_boolean(play.is_created_reception),
  dropped_pass: format_boolean(play.is_drop),
  qb_sneak: format_boolean(play.is_qb_sneak),
  blitzers: format_number(play.n_blitzers) || null,
  pass_rushers: format_number(play.n_pass_rushers) || null,
  qb_fault_sack: format_boolean(play.is_qb_fault_sack)
})

const run = async ({
  year = constants.season.year,
  force_import = false,
  force_download = false
} = {}) => {
  if (year < 2022) {
    throw new Error('FTN Charting data is only available from 2022 onwards')
  }

  if (year === constants.season.year && !constants.season.week) {
    throw new Error('Season has not started yet')
  }

  if (year === constants.season.year && constants.season.week === 1) {
    const current_day = dayjs().day()
    if (current_day < 5 && current_day > 1) {
      // 5 is Friday
      throw new Error('Week 1 data is not available until Friday')
    }
  }

  const filename = `ftn_charting_${year}.csv`
  const path = `${os.tmpdir()}/${filename}`
  const url = `https://github.com/nflverse/nflverse-data/releases/download/ftn_charting/${filename}`

  if (force_download || !fs.existsSync(path)) {
    log(`downloading ${url}`)
    const streamPipeline = promisify(pipeline)
    const response = await fetch(url)
    if (!response.ok)
      throw new Error(`unexpected response ${response.statusText}`)

    await streamPipeline(response.body, fs.createWriteStream(`${path}`))
  } else {
    log(`file exists: ${path}`)
  }

  const play_not_matched = []
  const data = await readCSV(path, {
    mapValues: ({ header, index, value }) => (value === 'NA' ? null : value)
  })

  for (const item of data) {
    // Get the esbid from nfl_games table
    const game = await db('nfl_games')
      .where({ nflverse_game_id: item.nflverse_game_id })
      .first('esbid')

    if (!game) {
      log(`Game not found for nflverse_game_id: ${item.nflverse_game_id}`)
      play_not_matched.push(item)
      continue
    }

    const opts = {
      esbid: game.esbid,
      playId: Number(item.nflverse_play_id)
    }
    const db_play = await getPlay(opts)

    if (db_play) {
      const play = format_play(item)
      await update_play({
        play_row: db_play,
        update: play,
        ignore_conflicts: force_import
      })
    } else {
      log(`${item.nflverse_game_id} - ${item.nflverse_play_id}`)
      log(opts)
      play_not_matched.push(item)
    }
  }

  log(`${play_not_matched.length} plays not matched`)
}

const main = async () => {
  let error
  try {
    const year = argv.year || constants.season.year
    const force_import = argv.force
    const force_download = argv.d
    await run({ year, force_import, force_download })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_PLAYS_FTN_CHARTING,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
