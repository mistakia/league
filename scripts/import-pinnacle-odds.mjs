import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs-extra'
import dayjs from 'dayjs'
import oddslib from 'oddslib'

import db from '#db'
import { constants, fixTeam } from '#libs-shared'
import {
  is_main,
  pinnacle,
  insert_prop_markets,
  wait,
  report_job
} from '#libs-server'
import {
  find_player,
  preload_active_players
} from '#libs-server/player-cache.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

// Constants
const CONCURRENCY_LIMIT = 10
const BATCH_WAIT_TIME = 5000
const DEBUG_MODULES =
  'import-pinnacle-odds,pinnacle,get-player,insert-prop-market,insert-prop-market-selections'

// Command line arguments
const argv = yargs(hideBin(process.argv))
  .option('dry', {
    describe: 'Dry run - do not insert to database',
    type: 'boolean',
    default: false
  })
  .option('ignore-cache', {
    describe: 'Ignore cache and fetch fresh data',
    type: 'boolean',
    default: false
  })
  .option('ignore-wait', {
    describe: 'Ignore wait time between requests',
    type: 'boolean',
    default: false
  })
  .option('save', {
    describe: 'Save JSON files to tmp directory',
    type: 'boolean',
    default: false
  })
  .help('h')
  .alias('h', 'help').argv

const log = debug('import-pinnacle-odds')
debug.enable(DEBUG_MODULES)

/**
 * Formats the source event name based on matchup type
 * @param {Object} params - Event name parameters
 * @returns {string|null} Formatted event name
 */
const format_source_event_name = ({
  is_valid_matchup,
  away_team,
  home_team,
  pinnacle_matchup,
  pinnacle_matchup_special_category,
  pinnacle_matchup_special_description
}) => {
  if (is_valid_matchup) {
    return `${away_team} @ ${home_team}`
  }
  if (pinnacle_matchup.special) {
    return `${pinnacle_matchup_special_category} - ${pinnacle_matchup_special_description}`
  }
  return null
}

/**
 * Extracts team information from pinnacle matchup participants
 * @param {Object} pinnacle_matchup - The pinnacle matchup data
 * @returns {Object} Team information
 */
const extract_team_info = (pinnacle_matchup) => {
  const participants = pinnacle_matchup.participants || []
  const home_team = participants.find((p) => p.alignment === 'home')?.name
  const away_team = participants.find((p) => p.alignment === 'away')?.name

  const is_valid_matchup =
    pinnacle_matchup.type === 'matchup' && home_team && away_team
  const teams = is_valid_matchup ? [fixTeam(home_team), fixTeam(away_team)] : []

  return {
    home_team,
    away_team,
    is_valid_matchup,
    teams
  }
}

/**
 * Finds the corresponding NFL game for a matchup
 * @param {Object} team_info - Team information
 * @param {Object} pinnacle_matchup - Pinnacle matchup data
 * @param {Array} nfl_games - Available NFL games
 * @returns {Object|null} Matching NFL game or null
 */
const find_nfl_game = (team_info, pinnacle_matchup, nfl_games) => {
  if (!team_info.home_team || !team_info.away_team) {
    return null
  }

  const { week, seas_type } = constants.season.calculate_week(
    dayjs(pinnacle_matchup.startTime)
  )

  return nfl_games.find(
    (game) =>
      game.week === week &&
      game.seas_type === seas_type &&
      game.year === constants.season.year &&
      game.v === fixTeam(team_info.away_team) &&
      game.h === fixTeam(team_info.home_team)
  )
}

/**
 * Attempts to find a player from the special description or participant name
 * @param {Object} params - Player lookup parameters
 * @returns {Object|null} Player data or null
 */
const find_player_from_market = ({
  special_category,
  special_description,
  participant_name,
  teams
}) => {
  // Try to find player from special description first
  if (special_category === 'Player Props' && special_description) {
    const player_name = special_description.split('(')[0].trim()
    return try_find_player(player_name, teams)
  }

  // Try to find player from participant name
  if (participant_name) {
    const clean_name = participant_name.replace(/^(yes|no|over|under)$/i, '')
    const has_letters = /[a-zA-Z]/.test(clean_name)

    if (has_letters) {
      return try_find_player(clean_name, teams)
    }
  }

  return null
}

/**
 * Helper function to safely attempt player lookup
 * @param {string} player_name - Name to search for
 * @param {Array} teams - Teams to search within
 * @returns {Object|null} Player data or null
 */
