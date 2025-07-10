import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs-extra'
import dayjs from 'dayjs'

import db from '#db'
import { constants, fixTeam, bookmaker_constants } from '#libs-shared'
import {
  is_main,
  find_player_row,
  draftkings,
  insert_prop_markets,
  wait,
  report_job,
  track_category_activity,
  get_active_categories,
  get_priority_categories
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .option('mode', {
    describe: 'Import mode',
    type: 'string',
    default: 'all',
    choices: ['all', 'events']
  })
  .option('categories', {
    describe: 'Comma-separated list of category IDs to filter',
    type: 'string'
  })
  .option('subcategories', {
    describe: 'Comma-separated list of subcategory IDs to filter',
    type: 'string'
  })
  .option('events', {
    describe: 'Comma-separated list of event IDs to process (events mode only)',
    type: 'string'
  })
  .option('use-tracking', {
    describe: 'Use tracking data to filter categories/subcategories',
    type: 'string',
    choices: ['active', 'priority'],
    conflicts: ['categories', 'subcategories']
  })
  .option('tracking-days', {
    describe: 'Days to look back for active tracking filter',
    type: 'number',
    default: 7
  })
  .option('dry', {
    describe: 'Dry run - do not insert to database',
    type: 'boolean',
    default: false
  })
  .option('write', {
    describe: 'Write JSON files to tmp directory',
    type: 'boolean',
    default: false
  })
  .help('h')
  .alias('h', 'help')
  .example('$0', 'Import all categories and subcategories')
  .example(
    '$0 --mode events',
    'Import using events mode (faster for specific events)'
  )
  .example('$0 --categories 492,528', 'Import specific categories by ID')
  .example(
    '$0 --subcategories 17147,17223',
    'Import specific subcategories by ID'
  )
  .example(
    '$0 --mode events --events 32225662 --categories 492',
    'Import game lines for specific event'
  )
  .example(
    '$0 --use-tracking active --tracking-days 3',
    'Import categories active in last 3 days'
  )
  .example(
    '$0 --use-tracking priority',
    'Import priority categories (recent activity + good success rates)'
  )
  .example('$0 --dry --write', 'Dry run with JSON output files')
  .epilogue(
    'Modes:\n' +
      '  all:    Process all league categories and subcategories\n' +
      '  events: Process specific events with their categories\n\n' +
      'Tracking Filters:\n' +
      '  active:   Categories that had offers in the last N days\n' +
      '  priority: Categories with recent activity OR good success rates\n\n' +
      'Common Category IDs:\n' +
      '  492:  Game Lines (spreads, totals, moneylines)\n' +
      '  1000: Passing Props\n' +
      '  1001: Rushing/Receiving Props\n' +
      '  1342: Receiving Props\n' +
      '  634:  Season Leaders'
  ).argv
const log = debug('import-draft-kings')
debug.enable(
  'import-draft-kings,get-player,draftkings,insert-prop-market,insert-prop-market-selections'
)

// Helper function to validate team names before passing to fixTeam
const is_valid_team_name = (team_name) => {
  if (!team_name || typeof team_name !== 'string') {
    return false
  }

  // Check for complex strings that shouldn't be passed to fixTeam
  const trimmed_name = team_name.trim()

  // Reject if it contains division/ranking text patterns
  if (
    /^\d+(ST|ND|RD|TH)\s+/i.test(trimmed_name) ||
    trimmed_name.includes('/') ||
    trimmed_name.includes('1ST') ||
    trimmed_name.includes('2ND') ||
    trimmed_name.includes('3RD') ||
    trimmed_name.includes('4TH') ||
    trimmed_name.length > 50
  ) {
    return false
  }

  return true
}

// Helper function to check if an event is a game event vs futures/non-game event
const is_game_event = (draftkings_event) => {
  if (!draftkings_event) {
    return false
  }

  // Game events have numeric IDs, futures/non-game events have GUID format
  const is_numeric_id = /^\d+$/.test(draftkings_event.id)

  // Game events have 2 participants with venueRole (Home/Away)
  const has_two_participants = draftkings_event.participants?.length === 2
  const has_venue_roles =
    draftkings_event.participants?.some((p) => p.venueRole === 'Home') &&
    draftkings_event.participants?.some((p) => p.venueRole === 'Away')

  // Game events have eventParticipantType of 'TwoTeam'
  const is_two_team_event = draftkings_event.eventParticipantType === 'TwoTeam'

  // Game events typically have event names with '@' (Team @ Team format)
  const has_game_name_format = draftkings_event.name?.includes(' @ ')

  return (
    is_numeric_id &&
    has_two_participants &&
    (has_venue_roles || is_two_team_event || has_game_name_format)
  )
}

// Safe wrapper around fixTeam that validates input
const safe_fix_team = (team_name) => {
  if (!is_valid_team_name(team_name)) {
    log(`Skipping invalid team name: ${team_name}`)
    return null
  }

  try {
    return fixTeam(team_name)
  } catch (err) {
    log(`Error processing team name "${team_name}": ${err.message}`)
    log(`Stack trace: ${err.stack}`)
    return null
  }
}

// Analyze formatted markets for missing fields and unmatched market types
const analyze_formatted_markets = (formatted_markets) => {
  log(`\n=== MARKET ANALYSIS ===`)

  // Check for missing esbid and year
  const missing_esbid = []
  const missing_year = []
  const missing_market_type = []
  const source_markets_missing_market_type = new Set()

  formatted_markets.forEach((market, index) => {
    // Check for missing esbid
    if (
      !('esbid' in market) ||
      market.esbid === null ||
      market.esbid === undefined
    ) {
      missing_esbid.push({
        index,
        source_market_id: market.source_market_id,
        source_market_name: market.source_market_name
      })
    }

    // Check for missing year
    if (
      !('year' in market) ||
      market.year === null ||
      market.year === undefined
    ) {
      missing_year.push({
        index,
        source_market_id: market.source_market_id,
        source_market_name: market.source_market_name
      })
    }

    // Check for missing market_type
    if (
      !('market_type' in market) ||
      market.market_type === null ||
      market.market_type === undefined ||
      market.market_type === ''
    ) {
      missing_market_type.push({
        index,
        source_market_id: market.source_market_id,
        source_market_name: market.source_market_name
      })

      // Add to set of source_market_names with missing market_type
      if (market.source_market_name) {
        source_markets_missing_market_type.add(market.source_market_name)
      }
    }
  })

  log(`Markets missing 'esbid': ${missing_esbid.length}`)
  if (missing_esbid.length > 0) {
    log('Markets with missing esbid:')
    missing_esbid.slice(0, 10).forEach((market, idx) => {
      log(
        `  ${idx + 1}. ${market.source_market_name} (ID: ${market.source_market_id})`
      )
    })
    if (missing_esbid.length > 10) {
      log(`  ... and ${missing_esbid.length - 10} more`)
    }
  }

  log(`Markets missing 'year': ${missing_year.length}`)
  if (missing_year.length > 0) {
    log('Markets with missing year:')
    missing_year.slice(0, 10).forEach((market, idx) => {
      log(
        `  ${idx + 1}. ${market.source_market_name} (ID: ${market.source_market_id})`
      )
    })
    if (missing_year.length > 10) {
      log(`  ... and ${missing_year.length - 10} more`)
    }
  }

  log(`Markets missing 'market_type': ${missing_market_type.length}`)
  if (source_markets_missing_market_type.size > 0) {
    log(
      `Unique source_market_names with missing market_type: ${source_markets_missing_market_type.size}`
    )

    // Extract unique category/subcategory/betOfferTypeId combinations
    const unique_category_combinations = new Set()
    const category_combination_examples = new Map()

    missing_market_type.forEach((market) => {
      // Extract category info from source_market_name
      const match = market.source_market_name.match(
        /\(categoryId: (\d+), subcategoryId: (\d+), betOfferTypeId: (\d+)\)/
      )
      if (match) {
        const [, category_id, subcategory_id, bet_offer_type_id] = match
        const combination_key = `${category_id}/${subcategory_id}/${bet_offer_type_id}`
        unique_category_combinations.add(combination_key)

        // Store an example market name for this combination
        if (!category_combination_examples.has(combination_key)) {
          // Extract just the category and subcategory part (before the market name)
          const category_part = market.source_market_name
            .split(' - ')
            .slice(0, 2)
            .join(' - ')
          category_combination_examples.set(combination_key, category_part)
        }
      }
    })

    log('Unique category combinations missing market_type:')
    const sorted_combinations = Array.from(unique_category_combinations).sort()
    sorted_combinations.forEach((combination, idx) => {
      const example =
        category_combination_examples.get(combination) || 'Unknown'
      log(
        `  ${idx + 1}. ${example} (categoryId/subcategoryId/betOfferTypeId: ${combination})`
      )
    })

    log(`Total unique category combinations: ${sorted_combinations.length}`)
  }
}

const format_market = async ({
  draftkings_market,
  draftkings_selections,
  draftkings_events,
  draftkings_offer_category,
  draftkings_offer_sub_category,
  format_timestamp,
  nfl_games = []
}) => {
  let nfl_game
  const formatted_selections = []

  const draftkings_event = draftkings_events.find(
    (e) => e.id === draftkings_market.eventId
  )

  // Skip markets without events
  if (!draftkings_event) {
    log(`No event found for market ${draftkings_market.id}`)
    return null
  }

  // Check if this is a game event vs futures/non-game event
  const is_game_event_result = is_game_event(draftkings_event)

  if (!is_game_event_result) {
    log(`Non-game event: ${draftkings_event.name} (${draftkings_event.id})`)
  }

  // Event structure available for debugging if needed

  const nfl_team_abbreviations =
    is_game_event_result &&
    draftkings_event &&
    draftkings_event.participants &&
    draftkings_event.participants.length >= 2
      ? [
          safe_fix_team(
            draftkings_event.participants[0]?.metadata?.shortName ||
              draftkings_event.participants[0]?.shortName ||
              draftkings_event.participants[0]?.name
          ),
          safe_fix_team(
            draftkings_event.participants[1]?.metadata?.shortName ||
              draftkings_event.participants[1]?.shortName ||
              draftkings_event.participants[1]?.name
          )
        ].filter(Boolean)
      : []

  if (
    is_game_event_result &&
    draftkings_event &&
    draftkings_event.participants &&
    draftkings_event.participants.length >= 2
  ) {
    const { week, seas_type } = constants.season.calculate_week(
      dayjs(draftkings_event.startEventDate)
    )

    // Use venueRole to determine visitor/home teams
    let visitor_team, home_team

    // Find home and away teams from participants
    const draftkings_home_participant = draftkings_event.participants?.find(
      (p) => p.venueRole === 'Home'
    )
    const draftkings_away_participant = draftkings_event.participants?.find(
      (p) => p.venueRole === 'Away'
    )

    if (draftkings_home_participant && draftkings_away_participant) {
      visitor_team = safe_fix_team(
        draftkings_away_participant.metadata?.shortName ||
          draftkings_away_participant.name
      )
      home_team = safe_fix_team(
        draftkings_home_participant.metadata?.shortName ||
          draftkings_home_participant.name
      )
    } else if (draftkings_event.name && draftkings_event.name.includes(' @ ')) {
      // Primary fallback: parse event name "Visitor @ Home"
      const [visitor_name, home_name] = draftkings_event.name.split(' @ ')
      visitor_team = safe_fix_team(visitor_name.split(' ').pop()) // Get last word (team name)
      home_team = safe_fix_team(home_name.split(' ').pop()) // Get last word (team name)
    } else {
      // Final fallback: use participants order
      visitor_team = safe_fix_team(
        draftkings_event.participants[0]?.metadata?.shortName ||
          draftkings_event.participants[0]?.shortName ||
          draftkings_event.participants[0]?.name
      )
      home_team = safe_fix_team(
        draftkings_event.participants[1]?.metadata?.shortName ||
          draftkings_event.participants[1]?.shortName ||
          draftkings_event.participants[1]?.name
      )
    }

    // Search for matching NFL game
    // Only try to match if we have valid team names
    if (!visitor_team || !home_team) {
      log(`Invalid team names - visitor: ${visitor_team}, home: ${home_team}`)
      log(`Event: ${draftkings_event.name}`)
    }

    if (visitor_team && home_team) {
      nfl_game = nfl_games.find(
        (game) =>
          game.week === week &&
          game.seas_type === seas_type &&
          game.year === constants.season.year &&
          game.v === visitor_team &&
          game.h === home_team
      )

      if (!nfl_game) {
        // Try the reverse mapping as fallback
        nfl_game = nfl_games.find(
          (game) =>
            game.week === week &&
            game.seas_type === seas_type &&
            game.year === constants.season.year &&
            game.v === home_team &&
            game.h === visitor_team
        )
      }

      if (!nfl_game) {
        log(
          `No NFL game found for: ${visitor_team} @ ${home_team} (week ${week}, season ${seas_type})`
        )
        log(`Event: ${draftkings_event?.name}`)
      }
    } else {
      log(`Invalid team names - visitor: ${visitor_team}, home: ${home_team}`)
      log(`Event: ${draftkings_event?.name}`)
    }
  }

  const draftkings_market_type = draftkings.get_market_type({
    offerCategoryId: draftkings_offer_category.offerCategoryId,
    subcategoryId: draftkings_offer_sub_category.subcategoryId,
    betOfferTypeId: draftkings_market.marketType?.betOfferTypeId
  })

  const is_game_spread_market =
    draftkings_market_type ===
    bookmaker_constants.team_game_market_types.GAME_SPREAD

  // Filter selections for this market
  const draftkings_market_selections = draftkings_selections.filter(
    (selection) => selection.marketId === draftkings_market.id
  )

  for (const draftkings_selection of draftkings_market_selections) {
    let player_row

    const is_player_selection =
      draftkings_selection.participants?.[0]?.type === 'Player'
    const draftkings_player_name = is_player_selection
      ? draftkings_selection.participants[0].name
      : null
    if (draftkings_player_name) {
      const player_search_params = {
        name: draftkings_player_name,
        teams: nfl_team_abbreviations,
        ignore_free_agent: true,
        ignore_retired: true
      }

      try {
        player_row = await find_player_row(player_search_params)
      } catch (err) {
        log(`Error finding player: ${err.message}`)
        log(`Stack trace: ${err.stack}`)
        log(`Search params: ${JSON.stringify(player_search_params)}`)
      }

      if (!player_row) {
        log(draftkings_event)
        log(draftkings_market)
        log(draftkings_selection)
        log(
          `could not find player: ${player_search_params.name} / ${player_search_params.teams}`
        )
      }
    }

    let draftkings_team
    if (draftkings_selection.participants?.[0]?.type === 'Team') {
      draftkings_team = draftkings.get_team_from_participant({
        participant: draftkings_selection.participants[0].name,
        participantType: 'Team'
      })
    }

    let formatted_selection_pid = player_row?.pid || draftkings_team || null

    if (is_game_spread_market && draftkings_selection.label) {
      try {
        const team_abbr = draftkings_selection.label.split(' ')[1]
        if (team_abbr) {
          formatted_selection_pid = safe_fix_team(team_abbr)
        }
      } catch (err) {
        log(`Error processing spread market selection: ${err.message}`)
        log(`Stack trace: ${err.stack}`)
        log(`Selection label: ${draftkings_selection.label}`)
      }
    }

    let formatted_selection_metric_line = draftkings_selection.points

    if (!formatted_selection_metric_line && draftkings_selection.label) {
      const parsed_line = draftkings_selection.label.match(/(\d+\.?\d*)+/)
      if (parsed_line) {
        formatted_selection_metric_line = Number(parsed_line[0])
      }
    }

    formatted_selections.push({
      source_id: 'DRAFTKINGS',
      source_market_id: draftkings_market.id,
      source_selection_id: draftkings_selection.id,

      selection_pid: formatted_selection_pid,
      selection_name: draftkings_selection.label,
      selection_type: draftkings.format_selection_type(
        draftkings_selection.label
      ),
      selection_metric_line: formatted_selection_metric_line || null,
      odds_decimal: draftkings_selection.trueOdds,
      odds_american: draftkings_selection.displayOdds?.american
    })
  }

  return {
    market_type: draftkings_market_type,

    source_id: 'DRAFTKINGS',
    source_market_id: draftkings_market.id,
    source_market_name: `${draftkings_offer_category.name.trim()} - ${draftkings_offer_sub_category.name} - ${draftkings_market.name} (categoryId: ${draftkings_offer_category.offerCategoryId}, subcategoryId: ${draftkings_offer_sub_category.subcategoryId}, betOfferTypeId: ${draftkings_market.marketType?.betOfferTypeId})`,

    esbid: nfl_game ? nfl_game.esbid : null,
    year: nfl_game ? nfl_game.year : null,
    source_event_id: draftkings_market.eventId,
    source_event_name: draftkings_event?.name || null,

    open: true, // Assume open if present in API
    live: null,
    selection_count: draftkings_market_selections.length,

    timestamp: format_timestamp,
    selections: formatted_selections
  }
}

const parse_filters = async () => {
  let category_filter = null
  let subcategory_filter = null

  if (argv.categories) {
    const category_ids = argv.categories
      .split(',')
      .map((id) => parseInt(id))
      .filter((id) => !isNaN(id))
    category_filter = category_ids.length > 0 ? category_ids : null
  }

  if (argv.subcategories) {
    const subcategory_ids = argv.subcategories
      .split(',')
      .map((id) => parseInt(id))
      .filter((id) => !isNaN(id))
    subcategory_filter = subcategory_ids.length > 0 ? subcategory_ids : null
  }

  // Apply tracking-based filtering if specified
  if (argv.useTracking) {
    log(`Using tracking filter: ${argv.useTracking}`)

    let tracking_categories = []
    if (argv.useTracking === 'active') {
      tracking_categories = await get_active_categories(argv.trackingDays)
      log(
        `Found ${tracking_categories.length} active categories (last ${argv.trackingDays} days)`
      )
    } else if (argv.useTracking === 'priority') {
      tracking_categories = await get_priority_categories()
      log(`Found ${tracking_categories.length} priority categories`)
    }

    if (tracking_categories.length > 0) {
      // Extract category and subcategory IDs from tracking data
      const tracking_category_ids = [
        ...new Set(tracking_categories.map((cat) => cat.category_id))
      ]
      const tracking_subcategory_ids = [
        ...new Set(
          tracking_categories.map((cat) => cat.subcategory_id).filter(Boolean)
        )
      ]

      category_filter = tracking_category_ids
      subcategory_filter =
        tracking_subcategory_ids.length > 0 ? tracking_subcategory_ids : null

      log(
        `Tracking filter applied: ${tracking_category_ids.length} categories, ${tracking_subcategory_ids.length} subcategories`
      )
    } else {
      log('No categories found from tracking data, using all categories')
    }
  }

  return { category_filter, subcategory_filter }
}

const run_all_mode = async ({ nfl_games, timestamp }) => {
  const formatted_markets = []
  const all_markets = []
  const failed_requests = []

  const { category_filter, subcategory_filter } = await parse_filters()

  // Get all categories and subcategories from league data
  let league_data
  try {
    league_data = await draftkings.get_league_data_v1()
    log(
      `Found ${league_data.categories?.length || 0} categories and ${league_data.subcategories?.length || 0} subcategories`
    )
  } catch (err) {
    log(`Failed to get league data: ${err.message}`)
    throw err
  }

  // Group subcategories by categoryId for easier processing
  const subcategories_by_category = {}
  for (const subcategory of league_data.subcategories || []) {
    if (!subcategories_by_category[subcategory.categoryId]) {
      subcategories_by_category[subcategory.categoryId] = []
    }
    subcategories_by_category[subcategory.categoryId].push(subcategory)
  }

  // Build list of subcategories to process
  const subcategories_to_process = []

  for (const category of league_data.categories || []) {
    // Apply category filter
    if (category_filter && !category_filter.includes(category.id)) {
      continue
    }

    const category_subcategories = subcategories_by_category[category.id] || []

    for (const subcategory of category_subcategories) {
      // Apply subcategory filter
      if (subcategory_filter && !subcategory_filter.includes(subcategory.id)) {
        continue
      }

      subcategories_to_process.push({
        category_id: category.id,
        category_name: category.name,
        subcategory_id: subcategory.id,
        subcategory_name: subcategory.name
      })
    }
  }

  log(`Categories found: ${league_data.categories?.length || 0}`)
  log(`Subcategories found: ${league_data.subcategories?.length || 0}`)
  log(
    `Category filter: ${category_filter ? category_filter.join(', ') : 'none'}`
  )
  log(
    `Subcategory filter: ${subcategory_filter ? subcategory_filter.join(', ') : 'none'}`
  )

  // Track performance stats
  const stats = {
    subcategories_checked: 0,
    subcategories_with_offers: 0,
    total_offers: 0
  }

  let consecutive_empty_count = 0

  // Process each subcategory
  for (const subcategory of subcategories_to_process) {
    const { category_id, category_name, subcategory_id, subcategory_name } =
      subcategory
    stats.subcategories_checked++

    log(
      `Processing: ${category_name} -> ${subcategory_name} (${category_id}/${subcategory_id})`
    )

    let raw_data
    try {
      raw_data = await draftkings.get_subcategory_data_v1({
        categoryId: category_id,
        subcategoryId: subcategory_id
      })
    } catch (err) {
      log(
        `Failed to get offers for ${category_name} -> ${subcategory_name}: ${err.message}`
      )
      failed_requests.push({
        type: 'offers',
        category_id,
        subcategory_id,
        category_name,
        subcategory_name,
        error: err.message
      })
      await wait(1000)
      continue
    }

    // Use raw API data directly
    const draftkings_markets = raw_data.markets || []
    const draftkings_selections = raw_data.selections || []
    const draftkings_events = raw_data.events || []

    // Track category activity
    await track_category_activity({
      category_id,
      subcategory_id,
      category_name,
      subcategory_name,
      offers_found: draftkings_markets?.length || 0
    })

    if (!draftkings_markets || draftkings_markets.length === 0) {
      consecutive_empty_count++
      log(`No offers found for ${category_name} -> ${subcategory_name}`)
      // Use adaptive wait time based on consecutive empty results
      const wait_time = Math.max(500, 3000 - consecutive_empty_count * 500)
      await wait(wait_time)
      continue
    }

    // Reset empty count on successful find
    consecutive_empty_count = 0
    stats.subcategories_with_offers++
    stats.total_offers += draftkings_markets.length

    log(
      `Found ${draftkings_markets.length} offers for ${category_name} -> ${subcategory_name}`
    )

    // Format all markets for this subcategory
    for (const draftkings_market of draftkings_markets) {
      try {
        all_markets.push(draftkings_market)

        const formatted_market = await format_market({
          draftkings_market,
          draftkings_selections,
          draftkings_events,
          draftkings_offer_category: {
            offerCategoryId: category_id,
            name: category_name
          },
          draftkings_offer_sub_category: {
            subcategoryId: subcategory_id,
            name: subcategory_name
          },
          format_timestamp: timestamp,
          nfl_games
        })

        if (formatted_market) {
          formatted_markets.push(formatted_market)
        }
      } catch (err) {
        log(`Failed to format market ${draftkings_market.id}: ${err.message}`)
        log(`Stack trace: ${err.stack}`)
        failed_requests.push({
          type: 'format',
          category_id,
          subcategory_id,
          offer_id: draftkings_market.id,
          error: err.message,
          stack: err.stack
        })
      }
    }

    // Adaptive wait time based on request success
    await wait(consecutive_empty_count > 3 ? 1000 : 3000)
  }

  // Log overall statistics
  log(`\n=== SUBCATEGORY SUMMARY ===`)
  log(`Subcategories checked: ${stats.subcategories_checked}`)
  log(`Subcategories with offers: ${stats.subcategories_with_offers}`)
  log(`Total offers found: ${stats.total_offers}`)
  log(
    `Success rate: ${((stats.subcategories_with_offers / stats.subcategories_checked) * 100).toFixed(1)}%`
  )

  return { formatted_markets, all_markets, failed_requests }
}

const run_events_mode = async ({ nfl_games, timestamp }) => {
  const formatted_markets = []
  const all_markets = []
  const failed_requests = []

  const { category_filter, subcategory_filter } = await parse_filters()
  const event_filter = argv.events ? argv.events.split(',') : null

  // Get league data to get events
  let league_data
  try {
    league_data = await draftkings.get_league_data_v1()
    log(`Found ${league_data.events?.length || 0} events`)
  } catch (err) {
    log(`Failed to get league data: ${err.message}`)
    throw err
  }

  // Build subcategory lookup map from league data
  const subcategory_lookup = {}
  if (league_data.subcategories) {
    for (const subcategory of league_data.subcategories) {
      subcategory_lookup[subcategory.id] = subcategory.name
    }
    log(
      `Built subcategory lookup with ${Object.keys(subcategory_lookup).length} entries`
    )
  }

  let events_to_process = league_data.events || []

  // Apply event filter if provided
  if (event_filter) {
    events_to_process = events_to_process.filter((event) =>
      event_filter.includes(event.id)
    )
    log(
      `Filtered to ${events_to_process.length} events: ${event_filter.join(', ')}`
    )
  }

  // Process each event
  for (const event of events_to_process) {
    log(`\nProcessing event: ${event.name} (${event.id})`)

    try {
      // Get categories for this event
      const event_categories = await draftkings.get_event_categories({
        eventId: event.id
      })
      log(`Found ${event_categories.length} categories for event ${event.id}`)

      // Apply category filter
      let categories_to_process = event_categories
      if (category_filter) {
        categories_to_process = event_categories.filter((cat) =>
          category_filter.includes(cat.id)
        )
      }

      for (const category of categories_to_process) {
        log(`Processing category: ${category.name} (${category.id})`)

        try {
          // Get event category data (returns all subcategory offers for this event/category)
          const raw_data = await draftkings.get_event_category_data({
            eventId: event.id,
            categoryId: category.id
          })

          // Process raw markets
          const draftkings_markets = raw_data.markets || []
          const draftkings_selections = raw_data.selections || []
          const draftkings_events = raw_data.events || []

          // Apply subcategory filter
          let filtered_draftkings_markets = draftkings_markets
          if (subcategory_filter) {
            filtered_draftkings_markets = draftkings_markets.filter((market) =>
              subcategory_filter.includes(market.subcategoryId)
            )
            log(
              `Filtered markets from ${draftkings_markets.length} to ${filtered_draftkings_markets.length} based on subcategory filter`
            )
          }

          log(
            `Found ${filtered_draftkings_markets.length} markets for ${category.name}`
          )

          // Format markets using raw data
          for (const draftkings_market of filtered_draftkings_markets) {
            all_markets.push(draftkings_market)

            // Get subcategory info from the market
            const draftkings_offer_sub_category = {
              subcategoryId: draftkings_market.subcategoryId,
              name:
                subcategory_lookup[draftkings_market.subcategoryId] || 'Unknown'
            }

            const draftkings_offer_category = {
              offerCategoryId: category.id,
              name: category.name
            }

            const formatted_market = await format_market({
              draftkings_market,
              draftkings_selections,
              draftkings_events,
              draftkings_offer_category,
              draftkings_offer_sub_category,
              format_timestamp: timestamp,
              nfl_games
            })

            if (formatted_market) {
              formatted_markets.push(formatted_market)
            }
          }

          await wait(2000)
        } catch (err) {
          log(
            `Failed to get category data for event ${event.id}, category ${category.id}: ${err.message}`
          )
          failed_requests.push({
            type: 'event_category',
            event_id: event.id,
            event_name: event.name,
            category_id: category.id,
            category_name: category.name,
            error: err.message
          })
        }
      }

      await wait(2000)
    } catch (err) {
      log(`Failed to get categories for event ${event.id}: ${err.message}`)
      failed_requests.push({
        type: 'event_categories',
        event_id: event.id,
        event_name: event.name,
        error: err.message
      })
    }
  }

  return { formatted_markets, all_markets, failed_requests }
}

const run = async () => {
  console.time('import-draft-kings')

  const timestamp = Math.round(Date.now() / 1000)
  const nfl_games = await db('nfl_games').where({
    year: constants.season.year
  })

  log(`Running in ${argv.mode} mode`)

  let results
  if (argv.mode === 'events') {
    results = await run_events_mode({ nfl_games, timestamp })
  } else {
    results = await run_all_mode({ nfl_games, timestamp })
  }

  const { formatted_markets, all_markets, failed_requests } = results

  // Log summary of failures
  if (failed_requests.length > 0) {
    log(`\n=== FAILED REQUESTS SUMMARY ===`)
    log(`Total failed requests: ${failed_requests.length}`)

    const failures_by_type = failed_requests.reduce((acc, req) => {
      acc[req.type] = (acc[req.type] || 0) + 1
      return acc
    }, {})

    Object.entries(failures_by_type).forEach(([type, count]) => {
      log(`${type}: ${count} failures`)
    })

    log(`\nFirst 10 failures:`)
    failed_requests.slice(0, 10).forEach((req) => {
      log(
        `- ${req.type}: ${req.category_name || 'N/A'} -> ${req.subcategory_name || 'N/A'} (${req.error})`
      )
    })
  }

  log(`\n=== PROCESSING SUMMARY ===`)
  log(`Successfully processed ${formatted_markets.length} markets`)
  log(`Failed requests: ${failed_requests.length}`)
  log(
    `Success rate: ${((formatted_markets.length / (formatted_markets.length + failed_requests.length)) * 100).toFixed(1)}%`
  )

  // Analysis of formatted markets
  if (formatted_markets.length > 0) {
    analyze_formatted_markets(formatted_markets)
  }

  if (argv.write) {
    await fs.writeFile(
      `./tmp/draftking-markets-${timestamp}.json`,
      JSON.stringify(all_markets, null, 2)
    )

    await fs.writeFile(
      `./tmp/draftking-markets-formatted-${timestamp}.json`,
      JSON.stringify(formatted_markets, null, 2)
    )

    if (failed_requests.length > 0) {
      await fs.writeFile(
        `./tmp/draftking-failed-requests-${timestamp}.json`,
        JSON.stringify(failed_requests, null, 2)
      )
    }
  }

  if (argv.dry) {
    log(formatted_markets[0])
    return
  }

  if (formatted_markets.length) {
    log(`Inserting ${formatted_markets.length} markets into database`)
    await insert_prop_markets(formatted_markets)
  }

  console.timeEnd('import-draft-kings')
}

export const job = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.DRAFTKINGS_ODDS,
    error
  })
}

const main = async () => {
  await job()
  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
