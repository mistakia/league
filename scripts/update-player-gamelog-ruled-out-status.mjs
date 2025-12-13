/**
 * Update Player Gamelog Ruled Out Status
 *
 * This script identifies players who were active for a game but were ruled "OUT"
 * due to in-game injuries and updates their gamelog accordingly.
 *
 * Process Overview:
 * 1. Load games for the specified week/year
 * 2. For each game, find players with active=true in their gamelog
 * 3. Check if player was ruled OUT in players_status table after game time
 * 4. Update ruled_out_in_game flag for matching players
 *
 * Detection Logic:
 * - Player must have active=true (suited up for the game)
 * - Player must have game_designation='OUT' in players_status
 * - Status timestamp must be within 24 hours after game time
 * - This catches players who left games early due to injury
 * - Note: 24-hour window prevents false positives from new injuries days later
 *
 * Data Sources:
 * - player_gamelogs: Gamelog entries with active status
 * - players_status: Temporal injury status snapshots
 * - nfl_games: Game timing information
 *
 * Usage Examples:
 * - node scripts/update-player-gamelog-ruled-out-status.mjs (processes target week by default)
 * - node scripts/update-player-gamelog-ruled-out-status.mjs --year 2025 --week 11
 * - node scripts/update-player-gamelog-ruled-out-status.mjs --year 2025 --week 10 --dry
 * - node scripts/update-player-gamelog-ruled-out-status.mjs --all (process all weeks)
 *
 * Options:
 * --year <number>        Season year (default: current)
 * --week <number>        Week number (default: target week)
 * --seas_type <string>   Season type: PRE | REG | POST (default: REG)
 * --all                  Process all weeks for the season
 * --dry                  Dry run (no database writes)
 */

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import {
  is_main,
  report_job,
  handle_season_args_for_script
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { get_target_week } from '#libs-shared'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('update-player-gamelog-ruled-out-status')
debug.enable('update-player-gamelog-ruled-out-status')

// ----------------------------
// Helper Functions
// ----------------------------

/**
 * Calculate the Wednesday timestamp following a game
 * NFL week runs Tuesday-Monday, so Wednesday is 2 days after Monday
 *
 * @param {number} game_timestamp - Unix timestamp of game start
 * @returns {number} Unix timestamp of following Wednesday at 23:59:59
 */
const get_following_wednesday_timestamp = (game_timestamp) => {
  const game_date = new Date(game_timestamp * 1000)
  const game_day = game_date.getUTCDay() // 0=Sunday, 1=Monday, etc.

  // Calculate days until following Wednesday
  // If game is on Sunday (0), Wednesday is 3 days away
  // If game is on Monday (1), Wednesday is 2 days away
  // If game is on Thursday (4), following Wednesday is 6 days away
  let days_until_wednesday
  if (game_day === 0) {
    // Sunday
    days_until_wednesday = 3
  } else if (game_day === 1) {
    // Monday
    days_until_wednesday = 2
  } else if (game_day === 2) {
    // Tuesday
    days_until_wednesday = 1
  } else if (game_day === 3) {
    // Wednesday - use same day
    days_until_wednesday = 0
  } else {
    // Thursday-Saturday - go to next week's Wednesday
    days_until_wednesday = 10 - game_day // Thu=6, Fri=5, Sat=4
  }

  // Add days and set to end of Wednesday (23:59:59)
  const wednesday_date = new Date(game_date)
  wednesday_date.setUTCDate(game_date.getUTCDate() + days_until_wednesday)
  wednesday_date.setUTCHours(23, 59, 59, 999)

  return Math.floor(wednesday_date.getTime() / 1000)
}

/**
 * Load games for the specified parameters
 *
 * @param {Object} params
 * @param {number} params.year - Season year
 * @param {number} params.week - Week number
 * @param {string} params.seas_type - Season type (PRE, REG, POST)
 * @returns {Promise<Array>} Array of game objects
 */
const load_games = async ({ year, week, seas_type }) => {
  const query = db('nfl_games')
    .select('esbid', 'timestamp', 'week', 'h', 'v')
    .where({ year, seas_type })
    .whereNotNull('timestamp')

  if (week) {
    query.where({ week })
  }

  const games = await query.orderBy('week', 'asc')

  log(
    `Loaded ${games.length} games for ${year} ${seas_type} ${week ? `week ${week}` : 'all weeks'}`
  )

  return games
}

/**
 * Load active player gamelogs for specific games
 *
 * @param {Array<number>} esbids - Game IDs
 * @returns {Promise<Array>} Array of gamelog objects
 */
const load_active_gamelogs = async (esbids) => {
  const gamelogs = await db('player_gamelogs')
    .select('esbid', 'pid', 'active', 'ruled_out_in_game', 'snaps_off')
    .whereIn('esbid', esbids)
    .where('active', true)

  log(`Loaded ${gamelogs.length} active player gamelogs`)

  return gamelogs
}

/**
 * Find OUT status records within the detection window
 *
 * @param {Array<string>} pids - Player IDs
 * @param {number} start_timestamp - Window start (game time)
 * @param {number} end_timestamp - Window end (following Wednesday)
 * @returns {Promise<Array>} Array of status records with OUT designation
 */
const find_out_status_records = async ({
  pids,
  start_timestamp,
  end_timestamp
}) => {
  // Only look for OUT status within 24 hours after game
  // This prevents false positives from injuries that occur days later
  const one_day_after_game = start_timestamp + 86400 // 24 hours in seconds

  const status_records = await db('players_status')
    .select('pid', 'timestamp', 'game_designation', 'injury_body_part')
    .whereIn('pid', pids)
    .where('game_designation', 'OUT')
    .where('timestamp', '>=', start_timestamp)
    .where('timestamp', '<=', one_day_after_game) // Changed from end_timestamp
    .orderBy('timestamp', 'asc')

  return status_records
}

/**
 * Process a single game to identify ruled-out players
 *
 * @param {Object} game - Game object with esbid and timestamp
 * @param {Array} gamelogs - Active gamelogs for this game
 * @returns {Promise<Object>} Results object with updates and stats
 */
const process_game = async (game, gamelogs) => {
  const { esbid, timestamp: game_timestamp, week, h, v } = game

  if (!game_timestamp) {
    log(`Skipping game ${esbid} (week ${week} ${v}@${h}): no timestamp`)
    return { updates: [], skipped: true }
  }

  const following_wednesday = get_following_wednesday_timestamp(game_timestamp)
  const game_date = new Date(game_timestamp * 1000).toISOString().split('T')[0]
  const wednesday_date = new Date(following_wednesday * 1000)
    .toISOString()
    .split('T')[0]

  log(
    `Processing game ${esbid} (week ${week} ${v}@${h}) on ${game_date}, detection window until ${wednesday_date}`
  )

  // Get all player IDs from active gamelogs
  const pids = gamelogs.map((gl) => gl.pid)

  if (!pids.length) {
    log(`  No active players for game ${esbid}`)
    return { updates: [], no_players: true }
  }

  // Find OUT status records in detection window
  const out_status_records = await find_out_status_records({
    pids,
    start_timestamp: game_timestamp,
    end_timestamp: following_wednesday
  })

  if (!out_status_records.length) {
    log(`  No OUT status records found in detection window`)
    return { updates: [], no_out_status: true }
  }

  // Build map of pids with OUT status
  const out_status_by_pid = {}
  for (const record of out_status_records) {
    if (!out_status_by_pid[record.pid]) {
      out_status_by_pid[record.pid] = record
    }
  }

  log(
    `  Found ${Object.keys(out_status_by_pid).length} players with OUT status`
  )

  // Identify players to update
  const updates = []
  for (const gamelog of gamelogs) {
    const out_status = out_status_by_pid[gamelog.pid]

    if (out_status) {
      const status_date = new Date(out_status.timestamp * 1000)
        .toISOString()
        .split('T')[0]

      // Only update if not already set
      if (!gamelog.ruled_out_in_game) {
        updates.push({
          esbid: gamelog.esbid,
          pid: gamelog.pid,
          injury_body_part: out_status.injury_body_part,
          status_timestamp: out_status.timestamp,
          status_date,
          snaps_off: gamelog.snaps_off
        })

        log(
          `  Flagging ${gamelog.pid} as ruled out (status updated ${status_date}, injury: ${out_status.injury_body_part || 'unknown'}, snaps: ${gamelog.snaps_off || 0})`
        )
      } else {
        log(`  Skipping ${gamelog.pid} - already flagged as ruled out`)
      }
    }
  }

  return { updates, out_status_count: out_status_records.length }
}

/**
 * Apply updates to the database
 *
 * @param {Array} updates - Array of update objects
 * @param {boolean} dry_run - If true, skip actual database writes
 * @returns {Promise<number>} Number of records updated
 */
const apply_updates = async (updates, dry_run) => {
  if (!updates.length) {
    log('No updates to apply')
    return 0
  }

  if (dry_run) {
    log(`DRY RUN: Would update ${updates.length} gamelogs`)
    return 0
  }

  log(`Updating ${updates.length} gamelogs...`)

  // Update in batches for efficiency
  const batch_size = 100
  let total_updated = 0

  for (let i = 0; i < updates.length; i += batch_size) {
    const batch = updates.slice(i, i + batch_size)

    // Use case statement to update multiple rows in single query
    await db.transaction(async (trx) => {
      for (const update of batch) {
        await trx('player_gamelogs')
          .where({ esbid: update.esbid, pid: update.pid })
          .update({ ruled_out_in_game: true })
      }
    })

    total_updated += batch.length
    log(`  Updated ${total_updated}/${updates.length} gamelogs`)
  }

  log(`Successfully updated ${total_updated} gamelogs`)

  return total_updated
}

// ----------------------------
// Main Execution
// ----------------------------

const run = async ({
  year = current_season.year,
  week = null,
  seas_type = 'REG',
  dry_run = false
} = {}) => {
  // Default to target week when no week specified
  if (week === null) {
    week = get_target_week()
  }

  log(
    `Starting ruled out status detection for ${year} ${seas_type} week ${week} (dry_run: ${dry_run})`
  )

  // Load games
  const games = await load_games({ year, week, seas_type })

  if (!games.length) {
    log('No games found')
    return { total_updated: 0, games_processed: 0 }
  }

  // Load all active gamelogs for these games
  const esbids = games.map((g) => g.esbid)
  const all_gamelogs = await load_active_gamelogs(esbids)

  // Group gamelogs by game
  const gamelogs_by_game = {}
  for (const gamelog of all_gamelogs) {
    if (!gamelogs_by_game[gamelog.esbid]) {
      gamelogs_by_game[gamelog.esbid] = []
    }
    gamelogs_by_game[gamelog.esbid].push(gamelog)
  }

  // Process each game
  const all_updates = []
  let games_processed = 0
  let games_with_updates = 0

  for (const game of games) {
    const gamelogs = gamelogs_by_game[game.esbid] || []
    const result = await process_game(game, gamelogs)

    if (!result.skipped && !result.no_players) {
      games_processed++
    }

    if (result.updates && result.updates.length > 0) {
      all_updates.push(...result.updates)
      games_with_updates++
    }
  }

  // Apply all updates
  const total_updated = await apply_updates(all_updates, dry_run)

  // Summary
  log('')
  log('=== SUMMARY ===')
  log(`Games processed: ${games_processed}`)
  log(`Games with ruled-out players: ${games_with_updates}`)
  log(`Total players flagged: ${all_updates.length}`)
  log(`Database records updated: ${total_updated}`)

  if (dry_run) {
    log('')
    log('DRY RUN MODE - No changes were made to the database')
    log('Remove --dry flag to apply updates')
  }

  return {
    total_updated,
    games_processed,
    games_with_updates,
    players_flagged: all_updates.length
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await handle_season_args_for_script({
      argv,
      script_name: 'update-player-gamelog-ruled-out-status',
      script_function: run,
      script_args: {
        dry_run: argv.dry
      },
      default_week: get_target_week(), // Default to target week
      year_query: ({ seas_type = 'REG' }) =>
        db('nfl_games')
          .select('year')
          .where({ seas_type })
          .groupBy('year')
          .orderBy('year', 'asc'),
      week_query: ({ year, seas_type = 'REG' }) =>
        db('nfl_games')
          .select('week')
          .where({ year, seas_type })
          .groupBy('week')
          .orderBy('week', 'asc'),
      seas_type: argv.seas_type || 'REG'
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.UPDATE_PLAYER_GAMELOG_RULED_OUT_STATUS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
