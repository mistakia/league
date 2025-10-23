/**
 * Import NFL Player Contracts from NFLverse Data
 *
 * Downloads and processes historical NFL player contract data from nflverse-data repository.
 * Updates two tables:
 *   - player: Contract summary fields (year signed, total value, APY, etc.)
 *   - player_contracts: Year-by-year breakdown (salary, bonuses, cap hit, etc.)
 *
 * Data Source: https://github.com/nflverse/nflverse-data/releases/tag/contracts
 *
 * Features:
 *   - Efficient in-memory player caching (all 27K+ players)
 *   - Batch database operations for performance
 *   - No player changelog entries created
 *   - Handles both active and retired players
 *
 * Usage:
 *   node import-player-contracts-nflverse.mjs [--force_download]
 */

import debug from 'debug'
import fs from 'fs'
import os from 'os'
import { pipeline } from 'stream'
import { promisify } from 'util'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { asyncBufferFromFile, parquetRead } from 'hyparquet'

import db from '#db'
import { fixTeam } from '#libs-shared'
import {
  is_main,
  report_job,
  fetch_with_retry,
  batch_insert
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-player-contracts-nflverse')
debug.enable('import-player-contracts-nflverse,get-player,fetch')

// Constants
const NFLVERSE_CONTRACTS_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/contracts/historical_contracts.parquet'
const BATCH_SIZE = 500
const PLAYER_CACHE_OPTIONS = {
  all_players: true,
  include_otc_id_index: true,
  include_name_draft_index: true
}

// Player table fields that must be included in INSERT operations (NOT NULL constraints)
const REQUIRED_PLAYER_FIELDS = [
  'fname',
  'lname',
  'pname',
  'formatted',
  'pos',
  'pos1',
  'dob',
  'nfl_draft_year',
  'current_nfl_team'
]

// Contract fields to update in the player table
const CONTRACT_SUMMARY_FIELDS = [
  'otc_id',
  'contract_year_signed',
  'contract_years',
  'contract_value',
  'contract_apy',
  'contract_guaranteed',
  'contract_apy_cap_pct',
  'contract_inflated_value',
  'contract_inflated_apy',
  'contract_inflated_guaranteed'
]

// Helper Functions

/**
 * Formats a number to specified decimal places, returns null if falsy
 */
const format_number = (value, decimals = 2) =>
  Number(value) ? Number(Number(value).toFixed(decimals)) : null

/**
 * Deduplicates an array of items by a key function
 * Keeps only the last occurrence of each unique key
 */
const deduplicate_by_key = (items, get_key) => {
  const unique_map = new Map()
  for (const item of items) {
    const key = get_key(item)
    unique_map.set(key, item)
  }
  return Array.from(unique_map.values())
}

/**
 * Formats contract summary data for the player table
 * Contains high-level contract information (year signed, total value, etc.)
 */
const format_contract_summary = (row) => ({
  otc_id: row.otc_id,
  contract_year_signed: Number(row.year_signed) || null,
  contract_years: Number(row.years) || null,
  contract_value: format_number(row.value, 2),
  contract_apy: format_number(row.apy, 2),
  contract_guaranteed: format_number(row.guaranteed, 2),
  contract_apy_cap_pct: format_number(row.apy_cap_pct, 3),
  contract_inflated_value: format_number(row.inflated_value, 6),
  contract_inflated_apy: format_number(row.inflated_apy, 6),
  contract_inflated_guaranteed: format_number(row.inflated_guaranteed, 6)
})

/**
 * Formats yearly contract details for the player_contracts table
 * Contains year-by-year breakdown (salary, bonuses, cap hit, etc.)
 */
const format_yearly_contract_detail = (row) => ({
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

/**
 * Finds a player in the cache using contract data
 * Priority: OTC ID (most accurate) → Name + Draft Year (fallback)
 */
const find_player_from_contract_data = ({ row }) => {
  const player_lookup_options = {
    ignore_free_agent: false,
    ignore_retired: false
  }

  // Primary lookup: OTC ID (most accurate identifier)
  if (row.otc_id) {
    const player = find_player({
      otc_id: row.otc_id,
      ...player_lookup_options
    })
    if (player) return player
  }

  // Fallback lookup: Name + Draft Year
  if (row.player && row.draft_year) {
    const player = find_player({
      name: row.player,
      nfl_draft_year: row.draft_year,
      ...player_lookup_options
    })
    if (player) return player
  }

  log(`player not found: ${row.player} (${row.draft_year})`)
  return null
}

/**
 * Saves contract data to database in efficient batches
 * Updates player table with contract summaries and player_contracts table with yearly details
 */
const save_contract_data = async ({ player_updates, contract_rows }) => {
  // Update player table with contract summaries
  if (player_updates.length) {
    log(`saving ${player_updates.length} player contract summaries`)
    let processed = 0

    await batch_insert({
      items: player_updates,
      batch_size: BATCH_SIZE,
      save: async (batch) => {
        // Build updates with required fields + contract summary
        // INSERT ... ON CONFLICT ensures atomic upsert (always updates existing players)
        const updates = batch.map((item) => {
          const base_fields = {}
          REQUIRED_PLAYER_FIELDS.forEach((field) => {
            base_fields[field] = item[field]
          })
          return {
            pid: item.pid,
            ...base_fields,
            ...item.contract_summary
          }
        })

        await db('player')
          .insert(updates)
          .onConflict('pid')
          .merge(CONTRACT_SUMMARY_FIELDS)

        processed += batch.length
        log(
          `updated ${processed}/${player_updates.length} player contract summaries`
        )
      }
    })
  }

  // Insert/update player_contracts table with yearly details
  if (contract_rows.length) {
    log(`saving ${contract_rows.length} yearly contract details`)
    await batch_insert({
      items: contract_rows,
      batch_size: BATCH_SIZE,
      save: async (batch) => {
        await db('player_contracts')
          .insert(batch)
          .onConflict(['year', 'pid'])
          .merge()
      }
    })
  }
}

/**
 * Processes contract data from parquet file and saves to database
 */
const process_contract_data = (parquet_file) =>
  new Promise((resolve, reject) => {
    parquetRead({
      file: parquet_file,
      rowFormat: 'object',
      onComplete: async (data) => {
        try {
          const player_updates = []
          const contract_rows = []

          log(`processing ${data.length} contract records`)

          // Transform raw contract data into database format
          for (const row of data) {
            const player = find_player_from_contract_data({ row })
            if (!player) continue

            // Build player update with required fields + contract summary
            const update = {
              pid: player.pid,
              contract_summary: format_contract_summary(row)
            }
            REQUIRED_PLAYER_FIELDS.forEach((field) => {
              update[field] = player[field]
            })
            player_updates.push(update)

            // Add yearly contract details for player_contracts table
            if (row.cols?.length) {
              const yearly_details = row.cols.map((yearly_row) => ({
                ...format_yearly_contract_detail(yearly_row),
                pid: player.pid
              }))
              contract_rows.push(...yearly_details)
            }
          }

          log(
            `matched ${player_updates.length} players with ${contract_rows.length} yearly details`
          )

          // Deduplicate by pid (keep last occurrence for each player)
          const unique_player_updates = deduplicate_by_key(
            player_updates,
            (item) => item.pid
          )

          log(
            `deduped to ${unique_player_updates.length} unique players (${player_updates.length - unique_player_updates.length} duplicates removed)`
          )

          // Deduplicate by [year, pid] composite key (keep last occurrence)
          const unique_contract_rows = deduplicate_by_key(
            contract_rows,
            (row) => `${row.year}-${row.pid}`
          )

          log(
            `deduped to ${unique_contract_rows.length} unique contract rows (${contract_rows.length - unique_contract_rows.length} duplicates removed)`
          )

          // Save all data to database
          await save_contract_data({
            player_updates: unique_player_updates,
            contract_rows: unique_contract_rows
          })

          resolve(unique_player_updates.length)
        } catch (error) {
          reject(error)
        }
      }
    })
  })

/**
 * Downloads the contracts parquet file if needed
 * Returns the path to the local file
 */
const download_contracts_file = async ({ force_download = false }) => {
  const current_date = new Date().toISOString().split('T')[0]
  const file_name = `nflverse_contracts_${current_date}.parquet`
  const file_path = `${os.tmpdir()}/${file_name}`

  if (force_download || !fs.existsSync(file_path)) {
    log(`downloading contract data from NFLverse`)
    const stream_pipeline = promisify(pipeline)
    const response = await fetch_with_retry({ url: NFLVERSE_CONTRACTS_URL })

    if (!response.ok) {
      throw new Error(`download failed: ${response.statusText}`)
    }

    await stream_pipeline(response.body, fs.createWriteStream(file_path))
    log(`downloaded to ${file_path}`)
  } else {
    log(`using cached file: ${file_path}`)
  }

  return file_path
}

/**
 * Main import function - downloads and processes NFL player contracts
 * Updates both player table (contract summaries) and player_contracts table (yearly details)
 */
const import_player_contracts_nflverse = async ({ force_download = false }) => {
  // Download contract data file
  const file_path = await download_contracts_file({ force_download })

  // Initialize player cache with all players and contract-specific indexes
  log('initializing player cache')
  await preload_active_players(PLAYER_CACHE_OPTIONS)

  // Process contract data and save to database
  const parquet_file = await asyncBufferFromFile(file_path)
  const players_updated = await process_contract_data(parquet_file)

  log(`successfully updated contracts for ${players_updated} players`)
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

  await report_job({
    job_type: job_types.IMPORT_PLAYER_CONTRACTS_NFLVERSE,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_player_contracts_nflverse