const try_find_player = (player_name, teams) => {
  try {
    return find_player({
      name: player_name,
      teams,
      ignore_free_agent: true,
      ignore_retired: true
    })
  } catch (err) {
    log(err)
    return null
  }
}

/**
 * Finds participant by ID or alignment based on matchup type
 * @param {Object} params - Participant lookup parameters
 * @returns {string|null} Participant name or null
 */
const find_participant_name = ({ pinnacle_matchup, participant_id }) => {
  const participants = pinnacle_matchup.participants || []

  if (pinnacle_matchup.type === 'matchup') {
    // For matchup markets, match by alignment
    const participant = participants.find((p) => p.alignment === participant_id)
    return participant?.name || null
  } else {
    // For special markets, match by participant ID
    const participant = participants.find((p) => p.id === participant_id)
    return participant?.name || null
  }
}

/**
 * Determines the selection PID based on market type and participant
 * @param {Object} params - Selection PID parameters
 * @returns {string|null} Selection PID or null
 */
const determine_selection_pid = ({
  pinnacle_matchup,
  participant_name,
  player_row
}) => {
  // For team-based game markets, use team abbreviation
  if (pinnacle_matchup.type === 'matchup' && participant_name) {
    try {
      return fixTeam(participant_name)
    } catch (err) {
      log(`Failed to convert team name to abbreviation: ${participant_name}`)
      return null
    }
  }

  // For player props, use player PID
  return player_row?.pid || null
}

/**
 * Processes market selection odds and creates selection objects
 * @param {Object} params - Selection processing parameters
 * @returns {Array} Array of selection objects
 */
const process_market_selections = ({
  market_selection_odds,
  pinnacle_matchup,
  team_info,
  player_row
}) => {
  return market_selection_odds.map((selection) => {
    const participant_name = find_participant_name({
      pinnacle_matchup,
      participant_id: selection.participantId
    })

    const selection_pid = determine_selection_pid({
      pinnacle_matchup,
      participant_name,
      player_row
    })

    return {
      source_id: 'PINNACLE',
      source_market_id: `${pinnacle_matchup.id}/${pinnacle_matchup.pinnacle_odds_key}`,
      source_selection_id: selection.participantId,
      selection_pid,
      selection_name: participant_name,
      selection_metric_line: selection.points,
      selection_type: pinnacle.format_selection_type(participant_name),
      odds_decimal: oddslib.from('moneyline', selection.price).to('decimal'),
      odds_american: selection.price
    }
  })
}

/**
 * Processes market odds and formats them for database insertion
 * @param {Object} params - Market processing parameters
 * @returns {Array} Array of formatted markets
 */
const process_market_odds = async (
  pinnacle_matchup,
  pinnacle_markets,
  timestamp,
  nfl_games,
  unmatched_markets,
  unmatched_combinations
) => {
  const formatted_markets = []

  for (const odds_data of pinnacle_markets) {
    // Convert odds structure to match expected format
    const market_selection_odds = odds_data.prices.map((price) => ({
      participantId: price.participantId || price.designation,
      price: price.price,
      points: price.points || null
    }))

    // Create market with odds metadata
    const extended_pinnacle_matchup = {
      ...pinnacle_matchup,
      pinnacle_odds_type: odds_data.type,
      pinnacle_odds_key: odds_data.key,
      is_alternate_pinnacle_market: odds_data.isAlternate || false
    }

    const formatted_market = await format_market({
      pinnacle_matchup: extended_pinnacle_matchup,
      market_selection_odds,
      timestamp,
      nfl_games,
      unmatched_markets,
      unmatched_combinations
    })

    formatted_markets.push(formatted_market)
  }

  return formatted_markets
}

/**
 * Tracks unmatched markets for reporting
 * @param {Object} params - Unmatched market tracking parameters
 */
const track_unmatched_market = ({
  pinnacle_matchup,
  source_market_id,
  unmatched_markets,
  unmatched_combinations
}) => {
  const special_description = pinnacle_matchup.special?.description
  const special_category = pinnacle_matchup.special?.category

  const combination_key = `${pinnacle_matchup.type}/${special_category}/${special_description}/${pinnacle_matchup.pinnacle_odds_type}/${pinnacle_matchup.units}/${pinnacle_matchup.is_alternate_pinnacle_market}`

  unmatched_markets.add(source_market_id)

  if (!unmatched_combinations.has(combination_key)) {
    unmatched_combinations.set(combination_key, {
      matchup_type: pinnacle_matchup.type,
      special_category,
      special_description,
      odds_type: pinnacle_matchup.pinnacle_odds_type,
      units: pinnacle_matchup.units,
      is_alternate: pinnacle_matchup.is_alternate_pinnacle_market,
      count: 0
    })
  }
  unmatched_combinations.get(combination_key).count++
}

