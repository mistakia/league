/**
 * Market formatting utilities for DraftKings odds import
 */

import debug from 'debug'
import dayjs from 'dayjs'
import { bookmaker_constants } from '#libs-shared'
import { current_season } from '#constants'
import { draftkings, clean_string } from '#libs-server'
import { find_player } from '#libs-server/player-cache.mjs'
import { normalize_selection_metric_line } from '#libs-server/normalize-selection-metric-line.mjs'
import {
  is_game_event,
  extract_team_abbreviations,
  determine_teams,
  extract_player_info,
  process_american_odds,
  extract_metric_line,
  get_implicit_threshold_for_market_type
} from './draftkings-helpers.mjs'

const log = debug('import-draft-kings')

/**
 * Finds matching NFL game for a DraftKings event
 * @param {object} draftkings_event - The DraftKings event
 * @param {NflGamesRow[]} nfl_games - Array of NFL games
 * @returns {object|null} - Matching NFL game or null
 */
const find_matching_nfl_game = (draftkings_event, nfl_games) => {
  const { week, seas_type: season_type } = current_season.calculate_week(
    dayjs(draftkings_event.startEventDate)
  )

  const { visitor_team, home_team } = determine_teams(draftkings_event)

  if (!visitor_team || !home_team) {
    log(`Invalid team names - visitor: ${visitor_team}, home: ${home_team}`)
    log(`Event: ${draftkings_event.name}`)
    return null
  }

  // Search for matching NFL game
  let nfl_game = nfl_games.find(
    (game) =>
      game.week === week &&
      game.season_type === season_type &&
      game.season_year === current_season.year &&
      game.away_nfl_team === visitor_team &&
      game.home_nfl_team === home_team
  )

  if (!nfl_game) {
    // Try the reverse mapping as fallback
    nfl_game = nfl_games.find(
      (game) =>
        game.week === week &&
        game.season_type === season_type &&
        game.season_year === current_season.year &&
        game.away_nfl_team === home_team &&
        game.home_nfl_team === visitor_team
    )
  }

  if (!nfl_game) {
    log(
      `No NFL game found for: ${visitor_team} @ ${home_team} (week ${week}, season ${season_type})`
    )
    log(`Event: ${draftkings_event?.name}`)
  }

  return nfl_game
}

/**
 * Processes a DraftKings selection and returns formatted selection data
 * @param {object} selection - The DraftKings selection
 * @param {object} market - The DraftKings market
 * @param {object} event - The DraftKings event
 * @param {string[]} nfl_team_abbreviations - Array of NFL team abbreviations
 * @param {string} market_type - The determined market type for this selection
 * @returns {object} - Formatted selection object
 */
const process_selection = (
  selection,
  market,
  event,
  nfl_team_abbreviations,
  market_type
) => {
  let player_row = null
  let draftkings_team = null

  // Determine if this is a player selection
  const is_player_selection = selection.participants?.[0]?.type === 'Player'
  let draftkings_player_name = is_player_selection
    ? selection.participants[0].name
    : null

  // For futures markets, extract player name from event name if no participant data
  if (!draftkings_player_name && event?.name) {
    draftkings_player_name = draftkings.extract_player_name_from_event(
      event.name
    )
  }

  // Extract player info (name and team)
  const { name: cleaned_player_name, team: player_team_from_name } =
    extract_player_info(draftkings_player_name)

  // Find player if we have a player name
  if (cleaned_player_name) {
    const search_teams = player_team_from_name
      ? [player_team_from_name]
      : nfl_team_abbreviations

    const player_search_params = {
      name: cleaned_player_name,
      teams: search_teams,
      ignore_free_agent: true,
      ignore_retired: true
    }

    try {
      player_row = find_player(player_search_params)
    } catch (err) {
      log(`Error finding player: ${err.message}`)
      log(`Stack trace: ${err.stack}`)
      log(`Search params: ${JSON.stringify(player_search_params)}`)
    }

    if (!player_row) {
      log(
        `Could not find player: ${player_search_params.name} / ${player_search_params.teams}`
      )
    }
  }

  // Handle team selections
  if (selection.participants?.[0]?.type === 'Team') {
    draftkings_team = draftkings.get_team_from_participant({
      participant: selection.participants[0].name,
      participantType: 'Team'
    })
  }

  let formatted_selection_pid = player_row?.pid || draftkings_team || null

  // Handle game spread market special case. RAW DraftKings markets carry no
  // top-level categoryId, so the re-run below always saw undefined and recorded
  // the null category into the mapper's collector on every selection -- the
  // recurring `null` offer-category id on signals 128409/128469/128477. The
  // caller already derived market_type from the real offer category, so compare
  // that instead of re-deriving from an absent field.
  const is_game_spread_market =
    market_type === bookmaker_constants.team_game_market_types.GAME_SPREAD

  if (is_game_spread_market && selection.label) {
    try {
      const team_abbr = selection.label.split(' ')[1]
      if (team_abbr) {
        formatted_selection_pid = draftkings.get_team_from_participant({
          participant: team_abbr,
          participantType: 'Team'
        })
      }
    } catch (err) {
      log(`Error processing spread market selection: ${err.message}`)
      log(`Stack trace: ${err.stack}`)
      log(`Selection label: ${selection.label}`)
    }
  }

  // Extract metric line
  let formatted_selection_metric_line = selection.points
  if (!formatted_selection_metric_line) {
    formatted_selection_metric_line = extract_metric_line(selection.label)
  }

  // Normalize the line for N+ discrete stat markets
  formatted_selection_metric_line = normalize_selection_metric_line({
    raw_value: formatted_selection_metric_line,
    selection_name: clean_string(selection.label)
  })

  // Apply implicit threshold for market types where threshold is determined by
  // market type rather than provided in the data (e.g., touchdown markets)
  if (formatted_selection_metric_line === null && market_type) {
    formatted_selection_metric_line =
      get_implicit_threshold_for_market_type(market_type)
  }

  // Process American odds
  const odds_american_value = process_american_odds(
    selection.displayOdds?.american
  )

  return {
    source_id: 'DRAFTKINGS',
    source_market_id: market.id,
    source_selection_id: selection.id,

    selection_pid: formatted_selection_pid,
    selection_name: clean_string(selection.label),
    selection_type: draftkings.format_selection_type(
      selection.label,
      market_type
    ),
    selection_metric_line: formatted_selection_metric_line,
    odds_decimal: selection.trueOdds,
    odds_american: odds_american_value
  }
}

