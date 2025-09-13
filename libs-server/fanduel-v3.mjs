import fetch from 'node-fetch'
import debug from 'debug'

import db from '#db'
import { fanduel_session_manager } from './session-manager.mjs'
import {
  get_market_type,
  format_selection_type,
  get_player_string
} from './fanduel.mjs'

const log = debug('fanduel-v3')
debug.enable('fanduel-v3')

const FANDUEL_EVENT_PAGE_ENDPOINT = '/event-page'
const FANDUEL_CONTENT_PAGE_ENDPOINT = '/content-managed-page'
const DEFAULT_REQUEST_DELAY_MS = 10000
const MAX_REQUEST_DELAY_MS = 30000

const get_fanduel_config = async () => {
  const config_row = await db('config').where('key', 'fanduel_config').first()
  return config_row?.value || {}
}

const get_fanduel_api_base_url = async () => {
  const fanduel_config = await get_fanduel_config()
  return fanduel_config.api_url || 'https://sbapi.dc.sportsbook.fanduel.com/api'
}

const build_fanduel_request_headers = ({ headers_data }) => {
  if (!headers_data) {
    throw new Error('Missing V3 session headers')
  }

  return headers_data
}

const add_random_request_delay = async () => {
  const delay_ms =
    Math.floor(
      Math.random() * (MAX_REQUEST_DELAY_MS - DEFAULT_REQUEST_DELAY_MS + 1)
    ) + DEFAULT_REQUEST_DELAY_MS
  log(`Adding random delay: ${delay_ms}ms`)
  await new Promise((resolve) => setTimeout(resolve, delay_ms))
}

export const get_fanduel_events_v3 = async ({ ignore_cache = false } = {}) => {
  try {
    const headers =
      await fanduel_session_manager.get_valid_fanduel_session_headers()
    const fanduel_config = await get_fanduel_config()
    const fanduel_api_base_url = await get_fanduel_api_base_url()
    const query_params = fanduel_config.query_params || ''

    const fanduel_content_url = `${fanduel_api_base_url}${FANDUEL_CONTENT_PAGE_ENDPOINT}?betexRegion=GBR&capiJurisdiction=intl&currencyCode=USD&exchangeLocale=en_US&includePrices=true&includeRaceCards=false&includeSeo=true&language=en&regionCode=NAMERICA&timezone=America%2FNew_York&includeMarketBlurbs=true&page=CUSTOM&customPageId=nfl${query_params}`

    const request_headers = build_fanduel_request_headers({
      headers_data: headers
    })

    log(`Fetching FanDuel events from: ${fanduel_content_url}`)

    await add_random_request_delay()

    const fanduel_response = await fetch(fanduel_content_url, {
      headers: request_headers,
      method: 'GET'
    })

    if (!fanduel_response.ok) {
      await fanduel_session_manager.mark_fanduel_session_as_failed()
      throw new Error(
        `FanDuel API request failed: ${fanduel_response.status} ${fanduel_response.statusText}`
      )
    }

    const fanduel_data = await fanduel_response.json()

    const nfl_game_competition_id = 12282733
    const filtered_nfl_events = Object.values(
      fanduel_data.attachments.events
    ).filter((event) => event.competitionId === nfl_game_competition_id)
    const fanduel_markets = Object.values(fanduel_data.attachments.markets)

    return {
      nfl_games_events: filtered_nfl_events,
      markets: fanduel_markets
    }
  } catch (error) {
    log(`Error fetching FanDuel events: ${error.message}`)
    throw error
  }
}

export const get_fanduel_event_tab_v3 = async ({ event_id, tab_name }) => {
  if (!event_id) {
    throw new Error('Missing required parameter: event_id')
  }

  if (!tab_name) {
    throw new Error('Missing required parameter: tab_name')
  }

  try {
    const headers =
      await fanduel_session_manager.get_valid_fanduel_session_headers()
    const fanduel_config = await get_fanduel_config()
    const fanduel_api_base_url = await get_fanduel_api_base_url()
    const query_params = fanduel_config.query_params || ''

    const fanduel_event_url = `${fanduel_api_base_url}${FANDUEL_EVENT_PAGE_ENDPOINT}?betexRegion=GBR&capiJurisdiction=intl&currencyCode=USD&exchangeLocale=en_US&includePrices=true&language=en&priceHistory=1&regionCode=NAMERICA&eventId=${event_id}&tab=${tab_name}${query_params}`

    const request_headers = build_fanduel_request_headers({
      headers_data: headers
    })

    log(`Fetching FanDuel event tab: ${fanduel_event_url}`)

    await add_random_request_delay()

    const fanduel_response = await fetch(fanduel_event_url, {
      headers: request_headers,
      method: 'GET'
    })

    if (!fanduel_response.ok) {
      await fanduel_session_manager.mark_fanduel_session_as_failed()
      throw new Error(
        `FanDuel event tab request failed: ${fanduel_response.status} ${fanduel_response.statusText}`
      )
    }

    const fanduel_event_data = await fanduel_response.json()
    return fanduel_event_data
  } catch (error) {
    log(`Error fetching FanDuel event tab: ${error.message}`)
    throw error
  }
}

export const parse_fanduel_market_v3 = ({ market_data, event_data = null }) => {
  if (!market_data) {
    throw new Error('Missing required parameter: market_data')
  }

  try {
    const market_type = get_market_type({
      marketType: market_data.marketType,
      marketName: market_data.marketName
    })

    return {
      market_id: market_data.marketId,
      market_name: market_data.marketName,
      market_type,
      source_event_name: event_data?.eventName || null,
      selections:
        market_data.runners?.map((runner) => ({
          selection_id: runner.runnerId,
          selection_name: runner.runnerName,
          selection_type: format_selection_type({
            market_type: market_data.marketType,
            selection_name: runner.runnerName
          }),
          player_name: get_player_string({
            marketName: market_data.marketName,
            marketType: market_data.marketType,
            runnerName: runner.runnerName
          }),
          american_odds:
            runner.winRunnerOdds?.americanDisplayOdds?.americanOdds || null,
          decimal_odds:
            runner.winRunnerOdds?.decimalDisplayOdds?.decimalOdds || null
        })) || []
    }
  } catch (error) {
    log(`Error parsing FanDuel market: ${error.message}`)
    throw error
  }
}

export const get_fanduel_weekly_specials_v3 = async () => {
  try {
    const { markets } = await get_fanduel_events_v3()

    const special_market_names = [
      'Most Passing Yards - Sunday Only',
      'Most Receiving Yards - Sunday Only',
      'Most Rushing Yards - Sunday Only'
    ]

    const filtered_weekly_specials = markets.filter((market) =>
      special_market_names.includes(market.marketName)
    )

    return filtered_weekly_specials
  } catch (error) {
    log(`Error fetching FanDuel weekly specials: ${error.message}`)
    throw error
  }
}

export const test_fanduel_v3_connection = async () => {
  try {
    log('Testing FanDuel V3 connection')
    const test_result = await get_fanduel_events_v3()
    log('FanDuel V3 connection test successful')
    return {
      success: true,
      events_count: test_result.nfl_games_events?.length || 0,
      markets_count: test_result.markets?.length || 0
    }
  } catch (error) {
    log(`FanDuel V3 connection test failed: ${error.message}`)
    return {
      success: false,
      error: error.message
    }
  }
}
