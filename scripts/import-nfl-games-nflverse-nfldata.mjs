import fs from 'fs'
import os from 'os'
import { pipeline } from 'stream'
import { promisify } from 'util'
import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { fixTeam } from '#libs-shared'
import {
  is_main,
  readCSV,
  update_nfl_game,
  getPlayer,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-nfl-games-nflverse')
debug.enable('import-nfl-games-nflverse,update-nfl-game,get-player')

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

const format_game = (game) => ({
  nflverse_game_id: game.game_id,
  // esbid: game.old_game_id,
  gsisid: format_number(game.gsis),
  pfr_game_id: game.pfr,
  pff_game_id: game.pff,
  espn_game_id: game.espn,
  ftn_game_id: game.ftn,

  // total: game.total,
  // year: game.season,
  // seas_type: game.game_type,
  // week: game.week

  away_rest: format_number(game.away_rest),
  home_rest: format_number(game.home_rest),
  away_moneyline: format_number(game.away_moneyline),
  home_moneyline: format_number(game.home_moneyline),

  spread_line: format_number(game.spread_line),
  total_line: format_number(game.total_line),

  roof: game.roof || null,
  surf: game.surface || null,
  temp: format_number(game.temp),
  wind: format_number(game.wind),

  stad: game.stadium || null,

  away_coach: game.away_coach || null,
  home_coach: game.home_coach || null,

  referee: game.referee || null
})

const import_nfl_games_nflverse_nfldata = async ({
  force_import = false,
  force_download = false
} = {}) => {
  const current_date = new Date().toISOString().split('T')[0]
  const file_name = `nflverse_nfldata_games_${current_date}.csv`
  const path = `${os.tmpdir()}/${file_name}`
  const url = 'https://github.com/nflverse/nfldata/raw/master/data/games.csv'

  if (force_download || !fs.existsSync(path)) {
    log(`downloading ${url}`)
    const stream_pipeline = promisify(pipeline)
    const response = await fetch(url)
    if (!response.ok)
      throw new Error(`unexpected response ${response.statusText}`)

    await stream_pipeline(response.body, fs.createWriteStream(`${path}`))
  } else {
    log(`file exists: ${path}`)
  }

  const game_not_matched = []
  const data = await readCSV(path, {
    mapValues: ({ header, index, value }) => (value === 'NA' ? null : value)
  })

  for (const item of data) {
    let db_game = await db('nfl_games')
      .where({
        year: item.season,
        week: item.week,
        seas_type: item.game_type,
        v: fixTeam(item.away_team),
        h: fixTeam(item.home_team),
        esbid: item.old_game_id
      })
      .first()

    if (!db_game) {
      db_game = await db('nfl_games')
        .where({
          year: item.season,
          week: item.week,
          seas_type: item.game_type,
          v: fixTeam(item.away_team),
          h: fixTeam(item.home_team)
        })
        .first()
    }

    if (!db_game) {
      db_game = await db('nfl_games').where({ esbid: item.old_game_id }).first()
    }

    if (db_game) {
      const game = format_game(item)

      if (item.away_qb_id) {
        const away_qb_player = await getPlayer({ gsisid: item.away_qb_id })

        if (away_qb_player) {
          game.away_qb_pid = away_qb_player.pid
        } else {
          log(`away_qb_player not found: ${item.away_qb_id}`)
        }
      }

      if (item.home_qb_id) {
        const home_qb_player = await getPlayer({ gsisid: item.home_qb_id })

        if (home_qb_player) {
          game.home_qb_pid = home_qb_player.pid
        } else {
          log(`home_qb_player not found: ${item.home_qb_id}`)
        }
      }

      await update_nfl_game({
        game_row: db_game,
        update: game,
        ignore_conflicts: force_import
      })
    } else {
      log(`game not matched: ${item.old_game_id} - ${item.game_id}`)
      game_not_matched.push(item)
    }
  }

  log(`${game_not_matched.length} games not matched`)
}

const main = async () => {
  let error
  try {
    const force_import = argv.force
    const force_download = argv.d
    await import_nfl_games_nflverse_nfldata({ force_import, force_download })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_GAMES_NFLVERSE,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_nfl_games_nflverse_nfldata
