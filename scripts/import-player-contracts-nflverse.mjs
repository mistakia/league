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
 *   - Bounded-memory parquet reads: only the columns this import consumes are
 *     read, and the nested season_history list is read one leaf at a time
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
import {
  asyncBufferFromFile,
  flatten,
  parquetMetadataAsync,
  parquetRead
} from 'hyparquet'
// Internal hyparquet modules, reached through its published ./src/*.js exports.
// The public parquetRead API cannot select a single leaf of a nested column,
// which this import needs in order to stay within its heap budget — see
// read_season_history_leaf below.
import { parquetPlan } from 'hyparquet/src/plan.js'
import { readRowGroup } from 'hyparquet/src/rowgroup.js'

import db from '#db'
import { fixTeam } from '#libs-shared'
import {
  is_main,
  report_job,
  fetch_with_retry,
  batch_insert,
  throw_if_shortfall
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  preload_active_players,
  find_player
} from '#libs-server/player-cache.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

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

// Nested list column holding the year-by-year contract breakdown.
//
// Schema regression, 2026-08-10: nflverse renamed this column from `cols` to
// `season_history`, added a parallel `contract_history` list this import does
// not use, and began emitting the cross product of each player's seasons and
// contracts — every season now repeats once per contract the player has ever
// signed, padding unpaired elements with nulls. Element count went from ~311K
// to ~3.2M and the file from ~6.7MB to ~20MB overnight, and both lists now
// carry identical counts. Reading the column the obvious way costs ~10GB of heap,
// which is what OOM'd this import, so the reader below is deliberately
// leaf-at-a-time and collapses the cross product before assembling records.
const SEASON_HISTORY_COLUMN = 'season_history'
const SEASON_HISTORY_FIELDS = [
  'year',
  'team',
  'base_salary',
  'prorated_bonus',
  'option_bonus',
  'roster_bonus',
  'guaranteed_salary',
  'cap_number',
  'cap_percent',
  'cash_paid',
  'workout_bonus',
  'per_game_roster_bonus',
  'other_bonus'
]

// Top-level scalar columns this import consumes. Everything else in the file —
// bio fields, player_page, and the `contract_history` list — is left unread.
const CONTRACT_SCALAR_COLUMNS = [
  'player',
  'draft_year',
  'otc_id',
  'year_signed',
  'years',
  'value',
  'apy',
  'guaranteed',
  'apy_cap_pct',
  'inflated_value',
  'inflated_apy',
  'inflated_guaranteed'
]

// Player table fields that must be included in INSERT operations (NOT NULL constraints)
const REQUIRED_PLAYER_FIELDS = [
  'first_name',
  'last_name',
  'short_name',
  'formatted_name',
  'primary_position',
  'secondary_position',
  'date_of_birth',
  'nfl_draft_year',
  'current_nfl_team'
]

// Contract fields to update in the player table
const CONTRACT_SUMMARY_FIELDS = [
  'otc_player_id',
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
  otc_player_id: row.otc_id,
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
  season_year: row.year,
  nfl_team: row.team === 'Total' ? null : fixTeam(row.team),
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
      otc_player_id: row.otc_id,
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
          .onConflict(['season_year', 'pid'])
          .merge()
      }
    })
  }
}

/**
 * Reads the top-level scalar contract columns, one object per parquet row
 */
const read_contract_scalars = async ({ file, metadata }) => {
  let rows = []
  await parquetRead({
    file,
    metadata,
    rowFormat: 'object',
    columns: CONTRACT_SCALAR_COLUMNS,
    onComplete: (data) => {
      rows = data
    }
  })
  return rows
}

/**
 * Collects the primitives inside one row's nested leaf value
 * Nulls are kept: they are real elements and dropping them would misalign
 * this leaf against the others.
 */
const collect_leaf_values = (value, output) => {
  if (Array.isArray(value)) {
    for (const item of value) collect_leaf_values(item, output)
  } else {
    output.push(value)
  }
  return output
}

/**
 * Flattens one row's nested season_history leaf value into its elements
 * A row with no list at all contributes no elements.
 */
const flatten_leaf_row = (row_value) =>
  row_value === null || row_value === undefined
    ? []
    : collect_leaf_values(row_value, [])

/**
 * Reads a single leaf column of the season_history list
 *
 * hyparquet's `columns` option filters by top-level name only, so asking for
 * `season_history` materializes all 13 leaves and every list element as a JS
 * object at once — about 10GB of heap on the current nflverse schema. Planning
 * the read here and handing readRowGroup one leaf chunk keeps a single column
 * in memory at a time instead.
 */
const read_season_history_leaf = async ({
  file,
  metadata,
  plan,
  group_plan,
  field
}) => {
  const path_in_schema = [SEASON_HISTORY_COLUMN, 'list', 'element', field].join(
    '.'
  )
  const chunks = group_plan.chunks.filter(
    (chunk) => chunk.columnMetadata.path_in_schema.join('.') === path_in_schema
  )
  if (chunks.length !== 1) {
    throw new Error(
      `expected one parquet column chunk for ${path_in_schema}, found ${chunks.length}`
    )
  }

  const { asyncColumns } = readRowGroup({ file, metadata }, plan, {
    ...group_plan,
    chunks
  })
  const { data } = await asyncColumns[0].data
  return flatten(data)
}

