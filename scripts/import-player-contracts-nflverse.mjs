import debug from 'debug'
import fs from 'fs'
import os from 'os'
import { pipeline } from 'stream'
import { promisify } from 'util'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { asyncBufferFromFile, parquetRead } from 'hyparquet'
import dayjs from 'dayjs'

import db from '#db'
import { fixTeam } from '#libs-shared'
import { isMain, getPlayer, updatePlayer } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-player-contracts-nflverse')
debug.enable('import-player-contracts-nflverse,get-player,update-player')

const format_row = (row) => ({
  otc_id: row.otc_id,
  contract_year_signed: Number(row.year_signed) || null,
  contract_years: Number(row.years) || null,
  contract_value: Number(row.value) ? Number(row.value.toFixed(2)) : null,
  contract_apy: Number(row.apy) ? Number(row.apy.toFixed(2)) : null,
  contract_guaranteed: Number(row.guaranteed)
    ? Number(row.guaranteed.toFixed(2))
    : null,
  contract_apy_cap_pct: Number(row.apy_cap_pct)
    ? Number(row.apy_cap_pct.toFixed(3))
    : null,
  contract_inflated_value: Number(row.inflated_value)
    ? Number(row.inflated_value.toFixed(6))
    : null,
  contract_inflated_apy: Number(row.inflated_apy)
    ? Number(row.inflated_apy.toFixed(6))
    : null,
  contract_inflated_guaranteed: Number(row.inflated_guaranteed)
    ? Number(row.inflated_guaranteed.toFixed(6))
    : null
})

const format_contract_row = (row) => ({
  year: row.year,
  team: row.team === 'Total' ? null : fixTeam(row.team),
  base_salary: row.base_salary,
  prorated_bonus: row.prorated_bonus,
  roster_bonus: row.roster_bonus,
  guaranteed_salary: row.guaranteed_salary,
  cap_number: row.cap_number,
  cap_percent: row.cap_percent,
  cash_paid: row.cash_paid,
  workout_bonus: row.workout_bonus,
  other_bonus: row.other_bonus,
  per_game_roster_bonus: row.per_game_roster_bonus,
  option_bonus: row.option_bonus
})

const process_row = async ({ row }) => {
  let player_row
  try {
    player_row = await getPlayer({ otc_id: row.otc_id })
  } catch (error) {
    log(error)
  }

  if (!player_row) {
    try {
      player_row = await getPlayer({
        name: row.player,
        start: row.draft_year,
        dob: row.date_of_birth
          ? dayjs(row.date_of_birth, 'MMMM D, YYYY').format('YYYY-MM-DD')
          : null
      })
    } catch (error) {
      log(error)
    }
  }

  if (!player_row) {
    log(
      `player not found: ${row.player} ${row.draft_year} ${row.date_of_birth}`
    )
    return
  }

  const player_data = format_row(row)
  const changes = await updatePlayer({
    player_row,
    update: player_data
  })

  const player_contract_rows = row.cols.map((item) => ({
    ...format_contract_row(item),
    pid: player_row.pid
  }))

  await db('player_contracts')
    .insert(player_contract_rows)
    .onConflict(['year', 'pid'])
    .merge()

  return changes
}

const import_parquet_file = (parquet_file) =>
  new Promise((resolve, reject) => {
    parquetRead({
      file: parquet_file,
      rowFormat: 'object',
      onComplete: async (data) => {
        let total_changes = 0
        try {
          for (const row of data) {
            const changes = await process_row({ row })
            total_changes += changes
          }
          resolve(total_changes)
        } catch (error) {
          reject(error)
        }
      }
    })
  })

const import_player_contracts_nflverse = async ({ force_download = false }) => {
  const current_date = new Date().toISOString().split('T')[0]
  const file_name = `nflverse_nfldata_games_${current_date}.csv`
  const path = `${os.tmpdir()}/${file_name}`
  const url = `https://github.com/nflverse/nflverse-data/releases/download/contracts/historical_contracts.parquet`

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

  const parquet_file = await asyncBufferFromFile(path)
  const total_changes = await import_parquet_file(parquet_file)
  log(`updated: ${total_changes} player fields`)
}

const main = async () => {
  let error
  try {
    const { force_download } = argv
    await import_player_contracts_nflverse({ force_download })
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

export default import_player_contracts_nflverse