/**
 * Formats a single market for database insertion
 * @param {Object} params - Market formatting parameters
 * @returns {Object} Formatted market object
 */
const format_market = async ({
  pinnacle_matchup,
  market_selection_odds,
  timestamp,
  nfl_games = [],
  unmatched_markets,
  unmatched_combinations
}) => {
  const source_market_id = `${pinnacle_matchup.id}/${pinnacle_matchup.pinnacle_odds_key}`

  // Extract team information
  const team_info = extract_team_info(pinnacle_matchup)

  // Find corresponding NFL game
  const nfl_game = find_nfl_game(team_info, pinnacle_matchup, nfl_games)

  // Extract special market information
  const special_description = pinnacle_matchup.special?.description
  const special_category = pinnacle_matchup.special?.category

  // Find player if this is a player prop market
  const player_row = find_player_from_market({
    special_category,
    special_description,
    participant_name: null, // Will be set per selection
    teams: team_info.teams
  })

  // Process market selections
  const selections = process_market_selections({
    market_selection_odds,
    pinnacle_matchup,
    team_info,
    player_row
  })

  // Determine market type
  const market_type = pinnacle.get_market_type({
    is_alternate_pinnacle_market: pinnacle_matchup.is_alternate_pinnacle_market,
    pinnacle_matchup_type: pinnacle_matchup.type,
    pinnacle_matchup_units: pinnacle_matchup.units,
    pinnacle_special_description: special_description,
    pinnacle_special_category: special_category,
    pinnacle_odds_type: pinnacle_matchup.pinnacle_odds_type
  })

  // Track unmatched markets
  if (!market_type) {
    track_unmatched_market({
      pinnacle_matchup,
      source_market_id,
      unmatched_markets,
      unmatched_combinations
    })
  }

  return {
    market_type,
    source_id: 'PINNACLE',
    source_market_id,
    source_market_name: `type: ${pinnacle_matchup.type} / units: ${pinnacle_matchup.units} / category: ${special_category} / description: ${special_description}`,
    esbid: nfl_game ? nfl_game.esbid : null,
    year: nfl_game ? nfl_game.year : constants.season.year,
    source_event_id: pinnacle_matchup.id,
    source_event_name: format_source_event_name({
      is_valid_matchup: team_info.is_valid_matchup,
      away_team: team_info.away_team,
      home_team: team_info.home_team,
      pinnacle_matchup,
      pinnacle_matchup_special_category: special_category,
      pinnacle_matchup_special_description: special_description
    }),
    open: true,
    live: pinnacle_matchup.isLive,
    selection_count: market_selection_odds.length,
    timestamp,
    selections
  }
}

/**
 * Collects unique values from matchups for analysis
 * @param {Array} matchups - Array of pinnacle matchups
 * @returns {Object} Collection of unique values
 */
const collect_unique_values = (matchups) => {
  const unique_categories = new Set()
  const unique_descriptions = new Set()
  const unique_types = new Set()
  const unique_units_by_category = {}
  const unique_odds_types = new Set()
  const unique_units = new Set()

  for (const matchup of matchups) {
    if (matchup.special) {
      const category = matchup.special.category
      unique_categories.add(category)
      unique_descriptions.add(matchup.special.description)

      if (!unique_units_by_category[category]) {
        unique_units_by_category[category] = new Set()
      }
      if (matchup.units) {
        unique_units_by_category[category].add(matchup.units)
      }
    }
    unique_types.add(matchup.type)

    if (matchup.units) {
      unique_units.add(matchup.units)
    }
  }

  return {
    unique_categories,
    unique_descriptions,
    unique_types,
    unique_units_by_category,
    unique_odds_types,
    unique_units
  }
}

/**
 * Processes a single matchup and returns formatted results
 * @param {Object} params - Matchup processing parameters
 * @returns {Object} Processing result
 */