/**
 * Reads season_history into one detail record per (parquet row, season year)
 *
 * Each record carries its parquet row index so the caller can join it to that
 * row's scalar contract fields. Within a row the last element for a given year
 * wins, which collapses the upstream season x contract cross product without
 * changing the last-wins dedup applied globally further down.
 */
const read_season_history_details = async ({ file, metadata }) => {
  const plan = parquetPlan({ metadata, columns: [SEASON_HISTORY_COLUMN] })
  const details = []

  for (const group_plan of plan.groups) {
    const read_leaf = (field) =>
      read_season_history_leaf({ file, metadata, plan, group_plan, field })

    // `year` is read first: it establishes the list boundaries and selects
    // which elements survive, so every other leaf only needs those positions.
    const group_start = details.length
    const selected_indexes = []
    const year_rows = await read_leaf('year')
    let element_index = 0

    for (let row = 0; row < year_rows.length; row++) {
      const years = flatten_leaf_row(year_rows[row])
      const last_index_by_year = new Map()
      for (let i = 0; i < years.length; i++) {
        // The cross product pads each row out to seasons x contracts, so
        // unpaired elements carry a null year. They cannot become a
        // player_contracts row — season_year is NOT NULL — and had no
        // equivalent under the old schema, so they are dropped here.
        if (years[i] === null || years[i] === undefined || years[i] === '') {
          continue
        }
        last_index_by_year.set(years[i], element_index + i)
      }

      const picks = Array.from(last_index_by_year.values()).sort(
        (a, b) => a - b
      )
      for (const index of picks) {
        selected_indexes.push(index)
        details.push({
          row_index: group_plan.groupStart + row,
          detail: { year: years[index - element_index] }
        })
      }
      element_index += years.length
    }

    for (const field of SEASON_HISTORY_FIELDS) {
      if (field === 'year') continue

      const leaf_rows = await read_leaf(field)
      let cursor = 0
      let index = 0
      for (
        let row = 0;
        row < leaf_rows.length && cursor < selected_indexes.length;
        row++
      ) {
        for (const value of flatten_leaf_row(leaf_rows[row])) {
          if (selected_indexes[cursor] === index) {
            details[group_start + cursor].detail[field] = value
            cursor++
          }
          index++
        }
      }

      if (cursor !== selected_indexes.length) {
        throw new Error(
          `season_history leaf ${field} yielded ${cursor} of ${selected_indexes.length} selected elements`
        )
      }
    }
  }

  return details
}

/**
 * Processes contract data from parquet file and saves to database
 */
const process_contract_data = async (parquet_file) => {
  const metadata = await parquetMetadataAsync(parquet_file)
  const contract_records = await read_contract_scalars({
    file: parquet_file,
    metadata
  })

  log(`processing ${contract_records.length} contract records`)

  // Resolve each parquet row to a player before reading the yearly details, so
  // details belonging to unmatched players can be dropped without formatting
  const player_updates = []
  const pid_by_row_index = new Array(contract_records.length).fill(null)

  for (let row_index = 0; row_index < contract_records.length; row_index++) {
    const row = contract_records[row_index]
    const player = find_player_from_contract_data({ row })
    if (!player) continue

    pid_by_row_index[row_index] = player.pid

    // Build player update with required fields + contract summary
    const update = {
      pid: player.pid,
      contract_summary: format_contract_summary(row)
    }
    REQUIRED_PLAYER_FIELDS.forEach((field) => {
      update[field] = player[field]
    })
    player_updates.push(update)
  }

  const season_history_details = await read_season_history_details({
    file: parquet_file,
    metadata
  })

  const contract_rows = []
  for (const { row_index, detail } of season_history_details) {
    const pid = pid_by_row_index[row_index]
    if (!pid) continue
    contract_rows.push({ ...format_yearly_contract_detail(detail), pid })
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

  // Deduplicate by [season_year, pid] composite key (keep last occurrence)
  const unique_contract_rows = deduplicate_by_key(
    contract_rows,
    (row) => `${row.season_year}-${row.pid}`
  )

  log(
    `deduped to ${unique_contract_rows.length} unique contract rows (${contract_rows.length - unique_contract_rows.length} duplicates removed)`
  )

  // Save all data to database
  await save_contract_data({
    player_updates: unique_player_updates,
    contract_rows: unique_contract_rows
  })

  return {
    players_updated: unique_player_updates.length,
    contract_rows_saved: unique_contract_rows.length
  }
}

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
    // use_proxy: false -- public GitHub release asset, not a vendor scrape target.
    const response = await fetch_with_retry({
      url: NFLVERSE_CONTRACTS_URL,
      use_proxy: false
    })

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
  const { players_updated, contract_rows_saved } =
    await process_contract_data(parquet_file)

  log(
    `successfully updated contracts for ${players_updated} players with ${contract_rows_saved} yearly rows`
  )

  // Freshness oracle: after running, player_contracts row count must meet a
  // minimum floor. A count below the floor means the upstream fetch returned
  // empty or all rows were filtered out — silent partial-success.
  const min_contract_rows = 50000
  const count_row = await db('player_contracts').count('* as cnt').first()
  const contract_row_count = Number(count_row?.cnt ?? 0)
  if (contract_row_count < min_contract_rows) {
    return {
      shortfall: `player_contracts row count ${contract_row_count} is below floor ${min_contract_rows} after run`
    }
  }
  return { shortfall: null }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const { force_download } = argv
    const result = await import_player_contracts_nflverse({ force_download })
    throw_if_shortfall(result?.shortfall)
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
