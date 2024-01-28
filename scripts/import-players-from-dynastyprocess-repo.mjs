import debug from 'debug'
import fs from 'fs'
import os from 'os'
import { pipeline } from 'stream'
import { promisify } from 'util'
import fetch from 'node-fetch'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, formatPlayerName } from '#libs-shared'
import {
  isMain,
  readCSV,
  updatePlayer,
  createPlayer,
  nicknames
} from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-players-from-dynastyprocess')
debug.enable('import-players-from-dynastyprocess,update-player,create-player')

const format_row = ({
  mfl_id,
  sportradar_id,
  fantasypros_id,
  gsis_id,
  pff_id,
  sleeper_id,
  nfl_id,
  espn_id,
  yahoo_id,
  fleaflicker_id,
  cbs_id,
  pfr_id,
  cfbref_id,
  rotowire_id,
  rotoworld_id,
  ktc_id,
  stats_id,
  stats_global_id,
  fantasy_data_id,
  swish_id,
  name,
  merge_name,
  position,
  team,
  birthdate,
  draft_year,
  draft_round,
  draft_pick,
  draft_ovr,
  twitter_username,
  height,
  weight,
  college,
  db_season
}) => ({
  mfl_id,
  sportradar_id,
  fantasypros_id,
  gsisid: gsis_id,
  pff_id,
  sleeper_id,
  nflId: nfl_id,
  espn_id,
  yahoo_id,
  fleaflicker_id,
  cbs_id,
  pfr_id,
  cfbref_id,
  rotowire_id,
  rotoworld_id,
  keeptradecut_id: ktc_id,
  statsperform_id: stats_id,
  statsperform_global_id: stats_global_id,
  fantasy_data_id,
  swish_id,
  name,
  position,
  dob: birthdate,
  start: draft_year,
  round: draft_round,
  dpos: draft_ovr,
  twitter_username,
  height,
  weight,
  col: college
})

// cycle through various ids and find the player
const find_player = async (formatted_player_row) => {
  const player_id_types = [
    'gsisid',
    'espn_id',
    'sleeper_id',
    'keeptradecut_id',
    'mfl_id',
    'sportradar_id',
    'fantasypros_id',
    'pff_id',
    'nflId',
    'yahoo_id',
    'fleaflicker_id',
    'cbs_id',
    'pfr_id',
    'cfbref_id',
    'rotowire_id',
    'rotoworld_id',
    'statsperform_id',
    'statsperform_global_id',
    'fantasy_data_id',
    'swish_id'
  ]
  let player

  for (const player_id_type of player_id_types) {
    const player_id = formatted_player_row[player_id_type]
    if (!player_id) continue

    player = await db('player')
      .where({ [player_id_type]: player_id })
      .first()
    if (player) break
  }

  return player
}

const import_players_from_dynastyprocess = async ({
  force_download = false,
  dry_run = false
}) => {
  await nicknames.load()
  log('loaded nicknames')

  const current_date = new Date().toISOString().split('T')[0]
  const file_name = `dynastyprocess_db_playerids_${current_date}.csv`
  const path = `${os.tmpdir()}/${file_name}`
  const url =
    'https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv'

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

  log(`reading ${path}`)

  const data = await readCSV(path, {
    mapValues: ({ header, index, value }) => (value === 'NA' ? null : value)
  })

  // format data
  const formatted_data = data.map(format_row)

  log(`found ${formatted_data.length} players`)

  for (const row of formatted_data) {
    const player = await find_player(row)

    // if player does not exist, create player
    if (!player) {
      // log(`player does not exist: ${row.name}`)
      if (!dry_run) {
        const data = {
          fname: row.name.split(' ')[0],
          lname: row.name.substring(row.name.indexOf(' ') + 1),
          pos: row.position,
          pos1: row.position
        }

        delete row.name
        delete row.position

        await createPlayer({
          ...data,
          ...row
        })
      }

      continue
    }

    // check if first names are nicknames
    const first_name = row.name.split(' ')[0]
    const first_name_matches = first_name === player.fname

    // if first name does not match, check if it is a nickname
    const first_name_is_nickname = !first_name_matches
      ? nicknames.check(first_name, player.fname)
      : false

    // check if formatted names match, use same first name if first name is a nickname
    const formatted_name = formatPlayerName(
      first_name_is_nickname
        ? `${player.fname} ${row.name.split(' ').slice(1).join(' ')}`
        : row.name
    )
    if (player.formatted !== formatted_name) {
      log({ player, row })
      log(
        `formatted names do not match, current: ${player.formatted}, new: ${formatted_name} (${player.pid}, is_nickname: ${first_name_is_nickname}, first_name_matches: ${first_name_matches})`
      )
      continue
    }

    // if player exists, update player
    if (!dry_run) {
      delete row.name
      delete row.position
      delete row.height
      delete row.weight
      delete row.start

      await updatePlayer({
        player_row: player,
        update: row
      })
    }
  }
}

const main = async () => {
  let error
  try {
    await import_players_from_dynastyprocess({
      force_download: argv.force_download,
      dry_run: argv.dry_run
    })
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: constants.jobs.EXAMPLE,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default import_players_from_dynastyprocess