const process_single_matchup = async ({
  pinnacle_matchup,
  timestamp,
  nfl_games,
  unmatched_markets,
  unmatched_combinations,
  ignore_cache,
  unique_odds_types
}) => {
  const matchup_type_label =
    pinnacle_matchup.type === 'special'
      ? `${pinnacle_matchup.special?.category} - ${pinnacle_matchup.special?.description}`
      : `matchup id: ${pinnacle_matchup.id}`

  log(
    `fetching odds for ${pinnacle_matchup.type} matchup: ${matchup_type_label}`
  )

  try {
    const pinnacle_markets = await pinnacle.get_market_odds({
      matchup_id: pinnacle_matchup.id,
      ignore_cache
    })

    if (!pinnacle_markets || pinnacle_markets.length === 0) {
      log(
        `no market odds found for ${pinnacle_matchup.type} matchup: ${pinnacle_matchup.id}`
      )
      return { success: false, matchup: pinnacle_matchup }
    }

    // Track unique odds types from markets
    pinnacle_markets.forEach((market) => {
      if (market.type) {
        unique_odds_types.add(market.type)
      }
    })

    // Merge matchup with its markets for complete data structure
    const matchup_with_markets = {
      ...pinnacle_matchup,
      markets: pinnacle_markets
    }

    const formatted_markets = await process_market_odds(
      pinnacle_matchup,
      pinnacle_markets,
      timestamp,
      nfl_games,
      unmatched_markets,
      unmatched_combinations
    )

    return {
      success: true,
      matchup: pinnacle_matchup,
      matchup_with_markets,
      formatted_markets
    }
  } catch (error) {
    log(`Error processing matchup ${pinnacle_matchup.id}: ${error.message}`)
    return { success: false, matchup: pinnacle_matchup, error }
  }
}

/**
 * Processes matchups in batches with concurrency control
 * @param {Object} params - Batch processing parameters
 * @returns {Object} Processing results
 */
const process_matchup_batches = async ({
  pinnacle_matchups,
  timestamp,
  nfl_games,
  unmatched_markets,
  unmatched_combinations,
  ignore_cache,
  ignore_wait,
  unique_odds_types
}) => {
  const formatted_markets = []
  const all_matchups_with_markets = []

  const process_batch = async (matchup_batch) => {
    const batch_promises = matchup_batch.map(async (pinnacle_matchup) => {
      return process_single_matchup({
        pinnacle_matchup,
        timestamp,
        nfl_games,
        unmatched_markets,
        unmatched_combinations,
        ignore_cache,
        unique_odds_types
      })
    })

    const batch_results = await Promise.allSettled(batch_promises)

    // Process results and handle any failures gracefully
    batch_results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        const { matchup_with_markets, formatted_markets: batch_markets } =
          result.value
        all_matchups_with_markets.push(matchup_with_markets)
        formatted_markets.push(...batch_markets)
      } else if (result.status === 'rejected') {
        log(`Batch promise rejection: ${result.reason}`)
      } else if (result.value?.error) {
        log(`Matchup processing failed: ${result.value.error.message}`)
      }
    })
  }

  // Process matchups in concurrent batches
  for (let i = 0; i < pinnacle_matchups.length; i += CONCURRENCY_LIMIT) {
    const batch = pinnacle_matchups.slice(i, i + CONCURRENCY_LIMIT)
    await process_batch(batch)

    // Add delay between batches if not ignoring wait
    if (!ignore_wait && i + CONCURRENCY_LIMIT < pinnacle_matchups.length) {
      const current_batch = Math.floor(i / CONCURRENCY_LIMIT) + 1
      const total_batches = Math.ceil(
        pinnacle_matchups.length / CONCURRENCY_LIMIT
      )
      log(
        `Batch ${current_batch}/${total_batches} complete, waiting ${BATCH_WAIT_TIME / 1000} seconds...`
      )
      await wait(BATCH_WAIT_TIME)
    }
  }

  return { formatted_markets, all_matchups_with_markets }
}

/**
 * Saves data to files if requested
 * @param {Object} params - Save parameters
 */
const save_data_files = async ({
  timestamp,
  all_matchups_with_markets,
  formatted_markets
}) => {
  await fs.writeFile(
    `./tmp/pinnacle-markets-${timestamp}.json`,
    JSON.stringify(all_matchups_with_markets, null, 2)
  )

  await fs.writeFile(
    `./tmp/pinnacle-markets-formatted-${timestamp}.json`,
    JSON.stringify(formatted_markets, null, 2)
  )

  log(`Saved raw matchups to ./tmp/pinnacle-markets-${timestamp}.json`)
  log(
    `Saved formatted data to ./tmp/pinnacle-markets-formatted-${timestamp}.json`
  )
}