/**
 * Formats a DraftKings market into the standard format
 * @param {object} params - Parameters object
 * @param {object} params.draftkings_market - The DraftKings market
 * @param {object[]} params.draftkings_selections - Array of DraftKings selections
 * @param {object[]} params.draftkings_events - Array of DraftKings events
 * @param {object} params.draftkings_offer_category - The offer category
 * @param {object} params.draftkings_offer_sub_category - The offer subcategory
 * @param {Date} params.format_observed_at - Observation time for formatting
 * @param {NflGamesRow[]} params.nfl_games - Array of NFL games
 * @returns {object|null} - Formatted market object or null
 */
export const format_market = async ({
  draftkings_market,
  draftkings_selections,
  draftkings_events,
  draftkings_offer_category,
  draftkings_offer_sub_category,
  format_observed_at,
  nfl_games = []
}) => {
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

  // Extract team abbreviations
  const nfl_team_abbreviations = extract_team_abbreviations(
    draftkings_event,
    is_game_event_result
  )

  // Find matching NFL game for game events
  let nfl_game = null
  if (is_game_event_result) {
    nfl_game = find_matching_nfl_game(draftkings_event, nfl_games)
  }

  // Get market type
  const draftkings_market_type = draftkings.get_market_type({
    offerCategoryId: draftkings_offer_category.offerCategoryId,
    subcategoryId: draftkings_offer_sub_category.subcategoryId,
    betOfferTypeId: draftkings_market.marketType?.betOfferTypeId,
    marketTypeId: draftkings_market.marketType?.id
  })

  // Filter selections for this market
  const draftkings_market_selections = draftkings_selections.filter(
    (selection) => selection.marketId === draftkings_market.id
  )

  // Process all selections
  const formatted_selections = draftkings_market_selections.map((selection) =>
    process_selection(
      selection,
      draftkings_market,
      draftkings_event,
      nfl_team_abbreviations,
      draftkings_market_type
    )
  )

  return {
    market_type: draftkings_market_type,

    source_id: 'DRAFTKINGS',
    source_market_id: draftkings_market.id,
    source_market_name: clean_string(
      `${draftkings_offer_category.name?.trim() || ''} - ${draftkings_offer_sub_category.name || ''} - ${draftkings_market.name || ''} (categoryId: ${draftkings_offer_category.offerCategoryId}, subcategoryId: ${draftkings_offer_sub_category.subcategoryId}, betOfferTypeId: ${draftkings_market.marketType?.betOfferTypeId}, marketTypeId: ${draftkings_market.marketType?.id})`
    ),

    esbid: nfl_game ? nfl_game.esbid : null,
    season_year: nfl_game ? nfl_game.season_year : current_season.year,
    source_event_id: draftkings_market.eventId,
    source_event_name: clean_string(draftkings_event?.name) || null,

    is_open: true, // Assume open if present in API
    is_live: null,
    selection_count: draftkings_market_selections.length,

    observed_at: format_observed_at,
    selections: formatted_selections
  }
}