/**
 * Logs summary information about unique values and unmatched markets
 * @param {Object} params - Summary parameters
 */
const log_summary = ({
  unique_values,
  unmatched_markets,
  unmatched_combinations
}) => {
  const {
    unique_categories,
    unique_descriptions,
    unique_types,
    unique_units_by_category,
    unique_odds_types,
    unique_units
  } = unique_values

  log('\n=== UNIQUE VALUES SUMMARY ===')
  log('Unique categories:', Array.from(unique_categories))
  log('Unique types:', Array.from(unique_types))
  log('Unique odds types:', Array.from(unique_odds_types))
  log('Unique units:', Array.from(unique_units))
  log('Unique units by category:')
  for (const [category, units] of Object.entries(unique_units_by_category)) {
    log(`  ${category}:`, Array.from(units))
  }
  log(
    'Unique descriptions (first 10):',
    Array.from(unique_descriptions).slice(0, 10)
  )

  // Output unmatched markets summary
  if (unmatched_markets.size > 0) {
    log(`\n=== UNMATCHED MARKETS SUMMARY ===`)
    log(`Total unmatched markets: ${unmatched_markets.size}`)
    log(`Total unmatched combinations: ${unmatched_combinations.size}`)

    log(`\n=== UNMATCHED COMBINATIONS ===`)
    for (const [, combination] of unmatched_combinations) {
      log(`\nCombination (${combination.count} occurrences):`)
      log(`  Matchup Type: ${combination.matchup_type}`)
      log(`  Special Category: ${combination.special_category}`)
      log(`  Special Description: ${combination.special_description}`)
      log(`  Odds Type: ${combination.odds_type}`)
      log(`  Units: ${combination.units}`)
      log(`  Is Alternate: ${combination.is_alternate}`)
    }
  }
}

/**
 * Main function to import pinnacle odds
 * @param {Object} options - Import options
 */
const import_pinnacle_odds = async ({
  dry_run = false,
  ignore_cache = false,
  ignore_wait = false,
  save = false
} = {}) => {
  console.time('import-pinnacle-odds')

  // Initialize player cache for fast lookups
  log('Initializing player cache...')
  try {
    await preload_active_players()
    log('Player cache initialization completed')
  } catch (error) {
    log(`Player cache initialization failed: ${error.message}`)
    throw error
  }

  const timestamp = Math.round(Date.now() / 1000)
  const nfl_games = await db('nfl_games').where({ year: constants.season.year })
  const pinnacle_matchups = await pinnacle.get_nfl_matchups({ ignore_cache })

  // Collect unique values for analysis
  const unique_values = collect_unique_values(pinnacle_matchups)

  // Track unmatched markets
  const unmatched_markets = new Set()
  const unmatched_combinations = new Map()

  log(`found ${pinnacle_matchups.length} matchups to process`)

  // Process matchups in batches
  const { formatted_markets, all_matchups_with_markets } =
    await process_matchup_batches({
      pinnacle_matchups,
      timestamp,
      nfl_games,
      unmatched_markets,
      unmatched_combinations,
      ignore_cache,
      ignore_wait,
      unique_odds_types: unique_values.unique_odds_types
    })

  // Save data files if requested
  if (save) {
    await save_data_files({
      timestamp,
      all_matchups_with_markets,
      formatted_markets
    })
  }

  // Log summary information
  log_summary({ unique_values, unmatched_markets, unmatched_combinations })

  if (dry_run) {
    log(formatted_markets.slice(0, 10))
    return
  }

  if (formatted_markets.length) {
    log(`Inserting ${formatted_markets.length} markets into database`)
    await insert_prop_markets(formatted_markets)
  }

  console.timeEnd('import-pinnacle-odds')
}

/**
 * Job wrapper function for pinnacle odds import
 * @returns {Promise<void>}
 */
export const job = async () => {
  let error
  try {
    await import_pinnacle_odds({
      dry_run: argv.dry,
      ignore_cache: argv.ignore_cache,
      ignore_wait: argv.ignore_wait,
      save: argv.save
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_PINNACLE_ODDS,
    error
  })
}

/**
 * Main entry point when run directly
 * @returns {Promise<void>}
 */
const main = async () => {
  await job()
  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_pinnacle_odds
